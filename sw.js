// Service Worker para Kedadas PWA
const CACHE_NAME = 'kedadas-cache-v40';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './apple-touch-icon-precomposed.png',
  './icono-192.png',
  './icono-512.png',
  './favicon-32.png',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.48.1/dist/umd/supabase.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Error precacheando recursos estáticos:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia Network-First con timeout de seguridad (3s) para evitar bloqueos por mala cobertura
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  // No cachear peticiones de Supabase ni de funciones serverless
  if (event.request.url.includes('supabase.co') || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    new Promise((resolve) => {
      let timedOut = false;
      const timeoutId = setTimeout(() => {
        timedOut = true;
        caches.match(event.request, { ignoreSearch: true }).then((cached) => {
          if (cached) resolve(cached);
        });
      }, 3000);

      fetch(event.request)
        .then((networkResponse) => {
          clearTimeout(timeoutId);
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          if (!timedOut) resolve(networkResponse);
        })
        .catch(() => {
          clearTimeout(timeoutId);
          caches.match(event.request, { ignoreSearch: true }).then((cached) => {
            if (cached) {
              resolve(cached);
            } else {
              resolve(new Response('Sin conexión a internet', { status: 503 }));
            }
          });
        });
    })
  );
});

// Gestión de Notificaciones Push (Web Push)
self.addEventListener('push', (event) => {
  let data = { title: 'Kedadas', body: '¡Hay una nueva actividad en tu grupo!' };
  let destinoUrl = './';
  if (event.data) {
    try {
      const parsed = event.data.json();
      data.title = parsed.title || data.title;
      data.body = parsed.body || data.body;
      destinoUrl = (parsed.data && parsed.data.url) || parsed.url || './';
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: 'icono-192.png',
    badge: 'icono-192.png',
    vibrate: [200, 100, 200],
    data: { url: destinoUrl },
    actions: [
      { action: 'open', title: '👀 Ver cuadrante' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = (event.notification.data && event.notification.data.url) ? event.notification.data.url : './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        try {
          const clientOrigin = new URL(client.url, self.location.origin).origin;
          if (clientOrigin === self.location.origin && 'focus' in client) {
            return client.focus();
          }
        } catch(e) {}
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});
