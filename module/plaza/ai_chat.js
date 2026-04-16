import { collection, query, doc, getDoc, setDoc, addDoc, onSnapshot, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, auth, escapeHtml } from "../../js/main.js";
import { getAIResponse } from "./ai_engine.js";

let unsubMessages = null;
let userAiModel = null;
let userAiVocab = [];
let userAiClasses = [];
let userAiResponses = {};

// Base64를 다시 ArrayBuffer(바이너리)로 복원하는 함수
const base64ToBuffer = (base64) => {
    const binary_string = atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
};

// 의존성 라이브러리(TensorFlow.js) 동적 로드
const loadTFJS = async () => {
    if (window.tf) return true;
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js";
        script.onload = () => resolve(true);
        document.head.appendChild(script);
    });
};

// 토크나이저
const tokenize = (text) => text.replace(/[.,!?]/g, '').trim().split(/\s+/);

export const cleanupAIChat = () => {
    if (unsubMessages) { unsubMessages(); unsubMessages = null; }
};

export const renderAIChatRoom = async (container, targetUid, targetName) => {
    const myUid = auth.currentUser.uid;
    const chatId = [myUid, targetUid].sort().join('_');

    container.innerHTML = `
        <style>
            .custom-scrollbar-chat::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar-chat::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar-chat::-webkit-scrollbar-thumb { background-color: #bdc3c7; border-radius: 3px; }
            .custom-scrollbar-chat::-webkit-scrollbar-thumb:hover { background-color: #95a5a6; }
            .custom-scrollbar-chat::-webkit-scrollbar-button { display: none; }
            .custom-scrollbar-chat {
                scrollbar-width: thin;
                scrollbar-color: #bdc3c7 transparent;
            }
        </style>
        <div style="display: flex; flex-direction: column; height: calc(100vh - 165px); background: white; margin: -20px -15px -20px -15px; overflow: hidden;">
            <div style="background: #2c3e50; color: white; padding: 12px 15px; display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                <button id="backToChatListBtnAI" style="background: none; border: none; color: white; cursor: pointer; padding: 0; display: flex; align-items: center;">
                    <span class="material-symbols-outlined" style="font-size: 24px;">arrow_back</span>
                </button>
                <div style="font-size: 16px; font-weight: bold;">${escapeHtml(targetName)}</div>
            </div>
            
            <div id="aiStatusBar" style="display: none; background: #e8f4f8; border-bottom: 1px solid #bce0fd; padding: 8px; text-align: center; font-size: 12px; color: #2980b9; font-weight: bold;"></div>

            <div id="messagesContainerAI" style="flex: 1; padding: 15px; overflow-y: auto; background: #f4f6f8; display: flex; flex-direction: column; gap: 10px;">
                <div style="text-align: center; font-size: 12px; color: #95a5a6; margin-top: 20px;">대화를 불러오는 중...</div>
            </div>

            <div style="padding: 10px; background: white; border-top: 1px solid #eee; display: flex; gap: 8px; flex-shrink: 0; align-items: center;">
                <div style="flex: 1; border: 1px solid #ccc; border-radius: 20px; overflow: hidden; background: white;">
                    <textarea id="chatMessageInputAI" class="custom-scrollbar-chat" placeholder="메시지를 입력하세요..." rows="1" oninput="this.style.height='auto'; this.style.height=(this.scrollHeight)+'px';" style="width: 100%; background: transparent; border: none; outline: none; font-size: 14px; resize: none; min-height: 40px; height: 40px; max-height: 120px; line-height: 1.4; font-family: inherit; margin: 0; padding: 10px 15px; box-sizing: border-box; overflow-y: auto;"></textarea>
                </div>
                <button id="sendChatMsgBtnAI" style="background: #2980b9; color: white; border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; flex-shrink: 0;">
                    <span class="material-symbols-outlined" style="font-size: 20px; margin-left: 2px;">send</span>
                </button>
            </div>
        </div>
    `;

    document.getElementById('backToChatListBtnAI').addEventListener('click', () => {
        cleanupAIChat();
        document.querySelector('.sub-tab-btn[data-tab="chat"]')?.click();
    });

    const messagesContainer = document.getElementById('messagesContainerAI');
    const inputEl = document.getElementById('chatMessageInputAI');
    const sendBtn = document.getElementById('sendChatMsgBtnAI');

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
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });

    const statusBar = document.getElementById('aiStatusBar');
    statusBar.style.display = 'block';
    statusBar.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px; vertical-align:middle; animation:spin 1s linear infinite;">sync</span> AI 엔진 연결 중...';
    
    setTimeout(async () => {
        await loadTFJS();
        try {
            const modelDoc = await getDoc(doc(db, "system", "ai_model"));
            if (modelDoc.exists()) {
                const data = modelDoc.data();
                const localVer = localStorage.getItem('user_ai_version');
                const localMeta = JSON.parse(localStorage.getItem('user_ai_meta') || '{}');
                
                if (!localVer) {
                    statusBar.style.background = '#fdf2e9'; statusBar.style.color = '#e67e22'; statusBar.style.borderBottomColor = '#f8c471';
                    statusBar.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px; vertical-align:middle;">info</span> 최초 1회 AI 모델 다운로드가 필요합니다. 좌측 상단(☰) > [AI 설정] 메뉴를 이용해주세요.';
                    inputEl.disabled = true; inputEl.placeholder = 'AI 모델 다운로드 후 대화가 가능합니다.'; sendBtn.disabled = true; sendBtn.style.opacity = '0.5';
                    return;
                } else if (data.version.toString() !== localVer || !localMeta.trainingData) {
                    statusBar.style.background = '#e8f4f8'; statusBar.style.color = '#2980b9'; statusBar.style.borderBottomColor = '#bce0fd';
                    statusBar.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px; vertical-align:middle; animation:spin 1s linear infinite;">download</span> 최신 AI 모델로 자동 업데이트 중입니다...';
                    const loadedModel = await window.tf.loadLayersModel(window.tf.io.fromMemory(JSON.parse(data.topology), JSON.parse(data.weightSpecs), base64ToBuffer(data.weightData)));
                    await loadedModel.save('indexeddb://user-ai-model');
                    localStorage.setItem('user_ai_version', data.version.toString());
                    localStorage.setItem('user_ai_meta', JSON.stringify({vocab: data.vocab, classes: data.classes, trainingData: data.trainingData}));
                    statusBar.style.background = '#eafaf1'; statusBar.style.color = '#27ae60'; statusBar.style.borderBottomColor = '#a9dfbf';
                    statusBar.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px; vertical-align:middle;">check_circle</span> 모델 업데이트 완료!';
                }
                
                userAiModel = await window.tf.loadLayersModel('indexeddb://user-ai-model');
                const meta = JSON.parse(localStorage.getItem('user_ai_meta'));
                userAiVocab = meta.vocab; userAiClasses = meta.classes;
                userAiResponses = {};
                (meta.trainingData || []).forEach(intent => { userAiResponses[intent.name || intent.tag] = intent.responses; });
                
                statusBar.style.background = '#eafaf1'; statusBar.style.color = '#27ae60'; statusBar.style.borderBottomColor = '#a9dfbf';
                statusBar.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px; vertical-align:middle;">check_circle</span> AI 비서가 준비되었습니다.';
                setTimeout(() => statusBar.style.display = 'none', 3000);
            } else {
                statusBar.style.background = '#fadbd8'; statusBar.style.color = '#c0392b'; statusBar.innerHTML = '설계자가 아직 서버에 등록한 모델이 없습니다.';
            }
        } catch (e) {
            statusBar.style.background = '#fadbd8'; statusBar.style.color = '#c0392b'; statusBar.innerHTML = 'AI 다운로드 중 오류가 발생했습니다.';
        }
    }, 100);

    const sendMessage = async () => {
        const text = inputEl.value.trim();
        if (!text) return;
        inputEl.value = ''; inputEl.focus();
        try {
            await setDoc(doc(db, "chats", chatId), { participants: [myUid, targetUid], lastMessage: text, lastMessageTime: serverTimestamp() }, { merge: true });
            await addDoc(collection(db, "chats", chatId, "messages"), { senderId: myUid, text: text, createdAt: serverTimestamp() });
            if (!userAiModel) return;
            setTimeout(async () => {
                // 공통 AI 엔진 호출
                const { response, action } = await getAIResponse(text, userAiModel, userAiVocab, userAiClasses, userAiResponses);

                // 액션 처리
                if (action === 'openNardModal') {
                    document.dispatchEvent(new CustomEvent('openNardModal'));
                } else if (action === 'openSearchModal') {
                    document.getElementById('globalSearchBtn')?.click();
                }

                // Firestore에 AI 응답 저장
                await addDoc(collection(db, "chats", chatId, "messages"), { senderId: 'ai_friend', text: response, createdAt: serverTimestamp() });
                await setDoc(doc(db, "chats", chatId), { lastMessage: response, lastMessageTime: serverTimestamp() }, { merge: true });

            }, 1000);
        } catch (err) { alert("전송에 실패했습니다."); }
    };
    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
};