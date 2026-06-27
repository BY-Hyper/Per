// fp-tts-worker.js — TTS Worker (module)
// Usage: new Worker('fp-tts-worker.js', { type: 'module' })

let KokoroTTS = null;
let TextSplitterStream = null;
let tts = null;
let currentVoice = 'af_sky';
let MODEL_ID = 'onnx-community/Kokoro-82M-ONNX';
const MODEL_ID_FALLBACKS = ['onnx-community/Kokoro-82M-ONNX', 'onnx-community/Kokoro-82M-v1.0-ONNX'];
const SUPPORTED_DTYPES = ['q8f16', 'q4f16', 'q8', 'q4', 'fp16', 'fp32'];

async function ensureKokoro() {
  if (KokoroTTS && TextSplitterStream) return;
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/kokoro-js@latest/dist/index.js');
    KokoroTTS = mod.KokoroTTS;
    TextSplitterStream = mod.TextSplitterStream;
  } catch (err) {
    console.warn('Falha ao carregar Kokoro via CDN, tentando fallback local...', err);
    try {
      const mod = await import('./kokoro-js.js');
      KokoroTTS = mod.KokoroTTS;
      TextSplitterStream = mod.TextSplitterStream;
    } catch (err2) {
      console.error('Fallback local Kokoro falhou', err2);
      throw new Error('Não foi possível carregar a biblioteca Kokoro TTS.');
    }
  }
}

async function tryLoadModel() {
  let lastError = null;
  const modelCandidates = Array.from(new Set([MODEL_ID, ...MODEL_ID_FALLBACKS]));

  await ensureKokoro();

  for (const modelId of modelCandidates) {
    for (const dtype of SUPPORTED_DTYPES) {
      try {
        self.postMessage({ type: 'progress', message: `Tentando ${modelId} (${dtype})...` });
        const instance = await KokoroTTS.from_pretrained(modelId, { dtype, device: 'wasm' });
        self.postMessage({ type: 'progress', message: `Modelo carregado: ${modelId} / ${dtype}` });
        return { instance, dtype, modelId };
      } catch (err) {
        lastError = err;
        console.warn('Kokoro load failed for', modelId, dtype, err?.message || err);
      }
    }
  }

  throw lastError || new Error('Falha ao carregar modelo Kokoro');
}

async function getInstance() {
  if (tts) return tts;
  try {
    self.postMessage({ type: 'progress', message: 'Carregando modelo TTS...' });
    const loaded = await tryLoadModel();
    tts = loaded.instance;
    const voices = tts.list_voices ? tts.list_voices() : [];
    self.postMessage({ type: 'ready', voices, dtype: loaded.dtype, modelId: loaded.modelId });
    return tts;
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
    throw err;
  }
}

async function postAudioBlob(blob) {
  try {
    const buf = await blob.arrayBuffer();
    self.postMessage({ type: 'audio', buffer: buf, mime: blob.type || 'audio/wav' }, [buf]);
  } catch (err) {
    self.postMessage({ type: 'error', message: 'Erro ao ler áudio: ' + err.message });
  }
}

self.onmessage = async (e) => {
  const { cmd, text, voice } = e.data || {};
  if (voice) currentVoice = voice;
  try {
    if (cmd === 'speak') {
      const inst = await getInstance();
      const audio = await inst.generate(String(text || ''), { voice: currentVoice });
      const blob = await audio.toBlob();
      await postAudioBlob(blob);
    }
    else if (cmd === 'speakStream') {
      const inst = await getInstance();
      const splitter = new TextSplitterStream();
      const stream = inst.stream(splitter);
      (async () => {
        try {
          for await (const chunk of stream) {
            try {
              const b = await chunk.audio.toBlob();
              await postAudioBlob(b);
            } catch (errChunk) {
              self.postMessage({ type: 'error', message: 'chunk error: ' + errChunk.message });
            }
          }
        } catch (errStream) {
          self.postMessage({ type: 'error', message: 'stream error: ' + errStream.message });
        }
      })();
      // feed text into splitter in small tokens
      const tokens = String(text || '').match(/\s*\S+/g) || [String(text || '')];
      for (const t of tokens) {
        splitter.push(t);
        await new Promise(r => setTimeout(r, 20));
      }
      splitter.close();
    }
    else if (cmd === 'preloadModel') {
      if (e.data.modelId) {
        MODEL_ID = e.data.modelId;
        MODEL_ID_FALLBACKS.unshift(e.data.modelId);
      }
      await getInstance();
      self.postMessage({ type: 'preloaded' });
    }
    else if (cmd === 'getVoices') {
      const inst = await getInstance();
      const voices = inst.list_voices ? inst.list_voices() : [];
      self.postMessage({ type: 'voices', voices });
    }
    else if (cmd === 'setVoice') {
      // voice updated above
      self.postMessage({ type: 'voiceSet', voice: currentVoice });
    }
    else if (cmd === 'clearCache') {
      tts = null;
      self.postMessage({ type: 'cacheCleared' });
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};
