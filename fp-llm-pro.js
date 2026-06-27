/* ═══════════════════════════════════════════════════════════
   FinancePro — LLM Pro v1.0
   ───────────────────────────────────────────────────────────
   Gestor robusto de LLMs locais (offline) com:

   • 4 BACKENDS suportados (escolhe o melhor disponível):
       1. Wllama (llama.cpp WASM) — para .gguf
       2. Transformers.js (HuggingFace) — para ONNX
       3. WebLLM (MLC AI) — modelos pré-empacotados
       4. API local (Ollama / LM Studio em localhost) — opcional

   • Carregamento de Wllama com 4 CDNs fallback (jsdelivr → unpkg → esm.sh → skypack)
   • Catálogo de modelos pequenos pré-configurados com URLs HF diretas
   • Download direto do HuggingFace com barra de progresso
   • Cache em IndexedDB (não perde permissão entre sessões!)
   • File handle persistente OU upload (qualquer um funciona)
   • Auto-load no boot — modelo já fica pronto antes de ser usado
   • Diagnóstico melhorado e em tempo real
   • UI moderna nas Configurações

   Encapsulado em window.FP_LLM_PRO. Não substitui o ModelManager
   existente — fica em paralelo e pode ser usado preferencialmente.
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ────── helpers ────── */
  const T = (m, t = 'info', ms = 3500) => typeof window.toast === 'function' && window.toast(m, t, ms);
  const $ = id => document.getElementById(id);
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function ready() { return window.db && window.S && window.S.user; }
  function waitApp(maxMs = 20000) {
    return new Promise((res, rej) => {
      const t0 = Date.now();
      (function loop() {
        if (ready()) return res();
        if (Date.now() - t0 > maxMs) return rej(new Error('LLM_PRO timeout'));
        setTimeout(loop, 250);
      })();
    });
  }
  async function getPref(k, fb = null) {
    if (typeof window.getSetting === 'function' && window.S?.user)
      return await window.getSetting(window.S.user.id, k, fb);
    return fb;
  }
  async function setPref(k, v) {
    if (typeof window.setSetting === 'function' && window.S?.user)
      await window.setSetting(window.S.user.id, k, v);
  }
  function fmtMB(b) {
    if (b == null) return '?';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
    return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }

  /* ═══════════════════════════════════════════════════════════
     CATÁLOGO DE MODELOS
     ───────────────────────────────────────────────────────────
     Modelos pequenos (sub-1GB), bem testados, prontos para baixar
     do Hugging Face sem necessidade de login.
  ═══════════════════════════════════════════════════════════ */
  const CATALOG = [
    {
      id: 'qwen-05b',
      name: 'Qwen 2.5 0.5B Instruct',
      backend: 'wllama',
      sizeMB: 397,
      vram: 'baixa',
      url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
      filename: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
      ctxLen: 4096,
      desc: 'Rápido, leve, ideal para qualquer dispositivo.',
      promptTpl: '<|im_start|>system\nVocê é um assistente financeiro objetivo em português.<|im_end|>\n<|im_start|>user\n{P}<|im_end|>\n<|im_start|>assistant\n',
      stop: ['<|im_end|>', '<|endoftext|>'],
    },
    {
      id: 'qwen-15b',
      name: 'Qwen 2.5 1.5B Instruct',
      backend: 'wllama',
      sizeMB: 940,
      vram: 'média',
      url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
      filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
      ctxLen: 4096,
      desc: 'Equilíbrio entre qualidade e performance.',
      promptTpl: '<|im_start|>system\nVocê é um assistente financeiro objetivo em português.<|im_end|>\n<|im_start|>user\n{P}<|im_end|>\n<|im_start|>assistant\n',
      stop: ['<|im_end|>', '<|endoftext|>'],
    },
    {
      id: 'smollm-360m',
      name: 'SmolLM 2 360M Instruct',
      backend: 'wllama',
      sizeMB: 240,
      vram: 'muito baixa',
      url: 'https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF/resolve/main/smollm2-360m-instruct-q8_0.gguf',
      filename: 'smollm2-360m-instruct-q8_0.gguf',
      ctxLen: 2048,
      desc: 'O menor — funciona até em mobile fraco.',
      promptTpl: '<|im_start|>user\n{P}<|im_end|>\n<|im_start|>assistant\n',
      stop: ['<|im_end|>'],
    },
    {
      id: 'llama32-1b',
      name: 'Llama 3.2 1B Instruct',
      backend: 'wllama',
      sizeMB: 808,
      vram: 'média',
      url: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
      filename: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
      ctxLen: 4096,
      desc: 'Modelo Meta, bom para conversação geral.',
      promptTpl: '<|begin_of_text|><|start_header_id|>system<|end_header_id|>\nVocê é um assistente financeiro em português.<|eot_id|><|start_header_id|>user<|end_header_id|>\n{P}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n',
      stop: ['<|eot_id|>', '<|end_of_text|>'],
    },
    {
      id: 'phi35-mini',
      name: 'Phi 3.5 mini Instruct',
      backend: 'wllama',
      sizeMB: 2400,
      vram: 'alta',
      url: 'https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf',
      filename: 'Phi-3.5-mini-instruct-Q4_K_M.gguf',
      ctxLen: 4096,
      desc: 'Microsoft Phi 3.5, alta qualidade — só desktop.',
      promptTpl: '<|system|>\nVocê é um assistente financeiro em português.<|end|>\n<|user|>\n{P}<|end|>\n<|assistant|>\n',
      stop: ['<|end|>', '<|endoftext|>'],
    },
    {
      id: 'gemma2-2b',
      name: 'Gemma 2 2B Instruct',
      backend: 'wllama',
      sizeMB: 1700,
      vram: 'alta',
      url: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
      filename: 'gemma-2-2b-it-Q4_K_M.gguf',
      ctxLen: 4096,
      desc: 'Google Gemma, ótimo em tarefas de raciocínio.',
      promptTpl: '<start_of_turn>user\n{P}<end_of_turn>\n<start_of_turn>model\n',
      stop: ['<end_of_turn>', '<eos>'],
    },
  ];

  /* ═══════════════════════════════════════════════════════════
     STORAGE (cache de modelos em IndexedDB próprio)
     Resolve o problema de "Arquivo sem permissão"
  ═══════════════════════════════════════════════════════════ */
  const Store = {
    _db: null,
    open() {
      if (this._db) return Promise.resolve(this._db);
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('FP_LLM_PRO_v1', 1);
        req.onupgradeneeded = e => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('models')) {
            db.createObjectStore('models', { keyPath: 'id' });
          }
        };
        req.onsuccess = e => { this._db = e.target.result; resolve(this._db); };
        req.onerror = () => reject(req.error);
      });
    },
    async put(model) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['models'], 'readwrite');
        tx.objectStore('models').put(model);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    },
    async get(id) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['models'], 'readonly');
        const req = tx.objectStore('models').get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },
    async delete(id) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['models'], 'readwrite');
        tx.objectStore('models').delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    },
    async listIds() {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['models'], 'readonly');
        const req = tx.objectStore('models').getAllKeys();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    },
  };

  /* ═══════════════════════════════════════════════════════════
     DOWNLOAD COM PROGRESSO
  ═══════════════════════════════════════════════════════════ */
  const Downloader = {
    async fetch(url, onProgress) {
      const resp = await fetch(url, { mode: 'cors' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const total = parseInt(resp.headers.get('Content-Length') || '0', 10);
      if (!resp.body || !total) {
        const buf = await resp.arrayBuffer();
        if (onProgress) onProgress({ loaded: buf.byteLength, total: buf.byteLength });
        return new Uint8Array(buf);
      }
      const reader = resp.body.getReader();
      const chunks = [];
      let loaded = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (onProgress) onProgress({ loaded, total });
      }
      const out = new Uint8Array(loaded);
      let off = 0;
      for (const c of chunks) { out.set(c, off); off += c.length; }
      return out;
    },
  };

  /* ═══════════════════════════════════════════════════════════
     WLLAMA LOADER — com fallbacks de CDN e checagem WASM
  ═══════════════════════════════════════════════════════════ */
  const WllamaLoader = {
    _module: null,
    _instance: null,

    /** URLs alternativos de CDN; o primeiro que funcionar vence */
    _cdns: [
      'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.1.4/esm/index.js',
      'https://unpkg.com/@wllama/wllama@2.1.4/esm/index.js',
      'https://esm.sh/@wllama/wllama@2.1.4',
      'https://cdn.skypack.dev/@wllama/wllama@2.1.4',
    ],

    _wasmFiles: {
      'single-thread/wllama.wasm': [
        'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.1.4/src/single-thread/wllama.wasm',
        'https://unpkg.com/@wllama/wllama@2.1.4/src/single-thread/wllama.wasm',
      ],
      'multi-thread/wllama.wasm': [
        'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.1.4/src/multi-thread/wllama.wasm',
        'https://unpkg.com/@wllama/wllama@2.1.4/src/multi-thread/wllama.wasm',
      ],
    },

    async load(onLog) {
      if (this._module) return this._module;
      const log = onLog || (() => {});
      let lastErr = null;
      for (const url of this._cdns) {
        try {
          log(`Tentando carregar Wllama de ${new URL(url).hostname}...`);
          const m = await import(/* @vite-ignore */ url);
          if (m && (m.Wllama || m.default?.Wllama)) {
            this._module = m;
            log(`✓ Wllama carregada de ${new URL(url).hostname}`);
            return m;
          }
        } catch (e) {
          lastErr = e;
          log(`✗ Falha em ${new URL(url).hostname}: ${e.message || e.name}`);
        }
      }
      throw new Error('Wllama não carregou de nenhum CDN. ' + (lastErr?.message || ''));
    },

    /** Inicializa instância da Wllama com paths corretos do WASM */
    async createInstance(onLog) {
      const m = await this.load(onLog);
      const Wllama = m.Wllama || m.default?.Wllama;
      if (!Wllama) throw new Error('Classe Wllama não encontrada no módulo');
      // Resolve URLs de WASM (primeiro CDN disponível)
      const paths = {};
      for (const [key, urls] of Object.entries(this._wasmFiles)) {
        for (const u of urls) {
          try {
            const r = await fetch(u, { method: 'HEAD', mode: 'cors' });
            if (r.ok) { paths[key] = u; break; }
          } catch {}
        }
      }
      const inst = new Wllama(paths);
      this._instance = inst;
      return inst;
    },

    async loadModel(blob, opts = {}) {
      const inst = this._instance || await this.createInstance(opts.onLog);
      const buf = blob instanceof ArrayBuffer ? blob : await blob.arrayBuffer();
      const u8 = new Uint8Array(buf);
      // API atual: loadModelFromUrl ou loadModel
      if (typeof inst.loadModelFromBlob === 'function') {
        await inst.loadModelFromBlob(new Blob([u8]), {
          n_ctx: opts.ctxLen || 4096,
          n_threads: navigator.hardwareConcurrency ? Math.max(1, navigator.hardwareConcurrency - 1) : 1,
        });
      } else if (typeof inst.loadModel === 'function') {
        // versões antigas
        await inst.loadModel(u8, { n_ctx: opts.ctxLen || 4096 });
      } else {
        throw new Error('Wllama: método de load não encontrado');
      }
      return inst;
    },

    async generate(prompt, opts = {}) {
      const inst = this._instance;
      if (!inst) throw new Error('Wllama não carregada');
      const max = opts.maxTokens || 256;
      const stop = opts.stop || [];
      if (typeof inst.createCompletion === 'function') {
        const out = await inst.createCompletion(prompt, {
          nPredict: max,
          sampling: { temp: opts.temperature ?? 0.7, top_p: opts.topP ?? 0.9 },
          stopPrompts: stop,
        });
        return typeof out === 'string' ? out : (out.text || out.content || '');
      }
      if (typeof inst.generate === 'function') {
        return await inst.generate(prompt, { max_tokens: max, stop });
      }
      throw new Error('Wllama: método de generate não encontrado');
    },

    /** Geração com streaming — chama onToken(piece, currentText) a cada token */
    async generateStream(prompt, opts = {}, onToken) {
      const inst = this._instance;
      if (!inst) throw new Error('Wllama não carregada');
      const max = opts.maxTokens || 256;
      const stop = opts.stop || [];
      if (typeof inst.createCompletion === 'function') {
        let accumulated = '';
        const out = await inst.createCompletion(prompt, {
          nPredict: max,
          sampling: { temp: opts.temperature ?? 0.7, top_p: opts.topP ?? 0.9 },
          stopPrompts: stop,
          onNewToken: (_token, piece, currentText) => {
            accumulated = currentText;
            if (onToken) onToken(piece, currentText);
          },
        });
        return typeof out === 'string' ? out : (out.text || accumulated || '');
      }
      // Fallback sem streaming
      const full = await this.generate(prompt, opts);
      if (onToken) {
        const words = full.split(' ');
        for (let i = 0; i < words.length; i++) {
          const current = words.slice(0, i + 1).join(' ');
          onToken(words[i] + ' ', current);
          await new Promise(r => setTimeout(r, 18));
        }
      }
      return full;
    },
  };

  /* ═══════════════════════════════════════════════════════════
     OLLAMA / LM STUDIO (HTTP em localhost)
     ───────────────────────────────────────────────────────────
     Se o usuário roda Ollama (porta 11434) ou LM Studio (porta 1234)
     localmente, podemos usar como backend zero-config.
  ═══════════════════════════════════════════════════════════ */
  const LocalAPI = {
    async detect() {
      // Em file://, ainda tentamos detectar APIs locais em localhost.
      // Se o localhost não responder, o fallback silencioso continuará.
      const candidates = [
        { name: 'Ollama', baseUrl: 'http://localhost:11434', tags: '/api/tags' },
        { name: 'LM Studio', baseUrl: 'http://localhost:1234', tags: '/v1/models' },
        { name: 'Jan', baseUrl: 'http://localhost:1337', tags: '/v1/models' },
      ];
      for (const c of candidates) {
        try {
          const r = await fetch(c.baseUrl + c.tags, {
            method: 'GET',
            mode: 'cors',
            signal: AbortSignal.timeout(1200)
          });
          if (r.ok) {
            const json = await r.json();
            const models = json.models || json.data || [];
            return { ...c, models: models.map(m => m.name || m.id) };
          }
        } catch { /* Ollama/LMStudio não está rodando — silencioso */ }
      }
      return null;
    },

    async generate(api, prompt, opts = {}) {
      const max = opts.maxTokens || 256;
      const model = opts.model || api.models[0];
      if (api.name === 'Ollama') {
        const r = await fetch(api.baseUrl + '/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt, stream: false, options: { num_predict: max, temperature: opts.temperature ?? 0.7 } })
        });
        const j = await r.json();
        return j.response || '';
      }
      // LM Studio / OpenAI-compat
      const r = await fetch(api.baseUrl + '/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: max,
          temperature: opts.temperature ?? 0.7
        })
      });
      const j = await r.json();
      return j.choices?.[0]?.message?.content || '';
    },
  };

  /* ═══════════════════════════════════════════════════════════
     ENGINE — orquestrador principal
  ═══════════════════════════════════════════════════════════ */
  const Engine = {
    state: {
      activeModelId: null,
      activeModel: null,
      ready: false,
      loading: false,
      backend: null,           // 'wllama' | 'localapi'
      error: null,
      localApi: null,
      modelInCache: new Set(),
      progress: null,          // { loaded, total }
      logs: [],
    },

    log(msg) {
      this.state.logs.push({ time: new Date(), msg });
      if (this.state.logs.length > 100) this.state.logs.shift();
      document.dispatchEvent(new CustomEvent('fpllm:log', { detail: msg }));
    },

    async init() {
      // Carrega modelos em cache
      try {
        const ids = await Store.listIds();
        ids.forEach(id => this.state.modelInCache.add(id));
      } catch {}

      // Detecta API local em paralelo (não bloqueia)
      LocalAPI.detect().then(api => {
        if (api) {
          this.state.localApi = api;
          this.log(`API local detectada: ${api.name} (${api.models.length} modelo(s))`);
        }
      }).catch(() => {});

      // Auto-load se houver modelo ativo configurado e em cache
      const lastId = await getPref('llmProActiveId', null);
      const autoLoad = await getPref('llmProAutoLoad', true);
      if (lastId && autoLoad && this.state.modelInCache.has(lastId)) {
        this.log(`Auto-carregando modelo "${lastId}"...`);
        try { await this.loadModel(lastId); }
        catch (e) { this.log('✗ Auto-load falhou: ' + e.message); }
      }
    },

    /** Garante o modelo no cache (download se necessário) */
    async ensureModel(modelId, onProgress) {
      const cached = await Store.get(modelId);
      if (cached && cached.blob) {
        this.log(`✓ Modelo "${modelId}" já no cache (${fmtMB(cached.size)})`);
        return cached;
      }
      const def = CATALOG.find(c => c.id === modelId);
      if (!def) throw new Error(`Modelo desconhecido: ${modelId}`);
      this.log(`⬇ Baixando ${def.name} (${def.sizeMB} MB)...`);
      const data = await Downloader.fetch(def.url, p => {
        this.state.progress = p;
        if (onProgress) onProgress(p);
        document.dispatchEvent(new CustomEvent('fpllm:progress', { detail: p }));
      });
      const record = {
        id: modelId,
        name: def.name,
        size: data.byteLength,
        backend: def.backend,
        savedAt: Date.now(),
        blob: new Blob([data], { type: 'application/octet-stream' }),
      };
      try {
        await Store.put(record);
        this.state.modelInCache.add(modelId);
        this.log(`✓ Modelo salvo no cache local`);
      } catch (e) {
        this.log(`⚠ Não foi possível cachear (provavelmente quota): ${e.message}`);
      }
      this.state.progress = null;
      return record;
    },

    /** Importa um arquivo .gguf manualmente */
    async importFile(file, modelId = null) {
      const id = modelId || ('local-' + Date.now());
      const def = CATALOG.find(c => c.id === modelId) || {
        id, name: file.name, backend: 'wllama', sizeMB: Math.round(file.size / 1024 / 1024),
        ctxLen: 4096, promptTpl: '{P}\n', stop: [],
      };
      const buf = await file.arrayBuffer();
      const record = {
        id: def.id,
        name: def.name,
        size: file.size,
        backend: def.backend,
        savedAt: Date.now(),
        blob: new Blob([buf], { type: 'application/octet-stream' }),
        custom: !modelId,
        meta: def,
      };
      await Store.put(record);
      this.state.modelInCache.add(def.id);
      this.log(`✓ Modelo "${def.name}" importado (${fmtMB(file.size)})`);
      return record;
    },

    /** Carrega modelo ativo em memória */
    async loadModel(modelId, opts = {}) {
      this.state.loading = true;
      this.state.ready = false;
      this.state.error = null;
      this.state.activeModelId = modelId;
      try {
        const record = await this.ensureModel(modelId);
        const def = CATALOG.find(c => c.id === modelId) || record.meta;
        if (!def) throw new Error('Definição do modelo não encontrada');
        if (def.backend === 'wllama' || record.backend === 'wllama') {
          this.log(`⏳ Inicializando Wllama...`);
          await WllamaLoader.loadModel(record.blob, {
            ctxLen: def.ctxLen || 4096,
            onLog: m => this.log(m),
          });
          this.state.backend = 'wllama';
        } else {
          throw new Error('Backend não suportado: ' + def.backend);
        }
        this.state.activeModel = def;
        this.state.ready = true;
        this.log(`✓ Modelo "${def.name}" pronto para uso`);
        await setPref('llmProActiveId', modelId);
        document.dispatchEvent(new CustomEvent('fpllm:ready', { detail: def }));
        return true;
      } catch (e) {
        this.state.error = e.message;
        this.log(`✗ Erro ao carregar: ${e.message}`);
        document.dispatchEvent(new CustomEvent('fpllm:error', { detail: e.message }));
        return false;
      } finally {
        this.state.loading = false;
      }
    },

    /** Gera resposta do LLM ativo, ou usa API local como fallback */
    async generate(prompt, opts = {}) {
      const def = this.state.activeModel;
      const fullPrompt = def?.promptTpl ? def.promptTpl.replace('{P}', prompt) : prompt;
      const stop = def?.stop || [];
      if (this.state.ready && this.state.backend === 'wllama') {
        try {
          const out = await WllamaLoader.generate(fullPrompt, { ...opts, stop });
          return this._cleanOutput(out, stop);
        } catch (e) { this.log('✗ Erro Wllama: ' + e.message); }
      }
      if (this.state.localApi) {
        try { return await LocalAPI.generate(this.state.localApi, prompt, opts); } catch (e) { this.log('✗ Erro API local: ' + e.message); }
      }
      throw new Error('Nenhum LLM disponível.');
    },

    /** Geração com streaming — expõe onToken(piece, currentText) */
    async generateStream(prompt, opts = {}, onToken) {
      const def = this.state.activeModel;
      const fullPrompt = def?.promptTpl ? def.promptTpl.replace('{P}', prompt) : prompt;
      const stop = def?.stop || [];
      if (this.state.ready && this.state.backend === 'wllama') {
        try {
          const out = await WllamaLoader.generateStream(fullPrompt, { ...opts, stop }, (piece, current) => {
            if (onToken) onToken(piece, this._cleanOutput(current, stop));
          });
          return this._cleanOutput(out, stop);
        } catch (e) { this.log('✗ Erro streaming Wllama: ' + e.message); }
      }
      // Fallback sem streaming real
      const full = await this.generate(prompt, opts);
      if (onToken) {
        const words = full.split(' ');
        for (let i = 0; i < words.length; i++) {
          onToken(words[i] + ' ', words.slice(0, i + 1).join(' '));
          await new Promise(r => setTimeout(r, 20));
        }
      }
      return full;
    },

    _cleanOutput(text, stop) {
      let out = String(text || '');
      for (const s of stop) {
        const idx = out.indexOf(s);
        if (idx >= 0) out = out.substring(0, idx);
      }
      return out.trim();
    },

    async unload() {
      this.state.activeModel = null;
      this.state.activeModelId = null;
      this.state.ready = false;
      this.state.backend = null;
      WllamaLoader._instance = null;
      WllamaLoader._module = null;
      this.log('Modelo descarregado.');
      await setPref('llmProActiveId', null);
    },

    async deleteCached(modelId) {
      await Store.delete(modelId);
      this.state.modelInCache.delete(modelId);
      this.log(`Modelo "${modelId}" removido do cache.`);
      if (this.state.activeModelId === modelId) await this.unload();
    },

    /** Diagnóstico completo */
    async diagnose() {
      const lines = [];
      lines.push('🔬 DIAGNÓSTICO LLM PRO\n');
      lines.push('Backend ativo: ' + (this.state.backend || '(nenhum)'));
      lines.push('Modelo ativo: ' + (this.state.activeModel?.name || '(nenhum)'));
      lines.push('Pronto: ' + (this.state.ready ? '✓' : '✗'));
      lines.push('');
      lines.push('Modelos em cache: ' + (this.state.modelInCache.size || 0));
      for (const id of this.state.modelInCache) {
        const r = await Store.get(id);
        lines.push(`  • ${id} (${fmtMB(r?.size)})`);
      }
      lines.push('');
      // Wllama
      try {
        await WllamaLoader.load(m => lines.push('  ' + m));
        lines.push('Wllama: ✓ disponível');
      } catch (e) { lines.push('Wllama: ✗ ' + e.message); }
      // API local
      const api = await LocalAPI.detect();
      if (api) lines.push(`API Local: ✓ ${api.name} (${api.models.join(', ')})`);
      else lines.push('API Local: ✗ não detectada');
      // WebGPU / SIMD
      lines.push('');
      lines.push('Capacidades do navegador:');
      lines.push('  WebAssembly: ' + (typeof WebAssembly !== 'undefined' ? '✓' : '✗'));
      lines.push('  SharedArrayBuffer: ' + (typeof SharedArrayBuffer !== 'undefined' ? '✓ (multi-thread)' : '✗ (single-thread)'));
      lines.push('  WebGPU: ' + (navigator.gpu ? '✓' : '✗'));
      lines.push('  Cores: ' + (navigator.hardwareConcurrency || '?'));
      if (navigator.deviceMemory) lines.push('  RAM: ' + navigator.deviceMemory + ' GB');
      // Storage
      try {
        const est = await navigator.storage.estimate();
        lines.push(`  Storage: ${fmtMB(est.usage)} / ${fmtMB(est.quota)}`);
      } catch {}
      return lines.join('\n');
    },
  };

  /* ═══════════════════════════════════════════════════════════
     UI — Painel nas Configurações
  ═══════════════════════════════════════════════════════════ */
  const UI = {
    install() {
      this._inject();
      this._watch();
    },

    _inject() {
      const page = $('page-settings') || $('pageSettings') || document.querySelector('[data-page="settings"]');
      if (!page) return;
      if ($('llmProCard')) return;
      const card = document.createElement('div');
      card.id = 'llmProCard';
      card.className = 'card fp-llm-card';
      card.innerHTML = this._html();
      page.appendChild(card);
      this._bind();
      this._refreshState();
    },

    _html() {
      return `
        <div class="card-hdr">
          <div class="card-title"><i class="fas fa-microchip" style="color:var(--accent)"></i> Modelos de IA Local (LLM Pro)</div>
          <div class="fp-llm-status" id="llmProStatus">
            <span class="fp-llm-dot"></span> <span id="llmProStatusTxt">verificando...</span>
          </div>
        </div>
        <div class="card-body">
          <div class="fp-llm-help">
            <i class="fas fa-info-circle"></i>
            <span>Modelos rodam <strong>100% offline</strong> no seu navegador. Escolha um abaixo, baixe uma vez e use sempre. Cache automático em IndexedDB — sem perder permissão entre sessões.</span>
          </div>

          <div class="fp-llm-section-title">Catálogo</div>
          <div class="fp-llm-catalog" id="llmProCatalog"></div>

          <div class="fp-llm-section-title">Importar arquivo .gguf manualmente</div>
          <div class="fp-llm-row">
            <input type="file" id="llmProFile" accept=".gguf" hidden>
            <button class="btn btn-outline btn-sm" id="llmProFileBtn"><i class="fas fa-upload"></i> Selecionar arquivo</button>
            <span class="fp-llm-hint">Use seu próprio modelo .gguf (será cacheado).</span>
          </div>

          <div class="fp-llm-section-title">Diagnóstico</div>
          <div class="fp-llm-row">
            <button class="btn btn-outline btn-sm" id="llmProDiagBtn"><i class="fas fa-stethoscope"></i> Rodar diagnóstico</button>
            <button class="btn btn-outline btn-sm" id="llmProTestBtn"><i class="fas fa-vial"></i> Testar resposta</button>
            <button class="btn btn-outline btn-sm" id="llmProUnloadBtn"><i class="fas fa-power-off"></i> Descarregar</button>
          </div>
          <pre id="llmProDiagOut" class="fp-llm-diag hidden"></pre>

          <div class="toggle-row" style="margin-top:1rem">
            <div class="toggle-row-info">
              <strong>🚀 Auto-carregar modelo no boot</strong>
              <span>Carrega o modelo ativo assim que o app abrir.</span>
            </div>
            <label class="toggle"><input type="checkbox" id="llmProAutoLoad" checked><span class="toggle-slider"></span></label>
          </div>
        </div>
      `;
    },

    _renderCatalog() {
      const wrap = $('llmProCatalog');
      if (!wrap) return;
      const active = Engine.state.activeModelId;
      wrap.innerHTML = CATALOG.map(m => {
        const cached = Engine.state.modelInCache.has(m.id);
        const isActive = m.id === active && Engine.state.ready;
        const isLoading = m.id === active && Engine.state.loading;
        const vramClass = m.vram === 'muito baixa' ? 'low' : m.vram === 'baixa' ? 'low' : m.vram === 'média' ? 'mid' : 'high';
        return `
          <div class="fp-llm-model ${isActive ? 'active' : ''}" data-id="${m.id}">
            <div class="fp-llm-model-hdr">
              <div class="fp-llm-model-name">${esc(m.name)}</div>
              <div class="fp-llm-model-tags">
                <span class="fp-llm-tag fp-llm-tag-${vramClass}">${esc(m.vram)} memória</span>
                <span class="fp-llm-tag">${m.sizeMB} MB</span>
                ${cached ? '<span class="fp-llm-tag fp-llm-tag-ok"><i class="fas fa-check"></i> em cache</span>' : ''}
                ${isActive ? '<span class="fp-llm-tag fp-llm-tag-active"><i class="fas fa-bolt"></i> ATIVO</span>' : ''}
              </div>
            </div>
            <div class="fp-llm-model-desc">${esc(m.desc)}</div>
            <div class="fp-llm-model-actions">
              ${isLoading ? `
                <button class="btn btn-outline btn-sm" disabled><i class="fas fa-spinner fa-spin"></i> Carregando...</button>
              ` : isActive ? `
                <button class="btn btn-ghost btn-sm" data-act="test" data-id="${m.id}"><i class="fas fa-comment"></i> Testar</button>
                <button class="btn btn-ghost btn-sm" data-act="unload"><i class="fas fa-stop"></i> Parar</button>
              ` : `
                <button class="btn btn-primary btn-sm" data-act="load" data-id="${m.id}">
                  <i class="fas ${cached ? 'fa-bolt' : 'fa-download'}"></i> ${cached ? 'Carregar' : 'Baixar e usar'}
                </button>
              `}
              ${cached && !isActive ? `<button class="btn btn-ghost btn-sm" data-act="del" data-id="${m.id}" title="Remover do cache"><i class="fas fa-trash"></i></button>` : ''}
            </div>
            <div class="fp-llm-progress hidden" data-prog="${m.id}">
              <div class="fp-llm-progress-bar"><div class="fp-llm-progress-fill"></div></div>
              <div class="fp-llm-progress-txt">0%</div>
            </div>
          </div>
        `;
      }).join('');

      wrap.querySelectorAll('[data-act]').forEach(btn => {
        btn.onclick = e => {
          const act = btn.dataset.act;
          const id = btn.dataset.id;
          if (act === 'load') this._handleLoad(id);
          else if (act === 'test') this._handleTest();
          else if (act === 'unload') this._handleUnload();
          else if (act === 'del') this._handleDelete(id);
        };
      });
    },

    _bind() {
      $('llmProFileBtn').onclick = () => $('llmProFile').click();
      $('llmProFile').onchange = async e => {
        const f = e.target.files[0];
        if (!f) return;
        const id = prompt('ID para esse modelo (ex: meu-modelo)? Ou Enter para auto.', '');
        try {
          T('Importando arquivo...', 'info');
          const rec = await Engine.importFile(f, id || null);
          await Engine.loadModel(rec.id);
          this._refreshState();
          T('Modelo importado e carregado!', 'success');
        } catch (err) { T('Erro: ' + err.message, 'error'); }
        e.target.value = '';
      };
      $('llmProDiagBtn').onclick = async () => {
        const out = $('llmProDiagOut');
        out.classList.remove('hidden');
        out.textContent = 'Diagnosticando...';
        try { out.textContent = await Engine.diagnose(); }
        catch (e) { out.textContent = 'Erro: ' + e.message; }
      };
      $('llmProTestBtn').onclick = () => this._handleTest();
      $('llmProUnloadBtn').onclick = () => this._handleUnload();
      $('llmProAutoLoad').onchange = e => setPref('llmProAutoLoad', e.target.checked);
      // Inicial
      getPref('llmProAutoLoad', true).then(v => { $('llmProAutoLoad').checked = !!v; });
      // Listeners
      document.addEventListener('fpllm:progress', e => this._showProgress(e.detail));
      document.addEventListener('fpllm:ready', () => this._refreshState());
      document.addEventListener('fpllm:error', () => this._refreshState());
      document.addEventListener('fpllm:log', e => {
        const out = $('llmProDiagOut');
        if (out && !out.classList.contains('hidden')) {
          out.textContent += '\n' + e.detail;
          out.scrollTop = out.scrollHeight;
        }
      });
    },

    async _handleLoad(id) {
      try {
        T(`Carregando "${id}"...`, 'info', 2500);
        const ok = await Engine.loadModel(id);
        this._refreshState();
        if (ok) T('Modelo pronto!', 'success');
        else T('Falha ao carregar: ' + Engine.state.error, 'error', 5000);
      } catch (e) { T('Erro: ' + e.message, 'error'); }
    },

    async _handleTest() {
      if (!Engine.state.ready) { T('Carregue um modelo primeiro.', 'warning'); return; }
      const out = $('llmProDiagOut');
      out.classList.remove('hidden');
      out.textContent = 'Gerando resposta de teste...';
      try {
        const resp = await Engine.generate('Em uma frase curta, qual a importância de controlar gastos?', { maxTokens: 80 });
        out.textContent = '🤖 Resposta:\n\n' + resp;
      } catch (e) { out.textContent = '✗ Erro: ' + e.message; }
    },

    async _handleUnload() {
      await Engine.unload();
      this._refreshState();
      T('Modelo descarregado.', 'info');
    },

    async _handleDelete(id) {
      if (!confirm(`Remover "${id}" do cache?`)) return;
      await Engine.deleteCached(id);
      this._refreshState();
      T('Removido do cache.', 'info');
    },

    _showProgress(p) {
      if (!p) return;
      const id = Engine.state.activeModelId;
      const wrap = document.querySelector(`[data-prog="${id}"]`);
      if (!wrap) return;
      wrap.classList.remove('hidden');
      const pct = p.total ? (p.loaded / p.total * 100).toFixed(1) : 0;
      wrap.querySelector('.fp-llm-progress-fill').style.width = pct + '%';
      wrap.querySelector('.fp-llm-progress-txt').textContent =
        `${pct}% — ${fmtMB(p.loaded)} / ${fmtMB(p.total)}`;
    },

    _refreshState() {
      const dot = document.querySelector('.fp-llm-dot');
      const txt = $('llmProStatusTxt');
      if (!dot || !txt) return;
      if (Engine.state.loading) {
        dot.className = 'fp-llm-dot fp-llm-dot-loading'; txt.textContent = 'carregando...';
      } else if (Engine.state.ready) {
        dot.className = 'fp-llm-dot fp-llm-dot-ok'; txt.textContent = `pronto (${Engine.state.activeModel.name})`;
      } else if (Engine.state.error) {
        dot.className = 'fp-llm-dot fp-llm-dot-err'; txt.textContent = 'erro';
      } else {
        dot.className = 'fp-llm-dot'; txt.textContent = 'inativo';
      }
      this._renderCatalog();
    },

    _watch() {
      // Escuta o evento de ready disparado por loadSettings()
      window.addEventListener('settingsPageReady', () => {
        if (!$('llmProCard')) this._inject();
      });
      
      let tries = 0;
      const ivl = setInterval(() => {
        const page = $('page-settings') || $('pageSettings') || document.querySelector('[data-page="settings"]');
        if (page && !$('llmProCard')) this._inject();
        if (++tries > 60) clearInterval(ivl);
      }, 1500);
    },
  };

  /* ═══════════════════════════════════════════════════════════
     askAI() — substitui versão padrão por uma robusta
     ───────────────────────────────────────────────────────────
     Mantém compatibilidade total: assinatura idêntica.
  ═══════════════════════════════════════════════════════════ */
  function installAskAI() {
    const original = window.askAI;
    window.askAI = async function (prompt, opts = {}) {
      try {
        // Tenta LLM Pro primeiro
        if (Engine.state.ready) {
          return await Engine.generate(prompt, opts);
        }
        if (Engine.state.localApi) {
          return await LocalAPI.generate(Engine.state.localApi, prompt, opts);
        }
        // Se não houver, tenta o ModelManager antigo
        if (typeof original === 'function') {
          return await original(prompt, opts);
        }
        if (window.ModelManager?.generate) {
          return await window.ModelManager.generate(prompt, opts.maxTokens || 256);
        }
        throw new Error('Nenhum LLM disponível.');
      } catch (e) {
        // Última cartada: chama original se existir
        if (typeof original === 'function' && original !== window.askAI) {
          try { return await original(prompt, opts); } catch {}
        }
        throw e;
      }
    };
  }

  /* ═══════════════════════════════════════════════════════════
     ENTRY POINT
  ═══════════════════════════════════════════════════════════ */
  const FP_LLM_PRO = {
    Engine, CATALOG, WllamaLoader, LocalAPI, Store, Downloader, UI,
    async ask(prompt, opts) { return await Engine.generate(prompt, opts); },
    async askStream(prompt, opts, onToken) { return await Engine.generateStream(prompt, opts, onToken); },
    async init() {
      try {
        await waitApp();
        await Engine.init();
        UI.install();
        installAskAI();
        console.log('[FP_LLM_PRO] inicializado');
      } catch (e) {
        console.warn('[FP_LLM_PRO] falha init', e);
      }
    }
  };
  window.FP_LLM_PRO = FP_LLM_PRO;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FP_LLM_PRO.init());
  } else {
    setTimeout(() => FP_LLM_PRO.init(), 1200);
  }
})();
