/* fp-progress-bar.js — global progress bar with per-task estimates */
(function(){'use strict';
const waitFor = async (fn, attempts=60, delay=200) => {let i=0; while(i++<attempts){ try{ if(fn()) return true;}catch{} await new Promise(r=>setTimeout(r,delay)); } return false; };
async function init(){
  const ready = await waitFor(()=>window.EventBus && document.getElementById('globalProgress'));
  if(!ready) return console.warn('[FP-PROG] dependencies not ready');
  const bar = document.getElementById('globalProgressBar');
  const label = document.getElementById('globalProgressLabel');
  const tasks = new Map(); // id -> {start,progress,history[]}

  function updateUI(){
    // compute weighted progress average
    const arr = Array.from(tasks.values()); if(arr.length===0){bar.style.width='0%'; label.textContent=''; return;}
    let sum=0, w=0; for(const t of arr){const p=t.progress||0; const weight=1; sum+=p*weight; w+=weight;} const avg = Math.round(sum/w);
    bar.style.width = avg + '%';
    // estimate remaining seconds naive: use average speed per task
    let eta=''; const now=Date.now(); let totRem=0, totWeight=0; for(const t of arr){const elapsed=(now - t.start)/1000; const prog=t.progress||0; const speed = prog>0? prog/elapsed : 0; const rem = speed>0? Math.max(0, (100-prog)/speed) : Infinity; if(isFinite(rem)){totRem += rem; totWeight++;}}
    if(totWeight>0){ const est=Math.round(totRem/totWeight); eta = est>0? ` · ~${est}s` : ''; }
    label.textContent = arr.length + ' tarefas ativas · ' + avg + '%' + eta;
  }

  window.EventBus.on('task:started', (id,info)=>{ tasks.set(id,{start:Date.now(),progress:0,info,history:[]}); updateUI(); });
  window.EventBus.on('task:progress', (id,prog)=>{ const t=tasks.get(id); if(t){ t.progress=prog; t.history.push([Date.now(),prog]); } updateUI(); });
  window.EventBus.on('task:done',(id,res)=>{ tasks.delete(id); updateUI(); });
  window.EventBus.on('task:error',(id,err)=>{ tasks.delete(id); updateUI(); });
  window.EventBus.on('task:cancelled',(id)=>{ tasks.delete(id); updateUI(); });

  updateUI();
  console.log('[FP-PROG] Global progress bar ready');
}
init();
})();
