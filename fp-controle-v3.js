/* =====================================================================
   FINANCEPRO — CONTROLE FINANCEIRO v3
   Substitui fp-controle-financeiro.js com UX melhorada:
   • Cards expandíveis com mini-gráfico Chart.js ao vivo
   • Mover transações de categoria via drag visual ou botão
   • Regras de categorização com modal rico (sem prompt())
   • Fuzzy match em tempo real ao digitar nova regra
   • Análise de favorecidos com contexto para IA
   • Tab "Visão Geral" com distribuição 50/30/20
   • FAB flutuante para criar regra em qualquer página
===================================================================== */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const T = (m, t = 'success', ms = 3500) => typeof window.toast === 'function' && window.toast(m, t, ms);
  const fmt = v => typeof window.fmtCurrency === 'function'
    ? window.fmtCurrency(v)
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const esc = s => String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();
  const levenshtein = (a, b) => {
    const m = a.length, n = b.length;
    const d = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      d[i][j] = a[i-1]===b[j-1] ? d[i-1][j-1] : 1+Math.min(d[i-1][j], d[i][j-1], d[i-1][j-1]);
    return d[m][n];
  };


  /* Safe wrapper for userRules (table may not exist in older DB) */
  async function dbRules(uid) {
    try {
      if (!window.db?.userRules) return [];
      return await window.db.userRules.where('userId').equals(uid).toArray();
    } catch(e) { return []; }
  }
  async function dbRulesAdd(data) {
    try { if (window.db?.userRules) await window.db.userRules.add(data); } catch(e) {}
  }
  async function dbRulesDelete(id) {
    try { if (window.db?.userRules) await window.db.userRules.delete(id); } catch(e) {}
  }

  /* ── Estado global da página ── */
  const ST = {
    month: new Date().toISOString().slice(0,7),
    tab: 'cat',
    cats: [], txs: [], budgets: [], rules: [],
    expanded: new Set(),
    charts: {},
    _data: null,
  };

  /* ── Aguarda app ── */
  async function waitForApp(ms = 6000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      // Try multiple ways to get the current user
      const u = window.S?.user || window.currentUser;
      const db_ = window.db;
      if (db_ && u && u.id != null) {
        // Ensure cats are loaded
        if (!window.S?.cats?.length) {
          try {
            const cats = await db_.categories.where('userId').equals(u.id).toArray();
            if (window.S) window.S.cats = cats;
          } catch(e) {}
        }
        return u.id;  // Return uid directly
      }
      await new Promise(r => setTimeout(r, 250));
    }
    return null;  // Null means failed
  }

  /* ── Carrega dados ── */
  async function loadData() {
    const ready = await waitForApp(8000);
    if (!ready) {
      throw new Error('App não inicializado (8s). window.S.user=' + JSON.stringify(window.S?.user));
    }('Aguardando inicialização do app. Verifique se está logado.');
    const uid = window.S.user.id;
    const month = ST.month;
    const start = month + '-01';
    const end = new Date(new Date(start).getFullYear(), new Date(start).getMonth()+1,0).toISOString().split('T')[0];
    const prevMonth = new Date(new Date(start).getFullYear(), new Date(start).getMonth()-1,1).toISOString().slice(0,7);
    const prevStart = prevMonth+'-01';
    const prevEnd = new Date(new Date(prevStart).getFullYear(), new Date(prevStart).getMonth()+1,0).toISOString().split('T')[0];

    const [allTxs, budgets, cats, rules] = await Promise.all([
      window.db.transactions.where('userId').equals(uid).toArray(),
      window.db.budgets.where('userId').equals(uid).toArray(),
      window.db.categories.where('userId').equals(uid).toArray(),
      dbRules(uid),
    ]);

    ST.cats = cats;
    ST.budgets = budgets;
    ST.rules = rules;

    const curTxs  = allTxs.filter(t => t.date >= start  && t.date <= end);
    const prevTxs = allTxs.filter(t => t.date >= prevStart && t.date <= prevEnd);

    const cI = curTxs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const cE = curTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const pE = prevTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

    // Por categoria
    const mBudgets = budgets.filter(b=>!b.monthYear||b.monthYear===month);
    const catData = cats.filter(c=>c.type==='expense').map(cat => {
      const budget = mBudgets.find(b=>String(b.categoryId)===String(cat.id));
      const curExp = curTxs.filter(t=>t.type==='expense'&&String(t.categoryId)===String(cat.id));
      const prevExp = prevTxs.filter(t=>t.type==='expense'&&String(t.categoryId)===String(cat.id));
      const curSpent = curExp.reduce((s,t)=>s+t.amount,0);
      const prevSpent = prevExp.reduce((s,t)=>s+t.amount,0);
      const limit = budget?.limitAmount||0;
      const pct = limit>0 ? Math.round(curSpent/limit*100) : 0;

      // Favorecidos
      const descMap={};
      curExp.forEach(t=>{const k=t.description||'Sem desc'; descMap[k]=(descMap[k]||0)+t.amount;});
      const payees = Object.entries(descMap).sort((a,b)=>b[1]-a[1]);

      // Daily data for mini chart
      const days={};
      curExp.forEach(t=>{ const d=t.date.slice(8); days[d]=(days[d]||0)+t.amount; });

      return { cat, budget, curSpent, prevSpent, limit, pct, payees, txs: curExp, days,
               alert: limit>0&&pct>=100?'danger':limit>0&&pct>=85?'warning':null };
    }).sort((a,b) => {
      if(a.pct>=100&&b.pct<100)return-1; if(b.pct>=100&&a.pct<100)return 1;
      return b.curSpent - a.curSpent;
    });

    // Anomalias (>2x média histórica)
    const anomalies = catData.filter(d => {
      if (!d.prevSpent) return false;
      return d.curSpent > d.prevSpent * 2.5 && d.curSpent > 50;
    });

    ST._data = { catData, cI, cE, pE, curTxs, allTxs, anomalies, uid, month };
    return ST._data;
  }

  /* ── Renderiza a página completa ── */
  async function load(monthStr) {
    ST.month = monthStr || ST.month;
    const root = $('cfPageZone') || $('cfRoot');
    if (!root) return;
    root.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--txt2)"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem"></i><br><br>Carregando Controle Financeiro...</div>';
    // Aguarda login e DB
    // waitForApp now returns uid directly, not bool
    const uid = await waitForApp(6000);
    if (!uid && uid !== 0) {
      root.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--txt2)"><i class="fas fa-user-lock" style="font-size:2rem;display:block;margin-bottom:.75rem"></i>Faça login para ver o Controle Financeiro.<br><button class="btn btn-primary btn-sm" style="margin-top:1rem" onclick="CF3.load()">Tentar novamente</button></div>';
      return;
    }
    // Update month label
    const ml = $('cfMonthLabel');
    if (ml) {
      const d = new Date(ST.month+'-15');
      ml.textContent = d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
    }
    try {
      const data = await loadData();
      root.innerHTML = buildPage(data);
      bindEvents();
      renderActiveTab();
      updateAIContext(data);
    } catch(e) {
      root.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--danger)"><i class="fas fa-exclamation-triangle"></i> Erro: ${esc(e.message)}</div>`;
      console.error('[CF3]', e);
    }
  }

  /* ── Estrutura da página ── */
  function buildPage(data) {
    const { catData, cI, cE, pE, anomalies } = data;
    const saved = cI - cE;
    const pctSaved = cI>0 ? Math.round(saved/cI*100) : 0;
    const totalLimit = catData.reduce((s,d)=>s+(d.limit||0),0);
    const pctUsed = totalLimit>0 ? Math.round(cE/totalLimit*100) : 0;

    return `
    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.65rem;margin-bottom:1rem">
      ${kpi('Receitas',cI,'var(--success)','fa-arrow-down')}
      ${kpi('Despesas',cE,'var(--danger)','fa-arrow-up')}
      ${kpi('Saldo',saved,saved>=0?'var(--success)':'var(--danger)','fa-wallet')}
      ${kpi('Poupança',pctSaved+'%',pctSaved>=20?'var(--success)':'var(--warning)','fa-piggy-bank',true)}
      ${totalLimit>0?kpi('Orçado',pctUsed+'%',pctUsed>=100?'var(--danger)':pctUsed>=80?'var(--warning)':'var(--success)','fa-chart-pie',true):''}
    </div>

    <!-- Alertas de anomalia -->
    ${anomalies.length?`
    <div style="background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.25);border-radius:10px;padding:.75rem 1rem;margin-bottom:1rem;display:flex;align-items:flex-start;gap:.5rem">
      <i class="fas fa-exclamation-triangle" style="color:var(--danger);margin-top:2px;flex-shrink:0"></i>
      <div><strong style="font-size:.85rem;color:var(--danger)">Gastos anômalos detectados:</strong>
      ${anomalies.map(d=>`<span style="font-size:.8rem;color:var(--txt2)"> ${esc(d.cat.name)} (${fmt(d.curSpent)} — ${Math.round(d.curSpent/d.prevSpent*100-100)}% acima do mês anterior)</span>`).join('')}
      </div>
    </div>`:''}

    <!-- Tabs -->
    <div style="display:flex;gap:.3rem;margin-bottom:.85rem;border-bottom:1px solid var(--bdr);padding-bottom:0">
      <button class="cf-tab ${ST.tab==='cat'?'cf-tab-active':''}" onclick="CF3.tab('cat',this)">
        <i class="fas fa-th-large"></i> Categorias
      </button>
      <button class="cf-tab ${ST.tab==='rules'?'cf-tab-active':''}" onclick="CF3.tab('rules',this)">
        <i class="fas fa-filter"></i> Regras
        <span style="background:var(--accent);color:#fff;border-radius:99px;padding:1px 7px;font-size:.65rem;font-weight:700;margin-left:.3rem">${ST.rules.length||0}</span>
      </button>
      <button class="cf-tab ${ST.tab==='ovw'?'cf-tab-active':''}" onclick="CF3.tab('ovw',this)">
        <i class="fas fa-chart-pie"></i> Visão Geral
      </button>
    </div>

    <!-- Ferramentas de filtro/busca -->
    <div id="cfToolbar" style="display:flex;gap:.5rem;margin-bottom:.75rem;flex-wrap:wrap;align-items:center">
      <input type="search" id="cfSearch" class="form-inp" placeholder="Buscar categoria ou favorecido..."
        style="flex:1;min-width:180px;font-size:.82rem" oninput="CF3.search(this.value)">
      <select id="cfSort" class="form-inp" style="width:auto;font-size:.82rem" onchange="CF3.sort(this.value)">
        <option value="spent">Maior gasto</option>
        <option value="pct">% do limite</option>
        <option value="name">Nome</option>
        <option value="alert">Alertas primeiro</option>
      </select>
      <button class="btn btn-outline btn-sm" style="font-size:.78rem" onclick="CF3.openRuleModal()">
        <i class="fas fa-plus"></i> Nova Regra
      </button>
    </div>

    <!-- Zona das tabs -->
    <div id="cfTabContent"></div>

    <!-- Modal de regras (rico) -->
    <div id="cfRuleModal" class="modal-overlay hidden"></div>
    `;
  }

  function kpi(label, val, color, icon, isText=false) {
    return `<div class="card" style="padding:.75rem;display:flex;flex-direction:column;gap:.2rem">
      <div style="font-size:.68rem;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.4px;display:flex;align-items:center;gap:.3rem">
        <i class="fas ${icon}" style="color:${color}"></i> ${label}
      </div>
      <div style="font-size:1.35rem;font-weight:800;font-family:var(--font-h);color:${color}">
        ${isText ? val : fmt(typeof val==='number'?val:0)}
      </div>
    </div>`;
  }

  /* ── Tabs ── */
  function renderActiveTab() {
    const el = $('cfTabContent');
    if (!el || !ST._data) return;
    if (ST.tab === 'cat')   el.innerHTML = renderCatTab(ST._data);
    if (ST.tab === 'rules') el.innerHTML = renderRulesTab();
    if (ST.tab === 'ovw')   el.innerHTML = renderOvwTab(ST._data);
    if (ST.tab === 'cat')   bindCatEvents();
  }

  /* ── Tab Categorias ── */
  function renderCatTab(data) {
    const { catData } = data;
    if (!catData.length) return '<p style="color:var(--txt2);padding:1rem">Sem categorias de despesa. Crie categorias primeiro.</p>';
    return catData.map(d => renderCard(d)).join('');
  }

  function renderCard(d) {
    const { cat, curSpent, prevSpent, limit, pct, payees, alert, txs } = d;
    const isExpanded = ST.expanded.has(String(cat.id));
    const barClr = alert==='danger'?'var(--danger)':alert==='warning'?'var(--warning)':'var(--success)';
    const trend = prevSpent>0 ? ((curSpent-prevSpent)/prevSpent*100).toFixed(0) : null;

    return `<div class="cf-card ${isExpanded?'cf-card-open':''}" id="cfcard-${cat.id}">
      <!-- Card header (sempre visível) -->
      <div class="cf-card-hdr" onclick="CF3.toggle('${cat.id}')">
        <div style="display:flex;align-items:center;gap:.65rem;flex:1;min-width:0">
          <div style="width:34px;height:34px;border-radius:9px;background:${cat.color||'var(--accent)'};
               display:flex;align-items:center;justify-content:center;color:#fff;font-size:.8rem;flex-shrink:0">
            <i class="fas ${cat.icon||'fa-tag'}"></i>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:.88rem;font-weight:600;display:flex;align-items:center;gap:.3rem;flex-wrap:wrap">
              ${esc(cat.name)}
              ${alert?`<span style="font-size:.62rem;padding:1px 7px;border-radius:99px;background:var(--${alert});color:#fff">${alert==='danger'?'ESTOURADO':'⚠ '+pct+'%'}</span>`:''}
              ${trend&&trend>25?`<span style="font-size:.65rem;color:var(--danger);font-weight:700">↑${trend}%</span>`:''}
              ${trend&&trend<-10?`<span style="font-size:.65rem;color:var(--success);font-weight:700">↓${Math.abs(trend)}%</span>`:''}
            </div>
            <div style="font-size:.73rem;color:var(--txt2)">${txs.length} tx · ${payees.length} favorecido${payees.length!==1?'s':''}</div>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:1.1rem;font-weight:800;font-family:var(--font-h);color:${barClr}">${fmt(curSpent)}</div>
          ${limit>0?`<div style="font-size:.72rem;color:var(--txt2)">/ ${fmt(limit)}</div>`:''}
        </div>
        <i class="fas fa-chevron-${isExpanded?'up':'down'}" style="color:var(--txt2);font-size:.75rem;margin-left:.5rem;flex-shrink:0"></i>
      </div>

      <!-- Barra de progresso -->
      ${limit>0?`
      <div style="height:5px;background:var(--bdr);border-radius:3px;overflow:hidden;margin:0 0 .5rem 0">
        <div style="width:${Math.min(100,pct)}%;height:100%;background:${barClr};border-radius:3px;transition:width .5s"></div>
      </div>`:''}

      <!-- Conteúdo expandido -->
      ${isExpanded?`
      <div class="cf-card-body">
        <!-- Resumo -->
        <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:.85rem">
          <div style="font-size:.78rem;color:var(--txt2)">Total: <strong style="color:var(--txt)">${fmt(curSpent)}</strong></div>
          ${txs.length?`<div style="font-size:.78rem;color:var(--txt2)">Média: <strong style="color:var(--txt)">${fmt(curSpent/txs.length)}/tx</strong></div>`:''}
          ${limit>0&&curSpent<limit?`<div style="font-size:.78rem;color:var(--success)">✓ Restam ${fmt(limit-curSpent)}</div>`:''}
          ${prevSpent?`<div style="font-size:.78rem;color:var(--txt2)">Mês ant.: <strong>${fmt(prevSpent)}</strong></div>`:''}
        </div>

        <!-- Favorecidos com ações -->
        <div style="font-size:.72rem;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:.4rem">
          Favorecidos
          <button class="btn btn-ghost btn-sm" style="font-size:.68rem;padding:2px 8px;margin-left:.4rem;float:right"
            onclick="CF3.selectAllPayees('${cat.id}')">Selecionar todos</button>
        </div>
        <div id="payees-${cat.id}">
        ${payees.map(([name,val])=>`
          <div style="display:flex;align-items:center;gap:.4rem;padding:.4rem 0;border-bottom:1px solid var(--bdr)">
            <input type="checkbox" id="pay-${cat.id}-${btoa(encodeURIComponent(name)).slice(0,8)}"
              class="payee-cb" data-cat="${cat.id}" data-desc="${esc(name)}"
              style="flex-shrink:0;width:15px;height:15px;cursor:pointer">
            <span style="flex:1;font-size:.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</span>
            <span style="font-size:.8rem;font-weight:700;color:var(--txt);flex-shrink:0">${fmt(val)}</span>
            <span style="font-size:.68rem;color:var(--txt2);flex-shrink:0">${pct(val,curSpent)}%</span>
            <button class="btn btn-ghost btn-sm" style="font-size:.65rem;padding:2px 6px;flex-shrink:0"
              onclick="CF3.movePayee('${cat.id}','${esc(name)}')" title="Mover para outra categoria">
              <i class="fas fa-exchange-alt"></i>
            </button>
            <button class="btn btn-ghost btn-sm" style="font-size:.65rem;padding:2px 6px;flex-shrink:0"
              onclick="CF3.makeFuzzyRule('${cat.id}','${esc(name)}')" title="Criar regra">
              <i class="fas fa-magic"></i>
            </button>
          </div>`).join('')}
        </div>

        <!-- Ações em lote para selecionados -->
        <div id="batch-${cat.id}" style="display:none;margin-top:.5rem;padding:.5rem;background:var(--bg-s);border-radius:8px">
          <span id="batch-count-${cat.id}" style="font-size:.78rem;color:var(--txt2)">0 selecionados</span>
          <button class="btn btn-outline btn-sm" style="font-size:.73rem;margin-left:.5rem"
            onclick="CF3.batchMove('${cat.id}')"><i class="fas fa-exchange-alt"></i> Mover para...</button>
          <button class="btn btn-ghost btn-sm" style="font-size:.73rem"
            onclick="CF3.batchRule('${cat.id}')"><i class="fas fa-magic"></i> Criar regra</button>
        </div>

        <!-- Limit inline -->
        <div style="display:flex;gap:.5rem;align-items:center;margin-top:.75rem;flex-wrap:wrap">
          <label style="font-size:.78rem;color:var(--txt2)">Limite:</label>
          <input type="number" id="limit-${cat.id}" value="${limit||''}" min="0" step="10"
            class="form-inp" style="width:120px;font-size:.82rem"
            placeholder="Sem limite" onchange="CF3.saveLimit('${cat.id}',this.value)">
          ${limit>0?`<button class="btn btn-ghost btn-sm" style="font-size:.73rem;color:var(--danger)"
            onclick="CF3.removeLimit('${cat.id}')"><i class="fas fa-times"></i> Remover</button>`:''}
          <button class="btn btn-primary btn-sm" style="font-size:.73rem"
            onclick="CF3.saveLimit('${cat.id}',document.getElementById('limit-${cat.id}').value)">
            <i class="fas fa-save"></i> Salvar
          </button>
        </div>

        <!-- Mini Chart -->
        <div style="margin-top:.75rem;height:60px;position:relative">
          <canvas id="chart-${cat.id}" height="60"></canvas>
        </div>
      </div>`:''}
    </div>`;
  }

  /* ── Tab Regras ── */
  function renderRulesTab() {
    const rules = ST.rules || [];
    const typeIcon = { exact:'fa-equals', similar:'fa-spell-check', keyword:'fa-key' };
    const typeLabel = { exact:'Exata', similar:'Similar', keyword:'Palavra-chave' };
    const typeColor = { exact:'var(--success)', similar:'var(--warning)', keyword:'var(--accent)' };

    return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;flex-wrap:wrap;gap:.5rem">
      <div style="font-size:.82rem;color:var(--txt2)">${rules.length} regra${rules.length!==1?'s':''} ativa${rules.length!==1?'s':''}</div>
      <div style="display:flex;gap:.4rem">
        <button class="btn btn-outline btn-sm" style="font-size:.78rem" onclick="CF3.applyAllRules()">
          <i class="fas fa-play"></i> Aplicar a todas as transações
        </button>
        <button class="btn btn-primary btn-sm" style="font-size:.78rem" onclick="CF3.openRuleModal()">
          <i class="fas fa-plus"></i> Nova regra
        </button>
      </div>
    </div>
    ${!rules.length ? `
    <div style="text-align:center;padding:2rem;color:var(--txt2)">
      <i class="fas fa-filter" style="font-size:2rem;margin-bottom:.5rem;display:block;opacity:.3"></i>
      <div style="font-size:.88rem">Nenhuma regra criada ainda</div>
      <div style="font-size:.78rem;margin-top:.25rem">Regras categorizam transações automaticamente</div>
      <button class="btn btn-primary btn-sm" style="margin-top:.75rem" onclick="CF3.openRuleModal()">
        <i class="fas fa-plus"></i> Criar primeira regra
      </button>
    </div>` :
    `<div style="display:flex;flex-direction:column;gap:.4rem">
    ${rules.map(r=>{
      const cat = ST.cats.find(c=>String(c.id)===String(r.categoryId));
      const tipo = r.tipo||'exact';
      return `<div style="display:flex;align-items:center;gap:.6rem;padding:.6rem .75rem;background:var(--bg-s);border-radius:10px;border:1px solid var(--bdr)">
        <span style="font-size:.65rem;padding:2px 8px;border-radius:99px;background:${typeColor[tipo]};color:#fff;font-weight:700;flex-shrink:0">
          <i class="fas ${typeIcon[tipo]||'fa-filter'}"></i> ${typeLabel[tipo]||tipo}
        </span>
        <span style="font-size:.82rem;font-family:monospace;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.description||r.keyword||'')}</span>
        <span style="font-size:.8rem;display:flex;align-items:center;gap:.3rem;flex-shrink:0">
          <i class="fas fa-arrow-right" style="color:var(--txt2);font-size:.65rem"></i>
          <span style="color:${cat?.color||'var(--accent)'}"><i class="fas ${cat?.icon||'fa-tag'}"></i> ${esc(cat?.name||'?')}</span>
        </span>
        <button class="btn btn-ghost btn-sm" style="font-size:.68rem;color:var(--danger);padding:3px 8px;flex-shrink:0"
          onclick="CF3.deleteRule('${r.id}')"><i class="fas fa-trash"></i></button>
      </div>`;
    }).join('')}
    </div>`}`;
  }

  /* ── Tab Visão Geral 50/30/20 ── */
  function renderOvwTab(data) {
    const { catData, cI, cE } = data;
    if (!cI) return '<p style="color:var(--txt2);padding:1rem">Sem receitas registradas neste mês para calcular proporções.</p>';

    const total = cE;
    const pct50 = Math.round(cI * 0.5);
    const pct30 = Math.round(cI * 0.3);
    const pct20 = Math.round(cI * 0.2);

    const rows = catData.map(d => ({
      name: d.cat.name, color: d.cat.color||'var(--accent)', icon: d.cat.icon||'fa-tag',
      val: d.curSpent, pct: Math.round(d.curSpent/cI*100),
    })).filter(d=>d.val>0).sort((a,b)=>b.val-a.val);

    return `
    <div style="margin-bottom:1rem">
      <div style="font-size:.82rem;font-weight:600;color:var(--txt2);margin-bottom:.5rem">Regra 50/30/20 — baseada na receita de ${fmt(cI)}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-bottom:1rem">
        ${['50% Necessidades','30% Desejos','20% Poupança'].map((label,i)=>{
          const ideal=[pct50,pct30,pct20][i]; const clr=['var(--accent)','var(--warning)','var(--success)'][i];
          return `<div style="padding:.6rem;background:var(--bg-s);border-radius:10px;text-align:center">
            <div style="font-size:.72rem;color:var(--txt2)">${label}</div>
            <div style="font-size:1rem;font-weight:800;font-family:var(--font-h);color:${clr}">${fmt(ideal)}</div>
          </div>`;
        }).join('')}
      </div>

      <div style="font-size:.8rem;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:.4rem">Distribuição por categoria</div>
      ${rows.map(r=>`
      <div style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;border-bottom:1px solid var(--bdr)">
        <div style="width:24px;height:24px;border-radius:7px;background:${r.color};
             display:flex;align-items:center;justify-content:center;color:#fff;font-size:.65rem;flex-shrink:0">
          <i class="fas ${r.icon}"></i>
        </div>
        <span style="flex:1;font-size:.82rem">${esc(r.name)}</span>
        <div style="flex:2;min-width:60px">
          <div style="height:5px;background:var(--bdr);border-radius:3px;overflow:hidden">
            <div style="width:${Math.min(100,r.pct)}%;height:100%;background:${r.color};border-radius:3px"></div>
          </div>
        </div>
        <span style="font-size:.78rem;font-weight:700;color:var(--txt);width:60px;text-align:right">${fmt(r.val)}</span>
        <span style="font-size:.72rem;color:var(--txt2);width:32px;text-align:right">${r.pct}%</span>
      </div>`).join('')}
      <div style="margin-top:.75rem;padding:.65rem;background:var(--bg-s);border-radius:8px;font-size:.8rem;color:var(--txt2)">
        <strong style="color:var(--txt)">Poupança efetiva:</strong> ${fmt(cI-total)} (${Math.round((cI-total)/cI*100)}%)
        — ${cI-total>=pct20?'<span style="color:var(--success)">✓ Acima da meta de 20%</span>':'<span style="color:var(--warning)">Meta: poupar mais '+fmt(pct20-(cI-total))+'</span>'}
      </div>
    </div>`;
  }

  /* ── Modal de nova regra (rico, sem prompt()) ── */
  function openRuleModal(prefill = {}) {
    const cats = ST.cats.filter(c=>c.type==='expense');
    const ruleTypes = [
      { value:'exact',   label:'Texto Exato',      icon:'fa-equals',     desc:'Categoriza transações com exatamente essa descrição' },
      { value:'similar', label:'Texto Similar',     icon:'fa-spell-check', desc:'Descrições com até 2 letras de diferença (fuzzy match)' },
      { value:'keyword', label:'Palavra-chave',     icon:'fa-key',        desc:'Qualquer transação que contenha a palavra' },
    ];

    const modal = $('cfRuleModal');
    if (!modal) return;
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="modal-hdr">
        <span class="modal-title"><i class="fas fa-magic" style="color:var(--accent)"></i> Nova Regra de Categorização</span>
        <button class="modal-close" onclick="CF3.closeRuleModal()">&times;</button>
      </div>
      <div style="padding:1rem">

        <!-- Tipo da regra -->
        <div style="font-size:.78rem;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:.4rem">Tipo de regra</div>
        <div style="display:flex;gap:.4rem;margin-bottom:1rem">
        ${ruleTypes.map(t=>`
          <label style="flex:1;cursor:pointer">
            <input type="radio" name="ruleType" value="${t.value}" ${(prefill.tipo||'exact')===t.value?'checked':''} style="display:none" onchange="CF3.ruleTypeChanged()">
            <div class="rule-type-card ${(prefill.tipo||'exact')===t.value?'rule-type-active':''}" data-val="${t.value}"
              style="padding:.5rem;border:2px solid var(--bdr);border-radius:9px;text-align:center;transition:all .15s">
              <i class="fas ${t.icon}" style="display:block;margin-bottom:.2rem;font-size:.95rem;color:var(--accent)"></i>
              <div style="font-size:.72rem;font-weight:700">${t.label}</div>
              <div style="font-size:.65rem;color:var(--txt2);margin-top:2px;line-height:1.2">${t.desc}</div>
            </div>
          </label>`).join('')}
        </div>

        <!-- Padrão -->
        <div style="margin-bottom:.75rem">
          <label style="font-size:.78rem;font-weight:700;color:var(--txt2);display:block;margin-bottom:.3rem">
            Padrão <span id="rulePatternHint" style="font-weight:400;color:var(--txt2)"></span>
          </label>
          <input type="text" id="rulePattern" class="form-inp" value="${esc(prefill.description||prefill.keyword||'')}"
            placeholder="Ex: UBER, PIX*, MERCADO PINGO..." oninput="CF3.rulePatternInput(this.value)">
          <div id="rulePreview" style="margin-top:.4rem;font-size:.77rem;color:var(--txt2)"></div>
        </div>

        <!-- Categoria destino -->
        <div style="margin-bottom:1rem">
          <label style="font-size:.78rem;font-weight:700;color:var(--txt2);display:block;margin-bottom:.3rem">Categoria destino</label>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:.3rem">
          ${cats.map(c=>`
            <label style="cursor:pointer">
              <input type="radio" name="ruleCat" value="${c.id}" ${String(prefill.categoryId)===String(c.id)?'checked':''} style="display:none">
              <div class="rule-cat-card" data-id="${c.id}"
                style="padding:.45rem .3rem;border:2px solid var(--bdr);border-radius:8px;text-align:center;transition:all .15s;font-size:.76rem">
                <i class="fas ${c.icon||'fa-tag'}" style="display:block;margin-bottom:2px;color:${c.color||'var(--accent)'}"></i>
                ${esc(c.name)}
              </div>
            </label>`).join('')}
          </div>
        </div>

        <!-- Impacto em tempo real -->
        <div id="ruleImpact" style="padding:.6rem;background:var(--bg-s);border-radius:8px;font-size:.78rem;color:var(--txt2);margin-bottom:.85rem">
          Escolha o padrão e a categoria para ver o impacto antes de salvar.
        </div>

        <!-- Botões -->
        <div style="display:flex;gap:.5rem">
          <button class="btn btn-ghost" style="flex:1" onclick="CF3.closeRuleModal()">Cancelar</button>
          <button class="btn btn-outline" style="flex:1" onclick="CF3.saveRule(false)">
            <i class="fas fa-save"></i> Salvar
          </button>
          <button class="btn btn-primary" style="flex:1" onclick="CF3.saveRule(true)">
            <i class="fas fa-play"></i> Salvar e aplicar
          </button>
        </div>
      </div>
    </div>`;

    // Bind radio clicks para highlight visual
    modal.querySelectorAll('input[name="ruleType"]').forEach(inp => {
      inp.addEventListener('change', () => {
        modal.querySelectorAll('.rule-type-card').forEach(c => c.classList.remove('rule-type-active'));
        modal.querySelector(`.rule-type-card[data-val="${inp.value}"]`)?.classList.add('rule-type-active');
        CF3.ruleTypeChanged();
      });
    });
    modal.querySelectorAll('input[name="ruleCat"]').forEach(inp => {
      inp.addEventListener('change', () => {
        modal.querySelectorAll('.rule-cat-card').forEach(c => { c.style.borderColor='var(--bdr)'; c.style.background=''; });
        const card = modal.querySelector(`.rule-cat-card[data-id="${inp.value}"]`);
        if (card) { card.style.borderColor='var(--accent)'; card.style.background='rgba(var(--accent-rgb),.08)'; }
        CF3.ruleImpactPreview();
      });
    });
    if (prefill.categoryId) {
      const card = modal.querySelector(`.rule-cat-card[data-id="${prefill.categoryId}"]`);
      if (card) { card.style.borderColor='var(--accent)'; card.style.background='rgba(var(--accent-rgb),.08)'; }
    }
    if (prefill.description) CF3.rulePatternInput(prefill.description);
    modal.onclick = e => { if(e.target===modal) CF3.closeRuleModal(); };

    // Injetar CSS do modal se necessário
    if (!document.getElementById('cf3-rule-style')) {
      const s=document.createElement('style'); s.id='cf3-rule-style';
      s.textContent=`.rule-type-active{border-color:var(--accent)!important;background:rgba(var(--accent-rgb),.08)}
      .cf-card{border:1px solid var(--bdr);border-radius:12px;margin-bottom:.6rem;overflow:hidden;transition:box-shadow .2s}
      .cf-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.08)}
      .cf-card-hdr{display:flex;align-items:center;gap:.6rem;padding:.8rem .9rem;cursor:pointer;user-select:none}
      .cf-card-hdr:hover{background:rgba(var(--accent-rgb),.03)}
      .cf-card-body{padding:.75rem .9rem;border-top:1px solid var(--bdr);background:var(--bg)}
      .cf-tab{padding:.5rem .9rem;border:none;border-bottom:2px solid transparent;background:none;color:var(--txt2);font-size:.84rem;font-weight:500;cursor:pointer;transition:all .15s}
      .cf-tab-active{color:var(--accent);border-bottom-color:var(--accent)}
      .cf-tab:hover{color:var(--txt)}`;
      document.head.appendChild(s);
    }
  }

  /* ── Bind events ── */
  function bindEvents() {
    // Nada extra além dos onclick inline
  }

  function bindCatEvents() {
    // Checkboxes de favorecidos → mostrar/ocultar batch actions
    document.querySelectorAll('.payee-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const catId = cb.dataset.cat;
        const checked = document.querySelectorAll(`.payee-cb[data-cat="${catId}"]:checked`).length;
        const batchEl = $(`batch-${catId}`);
        const countEl = $(`batch-count-${catId}`);
        if (batchEl) batchEl.style.display = checked > 0 ? 'block' : 'none';
        if (countEl) countEl.textContent = `${checked} selecionado${checked!==1?'s':''}`;
      });
    });
    // Mini charts para cards expandidos
    setTimeout(renderMiniCharts, 200);
  }

  function renderMiniCharts() {
    if (!window.Chart || !ST._data) return;
    ST._data.catData.forEach(d => {
      if (!ST.expanded.has(String(d.cat.id))) return;
      const canvas = document.getElementById(`chart-${d.cat.id}`);
      if (!canvas || canvas._chartInst) return;
      const days = d.days;
      const labels = Object.keys(days).sort();
      const vals = labels.map(k => days[k]);
      const maxVal = Math.max(...vals, 1);
      const ctx = canvas.getContext('2d');
      canvas._chartInst = new window.Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ data: vals, backgroundColor: d.cat.color||'var(--accent)', borderRadius: 4 }] },
        options: {
          responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { font: { size: 9 }, color: 'var(--txt2)' }, grid: { display: false } },
            y: { display: false, suggestedMax: maxVal * 1.1 },
          },
        },
      });
    });
  }

  /* ── Update AI context ── */
  function updateAIContext(data) {
    const { catData, cI, cE } = data;
    const lines = catData.filter(d=>d.curSpent>0).map(d => {
      const top3 = d.payees.slice(0,3).map(([n,v])=>`${n}:${fmt(v)}`).join(', ');
      return `${d.cat.name}: gasto=${fmt(d.curSpent)}${d.limit?`, limite=${fmt(d.limit)}, ${d.pct}% usado`:''}${top3?`, top: ${top3}`:''}${d.alert?`, ⚠ ${d.alert.toUpperCase()}`:''}`;
    });
    const ctx = `Mês ${data.month}: receita=${fmt(cI)}, despesas=${fmt(cE)}, poupança=${fmt(cI-cE)}\n`+lines.join('\n');
    window.FP_BUDGET_CONTEXT_TEXT = ctx;
    window.FP_BUDGET_CONTEXT = data;
  }

  /* ═══════════════════════════════════════════════════════════
     API PÚBLICA — exposta como window.CF3
  ═══════════════════════════════════════════════════════════ */
  const CF3 = {
    load,
    tab(name, btn) {
      ST.tab = name;
      document.querySelectorAll('.cf-tab').forEach(b => b.classList.remove('cf-tab-active'));
      if(btn) btn.classList.add('cf-tab-active');
      renderActiveTab();
    },
    toggle(catId) {
      const id = String(catId);
      if (ST.expanded.has(id)) ST.expanded.delete(id);
      else ST.expanded.add(id);
      renderActiveTab();
    },
    search(q) {
      const val = norm(q);
      if (!ST._data) return;
      const filtered = val ? {
        ...ST._data,
        catData: ST._data.catData.filter(d =>
          norm(d.cat.name).includes(val) ||
          d.payees.some(([n]) => norm(n).includes(val))
        )
      } : ST._data;
      const el = $('cfTabContent');
      if (el && ST.tab === 'cat') el.innerHTML = renderCatTab(filtered);
      bindCatEvents();
    },
    sort(by) {
      if (!ST._data) return;
      const sorted = [...ST._data.catData];
      if (by==='spent') sorted.sort((a,b)=>b.curSpent-a.curSpent);
      if (by==='pct')   sorted.sort((a,b)=>b.pct-a.pct);
      if (by==='name')  sorted.sort((a,b)=>a.cat.name.localeCompare(b.cat.name));
      if (by==='alert') sorted.sort((a,b)=>(b.alert==='danger'?2:b.alert==='warning'?1:0)-(a.alert==='danger'?2:a.alert==='warning'?1:0));
      const el = $('cfTabContent');
      if (el && ST.tab==='cat') { el.innerHTML = renderCatTab({...ST._data, catData: sorted}); bindCatEvents(); }
    },
    async saveLimit(catId, rawVal) {
      const val = parseFloat(String(rawVal).replace(',','.'));
      if (isNaN(val) || val < 0) { T('Valor inválido','error'); return; }
      await BudgetPro._saveBudget(catId, val);
      await load(ST.month);
    },
    async removeLimit(catId) {
      await BudgetPro._removeBudget(catId);
      await load(ST.month);
    },
    async movePayee(catId, desc) {
      const cats = ST.cats.filter(c=>c.type==='expense'&&String(c.id)!==String(catId));
      if (!cats.length) { T('Sem outras categorias','warning'); return; }
      const options = cats.map((c,i)=>`${i+1}. ${c.name}`).join('\n');
      const input = prompt(`Mover "${desc}" para:\n${options}`);
      if (!input) return;
      const idx = parseInt(input)-1;
      if (isNaN(idx)||!cats[idx]) return;
      await BudgetPro._quickMoveDesc(desc, catId);
    },
    async makeFuzzyRule(catId, desc) {
      this.openRuleModal({ description: desc, categoryId: catId, tipo: 'similar' });
    },
    async batchMove(catId) {
      const selected = [...document.querySelectorAll(`.payee-cb[data-cat="${catId}"]:checked`)].map(cb=>cb.dataset.desc);
      if (!selected.length) { T('Nenhum selecionado','warning'); return; }
      const cats = ST.cats.filter(c=>c.type==='expense'&&String(c.id)!==String(catId));
      const options = cats.map((c,i)=>`${i+1}. ${c.name}`).join('\n');
      const input = prompt(`Mover ${selected.length} favorecido(s) para:\n${options}`);
      if (!input) return;
      const idx = parseInt(input)-1;
      if (isNaN(idx)||!cats[idx]) return;
      for (const desc of selected) await BudgetPro._quickMoveDesc(desc, catId);
      T(`${selected.length} favorecido(s) movido(s)`, 'success');
      await load(ST.month);
    },
    async batchRule(catId) {
      const selected = [...document.querySelectorAll(`.payee-cb[data-cat="${catId}"]:checked`)].map(cb=>cb.dataset.desc);
      if (!selected.length) return;
      // Cria regras exatas para cada selecionado
      for (const desc of selected) {
        if (window.db.userRules) {
          const existing = await window.db.userRules?.where('userId').equals(window.S.user.id).toArray().catch(()=>[]) || [];
            const exists = existing.find(r=>r.description===desc);
          if (!exists) await dbRulesAdd({ userId:window.S.user.id, description:desc, categoryId:catId, tipo:'exact', createdAt:new Date().toISOString() }).catch(()=>{});
        }
      }
      T(`${selected.length} regra(s) criada(s)`, 'success');
      ST.rules = await dbRules(window.S.user.id);
    },
    selectAllPayees(catId) {
      const cbs = document.querySelectorAll(`.payee-cb[data-cat="${catId}"]`);
      const allChecked = [...cbs].every(cb=>cb.checked);
      cbs.forEach(cb=>{cb.checked=!allChecked;cb.dispatchEvent(new Event('change'));});
    },
    openRuleModal, closeRuleModal() { const m=$('cfRuleModal'); if(m){m.style.display='none';m.innerHTML='';} },
    ruleTypeChanged() {
      const type = document.querySelector('input[name="ruleType"]:checked')?.value||'exact';
      const hint = $('rulePatternHint');
      if (hint) hint.textContent = type==='keyword'?'(qualquer palavra)':type==='similar'?'(até 2 letras de diferença)':'(correspondência exata)';
      this.ruleImpactPreview();
    },
    rulePatternInput(val) {
      clearTimeout(this._ruleInputTimer);
      this._ruleInputTimer = setTimeout(() => this.ruleImpactPreview(), 300);
    },
    async ruleImpactPreview() {
      const pattern = $('rulePattern')?.value?.trim();
      const catId = document.querySelector('input[name="ruleCat"]:checked')?.value;
      const type = document.querySelector('input[name="ruleType"]:checked')?.value||'exact';
      const impactEl = $('ruleImpact');
      if (!impactEl||!pattern) return;
      if (!catId) { impactEl.textContent='Escolha uma categoria para ver o impacto.'; return; }

      const uid = window.S?.user?.id;
      if (!uid) return;
      const allTxs = await window.db.transactions.where('userId').equals(uid).toArray();
      const normPat = norm(pattern);
      const matches = allTxs.filter(t => {
        const d = norm(t.description||'');
        if (type==='exact') return d===normPat;
        if (type==='similar') return levenshtein(d,normPat)<=2;
        if (type==='keyword') return d.includes(normPat);
        return false;
      });
      const inWrongCat = matches.filter(t=>String(t.categoryId)!==String(catId));
      const cat = ST.cats.find(c=>String(c.id)===String(catId));
      impactEl.innerHTML = matches.length
        ? `<span style="color:var(--success)"><i class="fas fa-check-circle"></i></span> 
           <strong>${matches.length}</strong> transação(ões) encontrada(s).
           ${inWrongCat.length?`<span style="color:var(--warning)"> ${inWrongCat.length} serão movidas para ${esc(cat?.name||'?')}.</span>`:' Já na categoria correta.'}
           Valor total: <strong>${fmt(matches.reduce((s,t)=>s+t.amount,0))}</strong>`
        : '<i class="fas fa-info-circle"></i> Nenhuma transação encontrada com esse padrão.';
    },
    async saveRule(applyNow) {
      const pattern = $('rulePattern')?.value?.trim();
      const catId = document.querySelector('input[name="ruleCat"]:checked')?.value;
      const type = document.querySelector('input[name="ruleType"]:checked')?.value||'exact';
      if (!pattern||!catId) { T('Preencha padrão e categoria','error'); return; }
      const uid = window.S?.user?.id;
      if (!uid) return;

      const ruleData = { userId:uid, description:pattern, keyword:pattern, categoryId:parseInt(catId), tipo:type, createdAt:new Date().toISOString() };
      try {
        await dbRulesAdd(ruleData);
        T('Regra criada com sucesso', 'success');
      } catch(e) { T('Erro ao salvar regra: '+e.message,'error'); return; }

      if (applyNow) {
        const allTxs = await window.db.transactions.where('userId').equals(uid).toArray();
        const normPat = norm(pattern);
        let count = 0;
        for (const t of allTxs) {
          const d = norm(t.description||'');
          const matches = type==='exact'?d===normPat:type==='similar'?levenshtein(d,normPat)<=2:d.includes(normPat);
          if (matches && String(t.categoryId)!==String(catId)) {
            await window.db.transactions.update(t.id, { categoryId: parseInt(catId) });
            count++;
          }
        }
        T(`Regra criada e ${count} transação(ões) recategorizadas`, 'success');
        if (typeof window.LocalAI?.trainFromHistory === 'function')
          setTimeout(()=>window.LocalAI.trainFromHistory().catch(()=>{}), 800);
      } else T('Regra criada com sucesso', 'success');

      this.closeRuleModal();
      ST.rules = await dbRules(uid);
      await load(ST.month);
    },
    async deleteRule(id) {
      if (!confirm('Remover esta regra?')) return;
      await dbRulesDelete(parseInt(id));
      T('Regra removida', 'info');
      ST.rules = await dbRules(window.S?.user?.id || '').catch(()=>[]) || [];
      renderActiveTab();
    },
    async applyAllRules() {
      if (!ST.rules.length) { T('Nenhuma regra definida','warning'); return; }
      const uid = window.S?.user?.id;
      const allTxs = await window.db.transactions.where('userId').equals(uid).toArray();
      let total = 0;
      for (const rule of ST.rules) {
        const normPat = norm(rule.description||rule.keyword||'');
        for (const t of allTxs) {
          const d = norm(t.description||'');
          const matches = rule.tipo==='exact'?d===normPat:rule.tipo==='similar'?levenshtein(d,normPat)<=2:d.includes(normPat);
          if (matches && String(t.categoryId)!==String(rule.categoryId)) {
            await window.db.transactions.update(t.id, { categoryId: rule.categoryId });
            total++;
          }
        }
      }
      T(`${total} transação(ões) recategorizadas com ${ST.rules.length} regra(s)`, 'success');
      if (typeof window.LocalAI?.trainFromHistory === 'function')
        setTimeout(()=>window.LocalAI.trainFromHistory().catch(()=>{}), 500);
      await load(ST.month);
    },
  };

  /* ── Expor globalmente ── */
  window.CF3 = CF3;
  window.loadControleFinanceiro = () => CF3.load(window.cfCurrentMonth || ST.month);

  /* ── Mudança de mês ── */
  window.cfChangeMonth = (dir) => {
    const d = new Date(ST.month+'-15');
    d.setMonth(d.getMonth()+dir);
    ST.month = d.toISOString().slice(0,7);
    CF3.load(ST.month);
  };

  // Navigate handled by app.js loaders

  /* ── Briefing IA ── */
  window.cfBriefingIA = function() {
    const ctx = window.FP_BUDGET_CONTEXT_TEXT || 'Sem dados financeiros carregados.';
    if (typeof window.FinBot?.send === 'function') {
      window.FinBot.open().then(() => window.FinBot.send('Análise completa das minhas finanças: ' + ctx.slice(0,600)));
    } else if (typeof window.FP_AI_PRO?.Chat?.open === 'function') {
      window.FP_AI_PRO.Chat.open();
      setTimeout(() => window.FP_AI_PRO.Chat.send('Análise completa: ' + ctx.slice(0,600)), 500);
    } else T('Abra o assistente IA e pergunte sobre seus dados', 'info');
  };

})();
