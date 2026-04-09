import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, auth, escapeHtml } from "../js/main.js";

const tabIds = ['friend', 'chat', 'community'];
let currentTabIndex = 0;
let subTabButtons = null;
let unsubscribeChat = null; // 실시간 채팅 리스너 해제용

export const init = (container) => {
    container.innerHTML = `
        <!-- 상단 서브 탭 메뉴 -->
        <div class="sub-tab-menu">
            <button class="sub-tab-btn active" data-tab="friend">친구</button>
            <button class="sub-tab-btn" data-tab="chat">대화</button>
            <button class="sub-tab-btn" data-tab="community">광장</button>
        </div>

        <!-- 하위 메뉴별 컨텐츠가 렌더링될 영역 -->
        <div class="module-card" id="plazaContent">
        </div>
    `;

    subTabButtons = container.querySelectorAll('.sub-tab-btn');

    // 탭 클릭 이벤트 등록
    subTabButtons.forEach((btn, index) => {
        btn.addEventListener('click', (e) => {
            currentTabIndex = index;
            subTabButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            renderTabContent(e.target.dataset.tab);
            
            e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
    });

    // 초기 렌더링
    renderTabContent(tabIds[currentTabIndex]);
};

const renderTabContent = (tabId) => {
    // 다른 탭으로 이동할 때 기존 채팅방 실시간 리스너 해제 (메모리 누수 방지)
    if (unsubscribeChat) {
        unsubscribeChat();
        unsubscribeChat = null;
    }

    const content = document.getElementById('plazaContent');
    
    if (tabId === 'friend') {
        content.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #2c3e50;">내 친구 목록</h3>
                <button style="background: #27ae60; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                    <span class="material-symbols-outlined" style="font-size: 16px;">person_add</span> 친구 추가
                </button>
            </div>
            <div style="text-align: center; padding: 40px 20px; color: #7f8c8d; background: #f8f9fa; border-radius: 8px; border: 1px dashed #ccc;">
                <span class="material-symbols-outlined" style="font-size: 40px; color: #bdc3c7; margin-bottom: 10px;">group</span><br>
                등록된 친구가 없습니다.<br><span style="font-size: 12px;">새로운 친구를 추가하고 소통을 시작해보세요.</span>
            </div>
        `;
    } else if (tabId === 'chat') {
        const bId = localStorage.getItem('selectedBuildingId');
        const bName = localStorage.getItem('selectedBuildingName') || '전체 건물';

        if (!bId) {
            content.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #e74c3c; background: #fdf2e9; border-radius: 8px; border: 1px solid #f8c471; margin-bottom: 15px; font-size: 13px;">
                    선택된 건물이 없어 채팅방에 입장할 수 없습니다.<br>사이드바에서 건물을 먼저 선택해주세요.
                </div>
            `;
            return;
        }

        content.innerHTML = `
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

        // Firebase 실시간 리스너 연결
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
            messagesDiv.scrollTop = messagesDiv.scrollHeight; // 스크롤 맨 아래로 자동 이동
        });

        // 메시지 전송 로직
        const sendMessage = async () => {
            const inputEl = document.getElementById('chatInput');
            const text = inputEl.value.trim();
            if (!text) return;
            
            if (!auth.currentUser) return alert('로그인이 필요합니다.');

            inputEl.value = ''; // 입력창 즉시 비우기 (체감 속도 향상)
            
            try {
                await addDoc(collection(db, "buildings", bId, "chats"), {
                    uid: auth.currentUser.uid,
                    email: auth.currentUser.email,
                    name: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
                    text: text,
                    createdAt: serverTimestamp()
                });
            } catch (error) {
                console.error("메시지 전송 실패:", error);
                alert("메시지 전송에 실패했습니다.");
            }
        };

        document.getElementById('sendChatBtn').addEventListener('click', sendMessage);
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    } else if (tabId === 'community') {
        const bId = localStorage.getItem('selectedBuildingId');
        const bName = localStorage.getItem('selectedBuildingName') || '전체 건물';
        
        let defaultPlazaHtml = '';
        if (bId) {
            defaultPlazaHtml = `
                <div class="plaza-list-item" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; background: #fff; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; align-items: center; gap: 15px; margin-bottom: 15px; transition: background 0.2s;" onmouseover="this.style.background='#f4f6f8'" onmouseout="this.style.background='#fff'">
                    <div style="background: #e8f4f8; color: #2980b9; width: 50px; height: 50px; border-radius: 12px; display: flex; justify-content: center; align-items: center; flex-shrink: 0;">
                        <span class="material-symbols-outlined" style="font-size: 28px;">domain</span>
                    </div>
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                            <h4 style="margin: 0; color: #2c3e50; font-size: 15px;">${escapeHtml(bName)} 공식 광장</h4>
                            <span style="background: #27ae60; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px;">기본</span>
                        </div>
                        <div style="font-size: 12px; color: #7f8c8d;">입주민과 관리자가 소통하는 건물 전용 커뮤니티입니다.</div>
                    </div>
                    <span class="material-symbols-outlined" style="color: #bdc3c7;">chevron_right</span>
                </div>
            `;
        } else {
            defaultPlazaHtml = `
                <div style="text-align: center; padding: 20px; color: #e74c3c; background: #fdf2e9; border-radius: 8px; border: 1px solid #f8c471; margin-bottom: 15px; font-size: 13px;">
                    선택된 건물이 없어 기본 건물 광장을 표시할 수 없습니다.<br>사이드바에서 건물을 선택해주세요.
                </div>
            `;
        }

        content.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #2c3e50;">내 광장 목록</h3>
                <button style="background: #f39c12; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                    <span class="material-symbols-outlined" style="font-size: 16px;">add_circle</span> 새 광장 만들기
                </button>
            </div>
            
            <div style="display: flex; flex-direction: column;">
                ${defaultPlazaHtml}
                
                <div style="text-align: center; padding: 30px 20px; color: #7f8c8d; background: #f8f9fa; border-radius: 8px; border: 1px dashed #ccc;">
                    <span class="material-symbols-outlined" style="font-size: 32px; color: #bdc3c7; margin-bottom: 10px;">diversity_3</span><br>
                    가입된 다른 광장이 없습니다.<br><span style="font-size: 12px;">관심사에 맞는 새로운 소모임 광장을 만들어보세요.</span>
                </div>
            </div>
        `;
    }
};

let lastReclickTime = 0;

// 하단 탭을 다시 눌렀을 때 로테이션으로 서브 탭 이동
export const onReclick = () => {
    if (!subTabButtons) return;
    const now = Date.now();
    if (now - lastReclickTime < 300) return; 
    lastReclickTime = now;
    currentTabIndex = (currentTabIndex + 1) % tabIds.length;
    subTabButtons[currentTabIndex].click();
};