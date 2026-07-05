/* =====================================================================
   FINANCEPRO — ORÇAMENTOS v3 + CONTROLE FINANCEIRO v3
   Melhorias completas: live updates, categorias rápidas, 
   análise inteligente, alertas proativos, UX moderna.
   
   Expõe:
   • window.BudgetPro — orçamentos ricos em tempo real
   • window._cfRenderBudgetsRich — override do loadBudgets()
   • window.CF3 — controle financeiro v3
   Autor: FinancePro AI Team
===================================================================== */
(function () {
  'use strict';


  /* Aguarda app.js inicializar completamente (user + db + cats) */
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

  /* ── helpers ── */
  const $ = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);
  const T = (m, t = 'success', ms = 3500) => typeof window.toast === 'function' && window.toast(m, t, ms);
  const fmt = v => typeof window.fmtCurrency === 'function'
    ? window.fmtCurrency(v)
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const esc = s => String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (a, b) => b > 0 ? Math.round(a / b * 100) : 0;
  const mkId = () => Math.random().toString(36).slice(2, 8);
  const today = () => new Date().toISOString().split('T')[0];
  const curMonth = () => new Date().toISOString().slice(0, 7);
  const waitApp = (ms = 15000) => new Promise((res, rej) => {
    const t0 = Date.now();
    (function loop() {
      if (window.db && window.S?.user) return res();
      if (Date.now() - t0 > ms) return rej(new Error('timeout'));
      setTimeout(loop, 200);
    })();
  });

  /* ── Cores da barra de progresso ── */
  function barColor(p) {
    if (p >= 100) return 'var(--danger)';
    if (p >= 85)  return '#ef9f27';
    if (p >= 65)  return 'var(--warning)';
    return 'var(--success)';
  }

  /* ── Emoji/ícone de tendência ── */
  function trendBadge(cur, prev) {
    if (!prev || prev === 0) return '';
    const d = ((cur - prev) / prev * 100).toFixed(0);
    const icon = cur <= prev ? '↓' : '↑';
    const clr = cur <= prev ? 'var(--success)' : 'var(--danger)';
    return `<span style="font-size:.72rem;color:${clr};font-weight:700">${icon}${Math.abs(d)}%</span>`;
  }

  /* ═══════════════════════════════════════════════════════════
     BUDGET PRO — Orçamentos em tempo real com cards ricos
  ═══════════════════════════════════════════════════════════ */
  const BudgetPro = {
    _refreshTimer: null,
    _month: curMonth(),
    _uid: null,

    /* Renderiza a grade de cards de orçamento */
    async render(containerId = 'budgetsGrid', month = null) {
      if (!window.S?.user) return;
      this._uid = window.S.user.id;
      this._month = month || $('budgetMonth')?.value || curMonth();

      const el = $(containerId);
      if (el) el.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i> Calculando...</div>';

      try {
        const data = await this._loadData();
        if (el) el.innerHTML = this._buildGrid(data);
        this._renderTotalCard(data);
        this._renderInsightBanner(data);
        this._setupLiveUpdates();
      } catch (e) {
        if (el) el.innerHTML = `<p style="color:var(--danger);padding:1rem">Erro: ${esc(e.message)}</p>`;
      }
    },

    async _loadData() {
      const uid = this._uid, month = this._month;
      const start = month + '-01';
      const end = new Date(new Date(start).getFullYear(), new Date(start).getMonth() + 1, 0)
        .toISOString().split('T')[0];
      const prevMonth = new Date(new Date(start).getFullYear(), new Date(start).getMonth() - 1, 1)
        .toISOString().slice(0, 7);
      const prevStart = prevMonth + '-01';
      const prevEnd = new Date(new Date(prevStart).getFullYear(), new Date(prevStart).getMonth() + 1, 0)
        .toISOString().split('T')[0];

      const [txs, budgets, cats] = await Promise.all([
        window.db.transactions.where('userId').equals(uid).toArray(),
        window.db.budgets.where('userId').equals(uid).toArray(),
        window.db.categories.where('userId').equals(uid).toArray(),
      ]);

      const curTxs  = txs.filter(t => t.date >= start  && t.date <= end  && t.type === 'expense');
      const prevTxs = txs.filter(t => t.date >= prevStart && t.date <= prevEnd && t.type === 'expense');
      const income  = txs.filter(t => t.date >= start  && t.date <= end  && t.type === 'income')
                         .reduce((s, t) => s + t.amount, 0);
      const catMap  = Object.fromEntries(cats.map(c => [c.id, c]));
      const mBudgets = budgets.filter(b => !b.monthYear || b.monthYear === month);

      // Por categoria
      const expCats = cats.filter(c => c.type === 'expense');
      const catData = expCats.map(cat => {
        const budget = mBudgets.find(b => b.categoryId == cat.id);
        const curSpent = curTxs.filter(t => t.categoryId == cat.id).reduce((s, t) => s + t.amount, 0);
        const prevSpent = prevTxs.filter(t => t.categoryId == cat.id).reduce((s, t) => s + t.amount, 0);
        const limit = budget?.limitAmount || 0;
        const p = pct(curSpent, limit);

        // Top favorecidos
        const descMap = {};
        curTxs.filter(t => t.categoryId == cat.id).forEach(t => {
          const k = t.description || 'Sem descrição';
          descMap[k] = (descMap[k] || 0) + t.amount;
        });
        const topPayees = Object.entries(descMap).sort((a, b) => b[1] - a[1]).slice(0, 3);

        // Alertas
        let alert = null;
        if (limit > 0 && p >= 100) alert = { type: 'danger', msg: `ESTOURADO +${fmt(curSpent - limit)}` };
        else if (limit > 0 && p >= 85) alert = { type: 'warning', msg: `${p}% do limite` };

        return { cat, budget, curSpent, prevSpent, limit, p, topPayees, alert, txCount: curTxs.filter(t => t.categoryId == cat.id).length };
      }).filter(d => d.curSpent > 0 || d.limit > 0); // só mostra com dados ou limite

      return { catData, curTxs, income, month, uid };
    },

    _buildGrid(data) {
      if (!data.catData.length) {
        return `<div style="text-align:center;padding:2.5rem;color:var(--txt2)">
          <i class="fas fa-wallet" style="font-size:2.5rem;margin-bottom:.75rem;display:block;opacity:.35"></i>
          <div style="font-size:.9rem;font-weight:500">Nenhum orçamento ou gasto registrado</div>
          <div style="font-size:.8rem;margin-top:.35rem">Adicione transações ou defina limites para ver os cards</div>
          <button class="btn btn-primary btn-sm" style="margin-top:1rem" onclick="navigate('controle')">
            <i class="fas fa-plus"></i> Definir limites por categoria
          </button>
        </div>`;
      }

      const sorted = [...data.catData].sort((a, b) => {
        // Primeiro: estourados, depois: próximos do limite, depois: por valor
        if (a.p >= 100 && b.p < 100) return -1;
        if (b.p >= 100 && a.p < 100) return  1;
        if (a.p >= 85  && b.p < 85)  return -1;
        if (b.p >= 85  && a.p < 85)  return  1;
        return b.curSpent - a.curSpent;
      });

      return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:.75rem">
        ${sorted.map(d => this._buildCard(d)).join('')}
        <div style="grid-column:1/-1;text-align:center;margin-top:.25rem">
          <button class="btn btn-ghost btn-sm" style="font-size:.78rem" onclick="BudgetPro._addCategoryBudget()">
            <i class="fas fa-plus"></i> Definir orçamento para outra categoria
          </button>
        </div>
      </div>`;
    },

    _buildCard(d) {
      const { cat, curSpent, prevSpent, limit, p, topPayees, alert, txCount } = d;
      const barClr = barColor(p);
      const trend = trendBadge(curSpent, prevSpent);
      const catColor = cat.color || 'var(--accent)';
      const alertBorder = alert?.type === 'danger' ? 'border:2px solid var(--danger)' :
                          alert?.type === 'warning' ? 'border:2px solid var(--warning)' : '';

      const payeeList = topPayees.length ? topPayees.map(([name, val]) =>
        `<div style="display:flex;justify-content:space-between;font-size:.76rem;padding:3px 0;border-bottom:1px solid var(--bdr)">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%;color:var(--txt2)">${esc(name)}</span>
          <span style="font-weight:600;color:var(--txt);flex-shrink:0">${fmt(val)}</span>
        </div>`).join('') : '';

      return `<div class="card" style="padding:1rem;cursor:default;${alertBorder}" id="bcard-${cat.id}">
        <!-- Header -->
        <div style="display:flex;align-items:center;gap:.65rem;margin-bottom:.6rem">
          <div style="width:36px;height:36px;border-radius:10px;background:${catColor};
               display:flex;align-items:center;justify-content:center;color:#fff;font-size:.85rem;flex-shrink:0">
            <i class="fas ${cat.icon || 'fa-tag'}"></i>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:.9rem;font-weight:600;display:flex;align-items:center;gap:.4rem">
              ${esc(cat.name)}
              ${alert ? `<span style="font-size:.65rem;padding:2px 7px;border-radius:99px;background:var(--${alert.type});color:#fff;font-weight:700">${alert.msg}</span>` : ''}
            </div>
            <div style="font-size:.74rem;color:var(--txt2);margin-top:1px">
              ${txCount} transaç${txCount === 1 ? 'ão' : 'ões'} ${trend}
            </div>
          </div>
          <!-- Menu rápido -->
          <div style="position:relative">
            <button class="btn btn-ghost btn-sm" style="padding:4px 8px;font-size:.75rem"
              onclick="BudgetPro._showCardMenu('${cat.id}',this)" title="Opções">
              <i class="fas fa-ellipsis-v"></i>
            </button>
          </div>
        </div>

        <!-- Valor principal -->
        <div style="font-size:1.6rem;font-weight:800;font-family:var(--font-h);color:${barClr};line-height:1.1;margin-bottom:.3rem">
          ${fmt(curSpent)}
          ${limit > 0 ? `<span style="font-size:.85rem;color:var(--txt2);font-weight:500"> / ${fmt(limit)}</span>` : ''}
        </div>

        <!-- Barra de progresso -->
        ${limit > 0 ? `
        <div style="height:6px;background:var(--bdr);border-radius:3px;overflow:hidden;margin-bottom:.4rem">
          <div style="width:${Math.min(100, p)}%;height:100%;background:${barClr};border-radius:3px;transition:width .5s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--txt2);margin-bottom:.5rem">
          <span>${p}% utilizado</span>
          <span style="color:${limit - curSpent > 0 ? 'var(--success)' : 'var(--danger)'}">
            ${limit - curSpent > 0 ? 'Restam ' + fmt(limit - curSpent) : 'Excesso ' + fmt(curSpent - limit)}
          </span>
        </div>` : `
        <button class="btn btn-ghost btn-sm" style="font-size:.75rem;width:100%;margin-bottom:.5rem;border:1px dashed var(--bdr)"
          onclick="BudgetPro._quickSetLimit('${cat.id}','${esc(cat.name)}')">
          <i class="fas fa-plus-circle"></i> Definir limite mensal
        </button>`}

        <!-- Top favorecidos -->
        ${payeeList ? `
        <div style="margin-top:.35rem">
          <div style="font-size:.68rem;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.2rem">Principais gastos</div>
          ${payeeList}
        </div>` : ''}

        <!-- Ações rápidas -->
        <div style="display:flex;gap:.4rem;margin-top:.65rem;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" style="font-size:.73rem;flex:1"
            onclick="BudgetPro._viewDetails('${cat.id}')">
            <i class="fas fa-expand-alt"></i> Detalhes
          </button>
          <button class="btn btn-ghost btn-sm" style="font-size:.73rem;flex:1"
            onclick="navigate('controle')">
            <i class="fas fa-sliders-h"></i> Configurar
          </button>
          <button class="btn btn-ghost btn-sm" style="font-size:.73rem"
            onclick="BudgetPro._quickChangeCategory('${cat.id}')" title="Mover transações">
            <i class="fas fa-exchange-alt"></i>
          </button>
        </div>
      </div>`;
    },

    _renderTotalCard(data) {
      const tc = $('budgetTotalCard');
      if (!tc) return;
      const total = data.catData.reduce((s, d) => s + d.curSpent, 0);
      const totalLimit = data.catData.reduce((s, d) => s + (d.limit || 0), 0);
      const totalIncome = data.income;
      const saved = totalIncome - total;
      const pctSaved = totalIncome > 0 ? Math.round(saved / totalIncome * 100) : 0;
      const overBudget = data.catData.filter(d => d.p >= 100).length;
      const nearBudget = data.catData.filter(d => d.p >= 85 && d.p < 100).length;

      tc.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.75rem;align-items:center">
          <div>
            <div style="font-size:.72rem;color:var(--txt2);font-weight:600;text-transform:uppercase;letter-spacing:.4px">Gasto total</div>
            <div style="font-size:1.45rem;font-weight:800;font-family:var(--font-h);color:var(--danger)">${fmt(total)}</div>
            ${totalLimit > 0 ? `<div style="font-size:.74rem;color:var(--txt2)">de ${fmt(totalLimit)} orçado</div>` : ''}
          </div>
          <div>
            <div style="font-size:.72rem;color:var(--txt2);font-weight:600;text-transform:uppercase;letter-spacing:.4px">Receita do mês</div>
            <div style="font-size:1.45rem;font-weight:800;font-family:var(--font-h);color:var(--success)">${fmt(totalIncome)}</div>
          </div>
          <div>
            <div style="font-size:.72rem;color:var(--txt2);font-weight:600;text-transform:uppercase;letter-spacing:.4px">Saldo / Poupança</div>
            <div style="font-size:1.45rem;font-weight:800;font-family:var(--font-h);color:${saved>=0?'var(--success)':'var(--danger)'}">${fmt(saved)}</div>
            <div style="font-size:.74rem;color:var(--txt2)">${pctSaved}% da renda</div>
          </div>
          <div>
            <div style="font-size:.72rem;color:var(--txt2);font-weight:600;text-transform:uppercase;letter-spacing:.4px">Status orçamentos</div>
            <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.2rem">
              ${overBudget ? `<span style="font-size:.72rem;padding:2px 8px;border-radius:99px;background:var(--danger);color:#fff;font-weight:700">${overBudget} estourado${overBudget>1?'s':''}</span>` : ''}
              ${nearBudget ? `<span style="font-size:.72rem;padding:2px 8px;border-radius:99px;background:var(--warning);color:#fff;font-weight:700">${nearBudget} atenção</span>` : ''}
              ${!overBudget && !nearBudget ? `<span style="font-size:.72rem;padding:2px 8px;border-radius:99px;background:var(--success);color:#fff;font-weight:700">✓ Tudo ok</span>` : ''}
            </div>
          </div>
        </div>
        <!-- Mini barra geral -->
        ${totalLimit > 0 ? `
        <div style="margin-top:.85rem">
          <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--txt2);margin-bottom:4px">
            <span>Orçamento geral</span><span>${pct(total,totalLimit)}%</span>
          </div>
          <div style="height:7px;background:var(--bdr);border-radius:4px;overflow:hidden">
            <div style="width:${Math.min(100,pct(total,totalLimit))}%;height:100%;background:${barColor(pct(total,totalLimit))};border-radius:4px;transition:width .5s"></div>
          </div>
        </div>` : ''}`;
    },

    _renderInsightBanner(data) {
      // Inserir banner de insight acima da grade se houver alertas
      const overBudget = data.catData.filter(d => d.p >= 100);
      const topCat = [...data.catData].sort((a,b)=>b.curSpent-a.curSpent)[0];
      const insightEl = $('budgetInsightBanner');
      if (!insightEl) return;

      if (overBudget.length) {
        insightEl.innerHTML = `<div style="background:rgba(239,68,68,.08);border-left:4px solid var(--danger);border-radius:8px;padding:.75rem 1rem;margin-bottom:.85rem;font-size:.83rem">
          <i class="fas fa-exclamation-triangle" style="color:var(--danger)"></i>
          <strong style="color:var(--danger)"> ${overBudget.length} categoria${overBudget.length>1?'s':''} com limite estourado:</strong>
          ${overBudget.map(d=>`<strong>${esc(d.cat.name)}</strong> (${fmt(d.curSpent)})`).join(', ')}
          <br><small style="color:var(--txt2)">Clique no card para ver detalhes e mover transações.</small>
        </div>`;
      } else if (topCat && topCat.curSpent > 0) {
        const pctIncome = data.income > 0 ? Math.round(topCat.curSpent / data.income * 100) : 0;
        insightEl.innerHTML = `<div style="background:rgba(var(--accent-rgb),.06);border-left:4px solid var(--accent);border-radius:8px;padding:.65rem 1rem;margin-bottom:.85rem;font-size:.82rem;color:var(--txt2)">
          <i class="fas fa-lightbulb" style="color:var(--accent)"></i>
          Maior gasto: <strong style="color:var(--txt)">${esc(topCat.cat.name)}</strong> — ${fmt(topCat.curSpent)} (${pctIncome}% da renda)
          ${topCat.limit > 0 && topCat.p < 100 ? ` · Restam ${fmt(topCat.limit - topCat.curSpent)} no limite` : ''}
          <a href="#" onclick="BudgetPro._viewDetails('${topCat.cat.id}');return false" style="color:var(--accent);margin-left:.5rem">Ver →</a>
        </div>`;
      } else {
        insightEl.innerHTML = '';
      }
    },

    /* Modal rápido de limite */
    _quickSetLimit(catId, catName) {
      const val = prompt(`Definir limite mensal para "${catName}" (R$):`);
      if (!val || isNaN(parseFloat(val.replace(',', '.')))) return;
      const amount = parseFloat(val.replace(',', '.'));
      this._saveBudget(catId, amount);
    },

    async _saveBudget(catId, amount) {
      const uid = this._uid, month = this._month;
      const existing = await window.db.budgets
        .where('userId').equals(uid)
        .filter(b => String(b.categoryId) === String(catId) && (!b.monthYear || b.monthYear === month))
        .first();
      if (existing) {
        await window.db.budgets.update(existing.id, { limitAmount: amount });
      } else {
        await window.db.budgets.add({ userId: uid, categoryId: catId, limitAmount: amount, monthYear: month });
      }
      T(`Limite definido: ${fmt(amount)}`, 'success');
      this.render('budgetsGrid', this._month);
    },

    /* Menu de contexto do card */
    _showCardMenu(catId, btn) {
      // Remove menu antigo
      $$('.bp-ctx-menu').forEach(m => m.remove());
      const cat = window.S?.cats?.find(c => String(c.id) === String(catId));
      const menu = document.createElement('div');
      menu.className = 'bp-ctx-menu';
      menu.style.cssText = 'position:absolute;right:0;top:100%;z-index:200;background:var(--surf);border:1px solid var(--bdr);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.15);min-width:180px;padding:4px 0';
      menu.innerHTML = `
        <div class="bp-menu-item" onclick="BudgetPro._quickSetLimit('${catId}','${esc(cat?.name||catId)}')"><i class="fas fa-sliders-h"></i> Definir limite</div>
        <div class="bp-menu-item" onclick="BudgetPro._viewDetails('${catId}')"><i class="fas fa-expand-alt"></i> Ver detalhes</div>
        <div class="bp-menu-item" onclick="BudgetPro._quickChangeCategory('${catId}')"><i class="fas fa-exchange-alt"></i> Mover transações</div>
        <div class="bp-menu-item" onclick="navigate('controle')"><i class="fas fa-chart-pie"></i> Controle Financeiro</div>
        <div class="bp-menu-item" style="color:var(--danger)" onclick="BudgetPro._removeBudget('${catId}')"><i class="fas fa-trash"></i> Remover limite</div>
      `;
      // Estilo dos itens
      menu.querySelectorAll('.bp-menu-item').forEach(item => {
        item.style.cssText = 'padding:.5rem .85rem;font-size:.82rem;cursor:pointer;display:flex;align-items:center;gap:.5rem;color:var(--txt)';
        item.onmouseenter = () => item.style.background = 'var(--bg-s)';
        item.onmouseleave = () => item.style.background = '';
        item.onclick = (e) => { menu.remove(); item.onclick && null; };
        // Re-attach onclick from HTML attribute
      });
      btn.parentElement.style.position = 'relative';
      btn.parentElement.appendChild(menu);
      // Fechar ao clicar fora
      setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 100);
    },

    async _removeBudget(catId) {
      if (!confirm('Remover limite desta categoria?')) return;
      const uid = this._uid, month = this._month;
      const existing = await window.db.budgets
        .where('userId').equals(uid)
        .filter(b => String(b.categoryId) === String(catId) && (!b.monthYear || b.monthYear === month))
        .first();
      if (existing) await window.db.budgets.delete(existing.id);
      T('Limite removido', 'info');
      this.render('budgetsGrid', this._month);
    },

    /* Modal de detalhes da categoria */
    async _viewDetails(catId) {
      const uid = this._uid, month = this._month;
      const start = month + '-01';
      const end = new Date(new Date(start).getFullYear(), new Date(start).getMonth() + 1, 0).toISOString().split('T')[0];
      const cat = window.S?.cats?.find(c => String(c.id) === String(catId));
      if (!cat) return;

      const txs = await window.db.transactions.where('userId').equals(uid)
        .filter(t => t.date >= start && t.date <= end && t.type === 'expense' && String(t.categoryId) === String(catId))
        .toArray();
      txs.sort((a, b) => b.date.localeCompare(a.date));

      const total = txs.reduce((s, t) => s + t.amount, 0);
      const descMap = {};
      txs.forEach(t => { const k = t.description || 'Sem desc'; descMap[k] = (descMap[k] || 0) + t.amount; });
      const topDesc = Object.entries(descMap).sort((a,b)=>b[1]-a[1]);

      // Abrir modal
      if (typeof window.openModal === 'function') {
        const modId = 'budgetDetailMod';
        let mod = $(modId);
        if (!mod) {
          mod = document.createElement('div');
          mod.id = modId;
          mod.className = 'modal-overlay';
          document.body.appendChild(mod);
        }
        mod.style.display = 'flex';
        mod.innerHTML = `<div class="modal" style="max-width:520px;max-height:85vh;display:flex;flex-direction:column">
          <div class="modal-hdr">
            <span class="modal-title"><i class="fas ${cat.icon||'fa-tag'}" style="color:${cat.color||'var(--accent)'}"></i> ${esc(cat.name)} — ${month}</span>
            <button class="modal-close" onclick="document.getElementById('${modId}').style.display='none'">&times;</button>
          </div>
          <div style="flex:1;overflow-y:auto;padding:1rem">
            <div style="font-size:1.4rem;font-weight:800;color:var(--danger);margin-bottom:.25rem">${fmt(total)}</div>
            <div style="font-size:.8rem;color:var(--txt2);margin-bottom:1rem">${txs.length} transações em ${month}</div>

            <div style="font-size:.8rem;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:.4rem">Por descrição</div>
            ${topDesc.map(([d, v]) => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:.45rem 0;border-bottom:1px solid var(--bdr);gap:.5rem">
              <span style="font-size:.83rem;color:var(--txt);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d)}</span>
              <span style="font-size:.83rem;font-weight:700;color:var(--txt);flex-shrink:0">${fmt(v)}</span>
              <button class="btn btn-ghost btn-sm" style="font-size:.7rem;padding:3px 8px;flex-shrink:0"
                onclick="BudgetPro._quickMoveDesc('${esc(d)}','${catId}')">Mover cat.</button>
            </div>`).join('')}

            <div style="margin-top:1rem;font-size:.8rem;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:.4rem">Transações</div>
            ${txs.slice(0,20).map(t => `
            <div style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;border-bottom:1px solid var(--bdr)">
              <span style="font-size:.75rem;color:var(--txt2);flex-shrink:0">${t.date}</span>
              <span style="font-size:.82rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.description||'Sem desc')}</span>
              <span style="font-size:.82rem;font-weight:700;color:var(--danger);flex-shrink:0">${fmt(t.amount)}</span>
              <button class="btn btn-ghost btn-sm" style="font-size:.65rem;padding:2px 6px;flex-shrink:0"
                onclick="BudgetPro._moveTxCategory('${t.id}')"><i class="fas fa-exchange-alt"></i></button>
            </div>`).join('')}
          </div>
        </div>`;
        mod.onclick = e => { if(e.target===mod) mod.style.display='none'; };
      }
    },

    /* Mover transação de categoria rapidamente */
    async _moveTxCategory(txId) {
      const cats = window.S?.cats?.filter(c => c.type === 'expense') || [];
      const options = cats.map((c,i) => `${i+1}. ${c.name}`).join('\n');
      const input = prompt(`Escolha a nova categoria (número):\n${options}`);
      if (!input) return;
      const idx = parseInt(input) - 1;
      if (isNaN(idx) || !cats[idx]) return;
      await window.db.transactions.update(parseInt(txId), { categoryId: cats[idx].id });
      T(`Movido para ${cats[idx].name}`, 'success');
      this.render('budgetsGrid', this._month);
      // Retreina LocalAI
      if (typeof window.LocalAI?.trainFromHistory === 'function')
        setTimeout(() => window.LocalAI.trainFromHistory().catch(()=>{}), 500);
    },

    async _quickMoveDesc(desc, fromCatId) {
      const cats = window.S?.cats?.filter(c => c.type === 'expense') || [];
      const options = cats.map((c,i) => `${i+1}. ${c.name}`).join('\n');
      const input = prompt(`Mover todas as transações "${desc}" para:\n${options}`);
      if (!input) return;
      const idx = parseInt(input) - 1;
      if (isNaN(idx) || !cats[idx]) return;
      const toCat = cats[idx];
      // Mover no DB
      const txs = await window.db.transactions.where('userId').equals(this._uid)
        .filter(t => t.description === desc && String(t.categoryId) === String(fromCatId))
        .toArray();
      for (const t of txs) await window.db.transactions.update(t.id, { categoryId: toCat.id });
      // Criar regra automática
      try { if (window.db?.userRules) await window.db.userRules.add({ userId: this._uid, description: desc, categoryId: toCat.id, tipo: 'exact', createdAt: new Date().toISOString() }); } catch(e) {}
      T(`${txs.length} transação(ões) movida(s) para ${toCat.name} + regra criada`, 'success');
      this.render('budgetsGrid', this._month);
    },

    async _quickChangeCategory(catId) {
      T('Use o Controle Financeiro para mover transações por favorecido', 'info');
      navigate('controle');
    },

    async _addCategoryBudget() {
      const noBudget = window.S?.cats?.filter(c => c.type === 'expense') || [];
      if (!noBudget.length) { T('Crie categorias primeiro', 'warning'); return; }
      const options = noBudget.map((c,i)=>`${i+1}. ${c.name}`).join('\n');
      const sel = prompt(`Escolha a categoria (número):\n${options}`);
      if (!sel) return;
      const idx = parseInt(sel)-1;
      if (isNaN(idx)||!noBudget[idx]) return;
      const val = prompt(`Limite mensal para "${noBudget[idx].name}" (R$):`);
      if (!val||isNaN(parseFloat(val.replace(',','.')))) return;
      await this._saveBudget(noBudget[idx].id, parseFloat(val.replace(',','.')));
    },

    /* Live updates: re-renderiza a cada 60s enquanto na página */
    _setupLiveUpdates() {
      clearInterval(this._refreshTimer);
      this._refreshTimer = setInterval(() => {
        const budPage = document.querySelector('#page-budgets.active');
        if (budPage) this.render('budgetsGrid', this._month);
        else clearInterval(this._refreshTimer);
      }, 60000);
    },
  };

  /* Expor como _cfRenderBudgetsRich para app.js loadBudgets() */
  window._cfRenderBudgetsRich = async function () {
    await BudgetPro.render('budgetsGrid');
  };
  window.BudgetPro = BudgetPro;

  /* Adicionar CSS inline para menu contextual */
  if (!document.getElementById('bp-styles')) {
    const style = document.createElement('style');
    style.id = 'bp-styles';
    style.textContent = `
      #budgetInsightBanner { transition: all .3s; }
      .bp-ctx-menu { animation: bpFadeIn .15s ease; }
      @keyframes bpFadeIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
      #budgetsGrid .card { transition: box-shadow .2s, transform .15s; }
      #budgetsGrid .card:hover { box-shadow: var(--shadow-md); }
    `;
    document.head.appendChild(style);
  }

  /* Init quando app carrega */
  function init() {
    // Injeta banner de insight no DOM se não existir
    const bGrid = document.getElementById('budgetsGrid');
    if (bGrid && !document.getElementById('budgetInsightBanner')) {
      const banner = document.createElement('div');
      banner.id = 'budgetInsightBanner';
      bGrid.parentElement?.insertBefore(banner, bGrid);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 800));
  } else {
    setTimeout(init, 800);
  }

  // Navigate handled by app.js loaders — no hook needed

})();
