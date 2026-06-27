/**
 * @fileoverview FinancePro — exporter.js
 * Exportação avançada:
 *  - Excel (.xlsx) com múltiplas abas: Resumo, Transações, Categorias, Orçamentos
 *  - PDF completo com cabeçalho, tabelas e gráficos capturados
 */

'use strict';

App.exporter = (() => {

  /* ══════════════════════════════════════
     EXCEL EXPORT (SheetJS)
  ══════════════════════════════════════ */
  async function exportExcel(filterFn = null) {
    const uid  = App.state.currentUser.id;
    const cur  = App.state.settings?.currency;
    const user = App.state.currentUser;

    showToast('Gerando planilha Excel...', 'info');

    try {
      const XLSX = window.XLSX;
      if (!XLSX) throw new Error('SheetJS não carregado');

      const wb = XLSX.utils.book_new();

      /* ── Sheet 1: Transações ── */
      const txs  = await db.transactions.where('userId').equals(uid).toArray();
      const cats = App.state.categoriesCache;
      const accs = App.state.accountsCache;
      const catMap = Object.fromEntries(cats.map(c=>[c.id,c]));
      const accMap = Object.fromEntries(accs.map(a=>[a.id,a]));

      const txFiltered = filterFn ? txs.filter(filterFn) : txs;
      txFiltered.sort((a,b) => b.date.localeCompare(a.date));

      const txRows = [
        ['Data','Tipo','Categoria','Conta','Valor (R$)','Descrição','Tags','Parcela'],
        ...txFiltered.map(t => [
          t.date,
          t.type === 'income' ? 'Receita' : t.type === 'transfer' ? 'Transferência' : 'Despesa',
          catMap[t.categoryId]?.name || '',
          accMap[t.accountId]?.name  || '',
          t.amount,
          t.description || '',
          (t.tags||[]).join(', '),
          t.installmentNum ? `${t.installmentNum}/${t.installmentTotal}` : '',
        ])
      ];
      const wsTx = XLSX.utils.aoa_to_sheet(txRows);
      // Column widths
      wsTx['!cols'] = [
        {wch:12},{wch:14},{wch:18},{wch:18},{wch:14},{wch:35},{wch:20},{wch:10}
      ];
      // Style header row (bold via s property — requires xlsx-style or workaround)
      XLSX.utils.book_append_sheet(wb, wsTx, 'Transações');

      /* ── Sheet 2: Resumo Mensal ── */
      const months = [...new Set(txs.map(t=>t.date.slice(0,7)))].sort();
      const summaryRows = [
        ['Mês','Receitas','Despesas','Saldo'],
        ...months.map(m => {
          const inc = txs.filter(t=>t.date.startsWith(m)&&t.type==='income').reduce((s,t)=>s+t.amount,0);
          const exp = txs.filter(t=>t.date.startsWith(m)&&t.type==='expense').reduce((s,t)=>s+t.amount,0);
          return [m, inc, exp, inc - exp];
        }),
        [],
        ['TOTAL',
          txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),
          txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0),
          txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0) - txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0),
        ],
      ];
      const wsSum = XLSX.utils.aoa_to_sheet(summaryRows);
      wsSum['!cols'] = [{wch:12},{wch:16},{wch:16},{wch:16}];
      XLSX.utils.book_append_sheet(wb, wsSum, 'Resumo Mensal');

      /* ── Sheet 3: Categorias ── */
      const catTotals = {};
      txs.forEach(t => {
        const name = catMap[t.categoryId]?.name || 'Sem categoria';
        if (!catTotals[name]) catTotals[name] = { income:0, expense:0, count:0 };
        if (t.type==='income')  catTotals[name].income  += t.amount;
        if (t.type==='expense') catTotals[name].expense += t.amount;
        catTotals[name].count++;
      });
      const catRows = [
        ['Categoria','Tipo','Receitas','Despesas','Transações'],
        ...Object.entries(catTotals).map(([name, d]) => {
          const cat = cats.find(c=>c.name===name);
          return [name, cat?.type==='income'?'Receita':'Despesa', d.income, d.expense, d.count];
        })
      ];
      const wsCat = XLSX.utils.aoa_to_sheet(catRows);
      wsCat['!cols'] = [{wch:20},{wch:12},{wch:14},{wch:14},{wch:14}];
      XLSX.utils.book_append_sheet(wb, wsCat, 'Categorias');

      /* ── Sheet 4: Orçamentos ── */
      const now     = new Date();
      const month   = toMonthKey(now);
      const budgets = await db.budgets.where({ userId: uid, monthYear: month }).toArray();
      const monthStart_ = month + '-01';
      const monthEnd_   = monthEnd(now);
      const monthTxs    = txs.filter(t => t.date >= monthStart_ && t.date <= monthEnd_ && t.type === 'expense');

      const budgetRows = [
        [`Orçamentos — ${month}`],
        [],
        ['Categoria','Limite (R$)','Gasto (R$)','Saldo (R$)','% Utilizado'],
        ...cats.filter(c=>c.type==='expense').map(c => {
          const b = budgets.find(b=>b.categoryId===c.id);
          const spent = monthTxs.filter(t=>t.categoryId===c.id).reduce((s,t)=>s+t.amount,0);
          const limit = b?.limitAmount || 0;
          return [c.name, limit || 'Sem limite', spent, limit ? limit-spent : '', limit ? ((spent/limit)*100).toFixed(1)+'%' : ''];
        })
      ];
      const wsBudget = XLSX.utils.aoa_to_sheet(budgetRows);
      wsBudget['!cols'] = [{wch:20},{wch:16},{wch:14},{wch:14},{wch:12}];
      XLSX.utils.book_append_sheet(wb, wsBudget, 'Orçamentos');

      /* ── Generate file ── */
      const filename = `financepro-${user.name.split(' ')[0].toLowerCase()}-${toMonthKey()}.xlsx`;
      XLSX.writeFile(wb, filename);
      showToast('Excel gerado com sucesso!', 'success');

    } catch(err) {
      showToast('Erro ao gerar Excel: ' + err.message, 'error');
      console.error(err);
    }
  }

  /* ══════════════════════════════════════
     PDF EXPORT (jsPDF + canvas capture)
  ══════════════════════════════════════ */
  async function exportPDF() {
    const uid  = App.state.currentUser.id;
    const cur  = App.state.settings?.currency;
    const user = await db.users.get(uid);

    showToast('Gerando PDF completo...', 'info');

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ format: 'a4', unit: 'mm' });
      const W   = doc.internal.pageSize.getWidth();  // 210
      const H   = doc.internal.pageSize.getHeight(); // 297
      let y     = 20;

      const accent = [16, 185, 129]; // #10b981

      /* ── Cover ── */
      doc.setFillColor(...accent);
      doc.rect(0, 0, W, 50, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.text('FinancePro', 14, 22);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Relatório Financeiro Completo', 14, 32);
      doc.text(`${user?.name || App.state.currentUser.name}  •  Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 14, 40);

      y = 60;

      /* ── Summary stats ── */
      const txs     = await db.transactions.where('userId').equals(uid).toArray();
      const now     = new Date();
      const mStart  = monthStart(now);
      const mEnd    = monthEnd(now);
      const monthTxs = txs.filter(t => t.date >= mStart && t.date <= mEnd);
      const income   = monthTxs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
      const expense  = monthTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Resumo do Mês Atual', 14, y);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);

      const kpis = [
        ['Receitas:', formatCurrency(income,   cur), accent],
        ['Despesas:', formatCurrency(expense,  cur), [239,68,68]],
        ['Saldo:',   formatCurrency(income-expense,cur), income>=expense?accent:[239,68,68]],
        ['Total de transações:', String(txs.length), [100,100,100]],
      ];

      kpis.forEach(([label, value, color]) => {
        doc.setTextColor(80, 80, 80);
        doc.text(label, 14, y);
        doc.setTextColor(...color);
        doc.setFont('helvetica', 'bold');
        doc.text(value, 80, y);
        doc.setFont('helvetica', 'normal');
        y += 7;
      });

      y += 6;
      doc.setDrawColor(230, 230, 230);
      doc.line(14, y, W - 14, y);
      y += 8;

      /* ── Category breakdown table ── */
      const cats   = App.state.categoriesCache;
      const catMap = Object.fromEntries(cats.map(c=>[c.id,c]));

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(30,30,30);
      doc.text('Gastos por Categoria (mês atual)', 14, y);
      y += 8;

      const byCat = {};
      monthTxs.filter(t=>t.type==='expense').forEach(t => {
        const name = catMap[t.categoryId]?.name || 'Outros';
        byCat[name] = (byCat[name]||0) + t.amount;
      });

      // Table header
      doc.setFillColor(240,240,240);
      doc.rect(14, y-4, W-28, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(80,80,80);
      doc.text('Categoria', 16, y+1);
      doc.text('Valor', 120, y+1);
      doc.text('% do Total', 155, y+1);
      y += 8;

      const totalExp = Object.values(byCat).reduce((s,v)=>s+v,0);
      Object.entries(byCat)
        .sort((a,b)=>b[1]-a[1])
        .slice(0,15)
        .forEach(([name, val]) => {
          const p = totalExp > 0 ? (val/totalExp*100).toFixed(1) : '0';
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(40,40,40);
          doc.text(name.slice(0,28), 16, y);
          doc.setTextColor(...accent);
          doc.text(formatCurrency(val, cur), 120, y);
          doc.setTextColor(100,100,100);
          doc.text(`${p}%`, 155, y);

          // Mini bar
          const barW = Math.max((val/totalExp)*40, 0.5);
          doc.setFillColor(...accent);
          doc.rect(175, y-3, barW, 3, 'F');

          y += 7;
          if (y > H - 30) { doc.addPage(); y = 20; }
        });

      y += 5;
      doc.line(14, y, W-14, y);
      y += 10;

      /* ── Recent transactions ── */
      if (y > H - 80) { doc.addPage(); y = 20; }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(30,30,30);
      doc.text('Últimas 20 Transações', 14, y);
      y += 8;

      doc.setFillColor(240,240,240);
      doc.rect(14, y-4, W-28, 8, 'F');
      doc.setFont('helvetica','bold');
      doc.setFontSize(9);
      doc.setTextColor(80,80,80);
      doc.text('Data', 16, y+1);
      doc.text('Descrição', 36, y+1);
      doc.text('Categoria', 110, y+1);
      doc.text('Valor', 162, y+1);
      y += 8;

      const recent20 = [...txs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20);
      recent20.forEach((t,i) => {
        if (i % 2 === 0) { doc.setFillColor(250,250,250); doc.rect(14,y-4,W-28,6,'F'); }
        doc.setFont('helvetica','normal');
        doc.setFontSize(8);
        doc.setTextColor(60,60,60);
        doc.text(formatDate(t.date), 16, y);
        doc.text((t.description||'—').slice(0,30), 36, y);
        doc.text((catMap[t.categoryId]?.name||'?').slice(0,18), 110, y);
        doc.setTextColor(t.type==='income'?...accent:t.type==='transfer'?59:239, t.type==='income'?185:t.type==='transfer'?130:68, t.type==='income'?129:t.type==='transfer'?246:68);
        doc.setFont('helvetica','bold');
        doc.text((t.type==='income'?'+':'−')+' '+formatCurrency(t.amount,cur), 162, y);
        y += 6;
        if (y > H - 20) { doc.addPage(); y = 20; }
      });

      /* ── Footer on each page ── */
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150,150,150);
        doc.text(`FinancePro  •  Página ${i} de ${pageCount}`, 14, H - 10);
        doc.text(new Date().toLocaleDateString('pt-BR'), W - 30, H - 10);
      }

      /* ── Save ── */
      const filename = `financepro-relatorio-${toMonthKey()}.pdf`;
      doc.save(filename);
      showToast('PDF gerado com sucesso!', 'success');

    } catch(err) {
      showToast('Erro ao gerar PDF: ' + err.message, 'error');
      console.error(err);
    }
  }

  return { exportExcel, exportPDF };
})();
