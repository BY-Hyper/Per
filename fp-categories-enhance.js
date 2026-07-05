/* fp-categories-enhance.js — augment categories page with totals, transfers, and editable icon */
(function(){'use strict';

const waitFor = async (fn, attempts=60, delay=150) => {
  let i=0; 
  while(i++<attempts){ 
    try{ if(fn()) return true;}catch{} 
    await new Promise(r=>setTimeout(r,delay)); 
  } 
  return false; 
};

// Format currency helper
const fmtMoney = (v) => v.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});

async function init(){
  const ready = await waitFor(()=>window.db && document.getElementById('page-categories'));
  if(!ready) return console.warn('[FP-CAT] deps not ready');
  
  // Only set loader if none exists
  if(typeof window.loadCategories === 'function') return console.log('[FP-CAT] existing loadCategories found — skip override');
  
  function renderCategories(){
    const uid = window.S?.user?.id || 1;
    const cats = window._fpCats || [];
    const txs = window._fpCatTxs || [];
    
    // Calculate detailed sums per category
    const sums = {};
    for(const t of txs){
      if(!t.categoryId) continue;
      if(!sums[t.categoryId]) {
        sums[t.categoryId] = {count:0, expense:0, income:0, transferIn:0, transferOut:0};
      }
      sums[t.categoryId].count++;
      
      if(t.type === 'expense') {
        sums[t.categoryId].expense += Math.abs(t.amount);
      } else if(t.type === 'income') {
        sums[t.categoryId].income += Math.abs(t.amount);
      } else if(t.type === 'transfer') {
        // Transferências podem ser entrada ou saída dependendo da conta
        if(t.accountTo && t.accountFrom) {
          sums[t.categoryId].transferOut += Math.abs(t.amount);
        }
      }
      
      // Check for transfer-specific fields
      if(t.transferType) {
        if(t.transferType === 'out' || t.transferType === 'transfer_out') {
          sums[t.categoryId].transferOut += Math.abs(t.amount);
        } else if(t.transferType === 'in' || t.transferType === 'transfer_in') {
          sums[t.categoryId].transferIn += Math.abs(t.amount);
        }
      }
    }
    
    const expenseEl = document.getElementById('catExpenseList');
    const incomeEl = document.getElementById('catIncomeList');
    
    function renderList(filterIsExpense){
      const filtered = cats.filter(c=> c.type === (filterIsExpense? 'expense':'income'));
      return filtered.map(c=>{
        const s = sums[c.id] || {count:0, expense:0, income:0, transferIn:0, transferOut:0};
        const tot = filterIsExpense? s.expense : s.income;
        
        let detailsHtml = `<div class="cat-sub">${s.count} lançamentos · <strong>Total: R$ ${fmtMoney(tot)}</strong>`;
        
        // Show transfer details if applicable
        if(s.transferIn > 0 || s.transferOut > 0) {
          detailsHtml += `</div><div class="cat-sub-details">`;
          if(s.transferIn > 0) {
            detailsHtml += `<span class="text-success">↗ Recebido: R$ ${fmtMoney(s.transferIn)}</span>`;
          }
          if(s.transferOut > 0) {
            detailsHtml += `${s.transferIn > 0 ? ' · ' : ''}<span class="text-danger">↘ Transferido: R$ ${fmtMoney(s.transferOut)}</span>`;
          }
          
          // Show difference if both exist
          if(s.transferIn > 0 && s.transferOut > 0) {
            const diff = s.transferIn - s.transferOut;
            const diffClass = diff >= 0 ? 'text-success' : 'text-danger';
            const diffSign = diff >= 0 ? '+' : '';
            detailsHtml += `</div><div class="cat-sub-details"><span class="${diffClass}"><strong>Saldo: ${diffSign}R$ ${fmtMoney(diff)}</strong></span>`;
          } else if(s.transferIn > 0) {
            detailsHtml += `</div><div class="cat-sub-details"><span class="text-success"><strong>Saldo: +R$ ${fmtMoney(s.transferIn)}</strong></span>`;
          } else if(s.transferOut > 0) {
            detailsHtml += `</div><div class="cat-sub-details"><span class="text-danger"><strong>Saldo: -R$ ${fmtMoney(s.transferOut)}</strong></span>`;
          }
        }
        
        detailsHtml += '</div>';
        
        return `<div class="cat-row">
          <div class="cat-left">
            <span class="cat-icon">${c.icon||'<i class="fas fa-folder"></i>'}</span>
            <strong>${c.name}</strong>
            ${detailsHtml}
          </div>
          <div class="cat-right">
            <button class="btn btn-outline btn-sm" data-edit="${c.id}" title="Editar ícone"><i class="fas fa-edit"></i></button>
          </div>
        </div>`;
      }).join('');
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
      const btn = e.target.closest('button[data-edit]');
      if(!btn) return;
      const id = parseInt(btn.getAttribute('data-edit'));
      const cat = await window.db.categories.get(id);
      const newIcon = prompt('Ícone (classe Font Awesome, ex: fa-shopping-cart)', cat.icon||'fa-tag');
      if(newIcon==null) return;
      const trimmed = newIcon.trim();
      if(trimmed) {
        await window.db.categories.update(id, {icon: trimmed});
        await refreshCategoryData();
        if(typeof window.toast === 'function') {
          window.toast('Ícone atualizado!','success');
        }
      }
    });
  }
  
  console.log('[FP-CAT] categories enhancer ready');
}
init();
})();
