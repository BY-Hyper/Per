// fp-tts.js — TTS public wrapper for FinancePro
// Provides: TTS.init(opts), TTS.speak(text, voice?), TTS.stop(), TTS.setVoice(v), TTS.getVoices(), TTS.onReady(cb), TTS.onProgress(cb)

const TTS = {
  _worker: null,
  _ready: false,
  _voices: [],
  _currentVoice: 'af_sky',
  _nativeVoice: null,
  _modelInfo: null,
  _onReady: null,
  _onProgress: null,
  _audioQueue: [],
  _isPlayingAudio: false,
  _pendingSpeaks: [],
  _lastSpeakPayload: null,
  _useNative: false,
  _readyPromise: null,
  _resolveReady: null,
  _rejectReady: null,

  async init(options = {}) {
    this._useNative = !!options.useNative;
    if (this._useNative) {
      this._ready = true;
      this._selectNativeVoice();
      if (this._onReady) this._onReady();
      return Promise.resolve();
    }

    if (!window.Worker) {
      console.warn('Web Workers not supported — using native speech');
      this._useNative = true;
      this._ready = true;
      this._selectNativeVoice();
      if (this._onReady) this._onReady();
      return Promise.resolve();
    }

    if (this._ready && this._worker) {
      return Promise.resolve();
    }

    if (!this._readyPromise) {
      this._readyPromise = new Promise((resolve, reject) => {
        this._resolveReady = resolve;
        this._rejectReady = reject;
      });
    }

    try {
      if (!this._worker) {
        this._worker = new Worker('fp-tts-worker.js', { type: 'module' });
        this._worker.onmessage = (e) => this._handleWorkerMsg(e.data);
      }
      this._worker.postMessage({ cmd: 'getVoices' });
      return this._readyPromise;
    } catch (err) {
      console.error('Failed to start TTS worker, fallback to native', err);
      this._useNative = true;
      this._ready = true;
      this._selectNativeVoice();
      if (this._onReady) this._onReady();
      if (this._resolveReady) this._resolveReady();
      return Promise.resolve();
    }
  },

  _handleWorkerMsg(msg) {
    if (!msg) return;
    const { type } = msg;

    if (type === 'progress' && this._onProgress) {
      this._onProgress(msg.message);
      return;
    }

    if (type === 'ready') {
      this._ready = true;
      this._voices = msg.voices || [];
      this._modelInfo = { dtype: msg.dtype, modelId: msg.modelId };
      if (this._onReady) this._onReady(this._modelInfo);
      if (this._resolveReady) {
        this._resolveReady();
        this._resolveReady = null;
        this._rejectReady = null;
        this._readyPromise = null;
      }
      if (this._pendingSpeaks.length && this._worker) {
        for (const payload of this._pendingSpeaks) {
          this._worker.postMessage(payload);
        }
        this._pendingSpeaks = [];
      }
      return;
    }

    if (type === 'preloaded') {
      if (this._resolveReady) {
        this._resolveReady();
        this._resolveReady = null;
        this._rejectReady = null;
        this._readyPromise = null;
      }
      if (this._pendingSpeaks.length && this._worker) {
        for (const payload of this._pendingSpeaks) {
          this._worker.postMessage(payload);
        }
        this._pendingSpeaks = [];
      }
      return;
    }

    if (type === 'voices') {
      this._voices = msg.voices || [];
      return;
    }

    if (type === 'audio') {
      try {
        const ab = msg.buffer;
        const mime = msg.mime || 'audio/wav';
        const blob = new Blob([ab], { type: mime });
        this._playBlob(blob);
      } catch (err) {
        console.error('Error playing audio from worker', err);
      }
      return;
    }

    if (type === 'error') {
      console.error('TTS worker error:', msg.message);
      this._useNative = true;
      this._ready = true;
      if (this._worker) {
        try { this._worker.terminate(); } catch {};
        this._worker = null;
      }
      if (this._onReady) this._onReady();
      if (this._rejectReady) {
        this._rejectReady(new Error(msg.message || 'TTS worker error'));
        this._resolveReady = null;
        this._rejectReady = null;
        this._readyPromise = null;
      }
      if (this._lastSpeakPayload?.text) {
        this._speakNative(this._lastSpeakPayload.text);
        this._lastSpeakPayload = null;
      }
      if (this._pendingSpeaks.length) {
        for (const payload of this._pendingSpeaks) {
          if (payload.text) this._speakNative(payload.text);
        }
        this._pendingSpeaks = [];
      }
    }
  },

  _playBlob(blob) {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.onended = () => {
      URL.revokeObjectURL(url);
      this._isPlayingAudio = false;
      this._audioQueue.shift();
      if (this._audioQueue.length) this._playNextAudio();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      this._isPlayingAudio = false;
      this._audioQueue.shift();
      if (this._audioQueue.length) this._playNextAudio();
    };
    this._audioQueue.push(audio);
    if (!this._isPlayingAudio) this._playNextAudio();
  },

  _playNextAudio() {
    const next = this._audioQueue[0];
    if (!next) return;
    this._isPlayingAudio = true;
    next.play().catch((err) => {
      console.warn('TTS audio playback failed', err);
      this._isPlayingAudio = false;
      this._audioQueue.shift();
      if (this._audioQueue.length) this._playNextAudio();
    });
  },

  async speak(text, voice) {
    if (!text) return;
    if (voice) this._currentVoice = voice;
    if (this._useNative) return this._speakNative(text);
    if (!this._worker) {
      await this.init({ useNative: this._useNative });
      if (!this._worker) return this._speakNative(text);
    }

    const payload = { cmd: 'speak', text, voice: this._currentVoice };
    this._lastSpeakPayload = payload;
    if (voice) this._currentVoice = voice;
    if (this._useNative) return this._speakNative(text);
    if (!this._worker) {
      await this.init({ useNative: this._useNative });
      if (!this._worker) return this._speakNative(text);
    }
    this._worker.postMessage({ cmd: 'speakStream', text, voice: this._currentVoice });
  },

  async announce(text, opts = {}) {
    if (!text) return;
    const useNative = opts.useNative ?? this._useNative;
    await this.init({ useNative });
    return this.speak(text, opts.voice);
  },

  stop() {
    this._audioQueue.forEach((audio) => { try { audio.pause(); } catch {} });
    this._audioQueue = [];
    this._isPlayingAudio = false;
    try { speechSynthesis.cancel(); } catch {}
  },

  setVoice(v) {
    this._currentVoice = v;
    if (this._worker) this._worker.postMessage({ cmd: 'setVoice', voice: v });
  },

  getVoices() {
    return this._voices.slice();
  },

  getModelInfo() {
    return this._modelInfo;
  },

  async preloadKokoroModel(modelId, onProgress) {
    if (onProgress) this.onProgress(onProgress);
    await this.init({ useNative: false });
    if (!this._worker) return;

    if (!this._readyPromise) {
      this._readyPromise = new Promise((resolve, reject) => {
        this._resolveReady = resolve;
        this._rejectReady = reject;
      });
    }
    this._worker.postMessage({ cmd: 'preloadModel', voice: this._currentVoice, modelId });
    return this._readyPromise;
  },

  async clearModelCache(modelUrl) {
    if (!('caches' in window)) {
      throw new Error('Cache API não suportada');
    }

    // Terminate current worker so model state is reset.
    if (this._worker) {
      try {
        this._worker.postMessage({ cmd: 'clearCache' });
      } catch (err) {
        console.warn('Falha ao informar worker para limpar cache', err);
      }
      try {
        this._worker.terminate();
      } catch (err) {
        console.warn('Falha ao encerrar worker:', err);
      }
      this._worker = null;
    }

    this._ready = false;
    this._voices = [];
    this._resolveReady = null;
    this._rejectReady = null;
    this._readyPromise = null;

    const keys = await caches.keys();
    const candidateKeys = keys.filter((key) =>
      key.includes('kokoro') || key.includes('onnx') || key.includes('model') || key.includes('tts')
    );

    if (modelUrl) {
      const deleteFromCaches = await Promise.all(
        candidateKeys.map(async (key) => {
          try {
            const cache = await caches.open(key);
            return cache.delete(modelUrl);
          } catch (err) {
            return false;
          }
        })
      );
      if (deleteFromCaches.some(Boolean)) {
        return true;
      }
    }

    const results = await Promise.all(candidateKeys.map((key) => caches.delete(key)));
    return results.some(Boolean);
  },

  _selectNativeVoice() {
    const voices = speechSynthesis.getVoices() || [];
    this._voices = voices.map((v) => ({ name: v.name, lang: v.lang }));
    const v = voices.find((vv) => vv.lang && vv.lang.startsWith('pt')) || voices[0];
    this._nativeVoice = v || null;
  },

  _speakNative(text, opts = {}) {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      if (this._nativeVoice) utterance.voice = this._nativeVoice;
      utterance.rate = opts.rate || 1;
      speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Native TTS failed', err);
    }
  },

  onReady(cb) {
    this._onReady = cb;
  },

  onProgress(cb) {
    this._onProgress = cb;
  },

  float32ToWav(samples, sampleRate = 24000) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    function writeString(offset, str) {
      for (let i = 0; i < str.length; i += 1) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    }
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i += 1, offset += 2) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  },

  playFloat32(float32, sampleRate = 24000) {
    const wav = this.float32ToWav(float32, sampleRate);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play().catch(console.warn);
    this._audioQueue.push(audio);
  }
};

window.TTS = TTS;
export default TTS;

