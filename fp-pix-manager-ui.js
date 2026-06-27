/**
 * Interface Visual para Gerenciar Beneficiários PIX
 * Adicione a um modal ou painel do FinancePro
 */
(function() {
  'use strict';

  const PIX_MANAGER = {
    // Template HTML
    getTemplate() {
      return `
        <div id="fpPixManagerModal" class="fp-modal hidden" style="z-index:10000">
          <div class="fp-modal-overlay" onclick="document.getElementById('fpPixManagerModal').classList.add('hidden')"></div>
          <div class="fp-modal-content" style="max-width:600px">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e7eb;padding:20px">
              <h2 style="margin:0;font-size:1.5rem">Gerenciar PIX Bradesco</h2>
              <button onclick="document.getElementById('fpPixManagerModal').classList.add('hidden')" style="background:none;border:none;font-size:1.5rem;cursor:pointer">×</button>
            </div>

            <div style="padding:20px;max-height:60vh;overflow-y:auto">

              <!-- Adicionar Novo -->
              <div style="background:#f3f4f6;padding:15px;border-radius:8px;margin-bottom:20px">
                <h3 style="margin-top:0">Adicionar Novo Beneficiário</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
                  <input type="text" id="fpPixCode" placeholder="Código PIX (ex: 1601370)"
                    style="padding:8px;border:1px solid #d1d5db;border-radius:4px">
                  <input type="text" id="fpPixName" placeholder="Nome do Beneficiário"
                    style="padding:8px;border:1px solid #d1d5db;border-radius:4px">
                </div>
                <button id="fpPixAddBtn" style="background:#3b82f6;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;width:100%">
                  Adicionar
                </button>
              </div>

              <!-- Lista de Beneficiários -->
              <h3>Beneficiários Mapeados</h3>
              <div id="fpPixList" style="border:1px solid #e5e7eb;border-radius:8px;max-height:300px;overflow-y:auto">
                <!-- Preenchido dinamicamente -->
              </div>

              <!-- Ações -->
              <div style="margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <button id="fpPixExportBtn" style="background:#10b981;color:white;border:none;padding:10px;border-radius:4px;cursor:pointer">
                  📥 Exportar
                </button>
                <button id="fpPixImportBtn" style="background:#f59e0b;color:white;border:none;padding:10px;border-radius:4px;cursor:pointer">
                  📤 Importar
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    },

    // Mostrar modal
    show() {
      let modal = document.getElementById('fpPixManagerModal');
      if (!modal) {
        const container = document.body || document.documentElement;
        container.insertAdjacentHTML('beforeend', this.getTemplate());
        modal = document.getElementById('fpPixManagerModal');
      }
      modal.classList.remove('hidden');
      this.renderList();
      this.attachEvents();
    },

    // Renderizar lista
    renderList() {
      if (!window.FP_PIX_ENRICHMENT) return;
      const list = document.getElementById('fpPixList');
      const beneficiaries = window.FP_PIX_ENRICHMENT.beneficiaries || {};
      const entries = Object.entries(beneficiaries);

      if (!entries.length) {
        list.innerHTML = '<div style="padding:15px;text-align:center;color:#9ca3af">Nenhum beneficiário mapeado</div>';
        return;
      }

      list.innerHTML = entries.map(([code, name]) => `
        <div style="padding:12px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong>${name}</strong>
            <br>
            <small style="color:#6b7280">Ref: ${code}</small>
          </div>
          <button onclick="PIX_MANAGER.remove('${code}')" style="background:#ef4444;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer">
            ✕ Remover
          </button>
        </div>
      `).join('');
    },

    // Adicionar novo
    add() {
      const code = document.getElementById('fpPixCode')?.value?.trim();
      const name = document.getElementById('fpPixName')?.value?.trim();

      if (!code || !name) {
        alert('Preencha código e nome');
        return;
      }

      if (!window.FP_PIX_ENRICHMENT) {
        alert('Sistema PIX não carregado');
        return;
      }

      window.FP_PIX_ENRICHMENT.addBeneficiary(code, name);
      document.getElementById('fpPixCode').value = '';
      document.getElementById('fpPixName').value = '';
      this.renderList();
      alert(`✓ Beneficiário "${name}" adicionado!`);
    },

    // Remover
    remove(code) {
      if (!confirm('Remover este beneficiário?')) return;
      if (window.FP_PIX_ENRICHMENT?.beneficiaries) {
        delete window.FP_PIX_ENRICHMENT.beneficiaries[code];
        window.FP_PIX_ENRICHMENT.save();
        this.renderList();
      }
    },

    // Exportar
    export() {
      if (!window.FP_PIX_ENRICHMENT?.beneficiaries) return;
      const data = JSON.stringify(window.FP_PIX_ENRICHMENT.beneficiaries, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pix-beneficiarios-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      alert('✓ Exportado para seu computador');
    },

    // Importar
    import() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            if (!window.FP_PIX_ENRICHMENT) return;
            Object.assign(window.FP_PIX_ENRICHMENT.beneficiaries, data);
            window.FP_PIX_ENRICHMENT.save();
            this.renderList();
            alert(`✓ Importados ${Object.keys(data).length} beneficiários`);
          } catch (err) {
            alert('Erro ao importar arquivo: ' + err.message);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    },

    // Eventos
    attachEvents() {
      document.getElementById('fpPixAddBtn')?.addEventListener('click', () => this.add());
      document.getElementById('fpPixExportBtn')?.addEventListener('click', () => this.export());
      document.getElementById('fpPixImportBtn')?.addEventListener('click', () => this.import());

      document.getElementById('fpPixCode')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.add();
      });
      document.getElementById('fpPixName')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.add();
      });
    }
  };

  window.PIX_MANAGER = PIX_MANAGER;

  // Botão no dashboard (opcional)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Adicione botão ao seu dashboard aqui
      // Exemplo:
      // document.getElementById('mainMenu')?.insertAdjacentHTML('beforeend',
      //   '<button onclick="PIX_MANAGER.show()">PIX Manager</button>');
    });
  }
})();
