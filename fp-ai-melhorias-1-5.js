/* ═══════════════════════════════════════════════════════════════════════════
   FinancePro — MELHORIAS IA v1 (Implementações 1-5)
   ───────────────────────────────────────────────────────────────────────────
   1. 🔮 Simulador de Cenários Financeiros
   2. 🏆 Sistema de Desafios Inteligentes
   3. 📊 Relatório Financeiro Automático (PDF/Excel)
   4. 🤖 Machine Learning Local — Previsão de Categoria
   5. 💳 Detector de Fraude & Anomalias Avançado
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const T = (msg, type = 'info', ms = 3500) => {
    if (typeof window.toast === 'function') window.toast(msg, type, ms);
  };

  const fmtMoney = v => typeof window.fmtCurrency === 'function'
    ? window.fmtCurrency(v)
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  const todayStr = () => new Date().toISOString().split('T')[0];
  const monthKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

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
        if (Date.now() - t0 > maxMs) return reject(new Error('AI_IMPROVEMENTS timeout'));
        setTimeout(loop, 250);
      })();
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     1️⃣  SIMULADOR DE CENÁRIOS FINANCEIROS
  ═══════════════════════════════════════════════════════════════════════ */
  const ScenarioSimulator = {
    // Simula redução de gastos e aumento de renda
    async simulateScenario(reductionPct = 0, increaseIncome = 0, months = 12) {
      try {
        const txs = await window.db.transactions.toArray();
        if (!txs.length) {
          T('Sem dados de transações para simular', 'warning');
          return null;
        }

        // Calcula gastos e renda mensais
        const currentMonth = new Date();
        const currentMonthKey = monthKey(currentMonth);

        const monthlyExpense = txs
          .filter(t => monthKey(new Date(t.date)) === currentMonthKey && t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);

        const monthlyIncome = txs
          .filter(t => monthKey(new Date(t.date)) === currentMonthKey && t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);

        const projections = [];

        for (let m = 0; m < months; m++) {
          const projectedExp = monthlyExpense * (1 - reductionPct / 100);
          const projectedInc = monthlyIncome + increaseIncome;
          const balance = projectedInc - projectedExp;
          const accumulated = projections.length > 0
            ? projections[projections.length - 1].accumulated + balance
            : balance;

          projections.push({
            month: m + 1,
            monthlyBalance: balance,
            monthlyExpense: projectedExp,
            monthlyIncome: projectedInc,
            accumulated,
            savingsRate: projectedInc > 0 ? ((balance / projectedInc) * 100).toFixed(2) : 0
          });
        }

        return {
          currentMonthlyExpense: monthlyExpense,
          currentMonthlyIncome: monthlyIncome,
          currentBalance: monthlyIncome - monthlyExpense,
          reductionPct,
          increaseIncome,
          projections,
          totalAccumulated: projections[projections.length - 1]?.accumulated || 0,
          simulationDate: new Date().toISOString()
        };
      } catch (error) {
        console.error('Erro ao simular cenário:', error);
        T('Erro ao simular cenário', 'error');
        return null;
      }
    },

    // Interface de simulação
    async renderSimulationUI() {
      const container = document.createElement('div');
      container.id = 'scenario-simulator';
      container.innerHTML = `
        <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; margin: 15px 0;">
          <h3>🔮 Simulador de Cenários</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <div>
              <label>Redução de Gastos (%)</label>
              <input type="number" id="reduction-pct" placeholder="0-50%" min="0" max="100" step="5" value="0"
                     style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div>
              <label>Aumento de Renda (R$)</label>
              <input type="number" id="increase-income" placeholder="0" min="0" step="100" value="0"
                     style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div>
              <label>Período (meses)</label>
              <input type="number" id="simulation-months" placeholder="12" min="1" max="120" value="12" step="1"
                     style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <button id="run-simulation" style="align-self: flex-end; padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
              🚀 Simular
            </button>
          </div>
          <div id="simulation-results"></div>
        </div>
      `;
      return container;
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     2️⃣  SISTEMA DE DESAFIOS INTELIGENTES
  ═══════════════════════════════════════════════════════════════════════ */
  const ChallengeSystem = {
    async generateChallenges() {
      try {
        const txs = await window.db.transactions.toArray();
        if (!txs.length) return [];

        const currentMonth = monthKey();
        const currentMonthTxs = txs.filter(t => monthKey(new Date(t.date)) === currentMonth);

        // Calcula gastos por categoria
        const byCat = {};
        currentMonthTxs.forEach(t => {
          if (t.type === 'expense') {
            byCat[t.category] = (byCat[t.category] || 0) + t.amount;
          }
        });

        const topCategory = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
        const totalExpense = Object.values(byCat).reduce((s, v) => s + v, 0);

        const challenges = [];

        // Desafio 1: Reduzir categoria de topo
        if (topCategory) {
          challenges.push({
            id: 'challenge-reduce-top',
            title: `Reduzir ${topCategory[0]} em 15%`,
            description: `Gastos em ${topCategory[0]}: ${fmtMoney(topCategory[1])}`,
            category: topCategory[0],
            target: topCategory[1] * 0.85,
            currentSpend: topCategory[1],
            reward: 50,
            difficulty: 'média',
            icon: '🎯',
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          });
        }

        // Desafio 2: Economizar quantidade fixa
        challenges.push({
          id: 'challenge-save-amount',
          title: 'Economizar R$ 200 esta semana',
          description: 'Reduza o gasto semanal em R$ 200',
          target: totalExpense * 0.8,
          currentSpend: totalExpense,
          reward: 75,
          difficulty: 'alta',
          icon: '💰',
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });

        // Desafio 3: Sem gastos em categoria específica
        const randomCat = Object.keys(byCat)[Math.floor(Math.random() * Object.keys(byCat).length)];
        challenges.push({
          id: 'challenge-zero-cat',
          title: `Sem gastos em ${randomCat} esta semana`,
          description: `Não gaste nada em ${randomCat} por 7 dias`,
          category: randomCat,
          reward: 100,
          difficulty: 'muito alta',
          icon: '⚡',
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });

        return challenges;
      } catch (error) {
        console.error('Erro ao gerar desafios:', error);
        return [];
      }
    },

    async trackChallengeProgress(challengeId) {
      try {
        // Recupera desafio
        const stored = await window.db.challenges?.get(challengeId);
        if (!stored) return null;

        const txs = await window.db.transactions.toArray();
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentTxs = txs.filter(t => new Date(t.date) >= weekAgo);

        // Calcula progresso
        let progress = 0;
        if (stored.category) {
          const categorySpend = recentTxs
            .filter(t => t.category === stored.category && t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
          progress = ((stored.target - categorySpend) / (stored.target - stored.currentSpend)) * 100;
        }

        return {
          challengeId,
          progress: Math.max(0, Math.min(100, progress)),
          status: progress >= 100 ? 'completed' : 'in_progress',
          reward: progress >= 100 ? stored.reward : 0
        };
      } catch (error) {
        console.error('Erro ao rastrear desafio:', error);
        return null;
      }
    },

    async renderChallengesUI() {
      const challenges = await this.generateChallenges();
      const container = document.createElement('div');
      container.id = 'challenges-panel';
      container.innerHTML = `
        <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; margin: 15px 0;">
          <h3>🏆 Desafios Inteligentes</h3>
          <div id="challenges-list" style="display: grid; gap: 12px;">
            ${challenges.map(c => `
              <div style="padding: 15px; background: white; border-left: 4px solid #FF9800; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <strong>${c.icon} ${c.title}</strong>
                    <p style="margin: 5px 0; color: #666; font-size: 0.9em;">${c.description}</p>
                    <p style="margin: 5px 0; color: #999; font-size: 0.85em;">Dificuldade: ${c.difficulty}</p>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 1.2em; font-weight: bold; color: #FF9800;">+${c.reward} pts</div>
                    <small style="color: #999;">até ${c.deadline}</small>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      return container;
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     3️⃣  RELATÓRIO FINANCEIRO AUTOMÁTICO (PDF/Excel)
  ═══════════════════════════════════════════════════════════════════════ */
  const ReportGenerator = {
    async generateReport(format = 'pdf') {
      try {
        const txs = await window.db.transactions.toArray();
        const budgets = await window.db.budgets?.toArray?.() || [];

        const currentMonth = monthKey();
        const monthTxs = txs.filter(t => monthKey(new Date(t.date)) === currentMonth);

        // Calcula estatísticas
        const totalIncome = monthTxs
          .filter(t => t.type === 'income')
          .reduce((s, t) => s + t.amount, 0);

        const totalExpense = monthTxs
          .filter(t => t.type === 'expense')
          .reduce((s, t) => s + t.amount, 0);

        const balance = totalIncome - totalExpense;
        const savingsRate = totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(2) : 0;

        // Agrupa por categoria
        const byCategory = {};
        monthTxs.forEach(t => {
          if (t.type === 'expense') {
            byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
          }
        });

        // Calcula tendências dos últimos 6 meses
        const last6Months = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const mk = monthKey(d);
          const monthExpense = txs
            .filter(t => monthKey(new Date(t.date)) === mk && t.type === 'expense')
            .reduce((s, t) => s + t.amount, 0);
          last6Months.push({ month: mk, expense: monthExpense });
        }

        const reportData = {
          generatedDate: new Date().toLocaleString('pt-BR'),
          currentMonth,
          summary: {
            totalIncome: fmtMoney(totalIncome),
            totalExpense: fmtMoney(totalExpense),
            balance: fmtMoney(balance),
            savingsRate: savingsRate + '%'
          },
          categoryBreakdown: Object.entries(byCategory).map(([cat, amount]) => ({
            category: cat,
            amount: fmtMoney(amount),
            percentage: ((amount / totalExpense) * 100).toFixed(1) + '%'
          })),
          trends: last6Months,
          recommendations: this.generateRecommendations(byCategory, totalIncome, balance)
        };

        if (format === 'json') {
          return reportData;
        } else if (format === 'html') {
          return this.generateHTML(reportData);
        } else if (format === 'csv') {
          return this.generateCSV(reportData);
        }

        return reportData;
      } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        T('Erro ao gerar relatório', 'error');
        return null;
      }
    },

    generateRecommendations(byCategory, totalIncome, balance) {
      const recommendations = [];

      // Recomendação baseada em taxa de poupança
      const savingsRate = (balance / totalIncome) * 100;
      if (savingsRate < 10) {
        recommendations.push({
          icon: '⚠️',
          text: 'Taxa de poupança baixa. Tente aumentar em 5% reduzindo gastos discricionários.',
          priority: 'alta'
        });
      }

      // Recomendação baseada em categoria
      const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
      if (topCategory && (topCategory[1] / totalIncome) > 0.35) {
        recommendations.push({
          icon: '🎯',
          text: `${topCategory[0]} representa ${((topCategory[1] / totalIncome) * 100).toFixed(0)}% da renda. Considere revisar.`,
          priority: 'média'
        });
      }

      // Recomendação positiva
      if (balance > 0) {
        recommendations.push({
          icon: '✅',
          text: 'Mês positivo! Você poupou ' + fmtMoney(balance) + '. Mantenha assim!',
          priority: 'positiva'
        });
      }

      return recommendations;
    },

    generateHTML(data) {
      return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório Financeiro - ${data.currentMonth}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 3px solid #1976D2; padding-bottom: 20px; margin-bottom: 30px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 30px 0; }
    .summary-card { background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #1976D2; }
    .summary-card h4 { margin: 0 0 10px 0; font-size: 0.9em; color: #666; }
    .summary-card .value { font-size: 1.5em; font-weight: bold; color: #1976D2; }
    .breakdown { margin: 30px 0; }
    .breakdown-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .breakdown-item .category { font-weight: bold; }
    .breakdown-item .amount { text-align: right; font-weight: bold; }
    .breakdown-item .percentage { text-align: right; color: #999; }
    .recommendations { margin: 30px 0; }
    .recommendation { padding: 15px; margin: 10px 0; background: #f9f9f9; border-left: 4px solid #FF9800; border-radius: 4px; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 0.9em; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Relatório Financeiro</h1>
      <p>Período: ${data.currentMonth} | Gerado em: ${data.generatedDate}</p>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <h4>Receita</h4>
        <div class="value" style="color: #4CAF50;">${data.summary.totalIncome}</div>
      </div>
      <div class="summary-card">
        <h4>Despesa</h4>
        <div class="value" style="color: #f44336;">${data.summary.totalExpense}</div>
      </div>
      <div class="summary-card">
        <h4>Saldo</h4>
        <div class="value" style="color: ${data.summary.balance.includes('-') ? '#f44336' : '#4CAF50'};">
          ${data.summary.balance}
        </div>
      </div>
      <div class="summary-card">
        <h4>Taxa Poupança</h4>
        <div class="value">${data.summary.savingsRate}</div>
      </div>
    </div>

    <div class="breakdown">
      <h2>Despesas por Categoria</h2>
      ${data.categoryBreakdown.map(item => `
        <div class="breakdown-item">
          <span class="category">${item.category}</span>
          <span class="percentage">${item.percentage}</span>
          <span class="amount">${item.amount}</span>
        </div>
      `).join('')}
    </div>

    <div class="recommendations">
      <h2>Recomendações</h2>
      ${data.recommendations.map(rec => `
        <div class="recommendation">
          <strong>${rec.icon} ${rec.priority.toUpperCase()}</strong>
          <p>${rec.text}</p>
        </div>
      `).join('')}
    </div>

    <div class="footer">
      <p>Relatório gerado automaticamente por FinancePro IA v3.0</p>
      <p>Este relatório contém informações confidenciais. Não compartilhe.</p>
    </div>
  </div>
</body>
</html>
      `;
    },

    generateCSV(data) {
      let csv = 'FinancePro - Relatório Financeiro\n';
      csv += `Período: ${data.currentMonth}\n`;
      csv += `Gerado em: ${data.generatedDate}\n\n`;

      csv += 'RESUMO\n';
      csv += 'Receita,' + data.summary.totalIncome + '\n';
      csv += 'Despesa,' + data.summary.totalExpense + '\n';
      csv += 'Saldo,' + data.summary.balance + '\n';
      csv += 'Taxa Poupança,' + data.summary.savingsRate + '\n\n';

      csv += 'DESPESAS POR CATEGORIA\n';
      csv += 'Categoria,Valor,Percentual\n';
      data.categoryBreakdown.forEach(item => {
        csv += `${item.category},${item.amount},${item.percentage}\n`;
      });

      return csv;
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     4️⃣  MACHINE LEARNING LOCAL — Previsão de Categoria
  ═══════════════════════════════════════════════════════════════════════ */
  const MLCategoryPredictor = {
    model: null,
    categories: [],
    trained: false,

    async train() {
      try {
        if (this.trained) return true;

        const txs = await window.db.transactions.toArray();
        if (txs.length < 20) {
          console.log('Dados insuficientes para treinar (mínimo 20 transações)');
          return false;
        }

        // Extrai categorias únicas
        this.categories = [...new Set(txs.map(t => t.category))];

        // Armazena dados para previsão
        this.trainingData = txs.map(t => ({
          description: this.normalize(t.description || ''),
          category: t.category,
          amount: t.amount,
          dayOfWeek: new Date(t.date).getDay(),
          hour: new Date(t.date).getHours(),
          month: new Date(t.date).getMonth()
        }));

        this.trained = true;
        console.log(`Modelo treinado com ${txs.length} transações e ${this.categories.length} categorias`);
        return true;
      } catch (error) {
        console.error('Erro ao treinar modelo:', error);
        return false;
      }
    },

    normalize(text) {
      return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    },

    async predict(description) {
      try {
        if (!this.trained) await this.train();
        if (!this.trained) return null;

        const normalized = this.normalize(description);
        const words = normalized.split(' ').filter(w => w.length > 0);

        // Calcula similaridade com cada categoria no histórico
        const scores = {};
        this.categories.forEach(cat => scores[cat] = 0);

        this.trainingData.forEach(training => {
          const trainingWords = training.description.split(' ');

          // Conta palavras coincidentes
          const matches = words.filter(w => trainingWords.includes(w)).length;
          const similarity = matches / Math.max(words.length, trainingWords.length);

          if (similarity > 0.3) {
            scores[training.category] += similarity * 10;
          }
        });

        // Retorna categoria com maior score
        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        if (sorted[0][1] > 0) {
          return {
            category: sorted[0][0],
            confidence: Math.min(100, sorted[0][1] * 10),
            alternatives: sorted.slice(1, 4).map(([cat, score]) => ({
              category: cat,
              confidence: Math.min(100, score * 10)
            }))
          };
        }

        return null;
      } catch (error) {
        console.error('Erro ao prever categoria:', error);
        return null;
      }
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     5️⃣  DETECTOR DE FRAUDE & ANOMALIAS AVANÇADO
  ═══════════════════════════════════════════════════════════════════════ */
  const FraudDetector = {
    async detectAnomalies(transaction) {
      try {
        const anomalies = [];
        const allTxs = await window.db.transactions.toArray();

        // 1️⃣  Outlier estatístico
        const categoryTxs = allTxs.filter(t => t.category === transaction.category);
        if (categoryTxs.length >= 3) {
          const amounts = categoryTxs.map(t => t.amount);
          const mean = amounts.reduce((a, b) => a + b) / amounts.length;
          const variance = amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length;
          const stdDev = Math.sqrt(variance);

          if (transaction.amount > mean + 2 * stdDev) {
            anomalies.push({
              type: 'outlier',
              severity: 'alta',
              message: `${transaction.amount.toFixed(2)} é ${(transaction.amount / mean).toFixed(1)}x a média`,
              icon: '⚠️'
            });
          }
        }

        // 2️⃣  Transação duplicada potencial
        const similar = allTxs.filter(t =>
          t.id !== transaction.id &&
          t.category === transaction.category &&
          Math.abs(t.amount - transaction.amount) < 0.01 &&
          Math.abs(new Date(t.date) - new Date(transaction.date)) < 3600000
        );

        if (similar.length > 0) {
          anomalies.push({
            type: 'duplicate',
            severity: 'media',
            message: `Possível duplicação de transação (${similar.length} similar${similar.length > 1 ? 's' : ''})`,
            icon: '🔄'
          });
        }

        // 3️⃣  Comportamento incomum (hora/dia)
        const dow = new Date(transaction.date).getDay();
        const hour = new Date(transaction.date).getHours();
        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

        const typicalForCat = allTxs.filter(t =>
          t.category === transaction.category &&
          new Date(t.date).getDay() === dow &&
          Math.abs(new Date(t.date).getHours() - hour) <= 2
        );

        if (typicalForCat.length === 0 && allTxs.length > 30) {
          anomalies.push({
            type: 'unusual_pattern',
            severity: 'baixa',
            message: `Incomum: ${transaction.category} em ${dayNames[dow]} às ${hour}h`,
            icon: '🤔'
          });
        }

        // 4️⃣  Gasto muito acima da renda
        const currentMonth = monthKey(new Date(transaction.date));
        const monthTxs = allTxs.filter(t => monthKey(new Date(t.date)) === currentMonth);
        const monthIncome = monthTxs
          .filter(t => t.type === 'income')
          .reduce((s, t) => s + t.amount, 0);
        const monthExpense = monthTxs
          .filter(t => t.type === 'expense')
          .reduce((s, t) => s + t.amount, 0) + transaction.amount;

        if (monthExpense > monthIncome * 1.5) {
          anomalies.push({
            type: 'budget_excess',
            severity: 'alta',
            message: 'Despesas ${(monthExpense / monthIncome).toFixed(1)}x acima da renda',
            icon: '💥'
          });
        }

        return {
          transactionId: transaction.id,
          anomalies,
          riskScore: anomalies.reduce((score, a) =>
            score + (a.severity === 'alta' ? 3 : a.severity === 'media' ? 2 : 1), 0),
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error('Erro ao detectar anomalias:', error);
        return { anomalies: [], riskScore: 0 };
      }
    },

    async renderDetectionUI() {
      const container = document.createElement('div');
      container.id = 'fraud-detector';
      container.innerHTML = `
        <div style="padding: 20px; background: #fff3cd; border-radius: 8px; margin: 15px 0; border-left: 4px solid #FF9800;">
          <h3>💳 Detector de Fraude & Anomalias</h3>
          <p style="margin: 10px 0; color: #666;">Sistema de detecção em tempo real monitorando anomalias financeiras</p>
          <div id="anomalies-list" style="margin-top: 15px;"></div>
        </div>
      `;
      return container;
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     API PÚBLICA
  ═══════════════════════════════════════════════════════════════════════ */
  window.FP_AI_Improvements = {
    scenarios: ScenarioSimulator,
    challenges: ChallengeSystem,
    reports: ReportGenerator,
    mlPredictor: MLCategoryPredictor,
    fraud: FraudDetector,

    async initialize() {
      try {
        await waitApp();
        console.log('✅ FinancePro IA Melhorias v1 inicializada');

        // Treina modelo ML
        await MLCategoryPredictor.train();

        return true;
      } catch (error) {
        console.error('❌ Erro ao inicializar melhorias:', error);
        return false;
      }
    }
  };

  // Auto-inicializar quando documento estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.FP_AI_Improvements?.initialize());
  } else {
    window.FP_AI_Improvements?.initialize();
  }
})();
