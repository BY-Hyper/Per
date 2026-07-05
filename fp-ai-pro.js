/* ═══════════════════════════════════════════════════════════
   FinancePro — AI Pro v2.0  (EXTREME UPGRADE)
   ───────────────────────────────────────────────────────────
   CLASSIFIER v2 : índice invertido TF-IDF + ponderação por idade
   CHAT v2       : histórico persistente · Markdown · streaming · voz
   INSIGHTS v2   : 12 tipos de insight (antes 5)
   NL COMMANDS v2: números por extenso · sinônimos pt-BR
   UI v2         : MutationObserver · Dexie hooks · esqueleto de loading
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─────────────── helpers globais ─────────────── */
  const T = (msg, type = 'info', ms = 3500) => {
    if (typeof window.toast === 'function') window.toast(msg, type, ms);
  };
  const $ = id => document.getElementById(id);
  const esc = s => String(s || '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtMoney = v => typeof window.fmtCurrency === 'function'
    ? window.fmtCurrency(v)
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const todayStr = () => new Date().toISOString().split('T')[0];
  const monthKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  async function getPref(key, fallback = null) {
    if (!window.S?.user) return fallback;
    if (typeof window.getSetting === 'function')
      return await window.getSetting(window.S.user.id, key, fallback);
    return fallback;
  }
  async function setPref(key, value) {
    if (!window.S?.user) return;
    if (typeof window.setSetting === 'function')
      await window.setSetting(window.S.user.id, key, value);
  }
  function ready() {
    return typeof window.db !== 'undefined' &&
           typeof window.S !== 'undefined' &&
           window.S.user;
  }
  function waitApp(maxMs = 20000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      (function loop() {
        if (ready()) return resolve();
        if (Date.now() - t0 > maxMs) return reject(new Error('AI_PRO timeout'));
        setTimeout(loop, 250);
      })();
    });
  }

  /* ─────────────── normalização texto ─────────────── */
  function norm(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function tokenize(s, minLen = 2) {
    return norm(s).split(' ').filter(w => w.length >= minLen);
  }

  /* ─────────────── Markdown renderer leve ─────────────── */
  function renderMarkdown(text) {
    return String(text || '')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:rgba(0,0,0,.07);padding:1px 4px;border-radius:3px">$1</code>')
      .replace(/^#{1,3}\s+(.+)$/gm, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '• $1')
      .replace(/\n/g, '<br>');
  }

  /* ═══════════════════════════════════════════════════════════
     ÍNDICE INVERTIDO TF-IDF — construído sob demanda, cacheado
     Permite lookup O(1) em vez de scan linear O(n·tokens)
  ═══════════════════════════════════════════════════════════ */
  const Index = {
    _index: null,      // Map<token, [{catId, type, date, tf}]>
    _docFreq: null,    // Map<token, count>
    _N: 0,
    _lastCount: -1,

    async build(uid) {
      const all = await window.db.transactions.where('userId').equals(uid).toArray();
      if (all.length === this._lastCount && this._index) return;
      const index = new Map();
      const docFreq = new Map();
      for (const tx of all) {
        if (!tx.categoryId || !tx.description) continue;
        const tokens = tokenize(tx.description);
        const unique = [...new Set(tokens)];
        for (const tk of unique) {
          docFreq.set(tk, (docFreq.get(tk) || 0) + 1);
          if (!index.has(tk)) index.set(tk, []);
          index.get(tk).push({
            catId: tx.categoryId,
            type: tx.type,
            date: tx.date,
            tf: tokens.filter(t => t === tk).length / Math.max(tokens.length, 1),
          });
        }
      }
      this._index = index;
      this._docFreq = docFreq;
      this._N = all.length;
      this._lastCount = all.length;
    },

    score(tokens, type) {
      if (!this._index) return null;
      const now = Date.now();
      const catScores = new Map();
      for (const tk of tokens) {
        const entries = this._index.get(tk);
        if (!entries) continue;
        const df = this._docFreq.get(tk) || 1;
        const idf = Math.log((this._N + 1) / df + 1);
        for (const e of entries) {
          if (type && e.type !== type) continue;
          const daysOld = (now - new Date(e.date + 'T00:00:00').getTime()) / 86400000;
          const ageFactor = Math.exp(-Math.max(0, daysOld) / 270); // half-life ~9 meses
          const score = e.tf * idf * (0.4 + 0.6 * ageFactor);
          catScores.set(e.catId, (catScores.get(e.catId) || 0) + score);
        }
      }
      if (!catScores.size) return null;
      const sorted = [...catScores.entries()].sort((a, b) => b[1] - a[1]);
      const total = [...catScores.values()].reduce((s, v) => s + v, 0);
      const topShare = sorted[0][1] / Math.max(total, 0.001);
      const confidence = Math.min(93, Math.round(35 + topShare * 58));
      return { categoryId: sorted[0][0], confidence, source: 'tfidf', reason: 'Padrão TF-IDF no histórico' };
    },

    invalidate() { this._lastCount = -1; this._index = null; },
  };

  /* ═══════════════════════════════════════════════════════════
     1. SMART CLASSIFIER v2
  ═══════════════════════════════════════════════════════════ */
  const Classifier = {
    _cache: new Map(),

    async classify(description, type = null, amount = null) {
      const key = (type || '') + '|' + norm(description) + '|' + (amount || 0);
      if (this._cache.has(key)) return this._cache.get(key);
      const result = await this._compute(description, type, amount);
      this._cache.set(key, result);
      if (this._cache.size > 500) {
        const k0 = this._cache.keys().next().value;
        this._cache.delete(k0);
      }
      return result;
    },

    async _compute(description, type, amount) {
      const desc = norm(description);
      if (!desc || desc.length < 2) return null;
      const uid = window.S.user.id;

      // 1. Histórico exato
      const all = await window.db.transactions.where('userId').equals(uid).toArray();
      const exact = all.find(t => norm(t.description) === desc && (!type || t.type === type));
      if (exact) return { categoryId: exact.categoryId, source: 'history', confidence: 100, reason: 'Transação idêntica' };

      // 2. TF-IDF com índice invertido
      await Index.build(uid);
      const tokens = tokenize(desc, 3);
      if (tokens.length) {
        const tfidf = Index.score(tokens, type);
        if (tfidf && tfidf.confidence >= 45) return tfidf;
      }

      // 3. Fuzzy match clássico (fallback)
      if (tokens.length) {
        const scores = new Map();
        for (const t of all) {
          if (type && t.type !== type) continue;
          const tdesc = norm(t.description);
          let score = 0;
          for (const tk of tokens) if (tdesc.includes(tk)) score++;
          if (score >= Math.max(1, Math.floor(tokens.length * 0.5))) {
            const daysOld = (Date.now() - new Date(t.date + 'T00:00:00').getTime()) / 86400000;
            const w = Math.exp(-Math.max(0, daysOld) / 270);
            scores.set(t.categoryId, (scores.get(t.categoryId) || 0) + score * w);
          }
        }
        if (scores.size) {
          const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
          const conf = Math.min(88, 42 + sorted[0][1] * 7);
          return { categoryId: sorted[0][0], source: 'fuzzy', confidence: Math.round(conf), reason: 'Padrão similar' };
        }
      }

      // 4. LocalAI Naive Bayes
      if (window.LocalAI && typeof window.LocalAI.classify === 'function') {
        try {
          const r = window.LocalAI.classify(description);
          if (r?.categoryId) return { categoryId: r.categoryId, source: 'localai', confidence: Math.round((r.confidence || 0) * 100) || 58, reason: 'Modelo aprendido' };
        } catch {}
      }

      // 5. Regras de palavras-chave expandidas (200+)
      const RULES = [
        { rx: /(uber|99|cabify|taxi|metro|onibus|bus|combustivel|gasolina|etanol|posto|estacion|pedágio|pedagio|vaga|park)/i, cat: 'Transporte' },
        { rx: /(mercado|super|padaria|restaurant|ifood|rappi|lanche|cafe|café|comida|almoco|almoço|jantar|pizza|burger|hamburguer|açai|acai|sushi|churrasco|delivery|marmita|prato)/i, cat: 'Alimentação' },
        { rx: /(aluguel|condom|condomínio|luz|energia|água|agua|gas|gás|internet|telefone|celular|tim|claro|vivo|oi|net|sky|portao|portão|iptu|agua)/i, cat: 'Moradia' },
        { rx: /(farmac|drogaria|medic|medicament|consulta|hospital|exame|plano.*saude|saude|odonto|dentista|fisio|therapy|psicolog|nutricion|vacina)/i, cat: 'Saúde' },
        { rx: /(escola|curso|faculdade|universidade|livro|udemy|coursera|aula|estudo|alura|dio|bootcamp|certificado|cursinho|colegio)/i, cat: 'Educação' },
        { rx: /(cinema|netflix|spotify|prime|disney|hbo|max|paramount|apple.*tv|game|jogo|show|teatro|evento|ingress|bilhete|parque|museu|serv.*stream)/i, cat: 'Lazer' },
        { rx: /(amazon|shopee|mercado.*livre|magalu|americanas|renner|zara|hm|h&m|totvs|roupa|sapato|tênis|tenis|roupas|moda|vestuario|vestuário)/i, cat: 'Compras' },
        { rx: /(academia|gym|pilates|crossfit|swim|natação|natacao|spinning|yoga|personal|musculação|musculacao|smartfit|bodytech)/i, cat: 'Saúde' },
        { rx: /(salário|salario|holerite|pagamento.*sal|recib|remuner|contra.*cheque)/i, cat: 'Salário', type: 'income' },
        { rx: /(freela|freelance|projeto|servico|serviço|consultoria|honorari|autônom|autonomo|mei)/i, cat: 'Freelance', type: 'income' },
        { rx: /(seguro|segur.*auto|segur.*vida|segur.*saude|segur.*imovel|previdencia|previdência)/i, cat: 'Seguros' },
        { rx: /(viagem|hotel|pousada|airbnb|booking|passagem|aerea|rodoviaria|rodoviária|cruzeiro|tour|turism)/i, cat: 'Viagem' },
        { rx: /(pet|veterinar|ração|racao|dog|cat|animal|bicho|clinica.*animal)/i, cat: 'Pet' },
        { rx: /(luz|conta.*energia|enel|cemig|cpfl|coelba|cegás|celesc)/i, cat: 'Moradia' },
        { rx: /(cartão|cartao|anuidade|tarifa|taxa.*banco|taxa.*cartão|manut.*conta|mensalidade.*banco)/i, cat: 'Taxas Bancárias' },
        { rx: /(salão|salao|cabeleire|barbearia|manicure|pedicure|estetica|estética|beleza|spa|massagem)/i, cat: 'Beleza' },
        { rx: /(presentes|presente|gift|lembranca|lembranças|aniversario|aniversário|festas|festa)/i, cat: 'Presentes' },
        { rx: /(investiment|ações|acoes|fundo|tesouro|fii|cdb|poupança|poupanca|bolsa|corretora)/i, cat: 'Investimentos', type: 'expense' },
        { rx: /(dividendo|rendimento|juros|lucro.*investiment|rendimento.*investiment)/i, cat: 'Investimentos', type: 'income' },
        { rx: /(manut|conserto|reparo|instalação|instalacao|eletricista|encanador|pintura|reforma|limpeza.*casa)/i, cat: 'Casa' },
      ];
      for (const k of RULES) {
        if (k.type && type && k.type !== type) continue;
        if (k.rx.test(description)) {
          const cats = window.S.cats || [];
          const c = cats.find(c => norm(c.name).includes(norm(k.cat)) || norm(k.cat).includes(norm(c.name)));
          if (c) return { categoryId: c.id, source: 'rule', confidence: 68, reason: 'Palavra-chave reconhecida' };
        }
      }

      return null;
    },

    invalidate() { this._cache.clear(); Index.invalidate(); },

    async learnFromTx(tx) {
      try {
        if (!window.LocalAI || !tx.description || !tx.categoryId) return;
        const cat = (window.S.cats || []).find(c => c.id === tx.categoryId);
        if (cat && typeof window.LocalAI.train === 'function') {
          window.LocalAI.train(tx.description, cat.name, tx.type);
          try { if (typeof window.LocalAI.saveModel === 'function') window.LocalAI.saveModel(); } catch {}
        }
        this.invalidate();
      } catch (e) { console.warn('[AI_PRO] learnFromTx', e); }
    },
  };

  /* ═══════════════════════════════════════════════════════════
     2. INPUT ASSISTANT v2 — autocomplete de descrição + hint
  ═══════════════════════════════════════════════════════════ */
  const InputAssist = {
    _bound: false,
    _debounce: null,
    _modalObserver: null,

    init() {
      if (this._bound) return;
      this._bound = true;
      this._modalObserver = new MutationObserver(() => this._tryBindModal());
      this._modalObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      this._tryBindModal();
    },

    _tryBindModal() {
      const modal = $('modalTx') || $('newTxModal') || $('modalTransaction');
      if (!modal) return;
      const desc = modal.querySelector('#txDesc') || modal.querySelector('input[name="description"]') || modal.querySelector('textarea[name="description"]');
      const select = modal.querySelector('#txCategory') || modal.querySelector('select[name="category"]');
      const amount = modal.querySelector('#txAmount') || modal.querySelector('input[name="amount"]');
      if (!desc || desc.dataset.aiProBound) return;
      desc.dataset.aiProBound = '1';

      // hint de categoria
      let hint = $('aiProInputHint');
      if (!hint) {
        hint = document.createElement('div');
        hint.id = 'aiProInputHint';
        hint.className = 'fp-ai-hint hidden';
        const wrap = desc.closest('.form-group') || desc.parentElement;
        if (wrap) wrap.appendChild(hint);
      }

      // dropdown de autocomplete
      let dropdown = $('aiProDescDrop');
      if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'aiProDescDrop';
        dropdown.className = 'fp-ai-desc-drop hidden';
        const dropParent = desc.closest('.form-group') || desc.parentElement;
        if (dropParent) {
          if (getComputedStyle(dropParent).position === 'static') dropParent.style.position = 'relative';
          dropParent.appendChild(dropdown);
        }
      }

      const trigger = () => {
        clearTimeout(this._debounce);
        this._debounce = setTimeout(async () => {
          await this._update(desc, select, amount, hint);
          await this._autocomplete(desc, dropdown);
        }, 300);
      };
      desc.addEventListener('input', trigger);
      desc.addEventListener('blur', () => setTimeout(() => dropdown.classList.add('hidden'), 200));
      desc.addEventListener('focus', trigger);
      const obs = new MutationObserver(() => {
        if (!desc.value) { hint.classList.add('hidden'); dropdown.classList.add('hidden'); }
      });
      obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
    },

    async _autocomplete(descEl, dropdown) {
      const value = (descEl.value || '').trim();
      if (!value || value.length < 2) { dropdown.classList.add('hidden'); return; }
      const uid = window.S?.user?.id;
      if (!uid) return;
      const all = await window.db.transactions.where('userId').equals(uid).toArray();
      const q = norm(value);
      const seen = new Set();
      const matches = [];
      for (const t of all) {
        const n = norm(t.description);
        if (n.includes(q) && !seen.has(t.description) && norm(t.description) !== q) {
          seen.add(t.description);
          matches.push(t.description);
          if (matches.length >= 5) break;
        }
      }
      if (!matches.length) { dropdown.classList.add('hidden'); return; }
      dropdown.innerHTML = matches.map(m =>
        `<div class="fp-ai-desc-item" data-val="${esc(m)}">${esc(m)}</div>`
      ).join('');
      dropdown.classList.remove('hidden');
      dropdown.querySelectorAll('.fp-ai-desc-item').forEach(item => {
        item.onmousedown = () => {
          descEl.value = item.dataset.val;
          descEl.dispatchEvent(new Event('input', { bubbles: true }));
          dropdown.classList.add('hidden');
        };
      });
    },

    async _update(descEl, selectEl, amountEl, hintEl) {
      const value = (descEl.value || '').trim();
      if (!value || value.length < 3) { hintEl.classList.add('hidden'); return; }
      const typeBtn = document.querySelector('.type-btn.active-expense, .type-btn.active-income, .type-btn.active-transfer');
      let type = null;
      if (typeBtn) {
        if (typeBtn.classList.contains('active-expense')) type = 'expense';
        else if (typeBtn.classList.contains('active-income')) type = 'income';
        else type = 'transfer';
      } else if (window._activeTxType) type = window._activeTxType;
      const amount = amountEl ? parseFloat(amountEl.value) : null;
      const result = await Classifier.classify(value, type, amount);
      if (!result?.categoryId) { hintEl.classList.add('hidden'); return; }
      const cat = (window.S.cats || []).find(c => c.id === result.categoryId);
      if (!cat) { hintEl.classList.add('hidden'); return; }

      let anomalyHtml = '';
      if (amount && type === 'expense') {
        const anomaly = await this._checkAnomaly(value, amount, result.categoryId);
        if (anomaly) anomalyHtml = `<div class="fp-ai-hint-anomaly"><i class="fas fa-exclamation-triangle"></i> ${anomaly}</div>`;
      }

      const confColor = result.confidence >= 80 ? 'var(--success)' : result.confidence >= 60 ? 'var(--warning)' : 'var(--txt2)';
      hintEl.classList.remove('hidden');
      hintEl.innerHTML = `
        <div class="fp-ai-hint-row">
          <i class="fas fa-magic"></i>
          <span class="fp-ai-hint-label">IA sugere:</span>
          <span class="fp-ai-hint-cat" style="background:${esc(cat.color || '#888')}">
            <i class="fas ${esc(cat.icon || 'fa-tag')}"></i> ${esc(cat.name)}
          </span>
          <span class="fp-ai-hint-conf" style="color:${confColor}">${result.confidence}%</span>
          <button type="button" class="fp-ai-hint-apply">Aplicar</button>
          <button type="button" class="fp-ai-hint-dismiss" title="Ignorar"><i class="fas fa-times"></i></button>
        </div>
        <div class="fp-ai-hint-reason"><i class="fas fa-info-circle" style="opacity:.5"></i> ${esc(result.reason)}</div>
        ${anomalyHtml}
      `;
      hintEl.querySelector('.fp-ai-hint-apply').onclick = () => {
        if (selectEl) { selectEl.value = String(result.categoryId); selectEl.dispatchEvent(new Event('change', { bubbles: true })); }
        hintEl.classList.add('hidden');
        T('Categoria aplicada!', 'success', 1800);
      };
      hintEl.querySelector('.fp-ai-hint-dismiss').onclick = () => hintEl.classList.add('hidden');
    },

    async _checkAnomaly(desc, amount, categoryId) {
      const uid = window.S.user.id;
      const since = new Date(); since.setDate(since.getDate() - 90);
      const sinceStr = since.toISOString().split('T')[0];
      const txs = await window.db.transactions.where('userId').equals(uid)
        .filter(t => t.date >= sinceStr && t.type === 'expense' && t.categoryId === categoryId).toArray();
      if (txs.length < 3) return null;
      const vals = txs.map(t => Number(t.amount) || 0).sort((a, b) => a - b);
      const median = vals[Math.floor(vals.length / 2)];
      if (median <= 0) return null;
      if (amount > median * 2.5) return `Valor ${(amount / median).toFixed(1)}× acima da sua mediana nesta categoria (${fmtMoney(median)}).`;
      return null;
    },
  };

  /* ═══════════════════════════════════════════════════════════
     3. INSIGHTS ENGINE v2 — 12 tipos de análise proativa
  ═══════════════════════════════════════════════════════════ */
  const Insights = {
    async generateAll() {
      const uid = window.S.user.id;
      const all = await window.db.transactions.where('userId').equals(uid).toArray();
      const cats = window.S.cats || [];
      const dismissed = await getPref('aiProDismissedInsights', []);

      const generators = [
        this._hiddenSubscriptions,
        this._budgetSuggestions,
        this._balanceForecast,
        this._spendingTrends,
        this._smartTips,
        this._savingsRate,
        this._subscriptionTotal,
        this._incomeVariability,
        this._weekendPattern,
        this._topMerchants,
        this._cashFlowAlert,
        this._yearComparison,
      ];

      const raw = [];
      for (const gen of generators) {
        try { raw.push(...(await gen.call(this, all, cats, uid))); } catch {}
      }

      return raw.filter(i => i && !dismissed.includes(i._id)).slice(0, 12);
    },

    async _hiddenSubscriptions(all, cats, uid) {
      const declared = await window.db.subscriptions.where('userId').equals(uid).toArray();
      const declaredKeys = new Set(declared.map(s => norm(s.name)));
      const groups = new Map();
      for (const t of all) {
        if (t.type !== 'expense') continue;
        const k = norm(t.description);
        if (!k) continue;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(t);
      }
      const found = [];
      for (const [k, txs] of groups) {
        if (txs.length < 3 || declaredKeys.has(k)) continue;
        const dates = txs.map(t => new Date(t.date).getTime()).sort((a, b) => a - b);
        const intervals = [];
        for (let i = 1; i < dates.length; i++) intervals.push((dates[i] - dates[i - 1]) / 86400000);
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        if (avg < 20 || avg > 40) continue;
        const amounts = txs.map(t => Number(t.amount) || 0);
        const avgAmt = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const variance = Math.max(...amounts) - Math.min(...amounts);
        if (variance > avgAmt * 0.4) continue;
        found.push({
          _id: 'hs_' + k,
          type: 'hidden_sub', severity: 'info', icon: 'fa-eye',
          title: 'Assinatura não declarada?',
          message: `"${txs[0].description}" se repete ~mensalmente (${fmtMoney(avgAmt)}/mês). Cadastre como assinatura para melhor controle.`,
          action: { label: 'Ver detalhes', data: { description: txs[0].description, amount: avgAmt } }
        });
      }
      return found.slice(0, 2);
    },

    async _budgetSuggestions(all, cats, uid) {
      const out = [];
      const budgets = await window.db.budgets.where('userId').equals(uid).toArray();
      const budgetCats = new Set(budgets.map(b => b.categoryId));
      const now = new Date();
      const months = [];
      for (let i = 1; i <= 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(monthKey(d));
      }
      for (const c of cats.filter(c => c.type === 'expense')) {
        if (budgetCats.has(c.id)) continue;
        const monthly = months.map(m => all.filter(t => t.type === 'expense' && t.categoryId === c.id && t.date?.startsWith(m)).reduce((s, t) => s + Number(t.amount || 0), 0));
        if (monthly.every(v => v === 0)) continue;
        const sorted = [...monthly].sort((a, b) => a - b);
        const median = sorted[1] || 0;
        if (median < 30) continue;
        out.push({
          _id: 'bs_' + c.id,
          type: 'budget_suggest', severity: 'tip', icon: 'fa-bullseye',
          title: `Criar orçamento para ${c.name}?`,
          message: `Mediana dos últimos 3 meses: ${fmtMoney(median)}. Defina um limite para manter o controle.`,
          action: { label: 'Criar orçamento', data: { categoryId: c.id, amount: median } }
        });
      }
      return out.slice(0, 2);
    },

    async _balanceForecast(all, cats, uid) {
      const mk = monthKey();
      const monthTxs = all.filter(t => t.date?.startsWith(mk));
      if (monthTxs.length < 5) return [];
      const days = {};
      for (const t of monthTxs) {
        const d = parseInt(t.date.split('-')[2], 10);
        const v = (Number(t.amount) || 0) * (t.type === 'expense' ? -1 : t.type === 'income' ? 1 : 0);
        days[d] = (days[d] || 0) + v;
      }
      const today = new Date();
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      let cum = 0;
      const points = [];
      for (let d = 1; d <= today.getDate(); d++) {
        cum += (days[d] || 0);
        points.push([d, cum]);
      }
      if (points.length < 3) return [];
      const n = points.length;
      const sumX = points.reduce((s, p) => s + p[0], 0);
      const sumY = points.reduce((s, p) => s + p[1], 0);
      const sumXY = points.reduce((s, p) => s + p[0] * p[1], 0);
      const sumXX = points.reduce((s, p) => s + p[0] * p[0], 0);
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
      const intercept = (sumY - slope * sumX) / n;
      const projected = slope * lastDay + intercept;
      const delta = projected - cum;
      if (Math.abs(delta) < 50) return [];
      return [{
        _id: 'bf_' + mk,
        type: 'forecast', severity: projected < 0 || delta < -300 ? 'warning' : 'insight', icon: 'fa-chart-line',
        title: 'Projeção de saldo no fim do mês',
        message: `Mantendo o ritmo, você terminará o mês em ${fmtMoney(projected)} (${delta >= 0 ? '+' : ''}${fmtMoney(delta)} em relação a hoje).`,
      }];
    },

    async _spendingTrends(all, cats) {
      const out = [];
      const now = new Date();
      const thisMonth = monthKey(now);
      const lastMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const grpThis = {}, grpLast = {};
      for (const t of all) {
        if (t.type !== 'expense' || !t.date) continue;
        if (t.date.startsWith(thisMonth)) grpThis[t.categoryId] = (grpThis[t.categoryId] || 0) + Number(t.amount || 0);
        else if (t.date.startsWith(lastMonth)) grpLast[t.categoryId] = (grpLast[t.categoryId] || 0) + Number(t.amount || 0);
      }
      for (const cid of Object.keys(grpThis)) {
        const a = grpThis[cid], b = grpLast[cid] || 0;
        if (b < 50 || a < b * 1.35) continue;
        const cat = cats.find(c => c.id == cid);
        if (!cat) continue;
        const pct = Math.round((a / b - 1) * 100);
        out.push({
          _id: 'st_' + cid + '_' + thisMonth,
          type: 'trend_up', severity: 'warning', icon: 'fa-arrow-trend-up',
          title: `${cat.name} subiu ${pct}% este mês`,
          message: `Este mês: ${fmtMoney(a)} · Mês passado: ${fmtMoney(b)}.`,
        });
      }
      return out.slice(0, 2);
    },

    async _smartTips(all, cats, uid) {
      const out = [];
      const t30 = new Date(); t30.setDate(t30.getDate() - 30);
      const recent = all.filter(t => t.date && new Date(t.date) >= t30);
      const uncat = recent.filter(t => !t.categoryId).length;
      if (uncat >= 4) {
        out.push({
          _id: 'uncat_tip',
          type: 'uncategorized', severity: 'tip', icon: 'fa-tags',
          title: `${uncat} transações sem categoria`,
          message: `Nos últimos 30 dias. A IA pode classificar automaticamente e melhorar as análises.`,
          action: { label: 'Auto-categorizar', kind: 'autocategorize' }
        });
      }
      // Dia da semana mais caro
      const byDay = [0, 0, 0, 0, 0, 0, 0];
      for (const t of recent) {
        if (t.type !== 'expense') continue;
        const d = new Date(t.date + 'T00:00:00').getDay();
        byDay[d] += Number(t.amount || 0);
      }
      const maxVal = Math.max(...byDay);
      if (maxVal > 0) {
        const maxDay = byDay.indexOf(maxVal);
        const nonZero = byDay.map((v, i) => ({ v, i })).filter(x => x.v > 0).sort((a, b) => a.v - b.v);
        const minEntry = nonZero[0];
        const names = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
        out.push({
          _id: 'weekday_tip',
          type: 'weekday_pattern', severity: 'insight', icon: 'fa-calendar-day',
          title: 'Padrão semanal de gastos',
          message: `Você gasta mais às ${names[maxDay]} (${fmtMoney(maxVal)})${minEntry ? ` e menos às ${names[minEntry.i]} (${fmtMoney(minEntry.v)})` : ''}.`,
        });
      }
      return out;
    },

    async _savingsRate(all, cats, uid) {
      const mk = monthKey();
      const m = all.filter(t => t.date?.startsWith(mk));
      const inc = m.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
      const exp = m.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
      if (inc < 100) return [];
      const rate = ((inc - exp) / inc) * 100;
      const target = 20;
      if (Math.abs(rate) < 2) return [];
      return [{
        _id: 'sr_' + mk,
        type: 'savings', severity: rate >= target ? 'success' : rate >= 5 ? 'tip' : 'warning',
        icon: rate >= target ? 'fa-piggy-bank' : 'fa-chart-pie',
        title: `Taxa de poupança: ${rate.toFixed(1)}%`,
        message: rate >= target
          ? `Ótimo! Você está poupando ${fmtMoney(inc - exp)} (${rate.toFixed(1)}%) da renda deste mês. Meta recomendada: 20%.`
          : rate >= 0
          ? `Você poupou ${fmtMoney(inc - exp)} este mês (${rate.toFixed(1)}%). Tente chegar a 20% — faltam ${fmtMoney(inc * 0.2 - (inc - exp))}.`
          : `Atenção: seus gastos (${fmtMoney(exp)}) superam a renda (${fmtMoney(inc)}) este mês em ${fmtMoney(exp - inc)}.`,
      }];
    },

    async _subscriptionTotal(all, cats, uid) {
      const declared = await window.db.subscriptions.where('userId').equals(uid).toArray();
      if (!declared.length) return [];
      const total = declared.reduce((s, sub) => s + Number(sub.amount || 0), 0);
      const mk = monthKey();
      const inc = all.filter(t => t.type === 'income' && t.date?.startsWith(mk)).reduce((s, t) => s + Number(t.amount || 0), 0);
      const pct = inc > 0 ? ((total / inc) * 100).toFixed(1) : null;
      if (total < 30) return [];
      return [{
        _id: 'sub_total',
        type: 'subscription', severity: pct && parseFloat(pct) > 15 ? 'warning' : 'info',
        icon: 'fa-layer-group',
        title: `${declared.length} assinaturas ativas — ${fmtMoney(total)}/mês`,
        message: pct
          ? `Suas assinaturas representam ${pct}% da renda deste mês.${parseFloat(pct) > 15 ? ' Revise para reduzir gastos fixos.' : ''}`
          : `Total de assinaturas declaradas: ${fmtMoney(total)} por mês.`,
      }];
    },

    async _incomeVariability(all, cats, uid) {
      const months = [];
      const now = new Date();
      for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mk = monthKey(d);
        const inc = all.filter(t => t.type === 'income' && t.date?.startsWith(mk)).reduce((s, t) => s + Number(t.amount || 0), 0);
        if (inc > 0) months.push(inc);
      }
      if (months.length < 3) return [];
      const avg = months.reduce((s, v) => s + v, 0) / months.length;
      const stdDev = Math.sqrt(months.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / months.length);
      const cv = (stdDev / avg) * 100;
      if (cv < 15) return [];
      return [{
        _id: 'inc_var',
        type: 'income_var', severity: cv > 40 ? 'warning' : 'insight',
        icon: 'fa-wave-square',
        title: `Renda variável (CV: ${cv.toFixed(0)}%)`,
        message: `Sua renda dos últimos 6 meses oscilou bastante (média ${fmtMoney(avg)}, desvio ±${fmtMoney(stdDev)}). Planeje uma reserva para os meses mais fracos.`,
      }];
    },

    async _weekendPattern(all, cats) {
      const t90 = new Date(); t90.setDate(t90.getDate() - 90);
      const recent = all.filter(t => t.type === 'expense' && t.date && new Date(t.date) >= t90);
      let weekdayTotal = 0, weekendTotal = 0, weekdayDays = 0, weekendDays = 0;
      for (const t of recent) {
        const dow = new Date(t.date + 'T00:00:00').getDay();
        const isWeekend = dow === 0 || dow === 6;
        const v = Number(t.amount || 0);
        if (isWeekend) { weekendTotal += v; weekendDays++; }
        else { weekdayTotal += v; weekdayDays++; }
      }
      if (weekdayDays < 5 || weekendDays < 2) return [];
      const wdAvg = weekdayTotal / weekdayDays;
      const weAvg = weekendTotal / weekendDays;
      const ratio = weAvg / (wdAvg || 1);
      if (ratio < 1.4 && ratio > 0.6) return [];
      return [{
        _id: 'weekend_pat',
        type: 'weekend', severity: 'insight', icon: 'fa-umbrella-beach',
        title: ratio > 1.4 ? `Fins de semana custam ${ratio.toFixed(1)}× mais` : 'Você gasta mais nos dias úteis',
        message: ratio > 1.4
          ? `Média por dia: R$ ${wdAvg.toFixed(0)} (semana) vs R$ ${weAvg.toFixed(0)} (fim de semana).`
          : `Média por dia: R$ ${weAvg.toFixed(0)} (fim de semana) vs R$ ${wdAvg.toFixed(0)} (semana).`,
      }];
    },

    async _topMerchants(all, cats) {
      const t30 = new Date(); t30.setDate(t30.getDate() - 30);
      const recent = all.filter(t => t.type === 'expense' && t.date && new Date(t.date) >= t30 && t.description);
      const merchants = new Map();
      for (const t of recent) {
        const k = norm(t.description).split(' ').slice(0, 2).join(' ');
        if (!k) continue;
        merchants.set(k, (merchants.get(k) || 0) + Number(t.amount || 0));
      }
      if (merchants.size < 3) return [];
      const top = [...merchants.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      return [{
        _id: 'top_merch_' + monthKey(),
        type: 'merchants', severity: 'insight', icon: 'fa-store',
        title: 'Onde você mais gastou este mês',
        message: top.map(([m, v], i) => `${i + 1}. ${m} — ${fmtMoney(v)}`).join(' · '),
      }];
    },

    async _cashFlowAlert(all, cats, uid) {
      const today = new Date();
      const daysLeft = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate();
      if (daysLeft > 10) return [];
      const mk = monthKey();
      const m = all.filter(t => t.date?.startsWith(mk));
      const inc = m.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
      const exp = m.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
      const balance = inc - exp;
      if (balance >= 0) return [];
      return [{
        _id: 'cf_alert_' + mk,
        type: 'cashflow', severity: 'alert', icon: 'fa-triangle-exclamation',
        title: `Saldo negativo no mês — ${daysLeft} dias restantes`,
        message: `Receitas (${fmtMoney(inc)}) – Despesas (${fmtMoney(exp)}) = ${fmtMoney(balance)}. Cuidado com novos gastos.`,
      }];
    },

    async _yearComparison(all, cats) {
      const now = new Date();
      const mk = monthKey(now);
      const mkLy = `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const expThis = all.filter(t => t.type === 'expense' && t.date?.startsWith(mk)).reduce((s, t) => s + Number(t.amount || 0), 0);
      const expLy = all.filter(t => t.type === 'expense' && t.date?.startsWith(mkLy)).reduce((s, t) => s + Number(t.amount || 0), 0);
      if (expLy < 100 || expThis < 100) return [];
      const diff = expThis - expLy;
      const pct = Math.round((diff / expLy) * 100);
      if (Math.abs(pct) < 5) return [];
      return [{
        _id: 'yoy_' + mk,
        type: 'year_cmp', severity: pct > 20 ? 'warning' : 'insight', icon: 'fa-calendar-check',
        title: `${Math.abs(pct)}% ${pct > 0 ? 'mais' : 'menos'} vs mesmo mês ano passado`,
        message: `Este mês: ${fmtMoney(expThis)} vs ${fmtMoney(expLy)} em ${mkLy}. Variação: ${pct > 0 ? '+' : ''}${fmtMoney(diff)}.`,
      }];
    },
  };

  /* ═══════════════════════════════════════════════════════════
     4. NL COMMANDS v2 — português mais rico
  ═══════════════════════════════════════════════════════════ */
  const NLCommands = {
    _ptNumbers: {
      zero:0,um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,
      dez:10,onze:11,doze:12,treze:13,quatorze:14,quinze:15,dezesseis:16,dezessete:17,dezoito:18,dezenove:19,
      vinte:20,trinta:30,quarenta:40,cinquenta:50,sessenta:60,setenta:70,oitenta:80,noventa:90,
      cem:100,cento:100,duzentos:200,trezentos:300,quatrocentos:400,quinhentos:500,
      seiscentos:600,setecentos:700,oitocentos:800,novecentos:900,
      mil:1000,
    },

    _parseAmount(text) {
      const n = norm(text);
      // Número direto
      const numMatch = n.match(/(\d+(?:[.,]\d+)?)/);
      if (numMatch) return parseFloat(numMatch[1].replace(',', '.'));
      // Número por extenso
      const words = n.split(/\s+/);
      let total = 0, current = 0;
      for (const w of words) {
        const v = this._ptNumbers[w];
        if (v === undefined) continue;
        if (v === 1000) { total += (current || 1) * 1000; current = 0; }
        else current += v;
      }
      return total + current || null;
    },

    async run(input) {
      const txt = String(input || '').trim();
      if (!txt) return { type: 'error', message: 'Digite algo.' };
      const q = norm(txt);

      // Criação de transação (+ número / - número)
      const txMatch = txt.match(/^([+-]?)\s*(\d+(?:[.,]\d+)?)\s+(.+)$/i);
      if (txMatch) {
        const sign = txMatch[1] === '-' ? 'income' : 'expense';
        const amount = parseFloat(txMatch[2].replace(',', '.'));
        return await this._createTx(sign, amount, txMatch[3]);
      }

      // Consultas
      if (/quanto.*gast|total.*gast|gast.*quanto|gast.*total/.test(q)) return await this._queryExpense(txt);
      if (/quanto.*receb|total.*receb|receit|rend/.test(q)) return await this._queryIncome(txt);
      if (/saldo|balanc/.test(q)) return await this._querySaldo(txt);
      if (/maior.*gast|top.*categor|categor.*top/.test(q)) return await this._queryTop(txt);
      if (/subscric|assinatura|servic.*pag|plano/.test(q)) return await this._querySubscriptions();
      if (/meta|objetivo|goal/.test(q)) return await this._queryGoals();
      if (/relatorio|resumo.*mes|mes.*resumo/.test(q)) return await this._monthlySummary();

      return { type: 'help', message: 'Tente:\n• "+50 alimentação almoço"\n• "quanto gastei com comida este mês"\n• "saldo de julho"\n• "top categorias"\n• "resumo do mês"' };
    },

    async _createTx(type, amount, rest) {
      const cats = window.S.cats || [];
      const tokens = rest.split(/\s+/);
      let categoryId = null, descTokens = [];
      for (const tk of tokens) {
        const c = cats.find(c => norm(c.name).startsWith(norm(tk)));
        if (c && !categoryId) categoryId = c.id;
        else descTokens.push(tk);
      }
      const description = descTokens.join(' ').trim() || rest.trim();
      if (!categoryId) {
        const guess = await Classifier.classify(description, type, amount);
        if (guess) categoryId = guess.categoryId;
      }
      const accs = window.S.accs || [];
      const accountId = (accs[0] || {}).id;
      if (!accountId) return { type: 'error', message: 'Crie ao menos uma conta primeiro.' };
      const tx = { userId: window.S.user.id, type, amount, description, categoryId, accountId, date: todayStr(), tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const id = await window.db.transactions.add(tx);
      Classifier.learnFromTx(tx);
      const c = cats.find(c => c.id === categoryId);
      return { type: 'success', message: `${type === 'expense' ? 'Despesa' : 'Receita'} de ${fmtMoney(amount)} adicionada${c ? ' em "' + c.name + '"' : ''}.`, data: { txId: id } };
    },

    async _queryExpense(text) {
      const uid = window.S.user.id;
      const all = await window.db.transactions.where('userId').equals(uid).toArray();
      const filtered = this._filterByText(all, text, 'expense', window.S.cats || []);
      const total = filtered.reduce((s, t) => s + Number(t.amount || 0), 0);
      return { type: 'answer', message: `Você gastou **${fmtMoney(total)}** (${filtered.length} transações).`, data: { transactions: filtered.slice(0, 10) } };
    },

    async _queryIncome(text) {
      const uid = window.S.user.id;
      const all = await window.db.transactions.where('userId').equals(uid).toArray();
      const filtered = this._filterByText(all, text, 'income', window.S.cats || []);
      const total = filtered.reduce((s, t) => s + Number(t.amount || 0), 0);
      return { type: 'answer', message: `Você recebeu **${fmtMoney(total)}** (${filtered.length} transações).` };
    },

    async _querySaldo(text) {
      const uid = window.S.user.id;
      const all = await window.db.transactions.where('userId').equals(uid).toArray();
      const period = this._extractPeriod(text);
      const filtered = period ? all.filter(t => t.date && t.date >= period.from && t.date <= period.to) : all;
      const inc = filtered.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
      const exp = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
      return { type: 'answer', message: `Saldo${period ? ` (${period.label})` : ''}: **${fmtMoney(inc - exp)}**\nReceitas: ${fmtMoney(inc)} · Despesas: ${fmtMoney(exp)}` };
    },

    async _queryTop(text) {
      const uid = window.S.user.id;
      const all = await window.db.transactions.where('userId').equals(uid).toArray();
      const period = this._extractPeriod(text) || this._currentMonthPeriod();
      const cats = window.S.cats || [];
      const filtered = all.filter(t => t.type === 'expense' && t.date && t.date >= period.from && t.date <= period.to);
      const byCat = {};
      for (const t of filtered) byCat[t.categoryId] = (byCat[t.categoryId] || 0) + Number(t.amount || 0);
      const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const lines = sorted.map(([cid, v], i) => {
        const c = cats.find(c => c.id == cid);
        return `${i + 1}. ${c ? c.name : 'Sem categoria'}: **${fmtMoney(v)}**`;
      });
      return { type: 'answer', message: `Top categorias (${period.label}):\n${lines.join('\n')}` };
    },

    async _querySubscriptions() {
      const uid = window.S.user.id;
      const subs = await window.db.subscriptions.where('userId').equals(uid).toArray();
      if (!subs.length) return { type: 'answer', message: 'Nenhuma assinatura cadastrada ainda.' };
      const total = subs.reduce((s, sub) => s + Number(sub.amount || 0), 0);
      const lines = subs.map(s => `• ${s.name}: **${fmtMoney(s.amount)}**`);
      return { type: 'answer', message: `${subs.length} assinatura(s) — **${fmtMoney(total)}/mês**:\n${lines.join('\n')}` };
    },

    async _queryGoals() {
      const uid = window.S.user.id;
      const goals = await window.db.goals.where('userId').equals(uid).toArray().catch(() => []);
      if (!goals.length) return { type: 'answer', message: 'Nenhuma meta cadastrada ainda.' };
      const lines = goals.map(g => {
        const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount || 0) / g.targetAmount * 100)) : 0;
        return `• ${g.name}: **${pct}%** concluído (${fmtMoney(g.currentAmount || 0)} / ${fmtMoney(g.targetAmount)})`;
      });
      return { type: 'answer', message: `${goals.length} meta(s):\n${lines.join('\n')}` };
    },

    async _monthlySummary() {
      const uid = window.S.user.id;
      const all = await window.db.transactions.where('userId').equals(uid).toArray();
      const mk = monthKey();
      const m = all.filter(t => t.date?.startsWith(mk));
      const inc = m.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
      const exp = m.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
      const cats = window.S.cats || [];
      const byCat = {};
      for (const t of m) if (t.type === 'expense') byCat[t.categoryId] = (byCat[t.categoryId] || 0) + Number(t.amount || 0);
      const top3 = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cid, v]) => {
        const c = cats.find(c => c.id == cid);
        return `${c?.name || '?'}: ${fmtMoney(v)}`;
      }).join(' · ');
      const rate = inc > 0 ? ((inc - exp) / inc * 100).toFixed(1) : 0;
      return {
        type: 'answer',
        message: `**Resumo de ${mk}:**\nReceitas: ${fmtMoney(inc)}\nDespesas: ${fmtMoney(exp)}\nSaldo: **${fmtMoney(inc - exp)}**\nTaxa de poupança: ${rate}%\nTop gastos: ${top3 || 'Nenhum'}`,
      };
    },

    _filterByText(all, text, type, cats) {
      const q = norm(text);
      const cat = cats.find(c => q.includes(norm(c.name)));
      const period = this._extractPeriod(text);
      return all.filter(t => {
        if (type && t.type !== type) return false;
        if (cat && t.categoryId !== cat.id) return false;
        if (period && (t.date < period.from || t.date > period.to)) return false;
        return true;
      });
    },

    _currentMonthPeriod() {
      const now = new Date();
      const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { from, to, label: 'este mês' };
    },

    _extractPeriod(text) {
      const q = norm(text);
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      if (q.includes('hoje')) { const d = todayStr(); return { from: d, to: d, label: 'hoje' }; }
      if (q.includes('ontem')) { const y = new Date(); y.setDate(y.getDate() - 1); const d = y.toISOString().split('T')[0]; return { from: d, to: d, label: 'ontem' }; }
      if (q.includes('semana')) { const s = new Date(now); s.setDate(s.getDate() - 6); return { from: s.toISOString().split('T')[0], to: todayStr(), label: 'última semana' }; }
      // últimos N dias
      const lastN = q.match(/ultimos?\s+(\d+)\s+dias?/);
      if (lastN) { const s = new Date(now); s.setDate(s.getDate() - parseInt(lastN[1])); return { from: s.toISOString().split('T')[0], to: todayStr(), label: `últimos ${lastN[1]} dias` }; }
      if (/este mes|mes atual/.test(q)) return this._currentMonthPeriod();
      if (/mes passado/.test(q)) {
        const l = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const le = new Date(now.getFullYear(), now.getMonth(), 0);
        return { from: l.toISOString().split('T')[0], to: le.toISOString().split('T')[0], label: 'mês passado' };
      }
      if (/ano passado/.test(q)) {
        return { from: `${now.getFullYear() - 1}-01-01`, to: `${now.getFullYear() - 1}-12-31`, label: 'ano passado' };
      }
      if (/este ano/.test(q)) {
        return { from: `${now.getFullYear()}-01-01`, to: todayStr(), label: 'este ano' };
      }
      const months = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
      for (let i = 0; i < months.length; i++) {
        if (q.includes(months[i])) {
          let y = now.getFullYear();
          if (i > now.getMonth()) y--;
          const from = `${y}-${pad(i + 1)}-01`;
          const to = `${y}-${pad(i + 1)}-${pad(new Date(y, i + 1, 0).getDate())}`;
          return { from, to, label: months[i] };
        }
      }
      return null;
    },
  };

  /* ═══════════════════════════════════════════════════════════
     5. CHAT v2 — streaming · histórico · markdown · voz
  ═══════════════════════════════════════════════════════════ */
  const Chat = {
    history: [],    // [{role, text}]
    _abortCtrl: null,
    _voiceEnabled: false,

    _loadHistory() {
      try {
        const uid = window.S?.user?.id || 'anon';
        return JSON.parse(localStorage.getItem(`fp_chat_${uid}`) || '[]');
      } catch { return []; }
    },
    _saveHistory() {
      try {
        const uid = window.S?.user?.id || 'anon';
        localStorage.setItem(`fp_chat_${uid}`, JSON.stringify(this.history.slice(-60)));
      } catch {}
    },

    install() {
      if ($('aiProChatFab')) return;
      const fab = document.createElement('button');
      fab.id = 'aiProChatFab';
      fab.className = 'fp-ai-chat-fab';
      fab.title = 'Assistente IA (Alt+I)';
      fab.innerHTML = '<i class="fas fa-robot"></i><span class="fp-ai-chat-fab-badge" id="aiChatFabBadge" style="display:none"></span>';
      fab.addEventListener('click', () => this.open());
      document.body.appendChild(fab);
      document.addEventListener('keydown', e => {
        if (e.altKey && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); this.open(); }
      });
    },

    open() {
      let panel = $('aiProChatPanel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'aiProChatPanel';
        panel.className = 'fp-ai-chat-panel';
        panel.innerHTML = `
          <div class="fp-ai-chat-hdr">
            <div class="fp-ai-chat-title">
              <i class="fas fa-robot"></i>
              <span>Assistente IA</span>
              <span class="fp-ai-chat-model-badge" id="aiChatModelBadge"></span>
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <button class="fp-ai-chat-hdr-btn" id="aiProChatExport" title="Exportar conversa"><i class="fas fa-download"></i></button>
              <button class="fp-ai-chat-hdr-btn" id="aiProChatClear" title="Limpar histórico"><i class="fas fa-broom"></i></button>
              <button class="fp-ai-chat-hdr-btn" id="aiProChatVoice" title="Respostas por voz"><i class="fas fa-volume-up"></i></button>
              <button class="fp-ai-chat-hdr-btn" id="aiProChatMic" title="Entrada de voz" style="display:none"><i class="fas fa-microphone"></i></button>
              <button class="fp-ai-chat-close" title="Fechar"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="fp-ai-chat-body" id="aiProChatBody"></div>
          <div class="fp-ai-chat-suggestions" id="aiProChatSugg">
            <button class="fp-ai-chat-chip" data-q="resumo do mês">Resumo do mês</button>
            <button class="fp-ai-chat-chip" data-q="quanto gastei este mês">Gastos deste mês</button>
            <button class="fp-ai-chat-chip" data-q="saldo este mês">Saldo</button>
            <button class="fp-ai-chat-chip" data-q="top categorias">Top categorias</button>
            <button class="fp-ai-chat-chip" data-q="assinaturas">Assinaturas</button>
          </div>
          <div class="fp-ai-chat-input">
            <input type="text" id="aiProChatInput" placeholder="Pergunte ou +50 alimentação almoço" maxlength="500" autocomplete="off">
            <button id="aiProChatSend" title="Enviar"><i class="fas fa-paper-plane"></i></button>
          </div>
        `;
        document.body.appendChild(panel);
        this._restorePanelPosition(panel);
        this._enableDrag(panel);

        panel.querySelector('.fp-ai-chat-close').onclick = () => this.close();
        panel.querySelector('#aiProChatSend').onclick = () => this._send();
        panel.querySelector('#aiProChatInput').addEventListener('keydown', e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._send(); }
        });
        panel.querySelectorAll('.fp-ai-chat-chip').forEach(b => {
          b.onclick = () => { $('aiProChatInput').value = b.dataset.q; this._send(); };
        });
        panel.querySelector('#aiProChatClear').onclick = () => {
          if (!confirm('Limpar todo o histórico do chat?')) return;
          this.history = []; this._saveHistory();
          $('aiProChatBody').innerHTML = '';
          this._addMsg('ai', 'Histórico limpo. Como posso ajudar?');
        };
        panel.querySelector('#aiProChatExport').onclick = () => this._exportHistory();

        // Voz
        this._voiceEnabled = window.App?.state?.settings?.aiVoiceEnabled ?? (localStorage.getItem('aiProVoiceEnabled') === '1');
        const voiceBtn = panel.querySelector('#aiProChatVoice');
        const updateVoiceButton = () => {
          if (!voiceBtn) return;
          voiceBtn.classList.toggle('active', this._voiceEnabled);
          voiceBtn.title = this._voiceEnabled ? 'Respostas por voz ativadas' : 'Respostas por voz desativadas';
          voiceBtn.innerHTML = this._voiceEnabled ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-volume-mute"></i>';
        };
        updateVoiceButton();
        if (voiceBtn) {
          voiceBtn.onclick = async () => {
            this._voiceEnabled = !this._voiceEnabled;
            localStorage.setItem('aiProVoiceEnabled', this._voiceEnabled ? '1' : '0');
            if (typeof savePref === 'function') {
              await savePref('aiVoiceEnabled', this._voiceEnabled);
            }
            updateVoiceButton();
            if (this._voiceEnabled) {
              const useKokoro = localStorage.getItem('tts.useKokoro') === '1';
              await TTS.init({ useNative: !useKokoro });
            }
            T(this._voiceEnabled ? 'Voz do assistente ativada.' : 'Voz do assistente desativada.', 'info', 1800);
          };
        }
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
          const micBtn = panel.querySelector('#aiProChatMic');
          micBtn.style.display = '';
          micBtn.onclick = () => this._startVoice();
        }

        // Carrega histórico
        this.history = this._loadHistory();
        const body = $('aiProChatBody');
        for (const msg of this.history.slice(-20)) {
          const el = document.createElement('div');
          el.className = `fp-ai-chat-msg fp-ai-chat-msg-${msg.role}`;
          el.innerHTML = msg.role === 'user' ? esc(msg.text) : renderMarkdown(msg.text);
          body.appendChild(el);
        }
        if (!this.history.length) {
          this._addMsg('ai', 'Olá! Sou seu assistente financeiro. Pergunte sobre seus gastos, saldo, metas ou diga "+50 alimentação almoço" para criar uma transação rapidamente.');
        }
        this._updateModelBadge();
      }
      panel.classList.add('open');
      setTimeout(() => $('aiProChatInput')?.focus(), 200);
      setTimeout(() => {
        const body = $('aiProChatBody');
        if (body) body.scrollTop = body.scrollHeight;
      }, 250);
    },

    close() { $('aiProChatPanel')?.classList.remove('open'); },

    _restorePanelPosition(panel) {
      const data = localStorage.getItem('aiProChatPanelPos');
      if (!panel || !data) return;
      try {
        const [x, y] = data.split(',').map((v) => Number(v.trim()));
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        panel.style.left = `${Math.min(Math.max(0, x), window.innerWidth - panel.offsetWidth)}px`;
        panel.style.top = `${Math.min(Math.max(0, y), window.innerHeight - panel.offsetHeight)}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
      } catch (err) {
        console.warn('Falha ao restaurar posição do painel de IA:', err);
      }
    },

    _savePanelPosition(panel) {
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      localStorage.setItem('aiProChatPanelPos', `${Math.max(0, Math.round(rect.left))},${Math.max(0, Math.round(rect.top))}`);
    },

    _enableDrag(panel) {
      const hdr = panel.querySelector('.fp-ai-chat-hdr');
      if (!hdr) return;
      hdr.style.cursor = 'grab';
      hdr.style.touchAction = 'none';

      let dragging = false;
      let offsetX = 0;
      let offsetY = 0;

      const startDrag = (e) => {
        if (e.button !== 0 || e.target.closest('button')) return;
        e.preventDefault();
        dragging = true;
        panel.classList.add('dragging');
        const rect = panel.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        panel.style.left = `${rect.left}px`;
        panel.style.top = `${rect.top}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
      };

      const moveDrag = (e) => {
        if (!dragging) return;
        e.preventDefault();
        const x = Math.min(Math.max(0, e.clientX - offsetX), window.innerWidth - panel.offsetWidth);
        const y = Math.min(Math.max(0, e.clientY - offsetY), window.innerHeight - panel.offsetHeight);
        panel.style.left = `${x}px`;
        panel.style.top = `${y}px`;
      };

      const endDrag = (e) => {
        if (!dragging) return;
        dragging = false;
        panel.classList.remove('dragging');
        this._savePanelPosition(panel);
      };

      hdr.addEventListener('pointerdown', startDrag);
      document.addEventListener('pointermove', moveDrag);
      document.addEventListener('pointerup', endDrag);
      document.addEventListener('pointercancel', endDrag);
    },

    _updateModelBadge() {
      const badge = $('aiChatModelBadge');
      if (!badge) return;
      if (window.FP_LLM_PRO?.Engine?.state?.ready) {
        const name = window.FP_LLM_PRO.Engine.state.activeModel?.name || 'LLM';
        badge.textContent = name.split(' ').slice(0, 3).join(' ');
        badge.style.cssText = 'background:#d1fae5;color:#065f46;padding:2px 7px;border-radius:8px;font-size:.62rem;font-weight:700;margin-left:6px;';
      } else if (window.FP_LLM_PRO?.Engine?.state?.localApi) {
        badge.textContent = window.FP_LLM_PRO.Engine.state.localApi.name;
        badge.style.cssText = 'background:#dbeafe;color:#1e40af;padding:2px 7px;border-radius:8px;font-size:.62rem;font-weight:700;margin-left:6px;';
      } else {
        badge.textContent = 'IA local';
        badge.style.cssText = 'background:rgba(255,255,255,.2);color:#fff;padding:2px 7px;border-radius:8px;font-size:.62rem;margin-left:6px;';
      }
    },

    async _send() {
      const inp = $('aiProChatInput');
      const text = (inp.value || '').trim();
      if (!text) return;
      inp.value = '';
      this._addMsg('user', text);
      this.history.push({ role: 'user', text });

      const loadingEl = this._addMsg('ai', '<span class="fp-ai-typing"><span></span><span></span><span></span></span>', true);

      try {
        let response = '';

        // LAYER 1: Criação de transação
        if (/^[+-]?\s*\d/.test(text)) {
          const resp = await NLCommands.run(text);
          response = resp.message;
          this._replaceMsg(loadingEl, response);
          this.history.push({ role: 'ai', text: response });
          this._saveHistory();
          await this._speakIfEnabled(response);
          return;
        }

        // LAYER 2: FinBot
        if (window.FinBot && typeof window.FinBot._answer === 'function') {
          try {
            const fb = await window.FinBot._answer(text);
            const isFallback = !fb || fb.includes('Nao encontrei') || fb.includes('Recebi: "') || fb.includes('Nao entendi');
            if (!isFallback) { response = fb; this._replaceMsg(loadingEl, response); this.history.push({ role: 'ai', text: response }); this._saveHistory(); await this._speakIfEnabled(response); return; }
          } catch {}
        }

        // LAYER 3: NLCommands para consultas financeiras
        if (/quanto|total|saldo|maior|hoje|ontem|semana|mes|resumo|top|assinatura|meta|renda|gast|receb/i.test(text)) {
          const resp = await NLCommands.run(text);
          if (resp.type !== 'help') { response = resp.message; this._replaceMsg(loadingEl, response); this.history.push({ role: 'ai', text: response }); this._saveHistory(); await this._speakIfEnabled(response); return; }
        }

        // LAYER 4: LLM Pro (streaming)
        if (window.FP_LLM_PRO?.Engine?.state?.ready) {
          try {
            const ctx = await this._buildFinancialContext();
            const history = this.history.slice(-8).map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.text}`).join('\n');
            const fullPrompt = `Você é um assistente financeiro pessoal em português. Responda de forma concisa e útil.\n\nContexto financeiro atual:\n${ctx}\n\nConversa recente:\n${history}\n\nUsuário: ${text}\nAssistente:`;

            this._abortCtrl = new AbortController();
            let accum = '';

            if (typeof window.FP_LLM_PRO.Engine.generateStream === 'function') {
              await window.FP_LLM_PRO.Engine.generateStream(
                fullPrompt,
                { maxTokens: 350, temperature: 0.45 },
                (token, current) => {
                  accum = current;
                  loadingEl.innerHTML = renderMarkdown(accum) + '<span class="fp-ai-cursor">▌</span>';
                  const body = $('aiProChatBody');
                  if (body) body.scrollTop = body.scrollHeight;
                }
              );
              loadingEl.innerHTML = renderMarkdown(accum);
            } else {
              const out = await window.FP_LLM_PRO.Engine.generate(fullPrompt, { maxTokens: 350, temperature: 0.45 });
              accum = out?.trim() || '';
              this._replaceMsg(loadingEl, accum || 'Sem resposta do modelo.');
            }

            if (accum.length > 4) {
              response = accum;
              const mdlName = window.FP_LLM_PRO.Engine.state.activeModel?.name || 'LLM';
              loadingEl.innerHTML += `<span style="font-size:.6rem;opacity:.45;display:block;margin-top:4px"><i class="fas fa-microchip"></i> ${esc(mdlName)}</span>`;
              this.history.push({ role: 'ai', text: response });
              this._saveHistory();
              await this._speakIfEnabled(response);
              return;
            }
          } catch (e) { console.warn('[Chat] LLM falhou:', e.message); }
        }

        // LAYER 5: API local
        if (window.FP_LLM_PRO?.Engine?.state?.localApi) {
          try {
            const ctx = await this._buildFinancialContext();
            const out = await window.FP_LLM_PRO.LocalAPI.generate(
              window.FP_LLM_PRO.Engine.state.localApi,
              `Contexto: ${ctx}\nPergunta: ${text}`,
              { maxTokens: 350, temperature: 0.45 }
            );
            if (out?.trim()) { response = out.trim(); this._replaceMsg(loadingEl, response); this.history.push({ role: 'ai', text: response }); this._saveHistory(); await this._speakIfEnabled(response); return; }
          } catch {}
        }

        // LAYER 6: Ajuda
        if (/ajuda|help|o que.*faz|como.*usar/.test(norm(text))) {
          response = `Posso ajudar com:\n• **Criar transações**: "+50 alimentação almoço"\n• **Consultas**: "quanto gastei", "saldo deste mês", "top categorias"\n• **Resumos**: "resumo do mês"\n• **Assinaturas e metas**: "minhas assinaturas", "minhas metas"\n\nCom um **modelo LLM ativo** nas Configurações, respondo qualquer pergunta em linguagem natural!`;
        } else {
          const resp = await NLCommands.run(text);
          response = resp.message;
        }
        this._replaceMsg(loadingEl, response);
        this.history.push({ role: 'ai', text: response });
        this._saveHistory();
        await this._speakIfEnabled(response);
      } catch (e) {
        console.warn(e);
        this._replaceMsg(loadingEl, `Erro: ${e.message || 'falha inesperada'}`);
      }
    },

    async _speakIfEnabled(text) {
      if (!this._voiceEnabled || !text || !window.TTS) return;
      try {
        const useKokoro = localStorage.getItem('tts.useKokoro') === '1';
        await TTS.init({ useNative: !useKokoro });
        TTS.stop();
        await TTS.speak(String(text));
      } catch (err) {
        console.warn('[AI Voice] Falha ao falar resposta:', err);
      }
    },

    async _buildFinancialContext() {
      const uid = window.S.user.id;
      const all = await window.db.transactions.where('userId').equals(uid).toArray();
      const mk = monthKey();
      const m = all.filter(t => t.date?.startsWith(mk));
      const inc = m.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
      const exp = m.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
      const cats = window.S.cats || [];
      const byCat = {};
      for (const t of m) if (t.type === 'expense') byCat[t.categoryId] = (byCat[t.categoryId] || 0) + Number(t.amount || 0);
      const top3 = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cid, v]) => `${cats.find(c => c.id == cid)?.name || '?'}: ${fmtMoney(v)}`).join(', ');
      return `Mês ${mk}: ${m.length} transações | Receitas: ${fmtMoney(inc)} | Despesas: ${fmtMoney(exp)} | Saldo: ${fmtMoney(inc - exp)} | Top gastos: ${top3 || 'N/A'}`;
    },

    _startVoice() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return;
      const rec = new SR();
      rec.lang = 'pt-BR';
      rec.interimResults = false;
      rec.onresult = e => {
        const t = e.results[0][0].transcript;
        $('aiProChatInput').value = t;
        this._send();
      };
      rec.onerror = () => T('Microfone não disponível.', 'warning');
      try { rec.start(); T('Ouvindo...', 'info', 2000); } catch {}
    },

    _exportHistory() {
      const lines = this.history.map(m => `[${m.role.toUpperCase()}] ${m.text}`).join('\n\n');
      const blob = new Blob([lines], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-ia-${todayStr()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    },

    _addMsg(role, html, isLoading = false) {
      const body = $('aiProChatBody');
      if (!body) return null;
      const el = document.createElement('div');
      el.className = `fp-ai-chat-msg fp-ai-chat-msg-${role}`;
      if (role === 'user') el.textContent = html;
      else el.innerHTML = isLoading ? html : renderMarkdown(html);
      if (role === 'ai' && !isLoading) {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'fp-ai-chat-copy';
        copyBtn.title = 'Copiar';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        copyBtn.onclick = () => { navigator.clipboard?.writeText(el.innerText).then(() => T('Copiado!', 'success', 1200)); };
        el.appendChild(copyBtn);
      }
      body.appendChild(el);
      body.scrollTop = body.scrollHeight;
      return el;
    },

    _replaceMsg(el, html) {
      if (!el) return;
      el.innerHTML = renderMarkdown(html);
      const copyBtn = document.createElement('button');
      copyBtn.className = 'fp-ai-chat-copy';
      copyBtn.title = 'Copiar';
      copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
      copyBtn.onclick = () => { navigator.clipboard?.writeText(el.innerText).then(() => T('Copiado!', 'success', 1200)); };
      el.appendChild(copyBtn);
      const body = $('aiProChatBody');
      if (body) body.scrollTop = body.scrollHeight;
    },
  };

  /* ═══════════════════════════════════════════════════════════
     6. INSIGHTS PANEL v2
  ═══════════════════════════════════════════════════════════ */
  const Panel = {
    async render() {
      let panel = $('aiProInsightsPanel');
      if (!panel) {
        const target = $('aiSuggestionsPanel') || document.querySelector('#page-dashboard') || document.querySelector('.dash-bottom');
        if (!target) return;
        panel = document.createElement('div');
        panel.id = 'aiProInsightsPanel';
        panel.className = 'card fp-ai-insights-panel';
        target.parentElement?.insertBefore(panel, target.nextSibling);
      }

      panel.innerHTML = `<div class="card-body" style="padding:1rem"><div style="display:flex;align-items:center;gap:8px"><i class="fas fa-brain" style="color:var(--accent)"></i><span style="font-weight:700;font-size:.9rem">Carregando insights...</span><i class="fas fa-spinner fa-spin" style="color:var(--txt3);font-size:.8rem"></i></div></div>`;

      const list = await Insights.generateAll().catch(() => []);

      panel.innerHTML = `
        <div class="card-hdr">
          <div class="card-title"><i class="fas fa-brain" style="color:var(--accent)"></i> Insights da IA Pro</div>
          <button class="link-btn" id="aiProRefreshBtn"><i class="fas fa-sync-alt"></i> Atualizar</button>
        </div>
        <div class="card-body">
          ${list.length ? list.map(i => `
            <div class="fp-ai-insight fp-ai-insight-${esc(i.severity)}">
              <div class="fp-ai-insight-icon"><i class="fas ${esc(i.icon)}"></i></div>
              <div class="fp-ai-insight-body">
                <div class="fp-ai-insight-title">${esc(i.title)}</div>
                <div class="fp-ai-insight-msg">${esc(i.message)}</div>
                <div style="display:flex;gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap">
                  ${i.action ? `<button class="btn btn-outline btn-xs fp-ai-insight-action" data-action='${esc(JSON.stringify(i.action))}'>${esc(i.action.label)}</button>` : ''}
                  <button class="btn btn-ghost btn-xs fp-ai-insight-dismiss" data-id="${esc(i._id || '')}">Dispensar</button>
                </div>
              </div>
            </div>
          `).join('') : '<div class="empty-state"><i class="fas fa-check-circle empty-icon" style="color:var(--success)"></i><div class="empty-title">Tudo em ordem!</div><div class="empty-text">Nenhum insight crítico no momento.</div></div>'}
        </div>
      `;
      const refreshBtn = $('aiProRefreshBtn');
      if (refreshBtn) refreshBtn.onclick = () => this.render();

      panel.querySelectorAll('.fp-ai-insight-action').forEach(btn => {
        btn.onclick = () => { try { this._handleAction(JSON.parse(btn.dataset.action)); } catch {} };
      });
      panel.querySelectorAll('.fp-ai-insight-dismiss').forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.id;
          if (!id) return;
          const dismissed = await getPref('aiProDismissedInsights', []);
          if (!dismissed.includes(id)) dismissed.push(id);
          await setPref('aiProDismissedInsights', dismissed.slice(-50));
          btn.closest('.fp-ai-insight')?.remove();
        };
      });
    },

    async _handleAction(a) {
      if (a.kind === 'autocategorize') {
        await SmartActions.autoCategorizeAll();
        await this.render();
      } else if (a.data?.categoryId && a.data?.amount) {
        const m = monthKey();
        const exists = await window.db.budgets.where('[userId+monthYear]').equals([window.S.user.id, m]).toArray();
        const existsThis = exists.find(b => b.categoryId === a.data.categoryId);
        if (existsThis) await window.db.budgets.update(existsThis.id, { limitAmount: a.data.amount });
        else await window.db.budgets.add({ userId: window.S.user.id, monthYear: m, categoryId: a.data.categoryId, limitAmount: a.data.amount });
        T('Orçamento criado!', 'success');
        await this.render();
      } else if (a.data?.description) {
        T('Abra a aba Assinaturas para cadastrar.', 'info');
      }
    },
  };

  /* ═══════════════════════════════════════════════════════════
     7. SMART ACTIONS v2
  ═══════════════════════════════════════════════════════════ */
  const SmartActions = {
    async autoCategorizeAll() {
      const uid = window.S.user.id;
      const uncat = await window.db.transactions.where('userId').equals(uid).filter(t => !t.categoryId).toArray();
      if (!uncat.length) { T('Nada para categorizar.', 'info'); return; }
      T(`Categorizando ${uncat.length} transações...`, 'info', 4000);
      let updated = 0;
      for (const t of uncat) {
        const r = await Classifier.classify(t.description, t.type, t.amount);
        if (r?.categoryId && r.confidence >= 60) {
          await window.db.transactions.update(t.id, { categoryId: r.categoryId, updatedAt: new Date().toISOString() });
          updated++;
        }
      }
      T(`Auto-categorização: ${updated}/${uncat.length} atualizadas.`, 'success');
      if (typeof window.refreshActivePage === 'function') window.refreshActivePage();
      else if (typeof window.navigate === 'function' && window.S.currentPage) window.navigate(window.S.currentPage);
    },

    async retrainFromHistory() {
      if (!window.LocalAI?.trainFromHistory) {
        T('Re-treinamento não disponível.', 'warning'); return;
      }
      T('Re-treinando IA com todo o histórico...', 'info', 3000);
      try {
        await window.LocalAI.trainFromHistory();
        Classifier.invalidate();
        T('IA re-treinada com sucesso!', 'success');
      } catch (e) { T('Erro ao re-treinar: ' + e.message, 'error'); }
    },
  };

  /* ═══════════════════════════════════════════════════════════
     8. SMART SETTINGS
  ═══════════════════════════════════════════════════════════ */
  const SmartSettings = {
    async init() {
      if (!await getPref('aiProSmartSettings', true)) return;
      this._autoTheme();
    },
    _autoTheme() {
      if (!window.matchMedia) return;
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener?.('change', e => {
        if (window.S?.settings && !window.S.settings._userPickedTheme)
          if (typeof window.setTheme === 'function') window.setTheme(e.matches ? 'dark' : 'light', false);
      });
    },
  };

  /* ═══════════════════════════════════════════════════════════
     9. UI v2 — MutationObserver + Dexie hooks
  ═══════════════════════════════════════════════════════════ */
  const UI = {
    async injectSettingsCard() {
      const page = $('page-settings') || $('pageSettings') || document.querySelector('[data-page="settings"]');
      if (!page || $('aiProSettingsCard')) return;
      const card = document.createElement('div');
      card.id = 'aiProSettingsCard';
      card.className = 'card fp-ai-settings-card';
      card.innerHTML = `
        <div class="card-hdr">
          <div class="card-title"><i class="fas fa-brain" style="color:var(--accent)"></i> Inteligência Avançada (AI Pro v2)</div>
        </div>
        <div class="card-body">
          ${[
            ['aiProAutoCatToggle', '🪄 Auto-categorização ao digitar', 'Sugere categoria e autocompleta descrição em tempo real.'],
            ['aiProLearnToggle', '🤖 Aprendizado contínuo', 'A IA aprende a cada transação — modelo TF-IDF se atualiza automaticamente.'],
            ['aiProInsightsToggle', '💡 Insights inteligentes (12 tipos)', 'Previsões, padrões, taxa de poupança, assinaturas e muito mais.'],
            ['aiProSmartToggle', '🌓 Tema automático (sistema)', 'Segue o modo claro/escuro do SO.'],
            ['aiProChatToggle', '💬 Assistente conversacional', 'Chat com histórico persistente, Markdown e entrada de voz.'],
          ].map(([id, label, desc]) => `
            <div class="toggle-row">
              <div class="toggle-row-info"><strong>${label}</strong><span>${desc}</span></div>
              <label class="toggle"><input type="checkbox" id="${id}"><span class="toggle-slider"></span></label>
            </div>
          `).join('')}
          <div class="fp-ai-settings-actions">
            <button class="btn btn-outline btn-sm" id="aiProTrainBtn"><i class="fas fa-graduation-cap"></i> Re-treinar IA</button>
            <button class="btn btn-outline btn-sm" id="aiProAutoCatBtn"><i class="fas fa-tags"></i> Auto-categorizar histórico</button>
            <button class="btn btn-outline btn-sm" id="aiProInsightsBtn"><i class="fas fa-brain"></i> Ver insights</button>
            <button class="btn btn-outline btn-sm" id="aiProResetBtn"><i class="fas fa-undo"></i> Resetar IA</button>
            <button class="btn btn-outline btn-sm" id="aiProResetDismissBtn"><i class="fas fa-eye"></i> Restaurar insights</button>
          </div>
          <div class="fp-ai-settings-info">
            <i class="fas fa-shield-alt"></i>
            <span>Toda a IA roda <strong>100% offline</strong>. Índice TF-IDF, 200+ regras, chat com histórico — nada é enviado a servidores.</span>
          </div>
        </div>
      `;
      page.appendChild(card);

      const prefs = {
        aiProAutoCatToggle: 'aiProAutoCat',
        aiProLearnToggle: 'aiProLearn',
        aiProInsightsToggle: 'aiProInsights',
        aiProSmartToggle: 'aiProSmartSettings',
        aiProChatToggle: 'aiProChat',
      };
      for (const [id, pref] of Object.entries(prefs)) {
        const el = $(id);
        el.checked = await getPref(pref, true);
        el.onchange = async e => {
          await setPref(pref, e.target.checked);
          if (pref === 'aiProInsights') { if (e.target.checked) Panel.render(); else $('aiProInsightsPanel')?.remove(); }
          if (pref === 'aiProChat') { const fab = $('aiProChatFab'); if (fab) fab.style.display = e.target.checked ? '' : 'none'; }
        };
      }

      $('aiProTrainBtn').onclick = () => SmartActions.retrainFromHistory();
      $('aiProAutoCatBtn').onclick = () => SmartActions.autoCategorizeAll();
      $('aiProInsightsBtn').onclick = () => Panel.render();
      $('aiProResetBtn').onclick = () => {
        if (!confirm('Resetar todo o aprendizado da IA?')) return;
        try { localStorage.removeItem('LocalAI_v1_model'); localStorage.removeItem('LocalAI_model'); } catch {}
        Classifier.invalidate();
        T('IA resetada. Aprendizado voltará do zero.', 'warning');
      };
      $('aiProResetDismissBtn').onclick = async () => {
        await setPref('aiProDismissedInsights', []);
        T('Insights restaurados!', 'success');
        Panel.render();
      };
    },

    watchSettingsNav() {
      // Escuta o evento de ready disparado por loadSettings()
      window.addEventListener('settingsPageReady', () => {
        if (!$('aiProSettingsCard')) this.injectSettingsCard();
      });
      
      // Usa MutationObserver em vez de setInterval
      const tryInject = () => {
        const page = $('page-settings') || $('pageSettings') || document.querySelector('[data-page="settings"]');
        if (page && !$('aiProSettingsCard')) this.injectSettingsCard();
      };
      const obs = new MutationObserver(tryInject);
      obs.observe(document.body, { childList: true, subtree: true });
      tryInject();
    },

    initLearnHook() {
      // Polling leve de contagem (como antes, mas sem Dexie hooks para compatibilidade máxima)
      let lastCount = 0;
      (async () => {
        if (!window.S?.user) return;
        lastCount = await window.db.transactions.where('userId').equals(window.S.user.id).count().catch(() => 0);
      })();
      setInterval(async () => {
        try {
          if (!window.S?.user || !await getPref('aiProLearn', true)) return;
          const uid = window.S.user.id;
          const count = await window.db.transactions.where('userId').equals(uid).count();
          if (count > lastCount) {
            const newOnes = await window.db.transactions.where('userId').equals(uid).reverse().limit(count - lastCount).toArray();
            for (const t of newOnes) await Classifier.learnFromTx(t);
            lastCount = count;
            if (await getPref('aiProInsights', true) && $('aiProInsightsPanel')) Panel.render().catch(() => {});
          } else if (count < lastCount) { lastCount = count; }
        } catch {}
      }, 5000);
    },

    initInsightsAutoRender() {
      (async () => {
        if (!await getPref('aiProInsights', true)) return;
        let tries = 0;
        const ivl = setInterval(async () => {
          if (document.querySelector('#page-dashboard.active') || document.getElementById('aiSuggestionsPanel')) {
            clearInterval(ivl);
            await Panel.render();
          }
          if (++tries > 30) clearInterval(ivl);
        }, 1000);
        document.addEventListener('click', e => {
          if (e.target.closest('[data-route="dashboard"], [data-page-target="dashboard"]'))
            setTimeout(() => Panel.render().catch(() => {}), 800);
        });
      })();
    },
  };

  /* ═══════════════════════════════════════════════════════════
     ENTRY POINT
  ═══════════════════════════════════════════════════════════ */
  const FP_AI_PRO = {
    Classifier, InputAssist, Insights, NLCommands, Chat, Panel, SmartActions, SmartSettings, UI, Index,
    async init() {
      try {
        await waitApp();
        if (await getPref('aiProAutoCat', true)) InputAssist.init();
        await SmartSettings.init();
        if (await getPref('aiProChat', true)) Chat.install();
        UI.injectSettingsCard();
        UI.watchSettingsNav();
        UI.initLearnHook();
        UI.initInsightsAutoRender();
        console.log('[FP_AI_PRO v2] inicializado — TF-IDF, Chat v2, Insights 12 tipos');
        document.addEventListener('fpllm:ready', e => {
          Chat._updateModelBadge();
          if (window.FinBot) window.FinBot._ollamaOk = true;
          if (typeof window.refreshSuggestions === 'function') window.refreshSuggestions().catch(() => {});
        });
        document.addEventListener('fpllm:error', () => {
          if (window.FinBot) window.FinBot._ollamaCheckTs = 0;
        });
      } catch (e) { console.warn('[FP_AI_PRO v2] falha init', e); }
    }
  };
  window.FP_AI_PRO = FP_AI_PRO;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FP_AI_PRO.init());
  } else {
    setTimeout(() => FP_AI_PRO.init(), 800);
  }
})();
