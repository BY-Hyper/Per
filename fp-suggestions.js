/* fp-suggestions.js — adaptive AI advisor + assistant glue */
(function(){'use strict';
const waitFor = async (fn, attempts=60, delay=200) => {let i=0; while(i++<attempts){ try{ if(fn()) return true;}catch{} await new Promise(r=>setTimeout(r,delay)); } return false; };
const dayMs = 24 * 60 * 60 * 1000;
const fmtMoney = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value) || 0);
const escapeHtml = str => String(str || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const normDesc = d => String(d||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

async function init(){
  const ready = await waitFor(()=>window.EventBus && window.db && window.S && typeof window.navigate === 'function');
  if(!ready) return console.warn('[FP-ADV] deps not ready');

  const getUid = () => window.S?.user?.id || 1;
  const qCount = (items) => Number(items?.length || 0);
  const getPanel = () => document.getElementById('aiSuggestionsPanel');
  const getAssistantCard = () => document.getElementById('dashAIAssistant');
  const getCountBadge = () => document.getElementById('suggCount');

  function appendChat(role, text){
    const msgs = document.getElementById('aiChatMsgs');
    if(!msgs) return;
    const item = document.createElement('div');
    item.className = 'ai-chat-msg ai-chat-msg-' + role;
    item.style.cssText = 'padding:.85rem 1rem;border-radius:12px;margin-bottom:.6rem;max-width:90%;line-height:1.4;';
    if(role==='user') item.style.cssText += 'margin-left:auto;background:rgba(59,130,246,.12);color:var(--txt);';
    else item.style.cssText += 'background:rgba(16,185,129,.1);color:var(--txt);';
    item.textContent = text;
    msgs.appendChild(item);
    msgs.scrollTop = msgs.scrollHeight;
    return item;
  }

  function renderSuggestions(items){
    const panel = getPanel();
    const badge = getCountBadge();
    if(badge) badge.style.display = 'inline-block';
    if(badge) badge.textContent = `${qCount(items)} sugestão(ões)`;
    if(!panel) return;

    if(!items || !items.length){
      panel.innerHTML = '<div class="card-body" style="padding:1rem;color:var(--txt2)">Nenhuma sugestão urgente no momento. Continue refinando seus gastos para ver recomendações mais precisas.</div>';
      return;
    }

    panel.innerHTML = `<div class="card-body" style="display:grid;gap:1rem;padding:1rem;">
      ${items.map(item => `
        <div class="card suggestion-item" style="padding:1rem;border:1px solid var(--bdr);background:var(--bg-s);box-shadow:0 0 0 rgba(0,0,0,0);">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;margin-bottom:.65rem;">
            <div style="flex:1">
              <strong style="display:block;margin-bottom:.35rem;font-size:.94rem;color:var(--txt)">${escapeHtml(item.title)}</strong>
              <div style="font-size:.84rem;color:var(--txt2);white-space:pre-wrap">${escapeHtml(item.message)}</div>
            </div>
            ${item.amount ? `<span class="badge">${escapeHtml(fmtMoney(item.amount))}</span>` : ''}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:.5rem;">
            ${item.category ? `<button class="btn btn-sm btn-outline" onclick="window.FP_ADVISOR.accept(${item.category.id})">Ver categoria</button>` : ''}
            ${item.action ? `<button class="btn btn-sm btn-primary" onclick="${escapeHtml(item.action)}">${escapeHtml(item.actionLabel || 'Ver detalhes')}</button>` : ''}
          </div>
        </div>
      `).join('')}
    </div>`;
  }

  function normalizeText(str){ return String(str||'').trim(); }

  async function loadBudgets(){
    if(window.db.budgets) return await window.db.budgets.toArray();
    return [];
  }

  async function loadSubscriptions(uid){
    if(window.db.subscriptions) return await window.db.subscriptions.where('userId').equals(uid).toArray();
    return [];
  }

  function buildContextSummary(data = {}){
    const lines = [];
    if(data.monthExpense !== undefined) lines.push(`Despesas no mês: ${fmtMoney(data.monthExpense)}`);
    if(data.monthIncome !== undefined) lines.push(`Receitas no mês: ${fmtMoney(data.monthIncome)}`);
    if(data.savingsRate !== undefined) lines.push(`Taxa de poupança: ${Math.round(data.savingsRate * 100)}%`);
    if(data.topCategory) lines.push(`Top categoria: ${data.topCategory}`);
    if(data.subscriptionCost !== undefined) lines.push(`Assinaturas: ${fmtMoney(data.subscriptionCost)}/mês`);
    if(data.budgetAlerts) lines.push(`Orçamentos em risco: ${data.budgetAlerts}`);
    return lines.join(' | ');
  }

  async function generateSuggestions(){
    const uid = getUid();
    const allTxs = await window.db.transactions.where('userId').equals(uid).toArray();
    const categories = await window.db.categories.toArray();
    const budgets = await loadBudgets();
    const now = Date.now();
    const thisMonthKey = new Date().toISOString().slice(0,7);
    const lastMonthKey = new Date(now - 30 * dayMs).toISOString().slice(0,7);
    const recent90 = new Date(now - 90 * dayMs).getTime();

    const txs = allTxs.filter(t => { const ts = new Date(t.date || t.createdAt || t.updatedAt).getTime(); return !Number.isNaN(ts) && ts >= recent90; });
    const monthTxs = allTxs.filter(t => String(t.date || '').startsWith(thisMonthKey));
    const prevMonthTxs = allTxs.filter(t => String(t.date || '').startsWith(lastMonthKey));

    const budgetMap = budgets.reduce((acc, b) => { acc[b.categoryId] = Number(b.limitAmount || b.limit || 0); return acc; }, {});
    const catMap = categories.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});

    const expenseByCat = {};
    let monthIncome=0, monthExpense=0, prevExpense=0;
    txs.forEach(t => { if(t.type==='expense'){ expenseByCat[t.categoryId] = (expenseByCat[t.categoryId]||0) + Math.abs(Number(t.amount)||0); } });
    monthTxs.forEach(t => { if(t.type==='expense') monthExpense += Math.abs(Number(t.amount)||0); if(t.type==='income') monthIncome += Number(t.amount)||0; });
    prevMonthTxs.forEach(t => { if(t.type==='expense') prevExpense += Math.abs(Number(t.amount)||0); });

    const suggestions = [];
    const topCats = Object.entries(expenseByCat).sort((a,b)=>b[1]-a[1]).slice(0,4);
    const topCategoryLabel = topCats.length ? (catMap[topCats[0][0]]?.name || 'Categoria desconhecida') : null;

    if(topCats.length){
      const [catId, amount] = topCats[0];
      const category = catMap[catId] || {name:'Categoria desconhecida'};
      suggestions.push({
        id:'top-spend',
        title:`Gasto alto em ${category.name}`,
        message:`Você gastou ${fmtMoney(amount)} em ${category.name} nos últimos 90 dias. Considere revisar despesas recorrentes ou renegociar esse tipo de gasto.`,
        category,
        amount,
        action:`window.sendAIChat('Por que estou gastando tanto em ${category.name}?')`,
        actionLabel:'Perguntar à IA'
      });
    }

    const budgetAlerts = [];
    Object.entries(budgetMap).forEach(([catId, limit])=>{
      const spent = expenseByCat[catId] || 0;
      if(limit <= 0) return;
      const percent = Math.round((spent / limit) * 100);
      if(percent >= 85){
        const category = catMap[catId] || {name:'Categoria desconhecida'};
        budgetAlerts.push(category.name);
        const state = percent >= 100 ? 'estourou' : 'está perto do limite';
        suggestions.push({
          id:'budget-'+catId,
          title:`Orçamento ${state}`,
          message:`Sua categoria ${category.name} já consumiu ${percent}% do orçamento mensal (${fmtMoney(spent)} / ${fmtMoney(limit)}).`, 
          category,
          amount: spent,
          action:`window.navigate('budgets')`,
          actionLabel:'Ajustar orçamento'
        });
      }
    });

    const recurring = {};
    txs.filter(t=>t.type==='expense').forEach(t => {
      const key = `${normDesc(t.description||t.orig||t.notes)}|${t.categoryId}`;
      if(!key) return;
      recurring[key] = recurring[key] || {count:0, total:0, last:0, item:t};
      recurring[key].count += 1;
      recurring[key].total += Math.abs(Number(t.amount)||0);
      recurring[key].last = Math.max(recurring[key].last, new Date(t.date || t.createdAt || t.updatedAt).getTime());
    });
    Object.values(recurring).forEach(r => {
      if(r.count >= 3 && r.total >= 150 && (Date.now() - r.last) < 60 * dayMs){
        const category = catMap[r.item.categoryId] || {name:'Categoria desconhecida'};
        suggestions.push({
          id:'recurring-'+r.item.categoryId,
          title:`Despesa recorrente em ${category.name}`,
          message:`Detectei ${r.count} pagamentos semelhantes na categoria ${category.name}, somando ${fmtMoney(r.total)} nas últimas semanas.`, 
          category,
          amount: r.total,
          action:`window.sendAIChat('Tenho uma despesa recorrente de ${category.name}. Devo reduzir esse gasto?')`,
          actionLabel:'Analisar com IA'
        });
      }
    });

    const duplicateGroups = {};
    const recentTxs = allTxs.filter(t => { const ts = new Date(t.date || t.createdAt || t.updatedAt).getTime(); return !Number.isNaN(ts) && ts >= (Date.now() - 45 * dayMs); });
    recentTxs.filter(t=>t.type==='expense').forEach(t => {
      const key = `${normDesc(t.description||t.orig||t.notes)}|${Number(t.amount||0).toFixed(2)}`;
      duplicateGroups[key] = duplicateGroups[key] || {count:0, total:0, sample:t};
      duplicateGroups[key].count += 1;
      duplicateGroups[key].total += Math.abs(Number(t.amount)||0);
    });
    Object.values(duplicateGroups).forEach(g => {
      if(g.count >= 3 && g.sample){
        suggestions.push({
          id:'duplicate-'+normDesc(g.sample.description||g.sample.orig||g.sample.notes).slice(0,20),
          title:'Possível gasto duplicado',
          message:`Encontradas ${g.count} transações semelhantes de ${fmtMoney(g.sample.amount)}. Verifique se não houve lançamento duplicado.`, 
          amount: g.total,
          action:`window.openAIAssistant(); window.sendAIChat('Detectei lançamentos duplicados de ${fmtMoney(g.sample.amount)}. O que devo fazer?')`,
          actionLabel:'Analisar duplicatas'
        });
      }
    });

    if(monthIncome > 0){
      const savingsRate = Math.max(0, 1 - (monthExpense / monthIncome));
      if(savingsRate < 0.15){
        suggestions.push({
          id:'savings',
          title:'Taxa de poupança baixa',
          message:`Sua taxa de poupança está em ${Math.round(savingsRate * 100)}% neste mês. Tente reduzir gastos fixos ou aumentar receita.`, 
          amount: monthIncome - monthExpense,
          action:`window.sendAIChat('Como posso aumentar minha taxa de poupança mensal?')`,
          actionLabel:'Pedir conselho à IA'
        });
      }
    }

    if(prevExpense > 0 && monthExpense > prevExpense * 1.2){
      suggestions.push({
        id:'trend-spend',
        title:'Gastos em alta',
        message:`Seus gastos aumentaram ${Math.round((monthExpense / prevExpense - 1) * 100)}% em relação ao mês anterior.`, 
        amount: monthExpense - prevExpense,
        action:`window.sendAIChat('Por que minhas despesas aumentaram tanto este mês?')`,
        actionLabel:'Entender com IA'
      });
    }

    const subs = await loadSubscriptions(uid);
    if(subs?.length){
      const monthlySub = subs.reduce((sum, s) => {
        const amount = Number(s.amount || 0);
        if(!amount) return sum;
        if(s.cycle==='yearly') return sum + amount / 12;
        if(s.cycle==='quarterly') return sum + amount / 3;
        if(s.cycle==='weekly') return sum + amount * 4.33;
        return sum + amount;
      }, 0);
      const upcoming = subs.filter(s => s.nextDue && new Date(s.nextDue).getTime() - Date.now() <= 14 * dayMs && new Date(s.nextDue).getTime() >= Date.now());
      suggestions.push({
        id:'subs-cost',
        title:'Custo de assinaturas',
        message:`Suas assinaturas ativas custam cerca de ${fmtMoney(monthlySub)} por mês. Reveja serviços caros ou duplicados.`, 
        amount: monthlySub,
        action:`window.navigate('subscriptions')`,
        actionLabel:'Ver assinaturas'
      });
      if(upcoming.length){
        suggestions.push({
          id:'subs-upcoming',
          title:'Assinaturas próximas ao vencimento',
          message:`${upcoming.length} assinatura(s) vencem nos próximos 14 dias. Confira se você ainda usa esses serviços.`, 
          amount: upcoming.reduce((sum,s)=>sum+Number(s.amount||0),0),
          action:`window.navigate('subscriptions')`,
          actionLabel:'Revisar vencimentos'
        });
      }
    }

    const summary = buildContextSummary({
      monthExpense,
      monthIncome,
      savingsRate: monthIncome > 0 ? Math.max(0, 1 - (monthExpense / monthIncome)) : undefined,
      topCategory: topCategoryLabel,
      subscriptionCost: subs?.length ? subs.reduce((sum, s) => {
        const amount = Number(s.amount || 0);
        if(s.cycle==='yearly') return sum + amount / 12;
        if(s.cycle==='quarterly') return sum + amount / 3;
        if(s.cycle==='weekly') return sum + amount * 4.33;
        return sum + amount;
      },0) : undefined,
      budgetAlerts: budgetAlerts.length ? budgetAlerts.join(', ') : undefined,
    });

    if(summary){
      suggestions.unshift({
        id:'ai-digest',
        title:'Resumo rápido da IA',
        message: summary,
        action:`window.sendAIChat('Me dê um plano rápido para melhorar meu orçamento com base no resumo financeiro atual.')`,
        actionLabel:'Analisar com IA'
      });
    }

    if(!suggestions.length){
      suggestions.push({
        id:'all-clear',
        title:'Tudo sob controle',
        message:'Seus hábitos financeiros estão estáveis. Continue acompanhando seus orçamentos e metas.',
        action:`window.sendAIChat('Quais são as principais oportunidades para melhorar meu orçamento?')`,
        actionLabel:'Ajustes gerais'
      });
    }

    return suggestions.slice(0,6);
  }

  async function refreshSuggestions(){
    const items = await generateSuggestions().catch(e => { console.warn('[FP-ADV] suggest err', e); return []; });
    window.EventBus.emit('ai:suggestions:refresh', items);
    items.forEach(item => window.EventBus.emit('suggestion:new', item));
    renderSuggestions(items);
    return items;
  }

  function startAutoRefresh(){
    refreshSuggestions().catch(() => {});
    setInterval(() => refreshSuggestions().catch(() => {}), 1000 * 60 * 5);
  }

  function toggleAIAssistant(){
    const panel = getAssistantCard();
    if(!panel) return;
    if(panel.style.display === 'none' || panel.style.display === ''){
      openAIAssistant();
    } else {
      panel.style.display = 'none';
      const dot = document.getElementById('aiFloatDot'); if(dot) dot.style.display = 'none';
      window.EventBus.emit('ai:assistant:closed');
    }
  }

  function openAIAssistant(){
    const panel = getAssistantCard();
    if(!panel) return;
    panel.style.display = 'block';
    const dot = document.getElementById('aiFloatDot'); if(dot) dot.style.display = 'block';
    const input = document.getElementById('aiChatInput'); if(input) input.focus();
    window.EventBus.emit('ai:assistant:opened');
  }

  async function sendAIChat(prompt){
    const input = document.getElementById('aiChatInput');
    const text = normalizeText(prompt || input?.value || '');
    if(!text) return;
    if(input) input.value = '';
    appendChat('user', text);
    window.EventBus.emit('ai:assistant:message', 'user', text);
    const loading = appendChat('assistant', 'Processando...');
    try {
      if(typeof window.askAI !== 'function') throw new Error('askAI indisponível');
      const answer = await window.askAI(text, { maxTokens: 280, temperature: 0.45 });
      loading.textContent = answer || 'Sem resposta disponível.';
      window.EventBus.emit('ai:assistant:message', 'assistant', answer || 'Sem resposta disponível.');
    } catch(e) {
      loading.textContent = 'Erro ao consultar IA: ' + (e.message || 'falha inesperada');
      console.warn('[FP-ADV] sendAIChat err', e);
    }
  }

  window.FP_ADVISOR = {
    async suggest(){ return refreshSuggestions(); },
    accept(categoryId){
      if(!categoryId) return window.EventBus?.emit('suggestion:accepted',{categoryId});
      window.EventBus.emit('suggestion:accepted',{categoryId});
      if(typeof window.navigate === 'function') window.navigate('categories');
    },
    openAssistant,
    toggleAssistant: toggleAIAssistant,
    ask(prompt){ return sendAIChat(prompt); }
  };

  window.refreshSuggestions = refreshSuggestions;
  window.openAIAssistant = openAIAssistant;
  window.toggleAIAssistant = toggleAIAssistant;
  window.sendAIChat = sendAIChat;

  window.EventBus.on('page:loaded', ()=> startAutoRefresh());
  window.EventBus.on('db:reports:updated', ()=> refreshSuggestions());
  window.EventBus.on('suggestion:accepted', payload => window.EventBus.emit('ai:suggestion:selected', payload));

  console.log('[FP-ADV] Advisor ready');
}
init();
})();
