/**
 * @fileoverview FinancePro — subscriptions.js
 * Subscription & recurring bills tracker.
 * Stored in IndexedDB under the `subscriptions` table (added via db upgrade).
 * Features: list, add, edit, delete, due-date alerts, auto-transaction creation.
 */

'use strict';

/* ──────────────────────────────────────
   Ensure subscriptions table exists
   (runtime upgrade if missing)
────────────────────────────────────── */
(function ensureSubscriptionsTable() {
  if (!db.subscriptions) {
    // Dexie dynamic table add (version bump)
    db.version(2).stores({
      users: '++id, email',
      settings: '++id, [userId+key]',
      accounts: '++id, userId, type',
      categories: '++id, userId, type',
      transactions: '++id, userId, [userId+date], [userId+type], [userId+categoryId], [userId+accountId], date, groupId',
      budgets: '++id, userId, [userId+monthYear], [userId+monthYear+categoryId]',
      goals: '++id, userId',
      notifications: '++id, userId, read, createdAt',
      transactionLogs: '++id, transactionId, userId',
      subscriptions: '++id, userId, active',
    });
  }
})();

App.subscriptions = (() => {

  const BILLING_CYCLES = {
    monthly:   'Mensal',
    yearly:    'Anual',
    weekly:    'Semanal',
    quarterly: 'Trimestral',
  };

  const POPULAR = [
    { name:'Netflix',        amount:55.90,  icon:'fa-play',          color:'#e50914', cycle:'monthly' },
    { name:'Spotify',        amount:21.90,  icon:'fa-music',         color:'#1db954', cycle:'monthly' },
    { name:'Amazon Prime',   amount:19.90,  icon:'fa-box',           color:'#ff9900', cycle:'monthly' },
    { name:'Disney+',        amount:43.90,  icon:'fa-star',          color:'#006e99', cycle:'monthly' },
    { name:'YouTube Premium',amount:27.90,  icon:'fa-youtube',       color:'#ff0000', cycle:'monthly' },
    { name:'iCloud',         amount:4.90,   icon:'fa-cloud',         color:'#6fb3f0', cycle:'monthly' },
    { name:'Xbox Game Pass', amount:49.99,  icon:'fa-gamepad',       color:'#107c10', cycle:'monthly' },
    { name:'Adobe CC',       amount:259.00, icon:'fa-palette',       color:'#ff0000', cycle:'monthly' },
  ];

  async function load() {
    const uid = App.state.currentUser.id;
    let subs;
    try {
      subs = await db.subscriptions.where('userId').equals(uid).toArray();
    } catch {
      subs = [];
    }

    const cur = App.state.settings?.currency;
    const page = $id('page-subscriptions');
    if (!page) return;

    // Inject page if not already there
    injectSubsPage();
    const grid = $id('subsGrid');
    if (!grid) return;

    const totalMonthly = subs
      .filter(s => s.active !== false)
      .reduce((sum, s) => {
        if (s.cycle === 'yearly')    return sum + s.amount / 12;
        if (s.cycle === 'quarterly') return sum + s.amount / 3;
        if (s.cycle === 'weekly')    return sum + s.amount * 4.33;
        return sum + s.amount;
      }, 0);

    $id('subsTotalMonthly').textContent = formatCurrency(totalMonthly, cur);

    if (!subs.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon"><i class="fas fa-credit-card"></i></div>
          <p class="empty-title">Nenhuma assinatura cadastrada</p>
          <p class="empty-text">Controle seus serviços recorrentes e evite surpresas.</p>
          <button class="btn btn-primary" onclick="App.subscriptions.openModal()">
            <i class="fas fa-plus"></i> Adicionar assinatura
          </button>
        </div>
      `;
      return;
    }

    const today_ = today();
    grid.innerHTML = subs.map(s => {
      const daysUntil = s.nextDue ? Math.ceil((new Date(s.nextDue) - new Date()) / 86400000) : null;
      const alert     = daysUntil !== null && daysUntil <= 3 && daysUntil >= 0;
      const overdue   = daysUntil !== null && daysUntil < 0;
      const monthlyEq = s.cycle === 'yearly' ? s.amount / 12 : s.cycle === 'quarterly' ? s.amount / 3 : s.cycle === 'weekly' ? s.amount * 4.33 : s.amount;

      return `
        <div class="sub-card ${s.active===false?'sub-card--inactive':''}">
          <div class="sub-card-header">
            <div class="sub-icon" style="background:${s.color||'var(--accent)'}">
              <i class="fas ${s.icon||'fa-credit-card'}"></i>
            </div>
            <div class="sub-info">
              <div class="sub-name">${escapeHtml(s.name)}</div>
              <div class="sub-cycle">${BILLING_CYCLES[s.cycle]||s.cycle}</div>
            </div>
            <label class="toggle-switch" title="${s.active!==false?'Ativa':'Inativa'}">
              <input type="checkbox" ${s.active!==false?'checked':''} onchange="App.subscriptions.toggleActive(${s.id},this.checked)" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="sub-amount">${formatCurrency(s.amount, cur)}<span class="sub-cycle-label">/${BILLING_CYCLES[s.cycle]?.toLowerCase()||'mês'}</span></div>
          ${s.cycle !== 'monthly' ? `<div class="sub-eq">≈ ${formatCurrency(monthlyEq, cur)}/mês</div>` : ''}
          ${s.nextDue ? `
            <div class="sub-due ${alert?'sub-due--alert':''}${overdue?'sub-due--overdue':''}">
              <i class="fas fa-calendar-alt"></i>
              ${overdue ? `Vencida há ${Math.abs(daysUntil)} dia(s)` :
                daysUntil === 0 ? 'Vence hoje!' :
                `Próximo: ${formatDate(s.nextDue)} (${daysUntil}d)`}
            </div>
          ` : ''}
          <div class="sub-actions">
            <button class="btn btn-ghost btn-sm" onclick="App.subscriptions.payNow(${s.id})">
              <i class="fas fa-check"></i> Pagar
            </button>
            <button class="btn btn-outline btn-sm" onclick="App.subscriptions.openModal(${s.id})">
              <i class="fas fa-pen"></i>
            </button>
            <button class="btn btn-ghost btn-sm" onclick="App.subscriptions.deleteOne(${s.id})">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Check alerts
    checkDueAlerts(subs);
  }

  function injectSubsPage() {
    if ($id('subsGrid')) return;
    const page = $id('page-subscriptions');
    if (!page) return;
    page.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Assinaturas</h1>
          <p class="page-subtitle">Total mensal: <strong id="subsTotalMonthly">—</strong></p>
        </div>
        <button class="btn btn-primary" onclick="App.subscriptions.openModal()">
          <i class="fas fa-plus"></i> Nova assinatura
        </button>
      </div>
      <div class="subs-grid" id="subsGrid"></div>
    `;
  }

  /* ── Modal ── */
  function openModal(editId = null) {
    let modal = $id('modalSubscription');
    if (!modal) buildModal();
    modal = $id('modalSubscription');

    const cats = App.state.categoriesCache.filter(c => c.type === 'expense');
    $id('subCatSelect').innerHTML = cats.map(c =>
      `<option value="${c.id}">${escapeHtml(c.name)}</option>`
    ).join('');
    const accs = App.state.accountsCache;
    $id('subAccSelect').innerHTML = accs.map(a =>
      `<option value="${a.id}">${escapeHtml(a.name)}</option>`
    ).join('');

    if (editId) {
      db.subscriptions.get(editId).then(s => {
        if (!s) return;
        $id('subEditId').value = s.id;
        $id('subName').value   = s.name;
        $id('subAmount').value = s.amount;
        $id('subCycle').value  = s.cycle || 'monthly';
        $id('subNextDue').value= s.nextDue || '';
        $id('subColor').value  = s.color || '#10b981';
        $id('subIcon').value   = s.icon  || 'fa-credit-card';
        if (s.categoryId) $id('subCatSelect').value = s.categoryId;
        if (s.accountId)  $id('subAccSelect').value = s.accountId;
      });
    } else {
      $id('subEditId').value = '';
      $id('subName').value   = '';
      $id('subAmount').value = '';
      $id('subCycle').value  = 'monthly';
      $id('subNextDue').value= '';
      $id('subColor').value  = '#10b981';
      $id('subIcon').value   = 'fa-credit-card';
    }
    App.modal.open('modalSubscription');
  }

  function buildModal() {
    const div = document.createElement('div');
    div.className = 'modal-backdrop hidden';
    div.id = 'modalSubscription';
    div.setAttribute('role','dialog'); div.setAttribute('aria-modal','true');
    div.innerHTML = `
      <div class="modal modal--sm">
        <div class="modal-header">
          <h2 class="modal-title">Assinatura</h2>
          <button class="modal-close" onclick="App.modal.close('modalSubscription')"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div class="form-group"><label class="form-label">Nome do serviço</label>
            <input type="text" id="subName" class="form-input" placeholder="Netflix, Spotify..." /></div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Valor (R$)</label>
              <input type="number" id="subAmount" class="form-input" step="0.01" /></div>
            <div class="form-group"><label class="form-label">Ciclo</label>
              <select id="subCycle" class="form-input">
                <option value="monthly">Mensal</option><option value="yearly">Anual</option>
                <option value="quarterly">Trimestral</option><option value="weekly">Semanal</option>
              </select>
            </div>
          </div>
          <div class="form-group"><label class="form-label">Próximo vencimento</label>
            <input type="date" id="subNextDue" class="form-input" /></div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Categoria</label>
              <select id="subCatSelect" class="form-input"></select></div>
            <div class="form-group"><label class="form-label">Conta</label>
              <select id="subAccSelect" class="form-input"></select></div>
          </div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Ícone</label>
              <input type="text" id="subIcon" class="form-input" placeholder="fa-credit-card" /></div>
            <div class="form-group"><label class="form-label">Cor</label>
              <input type="color" id="subColor" class="form-input form-input--color" value="#10b981" /></div>
          </div>
          <div style="margin-top:12px">
            <p style="font-size:var(--text-sm);font-weight:var(--fw-semi);margin-bottom:8px">Serviços populares</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap" id="popularSubs"></div>
          </div>
        </div>
        <div class="modal-footer">
          <input type="hidden" id="subEditId" />
          <button class="btn btn-ghost" onclick="App.modal.close('modalSubscription')">Cancelar</button>
          <button class="btn btn-primary" onclick="App.subscriptions.save()"><i class="fas fa-save"></i> Salvar</button>
        </div>
      </div>
    `;
    document.body.appendChild(div);

    // Populate popular
    const pop = div.querySelector('#popularSubs');
    pop.innerHTML = POPULAR.map(p => `
      <button class="btn btn-ghost btn-sm" style="border:1px solid var(--border);gap:6px"
              onclick="App.subscriptions.fillPopular(${JSON.stringify(p).replace(/"/g,'&quot;')})">
        <i class="fas ${p.icon}" style="color:${p.color}"></i> ${escapeHtml(p.name)}
      </button>
    `).join('');
  }

  function fillPopular(p) {
    $id('subName').value   = p.name;
    $id('subAmount').value = p.amount;
    $id('subCycle').value  = p.cycle;
    $id('subColor').value  = p.color;
    $id('subIcon').value   = p.icon;
  }

  async function save() {
    const uid    = App.state.currentUser.id;
    const editId = $id('subEditId').value;
    const name   = $id('subName').value.trim();
    const amount = parseFloat($id('subAmount').value);
    if (!name)   return showToast('Informe o nome.', 'error');
    if (!amount) return showToast('Informe o valor.', 'error');

    const data = {
      userId:     uid,
      name, amount,
      cycle:      $id('subCycle').value,
      nextDue:    $id('subNextDue').value || null,
      categoryId: parseInt($id('subCatSelect').value) || null,
      accountId:  parseInt($id('subAccSelect').value) || null,
      color:      $id('subColor').value,
      icon:       $id('subIcon').value || 'fa-credit-card',
      active:     true,
    };

    try {
      if (editId) { await db.subscriptions.update(parseInt(editId), data); }
      else        { await db.subscriptions.add({ ...data, createdAt: new Date().toISOString() }); }
      showToast('Assinatura salva!', 'success');
      App.modal.close('modalSubscription');
      load();
    } catch(e) { showToast('Erro: ' + e.message, 'error'); }
  }

  async function toggleActive(id, active) {
    try { await db.subscriptions.update(id, { active }); load(); } catch {}
  }

  async function deleteOne(id) {
    App.modal.confirm('Excluir assinatura', 'Deseja remover esta assinatura?', async () => {
      await db.subscriptions.delete(id);
      showToast('Assinatura removida', 'info');
      load();
    });
  }

  /* ── Pay Now: create a transaction and advance nextDue ── */
  async function payNow(id) {
    const s = await db.subscriptions.get(id);
    if (!s) return;

    await db.transactions.add({
      userId: App.state.currentUser.id,
      type: 'expense', amount: s.amount,
      categoryId: s.categoryId || null,
      accountId:  s.accountId  || App.state.accountsCache[0]?.id,
      date: today(), description: `${s.name} (assinatura)`,
      tags: ['assinatura'], isRecurring: true,
      recurringRule: null, groupId: null,
      installmentNum: null, installmentTotal: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });

    // Advance nextDue
    if (s.nextDue) {
      const d = new Date(s.nextDue + 'T00:00:00');
      if (s.cycle === 'monthly')   d.setMonth(d.getMonth() + 1);
      else if (s.cycle === 'yearly')    d.setFullYear(d.getFullYear() + 1);
      else if (s.cycle === 'quarterly') d.setMonth(d.getMonth() + 3);
      else if (s.cycle === 'weekly')    d.setDate(d.getDate() + 7);
      await db.subscriptions.update(id, { nextDue: d.toISOString().split('T')[0] });
    }

    showToast(`Pagamento de ${s.name} registrado!`, 'success');
    load();
    EventBus.emit('transactionSaved');
  }

  /* ── Due alerts ── */
  async function checkDueAlerts(subs) {
    const uid  = App.state.currentUser.id;
    const settings = App.state.settings;
    if (!settings.notifSubscriptionDue) return;

    for (const s of subs) {
      if (s.active === false || !s.nextDue) continue;
      const daysUntil = Math.ceil((new Date(s.nextDue) - new Date()) / 86400000);
      if (daysUntil === 3 || daysUntil === 1) {
        const msg = `Assinatura "${s.name}" vence em ${daysUntil} dia(s) — ${formatCurrency(s.amount, App.state.settings?.currency)}`;
        await addNotification(uid, 'recurring', msg, s.id);
        if (settings.notifAutoVoice) {
          const useKokoro = localStorage.getItem('tts.useKokoro') === '1';
          await TTS.announce(msg, { useNative: !useKokoro });
        }
      }
    }
    App.ui.updateNotifBadge();
  }

  return { load, openModal, save, toggleActive, deleteOne, payNow, fillPopular };
})();
