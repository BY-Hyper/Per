/* fp-core-pages.js v4.0 — Polling-based, self-contained */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtR=v=>{try{return window.fmtCurrency?window.fmtCurrency(v):'R$'+Math.abs(v||0).toFixed(2).replace('.',',');}catch(e){return'R$'+(v||0).toFixed(2).replace('.',',');}};
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const T=(m,t='success')=>{try{window.toast?.(m,t,3500);}catch(e){}};
const log=(...a)=>console.log('[FP-CORE]',...a);
const warn=(...a)=>console.warn('[FP-CORE]',...a);

function ready(fn){
  let att=0;
  const c=()=>{att++;if(window.db&&window.S?.user){fn(window.db,window.S.user);return;}if(att>60){fn(window.db,window.S?.user);return;}setTimeout(c,200);};c();
}

/* ════ DESAFIOS ════ */
const ACH=[
  {id:'first_tx',xp:50,icon:'💰',name:'Primeira transação',desc:'Registrou a 1ª transação',check:d=>d.txs>=1},
  {id:'tx_10',xp:100,icon:'📊',name:'10 transações',desc:'10 transações registradas',check:d=>d.txs>=10},
  {id:'tx_50',xp:250,icon:'🏅',name:'50 transações',desc:'50 transações registradas',check:d=>d.txs>=50},
  {id:'tx_100',xp:500,icon:'🥇',name:'Centurião',desc:'100 transações registradas',check:d=>d.txs>=100},
  {id:'budget_1',xp:75,icon:'🎯',name:'Orçamento definido',desc:'Criou 1 limite mensal',check:d=>d.budgets>=1},
  {id:'goal_1',xp:100,icon:'🌟',name:'Sonhador',desc:'Criou uma meta financeira',check:d=>d.goals>=1},
  {id:'saver_10',xp:150,icon:'🐷',name:'Poupador',desc:'Taxa de poupança ≥ 10%',check:d=>d.rate>=10},
  {id:'saver_20',xp:300,icon:'💎',name:'Poupador Pro',desc:'Taxa de poupança ≥ 20%',check:d=>d.rate>=20},
  {id:'streak_3',xp:100,icon:'🔥',name:'3 dias seguidos',desc:'Streak de 3 dias',check:d=>d.streak>=3},
  {id:'streak_7',xp:250,icon:'🌈',name:'Semana completa',desc:'Streak de 7 dias',check:d=>d.streak>=7},
  {id:'streak_30',xp:600,icon:'🚀',name:'Mês perfeito',desc:'Streak de 30 dias',check:d=>d.streak>=30},
  {id:'positive',xp:200,icon:'✅',name:'Mês positivo',desc:'Saldo positivo no mês',check:d=>d.positive},
  {id:'no_over',xp:250,icon:'🛡️',name:'Controlado',desc:'Nenhum orçamento estourado',check:d=>d.budgets>0&&d.over===0},
];

window.loadChallenges = window.loadChallenges || function(){
  const zone=$('page-challenges');if(!zone){warn('page-challenges not found');return;}
  zone.innerHTML='<div style="padding:3rem;text-align:center;color:var(--txt2)"><i class="fas fa-spinner fa-spin" style="font-size:2rem"></i><br><br>Calculando desafios...</div>';
  ready(async(db,user)=>{
    if(!user){zone.innerHTML='<div style="padding:3rem;text-align:center;color:var(--txt2)"><i class="fas fa-lock" style="font-size:2.5rem;display:block;margin-bottom:.75rem"></i>Faça login para ver seus desafios.</div>';return;}
    try{
      const uid=user.id;const now=new Date();const month=now.toISOString().slice(0,7);
      const ms=month+'-01';const me=new Date(now.getFullYear(),now.getMonth()+1,0).toISOString().split('T')[0];
      const[allTxs,budgets,goals]=await Promise.all([
        db.transactions.where('userId').equals(uid).toArray().catch(()=>[]),
        (db.budgets?.where('userId').equals(uid).toArray()||Promise.resolve([])).catch(()=>[]),
        (db.goals?.where('userId').equals(uid).toArray()||Promise.resolve([])).catch(()=>[]),
      ]);
      const cur=allTxs.filter(t=>t.date>=ms&&t.date<=me);
      const cI=cur.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
      const cE=cur.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
      const rate=cI>0?Math.round((cI-cE)/cI*100):0;
      const mB=budgets.filter(b=>!b.monthYear||b.monthYear===month);
      const over=mB.filter(b=>{const sp=cur.filter(t=>String(t.categoryId)===String(b.categoryId)&&t.type==='expense').reduce((s,t)=>s+t.amount,0);return b.limitAmount>0&&sp>b.limitAmount;}).length;
      const txDates=new Set(allTxs.map(t=>t.date?.slice(0,10)).filter(Boolean));
      let streak=0;const dd=new Date(now);while(txDates.has(dd.toISOString().slice(0,10))){streak++;dd.setDate(dd.getDate()-1);}
      const last60={};for(let i=59;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i);const k=d.toISOString().slice(0,10);last60[k]=allTxs.filter(t=>t.date?.slice(0,10)===k).length;}
      const sd={txs:allTxs.length,budgets:mB.length,over,goals:goals.length,rate,streak,positive:cI>cE};
      let gam={xp:0,level:1,earned:[]};try{gam=await window.getSetting?.(uid,'fp_gam_v4',gam)||gam;}catch(e){}
      const newEarned=[];
      for(const a of ACH){if(gam.earned.includes(a.id))continue;if(a.check(sd)){gam.earned.push(a.id);gam.xp+=a.xp;newEarned.push(a);}}
      gam.level=Math.max(1,Math.floor(gam.xp/500)+1);
      if(newEarned.length){try{await window.setSetting?.(uid,'fp_gam_v4',gam);}catch(e){}newEarned.forEach(a=>setTimeout(()=>T(`🏅 ${a.name} +${a.xp} XP`,'success'),800));}
      const cats=window.S?.cats||[];const catSpend={};
      cur.filter(t=>t.type==='expense').forEach(t=>{const c=cats.find(c=>String(c.id)===String(t.categoryId));if(c)catSpend[c.name]=(catSpend[c.name]||0)+t.amount;});
      const top=Object.entries(catSpend).sort((a,b)=>b[1]-a[1])[0];
      const dim=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();const dLeft=dim-now.getDate();
      const chs=[];
      if(top&&top[1]>20){const tg=top[1]*0.85;chs.push({icon:'✂️',color:'#3b82f6',title:`Reduzir ${top[0]} em 15%`,desc:`Atual: ${fmtR(top[1])} · Meta: ${fmtR(tg)}`,prog:top[1]<=tg?100:70,xp:200,done:top[1]<=tg});}
      if(cI>0){const tgR=Math.max(20,rate+5);chs.push({icon:'💰',color:'#10b981',title:`Poupar ${tgR}% da renda`,desc:`Taxa atual: ${rate}% · Meta: ${tgR}%`,prog:Math.min(100,Math.round(rate/tgR*100)),xp:300,done:rate>=tgR});}
      const stTg=streak>=7?30:streak>=3?7:3;
      chs.push({icon:'🔥',color:'#f59e0b',title:`Sequência de ${stTg} dias`,desc:`Streak atual: ${streak} dia${streak!==1?'s':''}`,prog:Math.min(100,Math.round(streak/stTg*100)),xp:stTg*10,done:streak>=stTg});
      if(mB.length===0)chs.push({icon:'🎯',color:'#8b5cf6',title:'Criar orçamentos mensais',desc:'Defina limites para suas categorias',prog:0,xp:150,done:false,action:"navigate('budgets')"});
      else if(over===0)chs.push({icon:'🛡️',color:'#10b981',title:'Manter orçamentos sem estouro',desc:`${dLeft} dias restantes`,prog:Math.round((dim-dLeft)/dim*100),xp:250,done:false});
      if(goals.length===0)chs.push({icon:'🌟',color:'#f59e0b',title:'Criar uma meta financeira',desc:'Reserve para um objetivo futuro',prog:0,xp:100,done:false,action:"navigate('goals')"});
      const weeks=[];let wk=[];
      Object.entries(last60).forEach(([date,count],i)=>{if(i===0){const dow=new Date(date+'T12:00:00').getDay();for(let p=0;p<dow;p++)wk.push(null);}wk.push({date,count});if(wk.length===7){weeks.push(wk);wk=[];}});
      if(wk.length)weeks.push(wk);
      const calHtml=weeks.map(w=>`<div style="display:flex;flex-direction:column;gap:2px">${w.map(d=>d?`<div title="${d.date}: ${d.count}tx" style="width:12px;height:12px;border-radius:2px;background:${d.count===0?'var(--bdr)':d.count>=3?'#16a34a':'#86efac'}"></div>`:'<div style="width:12px;height:12px"></div>').join('')}</div>`).join('');
      const xpPct=Math.min(100,Math.round((gam.xp-(gam.level-1)*500)/(gam.level*500)*100));
      zone.innerHTML=`<div class="page-hdr"><div><h1 class="page-title"><i class="fas fa-trophy" style="color:#f59e0b"></i> Desafios & Conquistas</h1><p class="page-sub">Baseado nos seus dados reais</p></div><button class="btn btn-outline btn-sm" onclick="window.loadChallenges()"><i class="fas fa-sync"></i> Atualizar</button></div>
<div class="stats-grid" style="margin-bottom:1rem">
<div class="stat-card"><div class="stat-icon" style="background:#f59e0b"><i class="fas fa-star"></i></div><div><div class="stat-label">XP Total</div><div class="stat-value">${gam.xp.toLocaleString('pt-BR')}</div></div></div>
<div class="stat-card"><div class="stat-icon" style="background:#ef4444"><i class="fas fa-fire"></i></div><div><div class="stat-label">Streak</div><div class="stat-value">${streak} dias</div></div></div>
<div class="stat-card"><div class="stat-icon" style="background:#8b5cf6"><i class="fas fa-medal"></i></div><div><div class="stat-label">Conquistas</div><div class="stat-value">${gam.earned.length}/${ACH.length}</div></div></div>
<div class="stat-card"><div class="stat-icon" style="background:#10b981"><i class="fas fa-piggy-bank"></i></div><div><div class="stat-label">Poupança</div><div class="stat-value">${rate}%</div></div></div>
</div>
<div class="card" style="padding:.85rem 1rem;margin-bottom:.85rem"><div style="display:flex;justify-content:space-between;font-size:.83rem;margin-bottom:.35rem"><span style="font-weight:700;color:var(--accent)">Nível ${gam.level}</span><span style="color:var(--txt2)">${gam.xp}/${gam.level*500} XP</span></div><div style="height:8px;background:var(--bdr);border-radius:4px;overflow:hidden"><div style="width:${xpPct}%;height:100%;background:linear-gradient(90deg,var(--accent),#3b82f6);border-radius:4px;transition:width .6s"></div></div></div>
<div class="card" style="margin-bottom:.85rem;padding:.85rem 1rem"><div class="card-hdr" style="padding:0 0 .65rem"><span class="card-title"><i class="fas fa-fire" style="color:#f59e0b"></i> Atividade (60 dias)</span><span style="font-size:.78rem;color:var(--txt2)">Streak: <strong style="color:#f59e0b">${streak} dia${streak!==1?'s':''}</strong></span></div><div style="display:flex;gap:2px;flex-wrap:nowrap;overflow-x:auto;padding:4px 0">${calHtml}</div></div>
<div class="card" style="margin-bottom:.85rem"><div class="card-hdr"><span class="card-title"><i class="fas fa-bolt" style="color:var(--warning)"></i> Desafios do Mês</span></div><div style="padding:.5rem 1rem 1rem">${chs.length?chs.map(ch=>`<div style="display:flex;align-items:center;gap:.75rem;padding:.75rem 0;border-bottom:1px solid var(--bdr)"><div style="width:38px;height:38px;border-radius:10px;background:${ch.color}22;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">${ch.icon}</div><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:.3rem;flex-wrap:wrap;margin-bottom:.15rem"><span style="font-size:.87rem;font-weight:600">${esc(ch.title)}</span><span style="font-size:.65rem;padding:1px 6px;border-radius:99px;background:var(--bg-s);color:var(--txt2)">+${ch.xp} XP</span>${ch.done?'<span style="font-size:.65rem;padding:1px 6px;border-radius:99px;background:#dcfce7;color:#15803d;font-weight:700">✓ COMPLETO</span>':''}</div><div style="font-size:.75rem;color:var(--txt2);margin-bottom:.35rem">${ch.desc}</div><div style="height:6px;background:var(--bdr);border-radius:3px;overflow:hidden"><div style="width:${ch.prog}%;height:100%;background:${ch.done?'#10b981':ch.color};border-radius:3px;transition:width .6s"></div></div><div style="display:flex;justify-content:space-between;font-size:.68rem;color:var(--txt2);margin-top:2px"><span>${ch.prog}%</span>${ch.action?`<button onclick="${ch.action}" style="background:none;border:none;color:${ch.color};font-size:.72rem;cursor:pointer;font-weight:600">Ir agora →</button>`:''}</div></div></div>`).join(''):'<p style="color:var(--txt2);font-size:.85rem;padding:.75rem 0">Registre transações para gerar desafios!</p>'}</div></div>
<div class="card"><div class="card-hdr"><span class="card-title"><i class="fas fa-medal" style="color:#f59e0b"></i> Conquistas</span><span style="font-size:.75rem;color:var(--txt2)">${gam.earned.length}/${ACH.length}</span></div><div style="padding:.75rem 1rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:.6rem">${ACH.map(a=>{const ok=gam.earned.includes(a.id);return`<div style="padding:.75rem;border-radius:10px;border:1.5px solid ${ok?'var(--accent)':'var(--bdr)'};background:${ok?'rgba(var(--accent-rgb),.06)':'var(--bg-s)'};opacity:${ok?1:.45}"><div style="font-size:1.5rem;margin-bottom:.25rem">${a.icon}</div><div style="font-size:.82rem;font-weight:700">${a.name}</div><div style="font-size:.7rem;color:var(--txt2);margin:.1rem 0 .3rem;line-height:1.3">${a.desc}</div><div style="font-size:.7rem;font-weight:700;color:${ok?'var(--accent)':'var(--txt3)'}">+${a.xp} XP${ok?' ✓':''}</div></div>`;}).join('')}</div></div>`;
      log('✅ Desafios OK');
    }catch(e){warn('loadChallenges err:',e);zone.innerHTML=`<div style="padding:2rem;text-align:center"><div style="color:var(--danger);margin-bottom:.5rem">⚠️ Erro: ${esc(e.message)}</div><button class="btn btn-outline btn-sm" onclick="window.loadChallenges()">Tentar novamente</button></div>`;}
  });
};

/* ════ FRAUDES ════ */
window.loadAnomalies = window.loadAnomalies || function(){
  const zone=$('page-anomalies');if(!zone){warn('page-anomalies not found');return;}
  const listEl=$('anomalyList');
  const target=listEl||zone;
  target.innerHTML='<div style="padding:2rem;text-align:center;color:var(--txt2)"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem"></i><br><br>Analisando transações...</div>';
  ready(async(db,user)=>{
    if(!user){target.innerHTML='<div style="padding:2rem;text-align:center;color:var(--txt2)">Faça login para analisar.</div>';return;}
    try{
      const uid=user.id;const now=new Date();const month=now.toISOString().slice(0,7);
      const ms=month+'-01';const me=new Date(now.getFullYear(),now.getMonth()+1,0).toISOString().split('T')[0];
      const cats=window.S?.cats||[];
      const txs=await db.transactions.where('userId').equals(uid).toArray().catch(()=>[]);
      const cur=txs.filter(t=>t.date>=ms&&t.date<=me&&t.type==='expense');
      const alerts=[];
      // Outliers
      const byCat={};txs.filter(t=>t.type==='expense').forEach(t=>{const k=String(t.categoryId||'x');(byCat[k]=byCat[k]||[]).push(t.amount);});
      txs.filter(t=>t.type==='expense').forEach(t=>{const k=String(t.categoryId||'x');const arr=byCat[k]||[];if(arr.length<4)return;const mean=arr.reduce((s,v)=>s+v,0)/arr.length;const std=Math.sqrt(arr.reduce((s,v)=>s+(v-mean)**2,0)/arr.length);const z=std>0?Math.abs(t.amount-mean)/std:0;if(z>2.5){const c=cats.find(c=>String(c.id)===k);alerts.push({id:`out-${t.id}`,sev:z>3.5?'high':'mid',icon:'fa-chart-bar',title:`Valor atípico${c?` em ${c.name}`:''}`,desc:`"${esc(t.description||'Sem desc')}" — ${fmtR(t.amount)} (${z.toFixed(1)}σ da média ${fmtR(mean)})`,date:t.date});}});
      // Duplicatas
      const srt=[...txs].sort((a,b)=>(a.date||'').localeCompare(b.date||''));const seen=new Set();
      srt.forEach((t,i)=>{if(seen.has(t.id))return;const d1=new Date(t.date||0);for(let j=i+1;j<srt.length;j++){const t2=srt[j];const d2=new Date(t2.date||0);if((d2-d1)>3*86400000)break;if(Math.abs((t.amount||0)-(t2.amount||0))<0.01&&norm(t.description||'')===norm(t2.description||'')&&t.type===t2.type){seen.add(t2.id);alerts.push({id:`dup-${t.id}`,sev:'high',icon:'fa-copy',title:'Possível duplicata',desc:`"${esc(t.description||'Sem desc')}" — ${fmtR(t.amount)} em ${t.date} e ${t2.date}`,date:t2.date});}}});
      // Alta vs média
      if(cur.length>=5){const avg=cur.reduce((s,t)=>s+t.amount,0)/cur.length;cur.forEach(t=>{if(t.amount>avg*4&&t.amount>100)alerts.push({id:`hi-${t.id}`,sev:'mid',icon:'fa-fire',title:'Gasto acima da média',desc:`"${esc(t.description||'Sem desc')}" — ${fmtR(t.amount)} = ${(t.amount/avg).toFixed(1)}× média (${fmtR(avg)})`,date:t.date});});}
      // Spike vs meses anteriores
      cats.filter(c=>c.type==='expense').forEach(cat=>{const cs=cur.filter(t=>String(t.categoryId)===String(cat.id)).reduce((s,t)=>s+t.amount,0);const pv=[];for(let i=1;i<=3;i++){const dd=new Date(now.getFullYear(),now.getMonth()-i,1);const mm=dd.toISOString().slice(0,7);const v=txs.filter(t=>t.date?.startsWith(mm)&&t.type==='expense'&&String(t.categoryId)===String(cat.id)).reduce((s,t)=>s+t.amount,0);if(v>0)pv.push(v);}if(pv.length>=2){const pa=pv.reduce((s,v)=>s+v,0)/pv.length;if(cs>pa*2.5&&cs>50)alerts.push({id:`sp-${cat.id}`,sev:'mid',icon:'fa-chart-line',title:`${cat.name}: +${Math.round(cs/pa*100-100)}% vs média`,desc:`Este mês: ${fmtR(cs)} · Média 3 meses: ${fmtR(pa)}`,date:month});}});
      // Assinaturas
      const dg={};txs.filter(t=>t.type==='expense').forEach(t=>{const k=norm(t.description||'');if(k.length>3)(dg[k]=dg[k]||[]).push(t);});
      for(const[d,g]of Object.entries(dg)){if(g.length<2)continue;const dates=g.map(t=>new Date(t.date||0)).sort((a,b)=>a-b);const gaps=[];for(let i=1;i<dates.length;i++)gaps.push((dates[i]-dates[i-1])/86400000);const ag=gaps.length?gaps.reduce((s,v)=>s+v,0)/gaps.length:0;const la=g[g.length-1].amount;if(ag>=25&&ag<=35&&la>5&&g.every(t=>Math.abs(t.amount-la)<la*0.15))alerts.push({id:`rec-${d.slice(0,15)}`,sev:'low',icon:'fa-repeat',title:'Assinatura não cadastrada',desc:`"${esc(d)}" — ${fmtR(la)}/mês`,date:g[g.length-1].date});}
      const uniq=[];const sIds=new Set();for(const a of alerts){if(!sIds.has(a.id)){sIds.add(a.id);uniq.push(a);}}uniq.sort((a,b)=>({high:0,mid:1,low:2}[a.sev]||2)-({high:0,mid:1,low:2}[b.sev]||2));
      const hi=uniq.filter(a=>a.sev==='high').length,mi=uniq.filter(a=>a.sev==='mid').length,lo=uniq.filter(a=>a.sev==='low').length;
      [['anomalyHigh',hi],['anomalyMid',mi],['anomalyLow',lo],['anomalyTotal',txs.length]].forEach(([id,v])=>{const el=$(id);if(el)el.textContent=v;});
      const ts=$('anomalyLastScan');if(ts)ts.textContent=`Verificado: ${new Date().toLocaleTimeString('pt-BR')}`;
      const S={high:{label:'Alta',bg:'rgba(239,68,68,.1)',bdr:'var(--danger)',ic:'var(--danger)'},mid:{label:'Média',bg:'rgba(245,158,11,.08)',bdr:'var(--warning)',ic:'var(--warning)'},low:{label:'Info',bg:'rgba(59,130,246,.08)',bdr:'#3b82f6',ic:'#3b82f6'}};
      const cont=$('anomalyList')||zone;
      if(!uniq.length){cont.innerHTML='<div style="text-align:center;padding:2.5rem"><div style="font-size:3rem;margin-bottom:.5rem">🛡️</div><div style="font-size:.95rem;font-weight:600">Tudo em dia!</div><div style="font-size:.83rem;color:var(--txt2);margin-top:.25rem">Nenhum padrão suspeito em '+txs.length+' transações.</div></div>';}
      else{cont.innerHTML='<div style="font-size:.83rem;color:var(--txt2);margin-bottom:.6rem">'+uniq.length+' alerta(s): <strong style="color:var(--danger)">'+hi+' alta</strong> · <strong style="color:var(--warning)">'+mi+' média</strong> · <strong style="color:#3b82f6">'+lo+' info</strong></div>'+uniq.map(a=>{const s=S[a.sev]||S.low;return'<div style="display:flex;gap:.65rem;padding:.75rem;border-radius:10px;background:'+s.bg+';border-left:3px solid '+s.bdr+';margin-bottom:.5rem"><i class="fas '+a.icon+'" style="color:'+s.ic+';margin-top:2px;flex-shrink:0"></i><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:.3rem;flex-wrap:wrap;margin-bottom:.15rem"><span style="font-size:.85rem;font-weight:600">'+esc(a.title)+'</span><span style="font-size:.65rem;padding:1px 6px;border-radius:99px;background:'+s.bdr+';color:#fff;font-weight:700">'+s.label+'</span></div><div style="font-size:.78rem;color:var(--txt2);margin-bottom:.2rem;line-height:1.4">'+esc(a.desc)+'</div><div style="font-size:.72rem;color:var(--txt2)">'+(a.date||'')+'</div></div></div>';}).join('');}
      log('✅ Anomalias OK:',uniq.length);
    }catch(e){warn('loadAnomalies err:',e);const c=$('anomalyList')||zone;c.innerHTML='<div style="padding:1.5rem;text-align:center"><div style="color:var(--danger);font-size:.85rem;margin-bottom:.5rem">Erro: '+esc(e.message)+'</div><button class="btn btn-outline btn-sm" onclick="window.loadAnomalies()">Tentar novamente</button></div>';}
  });
};

/* ════ EDUCAÇÃO ════ */
const EDU=[
  {id:'r5030',mod:'Fundamentos',icon:'💡',color:'#3b82f6',dur:'3 min',title:'Regra 50/30/20',
   body:'<p>Divida sua renda em 3:</p><ul><li><b>50% Necessidades:</b> aluguel, alimentação, transporte</li><li><b>30% Desejos:</b> lazer, restaurantes, assinaturas</li><li><b>20% Poupança:</b> reserva, investimentos, metas</li></ul><div style="background:rgba(var(--accent-rgb),.08);border-left:3px solid var(--accent);padding:.65rem .9rem;border-radius:0 8px 8px 0;margin:.75rem 0;font-size:.83rem"><b>Com R$ 5.000:</b> Necessidades R$ 2.500 · Desejos R$ 1.500 · Poupança R$ 1.000</div>',
   quiz:{q:'Qual % deve ir para poupança?',opts:['10%','20%','30%','50%'],ans:1}},
  {id:'reserve',mod:'Fundamentos',icon:'💡',color:'#3b82f6',dur:'4 min',title:'Reserva de Emergência',
   body:'<p>Base de qualquer planejamento sólido.</p><ul><li><b>Quanto:</b> 3–6 meses de despesas</li><li><b>Onde:</b> CDB liquidez diária ou Tesouro Selic</li><li><b>Nunca em:</b> ações ou fundos ilíquidos</li></ul>',
   quiz:{q:'Quantos meses de despesas?',opts:['1–2','3–6','6–12','12+'],ans:1}},
  {id:'compound',mod:'Fundamentos',icon:'💡',color:'#3b82f6',dur:'5 min',title:'Juros Compostos',
   body:'<p>8ª maravilha do mundo. Juros sobre juros — trabalha por você ou contra.</p><div style="font-family:monospace;background:var(--bg-s);padding:.5rem;border-radius:8px;text-align:center;font-weight:600;margin:.5rem 0">Montante = Capital × (1 + taxa)^tempo</div><div style="background:rgba(var(--accent-rgb),.08);border-left:3px solid var(--accent);padding:.65rem .9rem;border-radius:0 8px 8px 0;margin:.75rem 0;font-size:.83rem"><b>R$ 500/mês × 10 anos × 10% a.a. = ~R$ 102.000</b> (investiu R$ 60.000)</div>',
   quiz:{q:'Juros compostos incidem sobre:',opts:['Só capital','Capital + juros acumulados','Só juros','Nenhum'],ans:1}},
  {id:'avalanche',mod:'Dívidas',icon:'💳',color:'#ef4444',dur:'3 min',title:'Método Avalanche',
   body:'<p>Pague primeiro a <b>dívida com maior juros</b>. Economiza mais no longo prazo.</p><ol><li>Liste todas com suas taxas</li><li>Pague mínimo de todas</li><li>Direcione o extra para a de MAIOR juros</li></ol>',
   quiz:{q:'Qual dívida atacar primeiro?',opts:['Maior valor','Maior juros','Menor valor','Menor prazo'],ans:1}},
  {id:'snowball',mod:'Dívidas',icon:'💳',color:'#ef4444',dur:'3 min',title:'Método Bola de Neve',
   body:'<p>Pague primeiro a <b>dívida de menor valor</b>. Motiva com vitórias rápidas.</p><ol><li>Liste por valor (menor → maior)</li><li>Quite a menor primeiro</li><li>Use o liberado para a próxima</li></ol>',
   quiz:{q:'Qual dívida pagar primeiro?',opts:['Maior juros','Maior valor','Menor valor','Mais antiga'],ans:2}},
  {id:'diversify',mod:'Investimentos',icon:'📈',color:'#10b981',dur:'4 min',title:'Diversificação',
   body:'<p>Não coloque tudo no mesmo lugar. Reduz risco sem reduzir retorno esperado.</p><ul><li><b>Por classe:</b> renda fixa + ações + imóveis</li><li><b>Por prazo:</b> curto + médio + longo</li></ul><div style="background:rgba(var(--accent-rgb),.08);border-left:3px solid var(--accent);padding:.65rem .9rem;border-radius:0 8px 8px 0;margin:.75rem 0;font-size:.83rem"><b>Iniciante:</b> 60% Tesouro Selic · 30% CDB · 10% Ações/FIIs</div>',
   quiz:{q:'Principal benefício:',opts:['Garantir lucro','Reduzir riscos','Aumentar impostos','Complicar'],ans:1}},
  {id:'autopilot',mod:'Comportamento',icon:'🧠',color:'#8b5cf6',dur:'3 min',title:'Piloto Automático',
   body:'<p>Automatize para remover dependência de força de vontade.</p><ol><li>Dia do salário → transferência automática para poupança</li><li>Contas fixas → débito automático</li><li>Registro de gastos → 5 minutos/dia</li><li>Revisão mensal → 30 minutos</li></ol>',
   quiz:{q:'Principal vantagem de automatizar:',opts:['Ganha mais','Remove dependência de força de vontade','Aumenta gastos','Complica'],ans:1}},
];
let _es={i:0,quiz:{},done:{}};
window.loadEducation = window.loadEducation || function(){
  const zone=$('page-education');if(!zone){warn('page-education not found');return;}
  ready(async(db,user)=>{
    if(!user){zone.innerHTML='<div style="padding:2rem;text-align:center;color:var(--txt2)">Faça login para acessar.</div>';return;}
    try{const sv=await window.getSetting?.(user.id,'fp_edu_v5',{}).catch(()=>({}))||{};if(sv.quiz)_es.quiz=sv.quiz;if(sv.done)_es.done=sv.done;}catch(e){}
    _renderEdu(zone,user);
  });
};
function _renderEdu(zone,user){
  try{
    const dn=Object.values(_es.done).filter(Boolean).length;const pct=Math.round(dn/EDU.length*100);
    const lesson=EDU[_es.i]||EDU[0];const mods=[...new Set(EDU.map(l=>l.mod))];
    zone.innerHTML=`<div class="page-hdr"><div><h1 class="page-title"><i class="fas fa-graduation-cap" style="color:var(--accent)"></i> Educação Financeira</h1><p class="page-sub">${dn}/${EDU.length} lições concluídas · 100% offline</p></div></div>
<div class="card" style="margin-bottom:1rem;padding:.85rem 1rem"><div style="display:flex;justify-content:space-between;font-size:.83rem;margin-bottom:.35rem"><span style="font-weight:700">Progresso</span><span style="color:var(--txt2)">${dn}/${EDU.length} · ${pct}%</span></div><div style="height:8px;background:var(--bdr);border-radius:4px;overflow:hidden"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--accent),#3b82f6);border-radius:4px;transition:width .6s"></div></div></div>
<div style="display:grid;grid-template-columns:210px 1fr;gap:.85rem;align-items:start">
<div>${mods.map(mod=>{const ml=EDU.filter(l=>l.mod===mod);const mc=ml[0]?.color||'var(--accent)';const mi=ml[0]?.icon||'📚';const md=ml.filter(l=>_es.done[l.id]).length;return'<div style="margin-bottom:.5rem"><div style="display:flex;align-items:center;gap:.5rem;padding:.5rem .7rem;border-radius:9px;background:var(--bg-s);border:1px solid var(--bdr);font-size:.83rem;font-weight:600"><span>'+mi+'</span><span style="flex:1">'+mod+'</span><span style="font-size:.7rem;color:var(--txt2)">'+md+'/'+ml.length+'</span></div><div style="margin:.2rem 0 0 .5rem;display:flex;flex-direction:column;gap:.15rem">'+ml.map(l=>{const ia=l.id===lesson.id;const id2=EDU.findIndex(x=>x.id===l.id);return'<button onclick="window._eduGo('+id2+')" style="text-align:left;padding:.35rem .7rem;border-radius:7px;border:none;cursor:pointer;font-size:.78rem;display:flex;align-items:center;gap:.4rem;background:'+(ia?mc:'transparent')+';color:'+(ia?'#fff':'var(--txt2)')+'">'+(_es.done[l.id]?'<i class="fas fa-check" style="font-size:.6rem;color:'+(ia?'#fff':mc)+'"></i>':'<i class="fas fa-circle" style="font-size:.35rem;opacity:.4"></i>')+l.title+'</button>';}).join('')+'</div></div>';}).join('')}</div>
<div class="card" style="padding:1.25rem"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.85rem;flex-wrap:wrap;gap:.5rem"><div><h2 style="font-size:1.05rem;font-weight:700;margin:0">${lesson.title}</h2><div style="font-size:.75rem;color:var(--txt2);margin-top:.2rem"><i class="fas fa-clock"></i> ${lesson.dur}</div></div><span style="font-size:.68rem;padding:2px 10px;border-radius:99px;background:${lesson.color}20;color:${lesson.color};font-weight:700">${lesson.icon} ${lesson.mod}</span></div>
<div style="font-size:.87rem;line-height:1.7;color:var(--txt)">${lesson.body}</div>
${lesson.quiz?`<div style="padding-top:1rem;border-top:1px solid var(--bdr);margin-top:.85rem"><div style="font-size:.82rem;font-weight:700;margin-bottom:.6rem">🧠 Teste seu conhecimento</div><div style="font-size:.83rem;margin-bottom:.5rem">${lesson.quiz.q}</div><div style="display:flex;flex-direction:column;gap:.3rem">${lesson.quiz.opts.map((opt,oi)=>{const an=_es.quiz[lesson.id];let bg='var(--bg-s)',bdr='var(--bdr)',col='var(--txt)';if(an!==undefined){if(oi===lesson.quiz.ans){bg='rgba(16,185,129,.12)';bdr='var(--success)';col='var(--success)';}else if(oi===an&&an!==lesson.quiz.ans){bg='rgba(239,68,68,.1)';bdr='var(--danger)';col='var(--danger)';}}return`<button onclick="window._eduQuiz('${lesson.id}',${oi},${lesson.quiz.ans})" style="text-align:left;padding:.45rem .75rem;border-radius:8px;border:1.5px solid ${bdr};background:${bg};color:${col};cursor:${an!==undefined?'default':'pointer'};font-size:.8rem;transition:all .15s">${oi===lesson.quiz.ans&&an!==undefined?'✓ ':''}${opt}</button>`;}).join('')}</div></div>`:''}
<div style="display:flex;gap:.5rem;margin-top:1rem;justify-content:space-between"><button class="btn btn-ghost btn-sm" onclick="window._eduGo(${Math.max(0,_es.i-1)})" ${_es.i===0?'disabled':''}>← Anterior</button><button class="btn btn-primary btn-sm" onclick="window._eduNext('${lesson.id}')">${_es.done[lesson.id]?'Próxima →':'Marcar concluída →'}</button></div>
</div></div>`;
    window._eduGo=i=>{_es.i=Math.max(0,Math.min(EDU.length-1,i));_renderEdu(zone,user);};
    window._eduQuiz=async(lid,chosen,correct)=>{if(_es.quiz[lid]!==undefined)return;_es.quiz[lid]=chosen;T(chosen===correct?'✅ Correto!':'❌ Incorreto',chosen===correct?'success':'error');try{await window.setSetting?.(user.id,'fp_edu_v5',{quiz:_es.quiz,done:_es.done});}catch(e){}; _renderEdu(zone,user);};
    window._eduNext=async(lid)=>{_es.done[lid]=true;try{await window.setSetting?.(user.id,'fp_edu_v5',{quiz:_es.quiz,done:_es.done});}catch(e){};if(_es.i<EDU.length-1)_es.i++;_renderEdu(zone,user);};
    log('✅ Educação OK:',lesson.title);
  }catch(e){warn('_renderEdu err:',e);zone.innerHTML='<div style="padding:2rem;text-align:center"><div style="color:var(--danger);font-size:.85rem;margin-bottom:.5rem">Erro: '+esc(e.message)+'</div><button class="btn btn-outline btn-sm" onclick="window.loadEducation()">Tentar novamente</button></div>';}
}

/* ════ BENCHMARK ════ */
const NAT={'Alimentação':[28,22,18,14,'🍽️'],'Habitação':[36,32,28,22,'🏠'],'Transporte':[18,16,15,12,'🚗'],'Saúde':[8,9,10,11,'❤️'],'Educação':[3,5,7,9,'📚'],'Lazer':[4,7,9,11,'🎭'],'Vestuário':[6,5,4,4,'👔'],'Comunicação':[5,4,3,3,'📱'],'Financeiro':[6,8,10,13,'💰']};
const CW={'alimentação':'Alimentação','comida':'Alimentação','mercado':'Alimentação','supermercado':'Alimentação','ifood':'Alimentação','restaurante':'Alimentação','moradia':'Habitação','aluguel':'Habitação','condominio':'Habitação','luz':'Habitação','energia':'Habitação','agua':'Habitação','transporte':'Transporte','uber':'Transporte','gasolina':'Transporte','combustivel':'Transporte','taxi':'Transporte','saude':'Saúde','farmacia':'Saúde','medico':'Saúde','academia':'Saúde','educacao':'Educação','curso':'Educação','escola':'Educação','faculdade':'Educação','lazer':'Lazer','streaming':'Lazer','netflix':'Lazer','cinema':'Lazer','roupa':'Vestuário','vestuario':'Vestuário','celular':'Comunicação','internet':'Comunicação','telefone':'Comunicação','financeiro':'Financeiro','juros':'Financeiro','investimento':'Financeiro'};
window.loadBenchmark = window.loadBenchmark || function(){
  const zone=$('page-benchmark');if(!zone){warn('page-benchmark not found');return;}
  zone.innerHTML='<div class="page-hdr"><div><h1 class="page-title"><i class="fas fa-chart-bar" style="color:var(--accent)"></i> Benchmark Nacional</h1><p class="page-sub">POF/IBGE 2023 — médias por faixa de renda</p></div></div><div style="padding:3rem;text-align:center;color:var(--txt2)"><i class="fas fa-spinner fa-spin" style="font-size:2rem"></i><br><br>Carregando...</div>';
  ready(async(db,user)=>{
    if(!user){zone.innerHTML='<div style="padding:2rem;text-align:center;color:var(--txt2)">Faça login para ver o benchmark.</div>';return;}
    try{
      const uid=user.id;const now=new Date();const month=now.toISOString().slice(0,7);
      const ms=month+'-01';const me=new Date(now.getFullYear(),now.getMonth()+1,0).toISOString().split('T')[0];
      const[txs,cats2]=await Promise.all([db.transactions.where('userId').equals(uid).filter(t=>t.date>=ms&&t.date<=me).toArray().catch(()=>[]),(db.categories?.where('userId').equals(uid).toArray()||Promise.resolve(window.S?.cats||[])).catch(()=>window.S?.cats||[])]);
      const cats=cats2||window.S?.cats||[];
      const inc=txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
      const exp=txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
      const sm=1412;const tier=inc/sm<3?0:inc/sm<5?1:inc/sm<10?2:3;
      const tl=['Até 3 SM','3–5 SM','5–10 SM','Acima de 10 SM'];
      const uByI={};txs.filter(t=>t.type==='expense').forEach(t=>{const c=cats.find(c=>String(c.id)===String(t.categoryId));const n=norm(c?.name||'');const ibge=Object.entries(CW).find(([k])=>n.includes(k))?.[1];if(ibge)uByI[ibge]=(uByI[ibge]||0)+t.amount;});
      const base=inc||exp||3000;
      const rows=Object.entries(NAT).map(([cat,tiers])=>{const avg=tiers[tier];const na=base*avg/100;const ua=uByI[cat]||0;const up=base>0?Math.round(ua/base*100):0;const diff=up-avg;const has=ua>0;let status='nodata',label='Sem dados',color='var(--bdr)';if(has){if(diff<=-5){status='great';label='Ótimo';color='var(--success)';}else if(diff<=2){status='ok';label='Na média';color='var(--accent)';}else if(diff<=8){status='warn';label='Acima';color='var(--warning)';}else{status='bad';label='Muito acima';color='var(--danger)';}}return{cat,icon:tiers[4],avg,na,ua,up,diff,status,label,color,has};});
      let ss=0,sc=0;rows.forEach(r=>{if(!r.has)return;ss+=({great:100,ok:80,warn:50,bad:20}[r.status]||0);sc++;});
      const score=sc>0?Math.round(ss/sc):0;const sC=score>=80?'var(--success)':score>=60?'var(--accent)':score>=40?'var(--warning)':'var(--danger)';const sL=score>=80?'Excelente':score>=60?'Bom':score>=40?'Regular':'Atenção';
      zone.innerHTML=`<div class="page-hdr"><div><h1 class="page-title"><i class="fas fa-chart-bar" style="color:var(--accent)"></i> Benchmark Nacional</h1><p class="page-sub">POF/IBGE 2023 — médias por faixa de renda</p></div><div style="display:flex;gap:.5rem;align-items:center"><select class="form-inp" style="width:auto;font-size:.82rem" onchange="window._benchTier(this.value)">${tl.map((l,i)=>`<option value="${i}" ${i===tier?'selected':''}>${l}</option>`).join('')}</select><button class="btn btn-outline btn-sm" onclick="window.loadBenchmark()"><i class="fas fa-sync"></i></button></div></div>
<div class="card" style="display:grid;grid-template-columns:auto 1fr;gap:1rem;align-items:center;margin-bottom:1rem;padding:1rem"><div style="text-align:center;padding:.5rem"><div style="font-size:2.5rem;font-weight:900;color:${sC};line-height:1">${score}</div><div style="font-size:.72rem;font-weight:700;color:${sC};margin:.15rem 0">${sL}</div><div style="font-size:.68rem;color:var(--txt2)">Score geral</div></div><div><div style="font-size:.82rem;font-weight:600;margin-bottom:.25rem">Faixa: <strong>${tl[tier]}</strong></div>${inc>0?`<div style="font-size:.75rem;color:var(--txt2)">Renda: ${fmtR(inc)} · Gastos: ${fmtR(exp)}</div>`:'<div style="font-size:.75rem;color:var(--warning)">⚠ Sem receita — usando gastos como base</div>'}<div style="font-size:.72rem;color:var(--txt2);margin-top:.2rem">${month} · Fonte: POF/IBGE 2023</div></div></div>
<div class="card"><div class="card-hdr"><span class="card-title">Sua posição vs média — ${tl[tier]}</span></div><div style="padding:.5rem">${rows.map(r=>`<div style="padding:.65rem .5rem;border-bottom:1px solid var(--bdr)"><div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.3rem;flex-wrap:wrap"><span style="font-size:1.1rem">${r.icon}</span><span style="font-size:.85rem;font-weight:600;flex:1">${esc(r.cat)}</span><span style="font-size:.68rem;padding:2px 8px;border-radius:99px;background:${r.has?r.color+'22':'var(--bg-s)'};color:${r.has?r.color:'var(--txt2)'};font-weight:700">${r.label}</span>${r.has?`<span style="font-size:.72rem;color:${r.diff>2?'var(--danger)':r.diff<-2?'var(--success)':'var(--txt2)'}">${r.diff>0?'+':''}${r.diff}pp</span>`:''}</div><div style="display:flex;gap:.5rem"><div style="flex:1"><div style="display:flex;justify-content:space-between;font-size:.68rem;color:var(--txt2);margin-bottom:2px"><span>Média BR</span><span>${r.avg}% (${fmtR(r.na)})</span></div><div style="height:6px;background:var(--bdr);border-radius:3px;overflow:hidden"><div style="width:${Math.min(100,r.avg*3)}%;height:100%;background:rgba(100,100,100,.3);border-radius:3px"></div></div></div><div style="flex:1"><div style="display:flex;justify-content:space-between;font-size:.68rem;color:var(--txt2);margin-bottom:2px"><span>Seu gasto</span><span>${r.has?r.up+'% ('+fmtR(r.ua)+')':'—'}</span></div><div style="height:6px;background:var(--bdr);border-radius:3px;overflow:hidden"><div style="width:${Math.min(100,r.up*3)}%;height:100%;background:${r.color};border-radius:3px;transition:width .5s"></div></div></div></div>${r.has&&r.diff>5?`<div style="font-size:.72rem;color:var(--warning);margin-top:.2rem">⚠ ${fmtR(r.ua-r.na)} a mais que a média</div>`:''}</div>`).join('')}</div></div>`;
      window._benchTier=()=>window.loadBenchmark();
      log('✅ Benchmark OK, score:',score);
    }catch(e){warn('loadBenchmark err:',e);zone.innerHTML='<div style="padding:2rem;text-align:center"><div style="color:var(--danger);font-size:.85rem;margin-bottom:.5rem">Erro: '+esc(e.message)+'</div><button class="btn btn-outline btn-sm" onclick="window.loadBenchmark()">Tentar novamente</button></div>';}
  });
};

/* ════ POLLING 300ms ════ */
const LOADERS={
  'page-challenges':()=>{try{window.PageEvents?.emitLoading('challenges'); if(typeof window.loadChallenges==='function') window.loadChallenges(); else setTimeout(()=>window.loadChallenges?.(),500);}catch(e){warn('call loadChallenges',e);} finally{setTimeout(()=>window.PageEvents?.emitLoaded('challenges'),200);} },
  'page-anomalies':()=>{try{window.PageEvents?.emitLoading('anomalies'); if(typeof window.loadAnomalies==='function') window.loadAnomalies(); else setTimeout(()=>window.loadAnomalies?.(),500);}catch(e){warn('call loadAnomalies',e);} finally{setTimeout(()=>window.PageEvents?.emitLoaded('anomalies'),200);} },
  'page-education':()=>{try{window.PageEvents?.emitLoading('education'); if(typeof window.loadEducation==='function') window.loadEducation(); else setTimeout(()=>window.loadEducation?.(),500);}catch(e){warn('call loadEducation',e);} finally{setTimeout(()=>window.PageEvents?.emitLoaded('education'),200);} },
  'page-benchmark':()=>{try{window.PageEvents?.emitLoading('benchmark'); if(typeof window.loadBenchmark==='function') window.loadBenchmark(); else setTimeout(()=>window.loadBenchmark?.(),500);}catch(e){warn('call loadBenchmark',e);} finally{setTimeout(()=>window.PageEvents?.emitLoaded('benchmark'),200);} },
};
let _prev='';
function _poll(){
  try{const a=document.querySelector('.page.active');if(!a)return;const id=a.id;if(id===_prev)return;_prev=id;const fn=LOADERS[id];if(fn){log('Página ativa:',id);fn();}}catch(e){warn('poll err:',e);}
}
function init(){
  setInterval(_poll,300);
  setTimeout(_poll,600);
  log('✅ fp-core-pages.js v4.0 — polling ativo');
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}
})();
