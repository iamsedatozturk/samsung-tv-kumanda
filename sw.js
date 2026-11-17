// Uygulama olarak kurulabilmek için gereken service worker. Önbellek tutmaz: kumanda zaten sunucu açıkken çalışır.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
