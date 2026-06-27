/* fp-telemetry.js — listen to EventBus and persist telemetry to db.reports */
(function(){'use strict';
const waitFor = async (fn, attempts=60, delay=200) => {let i=0; while(i++<attempts){ try{ if(fn()) return true;}catch{} await new Promise(r=>setTimeout(r,delay)); } return false; };

async function initTelemetry(){
  const ready = await waitFor(()=>window.EventBus && window.db && window.S);
  if(!ready){console.warn('[FP-TELEMETRY] dependencies not ready'); return; }
  const bus = window.EventBus;
  async function addReport(ev,meta={}){
    try{
      const rec = {userId: window.S?.user?.id || null, event: ev, ts: new Date().toISOString(), meta};
      if(window.db?.reports) await window.db.reports.add(rec);
      else console.log('[FP-TELEMETRY] no reports table, rec=',rec);
      window.EventBus?.emit('db:reports:updated', {event:ev,meta});
    }catch(e){console.warn('[FP-TELEMETRY] write err',e);}  
  }

  bus.on('page:loading', (page)=>{ addReport('page:loading',{page}); });
  bus.on('page:loaded', (page)=>{ addReport('page:loaded',{page}); });
  bus.on('task:started', (id,info)=>{ addReport('task:started',{id,info}); });
  bus.on('task:progress', (id,progress)=>{ addReport('task:progress',{id,progress}); });
  bus.on('task:done', (id,result)=>{ addReport('task:done',{id,result}); });
  bus.on('task:error', (id,err)=>{ addReport('task:error',{id,err}); });
  bus.on('suggestion:accepted', (payload)=>{ addReport('suggestion:accepted',payload); });
  bus.on('ai:suggestions:refresh', (items)=>{ addReport('ai:suggestions:refresh',{count:(items?.length||0)}); });
  bus.on('ai:assistant:opened', ()=>{ addReport('ai:assistant:opened'); });
  bus.on('ai:assistant:closed', ()=>{ addReport('ai:assistant:closed'); });
  bus.on('ai:assistant:message', (role,message)=>{ addReport('ai:assistant:message',{role,message}); });

  // track navigation clicks too
  document.addEventListener('click', e=>{
    const nav = e.target.closest && e.target.closest('.nav-item[data-page]');
    if(nav){ const p = nav.dataset.page; addReport('nav:click',{page:p}); }
  });

  console.log('[FP-TELEMETRY] initialized — listening to EventBus');
}

initTelemetry();

})();
