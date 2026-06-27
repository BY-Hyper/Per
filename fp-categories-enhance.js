/* fp-categories-enhance.js — augment categories page with totals and editable icon */
(function(){'use strict';
const waitFor = async (fn, attempts=60, delay=150) => {let i=0; while(i++<attempts){ try{ if(fn()) return true;}catch{} await new Promise(r=>setTimeout(r,delay)); } return false; };
async function init(){
  const ready = await waitFor(()=>window.db && document.getElementById('page-categories'));
  if(!ready) return console.warn('[FP-CAT] deps not ready');
  // only set loader if none exists
  if(typeof window.loadCategories === 'function') return console.log('[FP-CAT] existing loadCategories found — skip override');
  function renderCategories(){
    const uid = window.S?.user?.id || 1;
    const cats = window._fpCats || [];
    const txs = window._fpCatTxs || [];
    const sums = {}; for(const t of txs){ if(!t.categoryId) continue; sums[t.categoryId] = sums[t.categoryId]||{count:0,expense:0,income:0}; sums[t.categoryId].count++; if(t.type==='expense') sums[t.categoryId].expense += Math.abs(t.amount); else sums[t.categoryId].income += Math.abs(t.amount); }
    const expenseEl = document.getElementById('catExpenseList');
    const incomeEl = document.getElementById('catIncomeList');
    function renderList(filterIsExpense){
      const filtered = cats.filter(c=> c.type === (filterIsExpense? 'expense':'income'));
      return filtered.map(c=>{ const s = sums[c.id]||{count:0,expense:0,income:0}; const tot = filterIsExpense? s.expense : s.income; return `<div class="cat-row"><div class="cat-left"><span class="cat-icon">${c.icon||'<i class="fas fa-folder"></i>'}</span><strong>${c.name}</strong><div class="cat-sub">${s.count} lançamentos · Total: R$ ${tot.toFixed(2)}</div></div><div class="cat-right"><button class="btn btn-outline btn-sm" data-edit="${c.id}"><i class="fas fa-edit"></i></button></div></div>` }).join('');
    }
    if(expenseEl) expenseEl.innerHTML = renderList(true);
    if(incomeEl) incomeEl.innerHTML = renderList(false);
  }

  async function refreshCategoryData(){
    const uid = window.S?.user?.id || 1;
    window._fpCats = await window.db.categories.toArray();
    window._fpCatTxs = await window.db.transactions.where('userId').equals(uid).toArray();
    renderCategories();
  }

  window.loadCategories = async function(){
    await refreshCategoryData();
  };

  const pageCategories = document.getElementById('page-categories');
  if(pageCategories){
    pageCategories.addEventListener('click', async (e)=>{
      const btn = e.target.closest('button[data-edit]'); if(!btn) return;
      const id = parseInt(btn.getAttribute('data-edit'));
      const cat = await window.db.categories.get(id);
      const newIcon = prompt('Ícone (HTML/FA class) para a categoria', cat.icon||'');
      if(newIcon==null) return;
      await window.db.categories.update(id,{icon:newIcon});
      await refreshCategoryData();
    });
  }
  console.log('[FP-CAT] categories enhancer ready');
}
init();
})();
