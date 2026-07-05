/* fp-activity-indicator.js — UI indicator for active page/task work */
(function(){'use strict';
const waitFor = async (fn, attempts=60, delay=200) => {let i=0; while(i++<attempts){ try{ if(fn()) return true;}catch{} await new Promise(r=>setTimeout(r,delay)); } return false; };

async function init(){
  const ready = await waitFor(()=>window.EventBus && document.getElementById('activityIndicator'));
  if(!ready) return console.warn('[FP-ACT] dependencies not ready');
  const dot = document.getElementById('activityDot');
  const countEl = document.getElementById('activityCount');
  let active=0;
  const updateUI = ()=>{
    if(active>0){ dot.style.background = 'var(--accent)'; countEl.style.display='inline'; countEl.textContent = active; }
    else { dot.style.background = 'transparent'; countEl.style.display='none'; }
    const title = active>0 ? `${active} tarefas/atividades em andamento` : 'Nenhuma atividade';
    document.getElementById('activityIndicator').setAttribute('title', title);
  };

  const inc = ()=>{ active = Math.max(0, active+1); updateUI(); };
  const dec = ()=>{ active = Math.max(0, active-1); updateUI(); };

  window.EventBus.on('page:loading', (p)=>{ inc(); setTimeout(()=>dec(), 2000); });
  window.EventBus.on('page:loaded', (p)=>{ dec(); });
  window.EventBus.on('task:started', (id,info)=>{ inc(); });
  window.EventBus.on('task:progress', (id,prog)=>{ /* could show progress per task */ window.EventBus?.emit('activity:progress', id, prog); });
  window.EventBus.on('task:done', (id,res)=>{ dec(); });
  window.EventBus.on('task:error', (id,err)=>{ dec(); });

  // initial state
  updateUI();
  console.log('[FP-ACT] activity indicator ready');
}

init();

})();
