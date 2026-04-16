import { getAIResponse } from '../plaza/ai_engine.js';

let mainAI;

export const render = (container, aiContext) => {
    mainAI = aiContext;
    container.innerHTML = `
        <style>
            .custom-scrollbar-chat::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar-chat::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar-chat::-webkit-scrollbar-thumb { background-color: #4a5568; border-radius: 3px; }
            .custom-scrollbar-chat::-webkit-scrollbar-thumb:hover { background-color: #718096; }
            .custom-scrollbar-chat::-webkit-scrollbar-button { display: none; }
            .custom-scrollbar-chat {
                scrollbar-width: thin;
                scrollbar-color: #4a5568 transparent;
            }
        </style>
        <div style="display: flex; flex-direction: column; height: calc(100% + 40px); margin: -20px; overflow: hidden;">
            <!-- 채팅 헤더 -->
            <div style="background: #0f172a; padding: 15px 20px; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #8e44ad, #3498db); border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white;">
                        <span class="material-symbols-outlined">smart_toy</span>
                    </div>
                    <div>
                        <div style="font-weight: bold; color: #f1f5f9; font-size: 15px;">GoNard 비서 (Local 128D)</div>
                        <div style="font-size: 11px; color: #10b981; display: flex; align-items: center; gap: 4px;">
                            <span style="width: 6px; height: 6px; background: #10b981; border-radius: 50%; display: inline-block;"></span> Online
                        </div>
                    </div>
                </div>
                <button id="aiLoadModelBtn" style="background: transparent; color: #38bdf8; border: 1px solid #38bdf8; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; transition: 0.2s;">저장된 모델 불러오기</button>
            </div>

            <!-- 대화창 -->
            <div id="aiChatWindow" style="flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px;">
                ${!mainAI.aiModel ? `
                    <div style="text-align: center; color: #94a3b8; font-size: 13px; padding: 20px; border: 1px dashed #334155; border-radius: 8px; margin-top: 20px;">
                        아직 메모리에 로드된 모델이 없습니다.<br>
                        [학습/튜닝] 탭에서 학습을 진행하거나 우측 상단 불러오기 버튼을 클릭하세요.
                    </div>
                ` : `
                    <div style="align-self: flex-start; background: #334155; color: #f1f5f9; padding: 12px 16px; border-radius: 0 16px 16px 16px; font-size: 14px; max-width: 80%; line-height: 1.5;">
                        학습된 비서 봇이 준비되었습니다. 무엇이든 물어보세요!
                    </div>
                `}
            </div>

            <!-- 입력창 -->
            <div style="padding: 10px 15px; background: #0f172a; border-top: 1px solid #334155; display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0;">
                <div style="flex: 1; background: #1e293b; border: 1px solid #334155; border-radius: 20px; overflow: hidden;">
                    <textarea id="aiChatInput" class="custom-scrollbar-chat" rows="1" oninput="this.style.height='auto'; this.style.height=(this.scrollHeight)+'px';" placeholder="비서에게 메시지 전송..." ${!mainAI.aiModel ? 'disabled' : ''} style="width: 100%; background: transparent; border: none; color: white; outline: none; font-size: 14px; resize: none; min-height: 40px; height: 40px; max-height: 120px; line-height: 1.4; font-family: inherit; margin: 0; padding: 10px 15px; box-sizing: border-box; overflow-y: auto;"></textarea>
                </div>
                <button id="aiChatSendBtn" ${!mainAI.aiModel ? 'disabled' : ''} style="width: 40px; height: 40px; background: #38bdf8; color: #0f172a; border: none; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: ${!mainAI.aiModel ? 'not-allowed' : 'pointer'}; opacity: ${!mainAI.aiModel ? '0.5' : '1'}; flex-shrink: 0;">
                    <span class="material-symbols-outlined" style="font-size: 20px; margin-left: 2px;">send</span>
                </button>
            </div>
        </div>
    `;

    document.getElementById('aiLoadModelBtn').addEventListener('click', async () => {
        if (!mainAI.tfLoaded) return alert('TF.js가 로드되지 않았습니다.');
        try {
            const btn = document.getElementById('aiLoadModelBtn');
            btn.textContent = '로딩중...';
            const model = await window.tf.loadLayersModel('indexeddb://user-ai-model');
            mainAI.setAiModel(model);
            const meta = JSON.parse(localStorage.getItem('user_ai_meta'));
            if (meta) { 
                mainAI.setAiVocab(meta.vocab); 
                mainAI.setAiClasses(meta.classes);
                if (meta.trainingData) mainAI.setAiDataset(meta.trainingData);
            }
            alert('저장된 모델을 성공적으로 불러왔습니다!');
            render(container); // UI 새로고침
        } catch (e) {
            console.error(e);
            alert('저장된 모델을 찾을 수 없거나 불러오기에 실패했습니다. 먼저 학습을 진행해주세요.');
            document.getElementById('aiLoadModelBtn').textContent = '저장된 모델 불러오기';
        }
    });

    const chatWindow = document.getElementById('aiChatWindow');
    const chatInput = document.getElementById('aiChatInput');
    const chatSendBtn = document.getElementById('aiChatSendBtn');

    const appendMessage = (text, isUser) => {
        const msgDiv = document.createElement('div');
        msgDiv.style.alignSelf = isUser ? 'flex-end' : 'flex-start';
        msgDiv.style.background = isUser ? '#38bdf8' : '#334155';
        msgDiv.style.color = isUser ? '#0f172a' : '#f1f5f9';
        msgDiv.style.padding = '12px 16px';
        msgDiv.style.borderRadius = isUser ? '16px 16px 0 16px' : '0 16px 16px 16px';
        msgDiv.style.fontSize = '14px';
        msgDiv.style.maxWidth = '80%';
        msgDiv.style.lineHeight = '1.5';
        msgDiv.innerText = text;
        chatWindow.appendChild(msgDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    };

    const handleChat = async () => {
        if (!mainAI.aiModel) return;
        const text = chatInput.value.trim();
        if (!text) return;

        appendMessage(text, true);
        chatInput.value = '';
        chatInput.style.height = '40px';

        const typingDiv = document.createElement('div');
        typingDiv.style.alignSelf = 'flex-start';
        typingDiv.style.color = '#94a3b8';
        typingDiv.style.fontSize = '12px';
        typingDiv.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle; animation: spin 1s linear infinite;">sync</span> 생각하는 중...';
        chatWindow.appendChild(typingDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;

        setTimeout(async () => {
            chatWindow.removeChild(typingDiv);

            const responsesMap = {};
            mainAI.aiDataset.filter(i => i.type === 'intent').forEach(intent => { responsesMap[intent.name] = intent.responses; });

            const { response, action } = await getAIResponse(text, mainAI.aiModel, mainAI.aiVocab, mainAI.aiClasses, responsesMap);

            if (action === 'openNardModal') document.dispatchEvent(new CustomEvent('openNardModal'));
            else if (action === 'openSearchModal') document.getElementById('globalSearchBtn')?.click();
            
            appendMessage(response, false);

        }, 600);
    };

    if (chatSendBtn) chatSendBtn.addEventListener('click', handleChat);
    if (chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat(); } });
};