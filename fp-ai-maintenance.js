/* ═══════════════════════════════════════════════════════════════════════════
   FinancePro — AI Pro MAINTENANCE & SUPPORT v1.0
   ───────────────────────────────────────────────────────────────────────────
   Módulo de suporte que MELHORA a manutenibilidade, confiabilidade e
   performance do fp-ai-pro.js sem quebrar compatibilidade.

   Recursos:
   ✓ Sistema de logging estruturado com níveis (DEBUG, INFO, WARN, ERROR)
   ✓ Health monitoring em tempo real
   ✓ Query helpers otimizados com índices
   ✓ Validação robusta de dados
   ✓ Rate limiting e throttling
   ✓ Observadores DOM com cleanup automático
   ✓ Configurações centralizadas
   ✓ Feedback loop para ML

   TODO: Descomente imports no index.html antes do fp-ai-pro.js
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─────────────── CONSTANTS & CONFIG ─────────────── */
  const CONFIG = {
    logging: {
      enabled: true,
      level: 'INFO', // DEBUG, INFO, WARN, ERROR
      maxLogs: 500,
      retention: 3600000, // 1 hora em ms
    },
    performance: {
      cacheSize: 500,
      queryTimeout: 5000,
      debounceMs: 350,
    },
    rateLimit: {
      classifyPerMinute: 50,
      learnPerMinute: 30,
      insightsPerMinute: 5,
    },
    validation: {
      minDescriptionLength: 1,
      maxDescriptionLength: 500,
      minAmount: 0.01,
    },
  };

  /* ─────────────── LOGGER ─────────────── */
  const Logger = {
    _logs: [],
    _levels: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 },
    _levelMap: { 0: '🔍', 1: 'ℹ️', 2: '⚠️', 3: '❌' },

    _shouldLog(level) {
      const cfgLevel = this._levels[CONFIG.logging.level] || 1;
      return this._levels[level] >= cfgLevel && CONFIG.logging.enabled;
    },

    log(level, module, message, data = null) {
      if (!this._shouldLog(level)) return;
      
      const entry = {
        timestamp: new Date().toISOString(),
        level,
        module,
        message,
        data,
        url: window.location.pathname,
      };
      
      this._logs.push(entry);
      if (this._logs.length > CONFIG.logging.maxLogs) {
        this._logs.shift();
      }

      const icon = this._levelMap[this._levels[level]];
      const prefix = `[${module}] ${message}`;
      
      if (level === 'ERROR') {
        console.error(`${icon} ${prefix}`, data);
      } else if (level === 'WARN') {
        console.warn(`${icon} ${prefix}`, data);
      } else if (level === 'DEBUG') {
        console.debug(`${icon} ${prefix}`, data);
      } else {
        console.log(`${icon} ${prefix}`, data ? `→ ${JSON.stringify(data).substring(0, 50)}` : '');
      }
    },

    debug(module, msg, data) { this.log('DEBUG', module, msg, data); },
    info(module, msg, data) { this.log('INFO', module, msg, data); },
    warn(module, msg, data) { this.log('WARN', module, msg, data); },
    error(module, msg, data) { this.log('ERROR', module, msg, data); },

    getLogs(minLevel = 'INFO', module = null) {
      const cfgLevel = this._levels[minLevel] || 1;
      return this._logs.filter(l => 
        this._levels[l.level] >= cfgLevel && 
        (!module || l.module === module)
      );
    },

    export() {
      return JSON.stringify(this._logs, null, 2);
    },

    clearOld() {
      const now = Date.now();
      this._logs = this._logs.filter(l => 
        new Date(l.timestamp).getTime() > now - CONFIG.logging.retention
      );
    },
  };

  /* ─────────────── RATE LIMITER ─────────────── */
  const RateLimiter = {
    _buckets: {},

    _initBucket(key) {
      if (!this._buckets[key]) {
        this._buckets[key] = { count: 0, reset: Date.now() + 60000 };
      }
      // Reset a cada minuto
      if (Date.now() > this._buckets[key].reset) {
        this._buckets[key] = { count: 0, reset: Date.now() + 60000 };
      }
    },

    canDo(operation) {
      const limit = CONFIG.rateLimit[operation];
      if (!limit) return true;

      this._initBucket(operation);
      const bucket = this._buckets[operation];
      
      if (bucket.count >= limit) {
        Logger.warn('RateLimiter', `${operation} atingiu limite`, { count: bucket.count, limit });
        return false;
      }

      bucket.count++;
      return true;
    },

    getStatus() {
      const status = {};
      for (const [op, limit] of Object.entries(CONFIG.rateLimit)) {
        this._initBucket(op);
        const bucket = this._buckets[op];
        status[op] = {
          used: bucket.count,
          limit,
          available: Math.max(0, limit - bucket.count),
          resetIn: Math.round((bucket.reset - Date.now()) / 1000) + 's',
        };
      }
      return status;
    },
  };

  /* ─────────────── VALIDATOR ─────────────── */
  const Validator = {
    isValidDescription(desc) {
      if (typeof desc !== 'string') return false;
      const len = desc.trim().length;
      return len >= CONFIG.validation.minDescriptionLength && 
             len <= CONFIG.validation.maxDescriptionLength;
    },

    isValidAmount(amount) {
      const num = parseFloat(amount);
      return !isNaN(num) && num >= CONFIG.validation.minAmount;
    },

    isValidTransaction(tx) {
      if (!tx || typeof tx !== 'object') return false;
      if (!this.isValidDescription(tx.description)) return false;
      if (tx.amount !== undefined && !this.isValidAmount(tx.amount)) return false;
      if (tx.type && !['expense', 'income', 'transfer'].includes(tx.type)) return false;
      return true;
    },

    validateOrThrow(data, validators) {
      for (const [key, fn] of Object.entries(validators)) {
        if (!fn(data[key])) {
          throw new Error(`Validation failed: ${key}`);
        }
      }
    },
  };

  /* ─────────────── OPTIMIZED QUERIES ─────────────── */
  const QueryHelper = {
    async getAllTransactions(userId, options = {}) {
      const { since = null, type = null, categoryId = null, limit = null } = options;
      
      try {
        let q = window.db.transactions.where('userId').equals(userId);
        let results = await Promise.race([
          q.toArray(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), CONFIG.performance.queryTimeout)
          )
        ]);

        // Filter client-side se necessário
        if (since) results = results.filter(t => t.date >= since);
        if (type) results = results.filter(t => t.type === type);
        if (categoryId) results = results.filter(t => t.categoryId === categoryId);
        if (limit) results = results.slice(0, limit);

        Logger.debug('QueryHelper', 'getAllTransactions', { count: results.length, userId });
        return results;
      } catch (e) {
        Logger.error('QueryHelper', 'getAllTransactions failed', { error: e.message });
        return [];
      }
    },

    async getTransactionsByCategory(userId, categoryId) {
      try {
        const all = await this.getAllTransactions(userId);
        return all.filter(t => t.categoryId === categoryId);
      } catch (e) {
        Logger.error('QueryHelper', 'getTransactionsByCategory', { error: e.message });
        return [];
      }
    },

    async getRecentTransactions(userId, days = 30) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString().split('T')[0];
      return this.getAllTransactions(userId, { since: sinceStr });
    },

    async countTransactionsByType(userId) {
      const all = await this.getAllTransactions(userId);
      const counts = { expense: 0, income: 0, transfer: 0 };
      for (const t of all) counts[t.type] = (counts[t.type] || 0) + 1;
      return counts;
    },

    async sumByType(userId, type) {
      const all = await this.getAllTransactions(userId, { type });
      return all.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    },
  };

  /* ─────────────── OBSERVER MANAGER ─────────────── */
  const ObserverManager = {
    _observers: [],
    _mutationObservers: [],

    watchElement(selector, callback, options = {}) {
      const obs = setInterval(() => {
        const el = document.querySelector(selector);
        if (el) {
          clearInterval(obs);
          callback(el);
          this._observers.push({ type: 'interval', id: obs });
          Logger.debug('ObserverManager', `Watching ${selector}`, { options });
        }
      }, options.interval || 500);

      return obs;
    },

    watchMutation(target, callback, options = {}) {
      const defaultOptions = {
        childList: true,
        subtree: true,
        attributes: false,
        ...options
      };

      const observer = new MutationObserver(callback);
      observer.observe(target, defaultOptions);
      this._mutationObservers.push(observer);

      Logger.debug('ObserverManager', 'Created MutationObserver');
      return observer;
    },

    cleanupAll() {
      // Limpar intervals
      for (const obs of this._observers) {
        if (obs.type === 'interval') clearInterval(obs.id);
      }

      // Limpar mutation observers
      for (const obs of this._mutationObservers) {
        obs.disconnect();
      }

      this._observers = [];
      this._mutationObservers = [];
      Logger.info('ObserverManager', 'Limpeza concluída', { count: this._observers.length + this._mutationObservers.length });
    },

    getStatus() {
      return {
        intervals: this._observers.length,
        mutations: this._mutationObservers.length,
        total: this._observers.length + this._mutationObservers.length,
      };
    },
  };

  /* ─────────────── HEALTH MONITOR ─────────────── */
  const HealthMonitor = {
    _checks: {},
    _history: [],

    async checkDatabaseHealth() {
      try {
        if (!window.db) throw new Error('DB not available');
        const count = await window.db.transactions.count();
        const health = { status: 'OK', dbCount: count, timestamp: new Date().toISOString() };
        this._addToHistory('database', health);
        return health;
      } catch (e) {
        const health = { status: 'ERROR', error: e.message };
        this._addToHistory('database', health);
        Logger.error('HealthMonitor', 'Database check failed', e);
        return health;
      }
    },

    async checkLocalAIHealth() {
      try {
        const hasClassify = window.LocalAI && typeof window.LocalAI.classify === 'function';
        const hasTrain = window.LocalAI && typeof window.LocalAI.train === 'function';
        const health = { 
          status: hasClassify && hasTrain ? 'OK' : 'PARTIAL',
          hasClassify,
          hasTrain,
          timestamp: new Date().toISOString()
        };
        this._addToHistory('localai', health);
        return health;
      } catch (e) {
        const health = { status: 'ERROR', error: e.message };
        this._addToHistory('localai', health);
        return health;
      }
    },

    async checkLLMHealth() {
      try {
        const ready = window.FP_LLM_PRO?.Engine?.state?.ready;
        const modelName = window.FP_LLM_PRO?.Engine?.state?.activeModel?.name;
        const health = {
          status: ready ? 'OK' : 'LOADING',
          ready,
          modelName,
          timestamp: new Date().toISOString()
        };
        this._addToHistory('llm', health);
        return health;
      } catch (e) {
        const health = { status: 'ERROR', error: e.message };
        this._addToHistory('llm', health);
        return health;
      }
    },

    async checkObserversHealth() {
      const status = ObserverManager.getStatus();
      const health = {
        status: status.total < 50 ? 'OK' : 'WARNING',
        ...status,
        timestamp: new Date().toISOString()
      };
      this._addToHistory('observers', health);
      return health;
    },

    async runAllChecks() {
      Logger.info('HealthMonitor', 'Running all health checks');
      const results = {
        database: await this.checkDatabaseHealth(),
        localai: await this.checkLocalAIHealth(),
        llm: await this.checkLLMHealth(),
        observers: await this.checkObserversHealth(),
        memory: this._getMemoryInfo(),
        rateLimit: RateLimiter.getStatus(),
      };
      return results;
    },

    _getMemoryInfo() {
      if (performance && performance.memory) {
        return {
          usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB',
          totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1048576) + 'MB',
          jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) + 'MB',
        };
      }
      return { available: false };
    },

    _addToHistory(component, health) {
      this._history.push({ component, ...health });
      if (this._history.length > 100) this._history.shift();
    },

    getHistory(component = null) {
      return component 
        ? this._history.filter(h => h.component === component)
        : this._history;
    },
  };

  /* ─────────────── FEEDBACK LOOP ─────────────── */
  const FeedbackCollector = {
    _feedback: [],

    recordClassification(description, categoryId, confidence, isCorrect = null) {
      const entry = {
        timestamp: new Date().toISOString(),
        description,
        categoryId,
        confidence,
        isCorrect,
        source: 'classifier',
      };
      this._feedback.push(entry);
      if (this._feedback.length > 1000) this._feedback.shift();
      
      Logger.debug('FeedbackCollector', 'Classification recorded', { confidence, isCorrect });
    },

    recordError(module, error, context = null) {
      const entry = {
        timestamp: new Date().toISOString(),
        module,
        error: error instanceof Error ? error.message : String(error),
        context,
        userAgent: navigator.userAgent,
      };
      this._feedback.push(entry);
      Logger.warn('FeedbackCollector', 'Error recorded', { module, error: error.message });
    },

    getAccuracy() {
      const correct = this._feedback.filter(f => f.isCorrect === true).length;
      const incorrect = this._feedback.filter(f => f.isCorrect === false).length;
      const total = correct + incorrect;
      if (total === 0) return null;
      return {
        total,
        correct,
        incorrect,
        accuracy: ((correct / total) * 100).toFixed(1) + '%',
        avgConfidence: (this._feedback.reduce((s, f) => s + (f.confidence || 0), 0) / this._feedback.length).toFixed(1),
      };
    },

    export() {
      return JSON.stringify(this._feedback, null, 2);
    },
  };

  /* ─────────────── PERFORMANCE PROFILER ─────────────── */
  const Profiler = {
    _marks: {},

    start(label) {
      this._marks[label] = { start: performance.now(), label };
    },

    end(label) {
      if (!this._marks[label]) return null;
      const duration = performance.now() - this._marks[label].start;
      const result = { label, duration: duration.toFixed(2) + 'ms' };
      Logger.debug('Profiler', label, result);
      return result;
    },

    measure(label, fn) {
      return async (...args) => {
        this.start(label);
        try {
          const result = await fn(...args);
          this.end(label);
          return result;
        } catch (e) {
          Logger.error('Profiler', `${label} failed`, e);
          throw e;
        }
      };
    },
  };

  /* ─────────────── DEBUGGER PANEL ─────────────── */
  const DebugPanel = {
    async show() {
      const health = await HealthMonitor.runAllChecks();
      const logs = Logger.getLogs('DEBUG');
      const accuracy = FeedbackCollector.getAccuracy();
      
      const panel = `
        <div id="fp-ai-debug-panel" style="
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 420px;
          max-height: 600px;
          background: #fff;
          border: 1px solid #ccc;
          border-radius: 8px;
          padding: 16px;
          font-size: 12px;
          font-family: monospace;
          z-index: 999999;
          overflow: auto;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        ">
          <div style="margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
            <strong>🔍 AI PRO DEBUG PANEL</strong>
            <button onclick="this.closest('#fp-ai-debug-panel').remove()" 
              style="float: right; background: none; border: none; cursor: pointer;">✕</button>
          </div>
          
          <div style="margin-bottom: 12px;">
            <strong>Health Status:</strong>
            <div style="color: ${health.database.status === 'OK' ? 'green' : 'red'}">
              Database: ${health.database.status}
            </div>
            <div style="color: ${health.localai.status !== 'ERROR' ? 'green' : 'orange'}">
              LocalAI: ${health.localai.status}
            </div>
            <div style="color: ${health.llm.status !== 'ERROR' ? 'green' : 'orange'}">
              LLM: ${health.llm.status}${health.llm.modelName ? ' (' + health.llm.modelName + ')' : ''}
            </div>
          </div>

          <div style="margin-bottom: 12px;">
            <strong>Performance:</strong>
            <div>Memory: ${health.memory.available ? health.memory.usedJSHeapSize : 'N/A'}</div>
            <div>Observers: ${health.observers.total}</div>
            <div>Logs: ${Logger._logs.length}</div>
          </div>

          <div style="margin-bottom: 12px;">
            <strong>Rate Limits:</strong>
            <div>${Object.entries(health.rateLimit).map(([k,v]) => 
              `${k}: ${v.used}/${v.limit}`
            ).join(' | ')}</div>
          </div>

          ${accuracy ? `<div style="margin-bottom: 12px;">
            <strong>Classification Accuracy:</strong>
            <div>Success rate: ${accuracy.accuracy}</div>
            <div>Avg confidence: ${accuracy.avgConfidence}%</div>
            <div>Total: ${accuracy.total} classifications</div>
          </div>` : ''}

          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #eee;">
            <button onclick="window.FP_AI_MAINTENANCE.exportDiagnostics()" 
              style="padding: 4px 8px; cursor: pointer; background: #f0f0f0; border: 1px solid #ccc; border-radius: 4px;">
              📥 Export Diagnostics
            </button>
          </div>
        </div>
      `;
      
      const container = document.createElement('div');
      container.innerHTML = panel;
      document.body.appendChild(container.firstChild);
    },
  };

  /* ─────────────── DIAGNOSTICS EXPORT ─────────────── */
  const Diagnostics = {
    async collectAll() {
      return {
        timestamp: new Date().toISOString(),
        health: await HealthMonitor.runAllChecks(),
        logs: Logger.getLogs('DEBUG'),
        feedback: FeedbackCollector._feedback,
        accuracy: FeedbackCollector.getAccuracy(),
        config: CONFIG,
        url: window.location.href,
        userAgent: navigator.userAgent,
      };
    },

    async export() {
      const data = await this.collectAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fp-ai-diagnostics-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      Logger.info('Diagnostics', 'Exported');
    },
  };

  /* ─────────────── PUBLIC API ─────────────── */
  window.FP_AI_MAINTENANCE = {
    Logger,
    RateLimiter,
    Validator,
    QueryHelper,
    ObserverManager,
    HealthMonitor,
    FeedbackCollector,
    Profiler,
    CONFIG,

    // Utilities
    async showDebugPanel() {
      await DebugPanel.show();
    },
    async exportDiagnostics() {
      await Diagnostics.export();
    },
    async checkHealth() {
      return await HealthMonitor.runAllChecks();
    },

    // Integration hook for fp-ai-pro.js
    enhanceClassifier(ClassifierModule) {
      if (!ClassifierModule) return;
      
      const originalClassify = ClassifierModule.classify.bind(ClassifierModule);
      ClassifierModule.classify = async function(description, type, amount) {
        if (!RateLimiter.canDo('classifyPerMinute')) {
          Logger.warn('Classifier', 'Rate limit exceeded');
          return null;
        }

        if (!Validator.isValidDescription(description)) {
          Logger.warn('Classifier', 'Invalid description');
          return null;
        }

        try {
          const result = await originalClassify(description, type, amount);
          if (result) {
            FeedbackCollector.recordClassification(description, result.categoryId, result.confidence);
          }
          return result;
        } catch (e) {
          FeedbackCollector.recordError('Classifier', e, { description, type });
          Logger.error('Classifier', 'Classification failed', { error: e.message });
          return null;
        }
      };
    },

    enhanceLearner(LearnerModule) {
      if (!LearnerModule) return;
      const originalLearn = LearnerModule.learnFromTx?.bind(LearnerModule);
      if (originalLearn) {
        LearnerModule.learnFromTx = async function(tx) {
          if (!RateLimiter.canDo('learnPerMinute')) return;
          try {
            await originalLearn(tx);
            Logger.debug('Learner', 'Learned from transaction');
          } catch (e) {
            Logger.error('Learner', 'Learning failed', e);
          }
        };
      }
    },

    // Auto-integration com FP_AI_PRO v2
    async init() {
      Logger.info('FP_AI_MAINTENANCE', 'Inicializando módulo de manutenção v2');

      setInterval(() => Logger.clearOld(), 600000);

      // Health check com auto-recovery
      setInterval(async () => {
        const health = await HealthMonitor.runAllChecks();
        if (health.database.status !== 'OK') {
          Logger.error('HealthMonitor', 'Database check failed — tentando recovery');
          // Força re-inicialização do índice TF-IDF se o DB voltar
          if (window.FP_AI_PRO?.Index) window.FP_AI_PRO.Index.invalidate();
        }
        // Alerta se memória acima de 80%
        if (performance?.memory) {
          const used = performance.memory.usedJSHeapSize;
          const limit = performance.memory.jsHeapSizeLimit;
          if (used / limit > 0.8) {
            Logger.warn('HealthMonitor', 'Memória alta — limpando caches', { pct: Math.round(used / limit * 100) });
            if (window.FP_AI_PRO?.Classifier) window.FP_AI_PRO.Classifier.invalidate();
          }
        }
      }, 120000);

      // Integra com Classifier v2 quando disponível
      const tryEnhance = () => {
        if (window.FP_AI_PRO?.Classifier) {
          this.enhanceClassifier(window.FP_AI_PRO.Classifier);
          this.enhanceLearner(window.FP_AI_PRO.Classifier);
          Logger.info('FP_AI_MAINTENANCE', 'Classifier v2 integrado com rate-limit e feedback');
        }
      };
      setTimeout(tryEnhance, 3000);
      document.addEventListener('fpllm:ready', () => {
        Logger.info('FP_AI_MAINTENANCE', 'LLM Pro pronto — registrando evento', { model: window.FP_LLM_PRO?.Engine?.state?.activeModel?.name });
      });

      window.addEventListener('beforeunload', () => {
        ObserverManager.cleanupAll();
        Logger.info('FP_AI_MAINTENANCE', 'Cleanup ao descarregar');
      });

      Logger.info('FP_AI_MAINTENANCE', 'Inicialização v2 completa');
    },
  };

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.FP_AI_MAINTENANCE.init());
  } else {
    setTimeout(() => window.FP_AI_MAINTENANCE.init(), 100);
  }
})();
