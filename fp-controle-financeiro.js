/* ═══════════════════════════════════════════════════════════════════════════
   FinancePro — CONTROLE FINANCEIRO INTELIGENTE v2.0  (reescrita definitiva)
   ───────────────────────────────────────────────────────────────────────────
   Substitui loadBudgets() e renderiza a página completa com:
   ✓ Cards expansíveis por categoria (colapsado / expandido)
   ✓ Totais enviado + recebido + tendência vs mês anterior
   ✓ Barra de limite colorida (verde → amarelo → laranja → vermelho)
   ✓ Lista de favorecidos/descrições com checkbox (incluir/excluir da cat.)
   ✓ Fuzzy Match Levenshtein ≤ 2 com dropdown de sugestões
   ✓ Mini-gráfico diário (Chart.js)
   ✓ Aba Regras de Classificação (CRUD: Exata / Similar / Palavra-chave)
   ✓ Widget de Anomalias (gasto > 2σ da média histórica)
   ✓ Contexto enriquecido injetado automaticamente no chat da IA
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── utilitários ─── */
  const $ = id => document.getElementById(id);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const fmtM = v => (typeof window.fmtCurrency === 'function') ? window.fmtCurrency(v) : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
  const T = (msg, type='info', ms=3500) => typeof window.toast==='function' && window.toast(msg, type, ms);
  const mkStr = (d=new Date()) => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  const deb = (fn,ms) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };

  function ready() { return typeof window.db!=='undefined' && typeof window.S!=='undefined' && window.S?.user; }
  function waitApp(max=25000) {
    return new Promise((res,rej)=>{
      const t0=Date.now();
      (function tick(){ if(ready()) return res(); if(Date.now()-t0>max) return rej(); setTimeout(tick,250); })();
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     LEVENSHTEIN
  ═══════════════════════════════════════════════════════════════════════ */
  function lev(a,b){
    a=String(a).toLowerCase(); b=String(b).toLowerCase();
    if(!a.length) return b.length; if(!b.length) return a.length;
    const R=Array.from({length:b.length+1},(_,i)=>[i]);
    for(let j=0;j<=a.length;j++) R[0][j]=j;
    for(let i=1;i<=b.length;i++) for(let j=1;j<=a.length;j++)
      R[i][j]=b[i-1]===a[j-1]?R[i-1][j-1]:1+Math.min(R[i-1][j],R[i][j-1],R[i-1][j-1]);
    return R[b.length][a.length];
  }
  function normS(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim(); }
  function isFuzzy(a,b,d=2){
    const na=normS(a).slice(0,28), nb=normS(b).slice(0,28);
    if(!na||!nb) return false;
    if(na===nb) return true;
    if(Math.min(na.length,nb.length)<=4) return na===nb;
    if(lev(na,nb)<=d) return true;
    const wa=na.split(' ').filter(w=>w.length>=4);
    const wb=new Set(nb.split(' ').filter(w=>w.length>=4));
    return wa.filter(w=>wb.has(w)).length>=2;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PERSISTÊNCIA
  ═══════════════════════════════════════════════════════════════════════ */
  const KEY_CFG   = 'cf2_catCfg';   // { [catId]: { includedDescs:string[]|null, limit:number } }
  const KEY_RULES = 'cf2_rules';    // [{ id, type:'exact'|'similar'|'keyword', pattern, categoryId, catName, createdAt }]

  async function loadCfg()  { return (await window.getSetting(window.S.user.id, KEY_CFG,  {}))  || {}; }
  async function loadRules(){ return (await window.getSetting(window.S.user.id, KEY_RULES,[]))  || []; }
  async function saveCfg(v) { await window.setSetting(window.S.user.id, KEY_CFG,  v); }
  async function saveRules(v){ await window.setSetting(window.S.user.id, KEY_RULES, v); }

  /* ═══════════════════════════════════════════════════════════════════════
     ESTADO
  ═══════════════════════════════════════════════════════════════════════ */
  const ST = {
    month   : mkStr(),
    cats    : [],
    allTxs  : [],
    curTxs  : [],
    prevTxs : [],
    budgets : [],
    cfg     : {},
    rules   : [],
    expanded: new Set(),
    charts  : {},          // catId → Chart instance
    _filter : 'all',
  };

  /* ═══════════════════════════════════════════════════════════════════════
     CÁLCULOS
  ═══════════════════════════════════════════════════════════════════════ */
  function filterRows(catId, txs) {
    const inc = ST.cfg[String(catId)]?.includedDescs;
    let rows = txs.filter(t => t.categoryId===catId);
    if (Array.isArray(inc) && inc.length)
      rows = rows.filter(t => inc.some(d => normS(d)===normS(t.description)));
    return rows;
  }

  function sums(txs) {
    return {
      exp : txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0),
      inc : txs.filter(t=>t.type==='income' ).reduce((s,t)=>s+t.amount,0),
      cnt : txs.length,
    };
  }

  function groupByDesc(txs) {
    const m={};
    txs.forEach(t=>{
      const k=normS(t.description)||'(sem descrição)';
      if(!m[k]) m[k]={norm:k, orig:t.description||'', exp:0, inc:0, cnt:0};
      if(t.type==='expense') m[k].exp+=t.amount; else m[k].inc+=t.amount;
      m[k].cnt++;
    });
    return Object.values(m).sort((a,b)=>(b.exp+b.inc)-(a.exp+a.inc));
  }

  function dailyArr(txs, monthStr) {
    const [y,m]=monthStr.split('-').map(Number);
    const days=new Date(y,m,0).getDate();
    const arr=Array(days).fill(0);
    txs.forEach(t=>{ if(t.type!=='expense') return; const d=parseInt(t.date.split('-')[2],10)-1; if(d>=0&&d<days) arr[d]+=t.amount; });
    return arr;
  }

  async function detectAnomalies() {
    const alerts=[];
    for(const cat of ST.cats.filter(c=>c.type==='expense')){
      const hist=[];
      for(let i=1;i<=6;i++){
        const d=new Date(ST.month+'-15'); d.setMonth(d.getMonth()-i);
        const mk=mkStr(d);
        hist.push(ST.allTxs.filter(t=>t.categoryId===cat.id&&t.type==='expense'&&t.date.startsWith(mk)).reduce((s,t)=>s+t.amount,0));
      }
      const mean=hist.reduce((s,v)=>s+v,0)/hist.length;
      if(mean<10) continue;
      const std=Math.sqrt(hist.reduce((s,v)=>s+Math.pow(v-mean,2),0)/hist.length);
      const spent=sums(filterRows(cat.id,ST.curTxs)).exp;
      if(std>0&&spent>mean+2*std) alerts.push({cat,spent,mean,pct:Math.round((spent-mean)/mean*100)});
    }
    return alerts;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     LOAD PRINCIPAL
  ═══════════════════════════════════════════════════════════════════════ */
  async function load(monthStr) {
    if(!window.S?.user) return;
    const uid=window.S.user.id;
    ST.month=monthStr;
    ST.cats=window.S.cats?.length
      ? window.S.cats
      : await window.db.categories.where('userId').equals(uid).toArray();

    const [allTxs,budgets,cfg,rules]=await Promise.all([
      window.db.transactions.where('userId').equals(uid).toArray(),
      window.db.budgets.where('userId').equals(uid).filter(b=>b.monthYear===monthStr).toArray(),
      loadCfg(), loadRules(),
    ]);
    ST.allTxs=allTxs;
    ST.curTxs=allTxs.filter(t=>t.date.startsWith(monthStr));
    ST.budgets=budgets; ST.cfg=cfg; ST.rules=rules;
    const pd=new Date(monthStr+'-15'); pd.setMonth(pd.getMonth()-1);
    ST.prevTxs=allTxs.filter(t=>t.date.startsWith(mkStr(pd)));

    renderPage();
    buildAICtx();
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER PRINCIPAL (síncrono para não ter race conditions)
  ═══════════════════════════════════════════════════════════════════════ */
  function renderPage() {
    const zone=$('cfPageZone');
    if(!zone){ console.warn('[CF] #cfPageZone não encontrado'); return; }

    const {cats,curTxs,prevTxs}=ST;
    const catIdName=Object.fromEntries(cats.map(c=>[c.id,c.name]));
    const totInc=curTxs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const totExp=curTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const saldo=totInc-totExp;
    const savRate=totInc>0?Math.max(0,saldo/totInc*100):0;

    const NEEDS=new Set(['Moradia','Alimentação','Saúde','Transporte','Serviços','Taxas/Impostos']);
    const WANTS=new Set(['Lazer','Compras','Assinaturas','Beleza e Cuidados','Tecnologia','Pets']);
    let needsAmt=0,wantsAmt=0;
    curTxs.forEach(t=>{
      if(t.type!=='expense') return;
      const n=catIdName[t.categoryId]||'';
      if(NEEDS.has(n)) needsAmt+=t.amount; else if(WANTS.has(n)) wantsAmt+=t.amount;
    });

    // Detecta anomalias de forma síncrona (versão rápida)
    const anomalyCards=cats.filter(c=>{
      if(c.type!=='expense') return false;
      const spent=sums(filterRows(c.id,curTxs)).exp;
      const hist=[];
      for(let i=1;i<=6;i++){const d=new Date(ST.month+'-15');d.setMonth(d.getMonth()-i);const mk=mkStr(d);hist.push(ST.allTxs.filter(t=>t.categoryId===c.id&&t.type==='expense'&&t.date.startsWith(mk)).reduce((s,t)=>s+t.amount,0));}
      const mean=hist.reduce((s,v)=>s+v,0)/hist.length;
      if(mean<10) return false;
      const std=Math.sqrt(hist.reduce((s,v)=>s+Math.pow(v-mean,2),0)/hist.length);
      return std>0&&spent>mean+2*std;
    });

    // Monta HTML por partes para evitar template aninhado
    let html='';

    // ── KPIs ──
    html+=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:.6rem;margin-bottom:1rem">`;
    html+=kpiHTML('fa-arrow-down','Receita',fmtM(totInc),'var(--success)','rgba(16,185,129,.1)');
    html+=kpiHTML('fa-arrow-up','Despesa',fmtM(totExp),'var(--danger)','rgba(239,68,68,.1)');
    html+=kpiHTML('fa-balance-scale','Saldo',fmtM(saldo),saldo>=0?'var(--accent)':'var(--danger)','rgba(var(--accent-rgb),.1)');
    html+=kpiHTML('fa-piggy-bank','Poupança',savRate.toFixed(1)+'%',savRate>=20?'var(--success)':savRate>=10?'var(--warning)':'var(--danger)','rgba(59,130,246,.1)');
    html+=kpiHTML('fa-receipt','Lançamentos',String(curTxs.length),'var(--warning)','rgba(245,158,11,.1)');
    html+=`</div>`;

    // ── 50/30/20 ──
    html+=rule5020HTML(totInc,needsAmt,wantsAmt,saldo);

    // ── Anomalias ──
    if(anomalyCards.length){
      html+=`<div style="margin-bottom:1rem">`;
      anomalyCards.forEach(c=>{
        const spent=sums(filterRows(c.id,curTxs)).exp;
        html+=`<div onclick="window.cfToggleCard(${c.id})" style="display:flex;align-items:center;gap:.75rem;padding:.7rem 1rem;background:rgba(239,68,68,.06);border:1.5px solid rgba(239,68,68,.2);border-radius:10px;margin-bottom:.5rem;cursor:pointer;flex-wrap:wrap">
          <span style="font-size:1.1rem">🚨</span>
          <div style="flex:1;min-width:150px">
            <strong style="font-size:.87rem;color:var(--danger)">${esc(c.name)} — acima da média histórica</strong>
            <div style="font-size:.77rem;color:var(--txt2)">Gasto atual: <strong>${fmtM(spent)}</strong></div>
          </div>
          <span style="font-size:.75rem;color:var(--txt2)">Ver detalhes →</span>
        </div>`;
      });
      html+=`</div>`;
    }

    // ── Abas ──
    html+=`<div style="display:flex;border-bottom:2px solid var(--bdr);margin-bottom:.85rem;gap:0;overflow-x:auto">
      <button class="cf-tab active" id="cfTabCat"   onclick="window.cfTab('cat',this)"><i class="fas fa-tags"></i> Categorias</button>
      <button class="cf-tab"        id="cfTabRules" onclick="window.cfTab('rules',this)"><i class="fas fa-robot"></i> Regras</button>
      <button class="cf-tab"        id="cfTabOvw"   onclick="window.cfTab('ovw',this)"><i class="fas fa-chart-bar"></i> Visão Geral</button>
    </div>`;

    // ── Filtros de categoria ──
    html+=`<div id="cfFiltersRow" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;margin-bottom:.75rem">
      <div style="display:flex;gap:.3rem;flex-wrap:wrap">
        <button class="btn btn-sm btn-outline active" onclick="window.cfFilter('all',this)">Todas</button>
        <button class="btn btn-sm btn-ghost"           onclick="window.cfFilter('expense',this)">Despesas</button>
        <button class="btn btn-sm btn-ghost"           onclick="window.cfFilter('income',this)">Receitas</button>
        <button class="btn btn-sm btn-ghost"           onclick="window.cfFilter('over',this)">⚠️ No limite</button>
      </div>
      <div style="display:flex;gap:.4rem;align-items:center">
        <div class="inp-wrap" style="width:160px"><i class="fas fa-search inp-icon"></i>
          <input type="text" class="form-inp" placeholder="Buscar..." oninput="window.cfSearch(this.value)" style="font-size:.8rem"/>
        </div>
        <select class="form-inp" style="width:auto;font-size:.8rem" onchange="window.cfSort(this.value)">
          <option value="spent">Maior gasto</option>
          <option value="name">A-Z</option>
          <option value="pct">% limite</option>
        </select>
      </div>
    </div>`;

    // ── Cards ──
    html+=`<div id="cfCardsContainer" class="hidden"></div>`;

    // ── Regras ──
    html+=`<div id="cfRulesContainer" class="hidden"></div>`;

    // ── Visão Geral ──
    html+=`<div id="cfOvwContainer" class="hidden"></div>`;

    zone.innerHTML=html;

    // Renderiza os cards
    renderCards();

    // Restaura estado expandido
    ST.expanded.forEach(id => { setTimeout(()=>expandCard(id,true),60); });
  }

  function kpiHTML(icon,label,val,color,bg){
    return `<div style="display:flex;align-items:center;gap:.55rem;padding:.7rem .85rem;background:var(--surf);border-radius:var(--r-md);border:1px solid var(--bdr);border-left:4px solid ${color}">
      <div style="width:32px;height:32px;border-radius:8px;background:${bg};color:${color};display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0"><i class="fas ${icon}"></i></div>
      <div><div style="font-size:.62rem;text-transform:uppercase;letter-spacing:.4px;color:var(--txt2);font-weight:600">${label}</div>
           <div style="font-size:.95rem;font-weight:800;font-family:var(--font-h);color:${color}">${val}</div></div>
    </div>`;
  }

  function rule5020HTML(totInc,needsAmt,wantsAmt,saldo){
    const pct=(a,b)=>b>0?Math.min(100,a/b*100).toFixed(1):'0';
    const items=[
      ['Necessidades',needsAmt,totInc*.5,'var(--info)'],
      ['Desejos',wantsAmt,totInc*.3,'var(--warning)'],
      ['Poupança',Math.max(0,saldo),totInc*.2,'var(--success)'],
    ];
    let h=`<div style="background:var(--bg-s);border-radius:10px;padding:.75rem 1rem;border:1px solid var(--bdr);margin-bottom:1rem">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.45rem;flex-wrap:wrap;gap:.3rem">
        <span style="font-size:.78rem;font-weight:700"><i class="fas fa-balance-scale" style="color:var(--accent)"></i> Regra 50/30/20</span>
        <span style="font-size:.68rem;color:var(--txt3)">Necessidades · Desejos · Poupança</span>
      </div>
      <div style="display:flex;height:10px;border-radius:99px;overflow:hidden;gap:2px;margin-bottom:.5rem">`;
    if(totInc>0){
      h+=`<div style="width:${pct(needsAmt,totInc)}%;background:var(--info);transition:width .4s;min-width:${needsAmt>0?'4px':'0'}"></div>`;
      h+=`<div style="width:${pct(wantsAmt,totInc)}%;background:var(--warning);transition:width .4s;min-width:${wantsAmt>0?'4px':'0'}"></div>`;
      h+=`<div style="flex:1;background:var(--success);opacity:.3"></div>`;
    } else {
      h+=`<div style="flex:1;background:var(--bdr);border-radius:99px"></div>`;
    }
    h+=`</div><div style="display:flex;gap:.6rem;flex-wrap:wrap">`;
    items.forEach(([l,v,id,c])=>{
      const ok=id<=0||v<=id;
      h+=`<div style="flex:1;min-width:80px">
        <div style="font-size:.65rem;color:var(--txt2);display:flex;align-items:center;gap:3px;margin-bottom:1px">
          <span style="width:7px;height:7px;border-radius:50%;background:${c};flex-shrink:0"></span>${l}
        </div>
        <div style="font-size:.82rem;font-weight:800;color:${ok?c:'var(--danger)'}">${fmtM(v)}</div>
        <div style="font-size:.62rem;color:var(--txt3)">ideal ≤ ${fmtM(id)}</div>
      </div>`;
    });
    h+=`</div></div>`;
    return h;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER CARDS
  ═══════════════════════════════════════════════════════════════════════ */
  function renderCards(){
    const container=$('cfCardsContainer');
    if(!container) return;
    container.classList.remove('hidden');
    $('cfRulesContainer')?.classList.add('hidden');
    $('cfOvwContainer')?.classList.add('hidden');

    const cats=ST.cats;
    if(!cats.length){
      container.innerHTML='<div class="empty-state" style="padding:2rem"><p class="empty-text">Nenhuma categoria cadastrada.</p></div>';
      return;
    }

    container.innerHTML='';
    cats.forEach(cat=>{
      const div=document.createElement('div');
      div.innerHTML=cardHTML(cat);
      if(div.firstElementChild) container.appendChild(div.firstElementChild);
    });
  }

  function cardHTML(cat){
    const key=String(cat.id);
    const catCfg=ST.cfg[key]||{};
    const limit=catCfg.limit||ST.budgets.find(b=>b.categoryId===cat.id)?.limitAmount||0;
    const cur=sums(filterRows(cat.id,ST.curTxs));
    const prev=sums(filterRows(cat.id,ST.prevTxs));
    const mainVal=cat.type==='expense'?cur.exp:cur.inc;
    const prevVal=cat.type==='expense'?prev.exp:prev.inc;
    const trend=prevVal>0?((mainVal-prevVal)/prevVal*100):0;
    const limitPct=limit>0?Math.min(100,mainVal/limit*100):0;
    const barColor=limitPct>=100?'#ef4444':limitPct>=80?'#f97316':limitPct>=50?'#f59e0b':'#10b981';
    const isOver=limit>0&&mainVal>=limit;
    const hasFilter=Array.isArray(catCfg.includedDescs)&&catCfg.includedDescs.length>0;
    const isExp=ST.expanded.has(cat.id);

    let h=`<div class="cf-card ${isExp?'cf-card--expanded':''}" id="cfCard-${cat.id}" data-catid="${cat.id}" data-type="${cat.type}" data-spent="${mainVal}" data-pct="${limitPct}" data-name="${esc(cat.name)}">`;

    // ── Cabeçalho (sempre visível) ──
    h+=`<div class="cf-card-hdr" onclick="window.cfToggleCard(${cat.id})">`;
    h+=`<div style="display:flex;align-items:center;gap:.6rem;flex:1;min-width:0">`;
    h+=`<div class="cf-card-ico" style="background:${cat.color}"><i class="fas ${cat.icon||'fa-tag'}"></i></div>`;
    h+=`<div style="flex:1;min-width:0;overflow:hidden">`;

    // Linha do nome
    h+=`<div style="font-size:.88rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:.3rem">`;
    h+=esc(cat.name);
    if(isOver) h+=` <span style="font-size:.6rem;padding:1px 5px;border-radius:4px;background:rgba(239,68,68,.15);color:var(--danger);font-weight:700">ESTOURADO</span>`;
    else if(limitPct>=80) h+=` <span style="font-size:.6rem;padding:1px 5px;border-radius:4px;background:rgba(249,115,22,.15);color:#f97316;font-weight:700">⚠ 80%+</span>`;
    if(hasFilter) h+=` <span style="font-size:.6rem;padding:1px 5px;border-radius:4px;background:rgba(var(--accent-rgb),.12);color:var(--accent)"><i class="fas fa-filter" style="font-size:.5rem"></i></span>`;
    h+=`</div>`;

    // Pills
    h+=`<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:2px">`;
    if(cur.exp>0) h+=`<span style="font-size:.67rem;font-weight:600;padding:1px 6px;border-radius:99px;background:rgba(239,68,68,.09);color:var(--danger)">↑ ${fmtM(cur.exp)}</span>`;
    if(cur.inc>0) h+=`<span style="font-size:.67rem;font-weight:600;padding:1px 6px;border-radius:99px;background:rgba(16,185,129,.09);color:var(--success)">↓ ${fmtM(cur.inc)}</span>`;
    if(cur.cnt>0) h+=`<span style="font-size:.67rem;padding:1px 6px;border-radius:99px;background:var(--bg-s);color:var(--txt3)">${cur.cnt} tx</span>`;
    if(trend!==0){
      const isUp=trend>0, isExpCat=cat.type==='expense';
      const tc=isUp&&isExpCat?'var(--danger)':!isUp&&isExpCat?'var(--success)':isUp?'var(--success)':'var(--danger)';
      h+=`<span style="font-size:.67rem;color:${tc}"><i class="fas fa-arrow-${isUp?'up':'down'}" style="font-size:.55rem"></i> ${Math.abs(trend).toFixed(0)}%</span>`;
    }
    h+=`</div>`;
    h+=`</div>`; // /inner

    h+=`</div>`; // /left flex

    // Valor + botão expand
    h+=`<div style="display:flex;align-items:center;gap:.5rem;flex-shrink:0">`;
    h+=`<div style="text-align:right">`;
    h+=`<div style="font-size:1.05rem;font-weight:800;font-family:var(--font-h);color:${cat.type==='expense'?'var(--danger)':'var(--success)'}">${fmtM(mainVal)}</div>`;
    if(limit>0) h+=`<div style="font-size:.62rem;color:var(--txt3)">de ${fmtM(limit)}</div>`;
    h+=`</div>`;
    h+=`<button class="cf-expand-btn" title="${isExp?'Colapsar':'Expandir'}"><i class="fas fa-chevron-${isExp?'up':'down'}"></i></button>`;
    h+=`</div>`;
    h+=`</div>`; // /cf-card-hdr

    // Barra de limite
    if(limit>0){
      h+=`<div style="padding:0 1rem .5rem;border-bottom:1px solid var(--bdr)">`;
      h+=`<div style="display:flex;justify-content:space-between;font-size:.63rem;color:var(--txt2);margin-bottom:3px">`;
      h+=`<span style="color:${barColor};font-weight:700">${limitPct.toFixed(0)}% utilizado</span>`;
      h+=`<span>${fmtM(Math.max(0,limit-mainVal))} disponível</span>`;
      h+=`</div>`;
      h+=`<div class="progress" style="height:6px"><div class="progress-fill" style="width:${limitPct}%;background:${barColor};transition:width .4s"></div></div>`;
      h+=`</div>`;
    }

    // Corpo expandido (inicialmente oculto ou visível)
    h+=`<div class="cf-card-body" id="cfBody-${cat.id}" style="${isExp?'':'display:none'}"></div>`;
    h+=`</div>`; // /cf-card

    return h;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     EXPANDIR / COLAPSAR
  ═══════════════════════════════════════════════════════════════════════ */
  window.cfToggleCard = function(catId){
    if(ST.expanded.has(catId)) collapseCard(catId); else expandCard(catId,false);
  };

  function collapseCard(catId){
    const card=$('cfCard-'+catId), body=$('cfBody-'+catId);
    if(!card||!body) return;
    body.style.display='none';
    card.classList.remove('cf-card--expanded');
    const chevron=card.querySelector('.cf-expand-btn i');
    if(chevron) chevron.className='fas fa-chevron-down';
    ST.expanded.delete(catId);
    if(ST.charts[catId]){ ST.charts[catId].destroy(); delete ST.charts[catId]; }
  }

  async function expandCard(catId, restore=false){
    const card=$('cfCard-'+catId), body=$('cfBody-'+catId);
    if(!card||!body) return;
    ST.expanded.add(catId);
    card.classList.add('cf-card--expanded');
    const chevron=card.querySelector('.cf-expand-btn i');
    if(chevron) chevron.className='fas fa-chevron-up';
    body.style.display='';

    if(!body.dataset.loaded||restore){
      body.dataset.loaded='1';
      body.innerHTML='<div style="padding:1rem;text-align:center;color:var(--txt2);font-size:.82rem"><i class="fas fa-spinner fa-spin"></i></div>';
      await renderExpanded(catId, body);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONTEÚDO EXPANDIDO
  ═══════════════════════════════════════════════════════════════════════ */
  async function renderExpanded(catId, container){
    const cat=ST.cats.find(c=>c.id===catId);
    if(!cat) return;

    const key=String(catId);
    const catCfg=ST.cfg[key]||{};
    const limit=catCfg.limit||ST.budgets.find(b=>b.categoryId===catId)?.limitAmount||0;
    const rows=filterRows(catId,ST.curTxs);
    const t=sums(rows);
    const mainVal=cat.type==='expense'?t.exp:t.inc;
    const allCatRows=ST.curTxs.filter(tx=>tx.categoryId===catId);
    const grouped=groupByDesc(allCatRows);
    const savedDescs=catCfg.includedDescs;
    const selSet=new Set(savedDescs?savedDescs.map(d=>normS(d)):grouped.map(g=>g.norm));
    const [y,m]=ST.month.split('-').map(Number);
    const daysInMonth=new Date(y,m,0).getDate();
    const daysPassed=Math.min(daysInMonth,new Date().getDate());
    const avgDaily=t.cnt>0?mainVal/daysPassed:0;
    const daily=dailyArr(allCatRows,ST.month);

    // Descrições de outras categorias para fuzzy
    const otherDescs=[...new Set(ST.curTxs.filter(tx=>tx.categoryId!==catId).map(tx=>tx.description||'').filter(Boolean))];

    let h='';

    // ── Resumo ──
    h+=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:.5rem;padding:.75rem 1rem;border-bottom:1px solid var(--bdr);background:var(--bg-s)">`;
    const stats=[['Total',fmtM(mainVal),cat.type==='expense'?'var(--danger)':'var(--success)'],['Média/dia',fmtM(avgDaily),'var(--txt)'],['Transações',String(t.cnt),'var(--txt)'],limit?['Limite',fmtM(limit),mainVal>=limit?'var(--danger)':'var(--success)']:null];
    stats.filter(Boolean).forEach(([l,v,c2])=>{
      h+=`<div style="text-align:center"><div style="font-size:.62rem;color:var(--txt2);text-transform:uppercase;letter-spacing:.3px;margin-bottom:2px">${l}</div><div style="font-size:1rem;font-weight:800;color:${c2}">${v}</div></div>`;
    });
    h+=`</div>`;

    // ── Mini-gráfico ──
    h+=`<div style="padding:.7rem 1rem;border-bottom:1px solid var(--bdr)">`;
    h+=`<div style="font-size:.65rem;font-weight:600;color:var(--txt2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:.35rem">Evolução diária — ${ST.month}</div>`;
    h+=`<div style="height:65px;position:relative"><canvas id="cfChart-${catId}"></canvas></div>`;
    h+=`</div>`;

    // ── Lista de favorecidos ──
    h+=`<div style="padding:.7rem 1rem;border-bottom:1px solid var(--bdr)">`;
    h+=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.45rem;flex-wrap:wrap;gap:.3rem">`;
    h+=`<span style="font-size:.76rem;font-weight:700"><i class="fas fa-users" style="color:${cat.color}"></i> Favorecidos/Descrições (${grouped.length})</span>`;
    h+=`<div style="display:flex;gap:.3rem">`;
    h+=`<button class="btn btn-ghost btn-xs" onclick="window.cfSelAll(${catId},true)">Marcar todas</button>`;
    h+=`<button class="btn btn-ghost btn-xs" onclick="window.cfSelAll(${catId},false)">Desmarcar</button>`;
    h+=`</div></div>`;

    if(grouped.length){
      h+=`<div style="max-height:220px;overflow-y:auto;border:1px solid var(--bdr);border-radius:8px" id="cfDescList-${catId}">`;
      grouped.forEach(g=>{
        const checked=selSet.has(g.norm);
        const simItems=otherDescs.filter(d=>isFuzzy(g.orig,d)).slice(0,5);
        const hasSim=simItems.length>0;
        const rowId='r'+catId+'_'+encodeURIComponent(g.norm).replace(/%/g,'').slice(0,15);

        h+=`<div style="border-bottom:1px solid var(--bdr)" id="${rowId}">`;

        // Linha principal
        h+=`<label style="display:flex;align-items:center;gap:.6rem;padding:.5rem .9rem;cursor:pointer;transition:background .1s" onmouseenter="this.style.background='var(--bg-s)'" onmouseleave="this.style.background=''">`;
        h+=`<input type="checkbox" class="cf-own-cb" data-catid="${catId}" data-norm="${esc(g.norm)}" data-orig="${esc(g.orig)}" ${checked?'checked':''} style="width:15px;height:15px;accent-color:${cat.color};cursor:pointer;flex-shrink:0"/>`;
        h+=`<div style="flex:1;min-width:0;overflow:hidden"><div style="font-size:.82rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(g.orig||g.norm)}</div><div style="font-size:.67rem;color:var(--txt2)">${g.cnt} tx</div></div>`;
        h+=`<div style="flex-shrink:0;text-align:right">`;
        if(g.exp>0) h+=`<div style="font-size:.73rem;font-weight:700;color:var(--danger)">↑ ${fmtM(g.exp)}</div>`;
        if(g.inc>0) h+=`<div style="font-size:.73rem;font-weight:700;color:var(--success)">↓ ${fmtM(g.inc)}</div>`;
        h+=`</div>`;
        if(hasSim) h+=`<button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();window.cfTogSim('${rowId}_sim')" title="Descrições similares" style="padding:2px 6px;flex-shrink:0"><i class="fas fa-magic" style="color:var(--warning)"></i></button>`;
        h+=`</label>`;

        // Dropdown similares
        if(hasSim){
          h+=`<div id="${rowId}_sim" class="hidden" style="background:rgba(245,158,11,.04);border-top:1px dashed var(--warning);padding:.4rem .9rem">`;
          h+=`<div style="font-size:.66rem;font-weight:700;color:var(--warning);margin-bottom:.3rem"><i class="fas fa-magic"></i> Similares de outras categorias (mover para cá):</div>`;
          simItems.forEach(s=>{
            const sn=normS(s);
            h+=`<label style="display:flex;align-items:center;gap:.45rem;padding:2px 0;cursor:pointer;font-size:.78rem">`;
            h+=`<input type="checkbox" class="cf-sim-cb" data-catid="${catId}" data-norm="${esc(sn)}" data-orig="${esc(s)}" style="width:13px;height:13px;accent-color:var(--warning);cursor:pointer"/>`;
            h+=`<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s)}</span>`;
            h+=`</label>`;
          });
          h+=`</div>`;
        }

        h+=`</div>`; // /row
      });
      h+=`</div>`; // /cfDescList
    } else {
      h+=`<p style="font-size:.82rem;color:var(--txt2)">Sem transações nesta categoria este mês.</p>`;
    }
    h+=`</div>`; // /favorecidos section

    // ── Definir limite ──
    h+=`<div style="padding:.7rem 1rem;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">`;
    h+=`<span style="font-size:.76rem;font-weight:600;color:var(--txt2);white-space:nowrap"><i class="fas fa-bullseye" style="color:var(--accent)"></i> Limite mensal:</span>`;
    h+=`<div style="display:flex;align-items:center;gap:.5rem;flex:1;min-width:140px;max-width:260px">`;
    h+=`<input type="number" id="cfLim-${catId}" class="form-inp" value="${limit||''}" placeholder="Sem limite" step="0.01" min="0" style="flex:1" oninput="window.cfLimPrev(${catId})"/>`;
    h+=`</div>`;
    h+=`<div id="cfLimPrev-${catId}" style="font-size:.76rem;color:var(--txt2)"></div>`;
    h+=`</div>`;

    // ── Ações ──
    h+=`<div style="display:flex;gap:.4rem;padding:.7rem 1rem;flex-wrap:wrap">`;
    h+=`<button class="btn btn-primary btn-sm" onclick="window.cfSaveCard(${catId})"><i class="fas fa-save"></i> Salvar</button>`;
    h+=`<button class="btn btn-outline btn-sm" onclick="window.cfNewRule(${catId},'${esc(cat.name)}')"><i class="fas fa-robot"></i> Nova Regra</button>`;
    h+=`<button class="btn btn-ghost btn-sm" onclick="window.cfReset(${catId})"><i class="fas fa-undo"></i> Incluir todas</button>`;
    h+=`</div>`;

    container.innerHTML=h;

    // Mini-gráfico
    setTimeout(()=>buildMiniChart(catId,daily,cat.color),50);

    // Preview de limite inicial
    window.cfLimPrev(catId);
  }

  /* ─── Mini-gráfico ─── */
  function buildMiniChart(catId,daily,color){
    const canvas=$('cfChart-'+catId);
    if(!canvas||typeof Chart==='undefined') return;
    if(ST.charts[catId]) ST.charts[catId].destroy();
    ST.charts[catId]=new Chart(canvas.getContext('2d'),{
      type:'bar',
      data:{labels:daily.map((_,i)=>String(i+1)),datasets:[{data:daily,backgroundColor:color+'99',borderColor:color,borderWidth:1,borderRadius:3}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>fmtM(ctx.raw)}}},
        scales:{x:{ticks:{font:{size:8},maxRotation:0,autoSkip:true,maxTicksLimit:8}},
                y:{ticks:{font:{size:8},callback:v=>v>=1000?(v/1000).toFixed(1)+'k':v}}}}
    });
  }

  /* ─── Toggle dropdown similares ─── */
  window.cfTogSim=function(id){ const el=$(id); if(el) el.classList.toggle('hidden'); };

  /* ═══════════════════════════════════════════════════════════════════════
     AÇÕES DOS CARDS
  ═══════════════════════════════════════════════════════════════════════ */
  window.cfSelAll=function(catId,checked){
    $$('#cfDescList-'+catId+' .cf-own-cb').forEach(cb=>{ cb.checked=checked; });
  };

  window.cfLimPrev=function(catId){
    const inp=$('cfLim-'+catId), prev=$('cfLimPrev-'+catId);
    if(!inp||!prev) return;
    const v=parseFloat(inp.value)||0;
    if(!v){ prev.innerHTML=''; return; }
    const cat=ST.cats.find(c=>c.id===catId);
    const t=sums(filterRows(catId,ST.curTxs));
    const mv=cat?.type==='expense'?t.exp:t.inc;
    const p=Math.min(100,mv/v*100);
    const cl=p>=100?'var(--danger)':p>=80?'var(--warning)':'var(--success)';
    prev.innerHTML=`<span style="color:${cl}"><i class="fas fa-chart-bar"></i> ${p.toFixed(0)}% · ${fmtM(Math.max(0,v-mv))} disp.</span>`;
  };

  window.cfSaveCard=async function(catId){
    const cat=ST.cats.find(c=>c.id===catId); if(!cat) return;
    const ownSel=$$('#cfDescList-'+catId+' .cf-own-cb:checked').map(cb=>cb.dataset.orig);
    const simSel=$$('#cfDescList-'+catId+' .cf-sim-cb:checked').map(cb=>cb.dataset.orig);

    // Reclassifica transações das similares
    if(simSel.length){
      let n=0;
      for(const orig of simSel){
        const txs=ST.allTxs.filter(tx=>normS(tx.description)===normS(orig)&&tx.categoryId!==catId);
        for(const tx of txs){ await window.db.transactions.update(tx.id,{categoryId:catId,updatedAt:new Date().toISOString()}); n++; }
        // Cria regra similar
        await addRule('similar',orig,catId,cat.name);
      }
      if(n) T(`✅ ${n} transação(ões) movida(s) para "${cat.name}"!`,'success',5000);
    }

    const allSel=[...ownSel,...simSel];
    const includedDescs=allSel.length?allSel:null;
    const limitVal=parseFloat($('cfLim-'+catId)?.value)||0;

    const cfg=await loadCfg();
    cfg[String(catId)]={includedDescs,limit:limitVal};
    await saveCfg(cfg);
    ST.cfg=cfg;

    if(typeof window.setBudgetCat==='function') await window.setBudgetCat(catId,limitVal,ST.month);

    T('Salvo!','success');

    // Recarrega dados e re-renderiza o card
    const uid=window.S.user.id;
    const [allTxs,budgets]=await Promise.all([
      window.db.transactions.where('userId').equals(uid).toArray(),
      window.db.budgets.where('userId').equals(uid).filter(b=>b.monthYear===ST.month).toArray(),
    ]);
    ST.allTxs=allTxs; ST.curTxs=allTxs.filter(t=>t.date.startsWith(ST.month)); ST.budgets=budgets;
    window.S.cats=await window.db.categories.where('userId').equals(uid).toArray();
    ST.cats=window.S.cats;

    // Substitui card no DOM
    const oldCard=$('cfCard-'+catId);
    if(oldCard){
      const tmp=document.createElement('div');
      tmp.innerHTML=cardHTML(cat);
      const newCard=tmp.firstElementChild;
      if(newCard){ oldCard.replaceWith(newCard); }
    }
    ST.expanded.delete(catId);
    await expandCard(catId,false);
    buildAICtx();
  };

  window.cfReset=async function(catId){
    const cfg=await loadCfg();
    cfg[String(catId)]={includedDescs:null,limit:cfg[String(catId)]?.limit||0};
    await saveCfg(cfg); ST.cfg=cfg;
    T('Todas as descrições incluídas.','info');
    ST.expanded.delete(catId);
    if(ST.charts[catId]){ST.charts[catId].destroy();delete ST.charts[catId];}
    await load(ST.month);
  };

  window.cfNewRule=async function(catId,catName){
    const desc=prompt('Criar Regra Exata para "'+catName+'".\n\nDescrição exata (como aparece no extrato):');
    if(!desc?.trim()) return;
    await addRule('exact',desc.trim(),catId,catName);
    const n=await applyRuleAll({type:'exact',pattern:desc.trim(),categoryId:catId});
    T('Regra criada! '+n+' transação(ões) atualizada(s).','success',4000);
    await load(ST.month);
  };

  /* ═══════════════════════════════════════════════════════════════════════
     REGRAS
  ═══════════════════════════════════════════════════════════════════════ */
  async function addRule(type,pattern,categoryId,catName){
    const rules=await loadRules();
    const id='r'+Date.now()+Math.random().toString(36).slice(2,6);
    const i=rules.findIndex(r=>r.type===type&&normS(String(r.pattern))===normS(String(pattern)));
    if(i>=0) rules[i]={...rules[i],categoryId,catName,updatedAt:new Date().toISOString()};
    else rules.push({id,type,pattern,categoryId,catName,createdAt:new Date().toISOString()});
    await saveRules(rules); ST.rules=rules;
  }

  async function applyRuleAll(rule){
    const uid=window.S.user.id;
    const allTxs=await window.db.transactions.where('userId').equals(uid).toArray();
    let n=0;
    for(const tx of allTxs){
      const match=rule.type==='exact'?normS(tx.description)===normS(rule.pattern):isFuzzy(rule.pattern,tx.description);
      if(match&&tx.categoryId!==rule.categoryId){
        await window.db.transactions.update(tx.id,{categoryId:rule.categoryId,updatedAt:new Date().toISOString()}); n++;
      }
    }
    return n;
  }

  async function renderRules(){
    const el=$('cfRulesContainer'); if(!el) return;
    el.classList.remove('hidden');
    $('cfCardsContainer')?.classList.add('hidden');
    $('cfOvwContainer')?.classList.add('hidden');

    const rules=await loadRules();
    const catMap=Object.fromEntries(ST.cats.map(c=>[c.id,c]));
    const TLBL={exact:'Exata',similar:'Similar',keyword:'Palavra-chave'};
    const TCLS={exact:'badge-success',similar:'badge-warning',keyword:'badge-info'};

    let h=`<div class="card">`;
    h+=`<div class="card-hdr"><span class="card-title"><i class="fas fa-robot" style="color:var(--accent)"></i> Regras de Classificação (${rules.length})</span>`;
    h+=`<div style="display:flex;gap:.4rem">`;
    h+=`<button class="btn btn-outline btn-sm" onclick="window.cfApplyAll()"><i class="fas fa-sync"></i> Aplicar a todas</button>`;
    h+=`<button class="btn btn-primary btn-sm" onclick="window.openRuleModal?window.openRuleModal():window.cfAddRuleUI()"><i class="fas fa-plus"></i> Nova Regra</button>`;
    h+=`</div></div>`;
    h+=`<div style="padding:.65rem 1rem;font-size:.76rem;color:var(--info);background:rgba(59,130,246,.05);border-bottom:1px solid var(--bdr)">`;
    h+=`<i class="fas fa-info-circle"></i> Prioridade: <strong>Exata</strong> → <strong>Similar</strong> → <strong>Palavra-chave</strong> → Naive Bayes → Heurísticas`;
    h+=`</div>`;

    if(rules.length){
      h+=`<div class="table-wrap"><table class="table" style="min-width:480px"><thead><tr><th>Tipo</th><th>Padrão</th><th>Categoria</th><th>Ações</th></tr></thead><tbody>`;
      rules.forEach(r=>{
        const cat=catMap[r.categoryId];
        const pat=Array.isArray(r.pattern)?r.pattern.join(', '):r.pattern;
        h+=`<tr>`;
        h+=`<td><span class="badge ${TCLS[r.type]||'badge-neutral'}">${TLBL[r.type]||r.type}</span></td>`;
        h+=`<td style="font-size:.82rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(String(pat))}">${esc(String(pat).slice(0,50))}</td>`;
        h+=cat?`<td><span style="font-size:.78rem;font-weight:600;color:${cat.color}"><i class="fas ${cat.icon||'fa-tag'}"></i> ${esc(cat.name)}</span></td>`:`<td style="color:var(--txt2)">—</td>`;
        h+=`<td><div style="display:flex;gap:.3rem">`;
        h+=`<button class="row-btn" title="Aplicar a existentes" onclick="window.cfApplyOne('${r.id}')"><i class="fas fa-sync"></i></button>`;
        h+=`<button class="row-btn row-btn-d" onclick="window.cfDelRule('${r.id}')"><i class="fas fa-trash"></i></button>`;
        h+=`</div></td></tr>`;
      });
      h+=`</tbody></table></div>`;
    } else {
      h+=`<div class="empty-state" style="padding:2rem"><div class="empty-icon"><i class="fas fa-robot"></i></div><p class="empty-title">Sem regras</p><p class="empty-text">Expanda um card e clique em "Nova Regra" para criar.</p></div>`;
    }
    h+=`</div>`;
    el.innerHTML=h;
  }

  window.cfApplyAll=async function(){
    if(!confirm('Aplicar TODAS as regras às transações existentes?')) return;
    T('Processando...','info',3000);
    let total=0;
    for(const r of ST.rules) total+=await applyRuleAll(r);
    T('✅ '+total+' transação(ões) atualizada(s)!','success',5000);
    await load(ST.month);
  };

  window.cfApplyOne=async function(ruleId){
    const r=ST.rules.find(x=>x.id===ruleId); if(!r) return;
    const n=await applyRuleAll(r);
    T('✅ '+n+' transação(ões) atualizada(s)!','success',4000);
    if(n) await load(ST.month);
  };

  window.cfDelRule=async function(ruleId){
    if(!confirm('Remover esta regra?')) return;
    const rules=(await loadRules()).filter(r=>r.id!==ruleId);
    await saveRules(rules); ST.rules=rules;
    T('Regra removida.','info');
    renderRules();
  };

  window.cfAddRuleUI=function(){
    // Delega ao novo modal rico do fp-melhorias-sistema.js
    if(typeof window.openRuleModal==='function') window.openRuleModal();
    else T('Módulo de melhorias não carregado.','warning');
  };

  // Expõe renderRules para que fp-melhorias-sistema.js possa re-renderizar
  window._cfRenderRulesInternal=renderRules;

  /* ═══════════════════════════════════════════════════════════════════════
     ABA VISÃO GERAL
  ═══════════════════════════════════════════════════════════════════════ */
  function renderOvw(){
    const el=$('cfOvwContainer'); if(!el) return;
    el.classList.remove('hidden');
    $('cfCardsContainer')?.classList.add('hidden');
    $('cfRulesContainer')?.classList.add('hidden');

    const totExp=ST.curTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const rows=ST.cats.filter(c=>c.type==='expense').map(cat=>{
      const t=sums(filterRows(cat.id,ST.curTxs));
      const lim=(ST.cfg[String(cat.id)]?.limit)||ST.budgets.find(b=>b.categoryId===cat.id)?.limitAmount||0;
      return {cat,sent:t.exp,lim,pct:totExp>0?t.exp/totExp*100:0};
    }).filter(r=>r.sent>0).sort((a,b)=>b.sent-a.sent);

    let h=`<div class="card"><div class="card-hdr"><span class="card-title"><i class="fas fa-chart-pie"></i> Distribuição de gastos — ${ST.month}</span></div><div class="card-body">`;
    if(rows.length){
      rows.forEach(r=>{
        h+=`<div style="margin-bottom:.7rem">`;
        h+=`<div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:2px">`;
        h+=`<span style="display:flex;align-items:center;gap:.4rem;font-weight:600"><i class="fas ${r.cat.icon||'fa-tag'}" style="color:${r.cat.color}"></i>${esc(r.cat.name)}</span>`;
        h+=`<span style="font-weight:700;color:var(--danger)">${fmtM(r.sent)} <span style="font-weight:400;color:var(--txt2)">(${r.pct.toFixed(1)}%)</span></span>`;
        h+=`</div><div class="progress" style="height:8px"><div class="progress-fill" style="width:${r.pct}%;background:${r.cat.color};transition:width .4s"></div></div>`;
        if(r.lim) h+=`<div style="font-size:.63rem;color:var(--txt3);margin-top:2px">Limite: ${fmtM(r.lim)} · ${r.sent>=r.lim?'<span style="color:var(--danger);font-weight:700">ESTOURADO</span>':Math.round(r.sent/r.lim*100)+'%'}</div>`;
        h+=`</div>`;
      });
    } else {
      h+=`<p style="color:var(--txt2);font-size:.85rem">Sem gastos este mês.</p>`;
    }
    h+=`</div></div>`;
    el.innerHTML=h;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ABAS / FILTROS / BUSCA / ORDEM
  ═══════════════════════════════════════════════════════════════════════ */
  window.cfTab=function(tab,btn){
    $$('.cf-tab').forEach(b=>b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    if(tab==='cat') renderCards();
    else if(tab==='rules') renderRules();
    else if(tab==='ovw') renderOvw();
    $('cfFiltersRow')?.classList.toggle('hidden',tab!=='cat');
  };

  window.cfFilter=function(type,btn){
    $$('#cfCardsContainer .cf-card').forEach(card=>{
      const ct=card.dataset.type, pct=parseFloat(card.dataset.pct)||0;
      let show=true;
      if(type==='expense') show=ct==='expense';
      else if(type==='income') show=ct==='income';
      else if(type==='over') show=pct>=80;
      card.style.display=show?'':'none';
    });
    $$('#cfFiltersRow .btn').forEach(b=>b.classList.remove('active'));
    if(btn) btn.classList.add('active');
  };

  window.cfSearch=deb(function(q){
    const s=q.toLowerCase().trim();
    $$('#cfCardsContainer .cf-card').forEach(card=>{
      card.style.display=!s||(card.dataset.name||'').toLowerCase().includes(s)?'':'none';
    });
  },200);

  window.cfSort=function(by){
    const container=$('cfCardsContainer'); if(!container) return;
    const cards=$$('#cfCardsContainer .cf-card');
    cards.sort((a,b)=>{
      if(by==='name') return (a.dataset.name||'').localeCompare(b.dataset.name||'');
      if(by==='spent') return parseFloat(b.dataset.spent||0)-parseFloat(a.dataset.spent||0);
      if(by==='pct')   return parseFloat(b.dataset.pct||0)-parseFloat(a.dataset.pct||0);
      return 0;
    });
    cards.forEach(c=>container.appendChild(c));
  };

  /* ═══════════════════════════════════════════════════════════════════════
     NAVEGAÇÃO DE MÊS
  ═══════════════════════════════════════════════════════════════════════ */
  window.cfChangeMonth=async function(dir){
    const [y,m]=ST.month.split('-').map(Number);
    const d=new Date(y,m-1+dir,1);
    const newMk=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    ST.expanded.clear();
    Object.values(ST.charts).forEach(ch=>ch.destroy());
    ST.charts={};
    setMonthLabel(newMk);
    await load(newMk);
  };

  function setMonthLabel(ms){
    const el=$('cfMonthLabel'); if(!el) return;
    const [y,m]=ms.split('-').map(Number);
    const MN=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    el.textContent=MN[m-1]+' / '+y;
    const nb=$('cfNextMonth'); if(nb) nb.disabled=ms>=mkStr();
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONTEXTO PARA IA
  ═══════════════════════════════════════════════════════════════════════ */
  function buildAICtx(){
    const {cats,curTxs,budgets}=ST;
    const totInc=curTxs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const totExp=curTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const saldo=totInc-totExp;
    const savRate=totInc>0?Math.max(0,saldo/totInc*100):0;

    const lines=[
      '=== CONTROLE FINANCEIRO — '+ST.month+' ===',
      'Receita: '+fmtM(totInc)+' | Despesa: '+fmtM(totExp)+' | Saldo: '+fmtM(saldo)+' | Poupança: '+savRate.toFixed(1)+'%',
      '',
    ];

    cats.forEach(cat=>{
      const rows=filterRows(cat.id,curTxs);
      const t=sums(rows); if(!t.cnt) return;
      const mv=cat.type==='expense'?t.exp:t.inc;
      const lim=(ST.cfg[String(cat.id)]?.limit)||budgets.find(b=>b.categoryId===cat.id)?.limitAmount||0;
      const p=lim>0?Math.round(mv/lim*100):null;
      const over=lim>0&&mv>=lim;
      let line='['+( cat.type==='expense'?'DESPESA':'RECEITA')+'] '+cat.name+': '+fmtM(mv)+' ('+t.cnt+'tx)';
      if(lim) line+=' | limite='+fmtM(lim)+' ('+p+'%'+(over?' ⚠️ESTOURADO':'')+')';
      lines.push(line);
      groupByDesc(rows).slice(0,3).forEach(g=>
        lines.push('  • "'+g.orig+'": ↑'+fmtM(g.exp)+' ↓'+fmtM(g.inc)+' ('+g.cnt+'tx)')
      );
    });

    window.FP_BUDGET_CONTEXT_TEXT=lines.join('\n');
    window.FP_BUDGET_CONTEXT={month:ST.month,totalInc:totInc,totalExp:totExp,saldo,savingsRate:savRate,
      categories:cats.map(cat=>{
        const rows=filterRows(cat.id,curTxs),t=sums(rows);
        const lim=(ST.cfg[String(cat.id)]?.limit)||budgets.find(b=>b.categoryId===cat.id)?.limitAmount||0;
        return {id:cat.id,name:cat.name,type:cat.type,sent:t.exp,received:t.inc,count:t.cnt,limit:lim,
          overLimit:lim>0&&(cat.type==='expense'?t.exp:t.inc)>=lim,
          payees:groupByDesc(rows).slice(0,5).map(g=>({desc:g.orig,sent:g.exp,received:g.inc,count:g.cnt}))};
      })
    };
    window.buildFinancialContext=buildAICtx;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     HOOK IA
  ═══════════════════════════════════════════════════════════════════════ */
  function hookAI(){
    const orig=window.askAI; if(typeof orig!=='function') return;
    window.askAI=function(msg,...rest){
      const ctx=window.FP_BUDGET_CONTEXT_TEXT;
      if(ctx&&msg){
        const kws=['gast','categ','orçam','budget','receita','despesa','limite','favor','uber','ifood','mercado','quanto','estou','meu','mensal'];
        if(kws.some(k=>msg.toLowerCase().includes(k)))
          return orig(msg+'\n\n[contexto]\n'+ctx,...rest);
      }
      return orig(msg,...rest);
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ENTRADA PÚBLICA
  ═══════════════════════════════════════════════════════════════════════ */
  window.loadControleFinanceiro=async function(){
    try{
      setMonthLabel(ST.month);
      const zone=$('cfPageZone');
      if(zone) zone.innerHTML='<div style="text-align:center;padding:3rem;color:var(--txt2)"><i class="fas fa-spinner fa-spin" style="font-size:1.8rem;color:var(--accent)"></i><p style="margin-top:.75rem;font-size:.88rem">Carregando Controle Financeiro...</p></div>';
      await load(ST.month);
    }
    catch(e){ console.error('[CF]',e); T('Erro ao carregar.','error'); }
  };

  window.cfBriefingIA=function(){
    buildAICtx();
    const inp=$('aiChatInput');
    if(inp){
      inp.value='Analise meu controle financeiro deste mês com detalhes por categoria e dê recomendações.';
      if(typeof window.openAIAssistant==='function') window.openAIAssistant();
      setTimeout(()=>typeof window.sendAIChat==='function'&&window.sendAIChat(),300);
      T('Briefing enviado ao assistente!','success');
    } else {
      alert((window.FP_BUDGET_CONTEXT_TEXT||'').split('\n').slice(0,20).join('\n'));
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════════════════════ */
  async function init(){
    try{
      await waitApp();
      console.log('[CF] init...');

      // ─── Override loadBudgets: redireciona para a nova página ───
      window._origLoadBudgets=window.loadBudgets;
      window.loadBudgets=function(){
        // Navega para controle se disponível, senão usa original
        if($('page-controle') && typeof window.navigate==='function'){
          window.navigate('controle');
        } else {
          window._origLoadBudgets && window._origLoadBudgets();
        }
      };

      // ─── Redirect orcamento-pro → controle (safe, one-time) ───
      if(!window.__cfNavHooked){
        window.__cfNavHooked=true;
        const _cfOrigNav=window.navigate;
        if(typeof _cfOrigNav==='function'){
          window.navigate=function(page,...args){
            if(page==='orcamento-pro') page='controle';
            return _cfOrigNav.call(this,page,...args);
          };
        }
      }

      setTimeout(hookAI,3500);
      window.FP_CF={load,buildAICtx};
      console.log('[CF] ✅ pronto');
    }catch(e){ console.error('[CF] init error:',e); }
  }

  document.readyState==='loading'
    ? document.addEventListener('DOMContentLoaded',init)
    : init();
})();
