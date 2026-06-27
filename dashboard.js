/**
 * @fileoverview FinancePro — dashboard.js
 * Dashboard: stat cards, pie/line charts, budget alerts, recent transactions.
 */

'use strict';

App.dashboard = (() => {

  let pieChart = null;
  let lineChart = null;

  /* ── Set period ── */
  function setPeriod(period) {
    App.state.dashPeriod = period;
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.period === period);
    });
    load();
  }

  /* ── Date range from period ── */
  function getRange(period) {
    const now = new Date();
    let start, end;
    end = now.toISOString().split('T')[0];

    if (period === 'month') {
      start = monthStart(now);
      end   = monthEnd(now);
    } else if (period === 'quarter') {
      const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1);
      start = qStart.toISOString().split('T')[0];
    } else if (period === 'year') {
      start = `${now.getFullYear()}-01-01`;
    }
    return { start, end };
  }

  /* ── Main load ── */
  async function load() {
    if (!App.state.currentUser) return;
    const uid = App.state.currentUser.id;

    // Greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    $id('dashGreeting').textContent = `${greeting}, ${App.state.currentUser.name.split(' ')[0]}! 👋`;
    $id('dashDate').textContent = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // Show skeletons
    showSkeletons();

    const { start, end } = getRange(App.state.dashPeriod);

    // Load all transactions for the user
    let allTxs = await db.transactions.where('userId').equals(uid).toArray();

    // Filter by period
    const periodTxs = allTxs.filter(t => t.date >= start && t.date <= end && t.type !== 'transfer');
    const income  = periodTxs.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
    const expense = periodTxs.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
    const balance = income - expense;
    const savingsRate = income > 0 ? (balance / income) * 100 : 0;

    // Previous period comparison
    const prevIncome  = await getPrevPeriod(uid, 'income',  App.state.dashPeriod);
    const prevExpense = await getPrevPeriod(uid, 'expense', App.state.dashPeriod);

    const cur = App.state.settings?.currency;

    // Render stat cards
    $id('dashStats').innerHTML = `
      ${statCard('statBalance', 'stat-icon--balance', 'fa-scale-balanced',
        'Saldo do Período', formatCurrency(balance, cur), balance, null, balance < 0 ? 'danger' : 'success')}
      ${statCard('statIncome', 'stat-icon--income', 'fa-arrow-trend-up',
        'Receitas', formatCurrency(income, cur), income, prevIncome, 'success')}
      ${statCard('statExpense', 'stat-icon--expense', 'fa-arrow-trend-down',
        'Despesas', formatCurrency(expense, cur), expense, prevExpense, 'danger')}
      ${statCard('statSavings', 'stat-icon--savings', 'fa-piggy-bank',
        'Taxa de Poupança', `${Math.round(savingsRate)}%`, savingsRate, null, savingsRate > 20 ? 'success' : 'warning')}
    `;

    // Charts
    renderPieChart(periodTxs);
    renderLineChart(uid, allTxs);

    // Budget alerts
    renderBudgetStatus(uid, start, end, expense);

    // Recent transactions
    renderRecent(allTxs);
  }

  /* ── Stat card HTML ── */
  function statCard(id, iconClass, icon, label, value, raw, prev, tone) {
    let change = '';
    if (prev !== null && prev !== undefined) {
      const diff = raw - prev;
      const pctDiff = prev !== 0 ? Math.abs((diff / prev) * 100) : 0;
      const up = diff >= 0;
      const isGood = (tone === 'income' || tone === 'success') ? up : !up;
      change = `<span class="stat-change stat-change--${isGood ? 'up' : 'down'}">
        <i class="fas fa-arrow-${up ? 'up' : 'down'}"></i>
        ${fmtPct(pctDiff)} vs período anterior
      </span>`;
    }
    return `
      <div class="stat-card" id="${id}">
        <div class="stat-icon ${iconClass}"><i class="fas ${icon}"></i></div>
        <div class="stat-info">
          <div class="stat-label">${escapeHtml(label)}</div>
          <div class="stat-value">${escapeHtml(value)}</div>
          ${change}
        </div>
      </div>
    `;
  }

  /* ── Get previous period total ── */
  async function getPrevPeriod(uid, type, period) {
    const now = new Date();
    let start, end;

    if (period === 'month') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start = monthStart(prev);
      end   = monthEnd(prev);
    } else if (period === 'quarter') {
      const q = Math.floor(now.getMonth()/3);
      const prev = new Date(now.getFullYear(), (q-1)*3, 1);
      start = prev.toISOString().split('T')[0];
      const endDate = new Date(now.getFullYear(), q*3, 0);
      end = endDate.toISOString().split('T')[0];
    } else {
      start = `${now.getFullYear()-1}-01-01`;
      end   = `${now.getFullYear()-1}-12-31`;
    }

    const txs = await db.transactions
      .where('[userId+type]').equals([uid, type])
      .filter(t => t.date >= start && t.date <= end)
      .toArray();
    return txs.reduce((s,t) => s+t.amount, 0);
  }

  /* ── Pie Chart: expenses by category ── */
  async function renderPieChart(txs) {
    const cats   = App.state.categoriesCache;
    const catMap = Object.fromEntries(cats.map(c => [c.id, c]));
    const byCat  = {};

    txs.filter(t => t.type === 'expense').forEach(t => {
      const name = catMap[t.categoryId]?.name || 'Outros';
      byCat[name] = (byCat[name] || 0) + t.amount;
    });

    const labels = Object.keys(byCat);
    const data   = Object.values(byCat);

    const ctx = $id('dashPieChart')?.getContext('2d');
    if (!ctx) return;

    if (pieChart) pieChart.destroy();

    if (!labels.length) {
      ctx.canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="fas fa-chart-pie"></i></div><p class="empty-text">Nenhuma despesa no período</p></div>';
      return;
    }

    const colors = labels.map((_,i) => {
      const cat = cats.find(c => c.name === labels[i]);
      return cat?.color || chartColor(i);
    });

    pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: 'var(--surface)',
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim(),
              font: { family: 'DM Sans', size: 12 },
              boxWidth: 12, padding: 12,
            }
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.raw)}`
            }
          }
        },
        cutout: '65%',
      }
    });
  }

  /* ── Line Chart: balance evolution (last 6 months) ── */
  async function renderLineChart(uid, allTxs) {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(toMonthKey(d));
    }

    const incomeData  = months.map(m => allTxs.filter(t => t.date.startsWith(m) && t.type === 'income').reduce((s,t) => s+t.amount, 0));
    const expenseData = months.map(m => allTxs.filter(t => t.date.startsWith(m) && t.type === 'expense').reduce((s,t) => s+t.amount, 0));
    const balanceData = months.map((_,i) => incomeData[i] - expenseData[i]);

    const monthLabels = months.map(m => {
      const [y,mo] = m.split('-');
      return new Date(y, mo-1, 1).toLocaleDateString('pt-BR', { month: 'short' });
    });

    const ctx = $id('dashLineChart')?.getContext('2d');
    if (!ctx) return;
    if (lineChart) lineChart.destroy();

    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
    const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();

    lineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: monthLabels,
        datasets: [
          {
            label: 'Saldo', data: balanceData,
            borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)',
            tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 6,
          },
          {
            label: 'Receitas', data: incomeData,
            borderColor: '#3b82f6', backgroundColor: 'transparent',
            tension: 0.4, borderDash: [4,4], pointRadius: 3,
          },
          {
            label: 'Despesas', data: expenseData,
            borderColor: '#ef4444', backgroundColor: 'transparent',
            tension: 0.4, borderDash: [4,4], pointRadius: 3,
          },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: {
          legend: {
            labels: {
              color: textColor, font: { family: 'DM Sans', size: 12 },
              boxWidth: 12, padding: 16,
            }
          },
          tooltip: {
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}` }
          }
        },
        scales: {
          x: { grid: { color: borderColor }, ticks: { color: textColor, font: { family: 'DM Sans' } } },
          y: {
            grid: { color: borderColor },
            ticks: {
              color: textColor, font: { family: 'DM Sans' },
              callback: v => formatCurrency(v).replace(/\s/g, '\u00A0')
            }
          }
        }
      }
    });
  }

  /* ── Budget status ── */
  async function renderBudgetStatus(uid, start, end) {
    const month    = start.slice(0,7);
    const budgets  = await db.budgets.where({ userId: uid, monthYear: month }).toArray();
    const txs      = await db.transactions.where('userId').equals(uid)
      .filter(t => t.date >= start && t.date <= end && t.type === 'expense').toArray();
    const cats     = App.state.categoriesCache;
    const catMap   = Object.fromEntries(cats.map(c => [c.id, c]));
    const cur      = App.state.settings?.currency;

    const el = $id('dashBudgets');
    const activeBudgets = budgets.filter(b => b.limitAmount > 0 && b.categoryId);

    if (!activeBudgets.length) {
      el.innerHTML = `<div class="empty-state" style="padding:var(--space-6)">
        <div class="empty-icon"><i class="fas fa-bullseye"></i></div>
        <p class="empty-text">Nenhum orçamento definido ainda</p>
        <button class="btn btn-outline btn-sm" onclick="App.navigate('budgets')">Definir orçamentos</button>
      </div>`;
      return;
    }

    const items = activeBudgets
      .map(b => {
        const cat   = catMap[b.categoryId];
        if (!cat) return null;
        const spent = txs.filter(t => t.categoryId === b.categoryId).reduce((s,t) => s+t.amount, 0);
        const p     = pct(spent, b.limitAmount);
        const fillClass = p >= 100 ? 'danger' : p >= 80 ? 'warning' : 'success';
        return { cat, spent, limit: b.limitAmount, p, fillClass };
      })
      .filter(Boolean)
      .sort((a,b) => b.p - a.p)
      .slice(0, 5);

    el.innerHTML = items.map(item => `
      <div style="padding:12px 20px;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:32px;height:32px;border-radius:8px;background:${item.cat.color};display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px">
              <i class="fas ${item.cat.icon || 'fa-tag'}"></i>
            </div>
            <span style="font-size:var(--text-sm);font-weight:var(--fw-medium)">${escapeHtml(item.cat.name)}</span>
          </div>
          <span class="badge badge--${item.fillClass}">${fmtPct(item.p)}</span>
        </div>
        <div class="progress">
          <div class="progress-fill progress-fill--${item.fillClass}" style="width:${Math.min(item.p,100)}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:5px;font-size:var(--text-xs);color:var(--text-secondary)">
          <span>${formatCurrency(item.spent, cur)} gastos</span>
          <span>de ${formatCurrency(item.limit, cur)}</span>
        </div>
      </div>
    `).join('');
  }

  /* ── Recent transactions ── */
  async function renderRecent(allTxs) {
    const cats   = App.state.categoriesCache;
    const catMap = Object.fromEntries(cats.map(c => [c.id, c]));
    const accs   = App.state.accountsCache;
    const accMap = Object.fromEntries(accs.map(a => [a.id, a]));
    const cur    = App.state.settings?.currency;

    const recent = [...allTxs]
      .sort((a,b) => b.date.localeCompare(a.date) || b.id - a.id)
      .slice(0, 7);

    const el = $id('dashRecentTx');

    if (!recent.length) {
      el.innerHTML = `<div class="empty-state" style="padding:var(--space-6)">
        <div class="empty-icon"><i class="fas fa-receipt"></i></div>
        <p class="empty-text">Nenhuma transação registrada ainda</p>
        <button class="btn btn-primary btn-sm" onclick="App.transactions.openModal()">
          <i class="fas fa-plus"></i> Adicionar
        </button>
      </div>`;
      return;
    }

    el.innerHTML = recent.map(t => {
      const cat   = catMap[t.categoryId] || {};
      const sign  = t.type === 'income' ? '+' : t.type === 'transfer' ? '⇄' : '−';
      const amtClass = `tx-amount--${t.type}`;
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border);cursor:pointer"
             onclick="App.transactions.editModal(${t.id})">
          <div style="width:36px;height:36px;border-radius:10px;background:${cat.color||'var(--border)'};display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;flex-shrink:0">
            <i class="fas ${cat.icon||'fa-tag'}"></i>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:var(--text-sm);font-weight:var(--fw-medium);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${escapeHtml(t.description || cat.name || 'Transação')}
            </div>
            <div style="font-size:var(--text-xs);color:var(--text-secondary)">
              ${relativeDate(t.date)} • ${escapeHtml(cat.name || '?')}
              ${t.installmentNum ? `<span class="installment-badge">${t.installmentNum}/${t.installmentTotal}</span>` : ''}
              ${t.isRecurring ? '<i class="fas fa-repeat recurring-icon"></i>' : ''}
            </div>
          </div>
          <span class="tx-amount ${amtClass}">${sign} ${formatCurrency(t.amount, cur)}</span>
        </div>
      `;
    }).join('');
  }

  /* ── Skeletons ── */
  function showSkeletons() {
    $id('dashStats').innerHTML = Array(4).fill(`
      <div class="stat-card skeleton" style="min-height:100px"></div>
    `).join('');
  }

  return { load, setPeriod };
})();
