/* ====================================================================
   FINANCEPRO — BENCHMARK NACIONAL
   Compara gastos com médias brasileiras por categoria e renda.
   Dados baseados em POF/IBGE. Expõe: window.loadBenchmark
==================================================================== */
(function () {
  'use strict';

  const fmt = v => typeof window.fmtCurrency === 'function'
    ? window.fmtCurrency(v) : 'R$' + Math.abs(v || 0).toFixed(2).replace('.', ',');
  const esc = s => String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Médias nacionais POF/IBGE 2023 — % da renda por faixa salarial
  // [<3SM, 3-5SM, 5-10SM, 10+SM]  SM = salário mínimo (R$1.412)
  const NATIONAL_AVG = {
    'Alimentação':    [28, 22, 18, 14, '🍽️'],
    'Habitação':      [36, 32, 28, 22, '🏠'],
    'Transporte':     [18, 16, 15, 12, '🚗'],
    'Saúde':          [8,  9,  10, 11, '❤️'],
    'Educação':       [3,  5,  7,  9,  '📚'],
    'Lazer':          [4,  7,  9,  11, '🎭'],
    'Vestuário':      [6,  5,  4,  4,  '👔'],
    'Higiene/Beleza': [4,  3,  3,  3,  '🧴'],
    'Comunicação':    [5,  4,  3,  3,  '📱'],
    'Financeiro':     [6,  8,  10, 13, '💰'],
  };

  // Nomes alternativos que mapeiam para categorias IBGE
  const CAT_MAP = {
    'alimentação': 'Alimentação', 'comida': 'Alimentação', 'mercado': 'Alimentação',
    'supermercado': 'Alimentação', 'restaurante': 'Alimentação', 'ifood': 'Alimentação',
    'moradia': 'Habitação', 'aluguel': 'Habitação', 'casa': 'Habitação',
    'condomínio': 'Habitação', 'iptu': 'Habitação',
    'transporte': 'Transporte', 'combustível': 'Transporte', 'uber': 'Transporte',
    'gasolina': 'Transporte', 'estacionamento': 'Transporte', 'ônibus': 'Transporte',
    'saúde': 'Saúde', 'farmácia': 'Saúde', 'médico': 'Saúde', 'plano': 'Saúde',
    'academia': 'Saúde',
    'educação': 'Educação', 'curso': 'Educação', 'escola': 'Educação',
    'faculdade': 'Educação', 'livro': 'Educação',
    'lazer': 'Lazer', 'entretenimento': 'Lazer', 'streaming': 'Lazer',
    'netflix': 'Lazer', 'cinema': 'Lazer', 'viagem': 'Lazer',
    'roupa': 'Vestuário', 'vestuário': 'Vestuário', 'calçado': 'Vestuário',
    'higiene': 'Higiene/Beleza', 'beleza': 'Higiene/Beleza', 'salão': 'Higiene/Beleza',
    'celular': 'Comunicação', 'internet': 'Comunicação', 'telefone': 'Comunicação',
    'tv': 'Comunicação', 'plano cel': 'Comunicação',
  };

  function mapCategory(catName) {
    const n = (catName || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    for (const [key, val] of Object.entries(CAT_MAP)) {
      if (n.includes(key)) return val;
    }
    return null; // não mapeada
  }

  async function loadData() {
    const u = window.S?.user;
    if (!u) return null;
    const uid = u.id;
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    const start = month + '-01';
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const [txs, cats] = await Promise.all([
      window.db.transactions.where('userId').equals(uid)
        .filter(t => t.date >= start && t.date <= end).toArray(),
      window.db.categories.where('userId').equals(uid).toArray(),
    ]);

    const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    // Faixa salarial (SM = R$1.412)
    const sm = 1412;
    const salaries = income / sm;
    const tier = salaries < 3 ? 0 : salaries < 5 ? 1 : salaries < 10 ? 2 : 3;
    const tierLabel = ['Até 3 SM', '3 a 5 SM', '5 a 10 SM', 'Acima de 10 SM'][tier];

    // Agrupa gastos do usuário por categoria IBGE
    const userByIBGE = {};
    txs.filter(t => t.type === 'expense').forEach(t => {
      const cat = cats.find(c => String(c.id) === String(t.categoryId));
      const ibge = mapCategory(cat?.name || '');
      if (ibge) userByIBGE[ibge] = (userByIBGE[ibge] || 0) + t.amount;
    });

    return { income, expenses, tier, tierLabel, userByIBGE, month, uid };
  }

  function render(data) {
    const zone = document.getElementById('page-benchmark');
    if (!zone) return;

    if (!data) {
      zone.innerHTML = `
      <div class="page-hdr">
        <div><h1 class="page-title"><i class="fas fa-chart-bar" style="color:var(--accent)"></i> Benchmark Nacional</h1>
        <p class="page-sub">Compare seus gastos com as médias brasileiras por categoria</p></div>
      </div>
      <div class="card" style="padding:2rem;text-align:center;color:var(--txt2)">
        <i class="fas fa-user-lock" style="font-size:2rem;display:block;margin-bottom:.75rem"></i>
        Faça login para comparar seus dados.
      </div>`;
      return;
    }

    const { income, expenses, tier, tierLabel, userByIBGE, month } = data;
    const baseSM = income || expenses || 3000; // fallback se não tem receita

    // Calcular score geral
    let scoreSum = 0, scoreCount = 0;
    const rows = Object.entries(NATIONAL_AVG).map(([cat, tiers]) => {
      const avgPct = tiers[tier];
      const natAvgAbs = baseSM * avgPct / 100;
      const userAbs = userByIBGE[cat] || 0;
      const userPct = baseSM > 0 ? Math.round(userAbs / baseSM * 100) : 0;
      const icon = tiers[4];
      const diff = userPct - avgPct;
      const hasData = userAbs > 0;

      let status = 'nodata', statusLabel = 'Sem dados', barColor = 'var(--bdr)';
      if (hasData) {
        if (diff <= -5) { status = 'great'; statusLabel = 'Ótimo'; barColor = 'var(--success)'; }
        else if (diff <= 2) { status = 'ok'; statusLabel = 'Na média'; barColor = 'var(--accent)'; }
        else if (diff <= 8) { status = 'warn'; statusLabel = 'Acima'; barColor = 'var(--warning)'; }
        else { status = 'bad'; statusLabel = 'Muito acima'; barColor = 'var(--danger)'; }
        const score = status === 'great' ? 100 : status === 'ok' ? 80 : status === 'warn' ? 50 : 20;
        scoreSum += score; scoreCount++;
      }

      return { cat, icon, avgPct, natAvgAbs, userAbs, userPct, diff, status, statusLabel, barColor, hasData };
    });

    const overallScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0;
    const scoreLabel = overallScore >= 80 ? 'Excelente' : overallScore >= 60 ? 'Bom' : overallScore >= 40 ? 'Regular' : 'Atenção';
    const scoreColor = overallScore >= 80 ? 'var(--success)' : overallScore >= 60 ? 'var(--accent)' : overallScore >= 40 ? 'var(--warning)' : 'var(--danger)';

    const noDataCount = rows.filter(r => !r.hasData).length;

    zone.innerHTML = `
    <div class="page-hdr">
      <div>
        <h1 class="page-title"><i class="fas fa-chart-bar" style="color:var(--accent)"></i> Benchmark Nacional</h1>
        <p class="page-sub">Compare seus gastos com as médias brasileiras por categoria</p>
      </div>
      <div style="display:flex;gap:.5rem;align-items:center">
        <select id="benchTier" class="form-inp" style="width:auto;font-size:.82rem" onchange="FP_BENCHMARK.changeTier(this.value)">
          ${['Até 3 SM','3 a 5 SM','5 a 10 SM','Acima de 10 SM'].map((l,i)=>
            `<option value="${i}" ${i===tier?'selected':''}>${l}</option>`).join('')}
        </select>
        <span style="font-size:.75rem;color:var(--txt2)">Dados: ${month}</span>
      </div>
    </div>

    <!-- Score geral + resumo -->
    <div style="display:grid;grid-template-columns:auto 1fr;gap:1rem;align-items:center;margin-bottom:1rem;background:var(--surf);border:1px solid var(--bdr);border-radius:var(--r);padding:1rem">
      <div style="text-align:center">
        <div style="font-size:2.2rem;font-weight:900;font-family:var(--font-h);color:${scoreColor};line-height:1">${overallScore}</div>
        <div style="font-size:.72rem;font-weight:700;color:${scoreColor}">${scoreLabel}</div>
        <div style="font-size:.7rem;color:var(--txt2)">Score geral</div>
      </div>
      <div>
        <div style="font-size:.82rem;font-weight:600;margin-bottom:.4rem">Faixa: <strong>${tierLabel}</strong></div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap">
          ${income > 0 ? `<span style="font-size:.75rem;color:var(--txt2)">Renda: ${fmt(income)}</span>` : '<span style="font-size:.75rem;color:var(--warning)">⚠ Sem receita registrada — usando gastos como base</span>'}
        </div>
        <div style="font-size:.75rem;color:var(--txt2);margin-top:.25rem">
          ${noDataCount > 0 ? `${noDataCount} categorias sem dados este mês.` : 'Todas as categorias com dados.'}
        </div>
        <div style="font-size:.72rem;color:var(--txt2);margin-top:.2rem">Fonte: POF/IBGE 2023 — médias nacionais por faixa de renda</div>
      </div>
    </div>

    <!-- Tabela de comparação -->
    <div class="card">
      <div class="card-hdr">
        <span class="card-title">Sua posição vs média brasileira — ${tierLabel}</span>
      </div>
      <div style="padding:.5rem">
        ${rows.map(r => `
        <div style="padding:.65rem .5rem;border-bottom:1px solid var(--bdr)">
          <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem;flex-wrap:wrap">
            <span style="font-size:1.1rem">${r.icon}</span>
            <span style="font-size:.85rem;font-weight:600;flex:1">${esc(r.cat)}</span>
            <span style="font-size:.68rem;padding:2px 8px;border-radius:99px;background:${r.hasData?r.barColor+'20':' var(--bg-s)'};color:${r.hasData?r.barColor:'var(--txt2)'};font-weight:700">${r.statusLabel}</span>
            ${r.hasData ? `<span style="font-size:.73rem;color:${r.diff>2?'var(--danger)':r.diff<-2?'var(--success)':'var(--txt2)'}">
              ${r.diff>0?'+':''}${r.diff}pp vs média
            </span>` : ''}
          </div>
          <!-- Barra dupla: nacional vs usuário -->
          <div style="display:flex;gap:.5rem;align-items:center">
            <div style="flex:1">
              <div style="display:flex;justify-content:space-between;font-size:.68rem;color:var(--txt2);margin-bottom:2px">
                <span>Média nacional</span><span>${r.avgPct}% (${fmt(r.natAvgAbs)})</span>
              </div>
              <div style="height:6px;background:var(--bdr);border-radius:3px;overflow:hidden">
                <div style="width:${Math.min(100,r.avgPct*3)}%;height:100%;background:rgba(100,100,100,.4);border-radius:3px"></div>
              </div>
            </div>
            <div style="flex:1">
              <div style="display:flex;justify-content:space-between;font-size:.68rem;color:var(--txt2);margin-bottom:2px">
                <span>Seu gasto</span><span>${r.hasData ? r.userPct+'% ('+fmt(r.userAbs)+')' : '—'}</span>
              </div>
              <div style="height:6px;background:var(--bdr);border-radius:3px;overflow:hidden">
                <div style="width:${Math.min(100,r.userPct*3)}%;height:100%;background:${r.barColor};border-radius:3px;transition:width .5s"></div>
              </div>
            </div>
          </div>
          ${r.hasData && r.diff > 5 ? `<div style="font-size:.73rem;color:var(--warning);margin-top:.25rem">
            ⚠ Você gasta ${fmt(r.userAbs - r.natAvgAbs)} a mais que a média brasileira em ${esc(r.cat)}.
          </div>` : ''}
          ${r.hasData && r.diff < -10 ? `<div style="font-size:.73rem;color:var(--success);margin-top:.25rem">
            ✓ Você gasta ${fmt(r.natAvgAbs - r.userAbs)} a menos que a média em ${esc(r.cat)}!
          </div>` : ''}
        </div>`).join('')}
      </div>
    </div>

    <!-- Dica baseada no score -->
    <div class="card" style="margin-top:.85rem;padding:.85rem 1rem;background:rgba(var(--accent-rgb),.05);border:1px solid rgba(var(--accent-rgb),.2)">
      <div style="font-size:.82rem;font-weight:600;margin-bottom:.3rem">💡 Análise personalizada</div>
      <div style="font-size:.8rem;color:var(--txt2);line-height:1.5">
        ${overallScore >= 80
          ? 'Parabéns! Seus gastos estão bem alinhados com as médias nacionais. Continue monitorando para manter esse nível.'
          : overallScore >= 60
          ? `Seu perfil está próximo da média. ${rows.filter(r=>r.status==='warn'||r.status==='bad').map(r=>r.cat).slice(0,2).join(' e ')} merecem atenção.`
          : `Foque em reduzir: ${rows.filter(r=>r.status==='bad').map(r=>r.cat).slice(0,3).join(', ')}. Um corte de 10% nessas categorias pode economizar ${fmt(rows.filter(r=>r.status==='bad').reduce((s,r)=>s+(r.userAbs*0.1),0))}/mês.`}
      </div>
    </div>`;
  }

  let _data = null;

  const FP_BENCHMARK = {
    async changeTier(tier) {
      if (!_data) return;
      _data.tier = parseInt(tier);
      _data.tierLabel = ['Até 3 SM','3 a 5 SM','5 a 10 SM','Acima de 10 SM'][_data.tier];
      render(_data);
    },
    render: () => render(_data),
  };

  window.FP_BENCHMARK = FP_BENCHMARK;
  window.loadBenchmark = async function () {
    const u = window.S?.user;
    if (!u) { setTimeout(window.loadBenchmark, 500); return; }
    // Show loading skeleton
    const zone = document.getElementById('page-benchmark');
    if (zone) zone.innerHTML = '<div class="page-hdr"><div><h1 class="page-title"><i class="fas fa-chart-bar" style="color:var(--accent)"></i> Benchmark Nacional</h1><p class="page-sub">Compare seus gastos com as médias brasileiras</p></div></div><div style="padding:2rem;text-align:center;color:var(--txt2)"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem"></i><br><br>Carregando dados...</div>';
    _data = await loadData().catch(() => null);
    render(_data);
  };

/* ── Auto-init: render when page becomes active ── */
(function autoInit() {
  const pageId = 'page-benchmark';
  const loadFn = 'loadBenchmark';
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
      if (page === 'benchmark') {
        setTimeout(() => { const fn = window[loadFn]; if (typeof fn === 'function') fn(); }, 150);
      }
      return r;
    };
  }
})();

})();