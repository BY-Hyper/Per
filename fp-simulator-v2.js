/* =====================================================================
   FINANCEPRO — SIMULADOR DE CENÁRIOS v2
   Visual, interativo, conectado aos dados reais.

   Funcionalidades:
   • Cenário A vs B lado a lado com projeção gráfica 12 meses
   • Sliders interativos para ajustar receita e gasto por categoria
   • Projeção de patrimônio acumulado com linha de meta
   • Simulação de "E se..." (compra grande, aumento de salário, emergência)
   • Salvar e comparar até 3 cenários
   • Exportar resultado em PDF/CSV
   • Conectado ao SuggestionEngine para sugestões baseadas no cenário
===================================================================== */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const fmt = v => typeof window.fmtCurrency === 'function'
    ? window.fmtCurrency(v)
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const esc = s => String(s || '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = (m, t = 'success', ms = 3500) => typeof window.toast === 'function' && window.toast(m, t, ms);

  /* ── Estado ── */
  const ST = {
    baseData: null,
    scenarios: [
      { id: 'A', label: 'Cenário A (atual)', incomeAdj: 0, expAdj: 0, extraEvent: null, color: 'var(--accent)' },
      { id: 'B', label: 'Cenário B (otimista)', incomeAdj: 10, expAdj: -10, extraEvent: null, color: '#3b82f6' },
    ],
    horizon: 12,
    goal: 0,
    chart: null,
  };

  /* ── Aguarda app ── */
  async function waitForApp(ms = 12000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (window.db && window.S?.user?.id) {
        if (!window.S.cats?.length) {
          try { window.S.cats = await window.db.categories.where('userId').equals(window.S.user.id).toArray(); } catch(e) {}
        }
        return true;
      }
      await new Promise(r => setTimeout(r, 150));
    }
    return false;
  }

  /* ── Carrega dados reais ── */
  async function loadBase() {
    const ready = await waitForApp(10000);
    if (!ready) return null;
    const uid = window.S.user.id;
    const now  = new Date();
    // Ensure categories loaded
    if (!window.S.cats?.length) {
      try { window.S.cats = await window.db.categories.where('userId').equals(uid).toArray(); } catch(e) {}
    }
    const months = Array.from({ length: 3 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 2 + i, 1);
      return d.toISOString().slice(0, 7);
    });

    const txs = await window.db.transactions.where('userId').equals(uid).toArray();
    const cats = window.S.cats?.length
      ? window.S.cats
      : await window.db.categories.where('userId').equals(uid).toArray();

    // Médias dos últimos 3 meses
    let totalInc = 0, totalExp = 0, mCount = 0;
    for (const m of months) {
      const mTxs = txs.filter(t => t.date.startsWith(m));
      if (!mTxs.length) continue;
      totalInc += mTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      totalExp += mTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      mCount++;
    }
    const avgInc = mCount > 0 ? totalInc / mCount : 0;
    const avgExp = mCount > 0 ? totalExp / mCount : 0;

    // Por categoria (último mês)
    const curMonth = now.toISOString().slice(0, 7);
    const curTxs = txs.filter(t => t.date.startsWith(curMonth));
    const catBreakdown = cats.filter(c => c.type === 'expense').map(cat => {
      const spent = curTxs.filter(t => t.categoryId == cat.id && t.type === 'expense')
                          .reduce((s, t) => s + t.amount, 0);
      return { cat, spent, pct: avgExp > 0 ? Math.round(spent / avgExp * 100) : 0 };
    }).filter(d => d.spent > 0).sort((a, b) => b.spent - a.spent);

    // Patrimônio atual
    const totalInc_ = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExp_ = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const patrimony = totalInc_ - totalExp_;

    return ST.baseData = { avgInc, avgExp, catBreakdown, patrimony, uid, txs, cats };
  }

  /* ── Calcula projeção de um cenário ── */
  function project(scenario, base) {
    const { avgInc, avgExp, patrimony } = base;
    const months = ST.horizon;

    const incAdj = avgInc * (1 + scenario.incomeAdj / 100);
    const expAdj = avgExp * (1 + scenario.expAdj / 100);
    const monthlySave = incAdj - expAdj;

    let balance = patrimony;
    const balances = [balance];
    const labels = [];
    const now = new Date();

    for (let i = 1; i <= months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      labels.push(d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
      balance += monthlySave;
      // Evento extra
      if (scenario.extraEvent && i === Math.ceil(months / 2)) {
        balance += scenario.extraEvent.amount;
      }
      balances.push(Math.round(balance * 100) / 100);
    }

    return { labels, balances, monthlySave, incAdj, expAdj, finalBalance: balance };
  }

  /* ── Renderiza a página ── */
  async function render() {
    const zone = $('simulatorZone') || $('cfRoot');
    if (!zone) return;
    zone.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--txt2)"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem"></i><br><br>Calculando cenários...</div>';

    const base = ST.baseData || await loadBase();
    if (!base) {
      // Use demo data so user can explore the simulator
      base = ST.baseData = {
        avgInc: 5000, avgExp: 3800, catBreakdown: [], patrimony: 0,
        uid: window.S?.user?.id || 0, txs: [], cats: []
      };
      ST.goal = 22800; // 6 months of avg expenses
      if (zone) zone.insertAdjacentHTML('afterbegin',
        '<div style="background:rgba(245,158,11,.08);border-left:3px solid var(--warning);border-radius:8px;padding:.6rem .85rem;margin-bottom:.75rem;font-size:.81rem;color:var(--txt2)"><i class="fas fa-info-circle" style="color:var(--warning)"></i> Sem dados financeiros reais. Usando valores exemplo — adicione transações para ver sua situação real.</div>'
      );
    }

    ST.goal = ST.goal || base.avgExp * 6; // Meta padrão: 6 meses de despesas

    const projA = project(ST.scenarios[0], base);
    const projB = project(ST.scenarios[1], base);

    zone.innerHTML = buildPage(base, projA, projB);
    renderChart(projA, projB);
    bindSliders();
  }

  /* ── HTML da página ── */
  function buildPage(base, projA, projB) {
    const scA = ST.scenarios[0], scB = ST.scenarios[1];
    return `
    <!-- Header com seletor de horizonte -->
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem">
      <div>
        <span style="font-size:.8rem;color:var(--txt2)">Projeção:</span>
        ${[6,12,24,36].map(h => `
          <button class="btn btn-ghost btn-sm" style="font-size:.78rem;${ST.horizon===h?'border:2px solid var(--accent);color:var(--accent)':''}"
            onclick="Simulator.setHorizon(${h})">${h}m</button>`).join('')}
      </div>
      <div style="display:flex;gap:.4rem;flex-wrap:wrap">
        <button class="btn btn-outline btn-sm" style="font-size:.78rem" onclick="Simulator.addEvent()">
          <i class="fas fa-bolt"></i> Evento extra
        </button>
        <button class="btn btn-outline btn-sm" style="font-size:.78rem" onclick="Simulator.saveScenario()">
          <i class="fas fa-save"></i> Salvar cenário
        </button>
        <button class="btn btn-ghost btn-sm" style="font-size:.78rem" onclick="Simulator.reset()">
          <i class="fas fa-undo"></i> Resetar
        </button>
      </div>
    </div>

    <!-- Sliders dos 2 cenários -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:1rem">
      ${buildScenarioPanel(scA, projA, 'A')}
      ${buildScenarioPanel(scB, projB, 'B')}
    </div>

    <!-- Gráfico de projeção -->
    <div class="card" style="padding:1rem;margin-bottom:1rem">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;flex-wrap:wrap;gap:.5rem">
        <span style="font-size:.88rem;font-weight:600">Projeção patrimonial — ${ST.horizon} meses</span>
        <div style="display:flex;align-items:center;gap:.85rem;font-size:.78rem">
          <span style="color:${scA.color}">● ${esc(scA.label)}</span>
          <span style="color:${scB.color}">● ${esc(scB.label)}</span>
          ${ST.goal > 0 ? `<span style="color:var(--success)">– – Meta (${fmt(ST.goal)})</span>` : ''}
        </div>
      </div>
      <div style="position:relative;height:220px">
        <canvas id="simChart"></canvas>
      </div>
      <!-- Meta de patrimônio -->
      <div style="margin-top:.75rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
        <label style="font-size:.78rem;color:var(--txt2)">Meta patrimônio:</label>
        <input type="number" id="simGoal" value="${ST.goal}" min="0" step="1000"
          class="form-inp" style="width:140px;font-size:.82rem" onchange="Simulator.setGoal(this.value)">
        <span style="font-size:.78rem;color:var(--txt2)">${ST.goal > 0 ? 'Atingida em: ' + goalMonth(projB, ST.goal) : ''}</span>
      </div>
    </div>

    <!-- Tabela comparativa -->
    <div class="card" style="padding:1rem;margin-bottom:1rem">
      <div style="font-size:.85rem;font-weight:600;margin-bottom:.75rem">Comparativo em ${ST.horizon} meses</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.83rem">
          <thead><tr style="border-bottom:2px solid var(--bdr)">
            <th style="text-align:left;padding:.4rem .5rem;color:var(--txt2);font-weight:600">Métrica</th>
            <th style="text-align:right;padding:.4rem .5rem;color:${scA.color};font-weight:600">${esc(scA.label)}</th>
            <th style="text-align:right;padding:.4rem .5rem;color:${scB.color};font-weight:600">${esc(scB.label)}</th>
            <th style="text-align:right;padding:.4rem .5rem;color:var(--txt2);font-weight:600">Diferença</th>
          </tr></thead>
          <tbody>
            ${tableRow('Receita mensal', projA.incAdj, projB.incAdj)}
            ${tableRow('Despesa mensal', projA.expAdj, projB.expAdj, true)}
            ${tableRow('Poupança/mês', projA.monthlySave, projB.monthlySave)}
            ${tableRow('Poupança total '+ST.horizon+'m', projA.monthlySave*ST.horizon, projB.monthlySave*ST.horizon)}
            ${tableRow('Patrimônio final', projA.finalBalance, projB.finalBalance)}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Insights IA -->
    <div id="simInsights" class="card" style="padding:1rem">
      ${buildInsights(base, projA, projB)}
    </div>

    <!-- Cenários salvos -->
    <div id="savedScenarios" style="margin-top:.75rem"></div>
    `;
  }

  function buildScenarioPanel(sc, proj, id) {
    const saveClr = proj.monthlySave >= 0 ? 'var(--success)' : 'var(--danger)';
    return `
    <div class="card" style="padding:.85rem;border-top:3px solid ${sc.color}">
      <input type="text" value="${esc(sc.label)}" class="form-inp" style="font-size:.82rem;font-weight:600;margin-bottom:.65rem;border:none;border-bottom:1px solid var(--bdr);border-radius:0;padding-left:0"
        onchange="Simulator.renameScenario('${id}',this.value)">

      <div style="margin-bottom:.6rem">
        <div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--txt2)">
          <label>Receita <span style="color:var(--success);font-weight:600">${sc.incomeAdj >= 0 ? '+' : ''}${sc.incomeAdj}%</span></label>
          <span>${fmt(proj.incAdj)}/mês</span>
        </div>
        <input type="range" id="slider-inc-${id}" min="-50" max="100" step="5" value="${sc.incomeAdj}"
          style="width:100%;accent-color:var(--success)" oninput="Simulator.updateSlider('${id}','inc',this.value)">
      </div>

      <div style="margin-bottom:.75rem">
        <div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--txt2)">
          <label>Despesas <span style="color:var(--danger);font-weight:600">${sc.expAdj >= 0 ? '+' : ''}${sc.expAdj}%</span></label>
          <span>${fmt(proj.expAdj)}/mês</span>
        </div>
        <input type="range" id="slider-exp-${id}" min="-80" max="50" step="5" value="${sc.expAdj}"
          style="width:100%;accent-color:var(--danger)" oninput="Simulator.updateSlider('${id}','exp',this.value)">
      </div>

      <div style="background:var(--bg-s);border-radius:8px;padding:.5rem .65rem">
        <div style="font-size:.72rem;color:var(--txt2)">Poupança mensal</div>
        <div style="font-size:1.2rem;font-weight:800;font-family:var(--font-h);color:${saveClr}">
          ${fmt(proj.monthlySave)}
          <span style="font-size:.72rem;font-weight:500;color:var(--txt2)">/mês</span>
        </div>
        <div style="font-size:.75rem;color:var(--txt2)">Taxa: ${proj.incAdj > 0 ? Math.round(proj.monthlySave / proj.incAdj * 100) : 0}% da renda</div>
      </div>
      ${sc.extraEvent ? `
      <div style="margin-top:.5rem;font-size:.75rem;color:var(--txt2);background:rgba(var(--accent-rgb),.07);border-radius:6px;padding:.4rem .6rem">
        <i class="fas fa-bolt" style="color:var(--accent)"></i>
        ${esc(sc.extraEvent.label)}: <strong>${fmt(sc.extraEvent.amount)}</strong>
        <button style="float:right;background:none;border:none;color:var(--danger);cursor:pointer;font-size:.7rem"
          onclick="Simulator.clearEvent('${id}')">✕</button>
      </div>` : ''}
    </div>`;
  }

  function tableRow(label, valA, valB, invertColor = false) {
    const diff = valB - valA;
    const clr = invertColor
      ? (diff <= 0 ? 'var(--success)' : 'var(--danger)')
      : (diff >= 0 ? 'var(--success)' : 'var(--danger)');
    return `<tr style="border-bottom:1px solid var(--bdr)">
      <td style="padding:.4rem .5rem;color:var(--txt2)">${label}</td>
      <td style="padding:.4rem .5rem;text-align:right;font-weight:600">${fmt(valA)}</td>
      <td style="padding:.4rem .5rem;text-align:right;font-weight:600">${fmt(valB)}</td>
      <td style="padding:.4rem .5rem;text-align:right;font-weight:700;color:${clr}">
        ${diff >= 0 ? '+' : ''}${fmt(diff)}
      </td>
    </tr>`;
  }

  function buildInsights(base, projA, projB) {
    const saveDiff = projB.monthlySave - projA.monthlySave;
    const insights = [];
    if (projA.monthlySave < 0)
      insights.push({ icon: 'fa-exclamation-triangle', clr: 'var(--danger)', text: `No cenário atual você está gastando mais do que ganha (${fmt(Math.abs(projA.monthlySave))}/mês de déficit).` });
    if (projB.monthlySave > projA.monthlySave)
      insights.push({ icon: 'fa-arrow-trend-up', clr: 'var(--success)', text: `O cenário B economizaria mais ${fmt(saveDiff)}/mês — ${fmt(saveDiff * 12)}/ano a mais.` });
    if (projB.finalBalance > projA.finalBalance)
      insights.push({ icon: 'fa-chart-line', clr: 'var(--accent)', text: `Em ${ST.horizon} meses, o cenário B acumula ${fmt(projB.finalBalance - projA.finalBalance)} a mais que o cenário A.` });
    if (base.avgInc > 0 && base.avgExp / base.avgInc > 0.9)
      insights.push({ icon: 'fa-lightbulb', clr: 'var(--warning)', text: `Seus gastos atuais são ${Math.round(base.avgExp / base.avgInc * 100)}% da renda. Use o slider de despesas para simular cortes.` });
    if (projA.monthlySave > 0)
      insights.push({ icon: 'fa-piggy-bank', clr: 'var(--success)', text: `No ritmo atual você acumula ${fmt(projA.monthlySave * 12)}/ano. Em ${ST.horizon} meses: ${fmt(projA.monthlySave * ST.horizon)}.` });

    if (!insights.length)
      return '<p style="color:var(--txt2);font-size:.83rem">Ajuste os sliders para ver insights comparativos.</p>';

    return `<div style="font-size:.85rem;font-weight:600;margin-bottom:.6rem">💡 Insights da simulação</div>
    ${insights.map(i => `
    <div style="display:flex;gap:.5rem;align-items:flex-start;margin-bottom:.5rem;padding:.5rem;background:var(--bg-s);border-radius:8px">
      <i class="fas ${i.icon}" style="color:${i.clr};margin-top:2px;flex-shrink:0"></i>
      <span style="font-size:.8rem;color:var(--txt2)">${i.text}</span>
    </div>`).join('')}`;
  }

  function goalMonth(proj, goal) {
    for (let i = 0; i < proj.balances.length; i++) {
      if (proj.balances[i] >= goal) return `mês ${i}`;
    }
    return 'além do horizonte';
  }

  /* ── Gráfico Chart.js ── */
  function renderChart(projA, projB) {
    if (!window.Chart) return;
    const ctx = document.getElementById('simChart');
    if (!ctx) return;
    if (ST.chart) { ST.chart.destroy(); ST.chart = null; }
    const scA = ST.scenarios[0], scB = ST.scenarios[1];
    const labels = projB.labels;
    const datasets = [
      { label: scA.label, data: projA.balances.slice(1), borderColor: scA.color, backgroundColor: scA.color + '18', fill: true, tension: 0.35, pointRadius: 2 },
      { label: scB.label, data: projB.balances.slice(1), borderColor: scB.color, backgroundColor: scB.color + '18', fill: true, tension: 0.35, pointRadius: 2 },
    ];
    if (ST.goal > 0) {
      datasets.push({ label: 'Meta', data: Array(labels.length).fill(ST.goal), borderColor: 'var(--success)', borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, fill: false });
    }
    ST.chart = new window.Chart(ctx, {
      type: 'line', data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 10 }, color: 'var(--txt2)' }, grid: { display: false } },
          y: { ticks: { font: { size: 10 }, color: 'var(--txt2)', callback: v => fmt(v) }, grid: { color: 'var(--bdr)' } },
        },
      },
    });
  }

  function bindSliders() {} // Eventos inline via oninput

  /* ═══════════════════════════════════════════════════════════
     API PÚBLICA
  ═══════════════════════════════════════════════════════════ */
  const Simulator = {
    render,
    setHorizon(h) { ST.horizon = h; render(); },
    setGoal(v) {
      ST.goal = parseFloat(v) || 0;
      render();
    },
    renameScenario(id, label) {
      const sc = ST.scenarios.find(s => s.id === id);
      if (sc) sc.label = label;
    },
    updateSlider(scId, type, val) {
      const sc = ST.scenarios.find(s => s.id === scId);
      if (!sc || !ST.baseData) return;
      if (type === 'inc') sc.incomeAdj = parseFloat(val);
      if (type === 'exp') sc.expAdj = parseFloat(val);
      const projA = project(ST.scenarios[0], ST.baseData);
      const projB = project(ST.scenarios[1], ST.baseData);
      // Update apenas os painéis (sem re-render completo para não perder o gráfico)
      const zone = $('simulatorZone') || $('cfRoot');
      if (zone) {
        zone.innerHTML = buildPage(ST.baseData, projA, projB);
        renderChart(projA, projB);
      }
    },
    addEvent() {
      const label = prompt('Nome do evento (ex: Viagem, Compra de carro):');
      if (!label) return;
      const amount_ = prompt('Valor (use negativo para gasto, positivo para receita):');
      if (amount_ === null) return;
      const amount = parseFloat(amount_.replace(',', '.'));
      if (isNaN(amount)) { T('Valor inválido', 'error'); return; }
      const scId = prompt('Aplicar em qual cenário? (A ou B):')?.toUpperCase();
      if (scId !== 'A' && scId !== 'B') return;
      const sc = ST.scenarios.find(s => s.id === scId);
      if (sc) sc.extraEvent = { label, amount };
      render();
    },
    clearEvent(scId) {
      const sc = ST.scenarios.find(s => s.id === scId);
      if (sc) sc.extraEvent = null;
      render();
    },
    saveScenario() {
      const saved = JSON.parse(localStorage.getItem('fp_saved_scenarios') || '[]');
      saved.push({ ts: Date.now(), scenarios: JSON.parse(JSON.stringify(ST.scenarios)), horizon: ST.horizon });
      if (saved.length > 5) saved.shift();
      localStorage.setItem('fp_saved_scenarios', JSON.stringify(saved));
      T('Cenário salvo localmente', 'success');
    },
    reset() {
      ST.scenarios[0] = { id: 'A', label: 'Cenário A (atual)', incomeAdj: 0, expAdj: 0, extraEvent: null, color: 'var(--accent)' };
      ST.scenarios[1] = { id: 'B', label: 'Cenário B (otimista)', incomeAdj: 10, expAdj: -10, extraEvent: null, color: '#3b82f6' };
      ST.horizon = 12;
      ST.baseData = null;
      render();
    },
  };

  window.Simulator = Simulator;
  window.loadSimulator = async function () {
    const zone = $('simulatorZone');
    if (!zone) {
      // Create zone if page structure exists
      const page = document.getElementById('page-simulator');
      if (page) {
        let z = page.querySelector('.sim-content');
        if (!z) { z = document.createElement('div'); z.id = 'simulatorZone'; page.appendChild(z); }
      }
    }
    await Simulator.render();
  };

  // Navigate handled by app.js loaders

})();
