import { collection, getDocs, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { db, auth, escapeHtml } from "../js/main.js";

export const init = async (container) => {
    const user = auth.currentUser;
    if (!user) {
        container.innerHTML = '<div style="padding: 50px; text-align: center; color: #e74c3c;">로그인이 필요합니다.</div>';
        return;
    }

    // 2차 보안: 로그인 비밀번호 재확인
    const userPwd = prompt("시스템DB(최상위 보안 구역)에 접근하려면 현재 로그인된 계정의 비밀번호를 입력하세요.");
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

    container.innerHTML = `
        <div style="padding: 20px; height: calc(100vh - 120px); display: flex; flex-direction: column; background: #f4f6f8; box-sizing: border-box;">
            <h2 style="color: #2c3e50; margin-top: 0;">시스템DB 통합 관리 (설계자 전용)</h2>
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <select id="dbCollectionSelect" style="padding: 10px; border-radius: 4px; border: 1px solid #ccc; font-size: 14px; outline: none;">
                    <option value="users">users (회원 계정)</option>
                    <option value="buildings">buildings (건물 및 세대/물품)</option>
                    <option value="system">system (시스템 및 권한/AI 설정)</option>
                </select>
                <button id="dbLoadBtn" style="background: #2c3e50; color: white; border: none; padding: 0 20px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: 0.2s;">데이터 조회</button>
                <button id="dbAddBtn" style="background: #27ae60; color: white; border: none; padding: 0 20px; border-radius: 4px; cursor: pointer; font-weight: bold; margin-left: auto; transition: 0.2s;">+ 새 문서 추가</button>
            </div>
            
            <div style="display: flex; flex: 1; gap: 20px; min-height: 0;">
                <!-- 좌측: 문서 목록 -->
                <div style="flex: 1; display: flex; flex-direction: column; background: white; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="padding: 10px 15px; background: #ecf0f1; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #34495e;">문서 목록 (Document ID)</div>
                    <div id="dbDocList" style="flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 5px;">
                        <div style="color: #7f8c8d; text-align: center; padding: 40px 20px;">상단의 '데이터 조회' 버튼을<br>눌러주세요.</div>
                    </div>
                </div>
                
                <!-- 우측: JSON 에디터 -->
                <div style="flex: 2; display: flex; flex-direction: column; gap: 10px; background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <label style="font-size: 12px; font-weight: bold; color: #7f8c8d; width: 50px;">문서 ID</label>
                        <input type="text" id="dbDocId" placeholder="새 문서 생성 시 빈칸으로 두면 임의의 ID가 자동 생성됩니다." style="flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; outline: none;">
                    </div>
                    <label style="font-size: 12px; font-weight: bold; color: #7f8c8d; margin-top: 5px;">JSON 데이터 (직접 수정 가능)</label>
                    <textarea id="dbDocEditor" placeholder="{}" style="flex: 1; padding: 15px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; font-size: 13px; resize: none; outline: none; background: #fdfefe; line-height: 1.5;"></textarea>
                    
                    <div style="display: flex; gap: 10px; margin-top: 5px;">
                        <button id="dbSaveBtn" style="flex: 2; background: #2980b9; color: white; border: none; padding: 12px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px; transition: 0.2s;">저장 (Update / Set)</button>
                        <button id="dbDeleteBtn" style="flex: 1; background: #e74c3c; color: white; border: none; padding: 12px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px; transition: 0.2s;">완전 삭제</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const loadBtn = document.getElementById('dbLoadBtn');
    const addBtn = document.getElementById('dbAddBtn');
    const saveBtn = document.getElementById('dbSaveBtn');
    const deleteBtn = document.getElementById('dbDeleteBtn');
    const collectionSelect = document.getElementById('dbCollectionSelect');
    const docList = document.getElementById('dbDocList');
    const docIdInput = document.getElementById('dbDocId');
    const docEditor = document.getElementById('dbDocEditor');

    // 컬렉션 문서 목록 불러오기
    const loadCollectionData = async () => {
        const colName = collectionSelect.value;
        docList.innerHTML = '<div style="color: #3498db; text-align: center; padding: 40px 20px;">불러오는 중...</div>';
        
        try {
            const snap = await getDocs(collection(db, colName));
            docList.innerHTML = '';
            
            if (snap.empty) {
                docList.innerHTML = '<div style="color: #7f8c8d; text-align: center; padding: 40px 20px;">데이터가 없습니다.</div>';
                return;
            }
            
            snap.forEach(docSnap => {
                const data = docSnap.data();
                const item = document.createElement('div');
                item.style.cssText = 'padding: 12px 10px; border: 1px solid #eee; border-radius: 6px; cursor: pointer; transition: background 0.2s; font-size: 13px; color: #2c3e50; word-break: break-all; font-family: monospace;';
                item.textContent = docSnap.id;
                
                item.addEventListener('mouseover', () => item.style.background = '#e8f4f8');
                item.addEventListener('mouseout', () => item.style.background = 'transparent');
                
                item.addEventListener('click', () => {
                    docIdInput.value = docSnap.id;
                    docIdInput.readOnly = true; // 기존 문서는 ID 수정 불가 (Firebase 구조상 ID 변경은 삭제 후 재생성해야 함)
                    docIdInput.style.background = '#f4f6f8';
                    docEditor.value = JSON.stringify(data, null, 4);
                });
                
                docList.appendChild(item);
            });
        } catch(e) {
            docList.innerHTML = `<div style="color: red; padding: 10px; text-align: center;">조회 실패: ${e.message}</div>`;
        }
    };

    loadBtn.addEventListener('click', loadCollectionData);
    
    // 새 문서 추가 버튼
    addBtn.addEventListener('click', () => {
        docIdInput.value = '';
        docIdInput.readOnly = false;
        docIdInput.style.background = '#fff';
        docEditor.value = '{\n    \n}';
        docIdInput.focus();
    });
    
    // 문서 저장 (신규 생성 또는 기존 덮어쓰기)
    saveBtn.addEventListener('click', async () => {
        const colName = collectionSelect.value;
        let docId = docIdInput.value.trim();
        const jsonStr = docEditor.value.trim();
        
        if (!jsonStr) return alert('저장할 데이터가 없습니다.');
        
        let parsedData;
        try {
            parsedData = JSON.parse(jsonStr);
        } catch(e) {
            return alert('JSON 형식이 올바르지 않습니다.\n\n오류: ' + e.message);
        }
        
        if (!confirm('이대로 데이터를 저장(덮어쓰기) 하시겠습니까?')) return;
        
        saveBtn.disabled = true; saveBtn.style.opacity = '0.5'; saveBtn.textContent = '저장 중...';
        
        try {
            let docRef;
            if (docId) {
                docRef = doc(db, colName, docId);
            } else {
                docRef = doc(collection(db, colName)); // ID가 없으면 자동 생성
                docIdInput.value = docRef.id; 
            }
            
            await setDoc(docRef, parsedData);
            alert('성공적으로 저장되었습니다.');
            loadCollectionData(); // 목록 새로고침
        } catch(e) {
            alert('저장 실패: ' + e.message);
        } finally {
            saveBtn.disabled = false; saveBtn.style.opacity = '1'; saveBtn.textContent = '저장 (Update / Set)';
        }
    });
    
    // 문서 삭제
    deleteBtn.addEventListener('click', async () => {
        const colName = collectionSelect.value;
        const docId = docIdInput.value.trim();
        
        if (!docId) return alert('삭제할 문서를 선택하세요.');
        if (!confirm(`정말 [${docId}] 문서를 완전히 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
        
        try {
            await deleteDoc(doc(db, colName, docId));
            alert('성공적으로 삭제되었습니다.');
            docIdInput.value = '';
            docEditor.value = '';
            loadCollectionData(); // 목록 새로고침
        } catch(e) {
            alert('삭제 실패: ' + e.message);
        }
    });
};