// Firebase SDK 모듈 가져오기
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, arrayRemove, getDocs, collection } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import CryptoJS from "https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/+esm"; // 검색 시 암호화된 나드 복호화용

// 앱 버전 (코드를 업데이트할 때마다 이 값을 변경하면 브라우저가 기존 캐시를 버리고 최신 파일을 불러옵니다)
const APP_VERSION = "20260415_03";

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

const toggleNardModeHandler = () => { document.dispatchEvent(new CustomEvent('toggleNardMode')); };

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

    const headerTitleEl = document.getElementById('currentBuildingName');
    headerTitleEl.removeEventListener('click', toggleNardModeHandler);

    // 개인 관련 탭 확인 (나드, 스케쥴, 칸반, 광장, 라이프)
    if (['nard', 'ai', 'schedule', 'kanban', 'plaza', 'life'].includes(moduleName)) {
        const titles = { nard: '나드', ai: 'AI', schedule: '스케쥴', kanban: '칸반', plaza: '광장', life: '라이프' };
        headerTitleEl.textContent = titles[moduleName];
        
        if (moduleName === 'nard') {
            headerTitleEl.style.cursor = 'pointer';
            headerTitleEl.title = "클릭하여 뷰 모드(트리/메모) 변경";
            headerTitleEl.addEventListener('click', toggleNardModeHandler);
        } else {
            headerTitleEl.style.cursor = 'default';
            headerTitleEl.title = "";
        }
    } else {
        headerTitleEl.textContent = localStorage.getItem('selectedBuildingName') || '전체 건물';
        headerTitleEl.style.cursor = 'default';
        headerTitleEl.title = "";
    }
        
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

// 상단 '+' (새 나드) 버튼 전역 이벤트 설정
const globalAddNardBtn = document.getElementById('addRootNardBtn');
if (globalAddNardBtn) {
    globalAddNardBtn.addEventListener('click', () => {
        if (currentLoadedModule === 'nard') {
            // 이미 나드 탭인 경우 바로 모달 오픈 이벤트 발생
            document.dispatchEvent(new CustomEvent('openNardModal'));
            } else if (currentLoadedModule === 'kanban') {
                // 칸반 탭인 경우 전용 모달 오픈 이벤트 발생
                document.dispatchEvent(new CustomEvent('openKanbanAddModal'));
        } else {
            // 다른 탭인 경우 나드 탭으로 이동 후 모달 오픈 (플래그 사용)
            window._triggerNewNard = true;
            const nardTab = document.querySelector('.tab-item[data-module="nard"]');
            if (nardTab) nardTab.click();
        }
    });
}


// 상단 즐겨찾기 버튼 전역 이벤트 설정
const globalNardFavBtn = document.getElementById('nardFavoriteBtn');
const nardFavModal = document.getElementById('nardFavModal');
const closeNardFavModalBtn = document.getElementById('closeNardFavModalBtn');
const nardFavResults = document.getElementById('nardFavResults');

if (globalNardFavBtn) {
    globalNardFavBtn.addEventListener('click', async () => {
        if (!auth.currentUser) return alert('로그인이 필요합니다.');
        
        nardFavModal.style.display = 'flex';
        nardFavResults.innerHTML = '<div style="text-align: center; padding: 30px 20px; color: #7f8c8d;">불러오는 중...</div>';
        
        try {
            const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
            if (userDoc.exists()) {
                const nardTree = userDoc.data().nardTree || userDoc.data().memoTree || [];
                const nardSecretKey = auth.currentUser.uid;
                let count = 0; let html = '';
                
                nardTree.forEach(item => {
                    if (item.isFavorite && item.id !== 'nard_quick_root') {
                        count++;
                        let decTitle = item.title;
                        if (item.isEncrypted) {
                            try { decTitle = CryptoJS.AES.decrypt(item.title, nardSecretKey).toString(CryptoJS.enc.Utf8); } catch(err) {}
                        }
                        html += `<div class="fav-item-row" data-id="${item.id}" style="padding: 12px 10px; border-bottom: 1px solid #eee; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='transparent'">
                            <span class="material-symbols-outlined" style="color: #f1c40f; font-variation-settings: 'FILL' 1; font-size: 20px;">star</span>
                            <div style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #2c3e50; font-size: 14px;">${escapeHtml(decTitle || '제목 없음')}</div>
                        </div>`;
                    }
                });
                
                if (count === 0) {
                    nardFavResults.innerHTML = '<div style="text-align: center; padding: 30px 20px; color: #7f8c8d;">즐겨찾기 등록된 나드가 없습니다.</div>';
                } else {
                    nardFavResults.innerHTML = html;
                    nardFavResults.querySelectorAll('.fav-item-row').forEach(row => {
                        row.addEventListener('click', (e) => {
                            const id = e.currentTarget.dataset.id;
                            nardFavModal.style.display = 'none';
                            
                            if (currentLoadedModule === 'nard') {
                                document.dispatchEvent(new CustomEvent('gotoNardItem', { detail: id }));
                            } else {
                                sessionStorage.setItem('targetHighlightNardId', id);
                                const nardTab = document.querySelector('.tab-item[data-module="nard"]');
                                if (nardTab) nardTab.click();
                            }
                        });
                    });
                }
            }
        } catch (error) {
            console.error("즐겨찾기 로드 오류:", error);
            nardFavResults.innerHTML = '<div style="color: red; text-align: center; padding: 20px;">오류가 발생했습니다.</div>';
        }
    });
}
if (closeNardFavModalBtn) closeNardFavModalBtn.addEventListener('click', () => { nardFavModal.style.display = 'none'; });

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
            let role = 'tenant';
            if (userDoc.exists()) {
                role = userDoc.data().role;
                const roleWeights = {
                    'architect': 100, 'mc_header': 90, 'mc_front': 80,
                    'mega_admin': 70, 'mega_staff': 60,
                    'building_manager': 50, 'building_exec': 40, 'tenant': 30,
                    'admin': 100, 'staff': 80
                };
                roleWeight = roleWeights[role] || 30;
                window.currentUserWeight = roleWeight; // 검색 권한 분기를 위해 전역 저장
            }
            
            const adminTabs = document.querySelectorAll('.tab-item.admin-only');
            if (roleWeight > 30) {
                adminTabs.forEach(tab => tab.style.display = 'flex');
                loadModule('dashboard'); // 관리자는 대시보드 화면을 먼저 띄움
            } else {
                adminTabs.forEach(tab => tab.style.display = 'none');
                loadModule('plaza'); // 입주민/일반 유저는 광장 화면을 먼저 띄움
            }

            const architectTabs = document.querySelectorAll('.architect-only');
            if (role === 'architect') {
                architectTabs.forEach(tab => tab.style.display = 'flex');
            } else {
                architectTabs.forEach(tab => tab.style.display = 'none');
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
        window.currentUserWeight = 0;
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

// === 사이드바 환경설정 모달 기능 ===
const settingsModal = document.getElementById('settingsModal');
const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const nardDefaultModeSelect = document.getElementById('nardDefaultModeSelect');

document.querySelector('li[data-action="settings"]')?.addEventListener('click', () => {
    nardDefaultModeSelect.value = localStorage.getItem('nardDefaultMode') || 'tree';
    settingsModal.style.display = 'flex';
    toggleSidebar(); 
});

if (closeSettingsModalBtn) closeSettingsModalBtn.addEventListener('click', () => { settingsModal.style.display = 'none'; });

if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', () => {
    localStorage.setItem('nardDefaultMode', nardDefaultModeSelect.value);
    settingsModal.style.display = 'none';
    if (currentLoadedModule === 'nard') loadModule('nard'); // 모드 변경사항 즉시 적용
});


// === AI 설정 모달 기능 ===
const loadTFJSForMain = async () => {
    if (window.tf) return true;
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js";
        script.onload = () => resolve(true);
        document.head.appendChild(script);
    });
};

const base64ToBufferMain = (base64) => {
    const binary_string = atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
};

const aiSettingsModal = document.getElementById('aiSettingsModal');
const closeAiSettingsModalBtn = document.getElementById('closeAiSettingsModalBtn');
const downloadAiModelBtn = document.getElementById('downloadAiModelBtn');

document.querySelector('li[data-action="ai_settings"]')?.addEventListener('click', async () => {
    aiSettingsModal.style.display = 'flex';
    toggleSidebar(); 
    
    const localVerEl = document.getElementById('localAiVersion');
    const serverVerEl = document.getElementById('serverAiVersion');
    
    const localVer = localStorage.getItem('user_ai_version');
    localVerEl.textContent = localVer ? new Date(parseInt(localVer)).toLocaleString('ko-KR') : '설치된 모델 없음';
    
    serverVerEl.textContent = '확인 중...';
    try {
        const modelDoc = await getDoc(doc(db, "system", "ai_model"));
        if (modelDoc.exists()) {
            const serverVer = modelDoc.data().version;
            serverVerEl.textContent = serverVer ? new Date(parseInt(serverVer)).toLocaleString('ko-KR') : '버전 정보 없음';
            
            if (!localVer) {
                downloadAiModelBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">download</span> 첫 모델 다운로드';
                downloadAiModelBtn.style.background = '#2980b9';
            } else if (localVer !== serverVer.toString()) {
                downloadAiModelBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">update</span> 최신 모델로 업데이트';
                downloadAiModelBtn.style.background = '#27ae60';
            } else {
                downloadAiModelBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">check_circle</span> 이미 최신 버전입니다';
                downloadAiModelBtn.style.background = '#95a5a6';
            }
            downloadAiModelBtn.disabled = false;
        } else {
            serverVerEl.textContent = '배포된 모델 없음';
            downloadAiModelBtn.disabled = true;
            downloadAiModelBtn.style.background = '#95a5a6';
        }
    } catch (e) {
        console.error(e);
        serverVerEl.textContent = '오류 발생';
    }
});

if (closeAiSettingsModalBtn) closeAiSettingsModalBtn.addEventListener('click', () => { aiSettingsModal.style.display = 'none'; });

if (downloadAiModelBtn) {
    downloadAiModelBtn.addEventListener('click', async () => {
        const statusEl = document.getElementById('aiDownloadStatus');
        statusEl.style.display = 'block';
        statusEl.textContent = '텐서플로우 엔진을 로드하는 중...';
        downloadAiModelBtn.disabled = true;
        downloadAiModelBtn.style.opacity = '0.5';

        try {
            await loadTFJSForMain();
            statusEl.textContent = '서버에서 모델 데이터를 가져오는 중...';
            const modelDoc = await getDoc(doc(db, "system", "ai_model"));
            if (modelDoc.exists()) {
                const data = modelDoc.data();
                
                statusEl.textContent = '모델을 기기에 설치하는 중...';
                const topology = JSON.parse(data.topology);
                const weightSpecs = JSON.parse(data.weightSpecs);
                const weightData = base64ToBufferMain(data.weightData);

                const loadedModel = await window.tf.loadLayersModel(window.tf.io.fromMemory(topology, weightSpecs, weightData));
                await loadedModel.save('indexeddb://user-ai-model');
                
                localStorage.setItem('user_ai_version', data.version.toString());
                localStorage.setItem('user_ai_meta', JSON.stringify({vocab: data.vocab, classes: data.classes, trainingData: data.trainingData}));
                
                statusEl.style.color = '#27ae60';
                statusEl.textContent = '다운로드 및 설치가 완료되었습니다!';
                document.getElementById('localAiVersion').textContent = new Date(parseInt(data.version)).toLocaleString('ko-KR');
                downloadAiModelBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">check_circle</span> 이미 최신 버전입니다';
                downloadAiModelBtn.style.background = '#95a5a6';
            } else {
                statusEl.style.color = '#e74c3c';
                statusEl.textContent = '배포된 모델을 찾을 수 없습니다.';
            }
        } catch (e) {
            console.error(e);
            statusEl.style.color = '#e74c3c';
            statusEl.textContent = '오류 발생: ' + e.message;
        } finally {
            downloadAiModelBtn.disabled = false;
            downloadAiModelBtn.style.opacity = '1';
            setTimeout(() => {
                statusEl.style.display = 'none';
                statusEl.style.color = '#f39c12';
            }, 5000);
        }
    });
}

// === 통합 검색 모달 기능 ===
const globalSearchBtn = document.getElementById('globalSearchBtn');
const searchModal = document.getElementById('searchModal');
const closeSearchModalBtn = document.getElementById('closeSearchModalBtn');
const searchInput = document.getElementById('searchInput');
const adminSearchOptions = document.getElementById('adminSearchOptions');
const searchResults = document.getElementById('searchResults');

if (globalSearchBtn) {
    globalSearchBtn.addEventListener('click', () => {
        searchModal.style.display = 'flex';
        searchInput.value = '';
        searchResults.innerHTML = '<div style="text-align: center; padding: 20px; color: #95a5a6;">검색어를 입력 후 엔터를 누르세요.</div>';
        
        // 관리자/직원 등급일 경우 상세 검색 옵션 표시 (건물, 입주자)
        if (window.currentUserWeight > 30) {
            adminSearchOptions.style.display = 'flex';
        } else {
            adminSearchOptions.style.display = 'none';
            document.querySelector('input[name="searchScope"][value="nard"]').checked = true;
        }
        setTimeout(() => searchInput.focus(), 100);
    });
}

if (closeSearchModalBtn) closeSearchModalBtn.addEventListener('click', () => { searchModal.style.display = 'none'; });

if (searchInput) {
    searchInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            const keyword = searchInput.value.trim();
            if (!keyword) return alert("검색어를 입력하세요.");
            
            const scope = document.querySelector('input[name="searchScope"]:checked').value;
            searchResults.innerHTML = '<div style="text-align: center; padding: 20px; color: #7f8c8d;">검색 중...</div>';
            
            try {
                let html = '';
                if (scope === 'nard') {
                    const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
                    if (userDoc.exists()) {
                        const nardTree = userDoc.data().nardTree || userDoc.data().memoTree || [];
                        const nardSecretKey = auth.currentUser.uid;
                        let count = 0;
                        
                        nardTree.forEach(item => {
                            let decTitle = item.title;
                            let decContent = item.content;
                            if (item.isEncrypted) {
                                try {
                                    decTitle = CryptoJS.AES.decrypt(item.title, nardSecretKey).toString(CryptoJS.enc.Utf8);
                                    if (item.content) decContent = CryptoJS.AES.decrypt(item.content, nardSecretKey).toString(CryptoJS.enc.Utf8);
                                } catch(err) {}
                            }
                            
                            if ((decTitle && decTitle.includes(keyword)) || (decContent && decContent.includes(keyword))) {
                                count++;
                                html += `<div style="padding: 10px; border-bottom: 1px solid #eee; cursor: pointer;" onclick="document.getElementById('closeSearchModalBtn').click(); document.querySelector('.tab-item[data-module=\\'nard\\']').click();"><strong style="color: #2c3e50;">📝 ${escapeHtml(decTitle)}</strong><div style="font-size: 12px; color: #7f8c8d; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(decContent || '')}</div></div>`;
                            }
                        });
                        if (count === 0) html = '<div style="text-align: center; padding: 20px; color: #7f8c8d;">검색 결과가 없습니다.</div>';
                    }
                } else if (scope === 'building') {
                    const bSnap = await getDocs(collection(db, "buildings"));
                    bSnap.forEach(bDoc => {
                        const bData = bDoc.data();
                        if (bData.name.includes(keyword) || bData.address.includes(keyword)) {
                            html += `<div style="padding: 10px; border-bottom: 1px solid #eee; cursor: pointer;" onclick="localStorage.setItem('selectedBuildingId', '${bDoc.id}'); localStorage.setItem('selectedBuildingName', '${escapeHtml(bData.name)}'); document.getElementById('currentBuildingName').textContent = '${escapeHtml(bData.name)}'; document.getElementById('closeSearchModalBtn').click(); document.querySelector('.tab-item[data-module=\\'dashboard\\']').click();"><strong style="color: #2980b9;">🏢 ${escapeHtml(bData.name)}</strong><div style="font-size: 12px; color: #7f8c8d;">${escapeHtml(bData.address)}</div></div>`;
                        }
                    });
                    if (html === '') html = '<div style="text-align: center; padding: 20px; color: #7f8c8d;">검색 결과가 없습니다.</div>';
                } else if (scope === 'tenant') {
                    const uSnap = await getDocs(collection(db, "users"));
                    uSnap.forEach(uDoc => {
                        const uData = uDoc.data();
                        if ((uData.name && uData.name.includes(keyword)) || (uData.email && uData.email.includes(keyword)) || (uData.phone && uData.phone.includes(keyword))) {
                            html += `<div style="padding: 10px; border-bottom: 1px solid #eee; cursor: pointer;" onclick="document.getElementById('closeSearchModalBtn').click(); document.querySelector('.tab-item[data-module=\\'member_manage\\']').click();"><strong style="color: #27ae60;">👤 ${escapeHtml(uData.name)}</strong> <span style="font-size: 11px; color: #95a5a6;">(${uData.role})</span><div style="font-size: 12px; color: #7f8c8d;">${escapeHtml(uData.email)} / ${escapeHtml(uData.phone || '연락처 없음')}</div></div>`;
                        }
                    });
                    if (html === '') html = '<div style="text-align: center; padding: 20px; color: #7f8c8d;">검색 결과가 없습니다.</div>';
                }
                searchResults.innerHTML = html;
            } catch (error) {
                console.error("검색 오류:", error);
                searchResults.innerHTML = '<div style="color: red; text-align: center; padding: 20px;">검색 중 오류가 발생했습니다.</div>';
            }
        }
    });
}

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
const sidebarInstallBtn = document.getElementById('sidebarInstallBtn');

// 앱이 이미 설치되어 실행 중인지 확인 (Standalone 모드)
const isAppInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

// PWA로 실행 중이 아니라면(일반 브라우저 접속이라면) 무조건 설치 버튼 표시
if (!isAppInstalled) {
    if (sidebarInstallBtn) sidebarInstallBtn.classList.remove('hidden');
}

// 브라우저가 PWA 설치 요구사항을 만족했다고 판단하면 발생하는 이벤트
window.addEventListener('beforeinstallprompt', (e) => {
    // 기본 제공되는 설치 안내 미니 바 방지
    e.preventDefault();
    // 이벤트를 보관해두었다가 나중에 버튼 클릭 시 실행
    deferredPrompt = e;
});

const installApp = async () => {
    if (!deferredPrompt) {
        alert("현재 환경에서는 자동 설치가 지원되지 않습니다.\n\n[수동 설치 방법]\n- Android: 브라우저 우측 상단 메뉴(⋮) > '홈 화면에 추가' 또는 '앱 설치'\n- iOS (Safari): 하단 공유 버튼(⍐) > '홈 화면에 추가'");
        return;
    }
    // 보관했던 설치 프롬프트 창 띄우기
    deferredPrompt.prompt();
    // 사용자가 설치를 수락했는지 무시했는지 확인
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
        if (sidebarInstallBtn) sidebarInstallBtn.classList.add('hidden');
    }
    deferredPrompt = null; // 한 번 사용한 이벤트는 폐기
};

// 버튼 클릭 시 설치 프롬프트 띄우기 연결
if (sidebarInstallBtn) sidebarInstallBtn.addEventListener('click', installApp);

// 브라우저 메뉴 등을 통해 앱이 설치되었을 때의 처리
window.addEventListener('appinstalled', () => {
    if (sidebarInstallBtn) sidebarInstallBtn.classList.add('hidden');
    deferredPrompt = null;
});
}
