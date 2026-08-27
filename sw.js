// Service Worker بسيط - غرضه الأساسي إثبات أن الموقع "قابل للتثبيت" (installable) بشكل كامل على أغلب المتصفحات
const CACHE_NAME = 'hamoul-v1';

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

// استراتيجية "الشبكة أولاً" - بيحاول يجيب أحدث نسخة من الإنترنت دايمًا، ولو النت مقطوع بيرجع لآخر نسخة محفوظة
self.addEventListener('fetch', function(event) {
  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(function() {
        return caches.match(event.request);
      })
  );
});
