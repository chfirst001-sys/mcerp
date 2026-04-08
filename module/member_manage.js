import { collection, getDocs, query, where, setDoc, doc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { db, auth, escapeHtml } from "../js/main.js";

export const init = (container) => {
    container.innerHTML = `
        <!-- 권한별 보기 탭 -->
        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <button id="tabStaff" style="flex: 1; background-color: #2c3e50;">관리자 / 직원</button>
            <button id="tabTenant" style="flex: 1; background-color: #95a5a6;">입주자</button>
        </div>

        <!-- 계정 등록 폼 -->
        <div class="module-card">
            <h3 style="margin-top: 0;">새 계정 등록</h3>
            <form id="addMemberForm">
                <select id="memberRole" style="margin-bottom: 10px; padding: 10px; width: 100%; max-width: 300px; border: 1px solid #ccc; border-radius: 4px;">
                    <option value="architect">1. 설계자 (프로젝트 총관리자)</option>
                    <option value="mc_header">2. MC헤더 (MC본사팀장)</option>
                    <option value="mc_front">3. MC프론트 (MC직원)</option>
                    <option value="mega_admin">4. 메가관리자 (관리회사)</option>
                    <option value="mega_staff">5. 메가직원 (관리회사직원)</option>
                    <option value="building_manager">6. 관리인 (건물입주자대표)</option>
                    <option value="building_exec">7. 임원 (건물임원)</option>
                    <option value="tenant">8. 일반 입주자</option>
                </select><br>
                <input type="text" id="memberName" placeholder="이름" required><br>
                <input type="email" id="memberEmail" placeholder="이메일 (로그인 ID)" required><br>
                <input type="password" id="memberPassword" placeholder="비밀번호 (6자리 이상)" required minlength="6"><br>
                <input type="text" id="memberPhone" placeholder="연락처"><br>
                <button type="submit">계정 생성 및 추가</button>
            </form>
        </div>

        <!-- 계정 목록 -->
        <div class="module-card">
            <h3 id="listTitle" style="margin-top: 0;">관리자 / 직원 목록</h3>
            <ul id="memberList" style="list-style-type: none; padding: 0;">
                <li style="padding: 10px; border-bottom: 1px solid #eee;">데이터를 불러오는 중...</li>
            </ul>
        </div>

        <!-- 수정 모달 (기본 숨김) -->
        <div id="editModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 4000; justify-content: center; align-items: center;">
            <div style="background: white; padding: 25px; border-radius: 12px; width: 90%; max-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
                <h3 style="margin-top: 0;">회원 정보 수정</h3>
                <input type="hidden" id="editUid">
                <label style="font-size: 12px; color: #7f8c8d;">권한</label>
                <select id="editRole" style="margin-bottom: 10px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px;">
                    <option value="architect">1. 설계자 (프로젝트 총관리자)</option>
                    <option value="mc_header">2. MC헤더 (MC본사팀장)</option>
                    <option value="mc_front">3. MC프론트 (MC직원)</option>
                    <option value="mega_admin">4. 메가관리자 (관리회사)</option>
                    <option value="mega_staff">5. 메가직원 (관리회사직원)</option>
                    <option value="building_manager">6. 관리인 (건물입주자대표)</option>
                    <option value="building_exec">7. 임원 (건물임원)</option>
                    <option value="tenant">8. 일반 입주자</option>
                </select><br>
                <label style="font-size: 12px; color: #7f8c8d;">이름</label>
                <input type="text" id="editName" placeholder="이름" required style="margin-bottom: 10px; padding: 10px; width: 100%; max-width: 100%; border: 1px solid #ccc; border-radius: 4px;"><br>
                <label style="font-size: 12px; color: #7f8c8d;">연락처</label>
                <input type="text" id="editPhone" placeholder="연락처" style="margin-bottom: 20px; padding: 10px; width: 100%; max-width: 100%; border: 1px solid #ccc; border-radius: 4px;"><br>
                <div style="display: flex; gap: 10px;">
                    <button id="saveEditBtn" style="flex: 1; background: #2980b9; padding: 12px;">저장</button>
                    <button id="cancelEditBtn" style="flex: 1; background: #95a5a6; padding: 12px;">취소</button>
                </div>
            </div>
        </div>
    `;

    const tabStaff = document.getElementById('tabStaff');
    const tabTenant = document.getElementById('tabTenant');
    const listTitle = document.getElementById('listTitle');
    const memberList = document.getElementById('memberList');
    let currentRoleTab = 'staff'; // 현재 선택된 탭 추적용

    // 직급 영문 코드를 한글로 변환하는 매핑 객체
    const roleMap = {
        'architect': '1.설계자',
        'mc_header': '2.MC헤더',
        'mc_front': '3.MC프론트',
        'mega_admin': '4.메가관리자',
        'mega_staff': '5.메가직원',
        'building_manager': '6.관리인',
        'building_exec': '7.임원',
        'tenant': '8.입주자',
        'admin': '구 관리자', // 기존 테스트용 계정 호환
        'staff': '구 직원'
    };
    
    // 역할(Role)에 따라 계정 목록 불러오기 함수
    const loadMemberList = async (roleType) => {
        memberList.innerHTML = '<li style="padding: 10px; border-bottom: 1px solid #eee;">데이터를 불러오는 중...</li>';
        try {
            // tenant(입주자) 탭이면 tenant만, 아니면 admin과 staff를 가져옵니다.
            let q = roleType === 'tenant' 
                ? query(collection(db, "users"), where("role", "==", "tenant"))
                : query(collection(db, "users"), where("role", "in", ["architect", "mc_header", "mc_front", "mega_admin", "mega_staff", "building_manager", "building_exec", "admin", "staff"]));

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

    // 탭 UI 전환 이벤트
    tabStaff.addEventListener('click', () => {
        tabStaff.style.backgroundColor = '#2c3e50';
        tabTenant.style.backgroundColor = '#95a5a6';
        listTitle.textContent = '관리자 / 직원 목록';
        currentRoleTab = 'staff';
        loadMemberList('staff');
    });

    tabTenant.addEventListener('click', () => {
        tabStaff.style.backgroundColor = '#95a5a6';
        tabTenant.style.backgroundColor = '#2c3e50';
        listTitle.textContent = '입주자 목록';
        currentRoleTab = 'tenant';
        loadMemberList('tenant');
    });

    // 사용자 등록 이벤트 처리 (Firebase Auth + Firestore 연동)
    document.getElementById('addMemberForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const role = document.getElementById('memberRole').value;
        const name = document.getElementById('memberName').value;
        const email = document.getElementById('memberEmail').value;
        const password = document.getElementById('memberPassword').value;
        const phone = document.getElementById('memberPhone').value;
        
        
        const submitBtn = e.target.querySelector('button');
        submitBtn.disabled = true;
        submitBtn.textContent = '생성 중...';

        try {
            // 1. Firebase Authentication에 사용자(로그인 정보) 생성
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Firestore 'users' 컬렉션에 권한 및 추가 정보 저장 (UID를 문서 ID로 사용)
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                role: role,
                name: name,
                email: email,
                phone: phone,
                createdAt: serverTimestamp()
            });

            alert(`계정이 성공적으로 생성되었습니다!\n\n(⚠️주의: 현재 브라우저 설정상, 방금 만든 새 계정으로 자동 로그인 상태가 변경됩니다.)`);
            
            document.getElementById('addMemberForm').reset();
            loadMemberList(currentRoleTab); // 현재 보고 있는 탭 새로고침

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

    const openEditModal = (user) => {
        editUid.value = user.uid;
        editRole.value = user.role;
        editName.value = user.name;
        editPhone.value = user.phone || '';
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
                phone: editPhone.value
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
};