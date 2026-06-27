/* fp-core-bus.js — Event Bus + TaskManager + Worker bridge */
(function(){'use strict';
// Simple Pub/Sub EventBus
class EventBus{
  constructor(){this._h={};}
  on(ev,fn){(this._h[ev]=this._h[ev]||[]).push(fn);return()=>this.off(ev,fn);} 
  off(ev,fn){if(!this._h[ev])return;this._h[ev]=this._h[ev].filter(f=>f!==fn);} 
  emit(ev,...args){(this._h[ev]||[]).slice().forEach(fn=>{try{fn(...args);}catch(e){console.warn('[EventBus] handler err',e);}});} 
}

// TaskManager: schedules lightweight tasks, optionally delegated to a Web Worker
class TaskManager{
  constructor(){this.tasks=new Map();this._id=1;this.worker=null;}
  ensureWorker(){if(this.worker)return;try{this.worker=new Worker('fp-worker.js');this.worker.onmessage=e=>this._onWorkerMessage(e);this.worker.onerror=e=>console.warn('[TaskManager] worker err',e);}catch(e){console.warn('[TaskManager] worker create failed',e);this.worker=null;}}
  _onWorkerMessage(e){const {id,type,progress,result,error}=e.data||{};const t=this.tasks.get(id);if(!t)return; try{ if(type==='progress'){ if(t.onprogress) t.onprogress(progress); window.EventBus?.emit('task:progress', id, progress); }
      else if(type==='done'){ t.resolve(result); window.EventBus?.emit('task:done', id, result); this.tasks.delete(id); }
      else if(type==='error'){ t.reject(error); window.EventBus?.emit('task:error', id, error); this.tasks.delete(id); }
    }catch(e){console.warn('[TaskManager] _onWorkerMessage handler err',e);} }
  runInWorker(payload,onprogress){this.ensureWorker();const id='t'+(this._id++);window.EventBus?.emit('task:started', id, payload||{});return new Promise((resolve,reject)=>{this.tasks.set(id,{resolve,reject,onprogress,info:payload||{}}); try{this.worker.postMessage(Object.assign({id},payload));}catch(e){this.tasks.delete(id);reject(e);} });}
  schedule(fn,delay=0){const id='s'+(this._id++);const t=setTimeout(async()=>{try{window.EventBus?.emit('task:started', id, {scheduled:true}); await fn(); window.EventBus?.emit('task:done', id, {scheduled:true});}catch(e){console.warn('[TaskManager] scheduled fn err',e); window.EventBus?.emit('task:error', id, e);} this.tasks.delete(id);},delay);this.tasks.set(id,{timer:t});return ()=>{clearTimeout(t);this.tasks.delete(id);} }
  // Return snapshot list of tasks
  list(){const out=[];for(const [id,v] of this.tasks.entries()){const isScheduled=!!v.timer;out.push({id,scheduled:isScheduled,onprogress:!!v.onprogress});}return out;}
  // Cancel a scheduled task by id (worker tasks cannot be reliably cancelled)
  cancel(id){const t=this.tasks.get(id);if(!t) return false; if(t.timer){clearTimeout(t.timer);this.tasks.delete(id);window.EventBus?.emit('task:cancelled', id);return true;} return false;}
}

if(!window.EventBus) window.EventBus = new EventBus();
if(!window.TaskManager) window.TaskManager = new TaskManager();

// Convenience: emit page lifecycle events when loaders run (pages may also emit themselves)
window.PageEvents = window.PageEvents || {
  emitLoading: (id)=>window.EventBus?.emit('page:loading', id),
  emitLoaded: (id)=>window.EventBus?.emit('page:loaded', id),
};

console.log('[FP-CORE-BUS] EventBus and TaskManager available');
})();
