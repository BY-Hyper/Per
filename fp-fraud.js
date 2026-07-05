/* =====================================================================
   FINANCEPRO — FRAUDES & ANOMALIAS v2
   Scanner automático com aceitar/rejeitar, 6 tipos de detecção.
   Expõe: window.FP_FRAUD  window.loadAnomalies
===================================================================== */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const fmt = v => typeof window.fmtCurrency === 'function'
    ? window.fmtCurrency(v) : 'R$' + Math.abs(v || 0).toFixed(2).replace('.', ',');
  const T = (m, t = 'success') => typeof window.toast === 'function' && window.toast(m, t, 3500);
  const esc = s => String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ── Scanner principal ── */
  async function scan() {
    const u = window.S?.user;
    if (!u) return { alerts: [], stats: {} };
    const uid = u.id;
    const txs = await window.db.transactions.where('userId').equals(uid).toArray();
    if (!txs.length) return { alerts: [], stats: { total: 0, high: 0, mid: 0, low: 0 } };

    const alerts = [];

    // ── 1. OUTLIER ESTATÍSTICO por categoria ──────────────────
    const byCategory = {};
    txs.filter(t => t.type === 'expense').forEach(t => {
      const k = t.categoryId || 'uncategorized';
      (byCategory[k] = byCategory[k] || []).push(t);
    });

    for (const [catId, catTxs] of Object.entries(byCategory)) {
      if (catTxs.length < 4) continue;
      const amounts = catTxs.map(t => t.amount);
      const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
      const std = Math.sqrt(amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length);
      catTxs.forEach(t => {
        const z = std > 0 ? Math.abs(t.amount - mean) / std : 0;
        if (z > 2.5) {
          const cat = window.S?.cats?.find(c => String(c.id) === String(catId));
          alerts.push({
            id: `outlier-${t.id}`, txId: t.id, severity: z > 3.5 ? 'high' : 'mid',
            type: 'outlier', icon: 'fa-chart-bar',
            title: `Valor atípico em ${cat?.name || 'categoria'}`,
            desc: `${esc(t.description || 'Sem desc')} — ${fmt(t.amount)} é ${z.toFixed(1)}× o desvio padrão (média: ${fmt(mean)})`,
            date: t.date, amount: t.amount,
            action: { label: 'Ver transação', fn: `navigate('transactions')` },
          });
        }
      });
    }

    // ── 2. DUPLICATAS (mesmo valor, mesma desc, ±3 dias) ─────
    const sortedTxs = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    const seen = new Set();
    sortedTxs.forEach((t, i) => {
      if (seen.has(t.id)) return;
      const d1 = new Date(t.date);
      for (let j = i + 1; j < sortedTxs.length; j++) {
        const t2 = sortedTxs[j];
        const d2 = new Date(t2.date);
        if ((d2 - d1) > 3 * 86400000) break;
        const sameDiff = Math.abs(t.amount - t2.amount) < 0.01;
        const sameDesc = (t.description || '').toLowerCase().trim() === (t2.description || '').toLowerCase().trim();
        if (sameDiff && sameDesc && t.type === t2.type) {
          seen.add(t2.id);
          alerts.push({
            id: `dup-${t.id}-${t2.id}`, txId: t2.id, severity: 'high',
            type: 'duplicate', icon: 'fa-copy',
            title: 'Possível transação duplicada',
            desc: `"${esc(t.description || 'Sem desc')}" — ${fmt(t.amount)} em ${t.date} e ${t2.date} (${(d2 - d1) / 86400000 | 0}d de diferença)`,
            date: t2.date, amount: t2.amount,
            txId2: t.id,
            action: { label: 'Revisar', fn: `navigate('transactions')` },
          });
        }
      }
    });

    // ── 3. GASTOS NOTURNOS INCOMUNS (01h–05h) ─────────────────
    txs.filter(t => t.type === 'expense' && t.createdAt).forEach(t => {
      try {
        const h = new Date(t.createdAt).getHours();
        if (h >= 1 && h <= 5 && t.amount > 100) {
          alerts.push({
            id: `night-${t.id}`, txId: t.id, severity: 'mid',
            type: 'night', icon: 'fa-moon',
            title: 'Gasto registrado de madrugada',
            desc: `${esc(t.description || 'Sem desc')} — ${fmt(t.amount)} registrado às ${h}h`,
            date: t.date, amount: t.amount,
          });
        }
      } catch(e) {}
    });

    // ── 4. GASTO ÚNICO MUITO ALTO (>3× maior do mês) ─────────
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    const curExp = txs.filter(t => t.date.startsWith(month) && t.type === 'expense');
    if (curExp.length >= 5) {
      const amounts = curExp.map(t => t.amount);
      const avg = amounts.reduce((s, v) => s + v, 0) / amounts.length;
      curExp.forEach(t => {
        if (t.amount > avg * 4 && t.amount > 200) {
          alerts.push({
            id: `high-${t.id}`, txId: t.id, severity: 'mid',
            type: 'high', icon: 'fa-fire',
            title: 'Gasto muito acima da média do mês',
            desc: `${esc(t.description || 'Sem desc')} — ${fmt(t.amount)} é ${(t.amount / avg).toFixed(1)}× a média (${fmt(avg)})`,
            date: t.date, amount: t.amount,
          });
        }
      });
    }

    // ── 5. CATEGORIA DISPARANDO (>2.5× vs média dos 3m ant.) ─
    const last3months = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      last3months.push(d.toISOString().slice(0, 7));
    }
    const cats = window.S?.cats || [];
    cats.filter(c => c.type === 'expense').forEach(cat => {
      const curSpent = curExp.filter(t => String(t.categoryId) === String(cat.id)).reduce((s, t) => s + t.amount, 0);
      const prevSums = last3months.map(m =>
        txs.filter(t => t.date.startsWith(m) && t.type === 'expense' && String(t.categoryId) === String(cat.id))
           .reduce((s, t) => s + t.amount, 0)
      );
      const prevNonZero = prevSums.filter(v => v > 0);
      if (prevNonZero.length < 2) return;
      const prevAvg = prevNonZero.reduce((s, v) => s + v, 0) / prevNonZero.length;
      if (curSpent > prevAvg * 2.5 && curSpent > 100) {
        alerts.push({
          id: `cat-spike-${cat.id}`, txId: null, severity: 'mid',
          type: 'spike', icon: 'fa-chart-line',
          title: `${cat.name}: gasto ${Math.round(curSpent / prevAvg * 100 - 100)}% acima da média`,
          desc: `Este mês: ${fmt(curSpent)}. Média 3 meses: ${fmt(prevAvg)}`,
          date: month, amount: curSpent,
          action: { label: 'Ver categoria', fn: `navigate('controle')` },
        });
      }
    });

    // ── 6. ASSINATURAS NÃO CADASTRADAS (recorrentes ~30d) ─────
    const descGroups = {};
    txs.filter(t => t.type === 'expense').forEach(t => {
      const k = (t.description || '').toLowerCase().trim();
      if (k.length > 3) (descGroups[k] = descGroups[k] || []).push(t);
    });
    const existingSubs = await window.db.subscriptions?.where('userId').equals(uid).toArray().catch(() => []) || [];
    const subNames = new Set(existingSubs.map(s => (s.name || '').toLowerCase().trim()));

    for (const [desc, group] of Object.entries(descGroups)) {
      if (group.length < 2 || subNames.has(desc)) continue;
      // Check if recurring monthly
      const dates = group.map(t => new Date(t.date)).sort((a, b) => a - b);
      const gaps = [];
      for (let i = 1; i < dates.length; i++) gaps.push((dates[i] - dates[i - 1]) / 86400000);
      const avgGap = gaps.reduce((s, v) => s + v, 0) / gaps.length;
      if (avgGap >= 25 && avgGap <= 35 && group.length >= 2) {
        const lastAmt = group[group.length - 1].amount;
        const amountConsistent = group.every(t => Math.abs(t.amount - lastAmt) < lastAmt * 0.1);
        if (amountConsistent && lastAmt > 5) {
          alerts.push({
            id: `recur-${desc.slice(0, 20)}`, txId: null, severity: 'low',
            type: 'recurring', icon: 'fa-repeat',
            title: 'Assinatura não cadastrada detectada',
            desc: `"${esc(desc)}" aparece mensalmente por ${fmt(lastAmt)}. Considere cadastrar em Assinaturas.`,
            date: group[group.length - 1].date, amount: lastAmt,
            action: { label: 'Cadastrar', fn: "navigate('subscriptions')" },
          });
        }
      }
    }

    // Remove duplicates by id
    const unique = [];
    const seenIds = new Set();
    for (const a of alerts) {
      if (!seenIds.has(a.id)) { seenIds.add(a.id); unique.push(a); }
    }

    // Sort by severity
    const sevOrder = { high: 0, mid: 1, low: 2 };
    unique.sort((a, b) => (sevOrder[a.severity] || 2) - (sevOrder[b.severity] || 2));

    const high = unique.filter(a => a.severity === 'high').length;
    const mid  = unique.filter(a => a.severity === 'mid').length;
    const low  = unique.filter(a => a.severity === 'low').length;

    return { alerts: unique, stats: { high, mid, low, total: txs.length } };
  }

  /* ── Render ── */
  async function render() {
    const listEl = $('anomalyList');
    if (!listEl) return;
    listEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--txt2)"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem"></i><br><br>Analisando transações...</div>';

    const u = window.S?.user;
    if (!u) {
      listEl.innerHTML = '<p style="color:var(--txt2);padding:1rem">Faça login para analisar transações.</p>';
      return;
    }

    let result;
    try { result = await scan(); } catch(e) {
      listEl.innerHTML = `<p style="color:var(--danger);padding:1rem">Erro: ${esc(e.message)}</p>`;
      return;
    }

    const { alerts, stats } = result;

    // Update KPIs
    const setEl = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    setEl('anomalyHigh', stats.high || 0);
    setEl('anomalyMid', stats.mid || 0);
    setEl('anomalyLow', stats.low || 0);
    setEl('anomalyTotal', stats.total || 0);

    // Last scan time
    const lastScanEl = $('anomalyLastScan');
    if (lastScanEl) lastScanEl.textContent = `Última verificação: ${new Date().toLocaleTimeString('pt-BR')}`;

    if (!alerts.length) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:2rem">
          <div style="font-size:3rem;margin-bottom:.5rem">🛡️</div>
          <div style="font-size:.95rem;font-weight:600;color:var(--txt)">Tudo em dia!</div>
          <div style="font-size:.83rem;color:var(--txt2);margin-top:.25rem">Nenhum padrão suspeito encontrado em ${stats.total} transações.</div>
        </div>`;
      return;
    }

    const SEV = {
      high: { label: 'Alta', bg: 'rgba(239,68,68,.1)', bdr: 'var(--danger)',  ic: 'var(--danger)' },
      mid:  { label: 'Média', bg: 'rgba(245,158,11,.08)', bdr: 'var(--warning)', ic: 'var(--warning)' },
      low:  { label: 'Info', bg: 'rgba(59,130,246,.08)', bdr: '#3b82f6',      ic: '#3b82f6' },
    };

    // Load dismissed list
    let dismissed = [];
    try { dismissed = await window.getSetting?.(u.id, 'fp_dismissed_alerts', []) || []; } catch(e) {}
    const visibleAlerts = alerts.filter(a => !dismissed.includes(a.id));

    listEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;flex-wrap:wrap;gap:.5rem">
        <span style="font-size:.83rem;color:var(--txt2)">${visibleAlerts.length} alerta${visibleAlerts.length !== 1 ? 's' : ''} encontrado${visibleAlerts.length !== 1 ? 's' : ''}</span>
        <button class="btn btn-ghost btn-sm" style="font-size:.73rem" onclick="FP_FRAUD.clearDismissed()">
          <i class="fas fa-undo"></i> Restaurar ignorados
        </button>
      </div>
      ${visibleAlerts.map(a => {
        const s = SEV[a.severity] || SEV.low;
        return `<div id="alert-${a.id}" style="display:flex;gap:.65rem;padding:.75rem;border-radius:10px;background:${s.bg};border-left:3px solid ${s.bdr};margin-bottom:.5rem;align-items:flex-start">
          <i class="fas ${a.icon}" style="color:${s.ic};margin-top:2px;font-size:.95rem;flex-shrink:0"></i>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:.3rem;flex-wrap:wrap;margin-bottom:.15rem">
              <span style="font-size:.85rem;font-weight:600">${esc(a.title)}</span>
              <span style="font-size:.65rem;padding:1px 6px;border-radius:99px;background:${s.bdr};color:#fff;font-weight:700">${s.label}</span>
            </div>
            <div style="font-size:.78rem;color:var(--txt2);margin-bottom:.35rem;line-height:1.4">${esc(a.desc)}</div>
            <div style="font-size:.72rem;color:var(--txt2)">${a.date}${a.amount ? ' · ' + fmt(a.amount) : ''}</div>
            <div style="display:flex;gap:.4rem;margin-top:.4rem;flex-wrap:wrap">
              ${a.action ? `<button class="btn btn-ghost btn-sm" style="font-size:.72rem" onclick="${a.action.fn}">${a.action.label}</button>` : ''}
              ${a.txId ? `<button class="btn btn-ghost btn-sm" style="font-size:.72rem" onclick="FP_FRAUD.acceptAlert('${a.id}')"><i class="fas fa-check" style="color:var(--success)"></i> OK, é normal</button>` : ''}
              <button class="btn btn-ghost btn-sm" style="font-size:.72rem;color:var(--danger)" onclick="FP_FRAUD.dismissAlert('${a.id}')"><i class="fas fa-times"></i> Ignorar</button>
            </div>
          </div>
        </div>`;
      }).join('')}
      ${dismissed.length ? `<div style="text-align:center;font-size:.75rem;color:var(--txt2);margin-top:.5rem">${dismissed.length} alerta${dismissed.length !== 1 ? 's' : ''} ignorado${dismissed.length !== 1 ? 's' : ''}.</div>` : ''}`;
  }

  /* ── API pública ── */
  const FP_FRAUD = {
    render,
    runFullScan: async () => { await render(); },
    async dismissAlert(id) {
      const u = window.S?.user;
      if (!u) return;
      let dismissed = [];
      try { dismissed = await window.getSetting?.(u.id, 'fp_dismissed_alerts', []) || []; } catch(e) {}
      if (!dismissed.includes(id)) dismissed.push(id);
      try { await window.setSetting?.(u.id, 'fp_dismissed_alerts', dismissed); } catch(e) {}
      const el = $(`alert-${id}`);
      if (el) { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }
    },
    async acceptAlert(id) {
      T('Marcado como normal ✓', 'success');
      this.dismissAlert(id);
    },
    async clearDismissed() {
      const u = window.S?.user;
      if (!u) return;
      try { await window.setSetting?.(u.id, 'fp_dismissed_alerts', []); } catch(e) {}
      await render();
      T('Alertas restaurados', 'info');
    },
  };

  window.FP_FRAUD = FP_FRAUD;
  window.loadAnomalies = async function () {
    const u = window.S?.user;
    if (!u) { setTimeout(window.loadAnomalies, 500); return; }
    await render();
  };


/* ── Auto-init: render when page becomes active ── */
(function autoInit() {
  const pageId = 'page-anomalies';
  const loadFn = 'loadAnomalies';
  function tryRender() {
    const page = document.getElementById(pageId);
    if (page && page.classList.contains('active')) {
      const fn = window[loadFn];
      if (typeof fn === 'function') fn();
    }
  }
  // Check immediately in case page is already showing
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(tryRender, 300));
  } else {
    setTimeout(tryRender, 300);
  }
  // Also hook navigate for future calls
  const origNav = window.navigate;
  if (typeof origNav === 'function' && !window['__' + pageId + 'Hooked']) {
    window['__' + pageId + 'Hooked'] = true;
    window.navigate = function(page, ...args) {
      const r = origNav.call(this, page, ...args);
      if (page === 'anomalies') {
        setTimeout(() => { const fn = window[loadFn]; if (typeof fn === 'function') fn(); }, 150);
      }
      return r;
    };
  }
})();

})();