import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, auth, escapeHtml } from "../../js/main.js";

let unsubscribeChat = null;

export const cleanup = () => {
    if (unsubscribeChat) {
        unsubscribeChat();
        unsubscribeChat = null;
    }
};

export const render = (container) => {
    const bId = localStorage.getItem('selectedBuildingId');
    const bName = localStorage.getItem('selectedBuildingName') || '전체 건물';

    if (!bId) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #e74c3c; background: #fdf2e9; border-radius: 8px; border: 1px solid #f8c471; margin-bottom: 15px; font-size: 13px;">
                선택된 건물이 없어 채팅방에 입장할 수 없습니다.<br>사이드바에서 건물을 먼저 선택해주세요.
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0; color: #2c3e50;">💬 ${escapeHtml(bName)} 단체 채팅방</h3>
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
        try {
            await addDoc(collection(db, "buildings", bId, "chats"), {
                uid: auth.currentUser.uid, email: auth.currentUser.email,
                name: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
                text: text, createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error("메시지 전송 실패:", error); alert("메시지 전송에 실패했습니다.");
        }
    };

    document.getElementById('sendChatBtn').addEventListener('click', sendMessage);
    document.getElementById('chatInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
};