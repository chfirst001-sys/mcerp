// 버전을 변경하면 브라우저가 기존 캐시를 무효화하고 최신 파일로 갱신합니다.
const CACHE_NAME = 'mcerp-cache-v2';
// 초기 캐싱할 정적 파일 목록
const urlsToCache = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/main.js',
    '/js/eventBus.js'
];

// 서비스 워커 설치 및 캐싱
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(urlsToCache);
        })
    );
});

// 새로운 서비스 워커가 활성화될 때 이전 버전의 캐시를 자동으로 삭제
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 네트워크 요청 가로채기 (캐시 우선, 없으면 네트워크 요청)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});