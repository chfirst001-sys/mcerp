import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, auth, escapeHtml } from "../../js/main.js";

let unsubscribeChat = null;
let currentChatBuildingId = null;

export const cleanup = () => {
    if (unsubscribeChat) {
        unsubscribeChat();
        unsubscribeChat = null;
    }
};

export const render = async (container) => {
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #7f8c8d;">대화 목록을 불러오는 중...</div>';

    let userRole = 'tenant';
    let userBuildingId = null;
    if (auth.currentUser) {
        const uDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (uDoc.exists()) {
            userRole = uDoc.data().role;
            userBuildingId = uDoc.data().buildingId;
        }
    }

    let buildings = [];
    try {
        const q = query(collection(db, "buildings"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        snap.forEach(docSnap => {
            const b = docSnap.data();
            // MC본사, 관리회사 등 관리자 권한은 모든 건물을 표시 / 입주자는 본인 소속 건물만 표시
            if (['architect', 'mc_header', 'mc_front', 'admin', 'staff', 'mega_admin', 'mega_staff'].includes(userRole)) {
                buildings.push({ id: docSnap.id, name: b.name });
            } else {
                if (docSnap.id === userBuildingId) {
                    buildings.push({ id: docSnap.id, name: b.name });
                }
            }
        });
    } catch (e) {
        console.error("채팅방 목록 로드 실패:", e);
    }

    let listHtml = '';
    if (buildings.length > 0) {
        buildings.forEach(b => {
            listHtml += `
                <div class="chat-list-item" data-id="${b.id}" data-name="${escapeHtml(b.name)}" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; background: #fff; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; align-items: center; gap: 15px; margin-bottom: 10px; transition: background 0.2s;" onmouseover="this.style.background='#f4f6f8'" onmouseout="this.style.background='#fff'">
                    <div style="background: #e8f4f8; color: #2980b9; width: 50px; height: 50px; border-radius: 12px; display: flex; justify-content: center; align-items: center; flex-shrink: 0;">
                        <span class="material-symbols-outlined" style="font-size: 28px;">chat</span>
                    </div>
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                            <h4 style="margin: 0; color: #2c3e50; font-size: 15px;">${escapeHtml(b.name)} 단체 채팅방</h4>
                        </div>
                        <div style="font-size: 12px; color: #7f8c8d;">이웃들과 실시간으로 대화를 나눠보세요.</div>
                    </div>
                    <span class="material-symbols-outlined" style="color: #bdc3c7;">chevron_right</span>
                </div>
            `;
        });
    } else {
        listHtml = `
            <div style="text-align: center; padding: 30px 20px; color: #7f8c8d; background: #f8f9fa; border-radius: 8px; border: 1px dashed #ccc;">
                <span class="material-symbols-outlined" style="font-size: 32px; color: #bdc3c7; margin-bottom: 10px;">forum</span><br>
                참여 가능한 채팅방이 없습니다.
            </div>
        `;
    }

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0; color: #2c3e50;">내 대화 목록</h3>
            <button style="background: #2980b9; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <span class="material-symbols-outlined" style="font-size: 16px;">chat_add_on</span> 새 대화
            </button>
        </div>
        
        <div style="display: flex; flex-direction: column;">
            ${listHtml}
        </div>
    `;

    container.querySelectorAll('.chat-list-item').forEach(item => {
        item.addEventListener('click', () => openChatRoom(container, item.dataset.id, item.dataset.name));
    });
};

const openChatRoom = (container, bId, bName) => {
    currentChatBuildingId = bId;
    cleanup();

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <button id="backToChatListBtn" style="background: none; border: none; padding: 0; cursor: pointer; display: flex; align-items: center; color: #2c3e50;">
                    <span class="material-symbols-outlined" style="font-size: 24px;">arrow_back</span>
                </button>
                <h3 style="margin: 0; color: #2c3e50;">💬 ${escapeHtml(bName)} 단체 채팅방</h3>
            </div>
            <span style="font-size: 12px; background: #27ae60; color: white; padding: 3px 8px; border-radius: 12px; display: flex; align-items: center; gap: 4px;">
                <span class="material-symbols-outlined" style="font-size: 14px;">wifi</span> 실시간 연결됨
            </span>
        </div>
        
        <div style="display: flex; flex-direction: column; height: 450px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background: #f4f6f8;">
            <div id="chatMessages" style="flex: 1; padding: 15px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;">
                <div style="text-align: center; color: #7f8c8d; font-size: 12px; margin-top: 20px;">메시지를 불러오는 중...</div>
            </div>
            <div style="display: flex; padding: 10px; background: white; border-top: 1px solid #e0e0e0;">
                <input type="text" id="chatInput" placeholder="메시지를 입력하세요..." style="flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; margin-right: 10px; outline: none; font-size: 14px;">
                <button id="sendChatBtn" style="background: #2980b9; color: white; border: none; padding: 0 20px; border-radius: 4px; cursor: pointer; font-weight: bold;">전송</button>
            </div>
        </div>
    `;

    document.getElementById('backToChatListBtn').addEventListener('click', () => {
        cleanup();
        render(container);
    });

    const q = query(collection(db, "buildings", bId, "chats"), orderBy("createdAt", "asc"));
    unsubscribeChat = onSnapshot(q, (snapshot) => {
        const messagesDiv = document.getElementById('chatMessages');
        if (!messagesDiv) return;
        
        if (snapshot.empty) {
            messagesDiv.innerHTML = '<div style="text-align: center; color: #7f8c8d; font-size: 12px; margin-top: 20px;">아직 대화 내용이 없습니다.<br>첫 메시지를 보내보세요!</div>';
            return;
        }

        let html = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const isMe = auth.currentUser && auth.currentUser.uid === data.uid;
            const timeStr = data.createdAt ? data.createdAt.toDate().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';
            const senderName = data.name || (data.email ? data.email.split('@')[0] : '알 수 없음');

            html += `
                <div style="display: flex; flex-direction: column; align-items: ${isMe ? 'flex-end' : 'flex-start'};">
                    <span style="font-size: 11px; color: #7f8c8d; margin-bottom: 3px; padding: 0 5px;">${isMe ? '나' : escapeHtml(senderName)}</span>
                    <div style="display: flex; align-items: flex-end; gap: 5px; flex-direction: ${isMe ? 'row-reverse' : 'row'};">
                        <div style="background: ${isMe ? '#2980b9' : '#ffffff'}; color: ${isMe ? 'white' : '#2c3e50'}; padding: 10px 14px; border-radius: 14px; max-width: 240px; word-break: break-all; font-size: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); border: 1px solid ${isMe ? '#2980b9' : '#e0e0e0'};">
                            ${escapeHtml(data.text)}
                        </div>
                        <span style="font-size: 10px; color: #95a5a6; white-space: nowrap;">${timeStr}</span>
                    </div>
                </div>
            `;
        });
        
        messagesDiv.innerHTML = html;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });

    const sendMessage = async () => {
        const inputEl = document.getElementById('chatInput');
        const text = inputEl.value.trim();
        if (!text) return;
        if (!auth.currentUser) return alert('로그인이 필요합니다.');
        inputEl.value = '';
        
        // 1공간 1프로필 정책 적용 (채팅방 ID별 고정)
        let senderName = localStorage.getItem('lockedProfile_' + bId);
        const defaultName = auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
        const activeProfile = localStorage.getItem('activeProfileName') || defaultName;

        if (!senderName) {
            senderName = activeProfile;
            localStorage.setItem('lockedProfile_' + bId, senderName);
        } else if (activeProfile !== senderName) {
            if (confirm(`안내: 이 채팅방에서는 기존에 '${senderName}' 프로필을 사용하셨습니다.\n\n새로 선택하신 '${activeProfile}' 프로필로 변경하여 대화하시겠습니까?\n(이전 대화 기록의 닉네임은 소급 변경되지 않습니다.)`)) {
                senderName = activeProfile;
                localStorage.setItem('lockedProfile_' + bId, senderName);
            }
        }

        try {
            await addDoc(collection(db, "buildings", bId, "chats"), {
                uid: auth.currentUser.uid, email: auth.currentUser.email,
                name: senderName,
                text: text, createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error("메시지 전송 실패:", error); alert("메시지 전송에 실패했습니다.");
        }
    };

    document.getElementById('sendChatBtn').addEventListener('click', sendMessage);
    document.getElementById('chatInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
};