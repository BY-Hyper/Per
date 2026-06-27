/**
 * @fileoverview FinancePro — calculator.js
 * Calculadora financeira integrada:
 *  - Juros compostos / rendimento
 *  - Simulador de parcelamento (Price / SAC)
 *  - Simulador de investimento mensal
 *  - Comparador de empréstimo vs investimento
 */

'use strict';

App.calculator = (() => {

  let _resultsChart = null;

  /* ══════════════════════════════════════
     PAGE INJECTION
  ══════════════════════════════════════ */
  function injectPage() {
    const page = $id('page-calculator');
    if (!page || $id('calcTabs')) return;
    page.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Calculadora Financeira</h1>
        <p class="page-subtitle">Simuladores de juros, parcelas e investimentos</p>
      </div>

      <!-- Tab Nav -->
      <div class="auth-tabs" id="calcTabs" style="max-width:600px;margin-bottom:var(--space-5)">
        <button class="auth-tab active" onclick="App.calculator.showTab('compound')">Juros Compostos</button>
        <button class="auth-tab" onclick="App.calculator.showTab('installment')">Parcelamento</button>
        <button class="auth-tab" onclick="App.calculator.showTab('invest')">Investimento</button>
      </div>

      <div class="dashboard-bottom" style="align-items:start">

        <!-- ── COMPOUND INTEREST ── -->
        <div class="card" id="calcCompound">
          <div class="card-header"><h3 class="card-title"><i class="fas fa-percentage"></i> Juros Compostos</h3></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:var(--space-4)">
            <div class="form-group">
              <label class="form-label">Capital inicial (R$)</label>
              <input type="number" id="ciPrincipal" class="form-input" placeholder="1000" value="1000" />
            </div>
            <div class="form-group">
              <label class="form-label">Taxa de juros (% ao mês)</label>
              <input type="number" id="ciRate" class="form-input" placeholder="1.0" value="1" step="0.01" />
            </div>
            <div class="form-group">
              <label class="form-label">Período (meses)</label>
              <input type="number" id="ciPeriod" class="form-input" placeholder="12" value="12" />
            </div>
            <div class="form-group">
              <label class="form-label">Aporte mensal (R$)</label>
              <input type="number" id="ciMonthly" class="form-input" placeholder="0" value="0" />
            </div>
            <button class="btn btn-primary" onclick="App.calculator.calcCompound()">
              <i class="fas fa-calculator"></i> Calcular
            </button>
            <div id="ciResult" class="calc-result-box hidden"></div>
          </div>
        </div>

        <!-- ── INSTALLMENT ── -->
        <div class="card hidden" id="calcInstallment">
          <div class="card-header"><h3 class="card-title"><i class="fas fa-credit-card"></i> Simulador de Parcelamento</h3></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:var(--space-4)">
            <div class="form-group">
              <label class="form-label">Valor total (R$)</label>
              <input type="number" id="instTotal" class="form-input" placeholder="1000" value="1000" />
            </div>
            <div class="form-group">
              <label class="form-label">Número de parcelas</label>
              <input type="number" id="instN" class="form-input" placeholder="12" value="12" min="1" max="360" />
            </div>
            <div class="form-group">
              <label class="form-label">Taxa de juros (% ao mês)</label>
              <input type="number" id="instRate" class="form-input" placeholder="0" value="0" step="0.01" />
            </div>
            <div class="form-group">
              <label class="form-label">Sistema de amortização</label>
              <select id="instSystem" class="form-input">
                <option value="price">Price (parcelas iguais)</option>
                <option value="sac">SAC (amortização constante)</option>
                <option value="simple">Sem juros</option>
              </select>
            </div>
            <button class="btn btn-primary" onclick="App.calculator.calcInstallment()">
              <i class="fas fa-calculator"></i> Calcular
            </button>
            <div id="instResult" class="calc-result-box hidden"></div>
          </div>
        </div>

        <!-- ── INVESTMENT ── -->
        <div class="card hidden" id="calcInvest">
          <div class="card-header"><h3 class="card-title"><i class="fas fa-chart-line"></i> Simulador de Investimento</h3></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:var(--space-4)">
            <div class="form-group">
              <label class="form-label">Investimento inicial (R$)</label>
              <input type="number" id="invPrincipal" class="form-input" value="500" />
            </div>
            <div class="form-group">
              <label class="form-label">Aporte mensal (R$)</label>
              <input type="number" id="invMonthly" class="form-input" value="300" />
            </div>
            <div class="form-group">
              <label class="form-label">Rentabilidade (% ao mês)</label>
              <input type="number" id="invRate" class="form-input" value="1" step="0.01" />
            </div>
            <div class="form-group">
              <label class="form-label">Período (anos)</label>
              <input type="number" id="invYears" class="form-input" value="10" min="1" max="50" />
            </div>
            <button class="btn btn-primary" onclick="App.calculator.calcInvest()">
              <i class="fas fa-calculator"></i> Simular
            </button>
            <div id="invResult" class="calc-result-box hidden"></div>
          </div>
        </div>

        <!-- Chart panel (shared) -->
        <div class="card" id="calcChartPanel" style="display:flex;flex-direction:column">
          <div class="card-header"><h3 class="card-title" id="calcChartTitle">Gráfico</h3></div>
          <div style="padding:var(--space-5);flex:1;min-height:280px;display:flex;align-items:center;justify-content:center" id="calcChartWrapper">
            <p style="color:var(--text-tertiary);font-size:var(--text-sm)">Preencha os dados ao lado e clique em Calcular</p>
          </div>
        </div>
      </div>
    `;
  }

  /* ── Tab switching ── */
  function showTab(tab) {
    const panels = { compound:'calcCompound', installment:'calcInstallment', invest:'calcInvest' };
    Object.values(panels).forEach(id => $id(id)?.classList.add('hidden'));
    $id(panels[tab])?.classList.remove('hidden');

    document.querySelectorAll('#calcTabs .auth-tab').forEach((btn, i) => {
      btn.classList.toggle('active', ['compound','installment','invest'][i] === tab);
    });
  }

  /* ══════════════════════════════════════
     COMPOUND INTEREST
  ══════════════════════════════════════ */
  function calcCompound() {
    const P  = parseFloat($id('ciPrincipal').value) || 0;
    const r  = parseFloat($id('ciRate').value)      / 100;
    const n  = parseInt($id('ciPeriod').value)       || 12;
    const M  = parseFloat($id('ciMonthly').value)    || 0;
    const cur = App.state.settings?.currency;

    const monthly = [];
    let balance = P;
    let totalContrib = P;

    for (let i = 1; i <= n; i++) {
      balance = balance * (1 + r) + M;
      totalContrib += M;
      monthly.push(parseFloat(balance.toFixed(2)));
    }

    const totalInterest = balance - totalContrib;

    $id('ciResult').className = 'calc-result-box';
    $id('ciResult').innerHTML = `
      <div class="calc-kpi-row">
        <div class="calc-kpi"><span class="calc-kpi-label">Montante final</span>
          <span class="calc-kpi-value text-success">${formatCurrency(balance,cur)}</span></div>
        <div class="calc-kpi"><span class="calc-kpi-label">Total investido</span>
          <span class="calc-kpi-value">${formatCurrency(totalContrib,cur)}</span></div>
        <div class="calc-kpi"><span class="calc-kpi-label">Juros gerados</span>
          <span class="calc-kpi-value text-info">${formatCurrency(totalInterest,cur)}</span></div>
      </div>
      <div class="calc-kpi-row" style="margin-top:8px">
        <div class="calc-kpi"><span class="calc-kpi-label">Rendimento total</span>
          <span class="calc-kpi-value">${totalContrib>0?((totalInterest/totalContrib)*100).toFixed(1):'0'}%</span></div>
        <div class="calc-kpi"><span class="calc-kpi-label">Período</span>
          <span class="calc-kpi-value">${n} meses</span></div>
      </div>
    `;

    renderCalcChart('Evolução do Saldo',
      Array.from({length:n},(_, i)=>`Mês ${i+1}`),
      [{ label:'Saldo', data:monthly, borderColor:'#10b981', backgroundColor:'rgba(16,185,129,0.15)', fill:true, tension:0.4 }]
    );
  }

  /* ══════════════════════════════════════
     INSTALLMENT CALCULATOR
  ══════════════════════════════════════ */
  function calcInstallment() {
    const PV  = parseFloat($id('instTotal').value) || 0;
    const n   = parseInt($id('instN').value)        || 12;
    const r   = parseFloat($id('instRate').value)   / 100;
    const sys = $id('instSystem').value;
    const cur = App.state.settings?.currency;

    let parcelas = [];

    if (sys === 'simple' || r === 0) {
      const val = PV / n;
      parcelas = Array(n).fill(parseFloat(val.toFixed(2)));
      parcelas[n-1] = parseFloat((PV - val*(n-1)).toFixed(2)); // adjust last
    } else if (sys === 'price') {
      // PMT = PV * r / (1 - (1+r)^-n)
      const pmt = PV * r / (1 - Math.pow(1+r, -n));
      parcelas = Array(n).fill(parseFloat(pmt.toFixed(2)));
    } else if (sys === 'sac') {
      const amort = PV / n;
      let saldo = PV;
      for (let i = 0; i < n; i++) {
        const juros = saldo * r;
        parcelas.push(parseFloat((amort + juros).toFixed(2)));
        saldo -= amort;
      }
    }

    const totalPago = parcelas.reduce((s,p)=>s+p,0);
    const totalJuros = totalPago - PV;

    $id('instResult').className = 'calc-result-box';
    $id('instResult').innerHTML = `
      <div class="calc-kpi-row">
        <div class="calc-kpi"><span class="calc-kpi-label">1ª parcela</span>
          <span class="calc-kpi-value">${formatCurrency(parcelas[0],cur)}</span></div>
        <div class="calc-kpi"><span class="calc-kpi-label">Última parcela</span>
          <span class="calc-kpi-value">${formatCurrency(parcelas[n-1],cur)}</span></div>
        <div class="calc-kpi"><span class="calc-kpi-label">Total pago</span>
          <span class="calc-kpi-value text-danger">${formatCurrency(totalPago,cur)}</span></div>
        <div class="calc-kpi"><span class="calc-kpi-label">Total de juros</span>
          <span class="calc-kpi-value">${formatCurrency(totalJuros,cur)}</span></div>
      </div>
      <div style="margin-top:10px;font-size:var(--text-xs);color:var(--text-secondary)">
        ${sys==='sac'?'SAC: parcelas decrescentes | Amortização constante de '+formatCurrency(PV/n,cur)+'/mês':
          sys==='price'?'Price: parcelas iguais de '+formatCurrency(parcelas[0],cur):
          'Sem juros: '+formatCurrency(parcelas[0],cur)+'/parcela'}
      </div>
    `;

    renderCalcChart('Valor das Parcelas',
      Array.from({length:n},(_,i)=>`${i+1}`),
      [{ label:'Parcela', data:parcelas, backgroundColor:'rgba(59,130,246,0.7)', borderRadius:4 }],
      'bar'
    );
  }

  /* ══════════════════════════════════════
     INVESTMENT SIMULATOR
  ══════════════════════════════════════ */
  function calcInvest() {
    const P     = parseFloat($id('invPrincipal').value) || 0;
    const M     = parseFloat($id('invMonthly').value)   || 0;
    const r     = parseFloat($id('invRate').value)      / 100;
    const years = parseInt($id('invYears').value)        || 10;
    const n     = years * 12;
    const cur   = App.state.settings?.currency;

    const balances = [], contributions = [];
    let balance = P, totalContrib = P;

    for (let i = 1; i <= n; i++) {
      balance = balance * (1 + r) + M;
      totalContrib += M;
      if (i % 12 === 0) {
        balances.push(parseFloat(balance.toFixed(2)));
        contributions.push(parseFloat(totalContrib.toFixed(2)));
      }
    }

    const totalInterest = balance - totalContrib;

    $id('invResult').className = 'calc-result-box';
    $id('invResult').innerHTML = `
      <div class="calc-kpi-row">
        <div class="calc-kpi"><span class="calc-kpi-label">Patrimônio em ${years} anos</span>
          <span class="calc-kpi-value text-success">${formatCurrency(balance,cur)}</span></div>
        <div class="calc-kpi"><span class="calc-kpi-label">Total investido</span>
          <span class="calc-kpi-value">${formatCurrency(totalContrib,cur)}</span></div>
        <div class="calc-kpi"><span class="calc-kpi-label">Rendimento</span>
          <span class="calc-kpi-value text-info">${formatCurrency(totalInterest,cur)}</span></div>
        <div class="calc-kpi"><span class="calc-kpi-label">Multiplicador</span>
          <span class="calc-kpi-value">${totalContrib>0?(balance/totalContrib).toFixed(2):'—'}x</span></div>
      </div>
    `;

    const labels = Array.from({length:years},(_,i)=>`Ano ${i+1}`);
    renderCalcChart(`Crescimento em ${years} anos`, labels, [
      { label:'Patrimônio',  data:balances,      borderColor:'#10b981', backgroundColor:'rgba(16,185,129,0.2)', fill:true, tension:0.4 },
      { label:'Investido',   data:contributions, borderColor:'#3b82f6', backgroundColor:'transparent', borderDash:[5,5], tension:0.4 },
    ]);
  }

  /* ── Shared chart renderer ── */
  function renderCalcChart(title, labels, datasets, type='line') {
    $id('calcChartTitle').textContent = title;
    const wrapper = $id('calcChartWrapper');
    wrapper.innerHTML = '<canvas id="calcChart"></canvas>';
    const ctx = $id('calcChart').getContext('2d');
    if (_resultsChart) _resultsChart.destroy();

    const textClr  = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
    const borderClr= getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
    const cur      = App.state.settings?.currency;

    _resultsChart = new Chart(ctx, {
      type,
      data: { labels, datasets },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{labels:{color:textClr,font:{family:'DM Sans'},boxWidth:12}},
          tooltip:{callbacks:{label:ctx=>` ${ctx.dataset.label}: ${formatCurrency(ctx.raw,cur)}`}}
        },
        scales:{
          x:{grid:{color:borderClr},ticks:{color:textClr,font:{family:'DM Sans'}}},
          y:{grid:{color:borderClr},ticks:{color:textClr,font:{family:'DM Sans'},callback:v=>formatCurrency(v,cur).slice(0,8)}}
        }
      }
    });
  }

  return { injectPage, showTab, calcCompound, calcInstallment, calcInvest };
})();
