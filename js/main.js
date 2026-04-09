// Firebase SDK 모듈 가져오기
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

// 모듈 캐시 버저닝으로 인해 main.js가 두 번 실행되더라도 이벤트가 중복 등록되지 않도록 방어
if (!window._isMainInitialized) {
    window._isMainInitialized = true;

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
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // 로그인 성공 시 메인 화면 표시
        loginScreen.classList.add('hidden');
        appWrapper.classList.remove('hidden');
        
        // 사용자 권한 확인 및 탭 필터링
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            let roleWeight = 30; // 기본값 (일반 입주자)
            if (userDoc.exists()) {
                const role = userDoc.data().role;
                const roleWeights = {
                    'architect': 100, 'mc_header': 90, 'mc_front': 80,
                    'mega_admin': 70, 'mega_staff': 60,
                    'building_manager': 50, 'building_exec': 40, 'tenant': 30,
                    'admin': 100, 'staff': 80
                };
                roleWeight = roleWeights[role] || 30;
            }
            
            const adminTabs = document.querySelectorAll('.tab-item.admin-only');
            if (roleWeight > 30) {
                adminTabs.forEach(tab => tab.style.display = 'flex');
                loadModule('dashboard'); // 관리자는 대시보드 화면을 먼저 띄움
            } else {
                adminTabs.forEach(tab => tab.style.display = 'none');
                loadModule('plaza'); // 입주민/일반 유저는 광장 화면을 먼저 띄움
            }
        } catch (e) {
            console.error("권한 확인 실패:", e);
            loadModule('plaza');
        }
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

// === 멀티 프로필 및 계정 관리 모달 처리 ===
const accountModal = document.getElementById('accountModal');
const closeAccountModalBtn = document.getElementById('closeAccountModalBtn');
const modalLogoutBtn = document.getElementById('modalLogoutBtn');
const addProfileBtn = document.getElementById('addProfileBtn');
const profileList = document.getElementById('profileList');

const renderProfiles = async () => {
    if (!auth.currentUser) return;
    
    const defaultName = auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
    document.getElementById('accountModalName').textContent = defaultName;
    document.getElementById('accountModalEmail').textContent = auth.currentUser.email;

    profileList.innerHTML = '<li style="text-align:center; font-size:12px; color:#7f8c8d;">불러오는 중...</li>';

    try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        let profiles = [];
        if (userDoc.exists() && userDoc.data().profiles) {
            profiles = userDoc.data().profiles;
        }

        const activeProfile = localStorage.getItem('activeProfileName') || defaultName;
        let html = '';
        
        // 기본 계정 프로필 항목
        const isMainActive = activeProfile === defaultName;
        html += `
            <li style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border: 1px solid ${isMainActive ? '#3498db' : '#e0e0e0'}; background: ${isMainActive ? '#e8f4f8' : '#fff'}; border-radius: 8px;">
                <div style="font-size: 13px; font-weight: bold; color: #2c3e50;">${escapeHtml(defaultName)} <span style="font-size:10px; color:#7f8c8d; font-weight:normal;">(본계정)</span></div>
                ${isMainActive ? '<span style="font-size: 11px; background: #2980b9; color: white; padding: 2px 6px; border-radius: 4px;">적용중</span>' : `<button class="set-profile-btn" data-name="${escapeHtml(defaultName)}" style="background: #f0f3f4; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">선택</button>`}
            </li>
        `;

        // 추가된 멀티 프로필 항목
        profiles.forEach(p => {
            const isActive = activeProfile === p;
            html += `
                <li style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border: 1px solid ${isActive ? '#3498db' : '#e0e0e0'}; background: ${isActive ? '#e8f4f8' : '#fff'}; border-radius: 8px;">
                    <div style="font-size: 13px; font-weight: bold; color: #2c3e50;">${escapeHtml(p)}</div>
                    <div style="display: flex; gap: 5px;">
                        ${isActive ? '<span style="font-size: 11px; background: #2980b9; color: white; padding: 2px 6px; border-radius: 4px;">적용중</span>' : `<button class="set-profile-btn" data-name="${escapeHtml(p)}" style="background: #f0f3f4; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">선택</button>`}
                        <button class="del-profile-btn" data-name="${escapeHtml(p)}" style="background: #fadbd8; color: #c0392b; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">삭제</button>
                    </div>
                </li>
            `;
        });

        profileList.innerHTML = html;

        profileList.querySelectorAll('.set-profile-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                localStorage.setItem('activeProfileName', e.target.dataset.name);
                renderProfiles();
            });
        });

        profileList.querySelectorAll('.del-profile-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm(`'${e.target.dataset.name}' 프로필을 삭제하시겠습니까?`)) {
                    await updateDoc(doc(db, "users", auth.currentUser.uid), {
                        profiles: arrayRemove(e.target.dataset.name)
                    });
                    if (localStorage.getItem('activeProfileName') === e.target.dataset.name) {
                        localStorage.removeItem('activeProfileName');
                    }
                    renderProfiles();
                }
            });
        });

    } catch (e) {
        console.error("프로필 로드 에러:", e);
        profileList.innerHTML = '<li style="text-align:center; font-size:12px; color:#e74c3c;">오류가 발생했습니다.</li>';
    }
};

logoutBtn.addEventListener('click', () => {
    if (auth.currentUser) {
        accountModal.style.display = 'flex';
        renderProfiles();
    }
});

closeAccountModalBtn.addEventListener('click', () => { accountModal.style.display = 'none'; });

modalLogoutBtn.addEventListener('click', async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
        await signOut(auth);
        localStorage.removeItem('selectedBuildingId');
        localStorage.removeItem('selectedBuildingName');
        localStorage.removeItem('activeProfileName');
        accountModal.style.display = 'none';
    }
});

addProfileBtn.addEventListener('click', async () => {
    const newName = prompt('새로운 프로필 닉네임을 입력하세요:');
    if (newName && newName.trim()) {
        try {
            await updateDoc(doc(db, "users", auth.currentUser.uid), {
                profiles: arrayUnion(newName.trim())
            });
            renderProfiles();
        } catch (error) {
            console.error("프로필 추가 에러:", error);
            alert("프로필 추가에 실패했습니다.");
        }
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

// === PWA 설치(홈 화면에 추가) 프롬프트 제어 ===
let deferredPrompt;
const installAppBtn = document.getElementById('installAppBtn');
const sidebarInstallBtn = document.getElementById('sidebarInstallBtn');

// 브라우저가 PWA 설치 요구사항을 만족했다고 판단하면 발생하는 이벤트
window.addEventListener('beforeinstallprompt', (e) => {
    // 기본 제공되는 설치 안내 미니 바 방지
    e.preventDefault();
    // 이벤트를 보관해두었다가 나중에 버튼 클릭 시 실행
    deferredPrompt = e;
    // 다운로드 버튼들을 화면에 표시
    if (installAppBtn) installAppBtn.classList.remove('hidden');
    if (sidebarInstallBtn) sidebarInstallBtn.classList.remove('hidden');
});

const installApp = async () => {
    if (!deferredPrompt) return;
    // 보관했던 설치 프롬프트 창 띄우기
    deferredPrompt.prompt();
    // 사용자가 설치를 수락했는지 무시했는지 확인
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
        if (installAppBtn) installAppBtn.classList.add('hidden'); // 설치 수락 시 버튼 숨김
        if (sidebarInstallBtn) sidebarInstallBtn.classList.add('hidden');
    }
    deferredPrompt = null; // 한 번 사용한 이벤트는 폐기
};

// 버튼 클릭 시 설치 프롬프트 띄우기 연결
if (installAppBtn) installAppBtn.addEventListener('click', installApp);
if (sidebarInstallBtn) sidebarInstallBtn.addEventListener('click', installApp);

// 브라우저 메뉴 등을 통해 앱이 설치되었을 때의 처리
window.addEventListener('appinstalled', () => {
    if (installAppBtn) installAppBtn.classList.add('hidden');
    if (sidebarInstallBtn) sidebarInstallBtn.classList.add('hidden');
    deferredPrompt = null;
});
}
