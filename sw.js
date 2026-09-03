// Service Worker على كامل الموقع (installable) "بسيط" - غرضه الأساسي إثبات أن الموقع "قابل للتثبيت"
const CACHE_NAME = 'hamoul-v1';

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

// استراتيجية "الشبكة أولاً" - بيحاول يجيب أحدث نسخة من الإنترنت دايمًا، ولو النت مقطوع بيرجع لآخر نسخة محفوظة
self.addEventListener('fetch', function(event) {
  // مهم: منخزنش في الكاش إلا طلبات القراءة (GET) بس - أي طلب حفظ/تعديل (POST/PUT/PATCH/DELETE) بيتسيب يمشي عادي من غير تخزين
  if (event.request.method !== 'GET') {
    return;
  }

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
