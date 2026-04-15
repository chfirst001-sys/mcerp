import { collection, getDocs, doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, auth, escapeHtml } from "../../js/main.js";

let unsub = null;

export const cleanup = () => {
    if (unsub) {
        unsub();
        unsub = null;
    }
};

export const render = async (container) => {
    if (!auth.currentUser) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#e74c3c;">로그인이 필요합니다.</div>';
        return;
    }

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0; color: #2c3e50;">내 친구 목록</h3>
            <button id="openFriendSearchBtn" style="background: #27ae60; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <span class="material-symbols-outlined" style="font-size: 16px;">person_add</span> 친구 추가
            </button>
        </div>
        <div id="friendListContainer" style="display: flex; flex-direction: column; gap: 10px;">
            <div style="text-align: center; padding: 20px; color: #7f8c8d;">친구 목록을 불러오는 중...</div>
        </div>

        <!-- 친구 찾기 모달 -->
        <div id="friendSearchModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 5000; justify-content: center; align-items: center;">
            <div style="background: white; padding: 20px; border-radius: 12px; width: 90%; max-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); display: flex; flex-direction: column; max-height: 80vh;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: #2c3e50;">친구 찾기</h3>
                    <button id="closeSearchModalBtn" style="background: none; border: none; padding: 0; cursor: pointer; color: #7f8c8d;"><span class="material-symbols-outlined">close</span></button>
                </div>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <input type="text" id="friendSearchInput" placeholder="이름 또는 이메일 검색" style="flex: 1; margin: 0; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
                    <button id="searchFriendActionBtn" style="background: #2980b9; color: white; border: none; padding: 0 15px; border-radius: 4px; cursor: pointer;">검색</button>
                </div>
                <div id="friendSearchResults" style="overflow-y: auto; flex: 1; padding-right: 5px;">
                    <div style="text-align: center; padding: 20px; color: #95a5a6; font-size: 13px;">검색어를 입력해주세요.</div>
                </div>
            </div>
        </div>
    `;

    const myUid = auth.currentUser.uid;
    let allUsersMap = {};

    // 전체 유저 목록 로드 (친구 정보 매핑 및 검색용)
    try {
        const snap = await getDocs(collection(db, "users"));
        snap.forEach(d => { allUsersMap[d.id] = d.data(); });
    } catch (e) {
        console.error("유저 목록 로드 실패:", e);
    }

    // 내 친구 목록 실시간 렌더링
    unsub = onSnapshot(doc(db, "users", myUid), (docSnap) => {
        const friendContainer = document.getElementById('friendListContainer');
        if (!friendContainer) return;
        
        let html = `
            <div style="display: flex; align-items: center; justify-content: space-between; background: white; padding: 12px 15px; border-radius: 8px; border: 1px solid #eee; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #8e44ad, #3498db); color: white; border-radius: 50%; display: flex; justify-content: center; align-items: center;">
                        <span class="material-symbols-outlined">smart_toy</span>
                    </div>
                    <div>
                        <div style="font-weight: bold; color: #2c3e50; font-size: 14px;">AI 친구</div>
                        <div style="font-size: 12px; color: #7f8c8d;">무엇이든 물어보세요!</div>
                    </div>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button class="start-chat-btn" data-uid="ai_friend" data-name="AI 친구" style="background: #2980b9; color: white; border: none; padding: 6px 10px; border-radius: 4px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 2px;">
                        <span class="material-symbols-outlined" style="font-size: 14px;">chat</span> 채팅
                    </button>
                </div>
            </div>
        `;

        if (docSnap.exists()) {
            const data = docSnap.data();
            const friendUids = data.friendUids || [];
            
            if (friendUids.length === 0) {
                // AI 친구만 표시되므로 '친구 없음' 메시지는 표시하지 않음
            }

            friendUids.forEach(uid => {
                const u = allUsersMap[uid];
                if (u) {
                    html += `
                        <div style="display: flex; align-items: center; justify-content: space-between; background: white; padding: 12px 15px; border-radius: 8px; border: 1px solid #eee; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="width: 40px; height: 40px; background: #e8f4f8; color: #2980b9; border-radius: 50%; display: flex; justify-content: center; align-items: center;">
                                    <span class="material-symbols-outlined">person</span>
                                </div>
                                <div>
                                    <div style="font-weight: bold; color: #2c3e50; font-size: 14px;">${escapeHtml(u.name)}</div>
                                    <div style="font-size: 12px; color: #7f8c8d;">${escapeHtml(u.email)}</div>
                                </div>
                            </div>
                            <div style="display: flex; gap: 5px;">
                                <button class="start-chat-btn" data-uid="${uid}" data-name="${escapeHtml(u.name)}" style="background: #2980b9; color: white; border: none; padding: 6px 10px; border-radius: 4px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 2px;">
                                    <span class="material-symbols-outlined" style="font-size: 14px;">chat</span> 채팅
                                </button>
                                <button class="remove-friend-btn" data-uid="${uid}" style="background: #fadbd8; color: #c0392b; border: none; padding: 6px; border-radius: 4px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="친구 삭제">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">person_remove</span>
                                </button>
                            </div>
                        </div>
                    `;
                }
            });
        }

        friendContainer.innerHTML = html;

        // 1:1 채팅방 열기
        friendContainer.querySelectorAll('.start-chat-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                sessionStorage.setItem('openChatWith', e.currentTarget.dataset.uid);
                sessionStorage.setItem('openChatWithName', e.currentTarget.dataset.name);
                const chatTabBtn = document.querySelector('.sub-tab-btn[data-tab="chat"]');
                if (chatTabBtn) chatTabBtn.click(); // 채팅 탭으로 이동 트리거
            });
        });

        // 친구 삭제 처리
        friendContainer.querySelectorAll('.remove-friend-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('이 친구를 목록에서 삭제하시겠습니까?')) {
                    await updateDoc(doc(db, "users", myUid), { friendUids: arrayRemove(e.currentTarget.dataset.uid) });
                }
            });
        });
    });

    // 친구 검색 및 모달
    const modal = document.getElementById('friendSearchModal');
    document.getElementById('openFriendSearchBtn').addEventListener('click', () => { modal.style.display = 'flex'; });
    document.getElementById('closeSearchModalBtn').addEventListener('click', () => { modal.style.display = 'none'; });

    document.getElementById('searchFriendActionBtn').addEventListener('click', () => {
        const keyword = document.getElementById('friendSearchInput').value.trim();
        const resContainer = document.getElementById('friendSearchResults');
        if (!keyword) return resContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #e74c3c; font-size: 13px;">검색어를 입력해주세요.</div>';

        let html = ''; let count = 0;
        for (const [uid, u] of Object.entries(allUsersMap)) {
            if (uid === myUid) continue; // 본인 제외
            if ((u.name && u.name.includes(keyword)) || (u.email && u.email.includes(keyword))) {
                count++;
                html += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;"><div><div style="font-weight: bold; color: #2c3e50; font-size: 13px;">${escapeHtml(u.name)}</div><div style="font-size: 11px; color: #7f8c8d;">${escapeHtml(u.email)}</div></div><button class="add-friend-action-btn" data-uid="${uid}" style="background: #27ae60; color: white; border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer;">추가</button></div>`;
            }
        }
        resContainer.innerHTML = count === 0 ? '<div style="text-align: center; padding: 20px; color: #7f8c8d; font-size: 13px;">검색 결과가 없습니다.</div>' : html;
        
        resContainer.querySelectorAll('.add-friend-action-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                await updateDoc(doc(db, "users", myUid), { friendUids: arrayUnion(e.currentTarget.dataset.uid) });
                alert('친구가 추가되었습니다!'); modal.style.display = 'none';
            });
        });
    });
};