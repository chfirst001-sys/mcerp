// Firebase SDK 모듈 가져오기
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// 앱 버전 (코드를 업데이트할 때마다 이 값을 변경하면 브라우저가 최신 파일을 불러옵니다)
const APP_VERSION = "20240408";

// Firebase 콘솔에서 발급받은 설정값
const firebaseConfig = {
  apiKey: "AIzaSyBpjHY6c83Aqy8GzDXLMUEXejLGlZf8RX8",
  authDomain: "mcdb-9ef24.firebaseapp.com",
  projectId: "mcdb-9ef24",
  storageBucket: "mcdb-9ef24.firebasestorage.app",
  messagingSenderId: "574433525392",
  appId: "1:574433525392:web:56215f0c4c7d452f6b2215",
  measurementId: "G-V8XP2W9LC4"
};


// Firebase 앱 및 Firestore 초기화
// export를 붙여서 분리된 모듈 파일들에서도 db를 가져다 쓸 수 있게 합니다.
// 안전장치: Firebase 앱이 여러 번 초기화되는 것을 방지합니다.
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);

// XSS 방지를 위한 HTML 문자열 이스케이프 유틸리티
export const escapeHtml = (unsafe) => {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
};

// DOM 요소
const appContent = document.getElementById('app-content');
const tabItems = document.querySelectorAll('.tab-item');
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarClose = document.getElementById('sidebarClose');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebarMenuItems = document.querySelectorAll('.sidebar-menu li');

let currentLoadedModule = null;

// 모듈 동적 로드 라우터 함수
const loadModule = async (moduleName) => {
    if (currentLoadedModule === moduleName) {
        // 이미 활성화된 하단 탭을 다시 클릭한 경우 (화면 초기화 없이 onReclick 기능 실행)
        try {
            const module = await import(`../module/${moduleName}.js?v=${APP_VERSION}`);
            if (module.onReclick) module.onReclick();
        } catch(e) {}
        return; 
    }
    currentLoadedModule = moduleName;

    // 1. 클릭한 탭을 파란색(활성화)으로 변경
    tabItems.forEach(tab => {
        if(tab.dataset.module === moduleName) tab.classList.add('active');
        else tab.classList.remove('active');
    });

    // 2. 화면 초기화
    appContent.innerHTML = '<div style="text-align:center; padding: 20px;">불러오는 중...</div>';

    // 3. module 폴더에서 해당 자바스크립트 파일을 동적으로 가져와서 실행
    try {
        const module = await import(`../module/${moduleName}.js?v=${APP_VERSION}`);
        appContent.innerHTML = ''; // 로딩 텍스트 지우기
        if (module.init) module.init(appContent); // 모듈 내부의 init 함수 실행
    } catch (error) {
        console.error(`모듈 로드 실패 (${moduleName}):`, error);
        appContent.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <h2>🚧 개발 중인 메뉴입니다</h2>
                <p>${moduleName} 기능을 준비하고 있습니다.</p>
            </div>
        `;
    }
};

// 하단 탭 버튼들에 클릭 이벤트 부여
tabItems.forEach(tab => {
    tab.addEventListener('click', () => loadModule(tab.dataset.module));
});

// 사이드바 열기/닫기 함수
const toggleSidebar = () => {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('show');
};

// 사이드바 이벤트 리스너
sidebarToggle.addEventListener('click', toggleSidebar);
sidebarClose.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', toggleSidebar);

// 사이드바 메뉴 클릭 시 모듈 로드 및 사이드바 닫기
sidebarMenuItems.forEach(item => {
    item.addEventListener('click', () => {
        loadModule(item.dataset.module);
        toggleSidebar();
    });
});


// === 로그인 및 인증 상태 관리 ===
const loginScreen = document.getElementById('login-screen');
const appWrapper = document.getElementById('app-wrapper');
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');
const logoutBtn = document.querySelector('.account-btn'); // 상단 사람 아이콘

// 인증 상태 감지 (로그인/로그아웃)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // 로그인 성공 시 메인 화면 표시
        loginScreen.classList.add('hidden');
        appWrapper.classList.remove('hidden');
        loadModule('dashboard'); // 로그인 확인 후 대시보드 로드
    } else {
        // 로그아웃 상태일 때 로그인 화면 표시
        loginScreen.classList.remove('hidden');
        appWrapper.classList.add('hidden');
        currentLoadedModule = null; // 로그아웃 시 활성화 모듈 초기화
    }
});

// 로그인 폼 제출 이벤트
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    const btn = loginForm.querySelector('button');
    btn.textContent = '로그인 중...';
    btn.disabled = true;

    try {
        await signInWithEmailAndPassword(auth, loginEmail.value, loginPassword.value);
        loginForm.reset();
    } catch (error) {
        console.error("로그인 에러:", error);
        loginError.textContent = '이메일 또는 비밀번호가 올바르지 않습니다.';
    } finally {
        btn.textContent = '로그인';
        btn.disabled = false;
    }
});

// 로그아웃 이벤트 처리
logoutBtn.addEventListener('click', async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
        await signOut(auth);
        // 로그아웃 시 선택된 건물 정보 초기화
        localStorage.removeItem('selectedBuildingId');
        localStorage.removeItem('selectedBuildingName');
    }
});

// === Service Worker 등록 (PWA 지원) ===
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('ServiceWorker 등록 성공:', registration.scope);
        }).catch(error => {
            console.error('ServiceWorker 등록 실패:', error);
        });
    });
}