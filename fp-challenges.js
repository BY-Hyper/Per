/* =====================================================================
   FINANCEPRO — DESAFIOS & CONQUISTAS v2
   Dados reais, streak calendar, conquistas automáticas.
   Expõe: window.FP_GAMIFICATION  window.loadChallenges
===================================================================== */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const fmt = v => typeof window.fmtCurrency === 'function'
    ? window.fmtCurrency(v) : 'R$' + Math.abs(v || 0).toFixed(2).replace('.', ',');
  const T = (m, t = 'success') => typeof window.toast === 'function' && window.toast(m, t, 3500);

  /* ── Conquistas definidas ── */
  const ACHIEVEMENTS = [
    { id: 'first_tx',    icon: '💰', name: 'Primeira transação',   desc: 'Registrou a primeira transação',       xp: 50,  check: d => d.totalTxs >= 1 },
    { id: 'tx_10',       icon: '📊', name: '10 transações',        desc: '10 transações registradas',            xp: 100, check: d => d.totalTxs >= 10 },
    { id: 'tx_50',       icon: '🏅', name: '50 transações',        desc: '50 transações registradas',            xp: 200, check: d => d.totalTxs >= 50 },
    { id: 'tx_100',      icon: '🥇', name: '100 transações',       desc: '100 transações registradas',           xp: 400, check: d => d.totalTxs >= 100 },
    { id: 'budget_set',  icon: '🎯', name: 'Orçamento definido',   desc: 'Criou ao menos 1 limite mensal',       xp: 75,  check: d => d.budgets >= 1 },
    { id: 'budget_3',    icon: '📋', name: 'Mestre do orçamento',  desc: 'Criou 3 ou mais limites mensais',      xp: 150, check: d => d.budgets >= 3 },
    { id: 'goal_set',    icon: '🌟', name: 'Sonhador',             desc: 'Criou uma meta financeira',            xp: 100, check: d => d.goals >= 1 },
    { id: 'saver_10',    icon: '🐷', name: 'Poupador',             desc: 'Mês com taxa de poupança ≥ 10%',       xp: 150, check: d => d.savingRate >= 10 },
    { id: 'saver_20',    icon: '💎', name: 'Poupador Pro',         desc: 'Mês com taxa de poupança ≥ 20%',       xp: 300, check: d => d.savingRate >= 20 },
    { id: 'streak_3',    icon: '🔥', name: 'Sequência de 3',       desc: '3 dias seguidos com registros',        xp: 100, check: d => d.streak >= 3 },
    { id: 'streak_7',    icon: '🌈', name: 'Semana completa',      desc: '7 dias seguidos com registros',        xp: 250, check: d => d.streak >= 7 },
    { id: 'streak_30',   icon: '🚀', name: 'Mês perfeito',         desc: '30 dias seguidos com registros',       xp: 500, check: d => d.streak >= 30 },
    { id: 'cat_rules',   icon: '🤖', name: 'Regras inteligentes',  desc: 'Criou 5 regras de categorização',      xp: 200, check: d => d.rules >= 5 },
    { id: 'import',      icon: '📥', name: 'Importador',           desc: 'Importou um extrato bancário',         xp: 150, check: d => d.imported >= 1 },
    { id: 'positive',    icon: '✅', name: 'Mês positivo',         desc: 'Fechou o mês com saldo positivo',      xp: 200, check: d => d.monthPositive },
    { id: 'categories',  icon: '🏷️',  name: 'Organizado',          desc: 'Tem 5 ou mais categorias configuradas',xp: 75,  check: d => d.catCount >= 5 },
    { id: 'no_overbudget',icon: '🛡️', name: 'Controlado',          desc: 'Nenhum orçamento estourado no mês',    xp: 250, check: d => d.budgets >= 1 && d.overBudget === 0 },
  ];

  /* ── Carrega dados para gerar desafios e conquistar ── */
  async function loadStats() {
    const u = window.S?.user;
    const db = window.db;
    if (!u || !db) return null;
    const uid = u.id;
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    const start = month + '-01';
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const [txs, budgets, goals, cats, rules] = await Promise.all([
      db.transactions.where('userId').equals(uid).toArray(),
      db.budgets.where('userId').equals(uid).toArray().catch(() => []),
      db.goals.where('userId').equals(uid).toArray().catch(() => []),
      db.categories.where('userId').equals(uid).toArray().catch(() => []),
      db.userRules?.where('userId').equals(uid).toArray().catch(() => [] ) || Promise.resolve([]),
    ]);

    const curTxs = txs.filter(t => t.date >= start && t.date <= end);
    const cI = curTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const cE = curTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const savingRate = cI > 0 ? Math.round((cI - cE) / cI * 100) : 0;
    const mBudgets = budgets.filter(b => !b.monthYear || b.monthYear === month);
    const overBudget = mBudgets.filter(b => {
      const sp = curTxs.filter(t => String(t.categoryId) === String(b.categoryId) && t.type === 'expense')
                       .reduce((s, t) => s + t.amount, 0);
      return b.limitAmount > 0 && sp > b.limitAmount;
    }).length;

    // Streak: conta dias consecutivos até hoje com transações
    const txDates = new Set(txs.map(t => t.date.slice(0, 10)));
    let streak = 0;
    const d = new Date(now);
    while (txDates.has(d.toISOString().slice(0, 10))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }

    // Últimos 60 dias para calendar heatmap
    const last60 = {};
    for (let i = 59; i >= 0; i--) {
      const dd = new Date(now);
      dd.setDate(dd.getDate() - i);
      const key = dd.toISOString().slice(0, 10);
      last60[key] = txs.filter(t => t.date.slice(0, 10) === key).length;
    }

    // XP e nível (salvo em settings)
    let xpData = { xp: 0, level: 1, earned: [] };
    try { xpData = await window.getSetting?.(uid, 'fp_gamification', xpData) || xpData; } catch(e) {}

    return {
      uid, txs, curTxs, cI, cE, savingRate,
      totalTxs: txs.length,
      budgets: mBudgets.length,
      overBudget,
      goals: goals.length,
      catCount: cats.filter(c => c.type === 'expense').length,
      cats,
      rules: rules.length,
      imported: txs.filter(t => t.importedAt || t.source === 'import').length,
      monthPositive: cI > cE,
      streak, last60, xpData,
      month,
    };
  }

  /* ── Gera desafios com base nos dados ── */
  function generateChallenges(stats) {
    const { cE, cI, savingRate, curTxs, cats, streak, budgets, goals } = stats;
    const challenges = [];

    // Top categoria de gasto
    const catSpend = {};
    curTxs.filter(t => t.type === 'expense').forEach(t => {
      const c = cats.find(c => String(c.id) === String(t.categoryId));
      if (c) catSpend[c.name] = (catSpend[c.name] || 0) + t.amount;
    });
    const topCat = Object.entries(catSpend).sort((a, b) => b[1] - a[1])[0];
    const now = new Date();
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = dim - now.getDate();

    if (topCat && topCat[1] > 100) {
      const target = topCat[1] * 0.85;
      const progress = Math.max(0, Math.min(100, Math.round((1 - catSpend[topCat[0]] / topCat[1]) * 100 + 15)));
      challenges.push({
        id: 'reduce-top', icon: '✂️', color: '#3b82f6',
        title: `Reduzir ${topCat[0]} em 15%`,
        desc: `Gasto atual: ${fmt(topCat[1])}. Meta: ${fmt(target)}`,
        progress, xp: 200, difficulty: 'Médio',
        done: topCat[1] <= target,
      });
    }

    // Desafio de poupança
    if (cI > 0) {
      const targetRate = Math.max(20, savingRate + 5);
      challenges.push({
        id: 'save-rate', icon: '💰', color: '#10b981',
        title: `Poupar ${targetRate}% da renda`,
        desc: `Taxa atual: ${savingRate}%. Meta: ${targetRate}%`,
        progress: Math.min(100, Math.round(savingRate / targetRate * 100)),
        xp: 300, difficulty: savingRate >= targetRate - 5 ? 'Fácil' : 'Difícil',
        done: savingRate >= targetRate,
      });
    }

    // Desafio de streak
    const streakTarget = streak >= 7 ? 30 : streak >= 3 ? 7 : 3;
    challenges.push({
      id: 'streak', icon: '🔥', color: '#f59e0b',
      title: `Manter ${streakTarget} dias seguidos`,
      desc: `Registre transações todo dia. Streak atual: ${streak} dia${streak !== 1 ? 's' : ''}`,
      progress: Math.min(100, Math.round(streak / streakTarget * 100)),
      xp: streakTarget === 30 ? 500 : streakTarget === 7 ? 250 : 100,
      difficulty: streakTarget === 30 ? 'Difícil' : 'Médio',
      done: streak >= streakTarget,
    });

    // Desafio de orçamentos
    if (budgets === 0) {
      challenges.push({
        id: 'create-budget', icon: '🎯', color: '#8b5cf6',
        title: 'Criar 3 orçamentos mensais',
        desc: 'Defina limites para as principais categorias de gasto.',
        progress: 0, xp: 150, difficulty: 'Fácil', done: false,
        action: { label: 'Ir para Orçamentos', fn: "navigate('budgets')" },
      });
    } else if (stats.overBudget === 0) {
      challenges.push({
        id: 'keep-budget', icon: '🛡️', color: '#10b981',
        title: 'Manter todos os orçamentos',
        desc: `Sem estourar nenhum limite até o fim do mês (${daysLeft} dias restantes)`,
        progress: Math.round((dim - daysLeft) / dim * 100),
        xp: 250, difficulty: 'Médio', done: false,
      });
    }

    // Desafio de meta
    if (goals === 0) {
      challenges.push({
        id: 'create-goal', icon: '🌟', color: '#f59e0b',
        title: 'Criar sua primeira meta',
        desc: 'Defina um objetivo financeiro (viagem, reserva, compra).',
        progress: 0, xp: 100, difficulty: 'Fácil', done: false,
        action: { label: 'Criar meta', fn: "navigate('goals')" },
      });
    }

    // Desafio de transações diárias
    const txToday = stats.last60[new Date().toISOString().slice(0, 10)] || 0;
    if (txToday === 0) {
      challenges.push({
        id: 'tx-today', icon: '📝', color: '#6366f1',
        title: 'Registrar transações hoje',
        desc: 'Mantenha o controle anotando todos os gastos do dia.',
        progress: 0, xp: 50, difficulty: 'Fácil',
        done: txToday > 0,
        action: { label: 'Nova transação', fn: 'openTxModal()' },
      });
    }

    return challenges.slice(0, 5);
  }

  /* ── Verifica e salva conquistas ── */
  async function checkAchievements(stats) {
    const { uid, xpData } = stats;
    const earned = xpData.earned || [];
    let xp = xpData.xp || 0;
    const newlyEarned = [];

    for (const ach of ACHIEVEMENTS) {
      if (earned.includes(ach.id)) continue;
      if (ach.check(stats)) {
        earned.push(ach.id);
        xp += ach.xp;
        newlyEarned.push(ach);
      }
    }

    if (newlyEarned.length > 0) {
      const level = Math.floor(xp / 500) + 1;
      const newXp = { xp, level, earned };
      try { await window.setSetting?.(uid, 'fp_gamification', newXp); } catch(e) {}
      // Celebrar
      newlyEarned.forEach(a => {
        setTimeout(() => T(`🏅 Conquista desbloqueada: ${a.name} (+${a.xp} XP)`, 'success'), 500);
      });
      return { ...stats.xpData, xp, level, earned };
    }
    return { ...stats.xpData, xp, level: Math.floor(xp / 500) + 1, earned };
  }

  /* ── Render — injects complete HTML into page-challenges ── */
  async function render() {
    const zone = $('page-challenges');
    if (!zone) return;
    // Show loading
    zone.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--txt2)"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem"></i><br><br>Calculando desafios...</div>';

    const stats = await loadStats();
    if (!stats) {
      zone.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--txt2)">Faça login para ver desafios.</div>';
      return;
    }

    const updatedXp = await checkAchievements(stats);
    stats.xpData = updatedXp;
    const challenges = generateChallenges(stats);
    const earned = updatedXp.earned || [];
    const xpForNext = updatedXp.level * 500;
    const xpPct = Math.min(100, Math.round((updatedXp.xp - (updatedXp.level-1)*500) / xpForNext * 100));

    // Inject all HTML
    zone.innerHTML = `
    <div class="page-hdr">
      <div><h1 class="page-title"><i class="fas fa-trophy" style="color:#f59e0b"></i> Desafios & Conquistas</h1>
      <p class="page-sub">Desafios gerados com base nos seus dados financeiros reais</p></div>
      <button class="btn btn-primary btn-sm" onclick="FP_GAMIFICATION.generateChallenges()"><i class="fas fa-sync"></i> Atualizar</button>
    </div>

    <!-- KPIs -->
    <div class="stats-grid" style="margin-bottom:1rem">
      <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#f59e0b,#d97706)"><i class="fas fa-star"></i></div>
        <div><div class="stat-label">Pontos XP</div><div class="stat-value" id="gamePoints">${updatedXp.xp.toLocaleString('pt-BR')}</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#10b981,#059669)"><i class="fas fa-fire"></i></div>
        <div><div class="stat-label">Streak (dias)</div><div class="stat-value" id="gameStreak">${stats.streak}</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed)"><i class="fas fa-medal"></i></div>
        <div><div class="stat-label">Conquistas</div><div class="stat-value" id="gameAchievements">${earned.length}/${ACHIEVEMENTS.length}</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#3b82f6,#2563eb)"><i class="fas fa-check-double"></i></div>
        <div><div class="stat-label">Desafios completos</div><div class="stat-value" id="gameChallengesDone">${challenges.filter(c=>c.done).length}/${challenges.length}</div></div></div>
    </div>

    <!-- XP Bar -->
    <div class="card" style="padding:.75rem 1rem;margin-bottom:.85rem">
      <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:.3rem">
        <span style="font-weight:700;color:var(--accent)">Nível ${updatedXp.level}</span>
        <span style="color:var(--txt2)">${updatedXp.xp} XP</span>
      </div>
      <div style="height:8px;background:var(--bdr);border-radius:4px;overflow:hidden">
        <div style="width:${xpPct}%;height:100%;background:linear-gradient(90deg,var(--accent),#3b82f6);border-radius:4px;transition:width .6s"></div>
      </div>
    </div>

    <!-- Calendário de streak -->
    <div class="card" style="margin-bottom:.85rem;padding:.85rem 1rem" id="streakCalDiv"></div>

    <!-- Desafios ativos -->
    <div class="card" style="margin-bottom:.85rem">
      <div class="card-hdr"><span class="card-title"><i class="fas fa-bolt" style="color:var(--warning)"></i> Desafios do Mês</span></div>
      <div id="activeChallengesList" style="padding:.5rem 1rem 1rem"></div>
    </div>

    <!-- Conquistas -->
    <div class="card">
      <div class="card-hdr"><span class="card-title"><i class="fas fa-medal" style="color:#f59e0b"></i> Conquistas</span></div>
      <div id="gameXpBar"></div>
      <div id="achievementsList" style="padding:.5rem 1rem 1rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.6rem"></div>
    </div>`;

    renderChallenges(challenges);
    renderAchievements(stats.xpData, updatedXp.xp, updatedXp.level, xpPct);
    renderStreakCalendar(stats.last60, stats.streak);
  }

  function renderChallenges(challenges) {
    const el = $('activeChallengesList');
    if (!el) return;
    if (!challenges.length) {
      el.innerHTML = '<p style="color:var(--txt2);font-size:.83rem;padding:.5rem">Sem dados suficientes para gerar desafios. Adicione transações!</p>';
      return;
    }
    el.innerHTML = challenges.map(ch => `
    <div style="display:flex;align-items:center;gap:.75rem;padding:.75rem 0;border-bottom:1px solid var(--bdr)">
      <div style="width:38px;height:38px;border-radius:10px;background:${ch.color}22;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">${ch.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
          <span style="font-size:.87rem;font-weight:600">${ch.title}</span>
          <span style="font-size:.65rem;padding:1px 7px;border-radius:99px;background:${ch.color}20;color:${ch.color};font-weight:700">${ch.difficulty}</span>
          <span style="font-size:.65rem;padding:1px 7px;border-radius:99px;background:var(--bg-s);color:var(--txt2)">+${ch.xp} XP</span>
          ${ch.done ? '<span style="font-size:.65rem;padding:1px 7px;border-radius:99px;background:#dcfce7;color:#15803d;font-weight:700">✓ COMPLETO</span>' : ''}
        </div>
        <div style="font-size:.75rem;color:var(--txt2);margin:.2rem 0 .4rem">${ch.desc}</div>
        <div style="height:6px;background:var(--bdr);border-radius:3px;overflow:hidden">
          <div style="width:${ch.progress}%;height:100%;background:${ch.done ? '#10b981' : ch.color};border-radius:3px;transition:width .6s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.68rem;color:var(--txt2);margin-top:2px">
          <span>${ch.progress}%</span>
          ${ch.action ? `<button onclick="${ch.action.fn}" style="background:none;border:none;color:${ch.color};font-size:.72rem;cursor:pointer;font-weight:600">${ch.action.label} →</button>` : ''}
        </div>
      </div>
    </div>`).join('');
  }

  function renderAchievements(xpData, xp, level, xpPct) {
    const el = $('achievementsList');
    if (!el) return;
    const earned = xpData.earned || [];

    // XP bar no topo da seção
    const hdr = el.previousElementSibling;
    if (hdr) {
      const xpBar = document.getElementById('gameXpBar') || (() => {
        const div = document.createElement('div');
        div.id = 'gameXpBar';
        div.style.cssText = 'padding:.5rem 1rem;border-bottom:1px solid var(--bdr)';
        hdr.after(div);
        return div;
      })();
      xpBar.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;font-size:.78rem;margin-bottom:.3rem">
          <span style="font-weight:700;color:var(--accent)">Nível ${level}</span>
          <span style="color:var(--txt2)">${xp} / ${level * 500} XP</span>
        </div>
        <div style="height:8px;background:var(--bdr);border-radius:4px;overflow:hidden">
          <div style="width:${xpPct}%;height:100%;background:linear-gradient(90deg,var(--accent),#3b82f6);border-radius:4px;transition:width .6s"></div>
        </div>
        <div style="font-size:.72rem;color:var(--txt2);margin-top:.2rem">${earned.length}/${ACHIEVEMENTS.length} conquistas</div>`;
    }

    el.innerHTML = ACHIEVEMENTS.map(a => {
      const isEarned = earned.includes(a.id);
      return `<div style="padding:.75rem;border-radius:10px;border:1.5px solid ${isEarned ? 'var(--accent)' : 'var(--bdr)'};background:${isEarned ? 'rgba(var(--accent-rgb),.05)' : 'var(--bg-s)'};opacity:${isEarned ? 1 : 0.5};transition:all .2s">
        <div style="font-size:1.6rem;margin-bottom:.25rem">${a.icon}</div>
        <div style="font-size:.82rem;font-weight:700;color:${isEarned ? 'var(--txt)' : 'var(--txt2)'}">${a.name}</div>
        <div style="font-size:.72rem;color:var(--txt2);margin:.15rem 0">${a.desc}</div>
        <div style="font-size:.7rem;font-weight:700;color:${isEarned ? 'var(--accent)' : 'var(--txt3)'}">+${a.xp} XP${isEarned ? ' ✓' : ''}</div>
      </div>`;
    }).join('');
  }

  function renderStreakCalendar(last60, streak) {
    // Use the streakCalDiv container already injected by render()
    const container = $('streakCalDiv');
    if (!container) return;
    container.innerHTML = `<div class="card-hdr"><span class="card-title"><i class="fas fa-fire" style="color:#f59e0b"></i> Calendário de Atividade</span><span style="font-size:.78rem;color:var(--txt2)">Streak atual: <strong style="color:#f59e0b">${streak} dia${streak !== 1 ? 's' : ''}</strong></span></div><div id="streakCalendar" style="padding:.75rem 1rem"></div>`;
    let calEl = $('streakCalendar');
    if (!calEl) return;

    const entries = Object.entries(last60);
    const weeks = [];
    let week = [];
    entries.forEach(([date, count], i) => {
      const d = new Date(date + 'T12:00:00');
      if (i === 0) {
        // Pad with empty days
        const dow = d.getDay();
        for (let p = 0; p < dow; p++) week.push(null);
      }
      week.push({ date, count });
      if (week.length === 7) { weeks.push(week); week = []; }
    });
    if (week.length) weeks.push(week);

    calEl.innerHTML = `
      <div style="display:flex;gap:2px;flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px">
        ${weeks.map(w => `
          <div style="display:flex;flex-direction:column;gap:2px">
            ${w.map(d => d ? `
              <div title="${d.date}: ${d.count} transação${d.count !== 1 ? 'ões' : ''}"
                style="width:12px;height:12px;border-radius:2px;background:${d.count === 0 ? 'var(--bdr)' : d.count >= 3 ? 'var(--success)' : d.count >= 1 ? '#86efac' : 'var(--bdr)'}"></div>
            ` : '<div style="width:12px;height:12px"></div>').join('')}
          </div>`).join('')}
      </div>
      <div style="display:flex;gap:.5rem;align-items:center;font-size:.7rem;color:var(--txt2);margin-top:.4rem">
        <span>Menos</span>
        ${['var(--bdr)','#86efac','#22c55e','var(--success)'].map(c =>
          `<div style="width:10px;height:10px;border-radius:2px;background:${c}"></div>`).join('')}
        <span>Mais</span>
      </div>`;
  }

  /* ── API pública ── */
  const FP_GAMIFICATION = {
    render,
    generateChallenges: async () => { await render(); T('Desafios atualizados!', 'info'); },
  };

  window.FP_GAMIFICATION = FP_GAMIFICATION;
  window.loadChallenges = async function () {
    const u = window.S?.user;
    if (!u) { setTimeout(window.loadChallenges, 500); return; }
    await render();
  };


/* ── Auto-init: render when page becomes active ── */
(function autoInit() {
  const pageId = 'page-challenges';
  const loadFn = 'loadChallenges';
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
      if (page === 'challenges') {
        setTimeout(() => { const fn = window[loadFn]; if (typeof fn === 'function') fn(); }, 150);
      }
      return r;
    };
  }
})();

})();