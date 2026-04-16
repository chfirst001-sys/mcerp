import { auth, escapeHtml } from "../../js/main.js";

export const render = async (container) => {
    if (!auth.currentUser) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#e74c3c;">로그인이 필요합니다.</div>';
        return;
    }

    container.innerHTML = `
        <div class="module-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #2c3e50;">친구 목록</h3>
                <button id="addFriendBtn" style="background: #2980b9; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">+ 친구 추가</button>
            </div>
            
            <div id="friendListContainer" style="display: flex; flex-direction: column; gap: 10px;">
                <!-- AI 친구 기본 제공 -->
                <div class="friend-item" style="display: flex; align-items: center; justify-content: space-between; background: white; padding: 15px; border-radius: 8px; border: 1px solid #eee; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 45px; height: 45px; background: linear-gradient(135deg, #8e44ad, #3498db); color: white; border-radius: 50%; display: flex; justify-content: center; align-items: center; flex-shrink: 0;">
                            <span class="material-symbols-outlined">smart_toy</span>
                        </div>
                        <div>
                            <div style="font-weight: bold; color: #2c3e50; font-size: 15px; margin-bottom: 4px;">AI 친구 (비서)</div>
                            <div style="font-size: 12px; color: #10b981; font-weight: bold;">항상 대기 중</div>
                        </div>
                    </div>
                    <button class="start-chat-btn" data-uid="ai_friend" data-name="AI 친구" style="background: #f0f3f4; color: #2980b9; border: none; padding: 8px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" title="대화하기" onmouseover="this.style.background='#e8f4f8'" onmouseout="this.style.background='#f0f3f4'">
                        <span class="material-symbols-outlined" style="font-size: 20px;">chat</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    container.querySelectorAll('.start-chat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            sessionStorage.setItem('openChatWith', e.currentTarget.dataset.uid);
            sessionStorage.setItem('openChatWithName', e.currentTarget.dataset.name);
            document.querySelector('.sub-tab-btn[data-tab="chat"]')?.click();
        });
    });

    document.getElementById('addFriendBtn').addEventListener('click', () => {
        alert('P2P 기반 친구 추가 기능은 추후 연동될 예정입니다.');
    });
};