/**
 * @fileoverview FinancePro — categories.js
 */
'use strict';

App.categories = (() => {

  const ICONS = [
    'fa-utensils','fa-car','fa-home','fa-heartbeat','fa-graduation-cap',
    'fa-gamepad','fa-shopping-bag','fa-credit-card','fa-tag','fa-briefcase',
    'fa-laptop-code','fa-chart-line','fa-store','fa-undo','fa-plus-circle',
    'fa-bus','fa-plane','fa-coffee','fa-dumbbell','fa-music',
    'fa-book','fa-baby','fa-dog','fa-tools','fa-gift',
    'fa-film','fa-mobile-alt','fa-wifi','fa-bolt','fa-water',
    'fa-fire','fa-seedling','fa-bicycle','fa-cocktail','fa-pizza-slice',
    'fa-stethoscope','fa-pills','fa-tooth','fa-glasses','fa-shirt',
  ];

  let selectedIcon = 'fa-tag';

  async function load() {
    const uid  = App.state.currentUser.id;
    const cats = await db.categories.where('userId').equals(uid).orderBy('order').toArray();
    App.state.categoriesCache = cats;

    const expenses = cats.filter(c => c.type === 'expense');
    const incomes  = cats.filter(c => c.type === 'income');

    renderList('catExpenseList', expenses);
    renderList('catIncomeList',  incomes);
  }

  async function renderList(containerId, cats) {
    const uid = App.state.currentUser.id;
    const el  = $id(containerId);

    if (!cats.length) {
      el.innerHTML = '<div class="empty-state" style="padding:var(--space-6)"><div class="empty-icon"><i class="fas fa-tags"></i></div><p class="empty-text">Nenhuma categoria ainda.</p></div>';
      return;
    }

    // Aggregate transaction count and total amount per category
    const totalsByCat = allTxs.reduce((acc, t) => {
      if (!t.categoryId) return acc;
      const key = t.categoryId;
      const current = acc[key] || { count: 0, total: 0 };
      current.count += 1;
      current.total += Math.abs(Number(t.amount) || 0);
      acc[key] = current;
      return acc;
    }, {});

    el.innerHTML = cats.map(c => {
      const stats = totalsByCat[c.id] || { count: 0, total: 0 };
      const formattedTotal = stats.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `
        <div class="cat-item">
          <div class="cat-item-left">
            <div class="cat-icon-wrapper" style="background:${c.color}">
              <i class="fas ${c.icon || 'fa-tag'}"></i>
            </div>
            <div>
              <div class="cat-name">${escapeHtml(c.name)}</div>
              <div class="cat-meta">${stats.count} transação(ões) • Total: R$ ${formattedTotal} ${c.isDefault ? '• Padrão' : ''}</div>
            </div>
          </div>
          <div class="cat-actions">
            <button class="row-btn" onclick="App.categories.openModal(${c.id})" title="Editar">
              <i class="fas fa-pen"></i>
            </button>
            <button class="row-btn row-btn--danger" onclick="App.categories.deleteOne(${c.id}, ${stats.count})" title="Excluir">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  async function openModal(editId = null) {
    selectedIcon = 'fa-tag';
    let cat = null;
    if (editId) {
      cat = await db.categories.get(editId);
      selectedIcon = cat?.icon || 'fa-tag';
    }

    $id('catModalTitle').textContent = cat ? 'Editar Categoria' : 'Nova Categoria';
    $id('catEditId').value  = cat ? cat.id : '';
    $id('catName').value    = cat ? cat.name : '';
    $id('catType').value    = cat ? cat.type : 'expense';
    $id('catColor').value   = cat ? cat.color : '#10b981';

    // Render icon picker
    const picker = $id('iconPicker');
    picker.innerHTML = ICONS.map(icon => `
      <button type="button" class="icon-option ${icon === selectedIcon ? 'selected' : ''}"
              data-icon="${icon}" onclick="App.categories.selectIcon('${icon}')"
              title="${icon}">
        <i class="fas ${icon}"></i>
      </button>
    `).join('');

    App.modal.open('modalCategory');
  }

  function selectIcon(icon) {
    selectedIcon = icon;
    document.querySelectorAll('.icon-option').forEach(el => {
      el.classList.toggle('selected', el.dataset.icon === icon);
    });
  }

  async function save() {
    const uid   = App.state.currentUser.id;
    const editId= $id('catEditId').value;
    const name  = $id('catName').value.trim();
    const type  = $id('catType').value;
    const color = $id('catColor').value;

    if (!name) return showToast('Informe o nome da categoria.', 'error');

    const data = { userId: uid, name, type, icon: selectedIcon, color, isDefault: false };

    if (editId) {
      await db.categories.update(parseInt(editId), data);
      showToast('Categoria atualizada!', 'success');
    } else {
      const maxOrder = await db.categories.where('userId').equals(uid).count();
      await db.categories.add({ ...data, order: maxOrder + 1 });
      showToast('Categoria criada!', 'success');
    }

    App.state.categoriesCache = await db.categories.where('userId').equals(uid).toArray();
    App.modal.close('modalCategory');
    load();
  }

  async function deleteOne(id, txCount) {
    const msg = txCount > 0
      ? `Esta categoria possui ${txCount} transação(ões). Excluir mesmo assim?`
      : 'Deseja excluir esta categoria?';
    App.modal.confirm('Excluir categoria', msg, async () => {
      await db.categories.delete(id);
      App.state.categoriesCache = await db.categories.where('userId').equals(App.state.currentUser.id).toArray();
      showToast('Categoria removida', 'info');
      load();
    });
  }

  return { load, openModal, selectIcon, save, deleteOne };
})();


/* ═══════════════════════════════════════════════════════════
   ACCOUNTS  (App.accounts)
═══════════════════════════════════════════════════════════ */
App.accounts = (() => {

  const TYPE_LABELS = {
    checking:'Conta Corrente', savings:'Poupança',
    wallet:'Carteira', credit:'Cartão de Crédito', investment:'Investimentos'
  };
  const TYPE_ICONS = {
    checking:'fa-university', savings:'fa-piggy-bank',
    wallet:'fa-wallet', credit:'fa-credit-card', investment:'fa-chart-line'
  };

  async function load() {
    const uid  = App.state.currentUser.id;
    const accs = await db.accounts.where('userId').equals(uid).toArray();
    App.state.accountsCache = accs;

    const txs = await db.transactions.where('userId').equals(uid).toArray();

    const grid = $id('accountsGrid');
    if (!accs.length) {
      grid.innerHTML = `<div class="empty-state">
        <div class="empty-icon"><i class="fas fa-wallet"></i></div>
        <p class="empty-title">Nenhuma conta</p>
        <button class="btn btn-primary" onclick="App.accounts.openModal()">
          <i class="fas fa-plus"></i> Adicionar conta
        </button>
      </div>`;
      return;
    }

    grid.innerHTML = accs.map(a => {
      const income   = txs.filter(t => t.accountId === a.id && t.type === 'income').reduce((s,t)=>s+t.amount,0);
      const expense  = txs.filter(t => t.accountId === a.id && t.type === 'expense').reduce((s,t)=>s+t.amount,0);
      const transIn  = txs.filter(t => t.accountToId === a.id && t.type === 'transfer').reduce((s,t)=>s+t.amount,0);
      const transOut = txs.filter(t => t.accountId === a.id && t.type === 'transfer').reduce((s,t)=>s+t.amount,0);
      const balance  = (a.initialBalance||0) + income - expense + transIn - transOut;
      const cur      = App.state.settings?.currency;

      return `
        <div class="account-card" style="--acc-color:${a.color}">
          <div class="account-card-type">
            <i class="fas ${TYPE_ICONS[a.type]||'fa-wallet'}"></i> ${TYPE_LABELS[a.type]||a.type}
          </div>
          <div class="account-card-name">${escapeHtml(a.name)}</div>
          <div class="account-card-balance">${formatCurrency(balance, cur)}</div>
          <div class="account-card-actions">
            <button class="btn btn-outline btn-sm" onclick="App.accounts.openModal(${a.id})">
              <i class="fas fa-pen"></i> Editar
            </button>
            <button class="btn btn-ghost btn-sm" onclick="App.accounts.deleteOne(${a.id})">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Transfers
    const transfers = txs.filter(t=>t.type==='transfer').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
    const accMap = Object.fromEntries(accs.map(a=>[a.id,a]));
    const tList  = $id('transfersList');
    tList.innerHTML = transfers.length ? transfers.map(t => `
      <div class="transfer-row">
        <div>
          <div class="transfer-from">${escapeHtml(accMap[t.accountId]?.name||'?')}</div>
          <div class="transfer-date">${formatDate(t.date)}</div>
        </div>
        <i class="fas fa-arrow-right transfer-arrow"></i>
        <div class="transfer-to">${escapeHtml(accMap[t.accountToId]?.name||'?')}</div>
        <div class="transfer-amount">${formatCurrency(t.amount, App.state.settings?.currency)}</div>
      </div>
    `).join('') : '<div class="empty-state" style="padding:var(--space-6)"><p class="empty-text">Nenhuma transferência registrada.</p></div>';
  }

  async function openModal(editId = null) {
    let acc = null;
    if (editId) acc = await db.accounts.get(editId);
    $id('accModalTitle').textContent = acc ? 'Editar Conta' : 'Nova Conta';
    $id('accEditId').value    = acc ? acc.id : '';
    $id('accName').value      = acc ? acc.name : '';
    $id('accType').value      = acc ? acc.type : 'checking';
    $id('accColor').value     = acc ? acc.color : '#10b981';
    $id('accBalance').value   = acc ? acc.initialBalance : 0;
    App.modal.open('modalAccount');
  }

  async function save() {
    const uid    = App.state.currentUser.id;
    const editId = $id('accEditId').value;
    const name   = $id('accName').value.trim();
    if (!name) return showToast('Informe o nome da conta.', 'error');
    const data = {
      userId: uid, name,
      type: $id('accType').value,
      color: $id('accColor').value,
      initialBalance: parseFloat($id('accBalance').value)||0,
    };
    if (editId) {
      await db.accounts.update(parseInt(editId), data);
      showToast('Conta atualizada!', 'success');
    } else {
      await db.accounts.add({ ...data, createdAt: new Date().toISOString() });
      showToast('Conta criada!', 'success');
    }
    App.state.accountsCache = await db.accounts.where('userId').equals(uid).toArray();
    App.modal.close('modalAccount');
    load();
  }

  async function deleteOne(id) {
    App.modal.confirm('Excluir conta', 'Isso não apaga as transações associadas.', async () => {
      await db.accounts.delete(id);
      App.state.accountsCache = await db.accounts.where('userId').equals(App.state.currentUser.id).toArray();
      showToast('Conta removida', 'info');
      load();
    });
  }

  function openTransfer() { App.transactions.openModal(); App.transactions.setType('transfer'); }

  return { load, openModal, save, deleteOne, openTransfer };
})();


/* ═══════════════════════════════════════════════════════════
   BUDGETS  (App.budgets)
═══════════════════════════════════════════════════════════ */
App.budgets = (() => {

  async function load() {
    const uid   = App.state.currentUser.id;
    const month = $id('budgetMonthPicker')?.value || toMonthKey();
    const start = month + '-01';
    const end   = monthEnd(new Date(month + '-01'));
    const cur   = App.state.settings?.currency;

    const cats    = await db.categories.where({ userId: uid, type: 'expense' }).toArray();
    const budgets = await db.budgets.where({ userId: uid, monthYear: month }).toArray();
    const txs     = await db.transactions.where('userId').equals(uid)
      .filter(t => t.date >= start && t.date <= end && t.type === 'expense').toArray();

    const totalBudget = budgets.find(b => !b.categoryId);
    const totalSpent  = txs.reduce((s,t) => s+t.amount, 0);
    const totalLimit  = totalBudget?.limitAmount || 0;
    const totalPct    = pct(totalSpent, totalLimit);

    // Total card
    const fillClass = totalPct >= 100 ? 'danger' : totalPct >= 80 ? 'warning' : 'success';
    $id('budgetTotalCard').innerHTML = totalLimit ? `
      <div class="budget-total-info">
        <div class="budget-total-label">Orçamento Total do Mês</div>
        <div class="budget-total-values">
          <span class="budget-total-spent big-number big-number--${fillClass}">${formatCurrency(totalSpent, cur)}</span>
          <span class="budget-total-limit">de ${formatCurrency(totalLimit, cur)}</span>
        </div>
        <div class="progress budget-total-progress">
          <div class="progress-fill progress-fill--${fillClass}" style="width:${Math.min(totalPct,100)}%"></div>
        </div>
        <div style="margin-top:6px;font-size:var(--text-xs);color:var(--text-secondary)">${fmtPct(totalPct)} utilizado</div>
      </div>
      <div>
        <label class="form-label">Limite total (R$)</label>
        <input type="number" class="budget-input-inline" style="width:140px" step="0.01"
               value="${totalLimit||''}" placeholder="Sem limite"
               onchange="App.budgets.setTotal(this.value, '${month}')" />
      </div>
    ` : `
      <div style="display:flex;align-items:center;gap:var(--space-5);flex-wrap:wrap">
        <div>
          <div class="budget-total-label">Orçamento Total do Mês</div>
          <div style="color:var(--text-secondary);font-size:var(--text-sm);margin-top:4px">Gasto até agora: <strong>${formatCurrency(totalSpent, cur)}</strong></div>
        </div>
        <div>
          <label class="form-label">Definir limite total (R$)</label>
          <input type="number" class="budget-input-inline" style="width:160px" step="0.01"
                 placeholder="Sem limite"
                 onchange="App.budgets.setTotal(this.value, '${month}')" />
        </div>
      </div>
    `;

    // Per-category grid
    const grid = $id('budgetsGrid');
    grid.innerHTML = cats.map(c => {
      const budget = budgets.find(b => b.categoryId === c.id);
      const limit  = budget?.limitAmount || 0;
      const spent  = txs.filter(t => t.categoryId === c.id).reduce((s,t) => s+t.amount, 0);
      const p      = limit > 0 ? pct(spent, limit) : 0;
      const cls    = p >= 100 ? 'danger' : p >= 80 ? 'warning' : 'success';

      return `
        <div class="budget-item">
          <div class="budget-item-header">
            <div class="budget-item-cat">
              <div style="width:36px;height:36px;border-radius:10px;background:${c.color};display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px">
                <i class="fas ${c.icon||'fa-tag'}"></i>
              </div>
              <span style="font-weight:var(--fw-semi);font-size:var(--text-sm)">${escapeHtml(c.name)}</span>
            </div>
            <div class="budget-item-values">
              <div class="budget-item-spent ${p > 0 ? `text-${cls}` : ''}">${formatCurrency(spent, cur)}</div>
              <div class="budget-item-limit">${limit > 0 ? `de ${formatCurrency(limit, cur)}` : 'Sem limite'}</div>
            </div>
          </div>
          ${limit > 0 ? `
          <div class="progress" style="margin-bottom:4px">
            <div class="progress-fill progress-fill--${cls}" style="width:${Math.min(p,100)}%"></div>
          </div>
          <div class="budget-pct text-${cls}">${fmtPct(p)}</div>` : ''}
          <div class="budget-item-input">
            <input type="number" class="budget-input-inline" step="0.01"
                   value="${limit||''}" placeholder="Definir limite..."
                   onchange="App.budgets.setCategoryBudget(${c.id}, this.value, '${month}')" />
          </div>
        </div>
      `;
    }).join('');
  }

  async function setTotal(value, monthYear) {
    const uid = App.state.currentUser.id;
    await upsertBudget(uid, monthYear, null, parseFloat(value)||0);
    showToast('Orçamento total atualizado!', 'success');
    load();
  }

  async function setCategoryBudget(categoryId, value, monthYear) {
    const uid = App.state.currentUser.id;
    await upsertBudget(uid, monthYear, categoryId, parseFloat(value)||0);
    showToast('Orçamento atualizado!', 'success');
    load();
  }

  async function upsertBudget(userId, monthYear, categoryId, limitAmount) {
    const existing = await db.budgets
      .where({ userId, monthYear })
      .filter(b => b.categoryId === categoryId)
      .first();
    if (existing) {
      await db.budgets.update(existing.id, { limitAmount });
    } else {
      await db.budgets.add({ userId, monthYear, categoryId, limitAmount });
    }
  }

  async function copyFromPrevious() {
    const uid   = App.state.currentUser.id;
    const month = $id('budgetMonthPicker')?.value || toMonthKey();
    const [y,m] = month.split('-').map(Number);
    const prev  = new Date(y, m-2, 1);
    const prevKey = toMonthKey(prev);

    const prevBudgets = await db.budgets.where({ userId: uid, monthYear: prevKey }).toArray();
    if (!prevBudgets.length) return showToast('Nenhum orçamento no mês anterior.', 'warning');

    await db.transaction('rw', db.budgets, async () => {
      for (const b of prevBudgets) {
        const exists = await db.budgets.where({ userId: uid, monthYear: month })
          .filter(x => x.categoryId === b.categoryId).first();
        if (!exists) {
          await db.budgets.add({ userId: uid, monthYear: month, categoryId: b.categoryId, limitAmount: b.limitAmount });
        }
      }
    });

    showToast('Orçamentos copiados!', 'success');
    load();
  }

  return { load, setTotal, setCategoryBudget, copyFromPrevious };
})();


/* ═══════════════════════════════════════════════════════════
   GOALS  (App.goals)
═══════════════════════════════════════════════════════════ */
App.goals = (() => {

  async function load() {
    const uid   = App.state.currentUser.id;
    const goals = await db.goals.where('userId').equals(uid).toArray();
    const cur   = App.state.settings?.currency;
    const grid  = $id('goalsGrid');

    if (!goals.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon"><i class="fas fa-star"></i></div>
        <p class="empty-title">Nenhuma meta ainda</p>
        <p class="empty-text">Defina objetivos financeiros e acompanhe seu progresso.</p>
        <button class="btn btn-primary" onclick="App.goals.openModal()">
          <i class="fas fa-plus"></i> Criar primeira meta
        </button>
      </div>`;
      return;
    }

    grid.innerHTML = goals.map(g => {
      const p         = pct(g.currentAmount||0, g.targetAmount);
      const remaining = g.targetAmount - (g.currentAmount||0);
      const cls       = p >= 100 ? 'success' : p >= 50 ? 'info' : 'warning';
      const deadline  = g.deadline ? formatDate(g.deadline) : '—';
      const daysLeft  = g.deadline ? Math.ceil((new Date(g.deadline)-new Date())/86400000) : null;

      return `
        <div class="goal-card">
          <div class="goal-card-header">
            <div class="goal-icon"><i class="fas ${g.icon||'fa-star'}"></i></div>
            <div class="row-actions" style="opacity:1">
              <button class="row-btn" onclick="App.goals.openModal(${g.id})"><i class="fas fa-pen"></i></button>
              <button class="row-btn row-btn--danger" onclick="App.goals.deleteOne(${g.id})"><i class="fas fa-trash"></i></button>
            </div>
          </div>
          <div class="goal-name">${escapeHtml(g.name)}</div>
          <div class="goal-deadline">Meta: ${deadline}${daysLeft !== null ? ` • ${daysLeft > 0 ? daysLeft + ' dias restantes' : 'Prazo encerrado'}` : ''}</div>
          <div class="goal-amounts">
            <span class="goal-current">${formatCurrency(g.currentAmount||0, cur)}</span>
            <span class="goal-target">de ${formatCurrency(g.targetAmount, cur)}</span>
          </div>
          <div class="progress">
            <div class="progress-fill progress-fill--${cls}" style="width:${Math.min(p,100)}%"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:var(--text-xs);color:var(--text-secondary)">
            <span>${fmtPct(p)} concluído</span>
            <span>Faltam ${formatCurrency(Math.max(0,remaining), cur)}</span>
          </div>
          <div class="goal-eta">
            ${p < 100 ? '<i class="fas fa-lightbulb"></i> Adicione aportes para atingir sua meta mais rápido.' : '<i class="fas fa-check-circle" style="color:var(--color-success)"></i> Meta atingida! 🎉'}
          </div>
          <button class="goal-add-btn" onclick="App.goals.addFunds(${g.id}, ${g.currentAmount||0}, ${g.targetAmount})">
            <i class="fas fa-plus"></i> Adicionar aporte
          </button>
        </div>
      `;
    }).join('');
  }

  async function openModal(editId = null) {
    let g = null;
    if (editId) g = await db.goals.get(editId);
    $id('goalModalTitle').textContent = g ? 'Editar Meta' : 'Nova Meta';
    $id('goalEditId').value    = g ? g.id : '';
    $id('goalName').value      = g ? g.name : '';
    $id('goalTarget').value    = g ? g.targetAmount : '';
    $id('goalCurrent').value   = g ? (g.currentAmount||0) : 0;
    $id('goalDeadline').value  = g ? (g.deadline||'') : '';
    $id('goalIcon').value      = g ? (g.icon||'fa-star') : 'fa-star';
    App.modal.open('modalGoal');
  }

  async function save() {
    const uid    = App.state.currentUser.id;
    const editId = $id('goalEditId').value;
    const name   = $id('goalName').value.trim();
    const target = parseFloat($id('goalTarget').value);
    if (!name)              return showToast('Informe o nome da meta.', 'error');
    if (!target || target <= 0) return showToast('Informe um valor alvo válido.', 'error');

    const data = {
      userId: uid, name, targetAmount: target,
      currentAmount: parseFloat($id('goalCurrent').value)||0,
      deadline: $id('goalDeadline').value || null,
      icon: $id('goalIcon').value || 'fa-star',
    };

    if (editId) {
      await db.goals.update(parseInt(editId), data);
      showToast('Meta atualizada!', 'success');
    } else {
      await db.goals.add({ ...data, createdAt: new Date().toISOString() });
      showToast('Meta criada!', 'success');
    }
    App.modal.close('modalGoal');
    load();
  }

  async function addFunds(id, current, target) {
    const amount = parseFloat(prompt(`Aporte para a meta (máx. ${formatCurrency(target - current)})`));
    if (!amount || isNaN(amount) || amount <= 0) return;
    const newVal = Math.min(current + amount, target);
    await db.goals.update(id, { currentAmount: newVal });
    showToast('Aporte registrado!', 'success');
    if (newVal >= target) showToast('🎉 Meta atingida! Parabéns!', 'success', 5000);
    load();
  }

  async function deleteOne(id) {
    App.modal.confirm('Excluir meta', 'Deseja excluir esta meta?', async () => {
      await db.goals.delete(id);
      showToast('Meta removida', 'info');
      load();
    });
  }

  return { load, openModal, save, addFunds, deleteOne };
})();


/* ═══════════════════════════════════════════════════════════
   REPORTS  (App.reports)
═══════════════════════════════════════════════════════════ */
App.reports = (() => {

  let chart1=null, chart2=null, chart3=null;

  async function load() {
    const uid    = App.state.currentUser.id;
    const days   = parseInt($id('reportPeriod')?.value || '90');
    const start  = (() => { const d=new Date(); d.setDate(d.getDate()-days); return d.toISOString().split('T')[0]; })();
    const end    = today();

    const txs = await db.transactions.where('userId').equals(uid)
      .filter(t => t.date >= start && t.date <= end).toArray();

    const cats   = App.state.categoriesCache;
    const catMap = Object.fromEntries(cats.map(c=>[c.id,c]));
    const cur    = App.state.settings?.currency;
    const textColor  = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
    const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();

    const commonScales = {
      x: { grid:{color:borderColor}, ticks:{color:textColor, font:{family:'DM Sans'}} },
      y: { grid:{color:borderColor}, ticks:{color:textColor, font:{family:'DM Sans'}, callback: v => formatCurrency(v,cur).replace(/\s/g,'\u00A0')} }
    };

    // Chart 1: Monthly income vs expense
    const months = [...new Set(txs.map(t=>t.date.slice(0,7)))].sort();
    const incomes  = months.map(m => txs.filter(t=>t.date.startsWith(m)&&t.type==='income').reduce((s,t)=>s+t.amount,0));
    const expenses = months.map(m => txs.filter(t=>t.date.startsWith(m)&&t.type==='expense').reduce((s,t)=>s+t.amount,0));

    const ctx1 = $id('reportChart1')?.getContext('2d');
    if (ctx1) {
      if(chart1) chart1.destroy();
      chart1 = new Chart(ctx1, {
        type:'bar',
        data:{
          labels:months.map(m=>{ const[y,mo]=m.split('-'); return new Date(y,mo-1,1).toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}); }),
          datasets:[
            {label:'Receitas',data:incomes,backgroundColor:'rgba(16,185,129,0.7)',borderRadius:6},
            {label:'Despesas',data:expenses,backgroundColor:'rgba(239,68,68,0.7)',borderRadius:6},
          ]
        },
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:textColor,font:{family:'DM Sans'},boxWidth:12}}},scales:commonScales}
      });
    }

    // Chart 2: Expense by category (doughnut)
    const byCat = {};
    txs.filter(t=>t.type==='expense').forEach(t => {
      const name = catMap[t.categoryId]?.name || 'Outros';
      byCat[name] = (byCat[name]||0)+t.amount;
    });
    const ctx2 = $id('reportChart2')?.getContext('2d');
    if (ctx2 && Object.keys(byCat).length) {
      if(chart2) chart2.destroy();
      const labels = Object.keys(byCat);
      const colors = labels.map(l => { const c=cats.find(c=>c.name===l); return c?.color||chartColor(labels.indexOf(l)); });
      chart2 = new Chart(ctx2, {
        type:'doughnut',
        data:{labels,datasets:[{data:Object.values(byCat),backgroundColor:colors,borderWidth:2,borderColor:'var(--surface)',hoverOffset:8}]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:textColor,font:{family:'DM Sans'},boxWidth:12}}},cutout:'60%'}
      });
    }

    // Chart 3: Top 8 categories horizontal bar
    const top8 = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const ctx3 = $id('reportChart3')?.getContext('2d');
    if (ctx3 && top8.length) {
      if(chart3) chart3.destroy();
      const l8 = top8.map(([n])=>n);
      const colors3 = l8.map(l => { const c=cats.find(c=>c.name===l); return c?.color||'#10b981'; });
      chart3 = new Chart(ctx3, {
        type:'bar',
        data:{labels:l8,datasets:[{label:'Total Gasto',data:top8.map(([,v])=>v),backgroundColor:colors3,borderRadius:6}]},
        options:{
          indexAxis:'y',responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:false}},
          scales:{
            x:{grid:{color:borderColor},ticks:{color:textColor,font:{family:'DM Sans'},callback:v=>formatCurrency(v,cur).replace(/\s/g,'\u00A0')}},
            y:{grid:{color:borderColor},ticks:{color:textColor,font:{family:'DM Sans'}}}
          }
        }
      });
    }

    // Heatmap
    renderHeatmap(txs, start, end);
  }

  function renderHeatmap(txs, start, end) {
    const el = $id('heatmapContainer');
    if (!el) return;
    const dayMap = {};
    txs.filter(t=>t.type==='expense').forEach(t => {
      dayMap[t.date] = (dayMap[t.date]||0)+t.amount;
    });
    const max = Math.max(...Object.values(dayMap), 1);

    const days = [];
    const s = new Date(start); const e = new Date(end);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate()+1)) {
      days.push(d.toISOString().split('T')[0]);
    }

    el.innerHTML = `<div class="heatmap-grid">` +
      days.map(d => {
        const v = dayMap[d]||0;
        let lvl = 0;
        if (v > 0) lvl = v/max > 0.75 ? 4 : v/max > 0.5 ? 3 : v/max > 0.25 ? 2 : 1;
        return `<div class="heatmap-day heatmap-day--l${lvl}" title="${d}: ${formatCurrency(v)}"></div>`;
      }).join('') + `</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:var(--text-xs);color:var(--text-secondary)">
        Menos <div class="heatmap-day"></div><div class="heatmap-day heatmap-day--l1"></div>
        <div class="heatmap-day heatmap-day--l2"></div><div class="heatmap-day heatmap-day--l3"></div>
        <div class="heatmap-day heatmap-day--l4"></div> Mais
      </div>`;
  }

  async function exportCSV() {
    App.transactions.exportAll();
  }

  async function exportPDF() {
    showToast('Gerando PDF...', 'info');
    try {
      const { jsPDF } = window.jspdf;
      const doc  = new jsPDF({ format: 'a4' });
      const uid  = App.state.currentUser.id;
      const user = App.state.currentUser;
      const cur  = App.state.settings?.currency;

      doc.setFont('helvetica','bold');
      doc.setFontSize(22);
      doc.setTextColor(16,185,129);
      doc.text('FinancePro', 14, 20);

      doc.setFont('helvetica','normal');
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(`Relatório de ${user.name}`, 14, 30);
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 14, 37);

      const txs = await db.transactions.where('userId').equals(uid).toArray();
      const income  = txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
      const expense = txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

      doc.setFontSize(14); doc.setTextColor(0);
      doc.text('Resumo Geral', 14, 55);
      doc.setFontSize(11); doc.setTextColor(80);
      doc.text(`Total de Receitas: ${formatCurrency(income,cur)}`, 14, 65);
      doc.text(`Total de Despesas: ${formatCurrency(expense,cur)}`, 14, 72);
      doc.text(`Saldo: ${formatCurrency(income-expense,cur)}`, 14, 79);
      doc.text(`Transações registradas: ${txs.length}`, 14, 86);

      doc.save(`financepro-relatorio-${toMonthKey()}.pdf`);
      showToast('PDF gerado!', 'success');
    } catch(e) {
      showToast('Erro ao gerar PDF: ' + e.message, 'error');
    }
  }

  function exportChart(canvasId) {
    const canvas = $id(canvasId);
    if (!canvas) return;
    canvas.toBlob(blob => {
      downloadFile(`grafico-${canvasId}.png`, blob, 'image/png');
      showToast('Gráfico exportado!', 'success');
    });
  }

  return { load, exportCSV, exportPDF, exportChart };
})();


/* ═══════════════════════════════════════════════════════════
   SETTINGS  (App.settings)
═══════════════════════════════════════════════════════════ */
App.settings = (() => {

  async function load() {
    const uid = App.state.currentUser.id;
    const s   = App.state.settings;
    const user = await db.users.get(uid);

    // Compatibilidade com ambos IDs: novo (index.html) e legado (modules.js)
    $id('settingName').value          = user?.name  || '';
    $id('settingEmail').value         = user?.email || '';
    $id('settingCurrency').value      = s.currency   || 'BRL';
    $id('settingDateFmt').value       = s.dateFormat || 'dd/MM/yyyy';
    $id('settingDateFormat').value    = s.dateFormat || 'dd/MM/yyyy';
    $id('settingLanguage').value      = s.language   || 'pt';

    // Tentativas com ambos os IDs (novo + legado)
    const nb80 = $id('notifBudget80') || $id('notifB80');
    if (nb80) nb80.checked = s.notifBudget80 ?? s.notifB80 ?? true;
    
    const nb100 = $id('notifBudget100') || $id('notifB100');
    if (nb100) nb100.checked = s.notifBudget100 ?? s.notifB100 ?? true;
    
    const nanom = $id('notifAnomalous') || $id('notifAnom');
    if (nanom) nanom.checked = s.notifAnomalous ?? s.notifAnom ?? true;
    
    const nSubDue = $id('notifSubscriptionDue');
    if (nSubDue) nSubDue.checked = s.notifSubscriptionDue ?? true;
    
    const nVoice = $id('notifAutoVoice');
    if (nVoice) nVoice.checked = s.notifAutoVoice ?? true;

    const aiVoice = $id('aiVoiceEnabled');
    if (aiVoice) aiVoice.checked = s.aiVoiceEnabled ?? false;

    // Avatar
    const avatar = $id('profileAvatar');
    if (avatar) {
      if (user?.avatar) {
        avatar.innerHTML = `<img src="${user.avatar}" alt="Avatar" />`;
      } else {
        avatar.textContent = getInitials(user?.name || '');
      }
    }

    // Theme buttons
    document.querySelectorAll('.theme-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === (s.theme||'light'));
    });

    // Accent buttons
    document.querySelectorAll('.accent-dot').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === (s.accent||'#10b981'));
    });
  }

  async function saveProfile() {
    const uid   = App.state.currentUser.id;
    const name  = $id('settingName').value.trim();
    const email = $id('settingEmail').value.trim().toLowerCase();

    if (!name)  return showToast('Informe seu nome.', 'error');
    if (!isValidEmail(email)) return showToast('E-mail inválido.', 'error');

    await db.users.update(uid, { name, email });
    App.state.currentUser.name  = name;
    App.state.currentUser.email = email;
    // Update session
    App.auth.saveSession(App.state.currentUser);
    App.ui.updateSidebarUser();
    showToast('Perfil atualizado!', 'success');
  }

  async function changePassword() {
    const uid     = App.state.currentUser.id;
    const current = $id('currentPassword').value;
    const newPwd  = $id('newPassword').value;
    const confirm = $id('confirmNewPassword').value;

    if (!current || !newPwd || !confirm) return showToast('Preencha todos os campos.', 'error');
    if (newPwd.length < 8) return showToast('A nova senha deve ter ao menos 8 caracteres.', 'error');
    if (newPwd !== confirm) return showToast('As senhas não coincidem.', 'error');

    const user = await db.users.get(uid);
    const hash = hashPassword(current, user.salt);
    if (hash !== user.passwordHash) return showToast('Senha atual incorreta.', 'error');

    const salt    = generateSalt();
    const newHash = hashPassword(newPwd, salt);
    await db.users.update(uid, { passwordHash: newHash, salt });
    $id('currentPassword').value = '';
    $id('newPassword').value     = '';
    $id('confirmNewPassword').value = '';
    showToast('Senha alterada!', 'success');
  }

  async function savePref(key, value) {
    const uid = App.state.currentUser.id;
    await setSetting(uid, key, value);
    App.state.settings[key] = value;
    if (key === 'currency') showToast('Moeda atualizada!', 'success');
  }

  async function uploadAvatar(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2*1024*1024) return showToast('Imagem muito grande (máx. 2MB)', 'error');
    const base64 = await fileToBase64(file);
    const uid    = App.state.currentUser.id;
    await db.users.update(uid, { avatar: base64 });
    App.state.currentUser.avatar = base64;
    $id('profileAvatar').innerHTML = `<img src="${base64}" alt="Avatar" />`;
    App.ui.updateSidebarUser();
    showToast('Foto atualizada!', 'success');
  }

  async function exportData() {
    const uid  = App.state.currentUser.id;
    const data = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      user:     await db.users.get(uid),
      settings: await db.settings.where('userId').equals(uid).toArray(),
      accounts: await db.accounts.where('userId').equals(uid).toArray(),
      categories: await db.categories.where('userId').equals(uid).toArray(),
      transactions: await db.transactions.where('userId').equals(uid).toArray(),
      budgets:  await db.budgets.where('userId').equals(uid).toArray(),
      goals:    await db.goals.where('userId').equals(uid).toArray(),
    };
    // Remove password for safety
    if (data.user) { delete data.user.passwordHash; delete data.user.salt; }
    downloadFile(`financepro-backup-${toMonthKey()}.json`, JSON.stringify(data, null, 2), 'application/json');
    showToast('Backup exportado!', 'success');
  }

  async function importData(input) {
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await readFileText(file);
      const data = JSON.parse(text);
      App.modal.confirm(
        'Importar dados',
        'Isso irá MESCLAR os dados importados com os atuais. Continuar?',
        async () => {
          const uid = App.state.currentUser.id;
          await db.transaction('rw', db.categories, db.accounts, db.transactions, db.budgets, db.goals, async () => {
            if (data.categories) await db.categories.bulkPut(data.categories.map(c=>({...c,userId:uid})));
            if (data.accounts)   await db.accounts.bulkPut(data.accounts.map(a=>({...a,userId:uid})));
            if (data.transactions) await db.transactions.bulkPut(data.transactions.map(t=>({...t,userId:uid})));
            if (data.budgets)    await db.budgets.bulkPut(data.budgets.map(b=>({...b,userId:uid})));
            if (data.goals)      await db.goals.bulkPut(data.goals.map(g=>({...g,userId:uid})));
          });
          App.state.categoriesCache = await db.categories.where('userId').equals(uid).toArray();
          App.state.accountsCache   = await db.accounts.where('userId').equals(uid).toArray();
          showToast('Dados importados!', 'success');
          App.navigate('dashboard');
        }
      );
    } catch(e) {
      showToast('Erro ao importar: ' + e.message, 'error');
    }
    input.value = '';
  }

  async function resetAllData() {
    const answer = prompt('Digite APAGAR TUDO para confirmar a exclusão de todos os dados:');
    if (answer !== 'APAGAR TUDO') return showToast('Cancelado.', 'info');
    const uid = App.state.currentUser.id;
    await db.transaction('rw', db.transactions, db.accounts, db.categories, db.budgets, db.goals, db.notifications, db.settings, async () => {
      await db.transactions.where('userId').equals(uid).delete();
      await db.accounts.where('userId').equals(uid).delete();
      await db.categories.where('userId').equals(uid).delete();
      await db.budgets.where('userId').equals(uid).delete();
      await db.goals.where('userId').equals(uid).delete();
      await db.notifications.where('userId').equals(uid).delete();
      await db.settings.where('userId').equals(uid).delete();
    });
    await seedUserData(uid);
    App.state.settings = await getAllSettings(uid);
    App.state.categoriesCache = await db.categories.where('userId').equals(uid).toArray();
    App.state.accountsCache   = await db.accounts.where('userId').equals(uid).toArray();
    showToast('Dados resetados. Conta mantida.', 'info');
    App.navigate('dashboard');
  }

  return { load, saveProfile, changePassword, savePref, uploadAvatar, exportData, importData, resetAllData };
})();
