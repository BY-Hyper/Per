/* ═══════════════════════════════════════════════════════════════════════════
   FinancePro — MELHORIAS DO SISTEMA v1.0
   ───────────────────────────────────────────────────────────────────────────
   ✓ Modal de Regras rico (substituí os 3 prompt() por UI visual completa)
   ✓ Regras conectadas com transações, importação e categorias
   ✓ Sugestão automática de padrão ao criar regra a partir de uma transação
   ✓ Preview em tempo real do impacto da regra (quantas tx serão afetadas)
   ✓ Autocomplete de descrições existentes no DB
   ✓ Atalhos de teclado globais melhorados
   ✓ Toast de boas-vindas com atalhos quando entra no Controle Financeiro
   ✓ Botão "Criar Regra" injetado em cada linha de transação
   ✓ Alertas de revisão: transações em "Outros" com baixa confiança
   ✓ Painel de saúde financeira no dashboard
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── helpers ─── */
  const $ = id => document.getElementById(id);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const fmtM = v => (typeof window.fmtCurrency==='function') ? window.fmtCurrency(v) : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
  const T = (msg,type='info',ms=3500) => typeof window.toast==='function' && window.toast(msg,type,ms);
  const debounce = (fn,ms) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };

  function normS(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim(); }
  function lev(a,b){
    a=normS(a).slice(0,28); b=normS(b).slice(0,28);
    if(!a.length) return b.length; if(!b.length) return a.length;
    const R=Array.from({length:b.length+1},(_,i)=>[i]);
    for(let j=0;j<=a.length;j++) R[0][j]=j;
    for(let i=1;i<=b.length;i++) for(let j=1;j<=a.length;j++)
      R[i][j]=b[i-1]===a[j-1]?R[i-1][j-1]:1+Math.min(R[i-1][j],R[i][j-1],R[i-1][j-1]);
    return R[b.length][a.length];
  }
  function isFuzzy(a,b){ return a&&b&&(normS(a)===normS(b)||lev(a,b)<=2); }

  function ready(){ return typeof window.db!=='undefined' && typeof window.S!=='undefined' && window.S?.user; }
  function waitApp(max=25000){
    return new Promise((res,rej)=>{
      const t0=Date.now();
      (function tick(){ if(ready()) return res(); if(Date.now()-t0>max) return rej(); setTimeout(tick,250); })();
    });
  }

  const KEY_RULES = 'cf2_rules';
  const KEY_CFG   = 'cf2_catCfg';
  async function getRules(){ return (await window.getSetting(window.S.user.id, KEY_RULES, [])) || []; }
  async function setRules(v){ await window.setSetting(window.S.user.id, KEY_RULES, v); }

  /* ═══════════════════════════════════════════════════════════════════════
     MODAL DE CRIAÇÃO DE REGRA — rico, visual, conectado
  ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Abre o modal de criação/edição de regra.
   * @param {object} prefill - dados iniciais: { type, pattern, categoryId, catName, ruleId? }
   */
  window.openRuleModal = async function(prefill={}) {
    if(!ready()) { T('Faça login primeiro.','warning'); return; }

    // Cria modal se não existir
    if(!$('modalCriarRegra')) {
      const wrap = document.createElement('div');
      wrap.id = 'modalCriarRegra';
      wrap.className = 'modal-wrap hidden';
      wrap.setAttribute('role','dialog');
      wrap.setAttribute('aria-modal','true');
      wrap.innerHTML = `
        <div class="modal" style="max-width:600px">
          <div class="modal-hdr">
            <h2 class="modal-title" id="ruleModalTitle"><i class="fas fa-robot" style="color:var(--accent)"></i> Nova Regra de Classificação</h2>
            <button class="modal-close" onclick="closeModal('modalCriarRegra')"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body" id="ruleModalBody"></div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="closeModal('modalCriarRegra')">Cancelar</button>
            <button class="btn btn-outline" id="ruleSaveBtn" onclick="window.saveRule(false)"><i class="fas fa-save"></i> Salvar</button>
            <button class="btn btn-primary" id="ruleSaveApplyBtn" onclick="window.saveRule(true)"><i class="fas fa-bolt"></i> Salvar e Aplicar</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
    }

    // Preenche conteúdo do modal
    await buildRuleModalContent(prefill);
    openModal('modalCriarRegra');
  };

  async function buildRuleModalContent(prefill) {
    const body = $('ruleModalBody');
    const title = $('ruleModalTitle');
    if(!body) return;

    const uid = window.S.user.id;
    const cats = window.S.cats || await window.db.categories.where('userId').equals(uid).toArray();
    const allTxs = await window.db.transactions.where('userId').equals(uid).toArray();

    // Descrições únicas existentes (para autocomplete)
    const allDescs = [...new Set(allTxs.map(t => t.description||'').filter(d=>d.length>=3))].sort();

    // Título
    if(prefill.ruleId) title.innerHTML = '<i class="fas fa-pen" style="color:var(--accent)"></i> Editar Regra';
    else title.innerHTML = '<i class="fas fa-robot" style="color:var(--accent)"></i> Nova Regra de Classificação';

    // Salva dados no DOM para o save
    body.dataset.ruleId = prefill.ruleId||'';
    body.dataset.prefillCatId = prefill.categoryId||'';

    const TYPES = [
      { value:'exact',   label:'Exata',         icon:'fa-equals',    color:'var(--success)', desc:'A descrição precisa ser idêntica à da transação.' },
      { value:'similar', label:'Similar',        icon:'fa-magic',     color:'var(--warning)', desc:'Até 2 letras de diferença (Levenshtein ≤ 2).' },
      { value:'keyword', label:'Palavra-chave',  icon:'fa-key',       color:'var(--info)',    desc:'A descrição contém uma ou mais das palavras informadas.' },
    ];

    let h = '';

    // ── Tipo de Regra ──
    h += `<div style="margin-bottom:1.1rem">
      <div style="font-size:.78rem;font-weight:700;color:var(--txt2);margin-bottom:.55rem;text-transform:uppercase;letter-spacing:.4px">Tipo de Regra</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem" id="ruleTypeGrid">`;
    TYPES.forEach(tp=>{
      const sel = (prefill.type||'exact')===tp.value;
      h+=`<label style="display:flex;flex-direction:column;align-items:center;gap:.4rem;padding:.75rem .5rem;border:2px solid ${sel?tp.color:'var(--bdr)'};border-radius:10px;cursor:pointer;background:${sel?tp.color+'14':'var(--bg-s)'};transition:all .15s;text-align:center" class="rule-type-opt" data-type="${tp.value}">
        <input type="radio" name="ruleType" value="${tp.value}" ${sel?'checked':''} style="display:none" onchange="window.ruleTypeChange(this)"/>
        <i class="fas ${tp.icon}" style="font-size:1.1rem;color:${sel?tp.color:'var(--txt2)'}"></i>
        <span style="font-size:.8rem;font-weight:700;color:${sel?tp.color:'var(--txt)'}">${tp.label}</span>
        <span style="font-size:.65rem;color:var(--txt2);line-height:1.3">${tp.desc}</span>
      </label>`;
    });
    h+=`</div></div>`;

    // ── Padrão / Palavras-chave ──
    const patternVal = Array.isArray(prefill.pattern) ? prefill.pattern.join(', ') : (prefill.pattern||'');
    h+=`<div style="margin-bottom:1rem">
      <label id="rulePatterLabel" style="font-size:.78rem;font-weight:700;color:var(--txt2);display:block;margin-bottom:.45rem;text-transform:uppercase;letter-spacing:.4px">
        ${(prefill.type||'exact')==='keyword'?'Palavras-chave (separadas por vírgula)':'Descrição'}
      </label>
      <div style="position:relative">
        <input type="text" id="rulePattern" list="rulePatternList" class="form-inp" placeholder="Ex: IFOOD COMIDA, UBER DO BRASIL..."
               value="${esc(patternVal)}" oninput="window.rulePatternInput(this.value)" autocomplete="off"
               style="padding-right:40px"/>
        <button onclick="window.rulePreviewImpact()" title="Prévia do impacto"
                style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--accent);font-size:14px">
          <i class="fas fa-search"></i>
        </button>
        <datalist id="rulePatternList">${allDescs.slice(0,200).map(d=>`<option value="${esc(d)}">`).join('')}</datalist>
      </div>
      <div id="rulePatternHint" style="font-size:.72rem;color:var(--txt3);margin-top:4px">
        <i class="fas fa-lightbulb" style="color:var(--warning)"></i> Digite parte da descrição para ver sugestões
      </div>
    </div>`;

    // ── Categoria ──
    h+=`<div style="margin-bottom:1rem">
      <div style="font-size:.78rem;font-weight:700;color:var(--txt2);margin-bottom:.45rem;text-transform:uppercase;letter-spacing:.4px">Categoria Destino</div>
      <div id="ruleCatGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:.45rem">`;
    cats.forEach(cat=>{
      const sel=String(cat.id)===String(prefill.categoryId||'');
      h+=`<label style="display:flex;align-items:center;gap:.5rem;padding:.55rem .75rem;border:2px solid ${sel?cat.color:'var(--bdr)'};border-radius:8px;cursor:pointer;background:${sel?cat.color+'18':'transparent'};transition:all .15s" class="rule-cat-opt">
        <input type="radio" name="ruleCat" value="${cat.id}" ${sel?'checked':''} style="display:none" onchange="window.ruleCatChange(${cat.id})"/>
        <i class="fas ${cat.icon||'fa-tag'}" style="color:${cat.color};font-size:12px;flex-shrink:0"></i>
        <span style="font-size:.78rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${sel?cat.color:'var(--txt)'}">${esc(cat.name)}</span>
      </label>`;
    });
    h+=`</div></div>`;

    // ── Preview de impacto ──
    h+=`<div id="ruleImpactBox" style="display:none;padding:.8rem 1rem;background:var(--bg-s);border-radius:10px;border:1px solid var(--bdr)">
      <div style="font-size:.75rem;font-weight:700;color:var(--txt2);margin-bottom:.45rem;display:flex;align-items:center;justify-content:space-between">
        <span><i class="fas fa-bolt" style="color:var(--warning)"></i> Impacto desta regra</span>
        <span id="ruleImpactCount" style="font-size:.82rem;font-weight:800;color:var(--accent)">0 transações</span>
      </div>
      <div id="ruleImpactList" style="max-height:150px;overflow-y:auto;font-size:.78rem"></div>
    </div>`;

    body.innerHTML = h;

    // Auto-preview se veio prefillado
    if(patternVal) setTimeout(()=>window.rulePreviewImpact(),100);
  }

  /* Muda tipo de regra — atualiza UI */
  window.ruleTypeChange = function(radio) {
    $$('.rule-type-opt').forEach(opt=>{
      const tp = opt.dataset.type;
      const isThis = tp===radio.value;
      const COLORS = {exact:'var(--success)',similar:'var(--warning)',keyword:'var(--info)'};
      const color = COLORS[tp]||'var(--accent)';
      opt.style.border = isThis?`2px solid ${color}`:'2px solid var(--bdr)';
      opt.style.background = isThis?color.replace(')','')+'14)':'var(--bg-s)';
      opt.querySelector('i').style.color = isThis?color:'var(--txt2)';
      opt.querySelector('span').style.color = isThis?color:'var(--txt)';
    });
    const lbl = $('rulePatterLabel');
    if(lbl) lbl.textContent = radio.value==='keyword' ? 'Palavras-chave (separadas por vírgula)' : 'Descrição';
    window.rulePreviewImpact();
  };

  /* Muda categoria — atualiza UI */
  window.ruleCatChange = function(catId) {
    const cats = window.S.cats||[];
    const cat = cats.find(c=>c.id===catId);
    $$('.rule-cat-opt').forEach(opt=>{
      const inp = opt.querySelector('input');
      const selected = parseInt(inp?.value)===catId;
      opt.style.border = selected&&cat?`2px solid ${cat.color}`:'2px solid var(--bdr)';
      opt.style.background = selected&&cat?cat.color+'18':'transparent';
      if(inp) inp.checked = selected;
      const nameSpan = opt.querySelector('span');
      if(nameSpan) nameSpan.style.color = selected&&cat?cat.color:'var(--txt)';
    });
  };

  /* Preview de impacto em tempo real */
  window.rulePreviewImpact = debounce(async function() {
    if(!ready()) return;
    const pattern = $('rulePattern')?.value?.trim();
    const typeEl = document.querySelector('input[name="ruleType"]:checked');
    const type = typeEl?.value || 'exact';
    const box = $('ruleImpactBox');
    const countEl = $('ruleImpactCount');
    const listEl = $('ruleImpactList');
    if(!box||!pattern) { if(box) box.style.display='none'; return; }

    const uid = window.S.user.id;
    const allTxs = await window.db.transactions.where('userId').equals(uid).toArray();

    // Verifica quais transações a regra afeta
    const kws = type==='keyword' ? pattern.split(',').map(s=>normS(s.trim())).filter(Boolean) : [];
    const affected = allTxs.filter(tx=>{
      const desc = normS(tx.description||'');
      if(type==='exact')   return desc===normS(pattern);
      if(type==='similar') return isFuzzy(pattern, tx.description);
      if(type==='keyword') return kws.some(kw=>desc.includes(kw));
      return false;
    });

    box.style.display = '';
    countEl.textContent = `${affected.length} transação(ões)`;
    countEl.style.color = affected.length>0 ? 'var(--accent)' : 'var(--txt3)';

    if(!affected.length){
      listEl.innerHTML = '<p style="color:var(--txt2);padding:.25rem 0">Nenhuma transação existente encontrada com este padrão.</p>';
      return;
    }

    const cats = window.S.cats||[];
    const catMap = Object.fromEntries(cats.map(c=>[c.id,c]));
    const latest = affected.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);

    listEl.innerHTML = latest.map(tx=>{
      const cat = catMap[tx.categoryId];
      return `<div style="display:flex;align-items:center;gap:.5rem;padding:3px 0;border-bottom:1px solid var(--bdr)">
        <div style="flex:1;min-width:0;overflow:hidden">
          <span style="font-size:.78rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block">${esc(tx.description||'—')}</span>
          <span style="font-size:.65rem;color:var(--txt2)">${tx.date} · atualmente em: ${cat?`<span style="color:${cat.color}">${esc(cat.name)}</span>`:'?'}</span>
        </div>
        <span style="font-size:.78rem;font-weight:700;color:${tx.type==='expense'?'var(--danger)':'var(--success)'};flex-shrink:0">${fmtM(tx.amount)}</span>
      </div>`;
    }).join('') + (affected.length>8?`<p style="font-size:.72rem;color:var(--txt2);padding:4px 0">+ ${affected.length-8} outras...</p>`:'');
  }, 400);

  /* Input de padrão — atualiza preview com debounce */
  window.rulePatternInput = function(val) {
    window.rulePreviewImpact();
  };

  /* Salva a regra (e opcionalmente aplica) */
  window.saveRule = async function(applyToExisting=false) {
    const body = $('ruleModalBody');
    const pattern = $('rulePattern')?.value?.trim();
    const typeEl = document.querySelector('input[name="ruleType"]:checked');
    const catEl  = document.querySelector('input[name="ruleCat"]:checked');

    if(!pattern) { T('Informe o padrão ou palavras-chave.','warning'); return; }
    if(!catEl)   { T('Selecione uma categoria.','warning'); return; }

    const type     = typeEl?.value||'exact';
    const catId    = parseInt(catEl.value);
    const cats     = window.S.cats||[];
    const cat      = cats.find(c=>c.id===catId);
    const catName  = cat?.name||'';

    // Monta padrão final
    const finalPattern = type==='keyword'
      ? pattern.split(',').map(s=>s.trim()).filter(Boolean)
      : pattern;

    // Busca ou cria no array de regras
    const rules = await getRules();
    const ruleId = body?.dataset.ruleId;
    const existIdx = ruleId ? rules.findIndex(r=>r.id===ruleId) : -1;
    const newRule = {
      id     : ruleId||('r'+Date.now()+Math.random().toString(36).slice(2,6)),
      type,
      pattern: finalPattern,
      categoryId: catId,
      catName,
      createdAt: existIdx>=0 ? rules[existIdx].createdAt : new Date().toISOString(),
      updatedAt : new Date().toISOString(),
    };

    if(existIdx>=0) rules[existIdx]=newRule;
    else rules.push(newRule);
    await setRules(rules);

    // Atualiza estado global do módulo CF se disponível
    if(window.FP_CF) window.FP_CF._rules = rules;

    let n = 0;
    if(applyToExisting) {
      n = await applyRuleToTxs(newRule);
    }

    closeModal('modalCriarRegra');

    const msg = applyToExisting
      ? `✅ Regra salva! ${n} transação(ões) reclassificada(s) para "${catName}".`
      : `✅ Regra criada para "${catName}".`;
    T(msg, 'success', 5000);

    // Treina o Naive Bayes com a nova regra
    if(typeof window.LocalAI?.rememberCorrection==='function') {
      const descForTrain = Array.isArray(finalPattern) ? finalPattern[0] : finalPattern;
      await window.LocalAI.rememberCorrection(descForTrain, catId, null, catName).catch(()=>{});
    }

    // Recarrega página de controle se estiver ativa
    if($('page-controle')?.classList.contains('active') && typeof window.loadControleFinanceiro==='function') {
      await window.loadControleFinanceiro();
    }
    // Recarrega tabela de regras se estiver visível
    if(typeof window._cfRenderRules==='function') window._cfRenderRules();
  };

  /* Aplica regra a transações existentes */
  async function applyRuleToTxs(rule) {
    if(!window.S?.user) return 0;
    const uid = window.S.user.id;
    const allTxs = await window.db.transactions.where('userId').equals(uid).toArray();
    let n=0;
    for(const tx of allTxs){
      const desc = normS(tx.description||'');
      const match =
        rule.type==='exact'   ? desc===normS(String(rule.pattern)) :
        rule.type==='similar' ? isFuzzy(rule.pattern, tx.description) :
        rule.type==='keyword' ? (() => { const kws=Array.isArray(rule.pattern)?rule.pattern:[rule.pattern]; return kws.some(kw=>desc.includes(normS(kw))); })() : false;
      if(match && tx.categoryId!==rule.categoryId){
        await window.db.transactions.update(tx.id,{categoryId:rule.categoryId,updatedAt:new Date().toISOString()});
        n++;
      }
    }
    // Recarrega S.cats se mudou
    if(n) window.S.cats = await window.db.categories.where('userId').equals(window.S.user.id).toArray();
    return n;
  }
  window.applyRuleToExisting = applyRuleToTxs; // expõe globalmente

  /* ═══════════════════════════════════════════════════════════════════════
     ATALHO GLOBAL: abre modal de regra de qualquer lugar
  ═══════════════════════════════════════════════════════════════════════ */
  function addKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      if(!window.S?.user) return;
      if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
      const ctrl = e.ctrlKey||e.metaKey;
      // Ctrl+R = Nova Regra
      if(ctrl && e.key==='r') { e.preventDefault(); window.openRuleModal(); }
      // Ctrl+Shift+C = Controle Financeiro
      if(ctrl && e.shiftKey && e.key==='C') { e.preventDefault(); if(typeof window.navigate==='function') window.navigate('controle'); }
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     INJEÇÃO NAS LINHAS DE TRANSAÇÃO — botão "Criar Regra"
  ═══════════════════════════════════════════════════════════════════════ */
  function hookTransactionRows() {
    const tbody = $('txTableBody');
    if(!tbody) return;

    const observer = new MutationObserver(() => {
      tbody.querySelectorAll('tr').forEach(tr => {
        if(tr.dataset.ruleBtnAdded) return;
        tr.dataset.ruleBtnAdded='1';
        const actions = tr.querySelector('.row-actions');
        if(!actions) return;
        const txId = tr.dataset.txid || tr.querySelector('[data-txid]')?.dataset.txid;

        const btn = document.createElement('button');
        btn.className = 'row-btn';
        btn.title = 'Criar regra de classificação';
        btn.innerHTML = '<i class="fas fa-robot" style="color:var(--accent)"></i>';
        btn.onclick = async(e) => {
          e.stopPropagation();
          if(!txId||!window.db) return;
          const tx = await window.db.transactions.get(parseInt(txId));
          if(!tx) return;
          window.openRuleModal({
            type    : 'exact',
            pattern : tx.description||'',
            categoryId: tx.categoryId,
          });
        };
        actions.insertBefore(btn, actions.firstChild);
      });
    });
    observer.observe(tbody, {childList:true, subtree:false});
  }

  /* ═══════════════════════════════════════════════════════════════════════
     HOOK NO IMPORT — sugere regras para transações "Outros"
  ═══════════════════════════════════════════════════════════════════════ */
  function hookImportConfirm() {
    // Sobrescreve confirmImport se existir para sugerir regras pós-importação
    const orig = window.confirmImport;
    if(typeof orig!=='function') return;

    window.confirmImport = async function(...args) {
      const result = await orig(...args);

      // Após importação, detecta transações em "Outros"
      setTimeout(async() => {
        if(!window.S?.user||!window.db) return;
        const uid = window.S.user.id;
        const cats = window.S.cats||[];
        const outrosCat = cats.find(c=>c.name==='Outros'&&c.type==='expense');
        if(!outrosCat) return;

        const recent = await window.db.transactions.where('userId').equals(uid)
          .filter(t=>t.categoryId===outrosCat.id)
          .reverse().limit(20).toArray();

        if(recent.length>=3) {
          T(`⚠️ ${recent.length} transações foram para "Outros". Crie regras para classificá-las automaticamente!`, 'warning', 8000);
          // Mostra botão na notificação
          setTimeout(()=>{
            const toasts = document.querySelectorAll('.toast-warning');
            toasts.forEach(t=>{
              if(!t.querySelector('.rule-suggestion-btn')) {
                const btn = document.createElement('button');
                btn.className='rule-suggestion-btn';
                btn.innerHTML='<i class="fas fa-robot"></i> Criar regras';
                btn.style.cssText='margin-top:5px;padding:3px 10px;background:var(--warning);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:.75rem;width:100%';
                btn.onclick=()=>{ if(typeof window.navigate==='function') window.navigate('controle'); };
                t.appendChild(btn);
              }
            });
          }, 200);
        }
      }, 1500);

      return result;
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     WIDGET DE REGRAS NO DASHBOARD — contagem e acesso rápido
  ═══════════════════════════════════════════════════════════════════════ */
  async function injectRulesWidget() {
    if(!ready()) return;
    const rulesParent = $('dashSuggestionsCard')?.parentElement;
    if(!rulesParent||$('dashRulesWidget')) return;

    const rules = await getRules();
    const widget = document.createElement('div');
    widget.id='dashRulesWidget';
    widget.className='card';
    widget.style.marginTop='1rem';
    widget.innerHTML=`
      <div class="card-hdr">
        <span class="card-title"><i class="fas fa-robot" style="color:var(--accent)"></i> Regras de Classificação</span>
        <div style="display:flex;gap:.4rem">
          <button class="btn btn-ghost btn-sm" onclick="window.navigate('controle')">Ver todas</button>
          <button class="btn btn-primary btn-sm" onclick="window.openRuleModal()"><i class="fas fa-plus"></i> Nova</button>
        </div>
      </div>
      <div style="padding:.75rem 1rem">
        ${rules.length===0 ? `
          <div class="empty-state" style="padding:1rem">
            <div class="empty-icon" style="font-size:2rem"><i class="fas fa-robot"></i></div>
            <p class="empty-text">Nenhuma regra criada. Crie regras para categorizar transações automaticamente!</p>
            <button class="btn btn-outline btn-sm" style="margin-top:.5rem" onclick="window.openRuleModal()">Criar primeira regra</button>
          </div>
        ` : `
          <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:.6rem">
            ${[
              {type:'exact',  label:'Exatas',    color:'var(--success)'},
              {type:'similar',label:'Similares', color:'var(--warning)'},
              {type:'keyword',label:'Palavras',  color:'var(--info)'},
            ].map(tp=>{
              const count=rules.filter(r=>r.type===tp.type).length;
              return count>0?`<span style="padding:3px 10px;border-radius:99px;font-size:.75rem;font-weight:700;background:${tp.color}18;color:${tp.color}">${count} ${tp.label}</span>`:'';
            }).join('')}
          </div>
          <div style="font-size:.82rem;color:var(--txt2);margin-bottom:.6rem">
            <strong style="color:var(--txt)">${rules.length} regra(s) ativa(s)</strong> — classificando transações automaticamente.
          </div>
          <div style="display:flex;gap:.4rem;flex-wrap:wrap">
            ${rules.slice(0,3).map(r=>{
              const pattern=Array.isArray(r.pattern)?r.pattern.slice(0,2).join(', '):(r.pattern||'').slice(0,25);
              return `<span style="font-size:.72rem;padding:2px 8px;border-radius:6px;background:var(--bg-s);color:var(--txt2)" title="${esc(String(r.pattern))}">${esc(pattern)}</span>`;
            }).join('')}
            ${rules.length>3?`<span style="font-size:.72rem;color:var(--txt3)">+${rules.length-3} mais</span>`:''}
          </div>
        `}
      </div>
    `;
    rulesParent.appendChild(widget);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PAINEL DE SAÚDE FINANCEIRA NO DASHBOARD
  ═══════════════════════════════════════════════════════════════════════ */
  async function injectHealthWidget() {
    if(!ready()) return;
    if($('dashHealthWidget')) return;
    const uid = window.S.user.id;
    const cats = window.S.cats||[];
    const mk = (d=new Date()) => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    const curMk = mk();
    const txs = await window.db.transactions.where('userId').equals(uid).toArray();
    const curTxs = txs.filter(t=>t.date.startsWith(curMk));
    if(!curTxs.length) return;

    const totInc = curTxs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const totExp = curTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const saldo  = totInc-totExp;
    const savRate= totInc>0?Math.max(0,saldo/totInc*100):0;

    // Score de saúde (0-100)
    let score=50;
    if(savRate>=20) score+=25; else if(savRate>=10) score+=12;
    if(totInc>0) score+=10;
    const cfg = await window.getSetting(uid,'cf2_catCfg',{});
    const budgets = await window.db.budgets.where('userId').equals(uid).filter(b=>b.monthYear===curMk).toArray();
    const overLim = cats.filter(c=>{
      const lim=(cfg[String(c.id)]?.limit)||budgets.find(b=>b.categoryId===c.id)?.limitAmount||0;
      if(!lim) return false;
      const spent=curTxs.filter(t=>t.categoryId===c.id&&t.type==='expense').reduce((s,t)=>s+t.amount,0);
      return spent>=lim;
    });
    score-=overLim.length*8;
    score=Math.max(0,Math.min(100,score));

    const scoreColor=score>=70?'var(--success)':score>=40?'var(--warning)':'var(--danger)';
    const scoreLabel=score>=70?'Saudável 💪':score>=40?'Atenção ⚠️':'Crítico 🚨';

    const parent=$('dashSuggestionsCard')?.parentElement;
    if(!parent) return;
    const widget=document.createElement('div');
    widget.id='dashHealthWidget';
    widget.className='card';
    widget.style.marginTop='1rem';
    widget.innerHTML=`
      <div class="card-hdr">
        <span class="card-title"><i class="fas fa-heartbeat" style="color:${scoreColor}"></i> Saúde Financeira</span>
        <span style="font-size:.82rem;font-weight:700;color:${scoreColor}">${scoreLabel}</span>
      </div>
      <div style="padding:.85rem 1rem">
        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:.75rem;flex-wrap:wrap">
          <div style="position:relative;width:64px;height:64px;flex-shrink:0">
            <svg viewBox="0 0 36 36" style="width:64px;height:64px;transform:rotate(-90deg)">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bdr)" stroke-width="3"/>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="${scoreColor}" stroke-width="3"
                stroke-dasharray="${score} ${100-score}" stroke-linecap="round"/>
            </svg>
            <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:.9rem;font-weight:900;color:${scoreColor}">${score}</span>
          </div>
          <div style="flex:1;min-width:120px">
            <div style="font-size:.82rem;color:var(--txt2);margin-bottom:.3rem">Taxa de poupança: <strong style="color:${savRate>=20?'var(--success)':savRate>=10?'var(--warning)':'var(--danger)'}">${savRate.toFixed(1)}%</strong></div>
            ${overLim.length?`<div style="font-size:.82rem;color:var(--danger)"><i class="fas fa-exclamation-triangle"></i> ${overLim.length} categoria(s) no limite</div>`:'<div style="font-size:.82rem;color:var(--success)"><i class="fas fa-check-circle"></i> Dentro do orçamento</div>'}
            <div style="font-size:.78rem;color:var(--txt2);margin-top:3px">Saldo: <strong style="color:${saldo>=0?'var(--accent)':'var(--danger)'}">${fmtM(saldo)}</strong></div>
          </div>
        </div>
        <button class="btn btn-outline btn-sm btn-full" onclick="window.navigate('controle')"><i class="fas fa-layer-group" style="color:var(--accent)"></i> Abrir Controle Financeiro</button>
      </div>
    `;
    parent.appendChild(widget);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     MELHORA A FUNÇÃO cfAddRuleUI — substitui pelos prompts antigos
  ═══════════════════════════════════════════════════════════════════════ */
  function patchCfAddRuleUI() {
    // Substitui a função que usa prompt() pelo novo modal
    window.cfAddRuleUI = function() {
      window.openRuleModal();
    };

    // Também substitui cfNewRule (chamada de dentro de um card expandido)
    window.cfNewRule = function(catId, catName) {
      window.openRuleModal({ categoryId: catId });
    };

    // Expõe para o módulo de controle financeiro registrar o renderRules
    window._cfRenderRules = null; // será sobrescrito pelo módulo CF quando a aba rules for aberta
  }

  /* ═══════════════════════════════════════════════════════════════════════
     HOOK NA ABA DE REGRAS DO CONTROLE FINANCEIRO
     — injeta o botão "Nova Regra" com o novo modal
  ═══════════════════════════════════════════════════════════════════════ */
  function hookRulesTab() {
    // Sobrescreve cfTab para interceptar a aba de regras
    const origCfTab = window.cfTab;
    if(typeof origCfTab!=='function') return;

    window.cfTab = function(tab, btn) {
      origCfTab(tab, btn);
      if(tab==='rules') {
        // Substitui o botão "Nova" no painel de regras pelo novo modal
        setTimeout(()=>{
          const addBtn = document.querySelector('#cfRulesContainer .btn-primary[onclick*="cfAddRuleUI"]');
          if(addBtn) {
            addBtn.onclick = ()=>window.openRuleModal();
          }
          // Registra função de re-render para o saveRule()
          window._cfRenderRules = ()=>{
            if(typeof window.cfTab==='function') {
              const activeRulesTab=$('cfTabRules');
              if(activeRulesTab?.classList.contains('active')){
                // Re-renderiza sem mudar tab
                if(typeof origCfTab==='function') origCfTab('rules',null);
              }
            }
          };
        }, 100);
      }
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     BOTÃO FLUTUANTE "NOVA REGRA" (acessível de qualquer tela)
  ═══════════════════════════════════════════════════════════════════════ */
  function injectRuleFAB() {
    if($('ruleFab')) return;
    const fab=document.createElement('button');
    fab.id='ruleFab';
    fab.className='btn btn-primary';
    fab.style.cssText='position:fixed;bottom:5.5rem;right:1.25rem;z-index:150;border-radius:50%;width:44px;height:44px;padding:0;box-shadow:var(--shadow-a);display:none;align-items:center;justify-content:center';
    fab.title='Nova Regra (Ctrl+R)';
    fab.innerHTML='<i class="fas fa-robot"></i>';
    fab.onclick=()=>window.openRuleModal();
    document.body.appendChild(fab);

    // Mostra FAB apenas na página de Controle Financeiro
    if(!window.__msFabNavHooked){
      window.__msFabNavHooked=true;
      const _msOrigNav=window.navigate;
      if(typeof _msOrigNav==='function'){
        window.navigate=function(page,...args){
          const r=_msOrigNav.call(this,page,...args);
          if(fab) fab.style.display=page==='controle'?'flex':'none';
          return r;
        };
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ADICIONA AÇÃO "CRIAR REGRA" NO MENU DE CONTEXTO DAS TRANSAÇÕES
     (via botão direito simulado com long-press)
  ═══════════════════════════════════════════════════════════════════════ */
  function hookTxContextMenu() {
    // Quando o usuário edita a categoria de uma transação e confirma,
    // pergunta se quer criar uma regra
    const origSaveTx = window.saveTx;
    if(typeof origSaveTx!=='function') return;

    window.saveTx = async function(...args) {
      const editId = $('txEditId')?.value;
      const newCatEl = $('txCategoryId');
      if(editId && newCatEl) {
        try {
          const oldTx = await window.db.transactions.get(parseInt(editId));
          const newCatId = parseInt(newCatEl.value);
          if(oldTx && oldTx.categoryId!==newCatId && oldTx.description) {
            // Categoria mudou — sugere criar regra após salvar
            setTimeout(()=>{
              const cat = (window.S.cats||[]).find(c=>c.id===newCatId);
              if(!cat) return;
              // Injeta toast com botão de criar regra
              const toastEl=document.createElement('div');
              toastEl.className='toast toast-info';
              toastEl.style.pointerEvents='all';
              toastEl.innerHTML=`
                <i class="fas fa-robot" style="color:var(--info)"></i>
                <span style="flex:1;font-size:.82rem">Criar regra para <strong>"${esc(oldTx.description.slice(0,30))}"</strong> → ${esc(cat.name)}?</span>
                <button style="padding:3px 8px;background:var(--accent);color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:.75rem;white-space:nowrap"
                        onclick="window.openRuleModal({type:'exact',pattern:'${esc(oldTx.description)}',categoryId:${newCatId}});this.closest('.toast').remove()">
                  Criar
                </button>
                <button class="toast-x" onclick="this.closest('.toast').remove()"><i class="fas fa-times"></i></button>`;
              $('toastContainer')?.appendChild(toastEl);
              setTimeout(()=>toastEl.remove(),12000);
            }, 600);
          }
        } catch(e) {}
      }
      return origSaveTx(...args);
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CSS INJETADO
  ═══════════════════════════════════════════════════════════════════════ */
  function injectCSS() {
    if($('fp-melhorias-css')) return;
    const style=document.createElement('style');
    style.id='fp-melhorias-css';
    style.textContent=`
      /* Modal de regra */
      .rule-type-opt:hover{filter:brightness(.96)}
      .rule-cat-opt:hover{filter:brightness(.97)}
      #rulePatternList{position:relative}
      #ruleImpactBox{animation:fadeIn .2s ease}
      /* Widget de saúde */
      #dashHealthWidget .card-hdr{padding:.8rem 1rem}
      /* FAB de regra */
      #ruleFab:hover{transform:scale(1.08);box-shadow:0 8px 20px rgba(var(--accent-rgb),.4)}
      /* Botão de sugestão de regra no toast */
      .rule-suggestion-btn:hover{opacity:.9}
      /* Highlight linha tx quando hovera btn de regra */
      #txTableBody tr:hover .row-btn[title*="regra"] i{animation:pulse .6s ease infinite alternate}
      @keyframes pulse{from{opacity:.6}to{opacity:1}}
    `;
    document.head.appendChild(style);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════════════════════ */
  async function init() {
    try {
      await waitApp();
      console.log('[MELHORIAS] inicializando...');

      injectCSS();
      patchCfAddRuleUI();
      addKeyboardShortcuts();
      injectRuleFAB();

      // Hooks que dependem de funções do app.js
      setTimeout(()=>{
        hookTransactionRows();
        hookRulesTab();
        hookImportConfirm();
        hookTxContextMenu();
      }, 1000);

      // Widgets do dashboard (após o app renderizar)
      setTimeout(async()=>{
        await injectRulesWidget();
        await injectHealthWidget();
      }, 2500);

      // Expõe API pública
      window.FP_MELHORIAS = {
        openRuleModal : window.openRuleModal,
        applyRuleToTxs,
        injectRulesWidget,
        injectHealthWidget,
      };

      console.log('[MELHORIAS] ✅ Sistema aprimorado. Ctrl+R = Nova Regra.');
    } catch(e) {
      console.error('[MELHORIAS]',e);
    }
  }

  document.readyState==='loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();
})();
