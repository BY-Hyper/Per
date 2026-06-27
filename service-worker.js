/* ═══════════════════════════════════════════════════════════
   FinancePro Service Worker v2.0
   - Cache offline (cache-first p/ assets, network-first p/ app shell)
   - Push API (notificações remotas quando online)
   - Notificações locais (mostradas pelo SW mesmo com app fechado)
   - Background Sync (backup, upload diferido)
   - Periodic Background Sync (verificações a cada 6h: vencimentos/orçamentos)
   - Comunicação bidirecional com a página via postMessage
═══════════════════════════════════════════════════════════ */
'use strict';

const SW_VERSION = 'fp-sw-v2.0.0';
const STATIC_CACHE = 'fp-static-' + SW_VERSION;
const RUNTIME_CACHE = 'fp-runtime-' + SW_VERSION;

// Assets do app shell — cacheados na instalação
const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './fp-extensions.js',
  './fp-extensions.css',
  './fp-ai-pro.js',
  './fp-ai-pro.css',
  './fp-import-pro.js',
  './fp-import-pro.css',
  './fp-llm-pro.js',
  './fp-llm-pro.css',
  './fp-challenges.js',
  './fp-fraud.js',
  './fp-controle-financeiro.js',
  './fp-melhorias-sistema.js',
  './fp-ai-maintenance.js',
  './fp-ai-pro-v3.js',
  './fp-ai-melhorias-1-5.js',
  './fp-ai-melhorias-6-10.js',
  './fp-integrador.js',
  './icon.svg',
];

// Domínios CDN cacheados em runtime (cache-first)
const CDN_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'cdn.sheetjs.com',
  'unpkg.com',
];

/* ─────────────────── INSTALL ─────────────────── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL).catch(err => {
        // Se algum asset não existir, não falhar a instalação inteira
        console.warn('[SW] Alguns assets não puderam ser cacheados:', err);
        return Promise.allSettled(APP_SHELL.map(u => cache.add(u).catch(() => null)));
      }))
      .then(() => self.skipWaiting())
  );
});

/* ─────────────────── ACTIVATE ─────────────────── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('fp-') && k !== STATIC_CACHE && k !== RUNTIME_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ─────────────────── FETCH ─────────────────── */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Não interceptar APIs externas POST/PUT (backup, etc.)
  if (url.pathname.includes('/api/') || url.pathname.includes('/upload/')) return;

  // CDN — cache-first
  if (CDN_HOSTS.some(h => url.hostname.includes(h))) {
    e.respondWith(
      caches.match(req).then(cached =>
        cached || fetch(req).then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(RUNTIME_CACHE).then(c => c.put(req, clone));
          }
          return resp;
        }).catch(() => cached)
      )
    );
    return;
  }

  // App shell (mesmo origin) — network-first com fallback ao cache
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(STATIC_CACHE).then(c => c.put(req, clone));
        }
        return resp;
      }).catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
  }
});

/* ─────────────────── PUSH (online) ─────────────────── */
self.addEventListener('push', e => {
  let data = { title: 'FinancePro', body: 'Você tem uma nova notificação', tag: 'fp-push' };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch {
    if (e.data) data.body = e.data.text();
  }
  const options = {
    body: data.body,
    icon: './icon.svg',
    badge: './icon.svg',
    tag: data.tag,
    renotify: true,
    requireInteraction: data.important || false,
    data: { url: data.url || './', ...data.data },
    actions: data.actions || [
      { action: 'open', title: 'Abrir' },
      { action: 'dismiss', title: 'Dispensar' }
    ],
  };
  e.waitUntil(self.registration.showNotification(data.title, options));
});

/* ─────────────────── NOTIFICATION CLICK ─────────────────── */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  const targetUrl = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.postMessage({ type: 'NOTIF_CLICK', data: e.notification.data });
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

/* ─────────────────── BACKGROUND SYNC ─────────────────── */
// Disparado pela página via registration.sync.register('fp-backup')
// quando o dispositivo voltar a ficar online
self.addEventListener('sync', e => {
  if (e.tag === 'fp-backup') {
    e.waitUntil(notifyClients('SYNC_REQUEST', { tag: 'fp-backup' }));
  }
  if (e.tag === 'fp-checks') {
    e.waitUntil(notifyClients('SYNC_REQUEST', { tag: 'fp-checks' }));
  }
});

/* ─────────────────── PERIODIC BACKGROUND SYNC ─────────────────── */
// Disparado automaticamente pelo navegador (ex: a cada 6h)
self.addEventListener('periodicsync', e => {
  if (e.tag === 'fp-periodic-checks') {
    e.waitUntil(runPeriodicChecks());
  }
});

/* Executa verificações que podem rodar mesmo sem app aberto */
async function runPeriodicChecks() {
  // Pede para clientes ativos rodarem checagens; se nenhum estiver aberto,
  // mostra notificação genérica de lembrete
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  if (clients.length) {
    clients.forEach(c => c.postMessage({ type: 'PERIODIC_CHECK' }));
  } else {
    // App não está aberto - mostrar lembrete genérico
    return self.registration.showNotification('FinancePro', {
      body: 'Confira seus orçamentos e contas do mês.',
      icon: './icon.svg',
      tag: 'fp-periodic-reminder',
      data: { url: './#dashboard' }
    });
  }
}

/* ─────────────────── COMUNICAÇÃO COM A PÁGINA ─────────────────── */
self.addEventListener('message', e => {
  const msg = e.data || {};

  // Página solicitou exibir notificação local pelo SW
  // (funciona mesmo se a página estiver minimizada/em background)
  if (msg.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(msg.title || 'FinancePro', {
      body: msg.body || '',
      icon: './icon.svg',
      badge: './icon.svg',
      tag: msg.tag || 'fp-local',
      renotify: true,
      data: msg.data || {},
      actions: msg.actions
    });
  }

  // Página pediu para limpar caches (ex: logout / reset)
  if (msg.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('fp-')).map(k => caches.delete(k))));
  }

  // Skip waiting (atualização forçada)
  if (msg.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* Helper: avisa todos os clientes abertos */
async function notifyClients(type, data = {}) {
  const list = await self.clients.matchAll({ includeUncontrolled: true });
  list.forEach(c => c.postMessage({ type, ...data }));
}
