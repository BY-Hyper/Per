/**
 * @fileoverview FinancePro — split.js
 * Divisão de despesas (split): divide uma despesa entre N pessoas,
 * controla quem já pagou, calcula saldo a receber/pagar.
 * Armazenado no IndexedDB via tabela `splits` (version 3).
 */

'use strict';

/* ── Ensure splits table ── */
(function ensureSplitsTable() {
  try {
    if (!db.splits) {
      db.version(3).stores({
        users:           '++id, email',
        settings:        '++id, [userId+key]',
        accounts:        '++id, userId, type',
        categories:      '++id, userId, type',
        transactions:    '++id, userId, [userId+date], [userId+type], [userId+categoryId], [userId+accountId], date, groupId',
        budgets:         '++id, userId, [userId+monthYear], [userId+monthYear+categoryId]',
        goals:           '++id, userId',
        notifications:   '++id, userId, read, createdAt',
        transactionLogs: '++id, transactionId, userId',
        subscriptions:   '++id, userId, active',
        splits:          '++id, userId, transactionId, settled',
      });
    }
  } catch(e) { console.warn('[splits] DB upgrade skipped:', e.message); }
})();

App.split = (() => {

  /* ══════════════════════════════════════
     PAGE
  ══════════════════════════════════════ */
  function injectPage() {
    const page = $id('page-split');
    if (!page || $id('splitGrid')) return;
    page.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Dividir Despesas</h1>
          <p class="page-subtitle">Controle quem deve quanto e gerencie cobranças</p>
        </div>
        <button class="btn btn-primary" onclick="App.split.openModal()">
          <i class="fas fa-plus"></i> Nova divisão
        </button>
      </div>
      <!-- Summary strip -->
      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:var(--space-5)" id="splitKpis"></div>
      <!-- List -->
      <div id="splitGrid"></div>
    `;
  }

  async function load() {
    injectPage();
    const uid = App.state.currentUser.id;
    let splits = [];
    try { splits = await db.splits.where('userId').equals(uid).reverse().toArray(); } catch { splits = []; }

    const cur = App.state.settings?.currency;

    /* KPIs */
    const totalOwed  = splits.filter(s=>!s.settled).reduce((sum,s)=>sum+totalPending(s),0);
    const totalSplit  = splits.reduce((sum,s)=>sum+s.amount,0);
    const settled     = splits.filter(s=>s.settled).length;

    $id('splitKpis').innerHTML = `
      <div class="stat-card">
        <div class="stat-icon stat-icon--income"><i class="fas fa-hand-holding-dollar"></i></div>
        <div class="stat-info">
          <div class="stat-label">A receber</div>
          <div class="stat-value text-success">${formatCurrency(totalOwed,cur)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon--balance"><i class="fas fa-receipt"></i></div>
        <div class="stat-info">
          <div class="stat-label">Total dividido</div>
          <div class="stat-value">${formatCurrency(totalSplit,cur)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon--savings"><i class="fas fa-check-double"></i></div>
        <div class="stat-info">
          <div class="stat-label">Quitados</div>
          <div class="stat-value">${settled}</div>
        </div>
      </div>
    `;

    /* List */
    const grid = $id('splitGrid');
    if (!splits.length) {
      grid.innerHTML = `
        <div class="card">
          <div class="empty-state" style="padding:var(--space-10)">
            <div class="empty-icon"><i class="fas fa-users"></i></div>
            <p class="empty-title">Nenhuma divisão criada</p>
            <p class="empty-text">Divida contas de restaurante, viagens e despesas compartilhadas.</p>
            <button class="btn btn-primary" onclick="App.split.openModal()">
              <i class="fas fa-plus"></i> Criar primeira divisão
            </button>
          </div>
        </div>`;
      return;
    }

    grid.innerHTML = splits.map(s => renderSplitCard(s, cur)).join('');
  }

  function totalPending(split) {
    return (split.participants||[])
      .filter(p => !p.paid && !p.isOwner)
      .reduce((sum,p) => sum + p.share, 0);
  }

  function renderSplitCard(s, cur) {
    const pending   = totalPending(s);
    const collected = (s.participants||[]).filter(p=>p.paid&&!p.isOwner).reduce((sum,p)=>sum+p.share,0);
    const total     = (s.participants||[]).filter(p=>!p.isOwner).reduce((sum,p)=>sum+p.share,0);
    const pct       = total>0 ? (collected/total)*100 : 0;
    const fillClass = pct>=100?'success':pct>=50?'warning':'danger';
    const settled   = s.settled || pct>=100;

    return `
      <div class="card split-card ${settled?'split-card--settled':''}" style="margin-bottom:var(--space-4)">
        <div class="card-header">
          <div>
            <h3 class="card-title">${escapeHtml(s.title)}</h3>
            <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:3px">
              ${formatDate(s.date)} • ${(s.participants||[]).length} pessoas
              ${settled?'<span class="badge badge--success" style="margin-left:6px">Quitado</span>':''}
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:var(--text-2xl);font-weight:var(--fw-extra);font-family:var(--font-display)">${formatCurrency(s.amount,cur)}</div>
            <div style="font-size:var(--text-xs);color:var(--text-secondary)">total da despesa</div>
          </div>
        </div>
        <!-- Progress -->
        <div style="padding:var(--space-4) var(--space-6)">
          <div style="display:flex;justify-content:space-between;font-size:var(--text-xs);margin-bottom:6px">
            <span>Recebido: <strong class="text-success">${formatCurrency(collected,cur)}</strong></span>
            <span>Pendente: <strong class="text-danger">${formatCurrency(pending,cur)}</strong></span>
          </div>
          <div class="progress"><div class="progress-fill progress-fill--${fillClass}" style="width:${Math.min(pct,100)}%"></div></div>
        </div>
        <!-- Participants -->
        <div style="padding:0 var(--space-6) var(--space-4)">
          ${(s.participants||[]).map((p,i) => `
            <div class="split-participant">
              <div class="split-participant-avatar" style="background:${p.color||'var(--accent)'}">
                ${p.name.charAt(0).toUpperCase()}
              </div>
              <div class="split-participant-info">
                <span class="split-participant-name">${escapeHtml(p.name)}${p.isOwner?' <span style="font-size:10px;color:var(--text-tertiary)">(você)</span>':''}</span>
                <span class="split-participant-share">${formatCurrency(p.share,cur)}</span>
              </div>
              ${!p.isOwner ? `
                <button class="btn btn-sm ${p.paid?'btn-ghost':'btn-outline'}"
                        onclick="App.split.togglePaid('${s.id}',${i})"
                        style="${p.paid?'color:var(--color-success)':''}">
                  <i class="fas fa-${p.paid?'check-circle':'circle'}"></i>
                  ${p.paid?'Pago':'Pendente'}
                </button>` : `<span class="badge badge--info">Pagante</span>`}
            </div>
          `).join('')}
        </div>
        <!-- Actions -->
        <div style="padding:var(--space-3) var(--space-6);border-top:1px solid var(--border);display:flex;gap:var(--space-3)">
          ${!settled?`<button class="btn btn-outline btn-sm" onclick="App.split.markSettled('${s.id}')">
            <i class="fas fa-check-double"></i> Marcar como quitado</button>`:''}
          <button class="btn btn-ghost btn-sm" onclick="App.split.openModal('${s.id}')">
            <i class="fas fa-pen"></i> Editar</button>
          <button class="btn btn-ghost btn-sm" onclick="App.split.deleteOne('${s.id}')">
            <i class="fas fa-trash"></i></button>
        </div>
      </div>
    `;
  }

  /* ══════════════════════════════════════
     MODAL
  ══════════════════════════════════════ */
  let _participants = [];

  async function openModal(editId = null) {
    let modal = $id('modalSplit');
    if (!modal) buildModal();
    modal = $id('modalSplit');

    let s = null;
    if (editId) { try { s = await db.splits.get(parseInt(editId)); } catch {} }

    $id('splitEditId').value    = s ? s.id : '';
    $id('splitTitle').value     = s ? s.title : '';
    $id('splitAmount').value    = s ? s.amount : '';
    $id('splitDate').value      = s ? s.date : today();
    $id('splitMethod').value    = s?.method || 'equal';

    _participants = s?.participants ? [...s.participants] : [
      { name: App.state.currentUser.name, share: 0, paid: true, isOwner: true, color: '#10b981' }
    ];
    renderParticipants();
    App.modal.open('modalSplit');
  }

  function buildModal() {
    const div = document.createElement('div');
    div.className = 'modal-backdrop hidden';
    div.id = 'modalSplit';
    div.setAttribute('role','dialog');
    div.innerHTML = `
      <div class="modal" style="max-width:560px">
        <div class="modal-header">
          <h2 class="modal-title">Dividir Despesa</h2>
          <button class="modal-close" onclick="App.modal.close('modalSplit')"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">Descrição</label>
              <input type="text" id="splitTitle" class="form-input" placeholder="Jantar, viagem, mercado..." />
            </div>
            <div class="form-group">
              <label class="form-label">Data</label>
              <input type="date" id="splitDate" class="form-input" />
            </div>
          </div>
          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">Valor total (R$)</label>
              <input type="number" id="splitAmount" class="form-input" step="0.01"
                     oninput="App.split.recalcShares()" />
            </div>
            <div class="form-group">
              <label class="form-label">Divisão</label>
              <select id="splitMethod" class="form-input" onchange="App.split.recalcShares()">
                <option value="equal">Igual para todos</option>
                <option value="custom">Personalizada</option>
                <option value="percent">Por percentual</option>
              </select>
            </div>
          </div>
          <!-- Participants -->
          <div style="margin-top:var(--space-4)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
              <label class="form-label" style="margin:0">Participantes</label>
              <button class="btn btn-ghost btn-sm" onclick="App.split.addParticipant()">
                <i class="fas fa-user-plus"></i> Adicionar
              </button>
            </div>
            <div id="splitParticipants"></div>
          </div>
        </div>
        <div class="modal-footer">
          <input type="hidden" id="splitEditId" />
          <button class="btn btn-ghost" onclick="App.modal.close('modalSplit')">Cancelar</button>
          <button class="btn btn-primary" onclick="App.split.save()">
            <i class="fas fa-save"></i> Salvar divisão
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(div);
  }

  const COLORS = ['#10b981','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#ec4899','#14b8a6'];

  function addParticipant() {
    _participants.push({ name: '', share: 0, paid: false, isOwner: false, color: COLORS[_participants.length % COLORS.length] });
    renderParticipants();
    recalcShares();
  }

  function renderParticipants() {
    const method = $id('splitMethod')?.value || 'equal';
    const el = $id('splitParticipants');
    if (!el) return;
    el.innerHTML = _participants.map((p, i) => `
      <div class="split-participant-row">
        <div class="split-participant-avatar" style="background:${p.color}">${p.name?p.name.charAt(0).toUpperCase():'?'}</div>
        <input type="text" class="form-input" value="${escapeHtml(p.name)}"
               placeholder="Nome do participante" style="flex:1;padding:8px 12px"
               oninput="_participants[${i}].name=this.value" ${p.isOwner?'readonly':''} />
        ${method!=='equal' ? `
          <input type="number" class="form-input" value="${p.share.toFixed(2)}"
                 placeholder="${method==='percent'?'%':'R$'}" style="width:90px;padding:8px 10px"
                 oninput="App.split.setShare(${i},parseFloat(this.value)||0)" step="0.01" />
        ` : `
          <span style="min-width:80px;text-align:right;font-size:var(--text-sm);font-weight:var(--fw-semi);color:var(--text-secondary)"
                id="splitShare_${i}">R$ ${p.share.toFixed(2)}</span>
        `}
        ${!p.isOwner ? `
          <button class="row-btn row-btn--danger" onclick="App.split.removeParticipant(${i})">
            <i class="fas fa-times"></i>
          </button>` : ''}
      </div>
    `).join('');
  }

  function setShare(idx, val) { _participants[idx].share = val; }

  function removeParticipant(idx) {
    if (_participants[idx].isOwner) return;
    _participants.splice(idx, 1);
    renderParticipants();
    recalcShares();
  }

  function recalcShares() {
    const amount = parseFloat($id('splitAmount')?.value) || 0;
    const method = $id('splitMethod')?.value || 'equal';
    const n      = _participants.length;

    if (method === 'equal' && n > 0) {
      const each = parseFloat((amount / n).toFixed(2));
      const remainder = parseFloat((amount - each * (n-1)).toFixed(2));
      _participants.forEach((p, i) => { p.share = i === n-1 ? remainder : each; });
    } else if (method === 'percent') {
      _participants.forEach(p => { p.share = parseFloat(((p.pct||0)/100*amount).toFixed(2)); });
    }
    // Custom: user sets values directly

    // Update display for equal mode
    if (method === 'equal') {
      _participants.forEach((p,i) => {
        const el = $id(`splitShare_${i}`);
        if (el) el.textContent = `R$ ${p.share.toFixed(2)}`;
      });
    }
  }

  async function save() {
    const uid   = App.state.currentUser.id;
    const editId= $id('splitEditId').value;
    const title = $id('splitTitle').value.trim();
    const amount= parseFloat($id('splitAmount').value);

    if (!title)  return showToast('Informe a descrição.', 'error');
    if (!amount || amount<=0) return showToast('Informe o valor.', 'error');
    if (_participants.length < 2) return showToast('Adicione ao menos 2 participantes.', 'error');
    if (_participants.some(p=>!p.name.trim())) return showToast('Todos os participantes precisam de nome.', 'error');

    recalcShares();

    const data = {
      userId: uid,
      title, amount,
      date:   $id('splitDate').value || today(),
      method: $id('splitMethod').value,
      participants: _participants,
      settled: false,
      createdAt: new Date().toISOString(),
    };

    try {
      if (editId) { await db.splits.update(parseInt(editId), data); }
      else        { await db.splits.add(data); }
      showToast('Divisão salva!', 'success');
      App.modal.close('modalSplit');
      load();
    } catch(e) { showToast('Erro: '+e.message,'error'); }
  }

  async function togglePaid(id, idx) {
    try {
      const s = await db.splits.get(parseInt(id));
      if (!s) return;
      s.participants[idx].paid = !s.participants[idx].paid;
      // Check if all paid → auto-settle
      const allPaid = s.participants.filter(p=>!p.isOwner).every(p=>p.paid);
      if (allPaid) s.settled = true;
      await db.splits.update(parseInt(id), { participants: s.participants, settled: s.settled });
      if (allPaid) showToast('Todos pagaram! Divisão quitada 🎉', 'success');
      load();
    } catch(e) { showToast('Erro: '+e.message,'error'); }
  }

  async function markSettled(id) {
    try {
      await db.splits.update(parseInt(id), { settled: true });
      showToast('Divisão marcada como quitada!', 'success');
      load();
    } catch {}
  }

  async function deleteOne(id) {
    App.modal.confirm('Excluir divisão','Deseja remover esta divisão de despesas?', async () => {
      try { await db.splits.delete(parseInt(id)); load(); showToast('Divisão removida','info'); } catch {}
    });
  }

  return { load, openModal, addParticipant, removeParticipant, setShare, recalcShares, save, togglePaid, markSettled, deleteOne };
})();
