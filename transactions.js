/**
 * @fileoverview FinancePro — transactions.js
 * Full transaction management: CRUD, filters, pagination,
 * recurring, installments, bulk operations, CSV export.
 */

'use strict';

App.transactions = (() => {

  const PAGE_SIZE = 25;
  let page       = 0;
  let filtered   = [];
  let selected   = new Set();
  let currentType = 'expense';
  let _debounceTimer = null;
  function debounceFilter() {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => applyFilters(), 300);
  }

  /* ══════════════════════════════════════
     MODAL
  ══════════════════════════════════════ */

  async function openModal(tx = null) {
    // Refresh caches
    App.state.categoriesCache = await db.categories.where('userId').equals(App.state.currentUser.id).toArray();
    App.state.accountsCache   = await db.accounts.where('userId').equals(App.state.currentUser.id).toArray();

    $id('txModalTitle').textContent = tx ? 'Editar Transação' : 'Nova Transação';
    $id('txEditId').value = tx ? tx.id : '';

    // Type
    setType(tx ? tx.type : 'expense');

    // Amount
    $id('txAmount').value = tx ? tx.amount : '';

    // Date
    $id('txDate').value = tx ? tx.date : today();

    // Description
    $id('txDescription').value = tx ? (tx.description || '') : '';

    // Tags
    $id('txTags').value = tx ? joinTags(tx.tags || []) : '';

    // Populate category dropdown
    populateCategorySelect(tx ? tx.type : 'expense', tx?.categoryId);

    // Populate account dropdowns
    populateAccountSelect('txAccount', tx?.accountId);
    populateAccountSelect('txAccountTo', tx?.accountToId);

    // Recurring/installment
    $id('txRecurring').checked = tx ? (tx.isRecurring || false) : false;
    toggleRecurring();
    if (tx?.isRecurring && tx?.recurringRule) {
      $id('txFrequency').value = tx.recurringRule.frequency || 'monthly';
      $id('txRecurringEnd').value = tx.recurringRule.endDate || '';
    }

    $id('txInstallment').checked = false;
    toggleInstallment();

    App.modal.open('modalTransaction');
  }

  async function editModal(id) {
    const tx = await db.transactions.get(id);
    if (tx) openModal(tx);
  }

  /* ── Type toggle ── */
  function setType(type) {
    currentType = type;
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
    // Show/hide transfer destination
    $id('txTransferTo').classList.toggle('hidden', type !== 'transfer');
    // Update category dropdown for income/expense
    if (type !== 'transfer') {
      populateCategorySelect(type);
    } else {
      $id('txCategory').innerHTML = '<option value="">— N/A para transferências —</option>';
    }
    // Currency symbol
    const cur = App.state.settings?.currency || 'BRL';
    const symbols = { BRL:'R$', USD:'$', EUR:'€', GBP:'£' };
    $id('txAmountCurrency').textContent = symbols[cur] || cur;
  }

  function populateCategorySelect(type, selectedId) {
    const cats = App.state.categoriesCache.filter(c => c.type === type);
    const sel  = $id('txCategory');
    sel.innerHTML = cats.map(c =>
      `<option value="${c.id}" ${c.id == selectedId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
    ).join('') || '<option value="">Nenhuma categoria</option>';
  }

  function populateAccountSelect(selectId, selectedId) {
    const accs = App.state.accountsCache;
    const sel  = $id(selectId);
    if (!sel) return;
    sel.innerHTML = accs.map(a =>
      `<option value="${a.id}" ${a.id == selectedId ? 'selected' : ''}>${escapeHtml(a.name)}</option>`
    ).join('') || '<option value="">Nenhuma conta</option>';
  }

  function toggleRecurring() {
    $id('txRecurringOptions').classList.toggle('hidden', !$id('txRecurring').checked);
    if ($id('txRecurring').checked) {
      $id('txInstallment').checked = false;
      toggleInstallment();
    }
  }

  function toggleInstallment() {
    $id('txInstallmentOptions').classList.toggle('hidden', !$id('txInstallment').checked);
    if ($id('txInstallment').checked) {
      $id('txRecurring').checked = false;
      toggleRecurring();
    }
  }

  /* ── Save ── */
  async function save() {
    const uid    = App.state.currentUser.id;
    const editId = $id('txEditId').value;
    const type   = currentType;
    const amount = parseFloat($id('txAmount').value);
    const catId  = parseInt($id('txCategory').value);
    const accId  = parseInt($id('txAccount').value);
    const date   = $id('txDate').value;
    const desc   = $id('txDescription').value.trim();
    const tags   = parseTags($id('txTags').value);
    const isRec  = $id('txRecurring').checked;
    const isInst = $id('txInstallment').checked;

    if (!amount || isNaN(amount) || amount <= 0) return showToast('Informe um valor válido.', 'error');
    if (!date) return showToast('Informe a data.', 'error');
    if (type !== 'transfer' && !catId) return showToast('Selecione uma categoria.', 'error');
    if (!accId) return showToast('Selecione uma conta.', 'error');

    const base = {
      userId: uid, type, amount, categoryId: catId || null,
      accountId: accId, date, description: desc, tags,
      isRecurring: isRec, recurringRule: null,
      groupId: null, installmentNum: null, installmentTotal: null,
      accountToId: type === 'transfer' ? parseInt($id('txAccountTo').value) || null : null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };

    if (isRec) {
      base.recurringRule = {
        frequency: $id('txFrequency').value,
        endDate:   $id('txRecurringEnd').value || null,
      };
    }

    try {
      if (editId) {
        // Update
        const existing = await db.transactions.get(parseInt(editId));
        await logTransaction(parseInt(editId), uid, 'update', existing);
        await db.transactions.update(parseInt(editId), { ...base, createdAt: existing.createdAt });
        showToast('Transação atualizada!', 'success');
      } else if (isInst) {
        // Installments
        const count   = parseInt($id('txInstallments').value) || 2;
        const groupId = Date.now();
        const installAmt = parseFloat((amount / count).toFixed(2));

        await db.transaction('rw', db.transactions, async () => {
          for (let i = 0; i < count; i++) {
            const d = new Date(date);
            d.setMonth(d.getMonth() + i);
            const installDate = d.toISOString().split('T')[0];
            await db.transactions.add({
              ...base,
              amount: i === count-1 ? amount - installAmt*(count-1) : installAmt,
              date: installDate,
              groupId,
              installmentNum: i+1,
              installmentTotal: count,
              description: desc ? `${desc} (${i+1}/${count})` : `Parcela ${i+1}/${count}`,
            });
          }
        });
        showToast(`${count} parcelas criadas!`, 'success');
      } else {
        // Single
        const id = await db.transactions.add(base);
        await logTransaction(id, uid, 'create', base);

        // Check budget anomaly
        await checkBudgetAlert(uid, base);
      }

      App.modal.close('modalTransaction');
      if (App.state.currentPage === 'transactions') load();
      if (App.state.currentPage === 'dashboard') App.dashboard.load();
      EventBus.emit('transactionSaved');
    } catch (err) {
      showToast('Erro ao salvar: ' + err.message, 'error');
    }
  }

  /* ── Budget alert check ── */
  async function checkBudgetAlert(uid, tx) {
    if (tx.type !== 'expense' || !tx.categoryId) return;
    const month  = tx.date.slice(0,7);
    const budget = await db.budgets.where({ userId: uid, monthYear: month, categoryId: tx.categoryId }).first();
    if (!budget || !budget.limitAmount) return;

    const start = month + '-01';
    const end   = monthEnd(new Date(month + '-01'));
    const txs   = await db.transactions.where({ userId: uid, categoryId: tx.categoryId })
      .filter(t => t.date >= start && t.date <= end && t.type === 'expense').toArray();
    const spent = txs.reduce((s,t) => s + t.amount, 0);
    const p     = pct(spent, budget.limitAmount);

    const settings = App.state.settings;
    const cat = App.state.categoriesCache.find(c => c.id === tx.categoryId);
    const catName = cat?.name || 'categoria';

    if (p >= 100 && settings.notifBudget100) {
      const msg = `⚠️ Orçamento de "${catName}" estourado! (${fmtPct(p)})`;
      showToast(msg, 'error', 5000);
      await addNotification(uid, 'budget_100', msg, tx.categoryId);
      await App.ui.updateNotifBadge();
      if (settings.notifAutoVoice) {
        const useKokoro = localStorage.getItem('tts.useKokoro') === '1';
        await TTS.announce(msg, { useNative: !useKokoro });
      }
    } else if (p >= 80 && settings.notifBudget80) {
      const msg = `Orçamento de "${catName}" em ${fmtPct(p)}`;
      showToast(msg, 'warning', 4000);
      await addNotification(uid, 'budget_80', msg, tx.categoryId);
      await App.ui.updateNotifBadge();
      if (settings.notifAutoVoice) {
        const useKokoro = localStorage.getItem('tts.useKokoro') === '1';
        await TTS.announce(msg, { useNative: !useKokoro });
      }
    }
  }

  /* ── Delete ── */
  async function deleteOne(id) {
    App.modal.confirm('Excluir transação', 'Esta ação não pode ser desfeita.', async () => {
      const tx = await db.transactions.get(id);
      await logTransaction(id, App.state.currentUser.id, 'delete', tx);
      await db.transactions.delete(id);
      showToast('Transação removida', 'info');
      load();
      EventBus.emit('transactionSaved');
    });
  }

  /* ══════════════════════════════════════
     LIST / FILTERS
  ══════════════════════════════════════ */

  async function load(reset = true) {
    if (reset) { page = 0; selected.clear(); updateBulkActions(); }
    await populateFilterDropdowns();
    await applyFilters();
  }

  async function populateFilterDropdowns() {
    const uid  = App.state.currentUser.id;
    const cats = await db.categories.where('userId').equals(uid).toArray();
    const accs = await db.accounts.where('userId').equals(uid).toArray();
    App.state.categoriesCache = cats;
    App.state.accountsCache   = accs;

    const catSel = $id('txFilterCategory');
    catSel.innerHTML = '<option value="">Todas categorias</option>' +
      cats.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

    const accSel = $id('txFilterAccount');
    accSel.innerHTML = '<option value="">Todas contas</option>' +
      accs.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  }

  async function applyFilters() {
    const uid      = App.state.currentUser.id;
    const search   = ($id('txSearch')?.value || '').toLowerCase();
    const start    = $id('txFilterStart')?.value;
    const end      = $id('txFilterEnd')?.value;
    const type     = $id('txFilterType')?.value;
    const catId    = parseInt($id('txFilterCategory')?.value) || 0;
    const accId    = parseInt($id('txFilterAccount')?.value) || 0;
    const sort     = $id('txSort')?.value || 'date-desc';

    let txs = await db.transactions.where('userId').equals(uid).toArray();

    if (start)  txs = txs.filter(t => t.date >= start);
    if (end)    txs = txs.filter(t => t.date <= end);
    if (type)   txs = txs.filter(t => t.type === type);
    if (catId)  txs = txs.filter(t => t.categoryId === catId);
    if (accId)  txs = txs.filter(t => t.accountId === accId);
    if (search) txs = txs.filter(t => (t.description || '').toLowerCase().includes(search));

    // Sort
    txs.sort((a,b) => {
      if (sort === 'date-desc')   return b.date.localeCompare(a.date) || b.id - a.id;
      if (sort === 'date-asc')    return a.date.localeCompare(b.date) || a.id - b.id;
      if (sort === 'amount-desc') return b.amount - a.amount;
      if (sort === 'amount-asc')  return a.amount - b.amount;
      if (sort === 'desc-asc')    return (a.description||'').localeCompare(b.description||'');
      return 0;
    });

    filtered = txs;

    const totalIncome  = txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const totalExpense = txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const cur = App.state.settings?.currency;
    $id('txSummaryLabel').textContent =
      `${txs.length} transações • Receitas: ${formatCurrency(totalIncome, cur)} • Despesas: ${formatCurrency(totalExpense, cur)}`;

    renderTable(true);
  }

  function clearFilters() {
    ['txSearch','txFilterStart','txFilterEnd'].forEach(id => { const el=$id(id); if(el) el.value=''; });
    ['txFilterType','txFilterCategory','txFilterAccount'].forEach(id => { const el=$id(id); if(el) el.value=''; });
    applyFilters();
  }

  function renderTable(reset = false) {
    if (reset) page = 0;
    const slice = filtered.slice(0, (page+1)*PAGE_SIZE);
    const cats  = App.state.categoriesCache;
    const catMap = Object.fromEntries(cats.map(c=>[c.id,c]));
    const accs  = App.state.accountsCache;
    const accMap = Object.fromEntries(accs.map(a=>[a.id,a]));
    const cur   = App.state.settings?.currency;

    const tbody = $id('txTableBody');
    if (!tbody) return;

    if (!slice.length) {
      tbody.innerHTML = `<tr><td colspan="7">
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-receipt"></i></div>
          <p class="empty-title">Nenhuma transação</p>
          <p class="empty-text">Tente ajustar os filtros ou adicione uma nova transação.</p>
        </div>
      </td></tr>`;
      $id('txCountLabel').textContent = '0 transações';
      $id('txLoadMore').style.display = 'none';
      return;
    }

    tbody.innerHTML = slice.map(t => {
      const cat   = catMap[t.categoryId] || {};
      const acc   = accMap[t.accountId]  || {};
      const sign  = t.type === 'income' ? '+' : t.type === 'transfer' ? '⇄' : '−';
      const amtCls = `tx-amount tx-amount--${t.type}`;
      const isChecked = selected.has(t.id);
      return `
        <tr>
          <td class="col-check"><input type="checkbox" ${isChecked?'checked':''} onchange="App.transactions.toggleSelect(${t.id}, this.checked)" /></td>
          <td style="white-space:nowrap">${formatDate(t.date)}</td>
          <td>
            <div style="font-weight:var(--fw-medium);font-size:var(--text-sm)">${escapeHtml(t.description || '—')}</div>
            <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:2px">
              ${(t.tags||[]).map(tag=>`<span class="tag-chip">${escapeHtml(tag)}</span>`).join('')}
              ${t.isRecurring ? '<i class="fas fa-repeat recurring-icon" title="Recorrente"></i>' : ''}
              ${t.installmentNum ? `<span class="installment-badge">${t.installmentNum}/${t.installmentTotal}</span>` : ''}
            </div>
          </td>
          <td>
            ${cat.name ? `<span class="cat-pill"><i class="fas ${cat.icon||'fa-tag'}" style="color:${cat.color}"></i> ${escapeHtml(cat.name)}</span>` : '—'}
          </td>
          <td style="font-size:var(--text-sm)">${escapeHtml(acc.name || '—')}</td>
          <td><span class="${amtCls}">${sign} ${formatCurrency(t.amount, cur)}</span></td>
          <td>
            <div class="row-actions">
              <button class="row-btn" onclick="App.transactions.editModal(${t.id})" title="Editar"><i class="fas fa-pen"></i></button>
              <button class="row-btn row-btn--danger" onclick="App.transactions.deleteOne(${t.id})" title="Excluir"><i class="fas fa-trash"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    $id('txCountLabel').textContent = `${filtered.length} transações encontradas`;
    $id('txLoadMore').style.display = slice.length < filtered.length ? 'inline-flex' : 'none';
  }

  function loadMore() {
    page++;
    renderTable(false);
  }

  /* ── Select / Bulk ── */
  function toggleSelect(id, checked) {
    if (checked) selected.add(id);
    else selected.delete(id);
    updateBulkActions();
  }

  function toggleSelectAll() {
    const all = $id('txSelectAll').checked;
    const slice = filtered.slice(0, (page+1)*PAGE_SIZE);
    slice.forEach(t => all ? selected.add(t.id) : selected.delete(t.id));
    renderTable(false);
    updateBulkActions();
  }

  function updateBulkActions() {
    const el = $id('txBulkActions');
    el.classList.toggle('hidden', selected.size === 0);
    $id('txSelectedCount').textContent = `${selected.size} selecionada(s)`;
  }

  function bulkDelete() {
    if (!selected.size) return;
    App.modal.confirm(
      'Excluir transações',
      `Deseja excluir ${selected.size} transação(ões)? Esta ação não pode ser desfeita.`,
      async () => {
        await db.transactions.bulkDelete([...selected]);
        selected.clear();
        showToast(`${selected.size || 'Transações'} removida(s)`, 'info');
        load();
        EventBus.emit('transactionSaved');
      }
    );
  }

  async function bulkExport() {
    const txs = await db.transactions.where('id').anyOf([...selected]).toArray();
    exportToCSV(txs);
  }

  /* ── Import ── */
  function openImport() {
    showToast('Para importar, use a opção de backup em Configurações → Importar.', 'info');
  }

  /* ── CSV Export ── */
  async function exportAll() {
    const uid = App.state.currentUser.id;
    const txs = await db.transactions.where('userId').equals(uid).toArray();
    exportToCSV(txs);
  }

  function exportToCSV(txs) {
    const cats  = App.state.categoriesCache;
    const catMap = Object.fromEntries(cats.map(c=>[c.id,c]));
    const accs   = App.state.accountsCache;
    const accMap = Object.fromEntries(accs.map(a=>[a.id,a]));

    const rows = [['Data','Tipo','Categoria','Conta','Valor','Descrição','Tags']];
    txs.forEach(t => rows.push([
      t.date,
      t.type === 'income' ? 'Receita' : t.type === 'transfer' ? 'Transferência' : 'Despesa',
      catMap[t.categoryId]?.name || '',
      accMap[t.accountId]?.name  || '',
      t.amount.toFixed(2).replace('.',','),
      t.description || '',
      (t.tags||[]).join(';'),
    ]));

    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
    downloadFile('transacoes.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8');
    showToast('CSV exportado!', 'success');
  }

  return {
    load, openModal, editModal, save, deleteOne,
    setType, toggleRecurring, toggleInstallment,
    applyFilters, clearFilters, debounceFilter,
    loadMore, toggleSelect, toggleSelectAll, bulkDelete, bulkExport,
    openImport, exportAll,
  };
})();
