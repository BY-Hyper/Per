/* ═══════════════════════════════════════════════════════════════════════════
   FinancePro — INTEGRADOR MESTRE v1.0
   ───────────────────────────────────────────────────────────────────────────
   Conecta todos os módulos do sistema:
     ✓ Simulador de Cenários (fp-ai-melhorias-1-5.js)
     ✓ Desafios & Gamificação (fp-extensions.js)
     ✓ Detector de Fraude (fp-ai-melhorias-1-5.js)
     ✓ Educação Financeira (conteúdo embutido)
     ✓ Benchmark Nacional (conteúdo embutido)
     ✓ Backup Automático (fp-ai-melhorias-6-10.js)
     ✓ Planner de Metas (fp-ai-melhorias-6-10.js)
     ✓ Widget de Conquistas no Dashboard
     ✓ Atalhos de teclado globais
     ✓ Notificações proativas de anomalias
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── helpers ─── */
  const $ = id => document.getElementById(id);
  const fmtMoney = v => typeof window.fmtCurrency === 'function'
    ? window.fmtCurrency(v)
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const T = (msg, type = 'info', ms = 3500) => {
    if (typeof window.toast === 'function') window.toast(msg, type, ms);
  };
  const esc = s => String(s || '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function ready() {
    return typeof window.db !== 'undefined' &&
           typeof window.S !== 'undefined' &&
           window.S.user;
  }

  function waitApp(maxMs = 25000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      (function loop() {
        if (ready()) return resolve();
        if (Date.now() - t0 > maxMs) return reject(new Error('FP_INTEGRADOR: timeout'));
        setTimeout(loop, 300);
      })();
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SIMULADOR DE CENÁRIOS — integração com UI
  ═══════════════════════════════════════════════════════════════════════ */
  const FP_SIM = {
    chart: null,

    async runScenario() {
      const reductionPct = parseFloat($('simReductionPct')?.value || 10);
      const increaseIncome = parseFloat($('simIncomeIncrease')?.value || 0);
      const months = parseInt($('simMonths')?.value || 6);

      // Tenta usar o módulo de melhorias
      const mod = window.FP_AI_IMPROVEMENTS_V1 || window.ScenarioSimulator;
      if (mod && mod.simulateScenario) {
        const result = await mod.simulateScenario(reductionPct, increaseIncome, months);
        if (result) { this.renderResult(result); return; }
      }

      // Fallback nativo
      try {
        const uid = window.S.user.id;
        const txs = await window.db.transactions.where('userId').equals(uid).toArray();
        if (!txs.length) { T('Adicione transações para simular cenários', 'warning'); return; }

        const now = new Date();
        const mk = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const cur = mk(now);
        const curTxs = txs.filter(t => mk(new Date(t.date)) === cur);

        const monthlyExp = curTxs.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
        const monthlyInc = curTxs.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);

        const projections = [];
        for (let m = 0; m < months; m++) {
          const exp = monthlyExp * (1 - reductionPct / 100);
          const inc = monthlyInc + increaseIncome;
          const bal = inc - exp;
          const acc = m > 0 ? projections[m-1].accumulated + bal : bal;
          projections.push({ month: m+1, monthlyBalance: bal, monthlyExpense: exp, monthlyIncome: inc, accumulated: acc });
        }
        this.renderResult({ projections, reductionPct, increaseIncome, originalMonthlyExpense: monthlyExp, originalMonthlyIncome: monthlyInc });
      } catch(e) {
        T('Erro ao simular: ' + e.message, 'error');
      }
    },

    renderResult(data) {
      if (!data?.projections?.length) return;
      const { projections, reductionPct, increaseIncome } = data;
      const last = projections[projections.length - 1];

      const summaryEl = $('simSummary');
      if (summaryEl) {
        const isPositive = last.accumulated >= 0;
        summaryEl.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
            <div style="padding:.75rem;background:var(--bg-s);border-radius:8px;text-align:center">
              <div style="font-size:.72rem;color:var(--txt2);margin-bottom:4px">Acumulado em ${projections.length} meses</div>
              <div style="font-size:1.4rem;font-weight:800;color:${isPositive?'var(--success)':'var(--danger)'}">${fmtMoney(last.accumulated)}</div>
            </div>
            <div style="padding:.75rem;background:var(--bg-s);border-radius:8px;text-align:center">
              <div style="font-size:.72rem;color:var(--txt2);margin-bottom:4px">Saldo médio/mês</div>
              <div style="font-size:1.4rem;font-weight:800;color:${isPositive?'var(--success)':'var(--danger)'}">${fmtMoney(last.accumulated/projections.length)}</div>
            </div>
          </div>
          ${reductionPct > 0 ? `<div style="margin-top:.75rem;padding:.6rem;background:rgba(16,185,129,.08);border-radius:8px;font-size:.82rem;color:var(--txt2)">
            <i class="fas fa-scissors" style="color:var(--success)"></i> Economia mensal com redução de <strong>${reductionPct}%</strong> nos gastos: <strong style="color:var(--success)">${fmtMoney(data.originalMonthlyExpense * reductionPct / 100)}</strong>
          </div>` : ''}
          ${increaseIncome > 0 ? `<div style="margin-top:.5rem;padding:.6rem;background:rgba(59,130,246,.08);border-radius:8px;font-size:.82rem;color:var(--txt2)">
            <i class="fas fa-arrow-up" style="color:var(--info)"></i> Renda extra projetada: <strong style="color:var(--info)">${fmtMoney(increaseIncome)}/mês</strong>
          </div>` : ''}
        `;
      }

      // Tabela
      const tbody = $('simTableBody');
      if (tbody) {
        tbody.innerHTML = projections.map(p => `
          <tr>
            <td>Mês ${p.month}</td>
            <td style="color:${p.monthlyBalance>=0?'var(--success)':'var(--danger)'};font-weight:600">${fmtMoney(p.monthlyBalance)}</td>
            <td style="color:${p.accumulated>=0?'var(--success)':'var(--danger)'};font-weight:700">${fmtMoney(p.accumulated)}</td>
            <td style="color:var(--danger)">${fmtMoney(p.monthlyExpense)}</td>
            <td style="color:var(--success)">${fmtMoney(p.monthlyIncome)}</td>
          </tr>
        `).join('');
      }

      // Gráfico
      const canvas = $('simChart');
      if (canvas && typeof Chart !== 'undefined') {
        if (this.chart) this.chart.destroy();
        this.chart = new Chart(canvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: projections.map(p => `Mês ${p.month}`),
            datasets: [
              {
                label: 'Saldo Mensal',
                data: projections.map(p => p.monthlyBalance),
                backgroundColor: projections.map(p => p.monthlyBalance >= 0 ? 'rgba(16,185,129,.6)' : 'rgba(239,68,68,.6)'),
                borderRadius: 6,
              },
              {
                label: 'Acumulado',
                data: projections.map(p => p.accumulated),
                type: 'line',
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59,130,246,.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
              }
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
              y: { ticks: { callback: v => fmtMoney(v) } }
            }
          }
        });
      }
    }
  };
  window.FP_SIM = FP_SIM;

  /* ═══════════════════════════════════════════════════════════════════════
     GAMIFICAÇÃO — integração com UI da página de Desafios
  ═══════════════════════════════════════════════════════════════════════ */
  const FP_GAMIFICATION = {
    async loadStats() {
      const ext = window.FP_EXT;
      if (!ext) return;
      try {
        const stats = await ext.gamification?.getStats?.() || {};
        if ($('gamePoints')) $('gamePoints').textContent = (stats.points || 0).toLocaleString('pt-BR');
        if ($('gameStreak')) $('gameStreak').textContent = stats.streak || 0;
        if ($('gameAchievements')) $('gameAchievements').textContent = (stats.achievements || []).length;
        if ($('gameChallengesDone')) $('gameChallengesDone').textContent = stats.completedChallenges || 0;

        // Conquistas
        const achList = $('achievementsList');
        if (achList) {
          const achs = stats.achievements || [];
          achList.innerHTML = achs.length ? achs.map(a => `
            <div style="display:flex;align-items:center;gap:.75rem;padding:.6rem;background:var(--bg-s);border-radius:8px;border:1px solid var(--bdr)">
              <div style="font-size:1.5rem">${a.icon || '🏆'}</div>
              <div>
                <div style="font-size:.85rem;font-weight:600">${esc(a.name || a.title || '')}</div>
                <div style="font-size:.72rem;color:var(--txt2)">${esc(a.description || '')}</div>
              </div>
            </div>
          `).join('') : `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon"><i class="fas fa-medal"></i></div><p class="empty-text">Complete desafios para desbloquear conquistas!</p></div>`;
        }
      } catch(e) { console.warn('[FP_GAMIFICATION]', e); }
    },

    async generateChallenges() {
      const ext = window.FP_EXT;
      if (!ext?.gamification?.generateChallenges) {
        this.renderBuiltinChallenges();
        return;
      }
      try {
        const challenges = await ext.gamification.generateChallenges();
        this.renderChallenges(challenges || []);
      } catch(e) { this.renderBuiltinChallenges(); }
    },

    async renderBuiltinChallenges() {
      if (!ready()) return;
      try {
        const uid = window.S.user.id;
        const txs = await window.db.transactions.where('userId').equals(uid).toArray();
        const now = new Date();
        const mk = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const cur = mk(now);
        const curTxs = txs.filter(t => mk(new Date(t.date)) === cur && t.type === 'expense');
        const totalExp = curTxs.reduce((s,t) => s+t.amount, 0);

        const challenges = [
          { id:'c1', icon:'✂️', title:'Corte 10% dos gastos', description:`Reduza suas despesas de ${fmtMoney(totalExp)} para ${fmtMoney(totalExp*0.9)} este mês`, points:100, difficulty:'Fácil', progress:50 },
          { id:'c2', icon:'📅', title:'7 dias sem gastos desnecessários', description:'Não registre despesas em categorias de lazer por 7 dias consecutivos', points:200, difficulty:'Médio', progress:0 },
          { id:'c3', icon:'💰', title:'Poupança de emergência', description:'Guarde pelo menos R$ 500 para sua reserva de emergência', points:300, difficulty:'Médio', progress:20 },
          { id:'c4', icon:'📱', title:'Revise suas assinaturas', description:'Cancele pelo menos 1 assinatura não utilizada este mês', points:150, difficulty:'Fácil', progress:0 },
          { id:'c5', icon:'🏦', title:'Zere o cartão de crédito', description:'Pague a fatura completa do cartão de crédito este mês', points:250, difficulty:'Difícil', progress:0 },
        ];
        this.renderChallenges(challenges);
      } catch(e) { console.warn('[FP_GAMIFICATION]', e); }
    },

    renderChallenges(challenges) {
      const list = $('activeChallengesList');
      if (!list) return;
      if (!challenges.length) {
        list.innerHTML = `<div class="empty-state"><p class="empty-text">Nenhum desafio disponível no momento.</p></div>`;
        return;
      }
      const diffColor = { 'Fácil':'var(--success)', 'Médio':'var(--warning)', 'Difícil':'var(--danger)' };
      list.innerHTML = challenges.map(c => `
        <div style="padding:.9rem 0;border-bottom:1px solid var(--bdr);display:flex;align-items:flex-start;gap:.9rem">
          <div style="font-size:1.75rem;width:42px;text-align:center;flex-shrink:0">${c.icon || '🎯'}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
              <strong style="font-size:.9rem">${esc(c.title)}</strong>
              <div style="display:flex;align-items:center;gap:.4rem">
                <span style="font-size:.7rem;padding:2px 8px;border-radius:99px;background:${diffColor[c.difficulty]||'var(--info)'};color:#fff;font-weight:600">${esc(c.difficulty||'')}</span>
                <span style="font-size:.7rem;padding:2px 7px;border-radius:99px;background:rgba(245,158,11,.12);color:#92400E;font-weight:600">+${c.points||0} pts</span>
              </div>
            </div>
            <p style="font-size:.8rem;color:var(--txt2);margin:.3rem 0 .6rem">${esc(c.description||'')}</p>
            <div class="progress"><div class="progress-fill ${(c.progress||0)>=100?'pf-success':(c.progress||0)>=60?'pf-warning':'pf-success'}" style="width:${Math.min(100,c.progress||0)}%"></div></div>
            <div style="font-size:.72rem;color:var(--txt2);margin-top:3px">${c.progress||0}% concluído</div>
          </div>
        </div>
      `).join('');
    }
  };
  window.FP_GAMIFICATION = FP_GAMIFICATION;

  /* ═══════════════════════════════════════════════════════════════════════
     DETECTOR DE FRAUDE — integração com UI
  ═══════════════════════════════════════════════════════════════════════ */
  const FP_FRAUD = {
    async runFullScan() {
      if (!ready()) return;
      T('Analisando transações...', 'info', 2000);

      const lastScanEl = $('anomalyLastScan');
      if (lastScanEl) lastScanEl.textContent = 'Verificando...';

      try {
        const uid = window.S.user.id;
        const txs = await window.db.transactions
          .where('userId').equals(uid)
          .reverse().limit(500).toArray();

        const anomalies = [];

        // Cálculo de estatísticas por categoria
        const catStats = {};
        for (const tx of txs) {
          if (tx.type !== 'expense') continue;
          if (!catStats[tx.categoryId]) catStats[tx.categoryId] = [];
          catStats[tx.categoryId].push(tx.amount);
        }

        const stats = {};
        for (const [catId, amounts] of Object.entries(catStats)) {
          const mean = amounts.reduce((s,v) => s+v, 0) / amounts.length;
          const variance = amounts.reduce((s,v) => s + Math.pow(v-mean, 2), 0) / amounts.length;
          stats[catId] = { mean, stdDev: Math.sqrt(variance) };
        }

        // Analisa cada transação
        for (const tx of txs.slice(0, 200)) {
          if (tx.type !== 'expense') continue;
          const s = stats[tx.categoryId];
          if (!s) continue;

          // Outlier: > 2.5 desvios padrão
          if (s.stdDev > 0 && tx.amount > s.mean + 2.5 * s.stdDev) {
            anomalies.push({
              tx,
              type: 'outlier',
              severity: 'alta',
              msg: `Valor ${(tx.amount / s.mean).toFixed(1)}x acima da média desta categoria`,
              icon: '⚠️'
            });
          }

          // Duplicata potencial
          const similar = txs.filter(other =>
            other.id !== tx.id &&
            other.amount === tx.amount &&
            other.categoryId === tx.categoryId &&
            Math.abs(new Date(other.date) - new Date(tx.date)) < 86400000
          );
          if (similar.length > 0 && !anomalies.find(a => a.tx.id === similar[0].id && a.type === 'duplicate')) {
            anomalies.push({
              tx,
              type: 'duplicate',
              severity: 'media',
              msg: `Possível transação duplicada: mesmo valor (${fmtMoney(tx.amount)}) e categoria no mesmo dia`,
              icon: '🔁'
            });
          }
        }

        // Valores muito redondos em sequência (suspeito)
        const roundAmounts = txs.filter(tx => tx.type === 'expense' && tx.amount % 100 === 0 && tx.amount >= 500);
        if (roundAmounts.length >= 3) {
          anomalies.push({
            tx: roundAmounts[0],
            type: 'pattern',
            severity: 'baixa',
            msg: `${roundAmounts.length} transações com valores exatamente redondos (≥ R$500) — verifique se são corretas`,
            icon: '🔍'
          });
        }

        // Atualiza stats
        const high = anomalies.filter(a => a.severity === 'alta').length;
        const mid = anomalies.filter(a => a.severity === 'media').length;
        const low = anomalies.filter(a => a.severity === 'baixa').length;
        if ($('anomalyHigh')) $('anomalyHigh').textContent = high;
        if ($('anomalyMid')) $('anomalyMid').textContent = mid;
        if ($('anomalyLow')) $('anomalyLow').textContent = low;
        if ($('anomalyTotal')) $('anomalyTotal').textContent = txs.length;
        if (lastScanEl) lastScanEl.textContent = `Última verificação: ${new Date().toLocaleTimeString('pt-BR')}`;

        this.renderAnomalies(anomalies);

        if (high > 0) T(`⚠️ ${high} anomalia(s) de alta severidade detectada(s)!`, 'warning', 5000);
        else T(`✅ Análise concluída: ${anomalies.length} alerta(s) encontrado(s)`, 'success');

      } catch(e) {
        T('Erro ao analisar: ' + e.message, 'error');
        console.error('[FP_FRAUD]', e);
      }
    },

    renderAnomalies(anomalies) {
      const list = $('anomalyList');
      if (!list) return;
      if (!anomalies.length) {
        list.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class="fas fa-shield-alt"></i></div><p class="empty-title">Tudo em dia!</p><p class="empty-text">Nenhuma anomalia encontrada nas suas transações.</p></div>`;
        return;
      }
      const sevColor = { alta: 'var(--danger)', media: 'var(--warning)', baixa: 'var(--info)' };
      const sevLabel = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
      list.innerHTML = anomalies.map(a => `
        <div style="display:flex;align-items:flex-start;gap:.75rem;padding:.85rem 0;border-bottom:1px solid var(--bdr)">
          <div style="font-size:1.5rem">${a.icon}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.3rem">
              <span style="font-size:.7rem;padding:2px 8px;border-radius:99px;background:${sevColor[a.severity]};color:#fff;font-weight:600">Severidade: ${sevLabel[a.severity]}</span>
              <span style="font-size:.78rem;color:var(--txt2)">${a.tx?.description ? esc(a.tx.description) : '—'}</span>
            </div>
            <p style="font-size:.82rem;color:var(--txt)">${esc(a.msg)}</p>
            ${a.tx?.amount ? `<p style="font-size:.75rem;color:var(--txt2);margin-top:2px">${fmtMoney(a.tx.amount)} · ${a.tx.date || '—'}</p>` : ''}
          </div>
        </div>
      `).join('');
    }
  };
  window.FP_FRAUD = FP_FRAUD;

  /* ═══════════════════════════════════════════════════════════════════════
     EDUCAÇÃO FINANCEIRA — conteúdo embutido offline
  ═══════════════════════════════════════════════════════════════════════ */
  const EDU_CONTENT = [
    {
      id: 'budget-101', icon: '📋', title: 'Como criar um orçamento inteligente',
      category: 'beginner', duration: '5 min', color: '#10b981',
      summary: 'Aprenda a organizar suas finanças com o método 50/30/20.',
      body: `
        <h2 style="margin-bottom:1rem">Orçamento Inteligente: Regra 50/30/20</h2>
        <p>Um orçamento é a base de uma vida financeira saudável. A regra <strong>50/30/20</strong> é uma das mais simples e eficazes:</p>
        <ul style="margin:1rem 0;padding-left:1.5rem;line-height:2">
          <li><strong>50%</strong> da renda para <strong>necessidades</strong> (moradia, alimentação, transporte)</li>
          <li><strong>30%</strong> para <strong>desejos</strong> (lazer, entretenimento, compras pessoais)</li>
          <li><strong>20%</strong> para <strong>poupança e dívidas</strong></li>
        </ul>
        <h3 style="margin:1rem 0 .5rem">Como aplicar no FinancePro:</h3>
        <ol style="padding-left:1.5rem;line-height:2">
          <li>Vá em <strong>Categorias</strong> e organize cada uma como Necessidade, Desejo ou Poupança</li>
          <li>Em <strong>Orçamentos</strong>, defina limites para cada categoria</li>
          <li>Em <strong>Relatórios</strong>, veja sua análise 50/30/20 automaticamente</li>
          <li>O sistema te alertará quando você estiver próximo do limite!</li>
        </ol>
        <div style="margin-top:1.25rem;padding:1rem;background:rgba(16,185,129,.08);border-radius:8px">
          <strong>💡 Dica:</strong> Se você tem dívidas, priorize-as antes dos desejos. Pague o mínimo de necessidades e direcione o máximo para quitar dívidas.
        </div>
      `
    },
    {
      id: 'emergency-fund', icon: '🏦', title: 'Reserva de Emergência: Por que é essencial',
      category: 'beginner', duration: '4 min', color: '#3b82f6',
      summary: 'Entenda como e por que construir sua reserva de emergência.',
      body: `
        <h2 style="margin-bottom:1rem">Reserva de Emergência</h2>
        <p>A reserva de emergência é o seu <strong>"colchão financeiro"</strong> — dinheiro guardado para imprevistos como desemprego, problemas de saúde ou reparos urgentes.</p>
        <h3 style="margin:1rem 0 .5rem">Quanto guardar?</h3>
        <ul style="padding-left:1.5rem;line-height:2">
          <li><strong>Empregado com renda estável:</strong> 3 a 6 meses de despesas</li>
          <li><strong>Autônomo ou freelancer:</strong> 6 a 12 meses de despesas</li>
          <li><strong>Família com dependentes:</strong> 6 a 9 meses de despesas</li>
        </ul>
        <h3 style="margin:1rem 0 .5rem">Onde guardar?</h3>
        <p>Priorize liquidez imediata e segurança:</p>
        <ul style="padding-left:1.5rem;line-height:2">
          <li>✅ Tesouro Selic (liquidez D+1)</li>
          <li>✅ CDB com liquidez diária</li>
          <li>✅ Conta remunerada (Nubank, Inter, C6)</li>
          <li>❌ Poupança (rendimento abaixo da inflação)</li>
        </ul>
        <div style="margin-top:1rem;padding:1rem;background:rgba(59,130,246,.08);border-radius:8px">
          <strong>💡 No FinancePro:</strong> Crie uma meta chamada "Reserva de Emergência" e defina o valor alvo como 6x suas despesas mensais.
        </div>
      `
    },
    {
      id: 'compound-interest', icon: '📈', title: 'Juros Compostos: O 8º Maravilha do Mundo',
      category: 'intermediate', duration: '6 min', color: '#8b5cf6',
      summary: 'Como os juros compostos podem trabalhar a seu favor (ou contra).',
      body: `
        <h2 style="margin-bottom:1rem">Juros Compostos</h2>
        <p>Albert Einstein teria chamado os juros compostos de <em>"a oitava maravilha do mundo"</em>. A ideia é simples: juros sobre juros.</p>
        <h3 style="margin:1rem 0 .5rem">Fórmula:</h3>
        <div style="padding:1rem;background:var(--bg-s);border-radius:8px;font-family:monospace;margin-bottom:1rem">
          M = C × (1 + i)ⁿ<br/>
          <span style="font-size:.8rem;color:var(--txt2)">M = montante final | C = capital inicial | i = taxa | n = períodos</span>
        </div>
        <h3 style="margin:1rem 0 .5rem">Exemplo prático:</h3>
        <p>R$ 1.000 a 1% ao mês por 10 anos:</p>
        <ul style="padding-left:1.5rem;line-height:2">
          <li>Juros simples: R$ 2.200 (+ R$ 1.200)</li>
          <li><strong>Juros compostos: R$ 3.300 (+ R$ 2.300)</strong></li>
        </ul>
        <div style="margin-top:1rem;padding:1rem;background:rgba(239,68,68,.08);border-radius:8px">
          <strong>⚠️ Atenção:</strong> Os juros compostos também trabalham contra você em dívidas. Um cartão de crédito a 12% ao mês pode triplicar uma dívida em menos de 1 ano!
        </div>
        <div style="margin-top:.75rem;padding:1rem;background:rgba(139,92,246,.08);border-radius:8px">
          <strong>💡 No FinancePro:</strong> Use a Calculadora Financeira para simular cenários de investimento e pagamento de dívidas.
        </div>
      `
    },
    {
      id: 'investment-basics', icon: '💎', title: 'Investimentos: Por onde começar',
      category: 'intermediate', duration: '8 min', color: '#f59e0b',
      summary: 'Guia prático para dar os primeiros passos nos investimentos.',
      body: `
        <h2 style="margin-bottom:1rem">Primeiros Passos nos Investimentos</h2>
        <p>Antes de investir, você precisa de:</p>
        <ul style="padding-left:1.5rem;line-height:2;margin-bottom:1rem">
          <li>✅ Dívidas de juros altos quitadas</li>
          <li>✅ Reserva de emergência formada</li>
          <li>✅ Orçamento equilibrado (gastar menos do que ganha)</li>
        </ul>
        <h3 style="margin:.75rem 0 .5rem">Pirâmide dos Investimentos:</h3>
        <div style="display:grid;gap:.5rem;margin-bottom:1rem">
          <div style="padding:.6rem;background:rgba(16,185,129,.1);border-radius:8px;border-left:3px solid #10b981"><strong>Base:</strong> Renda Fixa (Tesouro, CDB, LCI/LCA) — segurança e liquidez</div>
          <div style="padding:.6rem;background:rgba(59,130,246,.1);border-radius:8px;border-left:3px solid #3b82f6"><strong>Meio:</strong> Fundos de Investimento, ETFs — diversificação</div>
          <div style="padding:.6rem;background:rgba(245,158,11,.1);border-radius:8px;border-left:3px solid #f59e0b"><strong>Topo:</strong> Ações, FIIs — maior risco, maior retorno potencial</div>
          <div style="padding:.6rem;background:rgba(239,68,68,.1);border-radius:8px;border-left:3px solid #ef4444"><strong>Avançado:</strong> Derivativos, Crypto — altíssimo risco, apenas com conhecimento</div>
        </div>
        <div style="padding:1rem;background:rgba(245,158,11,.08);border-radius:8px">
          <strong>💡 Regra de ouro:</strong> Diversifique. Nunca coloque tudo em um único investimento. Comece pelo Tesouro Selic e evolua gradualmente.
        </div>
      `
    },
    {
      id: 'debt-snowball', icon: '⛄', title: 'Método Snowball: Elimine dívidas mais rápido',
      category: 'intermediate', duration: '5 min', color: '#06b6d4',
      summary: 'Estratégia psicológica para acelerar o pagamento de dívidas.',
      body: `
        <h2 style="margin-bottom:1rem">Método Snowball (Bola de Neve)</h2>
        <p>Criado pelo autor Dave Ramsey, o método Snowball foca na <strong>motivação psicológica</strong> para eliminar dívidas:</p>
        <h3 style="margin:1rem 0 .5rem">Como funciona:</h3>
        <ol style="padding-left:1.5rem;line-height:2.2">
          <li>Liste todas as dívidas do <strong>menor para o maior valor</strong></li>
          <li>Pague o <strong>mínimo</strong> de todas as dívidas</li>
          <li>Coloque todo o dinheiro extra na <strong>menor dívida</strong></li>
          <li>Quando a menor for paga, direcione esse valor para a próxima</li>
          <li>A "bola de neve" cresce a cada dívida quitada!</li>
        </ol>
        <div style="margin-top:1rem;padding:1rem;background:rgba(6,182,212,.08);border-radius:8px">
          <strong>💡 Alternativa — Avalanche:</strong> Se preferir economizar mais em juros, use o método Avalanche: quite primeiro as dívidas com <strong>maior taxa de juros</strong>, independente do valor.
        </div>
        <div style="margin-top:.75rem;padding:1rem;background:rgba(16,185,129,.08);border-radius:8px">
          <strong>No FinancePro:</strong> Use a página <strong>Dívidas</strong> para rastrear cada dívida e calcular o progresso de pagamento.
        </div>
      `
    },
    {
      id: 'financial-psychology', icon: '🧠', title: 'Psicologia do Dinheiro: Vieses que sabotam suas finanças',
      category: 'advanced', duration: '7 min', color: '#ec4899',
      summary: 'Entenda como nosso cérebro toma decisões financeiras ruins.',
      body: `
        <h2 style="margin-bottom:1rem">Psicologia do Dinheiro</h2>
        <p>Nosso cérebro não foi evolutivamente preparado para finanças modernas. Conheça os principais vieses:</p>
        <div style="display:grid;gap:.75rem;margin-top:1rem">
          <div style="padding:.85rem;border:1px solid var(--bdr);border-radius:8px">
            <strong style="color:#ec4899">🤑 Desconto Hiperbólico</strong>
            <p style="font-size:.83rem;color:var(--txt2);margin-top:.25rem">Preferimos R$ 100 hoje a R$ 150 amanhã. Isso nos faz gastar impulsivamente.</p>
            <p style="font-size:.8rem;margin-top:.25rem"><strong>Solução:</strong> Automação de poupança — guardar antes de ter acesso.</p>
          </div>
          <div style="padding:.85rem;border:1px solid var(--bdr);border-radius:8px">
            <strong style="color:#f59e0b">😰 Aversão à Perda</strong>
            <p style="font-size:.83rem;color:var(--txt2);margin-top:.25rem">A dor de perder R$ 100 é 2x maior que o prazer de ganhar R$ 100. Isso causa paralisia em investimentos.</p>
            <p style="font-size:.8rem;margin-top:.25rem"><strong>Solução:</strong> Foque no longo prazo e ignore flutuações diárias.</p>
          </div>
          <div style="padding:.85rem;border:1px solid var(--bdr);border-radius:8px">
            <strong style="color:#3b82f6">💭 Efeito de Ancoragem</strong>
            <p style="font-size:.83rem;color:var(--txt2);margin-top:.25rem">O primeiro preço que vemos "ancora" nossa percepção de valor. Promoções exploram isso.</p>
            <p style="font-size:.8rem;margin-top:.25rem"><strong>Solução:</strong> Pesquise preços antes de comprar e ignore o preço "original".</p>
          </div>
          <div style="padding:.85rem;border:1px solid var(--bdr);border-radius:8px">
            <strong style="color:#10b981">🛒 Contabilidade Mental</strong>
            <p style="font-size:.83rem;color:var(--txt2);margin-top:.25rem">Tratamos dinheiro de formas diferentes dependendo da origem (salário vs. bônus vs. prêmio).</p>
            <p style="font-size:.8rem;margin-top:.25rem"><strong>Solução:</strong> Todo dinheiro tem o mesmo valor. Trate bônus como salário.</p>
          </div>
        </div>
      `
    },
  ];

  window.filterEduContent = function(category, btn) {
    document.querySelectorAll('#eduTabs .auth-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderEduGrid(category);
  };

  function renderEduGrid(category = 'all') {
    const grid = $('educationGrid');
    if (!grid) return;
    const items = category === 'all' ? EDU_CONTENT : EDU_CONTENT.filter(c => c.category === category);
    if (!items.length) { grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p class="empty-text">Nenhum conteúdo nesta categoria.</p></div>`; return; }
    const catLabel = { beginner: 'Iniciante', intermediate: 'Intermediário', advanced: 'Avançado' };
    const catColor = { beginner: 'var(--success)', intermediate: 'var(--warning)', advanced: 'var(--danger)' };
    grid.innerHTML = items.map(item => `
      <div class="card" style="cursor:pointer;transition:transform .15s,box-shadow .15s" onclick="openEduArticle('${item.id}')"
           onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='var(--shadow-md)'"
           onmouseleave="this.style.transform='';this.style.boxShadow=''">
        <div style="height:5px;background:${item.color};border-radius:var(--r-md) var(--r-md) 0 0"></div>
        <div class="card-body">
          <div style="display:flex;align-items:flex-start;gap:.75rem;margin-bottom:.75rem">
            <div style="font-size:2rem;width:44px;text-align:center">${item.icon}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.25rem;flex-wrap:wrap">
                <span style="font-size:.68rem;padding:1px 7px;border-radius:99px;background:${catColor[item.category]};color:#fff;font-weight:600">${catLabel[item.category]||''}</span>
                <span style="font-size:.68rem;color:var(--txt2)"><i class="fas fa-clock"></i> ${item.duration}</span>
              </div>
              <h3 style="font-size:.9rem;font-weight:700;line-height:1.3">${esc(item.title)}</h3>
            </div>
          </div>
          <p style="font-size:.8rem;color:var(--txt2);margin-bottom:.75rem">${esc(item.summary)}</p>
          <button class="btn btn-outline btn-sm btn-full"><i class="fas fa-book-open"></i> Ler artigo</button>
        </div>
      </div>
    `).join('');
  }

  window.openEduArticle = function(id) {
    const item = EDU_CONTENT.find(c => c.id === id);
    if (!item) return;
    const titleEl = $('eduArticleTitle');
    const bodyEl = $('eduArticleBody');
    const modal = $('eduArticleModal');
    if (titleEl) titleEl.textContent = item.icon + ' ' + item.title;
    if (bodyEl) bodyEl.innerHTML = item.body;
    if (modal) modal.classList.remove('hidden');
  };

  /* ═══════════════════════════════════════════════════════════════════════
     BENCHMARK NACIONAL
  ═══════════════════════════════════════════════════════════════════════ */
  const NATIONAL_BENCHMARKS = {
    'Alimentação':       { avg: 820,  p25: 480,  p75: 1100, icon: '🛒' },
    'Moradia':           { avg: 1650, p25: 900,  p75: 2800, icon: '🏠' },
    'Transporte':        { avg: 420,  p25: 150,  p75: 700,  icon: '🚗' },
    'Saúde':             { avg: 380,  p25: 100,  p75: 600,  icon: '❤️' },
    'Educação':          { avg: 310,  p25: 0,    p75: 500,  icon: '📚' },
    'Lazer':             { avg: 280,  p25: 80,   p75: 500,  icon: '🎭' },
    'Vestuário':         { avg: 190,  p25: 50,   p75: 320,  icon: '👕' },
    'Tecnologia':        { avg: 160,  p25: 50,   p75: 300,  icon: '💻' },
    'Beleza e Cuidados': { avg: 150,  p25: 40,   p75: 280,  icon: '💅' },
    'Pets':              { avg: 120,  p25: 0,    p75: 250,  icon: '🐾' },
  };

  const FP_BENCHMARK = {
    async render() {
      if (!ready()) return;
      try {
        const uid = window.S.user.id;
        const cats = await window.db.categories.where('userId').equals(uid).toArray();
        const txs = await window.db.transactions.where('userId').equals(uid).toArray();

        const now = new Date();
        const mk = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const cur = mk(now);
        const curExp = txs.filter(t => mk(new Date(t.date)) === cur && t.type === 'expense');
        const curInc = txs.filter(t => mk(new Date(t.date)) === cur && t.type === 'income');

        const spendByCat = {};
        for (const tx of curExp) {
          const cat = cats.find(c => c.id === tx.categoryId);
          const name = cat?.name || 'Outros';
          spendByCat[name] = (spendByCat[name] || 0) + tx.amount;
        }

        const grid = $('benchmarkGrid');
        if (!grid) return;

        const items = Object.entries(NATIONAL_BENCHMARKS).map(([name, bench]) => {
          const userSpend = spendByCat[name] || 0;
          const ratio = bench.avg > 0 ? userSpend / bench.avg : 0;
          const isAbove = userSpend > bench.avg;
          const isLow = userSpend <= bench.p25;
          const barPct = Math.min(100, (userSpend / (bench.p75 * 1.5)) * 100);
          return { name, bench, userSpend, ratio, isAbove, isLow, barPct };
        });

        grid.innerHTML = items.map(item => `
          <div class="card card-body">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem">
              <span style="font-size:.95rem;font-weight:600">${item.bench.icon} ${esc(item.name)}</span>
              <span style="font-size:.7rem;padding:2px 8px;border-radius:99px;background:${item.isLow?'rgba(16,185,129,.12)':item.isAbove?'rgba(239,68,68,.12)':'rgba(245,158,11,.12)'};color:${item.isLow?'var(--success)':item.isAbove?'var(--danger)':'var(--warning)'};font-weight:700">
                ${item.isLow ? '✅ Abaixo' : item.isAbove ? '⚠️ Acima' : '✔️ Na média'}
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:.8rem;color:var(--txt2);margin-bottom:.5rem">
              <span>Você: <strong style="color:${item.isAbove?'var(--danger)':'var(--txt)'}">${fmtMoney(item.userSpend)}</strong></span>
              <span>Média BR: <strong>${fmtMoney(item.bench.avg)}</strong></span>
            </div>
            <div class="progress" style="height:8px;margin-bottom:.4rem">
              <div class="progress-fill" style="width:${item.barPct}%;background:${item.isLow?'var(--success)':item.isAbove?'var(--danger)':'var(--warning)'}"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:.68rem;color:var(--txt3)">
              <span>P25: ${fmtMoney(item.bench.p25)}</span>
              <span>P75: ${fmtMoney(item.bench.p75)}</span>
            </div>
          </div>
        `).join('');

        // Taxa de poupança
        const totalInc = curInc.reduce((s,t) => s+t.amount, 0);
        const totalExp2 = curExp.reduce((s,t) => s+t.amount, 0);
        const savingsRate = totalInc > 0 ? ((totalInc - totalExp2) / totalInc) * 100 : 0;
        const srEl = $('savingsRateBenchmark');
        if (srEl) {
          const srColor = savingsRate >= 20 ? 'var(--success)' : savingsRate >= 10 ? 'var(--warning)' : 'var(--danger)';
          srEl.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem">
              <div>
                <div style="font-size:2.5rem;font-weight:800;color:${srColor}">${savingsRate.toFixed(1)}%</div>
                <div style="font-size:.82rem;color:var(--txt2)">Taxa de poupança atual</div>
              </div>
              <div style="display:flex;gap:.5rem;flex-direction:column;font-size:.82rem">
                <div style="color:var(--danger)"><i class="fas fa-times-circle"></i> Abaixo de 10%: preocupante</div>
                <div style="color:var(--warning)"><i class="fas fa-exclamation-circle"></i> 10–20%: razoável</div>
                <div style="color:var(--success)"><i class="fas fa-check-circle"></i> Acima de 20%: recomendado</div>
              </div>
            </div>
            <div class="progress" style="margin-top:1rem;height:10px">
              <div class="progress-fill" style="width:${Math.min(100,savingsRate/30*100)}%;background:${srColor}"></div>
            </div>
          `;
        }
      } catch(e) { console.error('[FP_BENCHMARK]', e); }
    }
  };
  window.FP_BENCHMARK = FP_BENCHMARK;

  /* ═══════════════════════════════════════════════════════════════════════
     WIDGET DE CONQUISTAS NO DASHBOARD
  ═══════════════════════════════════════════════════════════════════════ */
  function injectDashboardWidgets() {
    // Mini-widget de desafios no dashboard
    const parent = $('dashSuggestionsCard')?.parentElement;
    if (!parent || $('dashChallengesWidget')) return;

    const widget = document.createElement('div');
    widget.id = 'dashChallengesWidget';
    widget.className = 'card';
    widget.style.cssText = 'margin-top:1rem';
    widget.innerHTML = `
      <div class="card-hdr">
        <span class="card-title"><i class="fas fa-trophy" style="color:#f59e0b"></i> Desafios Ativos</span>
        <button class="btn btn-ghost btn-sm" onclick="if(typeof navigate==='function')navigate('challenges')">Ver todos</button>
      </div>
      <div id="dashChallengesPreview" style="padding:.5rem 1rem 1rem">
        <div style="font-size:.82rem;color:var(--txt2)">Carregando desafios...</div>
      </div>
    `;
    parent.appendChild(widget);

    setTimeout(async () => {
      if (!ready()) return;
      const preview = $('dashChallengesPreview');
      if (!preview) return;
      preview.innerHTML = `
        <div style="display:flex;align-items:center;gap:.75rem;padding:.5rem 0;cursor:pointer" onclick="if(typeof navigate==='function')navigate('challenges')">
          <span style="font-size:1.4rem">🏆</span>
          <div>
            <div style="font-size:.85rem;font-weight:600">Desafios & Conquistas disponíveis!</div>
            <div style="font-size:.75rem;color:var(--txt2)">Clique para ver desafios personalizados pela IA</div>
          </div>
          <i class="fas fa-chevron-right" style="margin-left:auto;color:var(--txt3)"></i>
        </div>
      `;
    }, 1500);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ATALHOS DE TECLADO GLOBAIS
  ═══════════════════════════════════════════════════════════════════════ */
  function registerKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      // Não interferir com inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+Shift+S = Simulador
      if (ctrl && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        if (typeof navigate === 'function') navigate('simulator');
        return;
      }

      // Ctrl+Shift+D = Dashboard
      if (ctrl && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        if (typeof navigate === 'function') navigate('dashboard');
        return;
      }

      // Ctrl+Shift+F = Fraude
      if (ctrl && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        if (typeof navigate === 'function') navigate('anomalies');
        return;
      }

      // Ctrl+Shift+E = Educação
      if (ctrl && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        if (typeof navigate === 'function') navigate('education');
        return;
      }

      // Ctrl+Shift+B = Benchmark
      if (ctrl && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        if (typeof navigate === 'function') navigate('benchmark');
        return;
      }
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     HOOK: interceptar navigate() para inicializar páginas sob demanda
  ═══════════════════════════════════════════════════════════════════════ */
  function hookNavigate() {
    const origNavigate = window.navigate;
    if (window.__igNavHooked) return;
    window.__igNavHooked=true;
    if (typeof origNavigate !== 'function') return;

    window.navigate = function(page, ...args) {
      origNavigate(page, ...args);

      // Inicialização sob demanda
      setTimeout(() => {
        switch (page) {
          case 'simulator':
            // Nenhuma inicialização necessária — UI é reactiva
            break;
          case 'challenges':
            if (typeof window.loadChallenges === 'function') window.loadChallenges();
            else setTimeout(() => window.loadChallenges?.(), 800);
            break;
          case 'anomalies':
            if (typeof window.loadAnomalies === 'function') window.loadAnomalies();
            else setTimeout(() => window.loadAnomalies?.(), 800);
            break;
          case 'education':
            if (typeof window.loadEducation === 'function') window.loadEducation();
            else setTimeout(() => window.loadEducation?.(), 800);
            break;
          case 'benchmark':
            if (typeof window.loadBenchmark === 'function') window.loadBenchmark();
            else setTimeout(() => window.loadBenchmark?.(), 800);
            break;
        }
      }, 150);
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     BACKUP AUTOMÁTICO — wira com fp-ai-melhorias-6-10.js
  ═══════════════════════════════════════════════════════════════════════ */
  function startAutoBackup() {
    const mod = window.FP_AI_IMPROVEMENTS_V2 || window.AutoBackup;
    if (mod?.startAutoBackup) {
      mod.startAutoBackup();
      console.log('[FP_INTEGRADOR] Backup automático iniciado');
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     BADGE NOTIFICAÇÕES — atualiza quando usuário salva transação
  ═══════════════════════════════════════════════════════════════════════ */
  function watchForAnomaliesOnSave() {
    // Sobrescreve saveTx para rodar detecção pós-save
    const origSaveTx = window.saveTx;
    if (typeof origSaveTx !== 'function') return;

    window.saveTx = async function(...args) {
      const result = await origSaveTx(...args);

      // Verifica anomalias de forma silenciosa em background
      setTimeout(async () => {
        if (!ready()) return;
        try {
          const uid = window.S.user.id;
          const recent = await window.db.transactions
            .where('userId').equals(uid)
            .reverse().limit(5).toArray();
          if (!recent.length) return;
          const last = recent[0];
          if (last.type !== 'expense' || last.amount < 500) return;

          // Verifica duplicata rápida
          const similar = recent.filter(t =>
            t.id !== last.id &&
            t.amount === last.amount &&
            t.categoryId === last.categoryId &&
            Math.abs(new Date(t.date) - new Date(last.date)) < 3600000
          );
          if (similar.length > 0) {
            T('⚠️ Possível transação duplicada detectada! Verifique em Fraudes & Anomalias.', 'warning', 6000);
          }
        } catch(e) { /* silencioso */ }
      }, 500);

      return result;
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     INICIALIZAÇÃO PRINCIPAL
  ═══════════════════════════════════════════════════════════════════════ */
  async function init() {
    try {
      await waitApp();
      console.log('[FP_INTEGRADOR] App pronto — inicializando integrações...');

      // Hooks
      hookNavigate();
      watchForAnomaliesOnSave();

      // Atalhos de teclado
      registerKeyboardShortcuts();

      // Widget no dashboard
      setTimeout(injectDashboardWidgets, 1200);

      // Backup automático
      setTimeout(startAutoBackup, 3000);

      // Inicializa extensões se disponível
      if (window.FP_EXT?.init) {
        try { await window.FP_EXT.init(); console.log('[FP_INTEGRADOR] FP_EXT inicializado'); }
        catch(e) { console.warn('[FP_INTEGRADOR] FP_EXT init falhou:', e.message); }
      }

      console.log('[FP_INTEGRADOR] ✅ Todas as integrações ativas!');
      console.log('[FP_INTEGRADOR] Atalhos: Ctrl+Shift+S=Simulador, Ctrl+Shift+D=Dashboard, Ctrl+Shift+F=Fraude, Ctrl+Shift+E=Educação, Ctrl+Shift+B=Benchmark');

      // MutationObserver: garante que as 4 páginas carreguem SEMPRE que ficarem visíveis
      // Independente de hooks de navigate — solução definitiva
      watchPageVisibility();

    } catch(e) {
      console.error('[FP_INTEGRADOR] Erro na inicialização:', e);
    }
  }

  /* ══════════════════════════════════════════════════════════
     WATCHPAGEVISIBILITY — MutationObserver nas 4 páginas
     Dispara o loader correto TODA VEZ que a página fica ativa,
     sem depender de hooks de navigate ou ordem de carregamento.
  ══════════════════════════════════════════════════════════ */
  function watchPageVisibility() {
    const PAGE_LOADERS = {
      'page-challenges': () => {
        if (typeof window.loadChallenges === 'function') window.loadChallenges();
        else setTimeout(() => window.loadChallenges?.(), 1000);
      },
      'page-anomalies': () => {
        if (typeof window.loadAnomalies === 'function') window.loadAnomalies();
        else setTimeout(() => window.loadAnomalies?.(), 1000);
      },
      'page-education': () => {
        if (typeof window.loadEducation === 'function') window.loadEducation();
        else setTimeout(() => window.loadEducation?.(), 1000);
      },
      'page-benchmark': () => {
        if (typeof window.loadBenchmark === 'function') window.loadBenchmark();
        else setTimeout(() => window.loadBenchmark?.(), 1000);
      },
    };

    for (const [pageId, loader] of Object.entries(PAGE_LOADERS)) {
      const el = document.getElementById(pageId);
      if (!el) { console.warn('[FP_INTEGRADOR] Página não encontrada:', pageId); continue; }

      // Observa mudanças na classe do elemento
      new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.attributeName === 'class' && el.classList.contains('active')) {
            // Aguarda 120ms para garantir que o DOM estabilizou
            setTimeout(loader, 120);
          }
        }
      }).observe(el, { attributes: true, attributeFilter: ['class'] });

      // Verifica se já está ativa agora (caso a página já esteja aberta)
      if (el.classList.contains('active')) {
        setTimeout(loader, 300);
      }
    }

    console.log('[FP_INTEGRADOR] 🔍 MutationObserver ativo nas 4 páginas extras');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
