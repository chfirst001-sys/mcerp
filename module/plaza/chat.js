import { collection, query, where, getDocs, doc, setDoc, addDoc, onSnapshot, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, auth, escapeHtml } from "../../js/main.js";

let unsubChats = null;
let unsubMessages = null;

export const cleanup = () => {
    if (unsubChats) { unsubChats(); unsubChats = null; }
    if (unsubMessages) { unsubMessages(); unsubMessages = null; }
};

export const render = async (container) => {
    if (!auth.currentUser) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#e74c3c;">로그인이 필요합니다.</div>';
        return;
    }

    // 친구 목록 등 외부에서 1:1 채팅 요청이 들어왔는지 확인
    const targetUid = sessionStorage.getItem('openChatWith');
    const targetName = sessionStorage.getItem('openChatWithName');

    if (targetUid && targetName) {
        sessionStorage.removeItem('openChatWith');
        sessionStorage.removeItem('openChatWithName');
        openChatRoom(container, targetUid, targetName);
    } else {
        renderChatList(container);
    }
};

const renderChatList = async (container) => {
    container.innerHTML = `
        <h3 style="margin: 0 0 15px 0; color: #2c3e50;">채팅 목록</h3>
        <div id="chatListContainer" style="display: flex; flex-direction: column; gap: 10px;">
            <div style="text-align: center; padding: 20px; color: #7f8c8d;">채팅 목록을 불러오는 중...</div>
        </div>
    `;

    const myUid = auth.currentUser.uid;
    let allUsersMap = {};
    
    // 상대방 프로필 표시를 위해 유저 목록 로드
    try {
        const snap = await getDocs(collection(db, "users"));
        snap.forEach(d => { allUsersMap[d.id] = d.data(); });
    } catch (e) { console.error(e); }

    // 내가 참여 중인 채팅방 실시간 수신
    const q = query(collection(db, "chats"), where("participants", "array-contains", myUid));
    unsubChats = onSnapshot(q, (snapshot) => {
        const listContainer = document.getElementById('chatListContainer');
        if (!listContainer) return;

        let chats = [];
        snapshot.forEach(docSnap => {
            chats.push({ id: docSnap.id, ...docSnap.data() });
        });

        // 최근 메시지 순으로 정렬
        chats.sort((a, b) => {
            const timeA = a.lastMessageTime ? a.lastMessageTime.toMillis() : 0;
            const timeB = b.lastMessageTime ? b.lastMessageTime.toMillis() : 0;
            return timeB - timeA;
        });

        if (chats.length === 0) {
            listContainer.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: #7f8c8d; background: #f8f9fa; border-radius: 8px; border: 1px dashed #ccc;"><span class="material-symbols-outlined" style="font-size: 40px; color: #bdc3c7; margin-bottom: 10px;">chat_bubble_outline</span><br>참여 중인 대화가 없습니다.<br><span style="font-size:12px;">친구 목록에서 대화를 시작해보세요.</span></div>';
            return;
        }

        let html = '';
        chats.forEach(chat => {
            const otherUid = chat.participants.find(uid => uid !== myUid) || myUid;
            const otherUser = allUsersMap[otherUid];
            const otherName = otherUser ? otherUser.name : '알 수 없음';
            const timeStr = chat.lastMessageTime ? chat.lastMessageTime.toDate().toLocaleTimeString('ko-KR', {hour: '2-digit', minute:'2-digit'}) : '방금 전';

            html += `
                <div class="chat-room-item" data-uid="${otherUid}" data-name="${escapeHtml(otherName)}" style="display: flex; align-items: center; justify-content: space-between; background: white; padding: 15px; border-radius: 8px; border: 1px solid #eee; box-shadow: 0 1px 2px rgba(0,0,0,0.05); cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#f4f6f8'" onmouseout="this.style.background='#fff'">
                    <div style="display: flex; align-items: center; gap: 12px; overflow: hidden;">
                        <div style="width: 45px; height: 45px; background: #2c3e50; color: white; border-radius: 50%; display: flex; justify-content: center; align-items: center; flex-shrink: 0;">
                            <span class="material-symbols-outlined">person</span>
                        </div>
                        <div style="overflow: hidden;">
                            <div style="font-weight: bold; color: #2c3e50; font-size: 15px; margin-bottom: 4px;">${escapeHtml(otherName)}</div>
                            <div style="font-size: 13px; color: #7f8c8d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">${escapeHtml(chat.lastMessage || '대화 내용이 없습니다.')}</div>
                        </div>
                    </div>
                    <div style="font-size: 11px; color: #bdc3c7; white-space: nowrap; flex-shrink: 0;">
                        ${timeStr}
                    </div>
                </div>
            `;
        });

        listContainer.innerHTML = html;

        listContainer.querySelectorAll('.chat-room-item').forEach(item => {
            item.addEventListener('click', (e) => {
                cleanup(); // 채팅 리스트 리스너 해제 후 방 진입
                openChatRoom(container, e.currentTarget.dataset.uid, e.currentTarget.dataset.name);
            });
        });
    });
};

const openChatRoom = (container, targetUid, targetName) => {
    const myUid = auth.currentUser.uid;
    // UID를 정렬하여 붙이면 1:1 대화방의 고유 ID가 항상 동일하게 만들어짐
    const chatId = [myUid, targetUid].sort().join('_');

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; height: calc(100vh - 200px); background: white; border-radius: 8px; border: 1px solid #eee; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            <!-- 헤더 -->
            <div style="background: #2c3e50; color: white; padding: 12px 15px; display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                <button id="backToChatListBtn" style="background: none; border: none; color: white; cursor: pointer; padding: 0; display: flex; align-items: center;">
                    <span class="material-symbols-outlined" style="font-size: 24px;">arrow_back</span>
                </button>
                <div style="font-size: 16px; font-weight: bold;">${escapeHtml(targetName)}</div>
            </div>

            <!-- 메시지 목록 -->
            <div id="messagesContainer" style="flex: 1; padding: 15px; overflow-y: auto; background: #f4f6f8; display: flex; flex-direction: column; gap: 10px;">
                <div style="text-align: center; font-size: 12px; color: #95a5a6; margin-top: 20px;">대화를 불러오는 중...</div>
            </div>

            <!-- 메시지 입력란 -->
            <div style="padding: 10px; background: white; border-top: 1px solid #eee; display: flex; gap: 8px; flex-shrink: 0; align-items: center;">
                <textarea id="chatMessageInput" placeholder="메시지를 입력하세요 (엔터키 전송)..." style="flex: 1; border: 1px solid #ccc; border-radius: 20px; padding: 10px 15px; font-size: 14px; resize: none; height: 40px; line-height: 1.4; outline: none; font-family: inherit; margin: 0;"></textarea>
                <button id="sendChatMsgBtn" style="background: #2980b9; color: white; border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; flex-shrink: 0;">
                    <span class="material-symbols-outlined" style="font-size: 20px; margin-left: 2px;">send</span>
                </button>
            </div>
        </div>
    `;

    document.getElementById('backToChatListBtn').addEventListener('click', () => {
        cleanup();
        renderChatList(container);
    });

    const messagesContainer = document.getElementById('messagesContainer');
    const inputEl = document.getElementById('chatMessageInput');
    const sendBtn = document.getElementById('sendChatMsgBtn');

    // 해당 채팅방 메시지 실시간 수신
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    unsubMessages = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            messagesContainer.innerHTML = '<div style="text-align: center; font-size: 12px; color: #95a5a6; margin-top: 20px;">메시지를 보내 대화를 시작해보세요.</div>';
            return;
        }

        let html = '';
        snapshot.forEach(docSnap => {
            const msg = docSnap.data();
            const isMe = msg.senderId === myUid;
            const timeStr = msg.createdAt ? msg.createdAt.toDate().toLocaleTimeString('ko-KR', {hour: '2-digit', minute:'2-digit'}) : '';

            if (isMe) {
                html += `<div style="display: flex; justify-content: flex-end; margin-bottom: 4px;"><div style="display: flex; align-items: flex-end; gap: 5px;"><span style="font-size: 10px; color: #95a5a6;">${timeStr}</span><div style="background: #2980b9; color: white; padding: 10px 14px; border-radius: 16px 16px 0 16px; font-size: 14px; max-width: 250px; word-break: break-word;">${escapeHtml(msg.text)}</div></div></div>`;
            } else {
                html += `<div style="display: flex; justify-content: flex-start; margin-bottom: 4px;"><div style="display: flex; align-items: flex-end; gap: 5px;"><div style="background: white; color: #333; border: 1px solid #e0e0e0; padding: 10px 14px; border-radius: 16px 16px 16px 0; font-size: 14px; max-width: 250px; word-break: break-word;">${escapeHtml(msg.text)}</div><span style="font-size: 10px; color: #95a5a6;">${timeStr}</span></div></div>`;
            }
        });

        messagesContainer.innerHTML = html;
        messagesContainer.scrollTop = messagesContainer.scrollHeight; // 스크롤 맨 아래로 유지
    });

    // 메시지 전송
    const sendMessage = async () => {
        const text = inputEl.value.trim();
        if (!text) return;
        inputEl.value = ''; inputEl.focus();

        try {
            // 방 정보(participants)와 마지막 메시지 시간 갱신 (채팅방 자동 생성)
            await setDoc(doc(db, "chats", chatId), { participants: [myUid, targetUid], lastMessage: text, lastMessageTime: serverTimestamp() }, { merge: true });
            // 실제 메시지 내역 추가
            await addDoc(collection(db, "chats", chatId, "messages"), { senderId: myUid, text: text, createdAt: serverTimestamp() });
        } catch (err) {
            console.error("전송 실패:", err); alert("전송에 실패했습니다.");
        }
    };

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
};