/* ====================================================================
   FINANCEPRO — EDUCAÇÃO FINANCEIRA
   Módulos interativos 100% offline, quiz adaptativo ao perfil.
   Expõe: window.loadEducation
==================================================================== */
(function () {
  'use strict';

  const MODULES = [
    {
      id: 'basics', icon: '💡', color: '#3b82f6', title: 'Fundamentos',
      lessons: [
        { id: 'budget_rule', title: 'Regra 50/30/20', duration: '3 min',
          content: `<h3>A Regra 50/30/20</h3>
<p>Divida sua renda líquida em 3 partes:</p>
<ul>
<li><strong>50% — Necessidades:</strong> aluguel, alimentação, transporte, contas</li>
<li><strong>30% — Desejos:</strong> lazer, restaurantes, assinaturas, compras</li>
<li><strong>20% — Poupança:</strong> reserva de emergência, investimentos, metas</li>
</ul>
<p>💡 <strong>Dica prática:</strong> Comece automatizando a poupança. Transfira os 20% no dia do recebimento antes de gastar qualquer coisa.</p>
<div class="edu-example">
  <strong>Exemplo com renda de R$ 5.000:</strong><br>
  Necessidades: R$ 2.500 · Desejos: R$ 1.500 · Poupança: R$ 1.000
</div>`,
          quiz: [{ q: 'Qual percentual deve ir para poupança na regra 50/30/20?', opts: ['10%','20%','30%','50%'], ans: 1 }]
        },
        { id: 'emergency', title: 'Reserva de Emergência', duration: '4 min',
          content: `<h3>Reserva de Emergência</h3>
<p>É a base de qualquer planejamento financeiro sólido. Protege você de imprevistos sem precisar se endividar.</p>
<ul>
<li><strong>Quanto guardar:</strong> 3 a 6 meses de despesas mensais</li>
<li><strong>Onde guardar:</strong> CDB com liquidez diária, Tesouro Selic, ou poupança</li>
<li><strong>Não investir em:</strong> ações, fundos de risco, imóveis (ilíquidos)</li>
</ul>
<p>🎯 <strong>Meta:</strong> Primeiro, construa sua reserva antes de pensar em outros investimentos.</p>
<div class="edu-example">
  <strong>Cálculo rápido:</strong> Se você gasta R$ 3.000/mês, precisa de R$ 9.000–18.000 de reserva.
</div>`,
          quiz: [{ q: 'Quantos meses de despesas deve ter uma reserva de emergência?', opts: ['1–2 meses','3–6 meses','6–12 meses','12+ meses'], ans: 1 }]
        },
        { id: 'compound', title: 'Juros Compostos', duration: '5 min',
          content: `<h3>O Poder dos Juros Compostos</h3>
<p>Einstein chamou de "8ª maravilha do mundo". É o juros sobre juros — e funciona para você (investimentos) ou contra você (dívidas).</p>
<div class="edu-formula">Montante = Capital × (1 + taxa)^tempo</div>
<p><strong>Exemplo investindo R$ 500/mês por 10 anos a 10% a.a.:</strong></p>
<div class="edu-example">
  Total investido: R$ 60.000<br>
  Montante final: <strong>~R$ 102.000</strong><br>
  Ganho dos juros: R$ 42.000 (70% a mais!)
</div>
<p>📈 Quanto mais cedo começar, mais poderoso o efeito.</p>`,
          quiz: [{ q: 'Juros compostos são calculados sobre:', opts: ['Apenas o capital inicial','Capital + juros acumulados','Apenas os juros','Nenhuma das anteriores'], ans: 1 }]
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