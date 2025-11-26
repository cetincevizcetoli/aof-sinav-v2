const STATIC_CACHE = 'aof-asistan-v2-static-v1.0.2';
const DATA_CACHE = 'aof-asistan-v2-data-v1.0.2';
const TTL_MS = 300000;
const STATIC_ASSETS = [
    './',
    './index.html',
    './css/main.css',
    './css/modal.css',
    './js/app.js',
    './js/core/db.js',
    './js/core/dataLoader.js',
    './js/core/srs.js',
    './js/core/gamification.js',
    './js/core/examManager.js',
    './js/core/updateManager.js',
    './js/ui/dashboard.js',
    './js/ui/quizUI.js',
    './assets/logo.png'
];

// Kurulum (Install)
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

// Aktifleştirme ve Eski Cache Temizliği
self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== STATIC_CACHE && key !== DATA_CACHE) {
                    return caches.delete(key);
                }
            }));
        })
    );
});

// İstekleri Yakalama (Fetch)
self.addEventListener('fetch', (event) => {
    if (!event.request.url.startsWith('http')) return;

    if (event.request.url.includes('/data/') || event.request.url.endsWith('.json')) {
        event.respondWith(
            caches.open(DATA_CACHE).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                const networkFetch = fetch(event.request).then(async (response) => {
                    if (response.ok) {
                        await cache.put(event.request, response.clone());
                    }
                    return response;
                }).catch(() => {});

                if (cachedResponse) {
                    const dateHeader = cachedResponse.headers.get('Date');
                    let fresh = true;
                    if (dateHeader) {
                        const age = Date.now() - new Date(dateHeader).getTime();
                        fresh = age < TTL_MS;
                    }
                    if (fresh) return cachedResponse;
                    return networkFetch.then(r => r).catch(() => cachedResponse);
                }
                return networkFetch;
            })
        );
        return;
    }

    event.respondWith(
        caches.open(STATIC_CACHE).then(async (cache) => {
            const cached = await cache.match(event.request);
            if (cached) return cached;
            return fetch(event.request).then(async (resp) => {
                if (resp && resp.ok) {
                    await cache.put(event.request, resp.clone());
                }
                return resp;
            }).catch(() => {
                if (event.request.mode === 'navigate') {
                    return cache.match('./index.html');
                }
            });
        })
    );
});
