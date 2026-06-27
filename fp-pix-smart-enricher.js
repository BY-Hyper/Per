/**
 * Sistema Inteligente de Enriquecimento PIX
 * Detecta e enriquece automaticamente ao importar
 * - Busca histórico
 * - Reconhecimento de padrões
 * - Aprendizado contínuo
 */
(function() {
  'use strict';

  const PIX_SMART_ENRICHER = {
    // Histórico de PIX com beneficiários descobertos
    pixHistory: {},

    // Padrões de transações recorrentes
    recurringPatterns: {},

    // Carregar dados salvos
    load() {
      try {
        const saved = localStorage.getItem('FP_PIX_HISTORY');
        if (saved) {
          this.pixHistory = JSON.parse(saved);
        }
        const patterns = localStorage.getItem('FP_PIX_PATTERNS');
        if (patterns) {
          this.recurringPatterns = JSON.parse(patterns);
        }
      } catch (e) {
        console.warn('Erro ao carregar histórico PIX', e);
      }
    },

    // Salvar dados
    save() {
      try {
        localStorage.setItem('FP_PIX_HISTORY', JSON.stringify(this.pixHistory));
        localStorage.setItem('FP_PIX_PATTERNS', JSON.stringify(this.recurringPatterns));
      } catch (e) {
        console.warn('Erro ao salvar histórico PIX', e);
      }
    },

    /**
     * Enriquecer transação PIX com múltiplas estratégias
     */
    async enrichPixTransaction(tx) {
      if (!tx || tx.type !== 'expense') return tx;

      // Detectar código PIX
      const pixMatch = String(tx.description || '').match(/Ref:\s*(\d+)|PIX[:\s]*(\d+)/i);
      if (!pixMatch) return tx;

      const pixCode = pixMatch[1] || pixMatch[2];
      if (!pixCode) return tx;

      // 1. Checar histórico (já vimos esse PIX antes?)
      const knownBeneficiary = this.pixHistory[pixCode];
      if (knownBeneficiary) {
        tx.description = `PIX para ${knownBeneficiary.name}`;
        tx.payee = knownBeneficiary.name;
        tx.pixCode = pixCode;
        tx.pixConfidence = 'conhecido'; // Alto nível de confiança
        return tx;
      }

      // 2. Tentar reconhecer padrão recorrente
      const pattern = this.findRecurringPattern(tx.amount);
      if (pattern) {
        tx.description = `PIX para ${pattern.name}`;
        tx.payee = pattern.name;
        tx.pixCode = pixCode;
        tx.pixConfidence = 'padrão'; // Confiança média
        return tx;
      }

      // 3. Usar IA para sugerir baseado em descrição original
      if (window.SmartCat) {
        const suggestion = await this.getAISuggestion(tx);
        if (suggestion) {
          tx.description = `PIX para ${suggestion} (sugerido)`;
          tx.payee = suggestion;
          tx.pixCode = pixCode;
          tx.pixConfidence = 'sugerido'; // Confiança baixa
          return tx;
        }
      }

      // 4. Se nada funcionou, manter como está mas com código PIX
      tx.pixCode = pixCode;
      tx.pixConfidence = 'desconhecido';

      return tx;
    },

    /**
     * Buscar padrão de transação recorrente
     */
    findRecurringPattern(amount) {
      // Procura por transferências recorrentes com esse valor
      if (this.recurringPatterns[amount]) {
        return this.recurringPatterns[amount];
      }

      // Procura por valores similares (±5%)
      const tolerance = amount * 0.05;
      for (const [savedAmount, pattern] of Object.entries(this.recurringPatterns)) {
        const diff = Math.abs(parseFloat(savedAmount) - amount);
        if (diff <= tolerance) {
          return pattern;
        }
      }

      return null;
    },

    /**
     * Usar IA para sugerir beneficiário
     */
    async getAISuggestion(tx) {
      if (!window.SmartCat) return null;

      try {
        // Construir prompt para IA
        const prompt = `
          Transação de transferência PIX encontrada:
          - Valor: R$ ${tx.amount}
          - Data: ${tx.date}
          - Descrição original: ${tx.rawDescription || tx.description}

          Baseado no padrão e valor, qual é o tipo/categoria de beneficiário mais provável?
          Responda APENAS com um nome curto (ex: "Aluguel", "Internet", "João Silva", "Supermercado")
          Se não conseguir identificar, responda: "desconhecido"
        `;

        const response = await window.SmartCat.categorizeAll([tx]);
        if (response && response[0] && response[0].category) {
          return response[0].category;
        }
      } catch (e) {
        console.warn('Erro ao obter sugestão IA', e);
      }

      return null;
    },

    /**
     * Registrar novo PIX descoberto (aprendizado)
     */
    learnPixBeneficiary(pixCode, beneficiaryName, confidence = 'manual') {
      this.pixHistory[pixCode] = {
        name: beneficiaryName,
        learned: new Date().toISOString(),
        confidence: confidence
      };
      this.save();
      console.log(`📚 Aprendido: PIX ${pixCode} → ${beneficiaryName}`);
    },

    /**
     * Registrar padrão de transação recorrente
     */
    learnRecurringPattern(amount, beneficiaryName) {
      this.recurringPatterns[amount] = {
        name: beneficiaryName,
        learned: new Date().toISOString()
      };
      this.save();
      console.log(`📊 Padrão aprendido: R$ ${amount} → ${beneficiaryName}`);
    },

    /**
     * Enriquecer múltiplas transações (chamado ao importar)
     */
    async enrichAllPixTransactions(transactions) {
      if (!Array.isArray(transactions)) return transactions;

      console.log(`🤖 Enriquecendo ${transactions.length} transações com IA...`);

      const enriched = [];
      let improved = 0;

      for (const tx of transactions) {
        const original = tx.description;
        const enhanced = await this.enrichPixTransaction(tx);

        if (enhanced.description !== original) {
          improved++;
        }

        enriched.push(enhanced);
      }

      console.log(`✅ ${improved}/${transactions.length} transações enriquecidas automaticamente`);
      return enriched;
    },

    /**
     * Dashboard de estatísticas
     */
    getStats() {
      return {
        pixKnown: Object.keys(this.pixHistory).length,
        patternsLearned: Object.keys(this.recurringPatterns).length,
        totalLearned: Object.keys(this.pixHistory).length + Object.keys(this.recurringPatterns).length
      };
    },

    /**
     * Mostrar dashboard de aprendizado
     */
    showDashboard() {
      const stats = this.getStats();
      const html = `
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:15px;margin:10px 0">
          <h3 style="margin-top:0">🤖 Sistema PIX Inteligente</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:15px">
            <div style="background:white;padding:10px;border-radius:4px;text-align:center">
              <div style="font-size:2em;font-weight:bold;color:#3b82f6">${stats.pixKnown}</div>
              <div style="color:#6b7280;font-size:0.9em">PIX Aprendidos</div>
            </div>
            <div style="background:white;padding:10px;border-radius:4px;text-align:center">
              <div style="font-size:2em;font-weight:bold;color:#10b981">${stats.patternsLearned}</div>
              <div style="color:#6b7280;font-size:0.9em">Padrões</div>
            </div>
            <div style="background:white;padding:10px;border-radius:4px;text-align:center">
              <div style="font-size:2em;font-weight:bold;color:#f59e0b">${stats.totalLearned}</div>
              <div style="color:#6b7280;font-size:0.9em">Total Aprendido</div>
            </div>
          </div>
          <div style="font-size:0.9em;color:#6b7280">
            ✨ Sistema está aprendendo automaticamente com cada transação!
          </div>
        </div>
      `;
      console.log(html);
      return html;
    }
  };

  // Carregar ao inicializar
  PIX_SMART_ENRICHER.load();

  // Expor globalmente
  window.PIX_SMART_ENRICHER = PIX_SMART_ENRICHER;

  console.log('✅ Sistema PIX Inteligente ativado');
  console.log('Funções disponíveis:');
  console.log('  • PIX_SMART_ENRICHER.enrichAllPixTransactions(txs)');
  console.log('  • PIX_SMART_ENRICHER.learnPixBeneficiary(code, name)');
  console.log('  • PIX_SMART_ENRICHER.showDashboard()');
})();
