/**
 * Atualizador de Transações PIX
 * Atualiza transações já importadas com nomes de beneficiários
 */
(function() {
  'use strict';

  const PIX_UPDATER = {
    // Atualizar todas as transações PIX
    async updateAllPixTransactions() {
      if (!window.db || !window.FP_PIX_ENRICHMENT) {
        console.error('Banco de dados ou sistema PIX não carregado');
        return;
      }

      console.log('🔄 Iniciando atualização de transações PIX...');

      try {
        // Buscar todas as transações
        const transactions = await window.db.transactions.toArray();

        if (!transactions.length) {
          console.log('Nenhuma transação encontrada');
          return;
        }

        let updated = 0;
        let beneficiaries = window.FP_PIX_ENRICHMENT.beneficiaries || {};

        for (const tx of transactions) {
          const desc = String(tx.description || '').trim();

          // Procura por padrão PIX
          if (/PIX.*Ref:\s*(\d+)/i.test(desc)) {
            const match = desc.match(/PIX.*Ref:\s*(\d+)/i);
            const pixCode = match[1];
            const beneficiary = beneficiaries[pixCode];

            if (beneficiary) {
              const newDesc = `PIX para ${beneficiary}`;

              // Só atualiza se mudou
              if (tx.description !== newDesc) {
                tx.description = newDesc;
                tx.payee = beneficiary;
                tx.pixCode = pixCode;

                // Salva no banco
                await window.db.transactions.put(tx);
                updated++;

                console.log(`  ✓ ${tx.date}: ${newDesc}`);
              }
            }
          }
        }

        console.log(`✅ Atualização concluída: ${updated} transação(ões) atualizada(s)`);

        // Recarrega a tela
        if (typeof window.App !== 'undefined' && window.App.dashboard?.refresh) {
          window.App.dashboard.refresh();
        }

        return updated;
      } catch (err) {
        console.error('Erro ao atualizar transações:', err);
        return 0;
      }
    },

    // Atualizar uma transação específica
    async updatePixTransaction(transactionId, newBeneficiary) {
      if (!window.db) {
        console.error('Banco de dados não carregado');
        return false;
      }

      try {
        const tx = await window.db.transactions.get(transactionId);
        if (!tx) {
          console.error('Transação não encontrada');
          return false;
        }

        const newDesc = `PIX para ${newBeneficiary}`;
        tx.description = newDesc;
        tx.payee = newBeneficiary;

        await window.db.transactions.put(tx);
        console.log(`✓ Transação atualizada: ${newDesc}`);

        if (typeof window.App !== 'undefined' && window.App.dashboard?.refresh) {
          window.App.dashboard.refresh();
        }

        return true;
      } catch (err) {
        console.error('Erro ao atualizar transação:', err);
        return false;
      }
    },

    // Encontrar transações PIX não mapeadas
    async findUnmappedPixTransactions() {
      if (!window.db || !window.FP_PIX_ENRICHMENT) {
        console.error('Banco de dados ou sistema PIX não carregado');
        return [];
      }

      try {
        const transactions = await window.db.transactions.toArray();
        const beneficiaries = window.FP_PIX_ENRICHMENT.beneficiaries || {};
        const unmapped = [];

        for (const tx of transactions) {
          const desc = String(tx.description || '').trim();

          if (/PIX.*Ref:\s*(\d+)/i.test(desc)) {
            const match = desc.match(/PIX.*Ref:\s*(\d+)/i);
            const pixCode = match[1];

            // Se não tem mapeamento
            if (!beneficiaries[pixCode]) {
              unmapped.push({
                id: tx.id,
                date: tx.date,
                amount: tx.amount,
                pixCode: pixCode,
                description: desc
              });
            }
          }
        }

        console.log(`📋 Encontradas ${unmapped.length} transação(ões) PIX não mapeada(s)`);
        return unmapped;
      } catch (err) {
        console.error('Erro ao buscar transações não mapeadas:', err);
        return [];
      }
    },

    // Mostrar transações não mapeadas
    async showUnmappedPixModal() {
      const unmapped = await this.findUnmappedPixTransactions();

      if (!unmapped.length) {
        alert('✅ Todas as transações PIX estão mapeadas!');
        return;
      }

      let html = `
        <div style="max-height:400px;overflow-y:auto">
          <h3>Transações PIX Não Mapeadas (${unmapped.length})</h3>
          <table style="width:100%;border-collapse:collapse;font-size:0.9em">
            <thead>
              <tr style="background:#f3f4f6;border-bottom:2px solid #e5e7eb">
                <th style="padding:8px;text-align:left">Data</th>
                <th style="padding:8px;text-align:right">Valor</th>
                <th style="padding:8px;text-align:left">Código PIX</th>
              </tr>
            </thead>
            <tbody>
      `;

      for (const tx of unmapped.slice(0, 20)) {
        html += `
          <tr style="border-bottom:1px solid #e5e7eb">
            <td style="padding:8px">${tx.date}</td>
            <td style="padding:8px;text-align:right">R$ ${tx.amount.toFixed(2)}</td>
            <td style="padding:8px;font-family:monospace;color:#6b7280">${tx.pixCode}</td>
          </tr>
        `;
      }

      html += `
            </tbody>
          </table>
          ${unmapped.length > 20 ? `<p style="color:#9ca3af">... e mais ${unmapped.length - 20}</p>` : ''}
          <p style="margin-top:15px;color:#6b7280">
            Adicione estes códigos PIX no gerenciador:
            <br><code style="background:#f3f4f6;padding:2px 4px">PIX_MANAGER.show()</code>
          </p>
        </div>
      `;

      // Criar modal simples
      const modal = document.createElement('div');
      modal.style.cssText = `
        position:fixed;top:0;left:0;right:0;bottom:0;
        background:rgba(0,0,0,0.5);display:flex;align-items:center;
        justify-content:center;z-index:10000;
      `;
      modal.innerHTML = `
        <div style="background:white;border-radius:8px;padding:20px;max-width:600px;width:90%">
          ${html}
          <button onclick="this.parentElement.parentElement.remove()"
            style="margin-top:15px;background:#3b82f6;color:white;border:none;
                   padding:10px 20px;border-radius:4px;cursor:pointer;width:100%">
            Fechar
          </button>
        </div>
      `;
      document.body.appendChild(modal);
    }
  };

  window.PIX_UPDATER = PIX_UPDATER;

  // Expor função principal no console
  console.log('✅ PIX_UPDATER carregado. Use:');
  console.log('   PIX_UPDATER.updateAllPixTransactions() - Atualizar todas');
  console.log('   PIX_UPDATER.findUnmappedPixTransactions() - Encontrar não mapeadas');
  console.log('   PIX_UPDATER.showUnmappedPixModal() - Mostrar modal');
})();
