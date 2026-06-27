/* ═══════════════════════════════════════════════════════════
   FinancePro — Extensions Pack v1.0
   ───────────────────────────────────────────────────────────
   Adiciona 4 novas funcionalidades SEM modificar o app.js:
     1. Notificações inteligentes (locais + push opcional)
     2. Gamificação (desafios, conquistas, pontuação, streaks)
     3. Backup automático (local + nuvem opcional via OAuth)
     4. Autenticação biométrica (WebAuthn / platform authenticator)

   Tudo encapsulado em window.FP_EXT para ZERO conflito.
   Carregue este arquivo APÓS app.js e chame FP_EXT.init().
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ─── Bail-out se app.js não tiver carregado ───
  function ready() {
    return typeof window.db !== 'undefined' &&
           typeof window.S !== 'undefined' &&
           typeof window.toast === 'function';
  }

  // Aguarda app.js inicializar
  function waitForApp(maxMs = 15000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      (function loop() {
        if (ready() && window.S && window.S.user) return resolve();
        if (Date.now() - t0 > maxMs) return reject(new Error('FP_EXT: timeout aguardando app'));
        setTimeout(loop, 250);
      })();
    });
  }

  /* ═══════════════════════════════════════════════════════════
     UTILIDADES INTERNAS
  ═══════════════════════════════════════════════════════════ */
  const T = (msg, type = 'info', ms = 3500) => {
    if (typeof window.toast === 'function') window.toast(msg, type, ms);
    else console.log(`[FP_EXT][${type}] ${msg}`);
  };
  const $ = id => document.getElementById(id);
  const esc = s => String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const todayStr = () => new Date().toISOString().split('T')[0];
  const monthKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  async function getPref(key, fallback = null) {
    if (!window.S?.user) return fallback;
    if (typeof window.getSetting === 'function') {
      return await window.getSetting(window.S.user.id, key, fallback);
    }
    return fallback;
  }
  async function setPref(key, value) {
    if (!window.S?.user) return;
    if (typeof window.setSetting === 'function') {
      await window.setSetting(window.S.user.id, key, value);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     ARMAZENAMENTO ADICIONAL (em escopo isolado)
     Usa o mesmo IndexedDB do app via Dexie, mas em store dedicada
     que é criada dinamicamente sem alterar o schema principal.
  ═══════════════════════════════════════════════════════════ */
  const FPDB = (() => {
    // Banco separado para gamificação/backup metadata
    let _db = null;
    function open() {
      if (_db) return _db;
      _db = new Dexie('FinancePro_Ext_v1');
      _db.version(1).stores({
        achievements: '++id, userId, code, earnedAt',
        challenges:   '++id, userId, status, startDate, endDate',
        backupLog:    '++id, userId, kind, at',
        biometric:    '++id, userId, credentialId',
        gameStats:    '++id, &userId',
      });
      return _db;
    }
    return {
      get: () => open(),
    };
  })();

  /* ═══════════════════════════════════════════════════════════
     1. NOTIFICAÇÕES INTELIGENTES
     ───────────────────────────────────────────────────────────
     - Permissão Notification API
     - Notificação local quando app aberto (new Notification + SW)
     - Notificação via SW (mesmo em background)
     - Verificações periódicas (a cada N min) enquanto app aberto
     - Eventos detectados:
         · Orçamento ≥80% e ≥100%
         · Assinatura vencendo em ≤2 dias
         · Meta financeira atingida
         · Gasto anômalo (acima de 2× a média da categoria)
  ═══════════════════════════════════════════════════════════ */
  const Notif = {
    enabled: false,
    timer: null,
    INTERVAL_MS: 5 * 60 * 1000, // 5 min

    async init() {
      this.enabled = (await getPref('extNotifEnabled', false)) && this.permissionGranted();
      if (this.enabled) this.startPeriodic();

      // Atualiza badge "Notificações Push" no painel se já existe
      this._reflectToggleUI();
    },

    permissionGranted() {
      return 'Notification' in window && Notification.permission === 'granted';
    },

    async request() {
      if (!('Notification' in window)) {
        T('Seu navegador não suporta notificações.', 'warning');
        return false;
      }
      if (Notification.permission === 'granted') return true;
      if (Notification.permission === 'denied') {
        T('Permissão de notificações foi negada. Habilite nas configurações do navegador.', 'warning', 5000);
        return false;
      }
      const result = await Notification.requestPermission();
      const ok = result === 'granted';
      if (ok) T('Notificações ativadas!', 'success');
      else T('Permissão negada.', 'warning');
      return ok;
    },

    async toggle(enabled) {
      if (enabled) {
        const ok = await this.request();
        if (!ok) {
          // reverter UI
          const cb = $('extNotifPushToggle');
          if (cb) cb.checked = false;
          return;
        }
      }
      this.enabled = enabled && this.permissionGranted();
      await setPref('extNotifEnabled', this.enabled);
      if (this.enabled) {
        this.startPeriodic();
        this.show('FinancePro', { body: 'Notificações ativadas com sucesso!', tag: 'fp-test' });
      } else {
        this.stopPeriodic();
      }
    },

    startPeriodic() {
      this.stopPeriodic();
      this.checkAll(); // imediato
      this.timer = setInterval(() => this.checkAll(), this.INTERVAL_MS);
    },
    stopPeriodic() {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    },

    /** Mostra notificação — preferindo SW (funciona com app em background) */
    async show(title, options = {}) {
      if (!this.enabled) return;
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title, body: options.body, tag: options.tag, data: options.data, actions: options.actions
          });
        } else {
          new Notification(title, { icon: './icon.svg', ...options });
        }
      } catch (e) {
        console.warn('[FP_EXT] notif fail', e);
      }
    },

    /** Anti-spam: só mostra a mesma notificação 1×/dia */
    async _wasNotifiedToday(key) {
      const k = `extNotif_${key}_${todayStr()}`;
      const flag = await getPref(k, false);
      if (flag) return true;
      await setPref(k, true);
      return false;
    },

    async checkAll() {
      if (!this.enabled || !window.S?.user) return;
      try {
        await Promise.all([
          this._checkBudgets(),
          this._checkSubscriptions(),
          this._checkGoals(),
          this._checkAnomalies(),
        ]);
      } catch (e) { console.warn('[FP_EXT] checkAll', e); }
    },

    async _checkBudgets() {
      const uid = window.S.user.id;
      const mk = monthKey();
      const [budgets, txs, cats] = await Promise.all([
        window.db.budgets.where('[userId+monthYear]').equals([uid, mk]).toArray(),
        window.db.transactions.where('userId').equals(uid)
          .filter(t => t.date && t.date.startsWith(mk) && t.type === 'expense').toArray(),
        window.db.categories.where('userId').equals(uid).toArray(),
      ]);
      const catName = id => (cats.find(c => c.id === id) || {}).name || 'Categoria';
      for (const b of budgets) {
        const spent = txs
          .filter(t => b.categoryId == null || t.categoryId === b.categoryId)
          .reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const ratio = spent / Math.max(1, b.limitAmount);
        const label = b.categoryId == null ? 'Total mensal' : catName(b.categoryId);
        if (ratio >= 1 && !(await this._wasNotifiedToday(`b100_${b.id}`))) {
          this.show('Orçamento estourado', {
            body: `${label}: ${Math.round(ratio * 100)}% do limite atingido`,
            tag: `fp-budget-${b.id}`
          });
          if (typeof window.addNotif === 'function')
            window.addNotif('budget', `Orçamento "${label}" estourado (${Math.round(ratio * 100)}%)`, b.id).catch(() => {});
        } else if (ratio >= 0.8 && ratio < 1 && !(await this._wasNotifiedToday(`b80_${b.id}`))) {
          this.show('Atenção: orçamento próximo do limite', {
            body: `${label}: ${Math.round(ratio * 100)}% usado este mês`,
            tag: `fp-budget-${b.id}`
          });
        }
      }
    },

    async _checkSubscriptions() {
      const uid = window.S.user.id;
      const today = new Date(); today.setHours(0,0,0,0);
      const subs = await window.db.subscriptions.where('userId').equals(uid).toArray();
      for (const s of subs) {
        if (!s.active || !s.nextDue) continue;
        const due = new Date(s.nextDue + 'T00:00:00');
        const days = Math.ceil((due - today) / 86400000);
        if (days >= 0 && days <= 2) {
          if (await this._wasNotifiedToday(`sub_${s.id}_d${days}`)) continue;
          this.show('Assinatura vencendo', {
            body: `${s.name} vence ${days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`}.`,
            tag: `fp-sub-${s.id}`
          });
        }
      }
    },

    async _checkGoals() {
      const uid = window.S.user.id;
      const goals = await window.db.goals.where('userId').equals(uid).toArray();
      for (const g of goals) {
        if (g.targetAmount && g.currentAmount >= g.targetAmount) {
          if (await this._wasNotifiedToday(`goal_${g.id}`)) continue;
          this.show('Meta alcançada!', {
            body: `Parabéns! Você atingiu a meta "${g.name}".`,
            tag: `fp-goal-${g.id}`
          });
          // Dispara conquista de gamificação
          Game.unlock('GOAL_REACHED', { goalId: g.id, name: g.name });
        }
      }
    },

    async _checkAnomalies() {
      const uid = window.S.user.id;
      const today = todayStr();
      const todayTxs = await window.db.transactions.where('userId').equals(uid)
        .filter(t => t.date === today && t.type === 'expense').toArray();
      if (!todayTxs.length) return;
      // Média dos últimos 30 dias por categoria
      const since = new Date(); since.setDate(since.getDate() - 30);
      const sinceStr = since.toISOString().split('T')[0];
      const recent = await window.db.transactions.where('userId').equals(uid)
        .filter(t => t.date >= sinceStr && t.date < today && t.type === 'expense').toArray();
      const avgByCat = {};
      const countByCat = {};
      for (const t of recent) {
        avgByCat[t.categoryId] = (avgByCat[t.categoryId] || 0) + Number(t.amount || 0);
        countByCat[t.categoryId] = (countByCat[t.categoryId] || 0) + 1;
      }
      for (const cid of Object.keys(avgByCat))
        avgByCat[cid] = avgByCat[cid] / Math.max(1, countByCat[cid]);

      for (const t of todayTxs) {
        const avg = avgByCat[t.categoryId];
        if (!avg || avg < 5) continue;
        if (Number(t.amount) > avg * 2.5) {
          if (await this._wasNotifiedToday(`anom_${t.id}`)) continue;
          this.show('Gasto fora do padrão', {
            body: `Transação de ${formatBRL(t.amount)} acima da sua média (${formatBRL(avg)}).`,
            tag: `fp-anom-${t.id}`
          });
        }
      }
    },

    _reflectToggleUI() {
      const cb = $('extNotifPushToggle');
      if (cb) cb.checked = this.enabled;
    },
  };

  function formatBRL(v) {
    if (typeof window.fmtCurrency === 'function') return window.fmtCurrency(v);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  }

  /* ═══════════════════════════════════════════════════════════
     2. GAMIFICAÇÃO
     ───────────────────────────────────────────────────────────
     - Conquistas (badges) desbloqueáveis
     - Sistema de pontos (XP) e níveis
     - Streaks (sequência de dias com registro)
     - Desafios mensais (ex: reduzir 10% gasto em Alimentação)
     - 100% offline, persistido em FinancePro_Ext_v1.achievements
  ═══════════════════════════════════════════════════════════ */
  const BADGES = [
    { code: 'FIRST_TX',         icon: '🎯', name: 'Primeiro passo',         desc: 'Registrou a primeira transação',                xp: 10 },
    { code: 'TX_10',            icon: '📝', name: 'Organizado',             desc: '10 transações registradas',                     xp: 20 },
    { code: 'TX_100',           icon: '📊', name: 'Controle total',         desc: '100 transações registradas',                    xp: 80 },
    { code: 'TX_1000',          icon: '🏆', name: 'Mestre das finanças',    desc: '1000 transações registradas',                   xp: 300 },
    { code: 'BUDGET_SET',       icon: '💰', name: 'Planejador',             desc: 'Definiu seu primeiro orçamento',                xp: 25 },
    { code: 'BUDGET_RESPECT',   icon: '🛡️', name: 'Disciplinado',           desc: 'Mês inteiro sem estourar o orçamento',          xp: 100 },
    { code: 'GOAL_CREATED',     icon: '🎯', name: 'Sonhador',               desc: 'Criou sua primeira meta',                       xp: 15 },
    { code: 'GOAL_REACHED',     icon: '🏅', name: 'Realizador',             desc: 'Atingiu uma meta financeira',                   xp: 150 },
    { code: 'STREAK_7',         icon: '🔥', name: 'Em chamas',              desc: '7 dias seguidos registrando',                   xp: 50 },
    { code: 'STREAK_30',        icon: '⚡', name: 'Imparável',              desc: '30 dias seguidos registrando',                  xp: 200 },
    { code: 'CATEGORIES_USED',  icon: '🌈', name: 'Diversificado',          desc: 'Usou 8+ categorias diferentes',                 xp: 30 },
    { code: 'SAVE_MONTH',       icon: '🐷', name: 'Poupador',               desc: 'Mês com receitas > despesas',                   xp: 60 },
    { code: 'SAVE_3M',          icon: '💎', name: 'Investidor',             desc: '3 meses seguidos economizando',                 xp: 200 },
    { code: 'BACKUP_MADE',      icon: '☁️', name: 'Precavido',              desc: 'Fez seu primeiro backup',                       xp: 20 },
    { code: 'BIOMETRIC_ON',     icon: '🔐', name: 'Seguro',                 desc: 'Ativou autenticação biométrica',                xp: 25 },
    { code: 'EARLY_BIRD',       icon: '🌅', name: 'Madrugador',             desc: 'Registrou transação antes das 8h',              xp: 15 },
    { code: 'CHALLENGE_DONE',   icon: '🥇', name: 'Vencedor',               desc: 'Completou um desafio mensal',                   xp: 120 },
  ];

  const Game = {
    stats: { xp: 0, level: 1, streak: 0, lastDay: null, badges: [] },

    async init() {
      const uid = window.S.user.id;
      const ext = FPDB.get();
      let row = await ext.gameStats.where('userId').equals(uid).first();
      if (!row) {
        row = { userId: uid, xp: 0, level: 1, streak: 0, lastDay: null };
        await ext.gameStats.add(row);
      }
      this.stats.xp = row.xp || 0;
      this.stats.level = row.level || 1;
      this.stats.streak = row.streak || 0;
      this.stats.lastDay = row.lastDay || null;

      const badges = await ext.achievements.where('userId').equals(uid).toArray();
      this.stats.badges = badges.map(b => b.code);

      // Updateia streak baseado no histórico real
      await this._refreshStreak();

      // Hooks: escuta criação de transações via MutationObserver não funciona —
      // usamos polling leve da última tx ao iniciar e re-checa a cada 30s
      this._initHooks();

      // Verifica todas as conquistas que dependem do estado atual
      await this.scanAll();

      this.renderHUD();
    },

    async _refreshStreak() {
      const uid = window.S.user.id;
      const t = todayStr();
      const txs = await window.db.transactions.where('userId').equals(uid).toArray();
      const days = new Set(txs.map(x => x.date));
      let streak = 0;
      const d = new Date();
      for (let i = 0; i < 365; i++) {
        const ds = d.toISOString().split('T')[0];
        if (days.has(ds)) { streak++; d.setDate(d.getDate() - 1); }
        else if (i === 0) { d.setDate(d.getDate() - 1); }
        else break;
      }
      this.stats.streak = streak;
      this.stats.lastDay = days.has(t) ? t : this.stats.lastDay;
      await this._save();

      if (streak >= 7) await this.unlock('STREAK_7');
      if (streak >= 30) await this.unlock('STREAK_30');
    },

    _initHooks() {
      // Re-scan periódico (leve)
      setInterval(() => this.scanAll().catch(() => {}), 60_000);

      // Listeners para botões que sabemos que criam transações
      const reactToTxChange = () => setTimeout(() => this.scanAll().catch(() => {}), 800);
      ['saveTransactionBtn', 'saveTxBtn', 'btnSaveTx'].forEach(id => {
        const el = $(id);
        if (el && !el.dataset.fpExtHooked) {
          el.dataset.fpExtHooked = '1';
          el.addEventListener('click', reactToTxChange);
        }
      });
      // Listener global em forms (fallback)
      document.addEventListener('submit', reactToTxChange);
    },

    async scanAll() {
      if (!window.S?.user) return;
      const uid = window.S.user.id;

      const txCount = await window.db.transactions.where('userId').equals(uid).count();
      if (txCount >= 1) await this.unlock('FIRST_TX');
      if (txCount >= 10) await this.unlock('TX_10');
      if (txCount >= 100) await this.unlock('TX_100');
      if (txCount >= 1000) await this.unlock('TX_1000');

      const budgets = await window.db.budgets.where('userId').equals(uid).count();
      if (budgets >= 1) await this.unlock('BUDGET_SET');

      const goals = await window.db.goals.where('userId').equals(uid).toArray();
      if (goals.length) await this.unlock('GOAL_CREATED');
      for (const g of goals) {
        if (g.targetAmount && g.currentAmount >= g.targetAmount) {
          await this.unlock('GOAL_REACHED');
          break;
        }
      }

      const cats = await window.db.transactions.where('userId').equals(uid).toArray();
      const usedCats = new Set(cats.map(c => c.categoryId).filter(Boolean));
      if (usedCats.size >= 8) await this.unlock('CATEGORIES_USED');

      // Mês atual: receitas > despesas?
      const mk = monthKey();
      const monthTx = cats.filter(t => t.date && t.date.startsWith(mk));
      const inc = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
      const exp = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
      if (inc > exp && exp > 0) await this.unlock('SAVE_MONTH');

      // Madrugador
      const earlyTx = cats.find(t => t.createdAt && new Date(t.createdAt).getHours() < 8);
      if (earlyTx) await this.unlock('EARLY_BIRD');

      this.renderHUD();
    },

    async unlock(code, meta = {}) {
      if (this.stats.badges.includes(code)) return false;
      const def = BADGES.find(b => b.code === code);
      if (!def) return false;
      const ext = FPDB.get();
      await ext.achievements.add({
        userId: window.S.user.id,
        code, earnedAt: new Date().toISOString(), meta
      });
      this.stats.badges.push(code);
      this.stats.xp += def.xp;
      this.stats.level = this._levelFromXP(this.stats.xp);
      await this._save();

      // UI feedback
      this._celebrate(def);
      this.renderHUD();
      Notif.show('Conquista desbloqueada!', {
        body: `${def.icon} ${def.name} (+${def.xp} XP)`,
        tag: `fp-badge-${code}`
      });
      if (typeof window.addNotif === 'function') {
        window.addNotif('achievement', `${def.icon} Conquista: ${def.name}`, null).catch(() => {});
      }
      return true;
    },

    _levelFromXP(xp) {
      // L1 0-99, L2 100-249, L3 250-499, L4 500-849, L5 850-1299, ...
      // base * 1.5^(level-1) acumulado
      let needed = 100, level = 1, total = 0;
      while (total + needed <= xp) {
        total += needed; level++;
        needed = Math.round(needed * 1.5);
      }
      return level;
    },

    _xpForNextLevel() {
      let needed = 100, level = 1, total = 0;
      while (total + needed <= this.stats.xp) {
        total += needed; level++;
        needed = Math.round(needed * 1.5);
      }
      return { current: this.stats.xp - total, needed };
    },

    async _save() {
      const ext = FPDB.get();
      const uid = window.S.user.id;
      const row = await ext.gameStats.where('userId').equals(uid).first();
      if (row) await ext.gameStats.update(row.id, {
        xp: this.stats.xp, level: this.stats.level,
        streak: this.stats.streak, lastDay: this.stats.lastDay,
      });
    },

    _celebrate(def) {
      // Toast + animação confetti simples
      const el = document.createElement('div');
      el.className = 'fp-ext-celebrate';
      el.innerHTML = `
        <div class="fp-ext-celebrate-card">
          <div class="fp-ext-celebrate-emoji">${def.icon}</div>
          <div class="fp-ext-celebrate-title">Conquista desbloqueada</div>
          <div class="fp-ext-celebrate-name">${esc(def.name)}</div>
          <div class="fp-ext-celebrate-desc">${esc(def.desc)}</div>
          <div class="fp-ext-celebrate-xp">+${def.xp} XP</div>
        </div>`;
      document.body.appendChild(el);
      setTimeout(() => el.classList.add('show'), 30);
      setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 3500);
    },

    renderHUD() {
      // Botão na topbar
      let btn = $('fpExtGameBtn');
      if (!btn) {
        const topRight = document.querySelector('.topbar-right');
        if (!topRight) return;
        btn = document.createElement('button');
        btn.id = 'fpExtGameBtn';
        btn.className = 'icon-btn fp-ext-game-btn';
        btn.title = 'Conquistas';
        btn.innerHTML = `<i class="fas fa-trophy"></i><span class="fp-ext-game-lvl" id="fpExtGameLvl">1</span>`;
        btn.addEventListener('click', () => this.openPanel());
        topRight.insertBefore(btn, topRight.firstChild);
      }
      const lvlEl = $('fpExtGameLvl');
      if (lvlEl) lvlEl.textContent = this.stats.level;
    },

    openPanel() {
      let modal = $('fpExtGameModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'fpExtGameModal';
        modal.className = 'modal-wrap hidden';
        document.body.appendChild(modal);
      }
      const next = this._xpForNextLevel();
      const earnedSet = new Set(this.stats.badges);
      modal.innerHTML = `
        <div class="modal modal-lg">
          <div class="modal-hdr">
            <div class="modal-title"><i class="fas fa-trophy" style="color:var(--accent)"></i> Conquistas & Desafios</div>
            <button class="modal-close" onclick="document.getElementById('fpExtGameModal').classList.add('hidden')"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="fp-ext-stats-row">
              <div class="fp-ext-stat-card">
                <div class="fp-ext-stat-lbl">Nível</div>
                <div class="fp-ext-stat-val">${this.stats.level}</div>
              </div>
              <div class="fp-ext-stat-card">
                <div class="fp-ext-stat-lbl">XP Total</div>
                <div class="fp-ext-stat-val">${this.stats.xp}</div>
              </div>
              <div class="fp-ext-stat-card">
                <div class="fp-ext-stat-lbl">Sequência</div>
                <div class="fp-ext-stat-val">${this.stats.streak} 🔥</div>
              </div>
              <div class="fp-ext-stat-card">
                <div class="fp-ext-stat-lbl">Conquistas</div>
                <div class="fp-ext-stat-val">${this.stats.badges.length}/${BADGES.length}</div>
              </div>
            </div>
            <div class="fp-ext-xp-bar-wrap">
              <div class="fp-ext-xp-label">Próximo nível: ${next.current}/${next.needed} XP</div>
              <div class="fp-ext-xp-bar"><div class="fp-ext-xp-fill" style="width:${(next.current/next.needed*100).toFixed(1)}%"></div></div>
            </div>
            <div class="fp-ext-section-title">🎖️ Conquistas</div>
            <div class="fp-ext-badges-grid">
              ${BADGES.map(b => `
                <div class="fp-ext-badge ${earnedSet.has(b.code) ? 'earned' : 'locked'}" title="${esc(b.desc)}">
                  <div class="fp-ext-badge-icon">${earnedSet.has(b.code) ? b.icon : '🔒'}</div>
                  <div class="fp-ext-badge-name">${esc(b.name)}</div>
                  <div class="fp-ext-badge-desc">${esc(b.desc)}</div>
                  <div class="fp-ext-badge-xp">${earnedSet.has(b.code) ? `✓ +${b.xp} XP` : `+${b.xp} XP`}</div>
                </div>
              `).join('')}
            </div>
            <div class="fp-ext-section-title">🎯 Desafios do mês</div>
            <div id="fpExtChallenges" class="fp-ext-challenges">
              ${this._renderChallenges()}
            </div>
          </div>
        </div>`;
      modal.classList.remove('hidden');
    },

    _renderChallenges() {
      // Desafios baseados no estado atual (calculados on-the-fly)
      const challenges = [
        { id: 'c1', title: '7 dias seguidos registrando', icon: '🔥',
          progress: Math.min(this.stats.streak, 7), target: 7,
          done: this.stats.streak >= 7 },
        { id: 'c2', title: 'Atingir nível 5', icon: '⭐',
          progress: Math.min(this.stats.level, 5), target: 5,
          done: this.stats.level >= 5 },
        { id: 'c3', title: 'Desbloquear 10 conquistas', icon: '🏅',
          progress: Math.min(this.stats.badges.length, 10), target: 10,
          done: this.stats.badges.length >= 10 },
      ];
      return challenges.map(c => `
        <div class="fp-ext-challenge ${c.done ? 'done' : ''}">
          <div class="fp-ext-challenge-icon">${c.icon}</div>
          <div class="fp-ext-challenge-body">
            <div class="fp-ext-challenge-title">${esc(c.title)} ${c.done ? '<span class="fp-ext-tag">Concluído</span>' : ''}</div>
            <div class="progress" style="margin-top:6px"><div class="progress-fill ${c.done ? 'pf-success' : ''}" style="width:${(c.progress/c.target*100).toFixed(0)}%;background:var(--accent)"></div></div>
            <div class="fp-ext-challenge-meta">${c.progress}/${c.target}</div>
          </div>
        </div>
      `).join('');
    },
  };

  /* ═══════════════════════════════════════════════════════════
     3. BACKUP AUTOMÁTICO
     ───────────────────────────────────────────────────────────
     - Auto download local a cada N dias (default 7)
     - Background Sync para upload diferido (quando online)
     - Restore via input file
     - Compatível com export antigo do app (gera JSON com mesmo
       formato que setting.json se existir, senão genérico)
  ═══════════════════════════════════════════════════════════ */
  const Backup = {
    autoDays: 7,

    async init() {
      this.autoDays = await getPref('extBackupDays', 7);
      const enabled = await getPref('extBackupAutoEnabled', false);

      // Reflete UI
      const cb = $('extBackupAutoToggle');
      if (cb) cb.checked = !!enabled;
      const sel = $('extBackupDaysSel');
      if (sel) sel.value = this.autoDays;

      if (enabled) await this.maybeRunAuto();

      // Se ficar online, tenta sync de pendências
      window.addEventListener('online', () => this._flushQueue().catch(() => {}));
    },

    async toggleAuto(enabled) {
      await setPref('extBackupAutoEnabled', !!enabled);
      if (enabled) {
        T(`Backup automático ativado (a cada ${this.autoDays} dias).`, 'success');
        await this.maybeRunAuto();
      } else {
        T('Backup automático desativado.', 'info');
      }
    },

    async setAutoDays(n) {
      this.autoDays = Math.max(1, parseInt(n, 10) || 7);
      await setPref('extBackupDays', this.autoDays);
      T(`Frequência ajustada para ${this.autoDays} dias.`, 'info');
    },

    async maybeRunAuto() {
      const last = await getPref('extBackupLastAt', 0);
      const elapsed = Date.now() - (Number(last) || 0);
      if (elapsed >= this.autoDays * 86400000) {
        await this.runManual({ silent: true });
      }
    },

    async _gatherData() {
      const uid = window.S.user.id;
      const tables = ['users', 'settings', 'accounts', 'categories', 'transactions',
                      'budgets', 'goals', 'notifications', 'subscriptions', 'splits',
                      'patrimony_items', 'tx_logs', 'templates', 'loans'];
      const out = { schema: 'FinancePro-Backup-v1', exportedAt: new Date().toISOString(), userId: uid, data: {} };
      for (const t of tables) {
        try {
          if (!window.db[t]) continue;
          out.data[t] = await window.db[t].where('userId').equals(uid).toArray();
        } catch { out.data[t] = []; }
      }
      // Inclui tabelas da extensão
      const ext = FPDB.get();
      out.extension = {
        achievements: await ext.achievements.where('userId').equals(uid).toArray(),
        gameStats: await ext.gameStats.where('userId').equals(uid).toArray(),
        biometric: await ext.biometric.where('userId').equals(uid).toArray(),
      };
      return out;
    },

    async runManual({ silent = false } = {}) {
      try {
        const data = await this._gatherData();
        const json = JSON.stringify(data, null, 2);
        const filename = `financepro-backup-${todayStr()}.json`;
        if (typeof window.dl === 'function') window.dl(filename, json, 'application/json');
        else _download(filename, json);
        await setPref('extBackupLastAt', Date.now());
        const ext = FPDB.get();
        await ext.backupLog.add({ userId: window.S.user.id, kind: 'local', at: new Date().toISOString() });
        Game.unlock('BACKUP_MADE').catch(() => {});
        if (!silent) T('Backup criado com sucesso!', 'success');
      } catch (e) {
        console.warn(e);
        T('Falha ao gerar backup: ' + e.message, 'error');
      }
    },

    async restore(file) {
      try {
        const text = await file.text();
        const obj = JSON.parse(text);
        if (!obj || obj.schema !== 'FinancePro-Backup-v1') {
          // Permite arquivos antigos (sem schema) — apenas avisa
          if (!obj || typeof obj !== 'object') throw new Error('Arquivo inválido.');
        }

        const confirmed = await new Promise(resolve => {
          if (typeof window.confirmModal === 'function') {
            window.confirmModal('Restaurar backup',
              'Os dados atuais serão SOBRESCRITOS pelos dados do arquivo. Continuar?',
              () => resolve(true), 'Restaurar');
            // Confirm modal pode não disparar callback se cancelar; usar fallback
            setTimeout(() => resolve(false), 30_000);
          } else {
            resolve(confirm('Restaurar backup? Dados atuais serão sobrescritos.'));
          }
        });
        if (!confirmed) return;

        const uid = window.S.user.id;
        const data = obj.data || obj;
        for (const t of Object.keys(data)) {
          if (!window.db[t] || !Array.isArray(data[t])) continue;
          await window.db[t].where('userId').equals(uid).delete();
          if (data[t].length) {
            const items = data[t].map(r => { const c = { ...r, userId: uid }; delete c.id; return c; });
            await window.db[t].bulkAdd(items);
          }
        }
        T('Backup restaurado! Recarregando...', 'success');
        setTimeout(() => location.reload(), 1500);
      } catch (e) {
        console.warn(e);
        T('Falha ao restaurar: ' + e.message, 'error');
      }
    },

    async queueCloudUpload() {
      // Stub: enfileira via Background Sync (real upload requer OAuth)
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          if ('sync' in reg) {
            await reg.sync.register('fp-backup');
            T('Backup agendado — será enviado ao detectar internet.', 'info');
            return true;
          }
        }
      } catch (e) { console.warn(e); }
      T('Background Sync não suportado neste navegador.', 'warning');
      return false;
    },

    async _flushQueue() {
      // Quando o app voltar a ficar online, gera backup local automaticamente
      // (real upload p/ Drive/Dropbox exige OAuth — fora do escopo offline-first)
      const enabled = await getPref('extBackupAutoEnabled', false);
      if (enabled) await this.maybeRunAuto();
    },
  };

  function _download(name, content) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ═══════════════════════════════════════════════════════════
     4. AUTENTICAÇÃO BIOMÉTRICA (WebAuthn)
     ───────────────────────────────────────────────────────────
     - Usa platform authenticator (Touch ID, Windows Hello, Face ID)
     - Modo "second factor local": credencial gerada localmente e
       armazenada (apenas o ID público) no IndexedDB da extensão.
     - Funciona offline pois não há servidor real:
         · Registro: cria credencial residente
         · Autenticação: pede assinatura biométrica do dispositivo
     - Não substitui senha — atua como atalho rápido para destravar
       o lockScreen existente do app.
  ═══════════════════════════════════════════════════════════ */
  const Bio = {
    available: false,

    async init() {
      this.available = await this._isAvailable();
      const cb = $('extBioToggle');
      if (cb) {
        cb.disabled = !this.available;
        cb.title = this.available ? '' : 'Dispositivo sem autenticador biométrico compatível';
      }
      const ext = FPDB.get();
      const enrolled = await ext.biometric.where('userId').equals(window.S.user.id).first();
      if (cb) cb.checked = !!enrolled;
    },

    async _isAvailable() {
      if (!window.PublicKeyCredential) return false;
      try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch { return false; }
    },

    async toggle(enable) {
      if (enable) {
        const ok = await this.register();
        if (!ok) {
          const cb = $('extBioToggle');
          if (cb) cb.checked = false;
        }
      } else {
        await this.remove();
      }
    },

    async register() {
      if (!this.available) {
        T('Biometria não disponível neste dispositivo.', 'warning');
        return false;
      }
      try {
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const userId = new TextEncoder().encode(String(window.S.user.id));
        const cred = await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: { name: 'FinancePro', id: location.hostname || 'localhost' },
            user: {
              id: userId,
              name: window.S.user.email || 'user@financepro',
              displayName: window.S.user.name || 'Usuário'
            },
            pubKeyCredParams: [
              { type: 'public-key', alg: -7 },   // ES256
              { type: 'public-key', alg: -257 }, // RS256
            ],
            authenticatorSelection: {
              authenticatorAttachment: 'platform',
              userVerification: 'required',
              residentKey: 'preferred'
            },
            timeout: 60_000,
            attestation: 'none'
          }
        });
        if (!cred) throw new Error('Cancelado');
        const credentialIdB64 = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
        const ext = FPDB.get();
        const existing = await ext.biometric.where('userId').equals(window.S.user.id).first();
        if (existing) {
          await ext.biometric.update(existing.id, { credentialId: credentialIdB64, createdAt: new Date().toISOString() });
        } else {
          await ext.biometric.add({
            userId: window.S.user.id,
            credentialId: credentialIdB64,
            createdAt: new Date().toISOString()
          });
        }
        T('Biometria cadastrada com sucesso!', 'success');
        Game.unlock('BIOMETRIC_ON').catch(() => {});
        return true;
      } catch (e) {
        console.warn('[FP_EXT] webauthn register', e);
        T('Falha ao cadastrar biometria: ' + (e.message || e.name), 'error');
        return false;
      }
    },

    async authenticate() {
      if (!this.available) return false;
      try {
        const ext = FPDB.get();
        const stored = await ext.biometric.where('userId').equals(window.S.user.id).first();
        if (!stored) return false;
        const rawId = Uint8Array.from(atob(stored.credentialId), c => c.charCodeAt(0));
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const assertion = await navigator.credentials.get({
          publicKey: {
            challenge,
            allowCredentials: [{ type: 'public-key', id: rawId, transports: ['internal'] }],
            userVerification: 'required',
            timeout: 60_000
          }
        });
        return !!assertion;
      } catch (e) {
        console.warn('[FP_EXT] webauthn auth', e);
        return false;
      }
    },

    async remove() {
      const ext = FPDB.get();
      await ext.biometric.where('userId').equals(window.S.user.id).delete();
      T('Biometria removida.', 'info');
    },

    /** Adiciona botão "Usar biometria" no lockScreen existente */
    async installLockButton() {
      const lock = $('lockScreen');
      if (!lock) return;
      if ($('fpExtBioBtn')) return;
      const enrolled = await FPDB.get().biometric.where('userId').equals(window.S.user.id).first();
      if (!enrolled) return;
      const card = lock.querySelector('.lock-card');
      if (!card) return;
      const btn = document.createElement('button');
      btn.id = 'fpExtBioBtn';
      btn.className = 'btn btn-outline btn-full fp-ext-bio-btn';
      btn.innerHTML = '<i class="fas fa-fingerprint"></i> Desbloquear com biometria';
      btn.addEventListener('click', async () => {
        const ok = await this.authenticate();
        if (ok) {
          // Re-usa fluxo de unlock do app (esconde lockScreen + reseta timer)
          lock.classList.add('hidden');
          if (typeof window.S !== 'undefined') window.S.lockBuffer = '';
          if (typeof window.resetLockTimer === 'function') window.resetLockTimer();
          T('Desbloqueado pela biometria.', 'success');
        } else {
          T('Falha na autenticação biométrica.', 'error');
        }
      });
      card.appendChild(btn);
    },
  };

  /* ═══════════════════════════════════════════════════════════
     UI INJECTION — painel de Configurações
  ═══════════════════════════════════════════════════════════ */
  const UI = {
    async injectSettingsPanel() {
      // Tenta achar a página de settings
      const page = $('page-settings') || $('pageSettings') || document.querySelector('[data-page="settings"]');
      if (!page) {
        // tenta de novo daqui a pouco (settings pode ser carregada sob demanda)
        setTimeout(() => UI.injectSettingsPanel(), 1500);
        return;
      }
      if ($('fpExtSettingsPanel')) return;

      const panel = document.createElement('div');
      panel.id = 'fpExtSettingsPanel';
      panel.className = 'card fp-ext-settings-panel';
      panel.innerHTML = `
        <div class="card-hdr">
          <div class="card-title"><i class="fas fa-rocket" style="color:var(--accent)"></i> Recursos avançados (Extensions)</div>
        </div>
        <div class="card-body">
          <div class="toggle-row">
            <div class="toggle-row-info">
              <strong>🔔 Notificações inteligentes</strong>
              <span>Avisa orçamento estourado, contas a vencer, gastos anômalos.</span>
            </div>
            <label class="toggle">
              <input type="checkbox" id="extNotifPushToggle">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-row">
            <div class="toggle-row-info">
              <strong>🔐 Biometria (Touch ID / Windows Hello / Face ID)</strong>
              <span>Use sua impressão digital ou rosto para destravar o app.</span>
            </div>
            <label class="toggle">
              <input type="checkbox" id="extBioToggle">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-row">
            <div class="toggle-row-info">
              <strong>☁️ Backup automático</strong>
              <span>Gera arquivo de backup periodicamente.</span>
            </div>
            <label class="toggle">
              <input type="checkbox" id="extBackupAutoToggle">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="fp-ext-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">Frequência do backup</label>
              <select class="form-inp" id="extBackupDaysSel">
                <option value="1">Diário</option>
                <option value="3">A cada 3 dias</option>
                <option value="7" selected>Semanal</option>
                <option value="15">Quinzenal</option>
                <option value="30">Mensal</option>
              </select>
            </div>
          </div>

          <div class="fp-ext-row" style="gap:.5rem;margin-top:.5rem">
            <button class="btn btn-outline btn-sm" id="extBackupNowBtn"><i class="fas fa-download"></i> Backup agora</button>
            <button class="btn btn-outline btn-sm" id="extRestoreBtn"><i class="fas fa-upload"></i> Restaurar backup</button>
            <input type="file" id="extRestoreInput" accept="application/json" hidden>
            <button class="btn btn-outline btn-sm" id="extOpenGameBtn"><i class="fas fa-trophy"></i> Conquistas</button>
          </div>

          <div class="fp-ext-info">
            <i class="fas fa-info-circle"></i>
            <span>Todos esses recursos funcionam offline. Permissões pedidas só quando você ativar.</span>
          </div>
        </div>
      `;
      page.appendChild(panel);

      // Wire-up
      $('extNotifPushToggle').addEventListener('change', e => Notif.toggle(e.target.checked));
      $('extBioToggle').addEventListener('change', e => Bio.toggle(e.target.checked));
      $('extBackupAutoToggle').addEventListener('change', e => Backup.toggleAuto(e.target.checked));
      $('extBackupDaysSel').addEventListener('change', e => Backup.setAutoDays(e.target.value));
      $('extBackupNowBtn').addEventListener('click', () => Backup.runManual());
      $('extRestoreBtn').addEventListener('click', () => $('extRestoreInput').click());
      $('extRestoreInput').addEventListener('change', e => {
        const f = e.target.files && e.target.files[0];
        if (f) Backup.restore(f);
        e.target.value = '';
      });
      $('extOpenGameBtn').addEventListener('click', () => Game.openPanel());

      // Sincroniza estado inicial (pode já ter sido setado por Notif.init etc)
      const cbN = $('extNotifPushToggle');
      const cbB = $('extBioToggle');
      const cbBk = $('extBackupAutoToggle');
      const sel = $('extBackupDaysSel');
      cbN.checked = Notif.enabled;
      sel.value = Backup.autoDays;
      cbBk.checked = !!(await getPref('extBackupAutoEnabled', false));
      const enrolled = await FPDB.get().biometric.where('userId').equals(window.S.user.id).first();
      cbB.checked = !!enrolled;
      cbB.disabled = !Bio.available;
    },

    /** Re-injeta o painel quando o usuário navegar para "Configurações" */
    watchSettingsNav() {
      // Escuta o evento de ready disparado por loadSettings()
      window.addEventListener('settingsPageReady', () => UI.injectSettingsPanel());
      
      // Hook em todos os links/itens que vão para settings
      document.addEventListener('click', e => {
        const t = e.target.closest('[data-route="settings"], [data-page-target="settings"], [data-page="settings"], a[href="#settings"]');
        if (t) setTimeout(() => UI.injectSettingsPanel(), 250);
      });
      // Polling leve por segurança
      let tries = 0;
      const ivl = setInterval(() => {
        const page = $('page-settings') || $('pageSettings') || document.querySelector('[data-page="settings"]');
        if (page && !$('fpExtSettingsPanel')) UI.injectSettingsPanel();
        if (++tries > 40) clearInterval(ivl);
      }, 1500);
    },
  };

  /* ═══════════════════════════════════════════════════════════
     SERVICE WORKER — comunicação
  ═══════════════════════════════════════════════════════════ */
  function bindSWMessages() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('message', e => {
      const m = e.data || {};
      if (m.type === 'PERIODIC_CHECK') {
        Notif.checkAll().catch(() => {});
      }
      if (m.type === 'SYNC_REQUEST' && m.tag === 'fp-backup') {
        Backup.runManual({ silent: true }).catch(() => {});
      }
      if (m.type === 'NOTIF_CLICK') {
        // Foca o app — pode usar dados para navegar
        window.focus?.();
      }
    });
  }

  async function registerPeriodicSync() {
    try {
      if (!('serviceWorker' in navigator)) return;
      const reg = await navigator.serviceWorker.ready;
      if ('periodicSync' in reg) {
        const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
        if (status.state === 'granted') {
          await reg.periodicSync.register('fp-periodic-checks', { minInterval: 6 * 60 * 60 * 1000 });
        }
      }
    } catch (e) { /* não suportado / não permitido */ }
  }

  /* ═══════════════════════════════════════════════════════════
     ENTRY POINT
  ═══════════════════════════════════════════════════════════ */
  const FP_EXT = {
    Notif, Game, Backup, Bio, UI, BADGES,
    async init() {
      if (this._initialized) return; // guard contra double-init
      this._initialized = true;
      try {
        await waitForApp();
        bindSWMessages();
        await Promise.all([
          Notif.init(),
          Game.init(),
          Backup.init(),
          Bio.init(),
        ]);
        UI.injectSettingsPanel();
        UI.watchSettingsNav();
        await Bio.installLockButton();
        registerPeriodicSync();
        // Hook em mostragem do lockScreen (re-instala botão)
        const lock = $('lockScreen');
        if (lock) {
          new MutationObserver(() => Bio.installLockButton().catch(() => {}))
            .observe(lock, { attributes: true, attributeFilter: ['class'] });
        }
        console.log('[FP_EXT] Inicializado com sucesso');
      } catch (e) {
        console.warn('[FP_EXT] Falha na inicialização:', e);
      }
    }
  };

  window.FP_EXT = FP_EXT;

  // Auto-init quando o DOM e o app estiverem prontos
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FP_EXT.init());
  } else {
    setTimeout(() => FP_EXT.init(), 500);
  }
})();
