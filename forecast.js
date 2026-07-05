/**
 * @fileoverview FinancePro — forecast.js
 * Projeção de saldo futuro baseada em:
 *  - Média histórica de receitas/despesas
 *  - Transações recorrentes cadastradas
 *  - Assinaturas ativas
 * Exibe gráfico de linha nos próximos 30/60/90 dias.
 */

'use strict';

App.forecast = (() => {

  let _chart = null;

  /* ══════════════════════════════════════
     PAGE INJECTION
  ══════════════════════════════════════ */
  function injectPage() {
    const page = $id('page-forecast');
    if (!page || $id('forecastChart')) return;
    page.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Projeção Financeira</h1>
          <p class="page-subtitle">Estimativa do saldo futuro com base no histórico</p>
        </div>
        <div class="header-actions">
          <div class="period-filter">
            <button class="period-btn active" data-days="30"  onclick="App.forecast.load(30)">30 dias</button>
            <button class="period-btn"        data-days="60"  onclick="App.forecast.load(60)">60 dias</button>
            <button class="period-btn"        data-days="90"  onclick="App.forecast.load(90)">90 dias</button>
          </div>
        </div>
      </div>

      <!-- KPI strip -->
      <div class="stats-grid" id="forecastKpis" style="grid-template-columns:repeat(3,1fr)"></div>

      <!-- Main chart -->
      <div class="card" style="margin-bottom:var(--space-5)">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-chart-line"></i> Saldo projetado dia a dia</h3>
        </div>
        <div style="padding:var(--space-5);min-height:320px">
          <canvas id="forecastChart"></canvas>
        </div>
      </div>

      <!-- Upcoming fixed events -->
      <div class="dashboard-bottom">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-calendar-check"></i> Receitas previstas</h3>
          </div>
          <div id="forecastIncoming"></div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-calendar-times"></i> Despesas previstas</h3>
          </div>
          <div id="forecastOutgoing"></div>
        </div>
      </div>
    `;
  }

  /* ══════════════════════════════════════
     MAIN LOAD
  ══════════════════════════════════════ */
  async function load(days = 30) {
    injectPage();

    // Period buttons
    document.querySelectorAll('[data-days]').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.days) === days);
    });

    const uid = App.state.currentUser.id;
    const cur = App.state.settings?.currency;

    /* 1 — Current balance (sum of all accounts) */
    const accs = App.state.accountsCache;
    const allTxs = await db.transactions.where('userId').equals(uid).toArray();

    let currentBalance = accs.reduce((s, a) => s + (a.initialBalance || 0), 0);
    allTxs.forEach(t => {
      if (t.type === 'income')   currentBalance += t.amount;
      if (t.type === 'expense')  currentBalance -= t.amount;
    });

    /* 2 — Monthly averages (last 3 months) */
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const cutoff = threeMonthsAgo.toISOString().split('T')[0];

    const recentTxs = allTxs.filter(t => t.date >= cutoff);
    const avgMonthlyIncome  = recentTxs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)  / 3;
    const avgMonthlyExpense = recentTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0) / 3;
    const avgDailyIncome    = avgMonthlyIncome  / 30;
    const avgDailyExpense   = avgMonthlyExpense / 30;

    /* 3 — Recurring transactions (future occurrences) */
    const recurringTxs = allTxs.filter(t => t.isRecurring && t.recurringRule);
    const futureEvents = buildFutureEvents(recurringTxs, days);

    /* 4 — Subscriptions due dates */
    let subs = [];
    try { subs = await db.subscriptions.where('userId').equals(uid).toArray(); } catch {}
    const activeSubs = subs.filter(s => s.active !== false && s.nextDue);
    activeSubs.forEach(s => {
      const d = new Date(s.nextDue + 'T00:00:00');
      const endDate = new Date(); endDate.setDate(endDate.getDate() + days);
      while (d <= endDate) {
        futureEvents.push({
          date: d.toISOString().split('T')[0],
          type: 'expense',
          amount: s.amount,
          label: s.name + ' (assinatura)',
          icon: s.icon || 'fa-credit-card',
          color: s.color || 'var(--color-danger)',
        });
        // Advance date by cycle
        if (s.cycle === 'monthly')   d.setMonth(d.getMonth()+1);
        else if (s.cycle === 'yearly')    d.setFullYear(d.getFullYear()+1);
        else if (s.cycle === 'quarterly') d.setMonth(d.getMonth()+3);
        else if (s.cycle === 'weekly')    d.setDate(d.getDate()+7);
        else break;
        if (d > endDate) break;
      }
    });

    /* 5 — Build daily projection */
    const projection = buildProjection(currentBalance, avgDailyIncome, avgDailyExpense, futureEvents, days);

    /* 6 — Render */
    renderKpis(currentBalance, projection, days, cur);
    renderChart(projection, cur);
    renderEventLists(futureEvents, cur);
  }

  /* ── Build future events from recurring rules ── */
  function buildFutureEvents(recurring, days) {
    const events = [];
    const now = new Date();
    const end = new Date(); end.setDate(end.getDate() + days);

    recurring.forEach(tx => {
      if (!tx.recurringRule?.frequency) return;
      const freq = tx.recurringRule.frequency;
      const ruleEnd = tx.recurringRule.endDate ? new Date(tx.recurringRule.endDate) : end;
      const actualEnd = ruleEnd < end ? ruleEnd : end;

      let d = new Date(tx.date + 'T00:00:00');
      // Advance to today or later
      while (d <= now) {
        advanceDate(d, freq);
      }
      while (d <= actualEnd) {
        events.push({
          date:   d.toISOString().split('T')[0],
          type:   tx.type,
          amount: tx.amount,
          label:  tx.description || 'Recorrente',
          icon:   'fa-repeat',
          color:  tx.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)',
        });
        advanceDate(d, freq);
      }
    });
    return events;
  }

  function advanceDate(d, freq) {
    if (freq === 'daily')    d.setDate(d.getDate()+1);
    else if (freq === 'weekly')   d.setDate(d.getDate()+7);
    else if (freq === 'biweekly') d.setDate(d.getDate()+14);
    else if (freq === 'monthly')  d.setMonth(d.getMonth()+1);
    else if (freq === 'yearly')   d.setFullYear(d.getFullYear()+1);
  }

  /* ── Build day-by-day projection array ── */
  function buildProjection(startBalance, dailyIncome, dailyExpense, events, days) {
    const projection = [];
    let balance = startBalance;

    for (let i = 1; i <= days; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];

      // Average daily flow
      balance += dailyIncome - dailyExpense;

      // Known future events
      const dayEvents = events.filter(e => e.date === dateStr);
      dayEvents.forEach(e => {
        if (e.type === 'income')  balance += e.amount;
        if (e.type === 'expense') balance -= e.amount;
      });

      projection.push({ date: dateStr, balance, events: dayEvents });
    }
    return projection;
  }

  /* ── KPI cards ── */
  function renderKpis(current, projection, days, cur) {
    const last   = projection[projection.length - 1];
    const low    = Math.min(...projection.map(p => p.balance));
    const trend  = last.balance - current;
    const trendCls = trend >= 0 ? 'success' : 'danger';

    $id('forecastKpis').innerHTML = `
      <div class="stat-card">
        <div class="stat-icon stat-icon--balance"><i class="fas fa-wallet"></i></div>
        <div class="stat-info">
          <div class="stat-label">Saldo atual</div>
          <div class="stat-value">${formatCurrency(current,cur)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:${trend>=0?'var(--color-success)':'var(--color-danger)'}">
          <i class="fas fa-arrow-trend-${trend>=0?'up':'down'}"></i>
        </div>
        <div class="stat-info">
          <div class="stat-label">Projeção em ${days} dias</div>
          <div class="stat-value text-${trendCls}">${formatCurrency(last?.balance||0,cur)}</div>
          <div class="stat-change stat-change--${trendCls}">
            <i class="fas fa-arrow-${trend>=0?'up':'down'}"></i>
            ${trend>=0?'+':''}${formatCurrency(trend,cur)}
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon--expense"><i class="fas fa-triangle-exclamation"></i></div>
        <div class="stat-info">
          <div class="stat-label">Saldo mínimo previsto</div>
          <div class="stat-value ${low<0?'text-danger':''}">${formatCurrency(low,cur)}</div>
          ${low < 0 ? '<div class="stat-change stat-change--down"><i class="fas fa-exclamation-triangle"></i> Saldo negativo previsto!</div>' : ''}
        </div>
      </div>
    `;
  }

  /* ── Chart ── */
  function renderChart(projection, cur) {
    const ctx = $id('forecastChart')?.getContext('2d');
    if (!ctx) return;
    if (_chart) _chart.destroy();

    const labels   = projection.map(p => p.date.slice(5)); // MM-DD
    const balances = projection.map(p => p.balance);
    const gradient = ctx.createLinearGradient(0, 0, 0, 320);
    gradient.addColorStop(0, 'rgba(16,185,129,0.25)');
    gradient.addColorStop(1, 'rgba(16,185,129,0)');

    const textColor  = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
    const borderClr  = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();

    _chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Saldo projetado',
          data: balances,
          borderColor: '#10b981',
          backgroundColor: gradient,
          tension: 0.4,
          fill: true,
          pointRadius: p => projection[p.index]?.events?.length ? 5 : 1,
          pointBackgroundColor: p => {
            const evts = projection[p.index]?.events || [];
            if (evts.some(e=>e.type==='expense')) return '#ef4444';
            if (evts.some(e=>e.type==='income'))  return '#10b981';
            return '#10b981';
          },
          pointHoverRadius: 7,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` Saldo: ${formatCurrency(ctx.raw, cur)}`,
              afterBody: ctx => {
                const evts = projection[ctx[0].dataIndex]?.events || [];
                return evts.map(e => `  ${e.type==='income'?'▲':'▼'} ${e.label}: ${formatCurrency(e.amount,cur)}`);
              }
            }
          }
        },
        scales: {
          x: { grid:{color:borderClr}, ticks:{color:textColor,font:{family:'DM Sans'},maxTicksLimit:12} },
          y: {
            grid:{color:borderClr},
            ticks:{
              color:textColor,font:{family:'DM Sans'},
              callback: v => formatCurrency(v,cur).replace(/\s/g,'\u00A0')
            }
          }
        }
      }
    });
  }

  /* ── Event lists ── */
  function renderEventLists(events, cur) {
    const income  = events.filter(e=>e.type==='income').sort((a,b)=>a.date.localeCompare(b.date)).slice(0,10);
    const expense = events.filter(e=>e.type==='expense').sort((a,b)=>a.date.localeCompare(b.date)).slice(0,10);

    const renderList = (list, el) => {
      if (!list.length) {
        $id(el).innerHTML = '<div class="empty-state" style="padding:var(--space-6)"><p class="empty-text">Nenhum evento previsto.</p></div>';
        return;
      }
      $id(el).innerHTML = list.map(e => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 20px;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:10px">
            <i class="fas ${e.icon||'fa-calendar'}" style="color:${e.color};width:16px"></i>
            <div>
              <div style="font-size:var(--text-sm);font-weight:var(--fw-medium)">${escapeHtml(e.label)}</div>
              <div style="font-size:var(--text-xs);color:var(--text-secondary)">${formatDate(e.date)}</div>
            </div>
          </div>
          <span class="tx-amount tx-amount--${e.type}">${e.type==='income'?'+':'−'} ${formatCurrency(e.amount,cur)}</span>
        </div>
      `).join('');
    };

    renderList(income,  'forecastIncoming');
    renderList(expense, 'forecastOutgoing');
  }

  return { load };
})();
