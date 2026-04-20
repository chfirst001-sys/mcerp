// 버전을 변경하면 브라우저가 기존 캐시를 무효화하고 최신 파일로 갱신합니다.
const CACHE_NAME = 'mcerp-cache-v35';
// 초기 캐싱할 정적 파일 목록
const urlsToCache = [
    './',
    'index.html',
    'css/style.css',
    'js/main.js'
];

// 서비스 워커 설치 및 캐싱
self.addEventListener('install', event => {
    self.skipWaiting(); // 대기 중인 구버전 서비스 워커를 즉시 종료하고 새 버전 활성화
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(urlsToCache);
        })
    );
});

// 새로운 서비스 워커가 활성화될 때 이전 버전의 캐시를 자동으로 삭제
self.addEventListener('activate', event => {
    event.waitUntil(clients.claim()); // 즉시 브라우저의 모든 탭에 대한 제어권 획득
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

// 네트워크 요청 가로채기 (네트워크 우선, 실패 시 캐시(오프라인) 사용)
self.addEventListener('fetch', event => {
    // 1. GET 요청이 아닌 경우(POST, PUT, DELETE 등) 캐싱을 시도하지 않고 바로 네트워크로 넘김
    if (event.request.method !== 'GET') return;

    // Firebase 및 외부 API(DB 등) 요청은 서비스 워커 캐시를 타지 않도록 예외 처리
    const url = event.request.url;
    if (url.includes('googleapis.com') || url.includes('firebase') || url.includes('gstatic.com') || url.includes('cloudfunctions.net')) {
        return; // 이 요청들은 가로채지 않고 브라우저가 직접 처리하도록 넘김
    }

    event.respondWith(
        fetch(event.request).then(networkResponse => {
            // 네트워크 연결이 정상이면 서버에서 최신 파일을 가져오고, 나중의 오프라인을 대비해 캐시도 최신화
            return caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
            });
        }).catch(() => {
            // 오프라인 상태이거나 서버 접근 불가 시 기존에 백업된 캐시 파일 제공
            return caches.match(event.request);
        })
    );
});