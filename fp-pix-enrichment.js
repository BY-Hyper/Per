/**
 * Sistema de Enriquecimento PIX para Bradesco
 * Mapeia chaves PIX e referências para nomes de beneficiários
 */
(function() {
  'use strict';

  const PIX_ENRICHMENT = {
    // Mapeamento de código de referência → beneficiário
    // Formato: "codigo_referencia": "Nome do Beneficiário / Descrição"
    beneficiaries: {
      // Exemplos - ADICIONAR SEUS DADOS
      "1601370": "João Silva / Empréstimo",
      "1625405": "Maria Santos / Aluguel",
      "1307553": "Supermercado XYZ",
      "1934251": "Serviço de Internet",
      "604535": "Conta de Energia",
      "1730517": "Conta de Água",

      // Sistema aprenderá com cada importação
      // Se vazio, mostrará apenas o código
    },

    // Cache de PIX aprendidos (será expandido ao longo do tempo)
    pixCache: {},

    // Adiciona novo beneficiário
    addBeneficiary(code, name) {
      this.beneficiaries[String(code).trim()] = name;
      this.save();
    },

    // Obtém nome do beneficiário
    getBeneficiary(code) {
      if (!code) return null;
      const normalized = String(code).trim();
      return this.beneficiaries[normalized] || null;
    },

    // Enriquece transação PIX
    enrichTransaction(tx) {
      if (!tx || tx.type !== 'PIX') return tx;

      const beneficiary = this.getBeneficiary(tx.pixCode);
      if (beneficiary) {
        tx.payee = beneficiary;
        tx.description = `PIX para ${beneficiary}`;
      }
      return tx;
    },

    // Salva mapeamento em localStorage
    save() {
      try {
        localStorage.setItem('FP_PIX_BENEFICIARIES', JSON.stringify(this.beneficiaries));
      } catch (e) {
        console.warn('Não foi possível salvar mapeamento PIX', e);
      }
    },

    // Carrega mapeamento do localStorage
    load() {
      try {
        const saved = localStorage.getItem('FP_PIX_BENEFICIARIES');
        if (saved) this.beneficiaries = { ...this.beneficiaries, ...JSON.parse(saved) };
      } catch (e) {
        console.warn('Não foi possível carregar mapeamento PIX', e);
      }
    }
  };

  // Carrega mapeamento ao inicializar
  PIX_ENRICHMENT.load();

  window.FP_PIX_ENRICHMENT = PIX_ENRICHMENT;
})();
