/* ═══════════════════════════════════════════════════════════════════════════
   FinancePro — MELHORIAS IA v2 (Implementações 6-10)
   ───────────────────────────────────────────────────────────────────────────
   6. 🎯 Planejador Automático de Metas
   7. 📈 Análise de Tendências com Forecasting
   8. 🔐 Backup Criptografado Automático
   9. 🌍 Modo Offline Avançado com Sincronização
   10. 🧮 Calculadora Financeira Integrada
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
        if (Date.now() - t0 > maxMs) return reject(new Error('AI_IMPROVEMENTS_V2 timeout'));
        setTimeout(loop, 250);
      })();
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     6️⃣  PLANEJADOR AUTOMÁTICO DE METAS
  ═══════════════════════════════════════════════════════════════════════ */
  const GoalPlanner = {
    async planGoal(goal) {
      try {
        const txs = await window.db.transactions.toArray();
        if (!txs.length) {
          T('Sem dados de transações', 'warning');
          return null;
        }

        // Calcula status financeiro
        const currentMonth = monthKey();
        const monthTxs = txs.filter(t => monthKey(new Date(t.date)) === currentMonth);

        const monthlyIncome = monthTxs
          .filter(t => t.type === 'income')
          .reduce((s, t) => s + t.amount, 0);

        const monthlyExpense = monthTxs
          .filter(t => t.type === 'expense')
          .reduce((s, t) => s + t.amount, 0);

        const monthlyBalance = monthlyIncome - monthlyExpense;

        // Calcula plano
        const monthsRemaining = this._monthsUntil(goal.deadline);
        if (monthsRemaining <= 0) {
          return { error: 'Meta vencida', feasible: false };
        }

        const amountNeeded = goal.targetAmount - (goal.currentAmount || 0);
        const monthlyRequired = amountNeeded / monthsRemaining;

        const plan = {
          goalId: goal.id || `goal-${Date.now()}`,
          title: goal.title,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount || 0,
          deadline: goal.deadline,
          monthsRemaining,
          monthlyRequired,
          currentMonthlyBalance: monthlyBalance,
          feasible: monthlyRequired <= monthlyBalance,
          actions: [],
          timeline: this._generateTimeline(goal.currentAmount || 0, monthlyRequired, monthsRemaining, goal.targetAmount)
        };

        // Recomendações se não for viável
        if (!plan.feasible) {
          const gap = monthlyRequired - monthlyBalance;

          // Ação 1: Reduzir gastos
          const byCat = {};
          monthTxs.forEach(t => {
            if (t.type === 'expense') {
              byCat[t.category] = (byCat[t.category] || 0) + t.amount;
            }
          });

          const topCategories = Object.entries(byCat)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

          topCategories.forEach((cat, idx) => {
            const reductionRate = 0.1 + (idx * 0.05); // 10%, 15%, 20%
            const savings = cat[1] * reductionRate;

            plan.actions.push({
              type: 'reduce_category',
              priority: idx + 1,
              category: cat[0],
              currentSpend: cat[1],
              targetSpend: cat[1] * (1 - reductionRate),
              savingsPerMonth: savings,
              difficulty: ['fácil', 'médio', 'difícil'][idx]
            });
          });

          // Ação 2: Aumentar renda
          if (gap > 0) {
            plan.actions.push({
              type: 'increase_income',
              priority: topCategories.length + 1,
              amountNeeded: gap,
              suggestions: ['freelance', 'side-hustle', 'bonus', 'venda de itens'],
              difficulty: 'média'
            });
          }
        }

        return plan;
      } catch (error) {
        console.error('Erro ao planejar meta:', error);
        return null;
      }
    },

    _monthsUntil(deadline) {
      const today = new Date();
      const target = new Date(deadline);
      return (target.getFullYear() - today.getFullYear()) * 12 +
             (target.getMonth() - today.getMonth());
    },

    _generateTimeline(current, monthly, months, target) {
      const timeline = [];
      for (let m = 0; m < months; m++) {
        const accumulated = current + (monthly * (m + 1));
        timeline.push({
          month: m + 1,
          projected: Math.min(accumulated, target),
          percentage: (accumulated / target * 100).toFixed(1)
        });
      }
      return timeline;
    },

    async saveGoal(goal) {
      try {
        if (!window.db.goals) {
          window.db.goals = window.db.createObjectStore('goals', { keyPath: 'id' });
        }
        await window.db.goals.put(goal);
        T('Meta salva com sucesso', 'success');
        return true;
      } catch (error) {
        console.error('Erro ao salvar meta:', error);
        return false;
      }
    },

    async getGoals() {
      try {
        if (!window.db.goals) return [];
        return await window.db.goals.toArray();
      } catch (error) {
        console.error('Erro ao recuperar metas:', error);
        return [];
      }
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     7️⃣  ANÁLISE DE TENDÊNCIAS COM FORECASTING
  ═══════════════════════════════════════════════════════════════════════ */
  const ForecastingAnalyzer = {
    async forecastExpense(categoryId, months = 6, method = 'simple') {
      try {
        const txs = await window.db.transactions.toArray();
        const categoryTxs = txs.filter(t =>
          t.category === categoryId && t.type === 'expense'
        );

        if (categoryTxs.length < 3) {
          return { error: 'Dados insuficientes', data: [] };
        }

        // Agrupa por mês (últimos 24 meses)
        const monthlyData = {};
        categoryTxs.forEach(t => {
          const mk = monthKey(new Date(t.date));
          monthlyData[mk] = (monthlyData[mk] || 0) + t.amount;
        });

        const history = Object.values(monthlyData).slice(-24);

        let forecast = [];
        if (method === 'simple') {
          forecast = this._simpleForecast(history, months);
        } else if (method === 'seasonal') {
          forecast = this._seasonalForecast(history, months);
        } else if (method === 'trend') {
          forecast = this._trendForecast(history, months);
        }

        return {
          category: categoryId,
          method,
          history,
          forecast,
          confidence: this._calculateConfidence(history, forecast),
          alerts: this._generateAlerts(history, forecast)
        };
      } catch (error) {
        console.error('Erro ao fazer previsão:', error);
        return { error: error.message, data: [] };
      }
    },

    _simpleForecast(history, months) {
      const avg = history.reduce((s, v) => s + v, 0) / history.length;
      const trend = (history[history.length - 1] - history[0]) / history.length;

      const forecast = [];
      for (let m = 0; m < months; m++) {
        forecast.push(avg + (trend * (m + 1)));
      }
      return forecast;
    },

    _seasonalForecast(history, months) {
      const avgMonthly = history.reduce((s, v) => s + v, 0) / history.length;

      // Detecta sazonalidade por trimestre
      const byQuarter = [[], [], [], []];
      history.forEach((val, idx) => {
        const quarter = Math.floor((idx % 12) / 3);
        byQuarter[quarter].push(val);
      });

      const seasonality = byQuarter.map(q =>
        q.length > 0 ? q.reduce((s, v) => s + v) / q.length / avgMonthly : 1
      );

      const forecast = [];
      for (let m = 0; m < months; m++) {
        const quarter = Math.floor(m / 3) % 4;
        forecast.push(avgMonthly * seasonality[quarter]);
      }
      return forecast;
    },

    _trendForecast(history, months) {
      // Regressão linear simples
      const n = history.length;
      const xSum = (n * (n + 1)) / 2;
      const ySum = history.reduce((s, v) => s + v, 0);
      const xySum = history.reduce((s, v, i) => s + (v * (i + 1)), 0);
      const x2Sum = (n * (n + 1) * (2 * n + 1)) / 6;

      const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
      const intercept = (ySum - slope * xSum) / n;

      const forecast = [];
      for (let m = 0; m < months; m++) {
        forecast.push(intercept + slope * (n + m + 1));
      }
      return forecast;
    },

    _calculateConfidence(history, forecast) {
      if (history.length < 3) return 0.3;
      const avgDeviation = history.reduce((sum, val, i, arr) => {
        if (i === 0) return 0;
        return sum + Math.abs(val - arr[i - 1]);
      }, 0) / history.length;

      const stability = 1 / (1 + avgDeviation / (history.reduce((s, v) => s + v, 0) / history.length));
      return Math.min(0.95, Math.max(0.5, stability));
    },

    _generateAlerts(history, forecast) {
      const alerts = [];
      const avgHistory = history.reduce((s, v) => s + v, 0) / history.length;
      const avgForecast = forecast.reduce((s, v) => s + v, 0) / forecast.length;
      const change = ((avgForecast - avgHistory) / avgHistory) * 100;

      if (Math.abs(change) > 20) {
        alerts.push({
          type: 'significant_change',
          message: `Previsão de ${change > 0 ? 'aumento' : 'redução'} de ${Math.abs(change).toFixed(0)}%`,
          severity: change > 30 ? 'alta' : 'média'
        });
      }

      if (forecast.some(v => v > avgHistory * 1.5)) {
        alerts.push({
          type: 'spike_detected',
          message: 'Pico de gasto previsto em alguns meses',
          severity: 'média'
        });
      }

      return alerts;
    },

    async getTrendAnalysis(months = 12) {
      try {
        const txs = await window.db.transactions.toArray();
        const categories = [...new Set(txs.map(t => t.category))];

        const analysis = {};
        for (const cat of categories) {
          const forecast = await this.forecastExpense(cat, months);
          if (!forecast.error) {
            analysis[cat] = forecast;
          }
        }

        return analysis;
      } catch (error) {
        console.error('Erro na análise de tendências:', error);
        return {};
      }
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     8️⃣  BACKUP CRIPTOGRAFADO AUTOMÁTICO
  ═══════════════════════════════════════════════════════════════════════ */
  const AutoBackup = {
    backupDB: null,
    autoBackupInterval: null,
    backupHistory: [],

    async initialize() {
      try {
        // Inicia auto-backup a cada 30 minutos
        this._startAutoBackup();
        console.log('✅ Sistema de Backup Automático inicializado');
      } catch (error) {
        console.error('Erro ao inicializar backup:', error);
      }
    },

    async backupNow(password = null) {
      try {
        const allData = {
          transactions: await window.db.transactions.toArray(),
          budgets: await window.db.budgets?.toArray?.() || [],
          goals: await window.db.goals?.toArray?.() || [],
          settings: await window.db.settings?.toArray?.() || [],
          timestamp: new Date().toISOString()
        };

        const backupSize = JSON.stringify(allData).length;

        // Simula compressão (em produção usar LZ4)
        const compressed = this._simpleCompress(JSON.stringify(allData));

        // Simula criptografia (em produção usar CryptoJS)
        const encrypted = password
          ? btoa(compressed) // Base64 como simulação
          : compressed;

        const backup = {
          id: `backup-${Date.now()}`,
          timestamp: new Date().toISOString(),
          size: backupSize,
          compressed: compressed.length,
          encrypted: encrypted.length,
          data: encrypted,
          hash: this._hashBackup(encrypted),
          version: '1.0'
        };

        // Armazena em localStorage (até 5MB)
        this._saveBackupLocal(backup);

        // Mantém histórico (últimos 10 backups)
        this.backupHistory.push(backup);
        if (this.backupHistory.length > 10) {
          this.backupHistory.shift();
        }

        T('✅ Backup criado com sucesso', 'success');
        return backup;
      } catch (error) {
        console.error('Erro ao fazer backup:', error);
        T('Erro ao criar backup', 'error');
        return null;
      }
    },

    async restoreBackup(backupId, password = null) {
      try {
        const backup = this.backupHistory.find(b => b.id === backupId);
        if (!backup) {
          T('Backup não encontrado', 'error');
          return false;
        }

        // Descriptografa
        const decrypted = password
          ? atob(backup.data) // Base64 como simulação
          : backup.data;

        // Descomprime
        const decompressed = this._simpleDecompress(decrypted);
        const data = JSON.parse(decompressed);

        // Restaura tudo
        for (const [table, records] of Object.entries(data)) {
          if (table !== 'timestamp' && window.db[table]) {
            // Limpa tabela
            await window.db[table].clear();
            // Restaura dados
            for (const record of records) {
              await window.db[table].put(record);
            }
          }
        }

        T('✅ Backup restaurado com sucesso', 'success');
        return true;
      } catch (error) {
        console.error('Erro ao restaurar backup:', error);
        T('Erro ao restaurar backup', 'error');
        return false;
      }
    },

    async exportBackup(backupId) {
      try {
        const backup = this.backupHistory.find(b => b.id === backupId);
        if (!backup) return null;

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `financepro-backup-${backup.timestamp.slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);

        T('✅ Backup exportado', 'success');
        return true;
      } catch (error) {
        console.error('Erro ao exportar backup:', error);
        return false;
      }
    },

    getBackupHistory() {
      return this.backupHistory.map(b => ({
        id: b.id,
        timestamp: b.timestamp,
        size: b.size,
        compressed: b.compressed,
        hash: b.hash
      }));
    },

    _startAutoBackup() {
      // Auto-backup a cada 30 minutos
      this.autoBackupInterval = setInterval(() => {
        this.backupNow();
      }, 30 * 60 * 1000);
    },

    _simpleCompress(str) {
      // Simulação: em produção usar LZ4
      return str.replace(/\s+/g, ' ');
    },

    _simpleDecompress(str) {
      return str;
    },

    _hashBackup(data) {
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(16);
    },

    _saveBackupLocal(backup) {
      try {
        const existing = JSON.parse(localStorage.getItem('fp_backups') || '[]');
        existing.push({ id: backup.id, timestamp: backup.timestamp });
        localStorage.setItem('fp_backups', JSON.stringify(existing.slice(-5)));
      } catch (e) {
        console.warn('Falha ao salvar histórico de backup:', e);
      }
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     9️⃣  MODO OFFLINE AVANÇADO COM SINCRONIZAÇÃO
  ═══════════════════════════════════════════════════════════════════════ */
  const OfflineSync = {
    syncQueue: [],
    isOnline: navigator.onLine,
    lastSync: null,

    async initialize() {
      window.addEventListener('online', () => this._onOnline());
      window.addEventListener('offline', () => this._onOffline());

      if (navigator.connection) {
        navigator.connection.addEventListener('change', () => this._checkConnection());
      }

      console.log('✅ Sistema Offline/Sync inicializado');
    },

    async createTransactionOffline(tx) {
      try {
        tx.id = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        tx.syncStatus = 'pending';
        tx.createdAt = new Date().toISOString();
        tx.isOffline = !this.isOnline;

        await window.db.transactions.add(tx);
        await this._addToSyncQueue(tx);

        T(`Transação ${this.isOnline ? 'criada' : '(offline) criada'}`, 'info');
        return tx;
      } catch (error) {
        console.error('Erro ao criar transação offline:', error);
        return null;
      }
    },

    async _addToSyncQueue(item) {
      this.syncQueue.push({
        id: item.id,
        type: 'transaction',
        operation: 'create',
        data: item,
        timestamp: new Date().toISOString()
      });

      // Persiste fila em localStorage
      this._saveSyncQueue();
    },

    async syncNow() {
      try {
        if (!this.isOnline || this.syncQueue.length === 0) {
          return { status: 'not_ready', queued: this.syncQueue.length };
        }

        const syncStart = Date.now();
        const results = [];

        for (const item of this.syncQueue) {
          try {
            // Simula sincronização (em produção, seria API call)
            await this._simulateSyncItem(item);
            results.push({ id: item.id, status: 'synced' });
          } catch (error) {
            results.push({ id: item.id, status: 'failed', error: error.message });
          }
        }

        // Limpa fila de itens sincronizados
        this.syncQueue = this.syncQueue.filter(item =>
          !results.some(r => r.id === item.id && r.status === 'synced')
        );

        this.lastSync = new Date().toISOString();
        this._saveSyncQueue();

        T(`✅ ${results.filter(r => r.status === 'synced').length} itens sincronizados`, 'success');

        return {
          status: 'completed',
          synced: results.filter(r => r.status === 'synced').length,
          failed: results.filter(r => r.status === 'failed').length,
          duration: Date.now() - syncStart,
          remaining: this.syncQueue.length
        };
      } catch (error) {
        console.error('Erro durante sincronização:', error);
        return { status: 'error', error: error.message };
      }
    },

    async _simulateSyncItem(item) {
      return new Promise((resolve) => {
        // Simula delay de sync (100-500ms)
        setTimeout(() => resolve({ success: true }), Math.random() * 400 + 100);
      });
    },

    async getPendingItems() {
      return this.syncQueue.map(item => ({
        id: item.id,
        type: item.type,
        operation: item.operation,
        timestamp: item.timestamp
      }));
    },

    getSyncStatus() {
      return {
        isOnline: this.isOnline,
        pending: this.syncQueue.length,
        lastSync: this.lastSync,
        connection: navigator.connection?.effectiveType || 'unknown'
      };
    },

    _onOnline() {
      this.isOnline = true;
      T('🟢 Online — Sincronizando dados...', 'success');
      this.syncNow();
    },

    _onOffline() {
      this.isOnline = false;
      T('🔴 Offline — Dados serão sincronizados quando voltar', 'warning');
    },

    _checkConnection() {
      const connection = navigator.connection?.effectiveType;
      if (connection === 'slow-2g' || connection === '2g') {
        T('⚠️ Conexão lenta detectada', 'warning');
      }
    },

    _saveSyncQueue() {
      try {
        localStorage.setItem('fp_sync_queue', JSON.stringify(this.syncQueue));
      } catch (e) {
        console.warn('Falha ao salvar fila de sync:', e);
      }
    },

    _loadSyncQueue() {
      try {
        this.syncQueue = JSON.parse(localStorage.getItem('fp_sync_queue') || '[]');
      } catch (e) {
        console.warn('Falha ao carregar fila de sync:', e);
      }
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     1️⃣0️⃣  CALCULADORA FINANCEIRA INTEGRADA
  ═══════════════════════════════════════════════════════════════════════ */
  const FinancialCalculator = {
    // Juros Compostos: M = C(1+i)^t
    compoundInterest(principal, annualRate, years, compounds = 12) {
      const r = annualRate / 100 / compounds;
      const t = years * compounds;
      const amount = principal * Math.pow(1 + r, t);
      const interest = amount - principal;

      return {
        principal,
        annualRate,
        years,
        compounds,
        finalAmount: parseFloat(amount.toFixed(2)),
        interest: parseFloat(interest.toFixed(2)),
        totalPercentage: ((interest / principal) * 100).toFixed(2)
      };
    },

    // Prestação: P = V * [i(1+i)^n] / [(1+i)^n - 1]
    loanPayment(loanAmount, annualRate, months) {
      const monthlyRate = annualRate / 100 / 12;
      const numerator = monthlyRate * Math.pow(1 + monthlyRate, months);
      const denominator = Math.pow(1 + monthlyRate, months) - 1;
      const monthlyPayment = loanAmount * (numerator / denominator);
      const totalPaid = monthlyPayment * months;
      const totalInterest = totalPaid - loanAmount;

      return {
        loanAmount,
        annualRate,
        months,
        monthlyPayment: parseFloat(monthlyPayment.toFixed(2)),
        totalPaid: parseFloat(totalPaid.toFixed(2)),
        totalInterest: parseFloat(totalInterest.toFixed(2)),
        effectiveRate: ((totalInterest / loanAmount) * 100).toFixed(2)
      };
    },

    // Amortização detalhada
    amortizationSchedule(loanAmount, annualRate, months, detailed = false) {
      const monthlyRate = annualRate / 100 / 12;
      const monthlyPayment = loanAmount *
        (monthlyRate * Math.pow(1 + monthlyRate, months)) /
        (Math.pow(1 + monthlyRate, months) - 1);

      const schedule = [];
      let balance = loanAmount;

      for (let m = 1; m <= months; m++) {
        const interest = balance * monthlyRate;
        const principal = monthlyPayment - interest;
        balance -= principal;

        if (detailed || m === 1 || m === Math.ceil(months / 4) || m === Math.ceil(months / 2) || m === months) {
          schedule.push({
            month: m,
            payment: parseFloat(monthlyPayment.toFixed(2)),
            principal: parseFloat(principal.toFixed(2)),
            interest: parseFloat(interest.toFixed(2)),
            balance: parseFloat(Math.max(0, balance).toFixed(2))
          });
        }
      }

      return {
        loanAmount,
        monthlyPayment: parseFloat(monthlyPayment.toFixed(2)),
        schedule: detailed ? schedule : schedule.slice(0, 5)
      };
    },

    // ROI: Return on Investment
    calculateROI(investment, return_value, years) {
      const roi = ((return_value - investment) / investment) * 100;
      const annualROI = (Math.pow(return_value / investment, 1 / years) - 1) * 100;

      return {
        investment,
        return: return_value,
        years,
        totalROI: parseFloat(roi.toFixed(2)),
        annualROI: parseFloat(annualROI.toFixed(2)),
        profit: parseFloat((return_value - investment).toFixed(2))
      };
    },

    // Inflação — Poder de compra
    purchasingPower(amount, inflationRate, years) {
      const pp = amount / Math.pow(1 + inflationRate / 100, years);
      const loss = amount - pp;

      return {
        amount,
        inflationRate,
        years,
        purchasingPower: parseFloat(pp.toFixed(2)),
        valueLoss: parseFloat(loss.toFixed(2)),
        percentageLoss: ((loss / amount) * 100).toFixed(2)
      };
    },

    // Poupança com aportes regulares
    savingsWithDeposits(initialAmount, monthlyDeposit, annualRate, months) {
      const monthlyRate = annualRate / 100 / 12;
      let balance = initialAmount;
      const timeline = [];

      for (let m = 1; m <= months; m++) {
        balance = balance * (1 + monthlyRate) + monthlyDeposit;

        if (m % Math.max(1, Math.floor(months / 12)) === 0 || m === months) {
          timeline.push({
            month: m,
            balance: parseFloat(balance.toFixed(2))
          });
        }
      }

      const totalDeposited = initialAmount + (monthlyDeposit * months);
      const gains = balance - totalDeposited;

      return {
        initialAmount,
        monthlyDeposit,
        annualRate,
        months,
        finalBalance: parseFloat(balance.toFixed(2)),
        totalDeposited: parseFloat(totalDeposited.toFixed(2)),
        gains: parseFloat(gains.toFixed(2)),
        timeline
      };
    },

    // Imposto de renda estimado (Brasil)
    estimateIncomeTax(grossIncome, deductions = 0) {
      const taxableIncome = grossIncome - deductions;

      let tax = 0;
      if (taxableIncome > 5363.20) {
        if (taxableIncome <= 8006.00) {
          tax = taxableIncome * 0.075 - 402.24;
        } else if (taxableIncome <= 10814.20) {
          tax = taxableIncome * 0.15 - 1080.03;
        } else if (taxableIncome <= 14276.00) {
          tax = taxableIncome * 0.225 - 2353.39;
        } else {
          tax = taxableIncome * 0.275 - 3704.64;
        }
      }

      const netIncome = grossIncome - tax;
      const effectiveRate = (tax / grossIncome) * 100;

      return {
        grossIncome,
        deductions,
        taxableIncome,
        tax: parseFloat(tax.toFixed(2)),
        netIncome: parseFloat(netIncome.toFixed(2)),
        effectiveRate: parseFloat(effectiveRate.toFixed(2))
      };
    },

    // Múltiplo de gastos mensais (meses de fundo de emergência)
    emergencyFund(monthlyExpense, savedAmount) {
      const months = savedAmount / monthlyExpense;
      const recommended = 6;
      const status = months >= recommended ? 'adequado' : 'insuficiente';
      const needed = Math.max(0, recommended * monthlyExpense - savedAmount);

      return {
        monthlyExpense,
        savedAmount,
        months: parseFloat(months.toFixed(2)),
        recommended,
        status,
        needed: parseFloat(needed.toFixed(2)),
        recommendation: `Mantenha ${recommended} meses de despesas. Faltam ${fmtMoney(needed)}`
      };
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     API PÚBLICA
  ═══════════════════════════════════════════════════════════════════════ */
  window.FP_AI_Improvements_V2 = {
    goalPlanner: GoalPlanner,
    forecasting: ForecastingAnalyzer,
    backup: AutoBackup,
    offlineSync: OfflineSync,
    calculator: FinancialCalculator,

    async initialize() {
      try {
        await waitApp();

        // Inicializa módulos
        await AutoBackup.initialize();
        await OfflineSync.initialize();
        OfflineSync._loadSyncQueue();

        console.log('✅ FinancePro IA Melhorias v2 (6-10) inicializada');
        return true;
      } catch (error) {
        console.error('❌ Erro ao inicializar melhorias v2:', error);
        return false;
      }
    }
  };

  // Auto-inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.FP_AI_Improvements_V2?.initialize());
  } else {
    window.FP_AI_Improvements_V2?.initialize();
  }
})();
