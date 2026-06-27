/**
 * @fileoverview FinancePro — patrimony.js
 * Balanço Patrimonial: Ativos × Passivos → Patrimônio Líquido.
 * Stored in IndexedDB via settings key (JSON blob per user).
 */

'use strict';

App.patrimony = (() => {

  let _data = { assets: [], liabilities: [] };

  const ASSET_TYPES = [
    { value:'real_estate', label:'Imóvel' },
    { value:'vehicle',     label:'Veículo' },
    { value:'investment',  label:'Investimento' },
    { value:'checking',    label:'Conta bancária' },
    { value:'other',       label:'Outros bens' },
  ];
  const LIABILITY_TYPES = [
    { value:'mortgage',   label:'Financiamento imobiliário' },
    { value:'car_loan',   label:'Financiamento veicular' },
    { value:'credit_card',label:'Cartão de crédito' },
    { value:'personal',   label:'Empréstimo pessoal' },
    { value:'other',      label:'Outras dívidas' },
  ];

  /* ── Load & init page ── */
  async function load() {
    const uid = App.state.currentUser.id;
    const saved = await getSetting(uid, 'patrimonyData', null);
    _data = saved || { assets: [], liabilities: [] };
    injectPage();
    render();
  }

  function injectPage() {
    const page = $id('page-patrimony');
    if (!page) return;
    if ($id('patrimonyContent')) return;
    page.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Balanço Patrimonial</h1>
          <p class="page-subtitle">Ativos, passivos e patrimônio líquido</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-outline" onclick="App.patrimony.addItem('asset')">
            <i class="fas fa-plus"></i> Ativo
          </button>
          <button class="btn btn-danger" onclick="App.patrimony.addItem('liability')" style="background:rgba(239,68,68,.15);color:var(--color-danger);border-color:rgba(239,68,68,.3)">
            <i class="fas fa-plus"></i> Passivo
          </button>
        </div>
      </div>
      <div id="patrimonyContent"></div>
    `;
  }

  /* ── Render ── */
  function render() {
    const el  = $id('patrimonyContent');
    if (!el) return;
    const cur = App.state.settings?.currency;

    const totalAssets      = _data.assets.reduce((s,a)=>s+a.value,0);
    const totalLiabilities = _data.liabilities.reduce((s,l)=>s+l.value,0);
    const netWorth         = totalAssets - totalLiabilities;
    const ratio            = totalAssets > 0 ? (totalLiabilities/totalAssets)*100 : 0;
    const ratioClass       = ratio > 80 ? 'danger' : ratio > 50 ? 'warning' : 'success';

    el.innerHTML = `
      <!-- Summary -->
      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:var(--space-5)">
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--color-success)"><i class="fas fa-arrow-up"></i></div>
          <div class="stat-info">
            <div class="stat-label">Total de Ativos</div>
            <div class="stat-value text-success">${formatCurrency(totalAssets,cur)}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--color-danger)"><i class="fas fa-arrow-down"></i></div>
          <div class="stat-info">
            <div class="stat-label">Total de Passivos</div>
            <div class="stat-value text-danger">${formatCurrency(totalLiabilities,cur)}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:${netWorth>=0?'var(--color-info)':'var(--color-danger)'}">
            <i class="fas fa-balance-scale"></i></div>
          <div class="stat-info">
            <div class="stat-label">Patrimônio Líquido</div>
            <div class="stat-value ${netWorth>=0?'text-info':'text-danger'}">${formatCurrency(netWorth,cur)}</div>
            <div class="stat-change stat-change--${ratioClass}">
              ${fmtPct(ratio)} de endividamento
            </div>
          </div>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="card" style="padding:var(--space-5);margin-bottom:var(--space-5)">
        <div style="display:flex;justify-content:space-between;font-size:var(--text-sm);margin-bottom:8px">
          <span>Ativos: <strong>${formatCurrency(totalAssets,cur)}</strong></span>
          <span>Passivos: <strong class="text-danger">${formatCurrency(totalLiabilities,cur)}</strong></span>
        </div>
        <div class="progress" style="height:12px">
          <div class="progress-fill progress-fill--${ratioClass}" style="width:${Math.min(ratio,100)}%"></div>
        </div>
        <p style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:6px">
          ${ratio <= 30 ? '✅ Excelente! Baixo endividamento.' :
            ratio <= 50 ? '👍 Saudável. Continue monitorando.' :
            ratio <= 80 ? '⚠️ Atenção: endividamento elevado.' :
            '🚨 Risco alto! Priorize quitar dívidas.'}
        </p>
      </div>

      <!-- Two columns -->
      <div class="categories-wrapper">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title text-success"><i class="fas fa-plus-circle"></i> Ativos</h3>
            <button class="btn btn-ghost btn-sm" onclick="App.patrimony.addItem('asset')">
              <i class="fas fa-plus"></i>
            </button>
          </div>
          ${renderList(_data.assets, 'asset', cur)}
        </div>
        <div class="card">
          <div class="card-header">
            <h3 class="card-title text-danger"><i class="fas fa-minus-circle"></i> Passivos</h3>
            <button class="btn btn-ghost btn-sm" onclick="App.patrimony.addItem('liability')">
              <i class="fas fa-plus"></i>
            </button>
          </div>
          ${renderList(_data.liabilities, 'liability', cur)}
        </div>
      </div>
    `;
  }

  function renderList(items, kind, cur) {
    const types = kind === 'asset' ? ASSET_TYPES : LIABILITY_TYPES;
    if (!items.length) {
      return `<div class="empty-state" style="padding:var(--space-6)">
        <p class="empty-text">Nenhum ${kind==='asset'?'ativo':'passivo'} cadastrado.</p>
        <button class="btn btn-outline btn-sm" onclick="App.patrimony.addItem('${kind}')">
          <i class="fas fa-plus"></i> Adicionar
        </button>
      </div>`;
    }
    return `<div class="cat-list">` + items.map((item, i) => {
      const typeLabel = types.find(t=>t.value===item.type)?.label || item.type;
      return `
        <div class="cat-item">
          <div class="cat-item-left">
            <div class="cat-icon-wrapper" style="background:${kind==='asset'?'var(--color-success)':'var(--color-danger)'}">
              <i class="fas ${getIcon(item.type)}"></i>
            </div>
            <div>
              <div class="cat-name">${escapeHtml(item.name)}</div>
              <div class="cat-meta">${typeLabel}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <span class="fw-bold ${kind==='asset'?'text-success':'text-danger'}">${formatCurrency(item.value,cur)}</span>
            <div class="cat-actions">
              <button class="row-btn" onclick="App.patrimony.editItem('${kind}',${i})"><i class="fas fa-pen"></i></button>
              <button class="row-btn row-btn--danger" onclick="App.patrimony.deleteItem('${kind}',${i})"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        </div>
      `;
    }).join('') + '</div>';
  }

  function getIcon(type) {
    const icons = {
      real_estate:'fa-home', vehicle:'fa-car', investment:'fa-chart-line',
      checking:'fa-university', other:'fa-box', mortgage:'fa-home',
      car_loan:'fa-car', credit_card:'fa-credit-card', personal:'fa-user',
    };
    return icons[type] || 'fa-tag';
  }

  /* ── Add / Edit ── */
  function addItem(kind, editIdx = null) {
    const types  = kind === 'asset' ? ASSET_TYPES : LIABILITY_TYPES;
    const item   = editIdx !== null ? _data[kind==='asset'?'assets':'liabilities'][editIdx] : null;
    const title  = `${item?'Editar':'Novo'} ${kind==='asset'?'Ativo':'Passivo'}`;

    App.modal.confirm(title, '', () => {}); // Open confirm modal as base — we'll use a custom one
    // Custom mini-modal
    let modal = $id('modalPatrimony');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-backdrop hidden';
      modal.id = 'modalPatrimony';
      modal.setAttribute('role','dialog');
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal modal--sm">
        <div class="modal-header">
          <h2 class="modal-title">${escapeHtml(title)}</h2>
          <button class="modal-close" onclick="App.modal.close('modalPatrimony')"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div class="form-group"><label class="form-label">Nome</label>
            <input type="text" id="patName" class="form-input" value="${escapeHtml(item?.name||'')}" placeholder="${kind==='asset'?'Apartamento, Ações...':'Financiamento, Cartão...'}" /></div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Tipo</label>
              <select id="patType" class="form-input">
                ${types.map(t=>`<option value="${t.value}" ${item?.type===t.value?'selected':''}>${t.label}</option>`).join('')}
              </select></div>
            <div class="form-group"><label class="form-label">Valor (R$)</label>
              <input type="number" id="patValue" class="form-input" step="0.01" value="${item?.value||''}" /></div>
          </div>
          <div class="form-group"><label class="form-label">Observação</label>
            <input type="text" id="patNote" class="form-input" value="${escapeHtml(item?.note||'')}" placeholder="Opcional" /></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="App.modal.close('modalPatrimony')">Cancelar</button>
          <button class="btn btn-primary" onclick="App.patrimony.saveItem('${kind}',${editIdx??'null'})">Salvar</button>
        </div>
      </div>
    `;
    App.modal.open('modalPatrimony');
  }

  function editItem(kind, idx) { addItem(kind, idx); }

  async function saveItem(kind, editIdx) {
    const name  = $id('patName').value.trim();
    const type  = $id('patType').value;
    const value = parseFloat($id('patValue').value);
    const note  = $id('patNote').value.trim();

    if (!name)  return showToast('Informe o nome.', 'error');
    if (!value || value <= 0) return showToast('Informe um valor válido.', 'error');

    const arr = kind === 'asset' ? _data.assets : _data.liabilities;
    const item = { name, type, value, note };

    if (editIdx !== null && editIdx >= 0) arr[editIdx] = item;
    else arr.push(item);

    await persist();
    App.modal.close('modalPatrimony');
    render();
    showToast(`${kind==='asset'?'Ativo':'Passivo'} salvo!`, 'success');
  }

  async function deleteItem(kind, idx) {
    const arr = kind === 'asset' ? _data.assets : _data.liabilities;
    App.modal.confirm('Excluir item', 'Deseja remover este item?', async () => {
      arr.splice(idx, 1);
      await persist();
      render();
      showToast('Item removido', 'info');
    });
  }

  async function persist() {
    await setSetting(App.state.currentUser.id, 'patrimonyData', _data);
  }

  return { load, addItem, editItem, saveItem, deleteItem };
})();
