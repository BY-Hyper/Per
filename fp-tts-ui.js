// fp-tts-ui.js — Connects TTS wrapper to a small dashboard widget
const MODEL_ID = 'onnx-community/Kokoro-82M-ONNX';

function $(id){return document.getElementById(id);}

document.addEventListener('DOMContentLoaded', () => {
  const useK = localStorage.getItem('tts.useKokoro') === '1';
  const isHidden = localStorage.getItem('tts.widgetHidden') === '1';
  const chk = $('ttsUseKokoro');
  const preloadBtn = $('ttsPreloadBtn');
  const testBtn = $('ttsTestBtn');
  const clearBtn = $('ttsClearBtn');
  const closeBtn = $('ttsCloseBtn');
  const progress = $('ttsProgress');
  const status = $('ttsStatus');
  const widget = $('ttsWidget');

  if (widget && isHidden) widget.style.display = 'none';
  chk.checked = useK;

  const setStatus = (t) => { status.textContent = t; };
  const setLoading = (isLoading) => {
    preloadBtn.disabled = isLoading;
    testBtn.disabled = isLoading;
    if (clearBtn) clearBtn.disabled = isLoading;
  };
  const refreshStatus = () => {
    const info = TTS.getModelInfo ? TTS.getModelInfo() : null;
    if (useK && info?.dtype) {
      setStatus(`Kokoro selecionado (${info.dtype})`);
      return;
    }
    setStatus(useK ? 'Kokoro selecionado' : 'Usando voz nativa');
  };

  TTS.onProgress(p => {
    if (typeof p === 'number') {
      const pct = Math.round(p * 100);
      progress.style.width = pct + '%';
      setStatus('Progresso: ' + pct + '%');
    } else {
      setStatus(String(p).slice(0,80));
    }
  });

  TTS.onReady((info) => {
    if (info?.dtype) {
      setStatus(`TTS pronto (${info.dtype})`);
    } else {
      setStatus('TTS pronto');
    }
  });

  TTS.init({ useNative: !useK }).then(() => refreshStatus()).catch((err) => {
    console.error('TTS init failed', err);
    setStatus('Erro ao inicializar TTS');
  });

  chk.addEventListener('change', async (e) => {
    const val = e.target.checked;
    localStorage.setItem('tts.useKokoro', val ? '1' : '0');
    setStatus(val ? 'Kokoro selecionado (aguarde pré-carregamento)' : 'Usando voz nativa');
    await TTS.init({ useNative: !val });
    refreshStatus();
  });

  preloadBtn.addEventListener('click', async () => {
    setLoading(true);
    setStatus('Carregando Kokoro...');
    progress.style.width = '0%';
    try {
      await TTS.preloadKokoroModel(MODEL_ID, p => {
        const pct = Math.round(p * 100);
        progress.style.width = pct + '%';
        setStatus('Download: ' + pct + '%');
      });
      const info = TTS.getModelInfo ? TTS.getModelInfo() : null;
      setStatus(`Kokoro carregado com sucesso${info?.dtype ? ` (${info.dtype})` : ''}`);
      await TTS.init({ useNative: false });
    } catch (err) {
      console.error(err);
      setStatus('Falha no preload: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      setLoading(true);
      setStatus('Limpando cache...');
      try {
        const removed = await TTS.clearModelCache();
        setStatus(removed ? 'Cache limpo' : 'Nenhum cache encontrado');
        progress.style.width = '0%';
      } catch (err) {
        console.error(err);
        setStatus('Erro ao limpar cache: ' + (err.message || err));
      } finally {
        setLoading(false);
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (widget) {
        widget.style.display = 'none';
        localStorage.setItem('tts.widgetHidden', '1');
      }
    });
  }

  testBtn.addEventListener('click', async () => {
    setStatus('Preparando para falar...');
    try {
      await TTS.init({ useNative: !chk.checked });
      if (chk.checked) {
        setStatus('Usando Kokoro — testando (pode demorar no primeiro uso)');
      }
      await TTS.speak('Olá! Este é um teste de voz do Finance Pro.');
      setStatus('Falado.');
    } catch (err) {
      console.error(err);
      setStatus('Erro ao falar: ' + (err.message||err));
    }
  });
});
