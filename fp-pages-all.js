/* ====================================================================
   FINANCEPRO — fp-pages-all.js
   Handles all 4 new pages in ONE file with ONE navigate hook.
   No conflicts. No async chains. Renders directly into page zones.
==================================================================== */
(function () {
  'use strict';

  /* ── Wait for app ready ── */
  function whenReady(fn, ms) {
    ms = ms || 8000;
    const t0 = Date.now();
    (function check() {
      if (window.db && window.S?.user) return fn(window.S.user.id);
      if (Date.now() - t0 > ms) return fn(null);
      setTimeout(check, 250);
    })();
  }

  const fmt = v => typeof window.fmtCurrency === 'function'
    ? window.fmtCurrency(v) : 'R$' + Math.abs(v || 0).toFixed(2).replace('.', ',');
  const esc = s => String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ══════════════════════════════════════════════════════════
     PAGE: CHALLENGES & CONQUISTAS
  ══════════════════════════════════════════════════════════ */
  const ACHIEVEMENTS = [
    { id:'first_tx',    xp:50,  icon:'💰', name:'Primeira transação',  check: d=>d.total>=1 },
    { id:'tx_10',       xp:100, icon:'📊', name:'10 transações',       check: d=>d.total>=10 },
    { id:'tx_50',       xp:200, icon:'🏅', name:'50 transações',       check: d=>d.total>=50 },
    { id:'tx_100',      xp:400, icon:'🥇', name:'100 transações',      check: d=>d.total>=100 },
    { id:'budget_set',  xp:75,  icon:'🎯', name:'Orçamento definido',  check: d=>d.budgets>=1 },
    { id:'goal_set',    xp:100, icon:'🌟', name:'Primeira meta',       check: d=>d.goals>=1 },
    { id:'saver_10',    xp:150, icon:'🐷', name:'Poupador (10%+)',     check: d=>d.rate>=10 },
    { id:'saver_20',    xp:300, icon:'💎', name:'Poupador Pro (20%+)', check: d=>d.rate>=20 },
    { id:'streak_3',    xp:100, icon:'🔥', name:'Sequência de 3 dias', check: d=>d.streak>=3 },
    { id:'streak_7',    xp:250, icon:'🌈', name:'Semana completa',     check: d=>d.streak>=7 },
    { id:'streak_30',   xp:500, icon:'🚀', name:'Mês perfeito',        check: d=>d.streak>=30 },
    { id:'positive',    xp:200, icon:'✅', name:'Mês positivo',        check: d=>d.positive },
    { id:'categories',  xp:75,  icon:'🏷️', name:'5+ categorias',      check: d=>d.cats>=5 },
    { id:'no_overbudget',xp:250,icon:'🛡️', name:'Sem estouro',        check: d=>d.budgets>=1&&d.over===0 },
    { id:'import',      xp:150, icon:'📥', name:'Importou extrato',    check: d=>d.imported>=1 },
  ];

  window.loadChallenges = function() {
    const zone = document.getElementById('page-challenges');
    if (!zone) return;
    zone.innerHTML = '<div style="padding:3rem;text-align:center;color:var(--txt2)"><i class="fas fa-spinner fa-spin" style="font-size:2rem"></i></div>';
    whenReady(async function(uid) {
      if (!uid) { zone.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--txt2)">Faça login primeiro.</div>'; return; }
      try {
        const now = new Date(), month = now.toISOString().slice(0,7);
        const [txs, budgets, goals, cats] = await Promise.all([
          window.db.transactions.where('userId').equals(uid).toArray(),
          window.db.budgets.where('userId').equals(uid).toArray().catch(()=>[]),
          window.db.goals.where('userId').equals(uid).toArray().catch(()=>[]),
          window.db.categories.where('userId').equals(uid).toArray().catch(()=>[]),
        ]);
        const cur = txs.filter(t=>t.date.startsWith(month));
        const cI = cur.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
        const cE = cur.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
        const rate = cI>0 ? Math.round((cI-cE)/cI*100) : 0;

        // Streak
        const dates = new Set(txs.map(t=>t.date.slice(0,10)));
        let streak=0; const d=new Date(now);
        while(dates.has(d.toISOString().slice(0,10))){streak++;d.setDate(d.getDate()-1);}

        // Last 42 days calendar
        const last42={};
        for(let i=41;i>=0;i--){const dd=new Date(now);dd.setDate(dd.getDate()-i);const k=dd.toISOString().slice(0,10);last42[k]=txs.filter(t=>t.date.slice(0,10)===k).length;}

        const mBudgets = budgets.filter(b=>!b.monthYear||b.monthYear===month);
        const overBudget = mBudgets.filter(b=>{
          const sp=cur.filter(t=>String(t.categoryId)===String(b.categoryId)&&t.type==='expense').reduce((s,t)=>s+t.amount,0);
          return b.limitAmount>0&&sp>b.limitAmount;
        }).length;

        const stats = {total:txs.length,budgets:mBudgets.length,goals:goals.length,rate,streak,positive:cI>cE,cats:cats.filter(c=>c.type==='expense').length,over:overBudget,imported:txs.filter(t=>t.importedAt||t.source==='import').length};

        // XP
        let xpData={xp:0,level:1,earned:[]};
        try{xpData=await window.getSetting?.(uid,'fp_gamification',xpData)||xpData;}catch(e){}
        const newlyEarned=[];
        for(const a of ACHIEVEMENTS){
          if(xpData.earned.includes(a.id)) continue;
          if(a.check(stats)){xpData.earned.push(a.id);xpData.xp+=a.xp;newlyEarned.push(a);}
        }
        xpData.level=Math.floor(xpData.xp/500)+1;
        if(newlyEarned.length){
          try{await window.setSetting?.(uid,'fp_gamification',xpData);}catch(e){}
          newlyEarned.forEach(a=>setTimeout(()=>typeof window.toast==='function'&&window.toast('🏅 '+a.name+' (+'+a.xp+' XP)','success'),500));
        }

        // Challenges
        const challenges=[];
        const dim=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
        const dLeft=dim-now.getDate();
        if(cI>0){
          const tr=Math.max(20,rate+5);
          challenges.push({icon:'💰',color:'#10b981',title:`Poupar ${tr}% da renda`,desc:`Taxa atual: ${rate}%. Meta: ${tr}%`,progress:Math.min(100,Math.round(rate/tr*100)),xp:300,done:rate>=tr});
        }
        const strT=streak>=7?30:streak>=3?7:3;
        challenges.push({icon:'🔥',color:'#f59e0b',title:`Sequência de ${strT} dias`,desc:`Registre todo dia. Streak: ${streak}d`,progress:Math.min(100,Math.round(streak/strT*100)),xp:strT===30?500:strT===7?250:100,done:streak>=strT});
        if(mBudgets.length===0) challenges.push({icon:'🎯',color:'#8b5cf6',title:'Criar 3 orçamentos',desc:'Defina limites por categoria',progress:0,xp:150,done:false,action:{label:'Orçamentos',fn:"navigate('budgets')"}});
        else if(overBudget===0&&dLeft>0) challenges.push({icon:'🛡️',color:'#10b981',title:'Sem estouro até o fim do mês',desc:`${dLeft} dias restantes`,progress:Math.round((dim-dLeft)/dim*100),xp:250,done:false});
        if(goals.length===0) challenges.push({icon:'🌟',color:'#f59e0b',title:'Criar primeira meta',desc:'Defina um objetivo financeiro',progress:0,xp:100,done:false,action:{label:'Metas',fn:"navigate('goals')"}});

        const xpPct=Math.min(100,Math.round((xpData.xp-(xpData.level-1)*500)/(xpData.level*500)*100));

        // Calendar HTML
        const weeks=[]; let week=[];
        Object.entries(last42).forEach(([date,count],i)=>{
          if(i===0){const dow=new Date(date+'T12:00:00').getDay();for(let p=0;p<dow;p++)week.push(null);}
          week.push({date,count});
          if(week.length===7){weeks.push(week);week=[];}
        });
        if(week.length)weeks.push(week);
        const calHtml=`<div style="display:flex;gap:2px;flex-wrap:nowrap;overflow-x:auto">${weeks.map(w=>`<div style="display:flex;flex-direction:column;gap:2px">${w.map(d=>d?`<div title="${d.date}:${d.count}tx" style="width:11px;height:11px;border-radius:2px;background:${d.count===0?'var(--bdr)':d.count>=3?'var(--success)':'#86efac'}"></div>`:'<div style="width:11px;height:11px"></div>').join('')}</div>`).join('')}</div>`;

        zone.innerHTML = `
        <div class="page-hdr">
          <div><h1 class="page-title"><i class="fas fa-trophy" style="color:#f59e0b"></i> Desafios & Conquistas</h1>
          <p class="page-sub">Baseado nos seus dados reais — Nível ${xpData.level}</p></div>
          <button class="btn btn-ghost btn-sm" onclick="window.loadChallenges()"><i class="fas fa-sync"></i> Atualizar</button>
        </div>
        <div class="stats-grid" style="margin-bottom:.85rem">
          <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#f59e0b,#d97706)"><i class="fas fa-star"></i></div><div><div class="stat-label">XP Total</div><div class="stat-value">${xpData.xp}</div></div></div>
          <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#ef4444,#dc2626)"><i class="fas fa-fire"></i></div><div><div class="stat-label">Streak</div><div class="stat-value">${streak}d</div></div></div>
          <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed)"><i class="fas fa-medal"></i></div><div><div class="stat-label">Conquistas</div><div class="stat-value">${xpData.earned.length}/${ACHIEVEMENTS.length}</div></div></div>
          <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#10b981,#059669)"><i class="fas fa-check-double"></i></div><div><div class="stat-label">Completos</div><div class="stat-value">${challenges.filter(c=>c.done).length}/${challenges.length}</div></div></div>
        </div>
        <div class="card" style="padding:.75rem 1rem;margin-bottom:.85rem">
          <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:.3rem"><span style="font-weight:700;color:var(--accent)">Nível ${xpData.level}</span><span style="color:var(--txt2)">${xpData.xp} XP</span></div>
          <div style="height:7px;background:var(--bdr);border-radius:4px;overflow:hidden"><div style="width:${xpPct}%;height:100%;background:linear-gradient(90deg,var(--accent),#3b82f6);border-radius:4px"></div></div>
          <div style="margin-top:.65rem"><div style="font-size:.75rem;font-weight:600;color:var(--txt2);margin-bottom:.3rem">📅 Atividade (últimas 6 semanas) — Streak: <strong style="color:#f59e0b">${streak} dia${streak!==1?'s':''}</strong></div>${calHtml}</div>
        </div>
        <div class="card" style="margin-bottom:.85rem">
          <div class="card-hdr"><span class="card-title"><i class="fas fa-bolt" style="color:var(--warning)"></i> Desafios do Mês</span></div>
          <div style="padding:.5rem 1rem 1rem">
          ${challenges.map(ch=>`<div style="display:flex;align-items:center;gap:.65rem;padding:.65rem 0;border-bottom:1px solid var(--bdr)">
            <div style="width:36px;height:36px;border-radius:10px;background:${ch.color}20;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">${ch.icon}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:.3rem;flex-wrap:wrap;margin-bottom:.2rem">
                <span style="font-size:.85rem;font-weight:600">${ch.title}</span>
                <span style="font-size:.65rem;padding:1px 7px;border-radius:99px;background:var(--accent);color:#fff">+${ch.xp} XP</span>
                ${ch.done?'<span style="font-size:.65rem;padding:1px 7px;border-radius:99px;background:#dcfce7;color:#15803d;font-weight:700">✓ COMPLETO</span>':''}
              </div>
              <div style="font-size:.75rem;color:var(--txt2);margin-bottom:.3rem">${ch.desc}</div>
              <div style="height:5px;background:var(--bdr);border-radius:3px;overflow:hidden"><div style="width:${ch.progress}%;height:100%;background:${ch.done?'#10b981':ch.color};border-radius:3px"></div></div>
            </div>
            ${ch.action?`<button onclick="${ch.action.fn}" class="btn btn-ghost btn-sm" style="font-size:.7rem;flex-shrink:0">${ch.action.label}</button>`:''}
          </div>`).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-hdr"><span class="card-title"><i class="fas fa-medal" style="color:#f59e0b"></i> Conquistas</span></div>
          <div style="padding:.75rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:.5rem">
          ${ACHIEVEMENTS.map(a=>{const done=xpData.earned.includes(a.id);return `<div style="padding:.6rem;border-radius:9px;border:1.5px solid ${done?'var(--accent)':'var(--bdr)'};background:${done?'rgba(var(--accent-rgb),.06)':'var(--bg-s)'};opacity:${done?1:.45}">
            <div style="font-size:1.4rem;margin-bottom:.2rem">${a.icon}</div>
            <div style="font-size:.78rem;font-weight:700">${a.name}</div>
            <div style="font-size:.7rem;color:var(--accent);font-weight:700">+${a.xp} XP${done?' ✓':''}</div>
          </div>`;}).join('')}
          </div>
        </div>`;
      } catch(e) {
        zone.innerHTML = `<div style="padding:2rem;text-align:center"><i class="fas fa-exclamation-triangle" style="color:var(--warning);font-size:2rem;display:block;margin-bottom:.5rem"></i><div style="font-size:.9rem;color:var(--txt2)">Erro: ${esc(e.message)}</div><button class="btn btn-outline btn-sm" style="margin-top:1rem" onclick="window.loadChallenges()">Tentar novamente</button></div>`;
      }
    });
  };

  /* ══════════════════════════════════════════════════════════
     PAGE: FRAUDES & ANOMALIAS
  ══════════════════════════════════════════════════════════ */
  window.loadAnomalies = function() {
    const zone = document.getElementById('page-anomalies');
    if (!zone) return;
    zone.innerHTML = '<div style="padding:3rem;text-align:center;color:var(--txt2)"><i class="fas fa-spinner fa-spin" style="font-size:2rem"></i><br><br>Analisando transações...</div>';
    whenReady(async function(uid) {
      if (!uid) { zone.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--txt2)">Faça login primeiro.</div>'; return; }
      try {
        const now = new Date(), month = now.toISOString().slice(0,7);
        const [txs, cats] = await Promise.all([
          window.db.transactions.where('userId').equals(uid).toArray(),
          window.db.categories.where('userId').equals(uid).toArray().catch(()=>[]),
        ]);

        // Load dismissed alerts
        let dismissed=[];
        try{dismissed=await window.getSetting?.(uid,'fp_dismissed_alerts',[])||[];}catch(e){}

        const alerts=[];
        const cur=txs.filter(t=>t.date.startsWith(month)&&t.type==='expense');

        // 1. Outlier por categoria
        const byCat={};
        txs.filter(t=>t.type==='expense').forEach(t=>{const k=t.categoryId||'?';(byCat[k]=byCat[k]||[]).push(t);});
        for(const [catId,cTxs] of Object.entries(byCat)){
          if(cTxs.length<4) continue;
          const amounts=cTxs.map(t=>t.amount);
          const mean=amounts.reduce((s,v)=>s+v,0)/amounts.length;
          const std=Math.sqrt(amounts.reduce((s,v)=>s+(v-mean)**2,0)/amounts.length);
          cTxs.forEach(t=>{
            const z=std>0?Math.abs(t.amount-mean)/std:0;
            if(z>2.5&&!dismissed.includes('o-'+t.id)){
              const cat=cats.find(c=>String(c.id)===String(catId));
              alerts.push({id:'o-'+t.id,sev:z>3.5?'high':'mid',icon:'fa-chart-bar',title:`Valor atípico em ${cat?.name||'categoria'}`,desc:`"${esc(t.description||'Sem desc')}" — ${fmt(t.amount)} (${z.toFixed(1)}× desvio, média: ${fmt(mean)})`,date:t.date,txId:t.id});
            }
          });
        }

        // 2. Duplicatas (±3 dias)
        const sorted=[...txs].sort((a,b)=>a.date.localeCompare(b.date));
        const seen=new Set();
        sorted.forEach((t,i)=>{
          if(seen.has(t.id)) return;
          const d1=new Date(t.date);
          for(let j=i+1;j<sorted.length;j++){
            const t2=sorted[j]; const d2=new Date(t2.date);
            if((d2-d1)>3*86400000) break;
            if(Math.abs(t.amount-t2.amount)<0.01&&(t.description||'').toLowerCase()===(t2.description||'').toLowerCase()&&t.type===t2.type){
              seen.add(t2.id);
              const aid='dup-'+t.id+'-'+t2.id;
              if(!dismissed.includes(aid)) alerts.push({id:aid,sev:'high',icon:'fa-copy',title:'Possível duplicata',desc:`"${esc(t.description||'?')}" — ${fmt(t.amount)} em ${t.date} e ${t2.date}`,date:t2.date,txId:t2.id});
            }
          }
        });

        // 3. Categoria disparando vs 3 meses anteriores
        const last3=[1,2,3].map(i=>{const d=new Date(now.getFullYear(),now.getMonth()-i,1);return d.toISOString().slice(0,7);});
        cats.filter(c=>c.type==='expense').forEach(cat=>{
          const curSpent=cur.filter(t=>String(t.categoryId)===String(cat.id)).reduce((s,t)=>s+t.amount,0);
          const prevAvgs=last3.map(m=>txs.filter(t=>t.date.startsWith(m)&&t.type==='expense'&&String(t.categoryId)===String(cat.id)).reduce((s,t)=>s+t.amount,0)).filter(v=>v>0);
          if(prevAvgs.length<2) return;
          const prevAvg=prevAvgs.reduce((s,v)=>s+v,0)/prevAvgs.length;
          const aid='spike-'+cat.id;
          if(curSpent>prevAvg*2.5&&curSpent>100&&!dismissed.includes(aid))
            alerts.push({id:aid,sev:'mid',icon:'fa-arrow-trend-up',title:`${cat.name}: +${Math.round(curSpent/prevAvg*100-100)}% vs média`,desc:`Este mês: ${fmt(curSpent)}. Média 3m: ${fmt(prevAvg)}`,date:month});
        });

        // 4. Assinaturas não cadastradas
        const dGroups={};
        txs.filter(t=>t.type==='expense').forEach(t=>{const k=(t.description||'').toLowerCase().trim();if(k.length>3)(dGroups[k]=dGroups[k]||[]).push(t);});
        let subs=[];
        try{subs=await window.db.subscriptions?.where('userId').equals(uid).toArray().catch(()=>[])||[];}catch(e){}
        const subNames=new Set(subs.map(s=>(s.name||'').toLowerCase().trim()));
        for(const [desc,grp] of Object.entries(dGroups)){
          if(grp.length<2||subNames.has(desc)) continue;
          const dates=grp.map(t=>new Date(t.date)).sort((a,b)=>a-b);
          const gaps=[];for(let i=1;i<dates.length;i++)gaps.push((dates[i]-dates[i-1])/86400000);
          const avgGap=gaps.reduce((s,v)=>s+v,0)/gaps.length;
          const lastAmt=grp[grp.length-1].amount;
          const aid='rec-'+desc.slice(0,15).replace(/\s/g,'_');
          if(avgGap>=25&&avgGap<=35&&grp.every(t=>Math.abs(t.amount-lastAmt)<lastAmt*0.1)&&lastAmt>5&&!dismissed.includes(aid))
            alerts.push({id:aid,sev:'low',icon:'fa-rotate',title:'Assinatura não cadastrada',desc:`"${esc(desc)}" — ${fmt(lastAmt)}/mês. Cadastre em Assinaturas.`,date:grp[grp.length-1].date,action:{label:'Assinaturas',fn:"navigate('subscriptions')"}});
        }

        const SEV={high:{bg:'rgba(239,68,68,.1)',bdr:'var(--danger)',ic:'var(--danger)',label:'Alta'},mid:{bg:'rgba(245,158,11,.08)',bdr:'var(--warning)',ic:'var(--warning)',label:'Média'},low:{bg:'rgba(59,130,246,.08)',bdr:'#3b82f6',ic:'#3b82f6',label:'Info'}};
        alerts.sort((a,b)=>({high:0,mid:1,low:2}[a.sev]||2)-({high:0,mid:1,low:2}[b.sev]||2));
        const high=alerts.filter(a=>a.sev==='high').length, mid=alerts.filter(a=>a.sev==='mid').length, low=alerts.filter(a=>a.sev==='low').length;

        zone.innerHTML = `
        <div class="page-hdr">
          <div><h1 class="page-title"><i class="fas fa-shield-halved" style="color:var(--accent)"></i> Fraudes & Anomalias</h1>
          <p class="page-sub">Análise automática de ${txs.length} transações</p></div>
          <button class="btn btn-primary btn-sm" onclick="window.loadAnomalies()"><i class="fas fa-search"></i> Reanalisar</button>
        </div>
        <div class="stats-grid" style="margin-bottom:1rem">
          <div class="stat-card"><div class="stat-icon" style="background:var(--danger)"><i class="fas fa-exclamation-triangle"></i></div><div><div class="stat-label">Alta Severidade</div><div class="stat-value text-danger">${high}</div></div></div>
          <div class="stat-card"><div class="stat-icon" style="background:var(--warning)"><i class="fas fa-circle-exclamation"></i></div><div><div class="stat-label">Média Severidade</div><div class="stat-value" style="color:var(--warning)">${mid}</div></div></div>
          <div class="stat-card"><div class="stat-icon" style="background:#3b82f6"><i class="fas fa-info-circle"></i></div><div><div class="stat-label">Informações</div><div class="stat-value">${low}</div></div></div>
          <div class="stat-card"><div class="stat-icon" style="background:var(--success)"><i class="fas fa-check-circle"></i></div><div><div class="stat-label">Analisadas</div><div class="stat-value" style="color:var(--success)">${txs.length}</div></div></div>
        </div>
        ${!alerts.length ? `<div class="card" style="padding:3rem;text-align:center"><div style="font-size:3rem;margin-bottom:.5rem">🛡️</div><div style="font-size:.95rem;font-weight:600">Tudo em dia!</div><div style="font-size:.83rem;color:var(--txt2);margin-top:.25rem">Nenhum padrão suspeito nas ${txs.length} transações.</div></div>` :
        `<div class="card">
          <div class="card-hdr"><span class="card-title">Alertas detectados</span><button class="btn btn-ghost btn-sm" style="font-size:.72rem" onclick="FP_ANOMALIES.clearDismissed()"><i class="fas fa-undo"></i> Restaurar ignorados</button></div>
          <div style="padding:.5rem 1rem">
          ${alerts.map(a=>{const s=SEV[a.sev]||SEV.low;return `<div id="pal-${a.id.replace(/[^a-z0-9]/gi,'_')}" style="display:flex;gap:.6rem;padding:.65rem 0;border-bottom:1px solid var(--bdr);align-items:flex-start">
            <i class="fas ${a.icon}" style="color:${s.ic};margin-top:3px;flex-shrink:0"></i>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:.3rem;flex-wrap:wrap;margin-bottom:.15rem">
                <span style="font-size:.85rem;font-weight:600">${esc(a.title)}</span>
                <span style="font-size:.65rem;padding:1px 6px;border-radius:99px;background:${s.bdr};color:#fff;font-weight:700">${s.label}</span>
              </div>
              <div style="font-size:.78rem;color:var(--txt2);margin-bottom:.3rem;line-height:1.4">${esc(a.desc)}</div>
              <div style="display:flex;gap:.4rem;flex-wrap:wrap">
                ${a.action?`<button onclick="${a.action.fn}" class="btn btn-ghost btn-sm" style="font-size:.7rem">${a.action.label}</button>`:''}
                <button onclick="FP_ANOMALIES.dismiss('${a.id}')" class="btn btn-ghost btn-sm" style="font-size:.7rem;color:var(--danger)"><i class="fas fa-times"></i> Ignorar</button>
              </div>
            </div>
          </div>`;}).join('')}
          </div>
        </div>`}
        <div style="text-align:right;font-size:.72rem;color:var(--txt2);margin-top:.5rem">Última análise: ${new Date().toLocaleTimeString('pt-BR')}</div>`;

        window.FP_ANOMALIES = {
          async dismiss(id) {
            let d=[]; try{d=await window.getSetting?.(uid,'fp_dismissed_alerts',[])||[];}catch(e){}
            if(!d.includes(id)){d.push(id);try{await window.setSetting?.(uid,'fp_dismissed_alerts',d);}catch(e){}}
            const el=document.getElementById('pal-'+id.replace(/[^a-z0-9]/gi,'_'));
            if(el){el.style.opacity='0';el.style.transition='opacity .3s';setTimeout(()=>el.remove(),300);}
          },
          async clearDismissed() {
            try{await window.setSetting?.(uid,'fp_dismissed_alerts',[]);}catch(e){}
            window.loadAnomalies();
          }
        };
      } catch(e) {
        zone.innerHTML = `<div style="padding:2rem;text-align:center"><i class="fas fa-exclamation-triangle" style="color:var(--warning);font-size:2rem;display:block;margin-bottom:.5rem"></i><div style="font-size:.9rem;color:var(--txt2)">Erro: ${esc(e.message)}</div><button class="btn btn-outline btn-sm" style="margin-top:1rem" onclick="window.loadAnomalies()">Tentar novamente</button></div>`;
      }
    });
  };

  /* ══════════════════════════════════════════════════════════
     PAGE: EDUCAÇÃO FINANCEIRA (version inside fp-education.js is fine — reuse it)
     PAGE: BENCHMARK NACIONAL (version inside fp-benchmark.js is fine — reuse it)
     These 2 have working autoInit so we just ensure their globals exist
  ══════════════════════════════════════════════════════════ */

  /* ── SINGLE navigate hook for all pages ── */
  const PAGE_MAP = {
    challenges: () => window.loadChallenges(),
    anomalies:  () => window.loadAnomalies(),
    education:  () => window.loadEducation?.(),
    benchmark:  () => window.loadBenchmark?.(),
  };

  function installHook() {
    const orig = window.navigate;
    if (typeof orig !== 'function' || window.__allPagesHooked) return;
    window.__allPagesHooked = true;
    window.navigate = function(page) {
      orig.call(this, page);
      if (PAGE_MAP[page]) {
        setTimeout(() => {
          whenReady(() => PAGE_MAP[page]());
        }, 100);
      }
    };
  }

  /* Try to install hook now, and retry after DOM ready */
  installHook();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installHook);
  }
  setTimeout(installHook, 500);

  /* Also auto-render if page is already active when this script loads */
  setTimeout(() => {
    Object.keys(PAGE_MAP).forEach(p => {
      const el = document.getElementById('page-' + p);
      if (el && el.classList.contains('active')) {
        whenReady(() => PAGE_MAP[p]());
      }
    });
  }, 600);

})();
