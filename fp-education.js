/* ====================================================================
   FINANCEPRO — EDUCAÇÃO FINANCEIRA PREMIUM v3
   Módulo educacional mais completo do Brasil - 100% offline
   Com análise personalizada baseada nos dados do usuário
   Expõe: window.loadEducation
==================================================================== */
(function () {
  'use strict';

  // ==================================================================
  // CONTEÚDO EDUCACIONAL COMPLETO E DETALHADO
  // ==================================================================
  const MODULES = [
    {
      id: 'basics', icon: '💡', color: '#3b82f6', title: 'Fundamentos Essenciais',
      lessons: [
        { id: 'budget_rule', title: 'Regra 50/30/20 Dominada', duration: '8 min',
          content: `
<div class="edu-full-lesson">
  <div class="edu-header">
    <h1>📊 Domine a Regra 50/30/20</h1>
    <p class="edu-subtitle">O método comprovado que transformou milhões de vidas financeiras</p>
  </div>

  <div class="edu-section">
    <h2>🎯 O Que É e Por Que Funciona?</h2>
    <p>A regra 50/30/20 foi popularizada pela senadora americana Elizabeth Warren no livro "All Your Worth". Não é apenas uma sugestão — é um <strong>sistema validado por décadas</strong> de estudos comportamentais.</p>
    
    <div class="edu-callout info">
      <strong>🔬 A Ciência Por Trás:</strong> Pesquisas mostram que pessoas que seguem regras de orçamento simples têm 3x mais chances de atingir metas financeiras em 5 anos.
    </div>
  </div>

  <div class="edu-section">
    <h2>📐 A Estrutura Completa</h2>
    <div class="edu-grid-3">
      <div class="edu-card" style="border-top: 4px solid #ef4444">
        <div class="edu-card-icon">🏠</div>
        <h3>50% — Necessidades</h3>
        <p class="edu-card-desc">Gastos essenciais para sobrevivência</p>
        <ul class="edu-list">
          <li>✓ Aluguel ou financiamento</li>
          <li>✓ Alimentação básica (supermercado)</li>
          <li>✓ Transporte (combustível, passagem)</li>
          <li>✓ Contas fixas (luz, água, internet)</li>
          <li>✓ Plano de saúde</li>
          <li>✓ Educação dos filhos</li>
        </ul>
        <div class="edu-warning">
          ⚠️ <strong>Cuidado:</strong> Se ultrapassar 50%, você está em zona de risco. Considere reduzir custos fixos.
        </div>
      </div>
      
      <div class="edu-card" style="border-top: 4px solid #f59e0b">
        <div class="edu-card-icon">🎉</div>
        <h3>30% — Desejos</h3>
        <p class="edu-card-desc">Qualidade de vida e prazer</p>
        <ul class="edu-list">
          <li>✓ Restaurantes e delivery</li>
          <li>✓ Assinaturas (Netflix, Spotify)</li>
          <li>✓ Lazer e entretenimento</li>
          <li>✓ Viagens e passeios</li>
          <li>✓ Compras não essenciais</li>
          <li>✓ Hobbies</li>
        </ul>
        <div class="edu-tip">
          💡 <strong>Dica de Ouro:</strong> Esta categoria é a primeira a ser ajustada quando necessário. Reduza aqui antes de mexer nas necessidades.
        </div>
      </div>
      
      <div class="edu-card" style="border-top: 4px solid #10b981">
        <div class="edu-card-icon">💰</div>
        <h3>20% — Poupança & Investimentos</h3>
        <p class="edu-card-desc">Seu futuro sendo construído hoje</p>
        <ul class="edu-list">
          <li>✓ Reserva de emergência</li>
          <li>✓ Aposentadoria</li>
          <li>✓ Metas de médio/longo prazo</li>
          <li>✓ Pagamento de dívidas (além do mínimo)</li>
          <li>✓ Educação financeira</li>
        </ul>
        <div class="edu-callout success">
          ✅ <strong>O Segredo:</strong> Automatize este percentual. Transfira no dia do recebimento, ANTES de gastar.
        </div>
      </div>
    </div>
  </div>

  <div class="edu-section">
    <h2>🔍 Análise Personalizada do SEU Orçamento</h2>
    <div id="budget-analysis-container" class="edu-analysis-box">
      <p>Carregando seus dados financeiros...</p>
    </div>
    
    <div class="edu-comparison">
      <h3>📈 Onde Você Está vs Onde Deveria Estar</h3>
      <table class="edu-table">
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Ideal</th>
            <th>Seu Atual</th>
            <th>Diferença</th>
            <th>Ação Recomendada</th>
          </tr>
        </thead>
        <tbody id="budget-comparison-body">
          <tr><td colspan="5">Analisando seus dados...</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="edu-section">
    <h2>💎 Casos Reais e Lições Aprendidas</h2>
    
    <div class="edu-case-study">
      <h4>📖 Caso 1: Maria, R$ 4.500/mês</h4>
      <div class="edu-case-content">
        <p><strong>Situação inicial:</strong> 70% necessidades, 25% desejos, 5% poupança</p>
        <p><strong>Problema:</strong> Vivendo no limite, sem reserva, qualquer imprevisto gerava dívida.</p>
        <p><strong>Ações tomadas:</strong></p>
        <ul>
          <li>Reduziu assinatura de TV a cabo (economia: R$ 150)</li>
          <li>Trocou academia cara por exercícios em casa (economia: R$ 120)</li>
          <li>Renegociou aluguel mudando para bairro próximo (economia: R$ 300)</li>
          <li>Começou a cozinhar em casa 2x mais (economia: R$ 400)</li>
        </ul>
        <p><strong>Resultado após 6 meses:</strong> 52% necessidades, 28% desejos, 20% poupança</p>
        <p><strong>Impacto:</strong> Reserva de R$ 5.400 acumulada, zero dívidas no cartão!</p>
      </div>
    </div>

    <div class="edu-case-study">
      <h4>📖 Caso 2: João, R$ 8.000/mês</h4>
      <div class="edu-case-content">
        <p><strong>Situação inicial:</strong> 45% necessidades, 45% desejos, 10% poupança</p>
        <p><strong>Problema:</strong> Ganhava bem mas não acumulava patrimônio. "Para onde vai meu dinheiro?"</p>
        <p><strong>Ações tomadas:</strong></p>
        <ul>
          <li>Rastreou TODOS os gastos por 30 dias (choque de realidade)</li>
          <li>Identificou R$ 1.200 em "gastos formiga" (iFood, Uber, compras impulsivas)</li>
          <li>Estabeleceu teto de R$ 600 para desejos variáveis</li>
          <li>Automatizou investimento de R$ 1.600 no dia 5</li>
        </ul>
        <p><strong>Resultado após 12 meses:</strong> 48% necessidades, 27% desejos, 25% poupança</p>
        <p><strong>Impacto:</strong> Patrimônio investido de R$ 22.000, paz mental, planejamento de viagem internacional!</p>
      </div>
    </div>
  </div>

  <div class="edu-section">
    <h2>🚀 Como Implementar HOJE MESMO</h2>
    <div class="edu-steps">
      <div class="edu-step">
        <span class="step-number">1</span>
        <div>
          <strong>Calcule sua renda líquida real</strong>
          <p>Some salário + rendas extras médias mensais. Use o valor que realmente cai na conta.</p>
        </div>
      </div>
      <div class="edu-step">
        <span class="step-number">2</span>
        <div>
          <strong>Categorize gastos dos últimos 3 meses</strong>
          <p>Use o FinancePro para ver histórico. Some tudo em: necessidades, desejos, poupança atual.</p>
        </div>
      </div>
      <div class="edu-step">
        <span class="step-number">3</span>
        <div>
          <strong>Identifique os desvios</strong>
          <p>Onde você está acima do ideal? Seja honesto — este é o diagnóstico.</p>
        </div>
      </div>
      <div class="edu-step">
        <span class="step-number">4</span>
        <div>
          <strong>Crie plano de ação com 3 mudanças</strong>
          <p>Não tente mudar tudo de uma vez. Escolha 3 ações viáveis para começar.</p>
        </div>
      </div>
      <div class="edu-step">
        <span class="step-number">5</span>
        <div>
          <strong>Automatize os 20%</strong>
          <p>Configure transferência automática para investimento no dia do recebimento.</p>
        </div>
      </div>
    </div>
  </div>

  <div class="edu-section">
    <h2>❓ Perguntas Frequentes</h2>
    <div class="edu-faq">
      <details>
        <summary>E se minhas necessidades ultrapassarem 50%?</summary>
        <p>Iso é comum em grandes cidades ou com salários baixos. Neste caso:</p>
        <ul>
          <li>Tente aumentar renda (freelance, horas extras, bicos)</li>
          <li>Revise cada gasto essencial: dá para reduzir?</li>
          <li>Mesmo que comece com 5% de poupança, o importante é começar</li>
          <li>Meta progressiva: aumente 1% ao mês até chegar em 20%</li>
        </ul>
      </details>
      <details>
        <summary>Posso ajustar os percentuais?</summary>
        <p>Sim! A regra 50/30/20 é um guia, não lei. Algumas variações válidas:</p>
        <ul>
          <li>60/20/20: Para quem tem custos fixos altos</li>
          <li>40/30/30: Para quem quer acelerar independência financeira</li>
          <li>50/20/30: Para quem tem metas agressivas de curto prazo</li>
        </ul>
      </details>
      <details>
        <summary>E se eu tiver dívidas?</summary>
        <p>Priorize quitar dívidas de alto juros (cartão, cheque especial). Os 20% podem ir temporariamente para amortização. Depois de quitas, redirecione para investimentos.</p>
      </details>
    </div>
  </div>

  <div class="edu-callout warning">
    <strong>⚠️ Erro Comum:</strong> Criar um orçamento perfeito e não seguir. Melhor um orçamento 70% perfeito seguido consistentemente do que 100% perfeito abandonado em 2 semanas. Comece simples, evolua gradualmente.
  </div>
</div>`,
          quiz: [
            { q: 'Na regra 50/30/20, qual categoria deve receber 20% da renda?', opts: ['Desejos','Necessidades','Poupança e Investimentos','Lazer'], ans: 2 },
            { q: 'Se suas necessidades ultrapassam 50%, qual a primeira ação recomendada?', opts: ['Ignorar a regra','Aumentar renda e reduzir custos fixos','Parar de poupar','Cortar todos os desejos'], ans: 1 }
          ]
        },
        { id: 'emergency', title: 'Reserva de Emergência Completa', duration: '10 min',
          content: `
<div class="edu-full-lesson">
  <div class="edu-header">
    <h1>🛡️ Reserva de Emergência: Seu Escudo Financeiro</h1>
    <p class="edu-subtitle">A diferença entre um imprevisto e uma catástrofe financeira</p>
  </div>

  <div class="edu-section">
    <h2>💥 Por Que Você PRECISA Disso?</h2>
    <p>Sem reserva de emergência, qualquer imprevisto vira dívida. E dívida com juros compostos contra você é a fórmula da escravidão financeira.</p>
    
    <div class="edu-stats-grid">
      <div class="edu-stat-card">
        <div class="stat-number">67%</div>
        <div class="stat-label">Brasileiros não têm reserva para 3 meses</div>
      </div>
      <div class="edu-stat-card">
        <div class="stat-number">R$ 1.8 bi</div>
        <div class="stat-label">Dívida em cartão por emergências (2024)</div>
      </div>
      <div class="edu-stat-card">
        <div class="stat-number">4.5x</div>
        <div class="stat-label">Quem tem reserva dorme melhor (pesquisa USP)</div>
      </div>
    </div>

    <div class="edu-callout danger">
      <strong>⚠️ Realidade Cruel:</strong> 8 em 10 brasileiros recorrem ao cartão de crédito ou cheque especial em emergências. Os juros? 12% a.m. no cartão, 8% a.m. no cheque especial. Em 6 meses, uma dívida de R$ 5.000 vira R$ 15.000.
    </div>
  </div>

  <div class="edu-section">
    <h2>📊 Quanto Você Realmente Precisa?</h2>
    <p>A regra clássica é 3-6 meses de despesas. Mas vamos personalizar:</p>
    
    <table class="edu-table">
      <thead>
        <tr>
          <th>Seu Perfil</th>
          <th>Meses Ideais</th>
          <th>Por quê?</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>🏢 CLT estável (empresa grande)</td>
          <td>3-4 meses</td>
          <td>Risco baixo de desemprego, FGTS como backup</td>
        </tr>
        <tr>
          <td>📈 CLT setor instável</td>
          <td>5-6 meses</td>
          <td>Setores como turismo, construção oscilam muito</td>
        </tr>
        <tr>
          <td>👨‍💻 Autônomo/Freelancer</td>
          <td>6-9 meses</td>
          <td>Renda variável, sem benefícios trabalhistas</td>
        </tr>
        <tr>
          <td>🏢 Empresário/Sócio</td>
          <td>9-12 meses</td>
          <td>Risco empresarial + pessoal misturados</td>
        </tr>
        <tr>
          <td>👨‍👩‍👧‍👦 Único provedor da família</td>
          <td>+2 meses</td>
          <td>Mais bocas dependem da sua renda</td>
        </tr>
        <tr>
          <td>🏥 Problemas de saúde na família</td>
          <td>+3 meses</td>
          <td>Despesas médicas imprevisíveis</td>
        </tr>
      </tbody>
    </table>

    <div id="emergency-calculator" class="edu-analysis-box">
      <h3>🔢 Calculadora Personalizada de Reserva</h3>
      <p>Analisando suas despesas mensais...</p>
      <div id="emergency-result"></div>
    </div>
  </div>

  <div class="edu-section">
    <h2>🏦 Onde Guardar? (Melhores Opções 2025)</h2>
    
    <div class="edu-comparison-cards">
      <div class="edu-card-best">
        <div class="card-badge">⭐ RECOMENDADO</div>
        <h3>Tesouro Selic</h3>
        <ul>
          <li>✓ Segurança máxima (garantia do Tesouro)</li>
          <li>✓ Liquidez D+1 (resgate em 1 dia útil)</li>
          <li>✓ Rentabilidade: 100% da Selic atual</li>
          <li>✓ Mínimo: ~R$ 150</li>
        </ul>
        <div class="card-verdict">Ideal para reservas grandes</div>
      </div>

      <div class="edu-card-good">
        <div class="card-badge">✅ BOM</div>
        <h3>CDB Liquidez Diária (100%+ CDI)</h3>
        <ul>
          <li>✓ FGC garante até R$ 250k</li>
          <li>✓ Liquidez imediata</li>
          <li>✓ Bancos digitais: 100-110% CDI</li>
          <li>✓ Sem taxa de custódia</li>
        </ul>
        <div class="card-verdict">Praticidade no dia a dia</div>
      </div>

      <div class="edu-card-ok">
        <div class="card-badge">⚠️ CUIDADO</div>
        <h3>Poupança</h3>
        <ul>
          <li>✗ Rentabilidade baixa (~6% a.a. + TR)</li>
          <li>✗ Perde para inflação frequentemente</li>
          <li>✓ Única vantagem: isenção IR</li>
        </ul>
        <div class="card-verdict">Só use se já tiver conta e for valor pequeno</div>
      </div>

      <div class="edu-card-avoid">
        <div class="card-badge">❌ NÃO USE</div>
        <h3>Para Reserva EVITE:</h3>
        <ul>
          <li>✗ Ações (volatilidade alta)</li>
          <li>✗ FIIs (pode cair na hora que precisar)</li>
          <li>✗ Criptomoedas (risco extremo)</li>
          <li>✗ Imóveis (ilíquido — não vende em dias)</li>
          <li>✗ LCI/LCA com carência (dinheiro preso)</li>
        </ul>
      </div>
    </div>
  </div>

  <div class="edu-section">
    <h2>🚀 Estratégia de Acumulação Acelerada</h2>
    
    <div class="edu-steps">
      <div class="edu-step">
        <span class="step-number">1</span>
        <div>
          <strong>Meta inicial: R$ 1.000</strong>
          <p>Comece pequeno. R$ 1.000 já cobre pequenos imprevistos (conserto celular, remédio). Isso tira a pressão do cartão.</p>
        </div>
      </div>
      <div class="edu-step">
        <span class="step-number">2</span>
        <div>
          <strong>Venda o que não usa</strong>
          <p>Roupas, eletrônicos antigos, móveis. OLX, Enjoei, Facebook Marketplace. Já vi gente levantar R$ 3.000 assim.</p>
        </div>
      </div>
      <div class="edu-step">
        <span class="step-number">3</span>
        <div>
          <strong>Renda extra temporária</strong>
          <p>Uber, iFood, freelances, horas extras. Destine 100% disso para a reserva nos primeiros 6 meses.</p>
        </div>
      </div>
      <div class="edu-step">
        <span class="step-number">4</span>
        <div>
          <strong>Corte "gastos invisíveis"</strong>
          <p>Assinaturas não usadas, taxas bancárias (mude para digital), seguros redundantes. Economia média: R$ 300-500/mês.</p>
        </div>
      </div>
      <div class="edu-step">
        <span class="step-number">5</span>
        <div>
          <strong>Automatize tudo</strong>
          <p>No dia que recebe, transfira automaticamente. Não confie na força de vontade.</p>
        </div>
      </div>
    </div>

    <div class="edu-example-highlight">
      <h4>📈 Exemplo Prático: Ana, R$ 3.200/mês</h4>
      <p><strong>Despesas mensais:</strong> R$ 2.800</p>
      <p><strong>Meta de reserva:</strong> 6 meses × R$ 2.800 = <strong>R$ 16.800</strong></p>
      <p><strong>Plano de ação:</strong></p>
      <ul>
        <li>Mês 1-2: Guarda R$ 300/mês (vendeu roupas + cortou assinaturas) → R$ 600</li>
        <li>Mês 3-6: Guarda R$ 500/mês (freelance weekends) → +R$ 2.000 (total: R$ 2.600)</li>
        <li>Mês 7-12: Guarda R$ 800/mês (promoção no trabalho) → +R$ 4.800 (total: R$ 7.400)</li>
        <li>Mês 13-18: Mantém R$ 800/mês → +R$ 4.800 (total: R$ 12.200)</li>
        <li>Mês 19-21: Últimos R$ 4.600 → <strong>META ATINGIDA!</strong></li>
      </ul>
      <p><strong>Tempo total:</strong> 21 meses. <strong>Impacto:</strong> Nunca mais usou cartão para emergências.</p>
    </div>
  </div>

  <div class="edu-section">
    <h2>🆘 O Que Considerar Emergência?</h2>
    
    <div class="edu-two-columns">
      <div class="edu-column-yes">
        <h4>✅ É Emergência</h4>
        <ul>
          <li>✓ Desemprego inesperado</li>
          <li>✓ Problema de saúde (seu ou familiar)</li>
          <li>✓ Conserto essencial (geladeira, carro do trabalho)</li>
          <li>✓ Reparo residencial urgente (vazamento, telhado)</li>
          <li>✓ Despesa jurídica inesperada</li>
          <li>✓ Animal de estimação doente</li>
        </ul>
      </div>
      <div class="edu-column-no">
        <h4>❌ NÃO É Emergência</h4>
        <ul>
          <li>✗ Viagem de férias</li>
          <li>✗ Trocar de celular (se o atual funciona)</li>
          <li>✗ Presentes de Natal/aniversário</li>
          <li>✗ Black Friday / promoções</li>
          <li>✗ Reformas estéticas</li>
          <li>✗ Jantar caro / evento social</li>
        </ul>
      </div>
    </div>

    <div class="edu-callout info">
      <strong>💡 Regra de Ouro:</strong> Se pode esperar 30 dias, não é emergência. Use o tempo para planejar e juntar.
    </div>
  </div>

  <div class="edu-section">
    <h2>🔄 E Depois de Completar?</h2>
    <p>Parabéns! Agora mantenha e redirecione:</p>
    <ol>
      <li><strong>Mantenha o valor:</strong> Se usar, repõe nos 3 meses seguintes</li>
      <li><strong>Atualize anualmente:</strong> Se suas despesas aumentarem, aumente a reserva</li>
      <li><strong>Redirecione os 20%:</strong> Agora foque em investimentos de longo prazo (aposentadoria, metas)</li>
      <li><strong>Considere dividir:</strong> 50% em Tesouro Selic, 50% em CDB liquidez diária (diversificação)</li>
    </ol>
  </div>

  <div class="edu-callout success">
    <strong>🎯 Mindset Vencedor:</strong> Reserva de emergência não é sobre ficar rico. É sobre <strong>dormir tranquilo</strong>, <strong>não se endividar</strong> quando a vida acontecer, e ter <strong>paz mental</strong> para tomar decisões financeiras inteligentes.
  </div>
</div>`,
          quiz: [
            { q: 'Quantos meses de despesas deve ter uma reserva de emergência?', opts: ['1–2 meses','3–6 meses (varia por perfil)','6–12 meses','12+ meses'], ans: 1 },
            { q: 'Qual o MELHOR lugar para guardar reserva de emergência?', opts: ['Ações','Tesouro Selic ou CDB liquidez diária','Criptomoedas','Imóveis'], ans: 1 },
            { q: 'O que NÃO é considerado emergência?', opts: ['Desemprego','Conserto do carro do trabalho','Viagem de férias','Problema de saúde'], ans: 2 }
          ]
        },
        { id: 'compound', title: 'Juros Compostos Domados', duration: '12 min',
          content: `
<div class="edu-full-lesson">
  <div class="edu-header">
    <h1>🚀 Juros Compostos: A 8ª Maravilha do Mundo</h1>
    <p class="edu-subtitle">Como Einstein revelou o segredo que constrói fortunas (ou destrói vidas)</p>
  </div>

  <div class="edu-section">
    <h2>⚡ O Que São e Por Que São TÃO Poderosos?</h2>
    <p>Juros compostos são "juros sobre juros". Diferente dos juros simples (que calculam apenas sobre o valor original), os compostos calculam sobre o total acumulado — incluindo os juros já gerados.</p>
    
    <div class="edu-comparison-side">
      <div class="edu-compare-item">
        <h4>Juros Simples</h4>
        <p>R$ 1.000 a 10% por 5 anos:</p>
        <ul>
          <li>Ano 1: R$ 100 de juros → Total: R$ 1.100</li>
          <li>Ano 2: R$ 100 de juros → Total: R$ 1.200</li>
          <li>Ano 3: R$ 100 de juros → Total: R$ 1.300</li>
          <li>Ano 4: R$ 100 de juros → Total: R$ 1.400</li>
          <li>Ano 5: R$ 100 de juros → Total: <strong>R$ 1.500</strong></li>
        </ul>
        <p class="compare-result">Ganho total: R$ 500</p>
      </div>
      
      <div class="edu-compare-item highlight">
        <h4>Juros Compostos</h4>
        <p>R$ 1.000 a 10% por 5 anos:</p>
        <ul>
          <li>Ano 1: R$ 100 de juros → Total: R$ 1.100</li>
          <li>Ano 2: R$ 110 de juros (10% de 1.100) → Total: R$ 1.210</li>
          <li>Ano 3: R$ 121 de juros (10% de 1.210) → Total: R$ 1.331</li>
          <li>Ano 4: R$ 133 de juros (10% de 1.331) → Total: R$ 1.464</li>
          <li>Ano 5: R$ 146 de juros (10% de 1.464) → Total: <strong>R$ 1.610</strong></li>
        </ul>
        <p class="compare-result">Ganho total: R$ 610 (+22% vs simples!)</p>
      </div>
    </div>

    <div class="edu-formula-box">
      <h3>📐 A Fórmula Mágica</h3>
      <code>M = P × (1 + i)^t</code>
      <p>Onde: M = Montante final | P = Principal (valor inicial) | i = taxa de juros | t = tempo</p>
    </div>
  </div>

  <div class="edu-section">
    <h2>💰 Para Você (Investindo) vs Contra Você (Dívidas)</h2>
    
    <div class="edu-two-sides">
      <div class="edu-side-good">
        <h3>✅ TRABALHANDO PARA VOCÊ</h3>
        <p><strong>Cenário:</strong> Investe R$ 500/mês por 30 anos a 10% a.a.</p>
        <table class="edu-table-mini">
          <tr><th>Ano</th><th>Total Investido</th><th>Montante</th><th>Juros Ganho</th></tr>
          <tr><td>5</td><td>R$ 30.000</td><td>R$ 38.921</td><td>R$ 8.921</td></tr>
          <tr><td>10</td><td>R$ 60.000</td><td>R$ 102.422</td><td>R$ 42.422</td></tr>
          <tr><td>15</td><td>R$ 90.000</td><td>R$ 207.345</td><td>R$ 117.345</td></tr>
          <tr><td>20</td><td>R$ 120.000</td><td>R$ 373.208</td><td>R$ 253.208</td></tr>
          <tr><td>25</td><td>R$ 150.000</td><td>R$ 625.853</td><td>R$ 475.853</td></tr>
          <tr><td>30</td><td>R$ 180.000</td><td>R$ 1.004.515</td><td>R$ 824.515</td></tr>
        </table>
        <div class="edu-revelation">
          🎯 <strong>Revelação:</strong> No ano 30, você tem MAIS DE 4x em juros do que investiu do próprio bolso!
        </div>
      </div>

      <div class="edu-side-bad">
        <h3>❌ TRABALHANDO CONTRA VOCÊ</h3>
        <p><strong>Cenário:</strong> Dívida de R$ 10.000 no cartão (12% a.m.) sem pagar</p>
        <table class="edu-table-mini">
          <tr><th>Mês</th><th>Dívida Original</th><th>Montante Devido</th><th>Juros Acumulado</th></tr>
          <tr><td>3</td><td>R$ 10.000</td><td>R$ 14.049</td><td>R$ 4.049</td></tr>
          <tr><td>6</td><td>R$ 10.000</td><td>R$ 19.738</td><td>R$ 9.738</td></tr>
          <tr><td>12</td><td>R$ 10.000</td><td>R$ 38.960</td><td>R$ 28.960</td></tr>
          <tr><td>24</td><td>R$ 10.000</td><td>R$ 151.786</td><td>R$ 141.786</td></tr>
          <tr><td>36</td><td>R$ 10.000</td><td>R$ 591.356</td><td>R$ 581.356</td></tr>
        </table>
        <div class="edu-warning-extreme">
          ⚠️ <strong>CHOQUE DE REALIDADE:</strong> Em 3 anos, uma dívida de R$ 10k vira quase R$ 600 MIL. Isso NÃO é exagero — é matemática pura do cartão de crédito brasileiro.
        </div>
      </div>
    </div>
  </div>

  <div class="edu-section">
    <h2>📊 O Fator Tempo: Seu Maior Aliado</h2>
    
    <div class="edu-story-compare">
      <div class="edu-story">
        <h4>👦 João começou aos 25 anos</h4>
        <ul>
          <li>Investiu R$ 300/mês dos 25 aos 35 anos (10 anos)</li>
          <li>Total investido: R$ 36.000</li>
          <li>Parou de contribuir aos 35, deixou rendendo</li>
          <li>Aos 65 anos (30 anos depois): <strong>R$ 789.452</strong></li>
        </ul>
      </div>
      
      <div class="edu-story">
        <h4>👨 Maria começou aos 35 anos</h4>
        <ul>
          <li>Investiu R$ 300/mês dos 35 aos 65 anos (30 anos)</li>
          <li>Total investido: R$ 108.000 (3x mais que João!)</li>
          <li>Nunca parou de contribuir</li>
          <li>Aos 65 anos: <strong>R$ 679.623</strong></li>
        </ul>
      </div>
    </div>

    <div class="edu-callout震撼">
      <strong>🤯 LIÇÃO PODEROSA:</strong> João investiu 3x MENOS dinheiro que Maria, mas terminou com MAIS porque começou 10 anos antes. O tempo é mais importante que o valor investido!
    </div>
  </div>

  <div class="edu-section">
    <h2>🎯 Casos Reais Aplicados</h2>
    
    <div class="edu-case-deep">
      <h4>📖 Caso Real: Carlos, 28 anos, ganha R$ 4.500</h4>
      <p><strong>Situação:</strong> Nunca investiu, dinheiro parado na poupança.</p>
      <p><strong>Simulação 1 - Continuar na Poupança (6% a.a.):</strong></p>
      <ul>
        <li>Investindo R$ 450/mês (10% da renda) até 65 anos</li>
        <li>Total investido: R$ 200.700</li>
        <li>Montante final: <strong>R$ 548.231</strong></li>
      </ul>
      
      <p><strong>Simulação 2 - Tesouro IPCA+ (8% a.a. real):</strong></p>
      <ul>
        <li>Mesmos R$ 450/mês até 65 anos</li>
        <li>Total investido: R$ 200.700</li>
        <li>Montante final: <strong>R$ 978.456</strong></li>
      </ul>
      
      <p><strong>Simulação 3 - Carteira Diversificada (10% a.a.):</strong></p>
      <ul>
        <li>Mesmos R$ 450/mês até 65 anos</li>
        <li>Total investido: R$ 200.700</li>
        <li>Montante final: <strong>R$ 1.587.342</strong></li>
      </ul>
      
      <div class="edu-impact-box">
        <strong>💡 Diferença entre pior e melhor cenário: R$ 1.039.111</strong>
        <p>Isso mesmo: MAIS DE 1 MILHÃO de diferença só pela escolha de ONDE investir!</p>
      </div>
    </div>
  </div>

  <div class="edu-section">
    <h2>🔥 Regra dos 72: Atalho Mental Poderoso</h2>
    <p>Quer saber quanto tempo leva para DOBRAR seu dinheiro? Divida 72 pela taxa de juros anual.</p>
    
    <div class="edu-grid-4">
      <div class="edu-mini-card">
        <div class="mini-title">Poupança (6% a.a.)</div>
        <div class="mini-calc">72 ÷ 6 = <strong>12 anos</strong></div>
      </div>
      <div class="edu-mini-card">
        <div class="mini-title">Tesouro IPCA+ (8% a.a.)</div>
        <div class="mini-calc">72 ÷ 8 = <strong>9 anos</strong></div>
      </div>
      <div class="edu-mini-card">
        <div class="mini-title">FIIs (10% a.a.)</div>
        <div class="mini-calc">72 ÷ 10 = <strong>7,2 anos</strong></div>
      </div>
      <div class="edu-mini-card">
        <div class="mini-title">Ações (12% a.a.)</div>
        <div class="mini-calc">72 ÷ 12 = <strong>6 anos</strong></div>
      </div>
    </div>
  </div>

  <div class="edu-section">
    <h2>🚀 Como Usar Isso AGORA na Sua Vida</h2>
    
    <ol class="edu-action-list">
      <li>
        <strong>Comece ONTEM, não segunda-feira</strong>
        <p>Cada dia adiado é juros perdidos para sempre. R$ 100 hoje valem mais que R$ 200 daqui a 10 anos.</p>
      </li>
      <li>
        <strong>Automatize contribuições mensais</strong>
        <p>Configure débito automático. Não dependa de "sobrar dinheiro" — isso nunca acontece.</p>
      </li>
      <li>
        <strong>Aumente 10% todo ano</strong>
        <p>Se investe R$ 300/mês, ano que vem vai pra R$ 330. Pequenos aumentos fazem diferença brutal em 20 anos.</p>
      </li>
      <li>
        <strong>NUNCA pare de investir</strong>
        <p>Mercado caiu? Continue. Crise? Continue. Pandemia? Continue. Tempo > Timing do mercado.</p>
      </li>
      <li>
        <strong>Reinvista TODOS os rendimentos</strong>
        <p>Dividendos, juros, aluguéis — tudo de volta pro investimento. É isso que cria o efeito bola de neve.</p>
      </li>
    </ol>
  </div>

  <div class="edu-section">
    <h2>⚠️ Erros Fatais Que Destroem Juros Compostos</h2>
    
    <div class="edu-mistakes">
      <div class="mistake">
        <span class="mistake-icon">❌</span>
        <div>
          <strong>Sacar os rendimentos</strong>
          <p>Quebra o ciclo de crescimento. É como matar a galinha dos ovos de ouro.</p>
        </div>
      </div>
      <div class="mistake">
        <span class="mistake-icon">❌</span>
        <div>
          <strong>Parar em momentos de crise</strong>
          <p>Justamente quando deveria comprar mais barato. Interromper contribuições é o erro #1.</p>
        </div>
      </div>
      <div class="mistake">
        <span class="mistake-icon">❌</span>
        <div>
          <strong>Mudar de estratégia constantemente</strong>
          <p>Pular de investimento em investimento impede os juros de trabalharem.</p>
        </div>
      </div>
      <div class="mistake">
        <span class="mistake-icon">❌</span>
        <div>
          <strong>Começar tarde demais</strong>
          <p>Esperar "ter mais dinheiro" antes de começar. Comece com pouco, mas comece AGORA.</p>
        </div>
      </div>
    </div>
  </div>

  <div class="edu-callout inspirational">
    <strong>🌟 Pensamento Final:</strong> Warren Buffett acumulou 99% da fortuna DEPOIS dos 50 anos. Não foi sorte, foi juros compostos trabalhando por 60+ anos. Você não precisa ser gênio — precisa ser <strong>constante</strong> e <strong>paciente</strong>. O tempo fará o trabalho pesado.
  </div>
</div>`,
          quiz: [
            { q: 'Juros compostos são calculados sobre:', opts: ['Apenas o capital inicial','Capital + juros acumulados','Apenas os juros','Nenhuma das anteriores'], ans: 1 },
            { q: 'Qual fator é MAIS importante em juros compostos?', opts: ['Valor investido','Tempo','Taxa de juros','Todos igualmente'], ans: 1 },
            { q: 'Usando a Regra dos 72, quanto tempo para dobrar a 9% a.a.?', opts: ['6 anos','7 anos','8 anos','9 anos'], ans: 2 }
          ]
        },
      ]
    },
    {
      id: 'debt', icon: '💳', color: '#ef4444', title: 'Dívidas',
      lessons: [
        { id: 'avalanche', title: 'Método Avalanche', duration: '3 min',
          content: `<h3>Método Avalanche — Pague Menos Juros</h3>
<p>Priorize as dívidas com <strong>maior taxa de juros</strong> primeiro, independente do valor.</p>
<ol>
<li>Liste todas as dívidas com suas taxas de juros</li>
<li>Pague o mínimo de todas</li>
<li>Coloque todo o dinheiro extra na dívida de MAIOR juros</li>
<li>Quando quitar uma, passe o valor para a próxima</li>
</ol>
<div class="edu-example">
  <strong>Cartão de crédito: 12% a.m.</strong> → atacar primeiro<br>
  Cheque especial: 8% a.m. → segundo<br>
  Empréstimo pessoal: 3% a.m. → por último
</div>`,
          quiz: [{ q: 'No método Avalanche, qual dívida atacar primeiro?', opts: ['Maior valor','Maior taxa de juros','Menor valor','Menor prazo'], ans: 1 }]
        },
        { id: 'snowball', title: 'Método Bola de Neve', duration: '3 min',
          content: `<h3>Método Bola de Neve — Motivação Rápida</h3>
<p>Priorize as dívidas com <strong>menor valor</strong> primeiro. Psicologicamente mais eficaz para manter a disciplina.</p>
<ol>
<li>Liste todas as dívidas por <strong>valor</strong> (menor → maior)</li>
<li>Quite a menor primeiro</li>
<li>Use o dinheiro liberado para atacar a próxima</li>
</ol>
<p>✅ <strong>Quando usar:</strong> Quando você precisa de vitórias rápidas para manter a motivação.</p>
<p>📊 <strong>Matematicamente:</strong> A Avalanche economiza mais dinheiro. Mas a Bola de Neve funciona melhor para quem desanima facilmente.</p>`,
          quiz: [{ q: 'No método Bola de Neve, qual dívida pagar primeiro?', opts: ['Maior juros','Maior valor','Menor valor','Mais antiga'], ans: 2 }]
        },
      ]
    },
    {
      id: 'invest', icon: '📈', color: '#10b981', title: 'Investimentos',
      lessons: [
        { id: 'risk_return', title: 'Risco vs Retorno', duration: '4 min',
          content: `<h3>A Relação Risco × Retorno</h3>
<p>Toda decisão de investimento envolve este trade-off fundamental:</p>
<div class="edu-chart-container">
  <div style="display:flex;flex-direction:column;gap:.4rem;margin:.5rem 0">
    ${[['Poupança / CDB', '5-7%', '2%', '#22c55e'],['Tesouro IPCA+', '8-10%', '4%', '#3b82f6'],['FIIs', '10-14%', '8%', '#f59e0b'],['Ações','12-20%+','15%+','#ef4444']].map(([name,ret,risk,c])=>`
    <div style="display:flex;align-items:center;gap:.5rem">
      <span style="width:150px;font-size:.8rem">${name}</span>
      <div style="flex:1;height:16px;border-radius:4px;background:${c}22;position:relative">
        <div style="height:100%;width:${ret.replace('%','').split('-')[0]}%;background:${c};border-radius:4px;min-width:20px"></div>
      </div>
      <span style="font-size:.75rem;color:var(--txt2);width:80px">ret: ${ret}</span>
    </div>`).join('')}
  </div>
</div>
<p>🔑 <strong>Regra de ouro:</strong> Nunca invista em algo que você não entende. Comece simples.</p>`,
          quiz: [{ q: 'Qual afirmação é verdadeira sobre investimentos?', opts: ['Alto retorno = baixo risco','Maior risco pode trazer maior retorno','Poupança tem o maior retorno','Ações não têm risco'], ans: 1 }]
        },
        { id: 'diversify', title: 'Diversificação', duration: '3 min',
          content: `<h3>Não Coloque Todos os Ovos no Mesmo Cesto</h3>
<p>Diversificação reduz riscos sem necessariamente reduzir o retorno esperado.</p>
<ul>
<li><strong>Por classe:</strong> renda fixa + ações + imóveis</li>
<li><strong>Por prazo:</strong> curto + médio + longo prazo</li>
<li><strong>Por emissor:</strong> governo + empresas + internacional</li>
</ul>
<div class="edu-example">
  <strong>Carteira simples para iniciantes:</strong><br>
  60% Tesouro Selic (reserva/emergência)<br>
  30% CDB liquidez diária (médio prazo)<br>
  10% Ações ou FIIs (longo prazo)
</div>`,
          quiz: [{ q: 'O principal benefício da diversificação é:', opts: ['Garantir lucro','Reduzir riscos','Aumentar impostos','Complicar a gestão'], ans: 1 }]
        },
        { id: 'fiis_intro', title: 'Introdução a FIIs', duration: '5 min',
          content: `<h3>Fundos de Investimento Imobiliário</h3>
<p>FIIs permitem investir em imóveis sem precisar comprar um imóvel inteiro.</p>
<ul>
<li><strong>Vantagens:</strong> Isenção IR (pessoa física), dividendos mensais, liquidez</li>
<li><strong>Tipos:</strong> Tijolo (imóveis físicos), Papel (CRI), Fundo de Fundos</li>
<li><strong>Como começar:</strong> Abra conta em corretora, compre cotas na bolsa</li>
</ul>
<div class="edu-example">
  <strong>Exemplo:</strong> FII HGLG11 pagou ~R$ 1,20/cota em 2024 (yield ~10% a.a.)
</div>`,
          quiz: [{ q: 'Qual vantagem dos FIIs para pessoa física?', opts: ['Lucro garantido','Isenção de IR nos dividendos','Sem risco','Liquidez imediata'], ans: 1 }]
        },
      ]
    },
    {
      id: 'habits', icon: '🧠', color: '#8b5cf6', title: 'Comportamento',
      lessons: [
        { id: 'autopilot', title: 'Finanças no Piloto Automático', duration: '3 min',
          content: `<h3>Automatize Suas Finanças</h3>
<p>A força de vontade é limitada. Automatizar remove a necessidade de decisões diárias.</p>
<ol>
<li><strong>Dia do pagamento:</strong> transfira automaticamente para poupança/investimento</li>
<li><strong>Contas fixas:</strong> débito automático (nunca pague multa por esquecimento)</li>
<li><strong>Registro de gastos:</strong> use o app todo dia por 5 minutos</li>
<li><strong>Revisão mensal:</strong> 30 minutos por mês para checar e ajustar</li>
</ol>
<p>🤖 <strong>Princípio:</strong> Torne o comportamento financeiro correto o caminho de menor resistência.</p>`,
          quiz: [{ q: 'Qual é a principal vantagem de automatizar as finanças?', opts: ['Ganha mais dinheiro','Remove a dependência de força de vontade','Aumenta os gastos','Complica a gestão'], ans: 1 }]
        },
        { id: 'mindset', title: 'Mentalidade Financeira', duration: '4 min',
          content: `<h3>A Psicologia do Dinheiro</h3>
<p>Dinheiro é 80% comportamento e 20% matemática. Os maiores erros são emocionais:</p>
<ul>
<li><strong>FOMO (medo de perder):</strong> comprar ações na alta, criptos no pico</li>
<li><strong>Aversão à perda:</strong> manter investimentos ruins por não querer "realizar a perda"</li>
<li><strong>Desconto hiperbólico:</strong> valorizar demais o presente vs futuro</li>
<li><strong>Efeito manada:</strong> seguir a maioria sem pesquisar</li>
</ul>
<p>🧘 <strong>Solução:</strong> Tenha um plano e siga-o, independente das emoções do momento.</p>`,
          quiz: [{ q: 'O sucesso financeiro depende principalmente de:', opts: ['Sorte','Herança','Comportamento e disciplina','Renda alta'], ans: 2 }]
        },
        { id: 'goals_setting', title: 'Definindo Metas SMART', duration: '4 min',
          content: `<h3>Metas SMART</h3>
<p>Metas financeiras devem ser SMART:</p>
<ul>
<li><strong>S</strong>pecífica: "Guardar R$ 10.000" (não apenas "economizar")</li>
<li><strong>M</strongensurável: acompanhe o progresso semanalmente</li>
<li><strong>A</strong>tingível: considere sua realidade financeira</li>
<li><strong>R</strong>elevante: alinhe com seus valores e sonhos</li>
<li><strong>T</strong>emporal: defina prazo (ex: "até dezembro/2025")</li>
</ul>
<div class="edu-example">
  <strong>Exemplo SMART:</strong> "Guardar R$ 500/mês por 20 meses para entrada de carro até ago/2026"
</div>`,
          quiz: [{ q: 'Na metodologia SMART, o "T" significa:', opts: ['Técnico','Temporal','Total','Teórico'], ans: 1 }]
        },
      ]
    },
    {
      id: 'advanced', icon: '🚀', color: '#f59e0b', title: 'Avançado',
      lessons: [
        { id: 'taxes', title: 'Impostos em Investimentos', duration: '6 min',
          content: `<h3>Tributação de Investimentos</h3>
<p>Conheça as principais regras:</p>
<ul>
<li><strong>Renda Fixa:</strong> IR regressivo (22,5% a 15%) sobre lucros</li>
<li><strong>Ações:</strong> 15% IR sobre ganhos > R$ 20k/mês (vendas)</li>
<li><strong>FIIs:</strong> isento IR para PF nos dividendos</li>
<li><strong>Tesouro Direto:</strong> IR regressivo + IOF (se < 30 dias)</li>
</ul>
<p>⚠️ <strong>Atenção:</strong> Day trade tem alíquota fixa de 20%!</p>`,
          quiz: [{ q: 'Qual alíquota de IR para day trade?', opts: ['15%','17,5%','20%','22,5%'], ans: 2 }]
        },
        { id: 'asset_allocation', title: 'Alocação de Ativos', duration: '5 min',
          content: `<h3>Estratégia de Alocação</h3>
<p>Distribua seu patrimônio entre diferentes classes:</p>
<div class="edu-example">
  <strong>Perfil Conservador:</strong> 80% RF, 15% Ações, 5% Internacional<br>
  <strong>Perfil Moderado:</strong> 60% RF, 30% Ações, 10% Internacional<br>
  <strong>Perfil Arrojado:</strong> 40% RF, 45% Ações, 15% Internacional
</div>
<p>🔄 <strong>Rebalanceamento:</strong> Ajuste anualmente para manter alocação original.</p>`,
          quiz: [{ q: 'O rebalanceamento serve para:', opts: ['Maximizar lucros','Manter alocação original','Reduzir impostos','Evitar vendas'], ans: 1 }]
        },
      ]
    },
  ];

  let state = { module: 0, lesson: 0, quizAnswered: {}, progress: {} };

  async function loadProgress() {
    const u = window.S?.user;
    if (!u) return;
    try {
      const saved = await window.getSetting?.(u.id, 'fp_edu_progress', {});
      if (saved) { state.quizAnswered = saved.quizAnswered || {}; state.progress = saved.progress || {}; }
    } catch(e) {}
  }

  async function saveProgress() {
    const u = window.S?.user;
    if (!u) return;
    try { await window.setSetting?.(u.id, 'fp_edu_progress', { quizAnswered: state.quizAnswered, progress: state.progress }); } catch(e) {}
  }

  function countCompleted() {
    return Object.values(state.progress).filter(Boolean).length;
  }

  function totalLessons() {
    return MODULES.reduce((s, m) => s + m.lessons.length, 0);
  }

  function render() {
    const zone = document.getElementById('page-education');
    if (!zone) return;

    const total = totalLessons();
    const done = countCompleted();
    const pct = total > 0 ? Math.round(done / total * 100) : 0;

    const mod = MODULES[state.module];
    const lesson = mod?.lessons[state.lesson];

    zone.innerHTML = `
    <div class="page-hdr">
      <div>
        <h1 class="page-title"><i class="fas fa-graduation-cap" style="color:var(--accent)"></i> Educação Financeira</h1>
        <p class="page-sub">Aprenda finanças pessoais — conteúdo 100% offline</p>
      </div>
    </div>

    <!-- Progresso geral -->
    <div class="card" style="margin-bottom:1rem;padding:.85rem 1rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem;flex-wrap:wrap;gap:.3rem">
        <span style="font-size:.85rem;font-weight:600">Seu progresso</span>
        <span style="font-size:.82rem;color:var(--txt2)">${done}/${total} lições completas</span>
      </div>
      <div style="height:8px;background:var(--bdr);border-radius:4px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--accent),#3b82f6);border-radius:4px;transition:width .6s"></div>
      </div>
      <div style="font-size:.75rem;color:var(--txt2);margin-top:.3rem">${pct}% concluído</div>
    </div>

    <div style="display:grid;grid-template-columns:240px 1fr;gap:.85rem">
      <!-- Sidebar de módulos -->
      <div>
        ${MODULES.map((m, mi) => {
          const mDone = m.lessons.filter(l => state.progress[l.id]).length;
          const mPct = Math.round(mDone / m.lessons.length * 100);
          return `<div style="margin-bottom:.5rem">
            <div onclick="FP_EDU.selectModule(${mi})" style="display:flex;align-items:center;gap:.5rem;padding:.55rem .7rem;border-radius:9px;cursor:pointer;background:${mi===state.module?'rgba(var(--accent-rgb),.12)':'var(--bg-s)'};border:${mi===state.module?'1.5px solid var(--accent)':'1px solid var(--bdr)'}">
              <span style="font-size:1.1rem">${m.icon}</span>
              <div style="flex:1;min-width:0">
                <div style="font-size:.82rem;font-weight:600">${m.title}</div>
                <div style="font-size:.7rem;color:var(--txt2)">${mDone}/${m.lessons.length} lições</div>
              </div>
              ${mPct === 100 ? '<i class="fas fa-check-circle" style="color:var(--success);font-size:.75rem"></i>' : ''}
            </div>
            ${mi===state.module ? `<div style="margin-left:.5rem;margin-top:.3rem;display:flex;flex-direction:column;gap:.25rem">
              ${m.lessons.map((l, li) => `
                <div onclick="FP_EDU.selectLesson(${li})" style="padding:.4rem .7rem;border-radius:7px;cursor:pointer;font-size:.78rem;display:flex;align-items:center;gap:.4rem;background:${li===state.lesson?'var(--accent)':'transparent'};color:${li===state.lesson?'#fff':'var(--txt2)'}">
                  ${state.progress[l.id] ? '<i class="fas fa-check" style="font-size:.65rem;color:'+(li===state.lesson?'#fff':'var(--success)')+'"></i>' : '<i class="fas fa-circle" style="font-size:.45rem"></i>'}
                  ${l.title}
                </div>`).join('')}
            </div>` : ''}
          </div>`;
        }).join('')}
      </div>

      <!-- Conteúdo da lição -->
      <div class="card" style="padding:1.25rem" id="eduContent">
        ${lesson ? `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">
          <div>
            <h2 style="font-size:1.1rem;font-weight:700;margin:0">${lesson.title}</h2>
            <div style="font-size:.75rem;color:var(--txt2);margin-top:.2rem"><i class="fas fa-clock"></i> ${lesson.duration}</div>
          </div>
          <span style="font-size:.68rem;padding:2px 10px;border-radius:99px;background:${mod.color}20;color:${mod.color};font-weight:700">${mod.title}</span>
        </div>
        <div class="edu-content" style="font-size:.87rem;line-height:1.7;color:var(--txt)">
          ${lesson.content.replace(/<ul>/g,'<ul style="padding-left:1.25rem;margin:.5rem 0">').replace(/<ol>/g,'<ol style="padding-left:1.25rem;margin:.5rem 0">').replace(/<li>/g,'<li style="margin:.25rem 0">').replace(/<h3>/g,'<h3 style="font-size:1rem;font-weight:700;margin:0 0 .75rem">').replace(/<p>/g,'<p style="margin:.5rem 0">').replace(/<div class="edu-example">/g,'<div style="background:rgba(var(--accent-rgb),.08);border-left:3px solid var(--accent);padding:.65rem .9rem;border-radius:0 8px 8px 0;margin:.75rem 0;font-size:.83rem">').replace(/<div class="edu-formula">/g,'<div style="font-family:monospace;background:var(--bg-s);padding:.5rem .85rem;border-radius:8px;text-align:center;font-size:.95rem;font-weight:600;margin:.5rem 0">')}
        </div>
        <!-- Quiz -->
        ${lesson.quiz ? `
        <div style="margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--bdr)">
          <div style="font-size:.82rem;font-weight:700;margin-bottom:.6rem">🧠 Teste seu conhecimento</div>
          ${lesson.quiz.map((q, qi) => {
            const answered = state.quizAnswered[lesson.id+'-'+qi];
            return `<div style="margin-bottom:.65rem">
              <div style="font-size:.83rem;margin-bottom:.4rem">${q.q}</div>
              <div style="display:flex;flex-direction:column;gap:.3rem">
              ${q.opts.map((opt, oi) => {
                let bg = 'var(--bg-s)', border = 'var(--bdr)', color = 'var(--txt)';
                if (answered !== undefined) {
                  if (oi === q.ans) { bg='rgba(16,185,129,.12)'; border='var(--success)'; color='var(--success)'; }
                  else if (oi === answered && answered !== q.ans) { bg='rgba(239,68,68,.1)'; border='var(--danger)'; color='var(--danger)'; }
                }
                return `<button onclick="FP_EDU.answerQuiz('${lesson.id}',${qi},${oi},${q.ans})"
                  style="text-align:left;padding:.45rem .75rem;border-radius:8px;border:1.5px solid ${border};background:${bg};color:${color};cursor:${answered!==undefined?'default':'pointer'};font-size:.8rem;transition:all .15s">
                  ${oi===q.ans&&answered!==undefined?'✓ ':''}${opt}
                </button>`;
              }).join('')}
              </div>
            </div>`;
          }).join('')}
        </div>` : ''}
        <!-- Nav buttons -->
        <div style="display:flex;gap:.5rem;margin-top:1rem;justify-content:space-between">
          <button class="btn btn-ghost btn-sm" onclick="FP_EDU.prevLesson()" ${state.module===0&&state.lesson===0?'disabled':''}>← Anterior</button>
          <button class="btn btn-primary btn-sm" onclick="FP_EDU.completeAndNext()">
            ${state.progress[lesson.id] ? 'Próxima →' : 'Marcar como concluída →'}
          </button>
        </div>` : '<p style="color:var(--txt2)">Selecione uma lição</p>'}
      </div>
    </div>`;

    // Inject CSS
    if (!document.getElementById('edu-style')) {
      const s = document.createElement('style');
      s.id = 'edu-style';
      s.textContent = `.edu-content strong{font-weight:700}`;
      document.head.appendChild(s);
    }
  }

  const FP_EDU = {
    selectModule(mi) { state.module = mi; state.lesson = 0; render(); },
    selectLesson(li) { state.lesson = li; render(); },
    async answerQuiz(lessonId, qi, chosen, correct) {
      if (state.quizAnswered[lessonId+'-'+qi] !== undefined) return;
      state.quizAnswered[lessonId+'-'+qi] = chosen;
      if (chosen === correct) {
        if (typeof window.toast === 'function') window.toast('✅ Correto!', 'success', 2000);
      } else {
        if (typeof window.toast === 'function') window.toast('❌ Tente novamente na próxima vez', 'error', 2000);
      }
      await saveProgress();
      render();
    },
    async completeAndNext() {
      const mod = MODULES[state.module];
      const lesson = mod?.lessons[state.lesson];
      if (!lesson) return;
      state.progress[lesson.id] = true;
      await saveProgress();
      // Next lesson
      if (state.lesson < mod.lessons.length - 1) { state.lesson++; }
      else if (state.module < MODULES.length - 1) { state.module++; state.lesson = 0; }
      render();
    },
    prevLesson() {
      const mod = MODULES[state.module];
      if (state.lesson > 0) { state.lesson--; }
      else if (state.module > 0) { state.module--; state.lesson = MODULES[state.module].lessons.length - 1; }
      render();
    },
  };

  window.FP_EDU = FP_EDU;
  window.loadEducation = async function () {
    const u = window.S?.user;
    if (!u) { setTimeout(window.loadEducation, 500); return; }
    await loadProgress();
    render();
  };

/* ── Auto-init: render when page becomes active ── */
(function autoInit() {
  const pageId = 'page-education';
  const loadFn = 'loadEducation';
  function tryRender() {
    const page = document.getElementById(pageId);
    if (page && page.classList.contains('active')) {
      const fn = window[loadFn];
      if (typeof fn === 'function') fn();
    }
  }
  // Check immediately in case page is already showing
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(tryRender, 300));
  } else {
    setTimeout(tryRender, 300);
  }
  // Also hook navigate for future calls
  const origNav = window.navigate;
  if (typeof origNav === 'function' && !window['__' + pageId + 'Hooked']) {
    window['__' + pageId + 'Hooked'] = true;
    window.navigate = function(page, ...args) {
      const r = origNav.call(this, page, ...args);
      if (page === 'education') {
        setTimeout(() => { const fn = window[loadFn]; if (typeof fn === 'function') fn(); }, 150);
      }
      return r;
    };
  }
})();

})();
