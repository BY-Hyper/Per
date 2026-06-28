/* =====================================================================
   FINANCEPRO — AJUDA & TUTORIAL v2
   Sistema completo de ajuda com tutoriais interativos e FAQ.
   Expõe: window.loadHelp
===================================================================== */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  /* ── Conteúdo de ajuda organizado por categorias ── */
  const HELP_CONTENT = {
    quickstart: {
      icon: '🚀', title: 'Início Rápido', color: '#10b981',
      items: [
        { q: 'Como começar no FinancePro?', a: `
          <p>Siga estes passos para configurar sua conta:</p>
          <ol style="padding-left:1.5rem;line-height:2">
            <li><strong>Crie suas categorias:</strong> Vá em Categorias e personalize as principais (Moradia, Alimentação, Transporte, etc.)</li>
            <li><strong>Registre suas primeiras transações:</strong> Clique em "Nova Transação" e adicione gastos e receitas</li>
            <li><strong>Defina orçamentos:</strong> Estabeleça limites mensais para controlar gastos</li>
            <li><strong>Crie metas:</strong> Defina objetivos financeiros (reserva, viagem, compra)</li>
          </ol>
          <div style="margin-top:1rem;padding:1rem;background:rgba(16,185,129,.08);border-radius:8px">
            💡 <strong>Dica:</strong> Dedique 10 minutos por dia para registrar transações e manter o controle!
          </div>`
        },
        { q: 'Como importar extrato bancário?', a: `
          <p>O FinancePro suporta importação de vários bancos:</p>
          <ol style="padding-left:1.5rem;line-height:2">
            <li>Vá na página <strong>Importar Extrato</strong></li>
            <li>Arraste seu arquivo (CSV, OFX, QIF ou PDF de fatura)</li>
            <li>Selecione o banco ou deixe em "Detectar automaticamente"</li>
            <li>Escolha a conta destino</li>
            <li>Revise as transações e confirme a importação</li>
          </ol>
          <p style="margin-top:.75rem"><strong>Bancos suportados:</strong> Nubank, BB, Bradesco, Itaú, Inter, C6, Santander, Caixa</p>`
        },
        { q: 'Como categorizar transações automaticamente?', a: `
          <p>O FinancePro usa IA local para aprender com seus padrões:</p>
          <ol style="padding-left:1.5rem;line-height:2">
            <li>Vá em <strong>Configurações → Regras de Categorização</strong></li>
            <li>Crie regras como: "Se descrição contém 'UBER' → Categoria: Transporte"</li>
            <li>O sistema aplicará automaticamente nas próximas importações</li>
          </ol>
          <div style="margin-top:1rem;padding:1rem;background:rgba(59,130,246,.08);border-radius:8px">
            🤖 <strong>IA Local:</strong> O sistema aprende com suas correções manuais e sugere categorias automaticamente!
          </div>`
        },
      ]
    },
    features: {
      icon: '✨', title: 'Funcionalidades', color: '#3b82f6',
      items: [
        { q: 'Como funciona o Dashboard Inteligente?', a: `
          <p>O dashboard mostra uma visão completa das suas finanças:</p>
          <ul style="padding-left:1.5rem;line-height:2">
            <li><strong>Saldo atual:</strong> Receitas - Despesas do mês</li>
            <li><strong>Gráficos:</strong> Evolução mensal, distribuição por categoria</li>
            <li><strong>Orçamentos:</strong> Status dos limites definidos</li>
            <li><strong>Metas:</strong> Progresso dos objetivos financeiros</li>
            <li><strong>Previsão:</strong> Projeção de saldo futuro baseada em padrões</li>
          </ul>`
        },
        { q: 'O que é a Previsão de Saldo (Forecast)?', a: `
          <p>O Forecast usa seus dados históricos para prever o futuro:</p>
          <ol style="padding-left:1.5rem;line-height:2">
            <li>Analisa receitas e despesas recorrentes</li>
            <li>Identifica padrões sazonais</li>
            <li>Projeta o saldo para os próximos meses</li>
          </ol>
          <div style="margin-top:1rem;padding:1rem;background:rgba(139,92,246,.08);border-radius:8px">
            🔮 <strong>Precisão:</strong> Quanto mais histórico registrado, mais precisa a previsão!
          </div>`
        },
        { q: 'Como usar o Assistente IA?', a: `
          <p>O assistente IA responde perguntas sobre suas finanças:</p>
          <ul style="padding-left:1.5rem;line-height:2">
            <li>Clique no ícone de chat no canto inferior direito</li>
            <li>Pergunte: "Quanto gastei com alimentação este mês?"</li>
            <li>Ou: "Qual minha maior despesa?"</li>
            <li>Também pode pedir: "Me dê dicas para economizar"</li>
          </ul>
          <p style="margin-top:.75rem"><strong>100% offline:</strong> Seus dados nunca saem do seu dispositivo!</p>`
        },
        { q: 'O que são Desafios e Conquistas?', a: `
          <p>O sistema de gamificação te motiva a manter o controle:</p>
          <ul style="padding-left:1.5rem;line-height:2">
            <li><strong>Desafios:</strong> Metas automáticas baseadas nos seus dados (ex: reduzir gastos em uma categoria)</li>
            <li><strong>Conquistas:</strong> Medalhas por marcos (ex: 100 transações, 7 dias de streak)</li>
            <li><strong>XP e Níveis:</strong> Ganhe pontos e suba de nível</li>
          </ul>
          <p style="margin-top:.75rem">Vá em <strong>Desafios & Conquistas</strong> para ver seu progresso!</p>`
        },
      ]
    },
    budgets: {
      icon: '🎯', title: 'Orçamentos', color: '#f59e0b',
      items: [
        { q: 'Como criar um orçamento?', a: `
          <ol style="padding-left:1.5rem;line-height:2">
            <li>Vá na página <strong>Orçamentos</strong></li>
            <li>Clique em "Novo Orçamento"</li>
            <li>Selecione a categoria (ex: Alimentação)</li>
            <li>Defina o valor limite mensal</li>
            <li>Escolha se aplica a todos os meses ou apenas um específico</li>
            <li>Salve</li>
          </ol>
          <div style="margin-top:1rem;padding:1rem;background:rgba(245,158,11,.08);border-radius:8px">
            ⚠️ <strong>Alertas:</strong> O sistema notificará quando você estiver perto do limite!
          </div>`
        },
        { q: 'O que acontece quando estouro o orçamento?', a: `
          <p>Quando você ultrapassa o limite definido:</p>
          <ul style="padding-left:1.5rem;line-height:2">
            <li>O orçamento fica destacado em vermelho no dashboard</li>
            <li>Você recebe uma notificação visual</li>
            <li>O relatório mostra o quanto excedeu</li>
          </ul>
          <p style="margin-top:.75rem"><strong>Dica:</strong> Ajuste o orçamento ou revise seus gastos na categoria!</p>`
        },
      ]
    },
    goals: {
      icon: '🌟', title: 'Metas', color: '#8b5cf6',
      items: [
        { q: 'Como criar uma meta financeira?', a: `
          <ol style="padding-left:1.5rem;line-height:2">
            <li>Vá em <strong>Metas Financeiras</strong></li>
            <li>Clique em "Nova Meta"</li>
            <li>Preencha: nome, valor alvo, data limite (opcional)</li>
            <li>Adicione um ícone/emoji para identificar</li>
            <li>Salve e acompanhe o progresso</li>
          </ol>
          <p style="margin-top:.75rem"><strong>Exemplos:</strong> Reserva de Emergência (R$ 10.000), Viagem (R$ 5.000), Carro Novo (R$ 50.000)</p>`
        },
        { q: 'Como acompanhar o progresso das metas?', a: `
          <p>No cartão de cada meta você vê:</p>
          <ul style="padding-left:1.5rem;line-height:2">
            <li>Valor já acumulado</li>
            <li>Barra de progresso visual</li>
            <li>Percentual concluído</li>
            <li>Previsão de conclusão (se houver data)</li>
          </ul>`
        },
      ]
    },
    reports: {
      icon: '📊', title: 'Relatórios', color: '#ef4444',
      items: [
        { q: 'Que tipos de relatórios estão disponíveis?', a: `
          <ul style="padding-left:1.5rem;line-height:2">
            <li><strong>Receitas vs Despesas:</strong> Comparativo mensal</li>
            <li><strong>Por Categoria:</strong> Gráfico de pizza com distribuição</li>
            <li><strong>Evolução Patrimonial:</strong> Como seu patrimônio mudou ao longo do tempo</li>
            <li><strong>50/30/20:</strong> Análise da regra orçamentária</li>
            <li><strong>Benchmark:</strong> Compare seus gastos com médias nacionais</li>
          </ul>`
        },
        { q: 'Como exportar relatórios?', a: `
          <p>Em breve você poderá exportar relatórios em PDF e Excel. Por enquanto, use a função de impressão do navegador (Ctrl+P) para salvar como PDF.</p>`
        },
      ]
    },
    tips: {
      icon: '💡', title: 'Dicas Pro', color: '#06b6d4',
      items: [
        { q: 'Melhores práticas para controle financeiro', a: `
          <ul style="padding-left:1.5rem;line-height:2">
            <li>✅ Registre transações diariamente (leva apenas 5 min)</li>
            <li>✅ Revise seus orçamentos semanalmente</li>
            <li>✅ Automatize sua poupança (transfira no dia do pagamento)</li>
            <li>✅ Use categorias específicas (não use "Outros")</li>
            <li>✅ Importe extratos mensalmente para conferência</li>
            <li>✅ Acompanhe suas metas pelo menos 1x por semana</li>
          </ul>`
        },
        { q: 'Como economizar mais dinheiro?', a: `
          <p>Estratégias comprovadas:</p>
          <ol style="padding-left:1.5rem;line-height:2">
            <li><strong>Regra 50/30/20:</strong> 50% necessidades, 30% desejos, 20% poupança</li>
            <li><strong>Desafio dos 30 dias:</strong> Espere 30 dias antes de compras impulsivas</li>
            <li><strong>Cancelar assinaturas:</strong> Revise todas e cancele as não usadas</li>
            <li><strong>Cozinhar em casa:</strong> Reduza delivery e restaurantes</li>
            <li><strong>Automatizar investimentos:</strong> Configure transferência automática</li>
          </ol>`
        },
      ]
    },
  };

  /* ── Renderiza a página de ajuda ── */
  function render() {
    const zone = $('page-help');
    if (!zone) return;

    zone.innerHTML = `
      <div class="page-hdr">
        <div>
          <h1 class="page-title">📖 Central de Ajuda & Tutorial</h1>
          <p class="page-sub">Tudo o que você precisa saber sobre o FinancePro</p>
        </div>
        <div style="position:relative;max-width:280px">
          <input type="text" id="helpSearch" placeholder="Buscar ajuda..." 
            style="width:100%;padding:.6rem .75rem .6rem 2.5rem;border-radius:8px;border:1px solid var(--bdr);background:var(--surf);color:var(--txt);font-size:.85rem"
            onkeyup="FP_HELP.search(this.value)"/>
          <i class="fas fa-search" style="position:absolute;left:.75rem;top:50%;transform:translateY(-50%);color:var(--txt2)"></i>
        </div>
      </div>

      <!-- Tabs de categorias -->
      <div class="auth-tabs" style="max-width:900px;margin-bottom:1.25rem;display:flex;flex-wrap:wrap;gap:.5rem" id="helpTabs">
        ${Object.entries(HELP_CONTENT).map(([key, cat]) => `
          <button class="auth-tab" onclick="FP_HELP.selectCategory('${key}', this)" style="display:flex;align-items:center;gap:.4rem">
            ${cat.icon} ${cat.title}
          </button>
        `).join('')}
      </div>

      <!-- Conteúdo -->
      <div id="helpContent" style="max-width:900px"></div>

      <!-- Dicas rápidas -->
      <div class="card" style="margin-top:1.25rem;padding:1rem;background:linear-gradient(135deg,rgba(var(--accent-rgb),.08),rgba(59,130,246,.08))">
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem">
          <i class="fas fa-lightbulb" style="color:var(--warning);font-size:1.2rem"></i>
          <span style="font-weight:700;font-size:.9rem">Dica do Dia</span>
        </div>
        <p id="dailyTip" style="font-size:.85rem;color:var(--txt2);line-height:1.7"></p>
      </div>
    `;

    // Selecionar primeira categoria
    const firstTab = zone.querySelector('.auth-tab');
    if (firstTab) {
      firstTab.classList.add('active');
      FP_HELP.selectCategory('quickstart', firstTab);
    }

    // Dica do dia
    showDailyTip();
  }

  /* ── Mostrar dica do dia ── */
  function showDailyTip() {
    const tips = [
      'Registre suas transações todos os dias — leva apenas 5 minutos!',
      'Use a regra 50/30/20: 50% necessidades, 30% desejos, 20% poupança.',
      'Automatize sua poupança: transfira no dia do pagamento.',
      'Crie uma reserva de emergência de 3-6 meses de despesas.',
      'Revise seus orçamentos semanalmente para não estourar.',
      'Use metas financeiras para manter a motivação.',
      'Importe extratos mensalmente para conferência.',
      'Categorize tudo — evite usar "Outros".',
      'Acompanhe seu streak: registre transações todos os dias!',
      'Use o assistente IA para tirar dúvidas rápidas.',
    ];
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const tip = tips[dayOfYear % tips.length];
    const el = $('dailyTip');
    if (el) el.textContent = tip;
  }

  /* ── API pública ── */
  const FP_HELP = {
    selectCategory(key, btn) {
      document.querySelectorAll('#helpTabs .auth-tab').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      
      const cat = HELP_CONTENT[key];
      if (!cat) return;

      const content = $('helpContent');
      if (!content) return;

      content.innerHTML = `
        <div class="card" style="margin-bottom:1rem">
          <div class="card-hdr">
            <span class="card-title" style="display:flex;align-items:center;gap:.5rem">
              ${cat.icon} ${cat.title}
            </span>
          </div>
          <div style="padding:1rem 1.25rem">
            ${cat.items.map((item, i) => `
              <details style="margin-bottom:.75rem;border:1px solid var(--bdr);border-radius:8px;overflow:hidden">
                <summary style="padding:.75rem 1rem;cursor:pointer;background:var(--bg-s);font-weight:600;font-size:.9rem;display:flex;justify-content:space-between;align-items:center;list-style:none">
                  ${item.q}
                  <i class="fas fa-chevron-down" style="transition:transform .2s"></i>
                </summary>
                <div style="padding:1rem 1.25rem;border-top:1px solid var(--bdr);font-size:.87rem;line-height:1.7;color:var(--txt)">
                  ${item.a}
                </div>
              </details>
            `).join('')}
          </div>
        </div>
      `;

      // Animar chevron ao abrir/fechar
      content.querySelectorAll('details').forEach(d => {
        d.addEventListener('toggle', () => {
          const icon = d.querySelector('.fa-chevron-down');
          if (icon) icon.style.transform = d.open ? 'rotate(180deg)' : '';
        });
      });
    },

    search(query) {
      const q = query.toLowerCase().trim();
      const content = $('helpContent');
      if (!content) return;

      if (!q) {
        // Restaurar categoria atual
        const activeTab = $('helpTabs')?.querySelector('.auth-tab.active');
        if (activeTab) {
          const key = Object.keys(HELP_CONTENT).find(k => HELP_CONTENT[k].title === activeTab.textContent.trim().slice(2));
          if (key) this.selectCategory(key, activeTab);
        }
        return;
      }

      // Buscar em todo conteúdo
      const results = [];
      Object.entries(HELP_CONTENT).forEach(([catKey, cat]) => {
        cat.items.forEach(item => {
          if (item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)) {
            results.push({ ...item, category: cat.title, icon: cat.icon });
          }
        });
      });

      if (results.length === 0) {
        content.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-search" style="font-size:2rem;color:var(--txt2);margin-bottom:.5rem"></i>
            <p class="empty-text">Nenhum resultado encontrado para "${query}"</p>
            <p style="font-size:.8rem;color:var(--txt2);margin-top:.25rem">Tente outros termos ou navegue pelas categorias.</p>
          </div>
        `;
        return;
      }

      content.innerHTML = `
        <div class="card">
          <div class="card-hdr">
            <span class="card-title">
              <i class="fas fa-search" style="color:var(--accent)"></i>
              Resultados para "${query}" (${results.length})
            </span>
          </div>
          <div style="padding:1rem 1.25rem">
            ${results.map(item => `
              <details style="margin-bottom:.75rem;border:1px solid var(--bdr);border-radius:8px;overflow:hidden">
                <summary style="padding:.75rem 1rem;cursor:pointer;background:var(--bg-s);font-weight:600;font-size:.9rem;display:flex;justify-content:space-between;align-items:center;list-style:none">
                  <span>${item.icon} ${item.q}</span>
                  <span style="font-size:.7rem;padding:2px 8px;border-radius:99px;background:var(--accent);color:#fff">${item.category}</span>
                </summary>
                <div style="padding:1rem 1.25rem;border-top:1px solid var(--bdr);font-size:.87rem;line-height:1.7;color:var(--txt)">
                  ${item.a}
                </div>
              </details>
            `).join('')}
          </div>
        </div>
      `;

      content.querySelectorAll('details').forEach(d => {
        d.addEventListener('toggle', () => {
          const icon = d.querySelector('.fa-chevron-down');
          if (icon) icon.style.transform = d.open ? 'rotate(180deg)' : '';
        });
      });
    },
  };

  window.FP_HELP = FP_HELP;
  window.loadHelp = async function () {
    const u = window.S?.user;
    if (!u) { setTimeout(window.loadHelp, 500); return; }
    render();
  };

  /* ── Auto-init ── */
  (function autoInit() {
    const pageId = 'page-help';
    const loadFn = 'loadHelp';
    function tryRender() {
      const page = document.getElementById(pageId);
      if (page && page.classList.contains('active')) {
        const fn = window[loadFn];
        if (typeof fn === 'function') fn();
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(tryRender, 300));
    } else {
      setTimeout(tryRender, 300);
    }
    const origNav = window.navigate;
    if (typeof origNav === 'function' && !window['__' + pageId + 'Hooked']) {
      window['__' + pageId + 'Hooked'] = true;
      window.navigate = function(page, ...args) {
        const r = origNav.call(this, page, ...args);
        if (page === 'help') {
          setTimeout(() => { const fn = window[loadFn]; if (typeof fn === 'function') fn(); }, 150);
        }
        return r;
      };
    }
  })();

})();
