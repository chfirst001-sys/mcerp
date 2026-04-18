import { collection, getDocs, query, where, setDoc, doc, serverTimestamp, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { db, auth, app, escapeHtml } from "../js/main.js";

// 시스템 전체에서 제어할 리소스(메뉴, 기능) 목록 사전
const PERMISSION_RESOURCES = {
    "메뉴 접근 권한 (하단 탭)": [
        { id: "view_dashboard", name: "대시보드 탭" },
        { id: "view_facility", name: "시설관리 탭" },
        { id: "view_accounting", name: "회계관리 탭" },
        { id: "view_tenant", name: "입주민관리 탭" },
        { id: "view_document", name: "문서 탭" },
        { id: "view_ai_studio", name: "AI 학습 스튜디오 탭" },
        { id: "view_nard", name: "나드 탭" },
        { id: "view_schedule", name: "스케쥴 탭" },
        { id: "view_kanban", name: "칸반 탭" },
        { id: "view_plaza", name: "광장 탭" },
        { id: "view_life", name: "라이프 탭" }
    ],
    "메뉴 접근 권한 (사이드바)": [
        { id: "view_building_select", name: "건물선택" },
        { id: "view_building_register", name: "건물등록" },
        { id: "view_member_manage", name: "회원관리" },
        { id: "view_db_manage", name: "시스템DB" },
        { id: "view_local_db", name: "로컬DB" },
        { id: "view_settings", name: "앱 환경 설정" },
        { id: "view_ai_settings", name: "AI 모델 설정" }
    ],
    "세부 기능 및 데이터 권한": [
        { id: "edit_accounting", name: "회계/관리비 부과 확정 및 수정" },
        { id: "edit_facility", name: "시설물 및 협력업체 정보 수정" },
        { id: "execute_ai_trigger", name: "AI 트리거 및 시스템 액션 실행 (AI 명령 수행)" },
        { id: "write_notice", name: "광장 공지사항 작성" },
        { id: "view_all_tenant_info", name: "타 세대 개인정보 전체 조회" }
    ]
};

// 직책 영문 코드를 한글로 변환하는 매핑 객체
const roleMap = {
    'architect': '1.설계자',
    'mc_header': '2.MC헤더',
    'mc_front': '3.MC프론트',
    'mega_admin': '4.메가관리자',
    'mega_staff': '5.메가직원',
    'building_manager': '6.관리인',
    'building_exec': '7.임원',
    'tenant': '8.입주자'
};

export const init = async (container) => {
    const user = auth.currentUser;
    if (!user) {
        container.innerHTML = '<div style="padding: 50px; text-align: center; color: #e74c3c;">로그인이 필요합니다.</div>';
        return;
    }

    // 2차 보안: 로그인 비밀번호 재확인
    const userPwd = prompt("회원 계정 관리(보안 구역)에 접근하려면 현재 로그인된 계정의 비밀번호를 입력하세요.");
    if (!userPwd) {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: calc(100vh - 120px); background: #f8f9fa;">
                <span class="material-symbols-outlined" style="font-size: 64px; color: #e74c3c; margin-bottom: 20px;">lock</span>
                <h2 style="color: #2c3e50; margin: 0 0 10px 0;">보안 구역 접근 차단</h2>
                <p style="color: #7f8c8d; margin: 0;">비밀번호 입력을 취소하여 접근이 제한되었습니다.</p>
            </div>
        `;
        return;
    }

    try {
        const credential = EmailAuthProvider.credential(user.email, userPwd);
        await reauthenticateWithCredential(user, credential);
    } catch (error) {
        console.error("보안 인증 에러:", error);
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: calc(100vh - 120px); background: #f8f9fa;">
                <span class="material-symbols-outlined" style="font-size: 64px; color: #e74c3c; margin-bottom: 20px;">lock</span>
                <h2 style="color: #2c3e50; margin: 0 0 10px 0;">보안 구역 접근 차단</h2>
                <p style="color: #7f8c8d; margin: 0;">비밀번호가 일치하지 않거나 인증 오류가 발생했습니다.</p>
            </div>
        `;
        return;
    }

    let currentUserRole = 'tenant';
    let currentUserWeight = 30;
    let currentMainTab = 'member'; // 'member' or 'permission'
    let selectedRoleForPerm = 'building_manager'; // 권한 관리 탭에서 현재 선택된 직책
    let rolePermissions = {}; // Firestore에서 불러온 권한 설정값
    
    const roleWeights = {
        'architect': 100, 'mc_header': 90, 'mc_front': 80,
        'mega_admin': 70, 'mega_staff': 60,
        'building_manager': 50, 'building_exec': 40, 'tenant': 30,
        'admin': 100, 'staff': 80 // 기존 데이터 호환용
    };

    // 현재 접속한 유저의 권한 정보 불러오기
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
        currentUserRole = userDoc.data().role;
        currentUserWeight = roleWeights[currentUserRole] || 30;
    }

    // 권한 설정 데이터 불러오기 (없으면 빈 객체)
    try {
        const permDoc = await getDoc(doc(db, "system", "permissions"));
        if (permDoc.exists()) {
            rolePermissions = permDoc.data().roles || {};
        }
    } catch (e) { console.error("권한 설정 로드 실패:", e); }

    container.innerHTML = `
        <style>
            .main-tab-btn { flex: 1; padding: 12px; border: none; font-size: 15px; font-weight: bold; cursor: pointer; border-bottom: 3px solid transparent; background: transparent; color: #7f8c8d; transition: 0.2s; }
            .main-tab-btn.active { color: #2980b9; border-bottom-color: #2980b9; }
            .perm-radio-label { display: flex; align-items: center; gap: 4px; font-size: 13px; cursor: pointer; }
            .perm-row { display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px dashed #eee; transition: background 0.2s; }
            .perm-row:hover { background: #f8f9fa; }
        </style>

        <!-- 최상위 메인 탭 -->
        <div style="display: flex; margin-bottom: 20px; border-bottom: 1px solid #ddd; background: white; position: sticky; top: 0; z-index: 10;">
            <button class="main-tab-btn active" data-target="member">👥 회원 계정 관리</button>
            <button class="main-tab-btn" data-target="permission">🛡️ 직책별 권한 설정</button>
        </div>

        <!-- [1] 회원 계정 관리 화면 -->
        <div id="tabContent-member">
            <!-- 소속별 보기 탭 -->
            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <button id="tabStaff" style="flex: 1; background-color: #2c3e50; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer;">MC 본사</button>
                <button id="tabMega" style="flex: 1; background-color: #95a5a6; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer;">관리회사</button>
                <button id="tabTenant" style="flex: 1; background-color: #95a5a6; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer;">입주자</button>
            </div>

            <!-- 계정 등록 폼 -->
            <div id="addMemberFormContainer">
                <h3 style="margin-top: 0;">새 계정 등록</h3>
                <form id="addMemberForm">
                    <select id="memberRole" style="margin-bottom: 10px; padding: 10px; width: 100%; max-width: 300px; border: 1px solid #ccc; border-radius: 4px;">
                    </select><br>
                    <div id="megaAdminSelectGroup" style="display: none; margin-bottom: 10px;">
                        <select id="memberMegaAdmin" style="padding: 10px; width: 100%; max-width: 300px; border: 1px solid #ccc; border-radius: 4px;">
                            <option value="">소속 관리회사 선택</option>
                        </select>
                    </div>
                    <div id="buildingSelectGroup" style="display: none; margin-bottom: 10px;">
                        <select id="memberBuilding" style="padding: 10px; width: 100%; max-width: 300px; border: 1px solid #ccc; border-radius: 4px;">
                            <option value="">소속 건물 선택</option>
                        </select>
                    </div>
                    <div id="roomSelectGroup" style="display: none; margin-bottom: 10px;">
                        <select id="memberRoom" style="padding: 10px; width: 100%; max-width: 300px; border: 1px solid #ccc; border-radius: 4px;">
                            <option value="">소속 호수 선택</option>
                        </select>
                    </div>
                    <input type="text" id="memberName" placeholder="이름" required><br>
                    <input type="email" id="memberEmail" placeholder="이메일 (로그인 ID)" required><br>
                    <input type="password" id="memberPassword" placeholder="비밀번호 (6자리 이상)" required minlength="6"><br>
                    <input type="text" id="memberPhone" placeholder="연락처"><br>
                    <button type="submit" id="submitAddMemberBtn">계정 생성 및 추가</button>
                </form>
            </div>

            <!-- 계정 목록 -->
            <div>
                <h3 id="listTitle" style="margin-top: 0;">MC 본사 계정 목록</h3>
                <ul id="memberList" style="list-style-type: none; padding: 0;">
                    <li style="padding: 10px; border-bottom: 1px solid #eee;">데이터를 불러오는 중...</li>
                </ul>
            </div>
        </div>

        <!-- [2] 직책별 권한 설정 화면 (RBAC 제어판) -->
        <div id="tabContent-permission" style="display: none;">
            <div style="background: #e8f4f8; border: 1px solid #bce0fd; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <label style="font-weight: bold; color: #2980b9; display: block; margin-bottom: 8px;">설정할 대상 직책 선택</label>
                <select id="permRoleSelect" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; outline: none;"></select>
                <p style="font-size: 11px; color: #7f8c8d; margin: 8px 0 0 0;">선택한 직책이 앱 내에서 접근하거나 실행할 수 있는 권한을 매트릭스 형태로 설정합니다.</p>
            </div>

            <div id="permissionMatrixContainer" style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); padding: 15px; margin-bottom: 20px;">
                <!-- 권한 설정 UI가 여기에 동적으로 렌더링됩니다 -->
            </div>

            <button id="savePermissionsBtn" style="width: 100%; background: #27ae60; color: white; border: none; padding: 14px; border-radius: 6px; font-size: 15px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">권한 설정 저장</button>
        </div>

        <!-- 수정 모달 (기본 숨김) -->
        <div id="editModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 6000; justify-content: center; align-items: center;">
            <div style="background: white; padding: 25px; border-radius: 12px; width: 90%; max-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
                <h3 style="margin-top: 0;">회원 정보 수정</h3>
                <input type="hidden" id="editUid">
                <label style="font-size: 12px; color: #7f8c8d;">권한</label>
                <select id="editRole" style="margin-bottom: 10px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px;">
                </select><br>
                <label style="font-size: 12px; color: #7f8c8d;">이름</label>
                <input type="text" id="editName" placeholder="이름" required style="margin-bottom: 10px; padding: 10px; width: 100%; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px;"><br>
                <label style="font-size: 12px; color: #7f8c8d;">연락처</label>
                <input type="text" id="editPhone" placeholder="연락처" style="margin-bottom: 20px; padding: 10px; width: 100%; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px;"><br>
                <div id="editRoomGroup" style="display: none;">
                    <label style="font-size: 12px; color: #7f8c8d;">호수</label>
                    <input type="text" id="editRoom" placeholder="호수 (예: 101)" style="margin-bottom: 20px; padding: 10px; width: 100%; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px;"><br>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="saveEditBtn" style="flex: 1; background: #2980b9; padding: 12px;">저장</button>
                    <button id="cancelEditBtn" style="flex: 1; background: #95a5a6; padding: 12px;">취소</button>
                    </div>
            </div>
        </div>
    `;

    // 메인 탭 전환 로직
    const mainTabs = container.querySelectorAll('.main-tab-btn');
    mainTabs.forEach(btn => {
        btn.addEventListener('click', (e) => {
            mainTabs.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentMainTab = e.target.dataset.target;
            document.getElementById('tabContent-member').style.display = currentMainTab === 'member' ? 'block' : 'none';
            document.getElementById('tabContent-permission').style.display = currentMainTab === 'permission' ? 'block' : 'none';
        });
    });

    // 입주자, 임원의 경우 계정 등록 폼 숨기기
    if (currentUserWeight <= 40) {
        document.getElementById('addMemberFormContainer').style.display = 'none';
    }

    const tabStaff = document.getElementById('tabStaff');
    const tabMega = document.getElementById('tabMega');
    const tabTenant = document.getElementById('tabTenant');
    const listTitle = document.getElementById('listTitle');
    const memberList = document.getElementById('memberList');
    let currentRoleTab = 'staff'; // 현재 선택된 탭 추적용

    
    // 역할(Role)에 따라 계정 목록 불러오기 함수
    const loadMemberList = async (roleType) => {
        memberList.innerHTML = '<li style="padding: 10px; border-bottom: 1px solid #eee;">데이터를 불러오는 중...</li>';
        try {
            let q;
            if (roleType === 'staff') {
                q = query(collection(db, "users"), where("role", "in", ["architect", "mc_header", "mc_front", "admin", "staff"]));
            } else if (roleType === 'mega') {
                q = query(collection(db, "users"), where("role", "in", ["mega_admin", "mega_staff"]));
            } else {
                q = query(collection(db, "users"), where("role", "in", ["building_manager", "building_exec", "tenant"]));
            }

            const querySnapshot = await getDocs(q);
            memberList.innerHTML = '';

            if (querySnapshot.empty) {
                memberList.innerHTML = '<li style="padding: 10px;">등록된 계정이 없습니다.</li>';
                return;
            }

            querySnapshot.forEach((docSnap) => {
                const user = docSnap.data();
                const li = document.createElement('li');
                li.style.cssText = 'padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;';
                li.innerHTML = `
                    <div>
                    <strong>${escapeHtml(user.name)}</strong> <span style="font-size: 13px; color: #7f8c8d;">(${escapeHtml(user.email)})</span>
                        <span style="font-size: 12px; background: #e8f4f8; color: #2980b9; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">${roleMap[user.role] || user.role}</span>
                    ${user.buildingName ? `<div style="font-size: 12px; color: #27ae60; margin-top: 4px; font-weight: bold;">🏢 건물: ${escapeHtml(user.buildingName)}</div>` : ''}
                    ${user.megaAdminName ? `<div style="font-size: 12px; color: #8e44ad; margin-top: 4px; font-weight: bold;">🏢 관리회사: ${escapeHtml(user.megaAdminName)}</div>` : ''}
                    <div style="font-size: 12px; color: #95a5a6; margin-top: 4px;">연락처: ${escapeHtml(user.phone || '없음')}</div>
                    </div>
                    <div style="display: flex; gap: 5px; flex-direction: column;">
                        <button class="edit-btn" style="background: #f39c12; padding: 5px 10px; font-size: 12px; border-radius: 4px;">정보 수정</button>
                        <button class="reset-pw-btn" style="background: #e74c3c; padding: 5px 10px; font-size: 12px; border-radius: 4px;">PW 초기화</button>
                    </div>
                `;
                li.querySelector('.edit-btn').addEventListener('click', () => openEditModal(user));
                li.querySelector('.reset-pw-btn').addEventListener('click', () => sendResetEmail(user.email));
                memberList.appendChild(li);
            });
        } catch (error) {
            console.error("목록 조회 실패:", error);
            memberList.innerHTML = '<li style="color:red; padding: 10px;">목록을 불러오지 못했습니다.</li>';
        }
    };

    // 선택된 탭에 따라 등록 가능한 직책(Role) 옵션 동적 변경
    const updateRoleDropdown = (type) => {
        const roleEl = document.getElementById('memberRole');
        const submitBtn = document.getElementById('submitAddMemberBtn');
        if (!roleEl) return;

        let optionsHtml = '';
        const addOption = (val, text) => {
            if (currentUserWeight >= roleWeights[val]) {
                optionsHtml += `<option value="${val}">${text}</option>`;
            }
        };

        if (type === 'staff') {
            addOption('architect', '1. 설계자 (프로젝트 총관리자)');
            addOption('mc_header', '2. MC헤더 (MC본사팀장)');
            addOption('mc_front', '3. MC프론트 (MC직원)');
        } else if (type === 'mega') {
            addOption('mega_admin', '4. 메가관리자 (관리회사)');
            addOption('mega_staff', '5. 메가직원 (관리회사직원)');
        } else {
            addOption('building_manager', '6. 관리인 (건물입주자대표)');
            addOption('building_exec', '7. 임원 (건물임원)');
            addOption('tenant', '8. 일반 입주자');
        }

        if (optionsHtml === '') {
            optionsHtml = '<option value="">생성 권한 없음</option>';
            roleEl.disabled = true;
            if(submitBtn) submitBtn.disabled = true;
        } else {
            roleEl.disabled = false;
            if(submitBtn) submitBtn.disabled = false;
        }
        
        roleEl.innerHTML = optionsHtml;
        roleEl.dispatchEvent(new Event('change')); // 건물 선택 드롭다운 표시/숨김 갱신
    };

    // 탭 UI 전환 이벤트
    const switchTab = (tabName) => {
        tabStaff.style.backgroundColor = tabName === 'staff' ? '#2c3e50' : '#95a5a6';
        tabMega.style.backgroundColor = tabName === 'mega' ? '#2c3e50' : '#95a5a6';
        tabTenant.style.backgroundColor = tabName === 'tenant' ? '#2c3e50' : '#95a5a6';
        
        if (tabName === 'staff') listTitle.textContent = 'MC 본사 계정 목록';
        else if (tabName === 'mega') listTitle.textContent = '관리회사 계정 목록';
        else listTitle.textContent = '입주자 목록';
        
        currentRoleTab = tabName;
        loadMemberList(tabName);
        updateRoleDropdown(tabName);
    };

    tabStaff.addEventListener('click', () => switchTab('staff'));
    tabMega.addEventListener('click', () => switchTab('mega'));
    tabTenant.addEventListener('click', () => switchTab('tenant'));

    const memberRoleEl = document.getElementById('memberRole');
    const megaAdminSelectGroup = document.getElementById('megaAdminSelectGroup');
    const memberMegaAdminEl = document.getElementById('memberMegaAdmin');
    const buildingSelectGroup = document.getElementById('buildingSelectGroup');
    const memberBuildingEl = document.getElementById('memberBuilding');
    const roomSelectGroup = document.getElementById('roomSelectGroup');
    const memberRoomEl = document.getElementById('memberRoom');

    // 직책 선택 시 소속 건물 선택창 표시 여부 처리
    memberRoleEl.addEventListener('change', (e) => {
        const role = e.target.value;

        // 소속 관리회사가 필요한 직책 (메가직원)
        if (role === 'mega_staff') {
            megaAdminSelectGroup.style.display = 'block';
            memberMegaAdminEl.required = true;
        } else {
            megaAdminSelectGroup.style.display = 'none';
            memberMegaAdminEl.required = false;
            memberMegaAdminEl.value = '';
        }

        // 소속 건물이 필요한 직책 (관리인, 임원, 일반 입주자)
        if (['tenant', 'building_manager', 'building_exec'].includes(role)) {
            buildingSelectGroup.style.display = 'block';
            memberBuildingEl.required = true;
        } else {
            buildingSelectGroup.style.display = 'none';
            memberBuildingEl.required = false;
            memberBuildingEl.value = '';
            memberRoomEl.innerHTML = '<option value="">소속 호수 선택</option>';
            memberRoomEl.value = '';
        }

        // 호수 입력창이 필요한 직책 (일반 입주자)
        if (role === 'tenant') {
            roomSelectGroup.style.display = 'block';
        } else {
            roomSelectGroup.style.display = 'none';
            memberRoomEl.innerHTML = '<option value="">소속 호수 선택</option>';
            memberRoomEl.value = '';
        }
    });

    // 건물 선택 시 해당 건물의 호수 목록을 불러와서 select 옵션에 채우기
    memberBuildingEl.addEventListener('change', async (e) => {
        const bId = e.target.value;
        memberRoomEl.innerHTML = '<option value="">소속 호수 선택</option>';
        if (bId) {
            try {
                const docSnap = await getDoc(doc(db, "buildings", bId));
                if (docSnap.exists()) {
                    const bData = docSnap.data();
                    const rooms = bData.roomsList || [];
                    rooms.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                    rooms.forEach(room => {
                        const opt = document.createElement('option');
                        opt.value = room;
                        opt.textContent = room.endsWith('호') ? room : room + '호';
                        memberRoomEl.appendChild(opt);
                    });
                }
            } catch (err) {
                console.error("호수 목록 로드 실패:", err);
            }
        }
    });

    // 메가관리자(관리회사) 목록 불러와서 select 옵션에 채우기
    const loadMegaAdminsForSelect = async () => {
        try {
            memberMegaAdminEl.innerHTML = '<option value="">소속 관리회사 선택</option>';
            const q = query(collection(db, "users"), where("role", "==", "mega_admin"));
            const snap = await getDocs(q);
            snap.forEach(docSnap => {
                const u = docSnap.data();
                const opt = document.createElement('option');
                opt.value = u.uid;
                opt.textContent = u.name;
                memberMegaAdminEl.appendChild(opt);
            });
        } catch (error) {
            console.error("관리회사 목록 로드 실패:", error);
        }
    };
    loadMegaAdminsForSelect();

    // 등록된 건물 목록 불러와서 select 옵션에 채우기
    const loadBuildingsForSelect = async () => {
        try {
            const q = query(collection(db, "buildings"));
            const snap = await getDocs(q);
            snap.forEach(docSnap => {
                const b = docSnap.data();
                const opt = document.createElement('option');
                opt.value = docSnap.id;
                opt.textContent = b.name;
                memberBuildingEl.appendChild(opt);
            });
        } catch (error) {
            console.error("건물 목록 로드 실패:", error);
        }
    };
    loadBuildingsForSelect();

    // === 권한 설정 (RBAC) 렌더링 로직 ===
    const permRoleSelect = document.getElementById('permRoleSelect');
    
    // 권한 설정 대상 직책 옵션 채우기 (자신의 권한 이하만 설정 가능하도록 제한 가능)
    for (const [rCode, rName] of Object.entries(roleMap)) {
        const opt = document.createElement('option');
        opt.value = rCode; opt.textContent = rName;
        permRoleSelect.appendChild(opt);
    }
    permRoleSelect.value = selectedRoleForPerm;

    const renderPermissionUI = () => {
        const container = document.getElementById('permissionMatrixContainer');
        const currentPerms = rolePermissions[selectedRoleForPerm] || {};
        
        let html = '';
        for (const [category, resources] of Object.entries(PERMISSION_RESOURCES)) {
            html += `<h4 style="color: #2c3e50; margin: 15px 0 10px 0; padding-bottom: 5px; border-bottom: 2px solid #eee;">${category}</h4>`;
            
            resources.forEach(res => {
                // 현재 직책의 이 리소스에 대한 권한 상태 (기본값: 'none')
                const val = currentPerms[res.id] || 'none';
                
                html += `
                    <div class="perm-row">
                        <div style="font-size: 13px; font-weight: bold; color: #34495e; flex: 1;">${res.name}</div>
                        <div style="display: flex; gap: 15px; flex-shrink: 0;">
                            <label class="perm-radio-label">
                                <input type="radio" name="perm_${res.id}" value="none" ${val === 'none' ? 'checked' : ''} class="perm-radio"> 
                                <span style="color: #e74c3c;">불가</span>
                            </label>
                            <label class="perm-radio-label">
                                <input type="radio" name="perm_${res.id}" value="read" ${val === 'read' ? 'checked' : ''} class="perm-radio"> 
                                <span style="color: #2980b9;">조회</span>
                            </label>
                            <label class="perm-radio-label">
                                <input type="radio" name="perm_${res.id}" value="write" ${val === 'write' ? 'checked' : ''} class="perm-radio"> 
                                <span style="color: #27ae60;">허용(실행)</span>
                            </label>
                        </div>
                    </div>
                `;
            });
        }
        container.innerHTML = html;
    };

    permRoleSelect.addEventListener('change', (e) => {
        selectedRoleForPerm = e.target.value;
        renderPermissionUI();
    });

    document.getElementById('savePermissionsBtn').addEventListener('click', async () => {
        const newPerms = {};
        document.querySelectorAll('.perm-radio:checked').forEach(radio => {
            const resId = radio.name.replace('perm_', '');
            newPerms[resId] = radio.value;
        });

        rolePermissions[selectedRoleForPerm] = newPerms;

        try {
            await setDoc(doc(db, "system", "permissions"), { roles: rolePermissions }, { merge: true });
            alert(`[${roleMap[selectedRoleForPerm]}] 의 권한이 성공적으로 저장되었습니다.\n(앱 재시작 또는 새로고침 시 적용됩니다.)`);
        } catch (e) { console.error(e); alert("권한 저장 중 오류가 발생했습니다."); }
    });

    renderPermissionUI();

    // 사용자 등록 이벤트 처리 (Firebase Auth + Firestore 연동)
    document.getElementById('addMemberForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const role = document.getElementById('memberRole').value;
        const buildingId = document.getElementById('memberBuilding').value;
        const buildingName = document.getElementById('memberBuilding').options[document.getElementById('memberBuilding').selectedIndex]?.text || '';
        const room = document.getElementById('memberRoom').value;
        const megaAdminId = document.getElementById('memberMegaAdmin').value;
        const megaAdminName = document.getElementById('memberMegaAdmin').options[document.getElementById('memberMegaAdmin').selectedIndex]?.text || '';
        const name = document.getElementById('memberName').value;
        const email = document.getElementById('memberEmail').value;
        const password = document.getElementById('memberPassword').value;
        const phone = document.getElementById('memberPhone').value;
        
        
        const submitBtn = e.target.querySelector('button');
        submitBtn.disabled = true;
        submitBtn.textContent = '생성 중...';

        // 1. 전화번호 중복 검사
        if (phone) {
            const phoneQ = query(collection(db, "users"), where("phone", "==", phone));
            const phoneSnap = await getDocs(phoneQ);
            if (!phoneSnap.empty) {
                alert("이미 등록된 전화번호입니다. 다른 번호를 사용해주세요.");
                submitBtn.disabled = false;
                submitBtn.textContent = '계정 생성 및 추가';
                return;
            }
        }

        try {
            // 2. 보조 Firebase 앱을 생성하여 현재 관리자 로그인 세션 유지하며 새 계정 생성
            const secondaryApp = initializeApp(app.options, "SecondaryApp_" + Date.now());
            const secondaryAuth = getAuth(secondaryApp);
            
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const newUid = userCredential.user.uid;
            
            // 보조 앱 로그아웃 및 인스턴스 삭제 (메인 앱 세션은 그대로 유지됨)
            await signOut(secondaryAuth);
            await deleteApp(secondaryApp);

            // 3. Firestore 'users' 컬렉션에 권한 및 추가 정보 저장 (UID를 문서 ID로 사용)
            await setDoc(doc(db, "users", newUid), {
                uid: newUid,
                role: role,
                buildingId: buildingId || null,
                buildingName: buildingId ? buildingName : null,
                room: (role === 'tenant' && room) ? room : null,
                megaAdminId: (role === 'mega_staff') ? megaAdminId : null,
                megaAdminName: (role === 'mega_staff') ? megaAdminName : null,
                name: name,
                email: email,
                phone: phone,
                createdAt: serverTimestamp()
            });

            alert(`계정이 성공적으로 생성되었습니다!`);
            
            document.getElementById('addMemberForm').reset();
            loadMemberList(currentRoleTab); // 현재 보고 있는 탭 새로고침
            if(role === 'mega_admin') loadMegaAdminsForSelect(); // 관리회사 추가 시 드롭다운 즉시 갱신

        } catch (error) {
            console.error("계정 생성 오류:", error);
            alert("계정 생성 실패: " + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '계정 생성 및 추가';
        }
    });

    // === 회원 정보 수정 및 비밀번호 재설정 관련 기능 ===
    const editModal = document.getElementById('editModal');
    const editUid = document.getElementById('editUid');
    const editRole = document.getElementById('editRole');
    const editName = document.getElementById('editName');
    const editPhone = document.getElementById('editPhone');
    const editRoomGroup = document.getElementById('editRoomGroup');
    const editRoom = document.getElementById('editRoom');

    // 수정 모달의 권한 옵션도 본인 권한 이하로 동적 제한
    const updateEditRoleDropdown = () => {
        const editRoleEl = document.getElementById('editRole');
        if (!editRoleEl) return;
        let optionsHtml = '';
        const addOption = (val, text) => {
            if (currentUserWeight >= roleWeights[val]) {
                optionsHtml += `<option value="${val}">${text}</option>`;
            }
        };
        addOption('architect', '1. 설계자 (프로젝트 총관리자)');
        addOption('mc_header', '2. MC헤더 (MC본사팀장)');
        addOption('mc_front', '3. MC프론트 (MC직원)');
        addOption('mega_admin', '4. 메가관리자 (관리회사)');
        addOption('mega_staff', '5. 메가직원 (관리회사직원)');
        addOption('building_manager', '6. 관리인 (건물입주자대표)');
        addOption('building_exec', '7. 임원 (건물임원)');
        addOption('tenant', '8. 일반 입주자');
        editRoleEl.innerHTML = optionsHtml;
    };

    editRole.addEventListener('change', (e) => {
        editRoomGroup.style.display = e.target.value === 'tenant' ? 'block' : 'none';
    });

    const openEditModal = (user) => {
        updateEditRoleDropdown();
        editUid.value = user.uid;
        editRole.value = user.role;
        editName.value = user.name;
        editPhone.value = user.phone || '';
        editRoom.value = user.room || '';
        editRoomGroup.style.display = user.role === 'tenant' ? 'block' : 'none';
        editModal.style.display = 'flex';
    };

    document.getElementById('cancelEditBtn').addEventListener('click', () => {
        editModal.style.display = 'none';
    });

    document.getElementById('saveEditBtn').addEventListener('click', async () => {
        try {
            await updateDoc(doc(db, "users", editUid.value), {
                role: editRole.value,
                name: editName.value,
                phone: editPhone.value,
                room: editRole.value === 'tenant' ? editRoom.value : null
            });
            alert("정보가 성공적으로 수정되었습니다.");
            editModal.style.display = 'none';
            loadMemberList(currentRoleTab);
        } catch (error) {
            console.error("정보 수정 오류:", error);
            alert("수정 실패: " + error.message);
        }
    });

    const sendResetEmail = async (email) => {
        if(confirm(`해당 사용자(${email})에게 비밀번호 재설정 이메일을 발송하시겠습니까?`)) {
            try {
                await sendPasswordResetEmail(auth, email);
                alert("비밀번호 재설정 이메일이 성공적으로 발송되었습니다.");
            } catch (error) {
                console.error("메일 발송 오류:", error);
                alert("오류 발생: " + error.message);
            }
        }
    };

    // 초기 로드 시 '관리자/직원' 목록 표시
    loadMemberList('staff');
    updateRoleDropdown('staff');
};