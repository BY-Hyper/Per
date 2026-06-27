/* fp-task-panel.js — simple task panel UI listening to EventBus + TaskManager */
(function(){'use strict';
const waitFor = async (fn, attempts=60, delay=200) => {let i=0; while(i++<attempts){ try{ if(fn()) return true;}catch{} await new Promise(r=>setTimeout(r,delay)); } return false; };
async function init(){
  const ready = await waitFor(()=>window.EventBus && window.TaskManager && document.getElementById('taskPanel'));
  if(!ready) return console.warn('[FP-TASKP] dependencies not ready');
  const panel = document.getElementById('taskPanel');
  const list = panel.querySelector('.task-list');
  function render(){
    const rows = window.TaskManager.list();
    if(!rows.length){ list.innerHTML = '<div class="task-empty">Nenhuma tarefa ativa no momento. Execute um job para ver o progresso aqui.</div>'; return; }
    list.innerHTML = rows.map(r=>{
      const id = r.id;
      const status = r.scheduled? 'scheduled':'running';
      const label = r.scheduled ? 'Agendada' : 'Em execução';
      return `
        <div class="task-row" data-id="${id}" data-status="${status}">
          <div class="task-row-header">
            <div class="task-left">
              <div style="display:flex;align-items:center;gap:.5rem;"><span class="task-icon"></span><strong class="task-title">${id}</strong></div>
              <div class="task-meta">${label}</div>
            </div>
            <div class="task-right">
              <button class="btn btn-outline btn-sm" data-cancel="${id}">Cancelar</button>
            </div>
          </div>
          <div class="task-progress-bar"><div class="task-progress" id="tp-${id}" style="width:0%"></div></div>
        </div>
      `;
    }).join('');
  }

  panel.addEventListener('click', e=>{
    const cancel = e.target.closest('button[data-cancel]'); if(cancel){ const id=cancel.getAttribute('data-cancel'); const ok = window.TaskManager.cancel(id); if(ok){render();} }
    const close = e.target.closest('[data-close]'); if(close){ panel.classList.toggle('open'); }
  });

  window.EventBus.on('task:started',(id,info)=>{ render(); });
  window.EventBus.on('task:progress',(id,prog)=>{ const el = document.getElementById('tp-'+id); if(el) el.style.width = (prog||0) + '%'; });
  window.EventBus.on('task:done',(id)=>{ render(); });
  window.EventBus.on('task:error',(id)=>{ render(); });
  window.EventBus.on('task:cancelled',(id)=>{ render(); });

  // initial render
  render();
  console.log('[FP-TASKP] Task panel ready');
}
init();
})();
