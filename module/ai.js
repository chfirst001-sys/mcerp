import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, escapeHtml } from "../js/main.js";

// --- Global State for AI Module ---
let tfLoaded = false;
let currentAITab = 'dataset';
const tabIds = ['dataset', 'train', 'version', 'trigger', 'test', 'guide'];
let currentTabIndex = 0;
let subTabButtons = null;
let lastReclickTime = 0;
let currentSubModule = null;

// --- Shared State between sub-modules ---
export let aiModel = null;
export let aiVocab = [];
export let aiClasses = [];
export let aiDataset = [];
export let modelStats = { isTrained: false, lastTrainTime: null, trainingDuration: 0, epochs: 0, batchSize: 0, learningRate: 0, finalLoss: null, finalAccuracy: null, vocabSize: 0, numClasses: 0, numSamples: 0 };

// --- State for Dataset UI ---
export let collapsedStates = {};
export let selectedFolderId = null;
export let editingItemId = null;
export let isAddingNew = null;
export let movingItemId = null;
export let menuOpenStates = {};
export let menuTimers = {};

// --- UI Rerender Helper ---
const rerenderCurrentTabWithScroll = () => {
    const content = document.getElementById('aiTabContent');
    if (!content) return;
    const scrollTop = content.scrollTop;
    
    if (currentSubModule && currentSubModule.render) {
        currentSubModule.render(content, aiContext);
        // Restore scroll position after a short delay to allow the DOM to update
        setTimeout(() => {
            content.scrollTop = scrollTop;
        }, 0);
    } else {
        // Fallback to full reload if something is wrong
        loadSubModule(currentAITab).then(() => {
            setTimeout(() => { content.scrollTop = scrollTop; }, 0);
        });
    }
};

// --- Setters for state mutation from sub-modules ---
export const setAiModel = (model) => { aiModel = model; };
export const setAiVocab = (vocab) => { aiVocab = vocab; };
export const setAiClasses = (classes) => { aiClasses = classes; };
export const setAiDataset = (dataset) => { aiDataset = dataset; };
export const setModelStats = (stats) => { modelStats = stats; };
export const setCollapsedStates = (states) => { collapsedStates = states; };
export const setSelectedFolderId = (id) => { selectedFolderId = id; };
export const setEditingItemId = (id) => { editingItemId = id; };
export const setIsAddingNew = (val) => { isAddingNew = val; };
export const setMovingItemId = (id) => { movingItemId = id; };
export const setMenuOpenStates = (states) => { menuOpenStates = states; };
export const setMenuTimers = (timers) => { menuTimers = timers; };

// --- Shared Utility Functions ---
export const bufferToBase64 = (buffer) => { let binary = ''; const bytes = new Uint8Array(buffer); for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); } return btoa(binary); };
export const tokenize = (text) => text.replace(/[.,!?]/g, '').trim().split(/\s+/);
export const preprocessData = () => {
    let words = [], classes = [], documents = [];
    const intents = aiDataset.filter(item => item.type === 'intent');
    intents.forEach(intent => {
        if (!classes.includes(intent.name)) classes.push(intent.name);
        intent.patterns.forEach(pattern => { const w = tokenize(pattern); words.push(...w); documents.push({ words: w, tag: intent.name }); });
    });
    words = [...new Set(words)].sort(); classes = classes.sort();
    aiVocab = words; aiClasses = classes;
    let trainingX = [], trainingY = [];
    documents.forEach(doc => {
        trainingX.push(words.map(w => doc.words.includes(w) ? 1 : 0));
        trainingY.push(classes.map(c => c === doc.tag ? 1 : 0));
    });
    return { x: trainingX, y: trainingY };
};
export const toggleDatasetMenu = (id) => {
    const wasOpen = menuOpenStates[id];
    menuOpenStates = {}; // Close all other menus
    if (!wasOpen) {
        menuOpenStates[id] = true;
        resetDatasetMenuTimer(id);
    }
    rerenderCurrentTabWithScroll();
};
export const resetDatasetMenuTimer = (id) => {
    if (menuTimers[id]) clearTimeout(menuTimers[id]);
    menuTimers[id] = setTimeout(() => {
        delete menuOpenStates[id];
        rerenderCurrentTabWithScroll();
    }, 5000);
};
export const moveItemOrder = (itemId, direction) => {
    const item = aiDataset.find(i => i.id === itemId);
    if (!item) return;
    const siblings = aiDataset.filter(i => i.parentId === item.parentId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const currentIndex = siblings.findIndex(i => i.id === itemId);
    if (direction === 'up' && currentIndex > 0) {
        const prevSibling = siblings[currentIndex - 1];
        [item.sortOrder, prevSibling.sortOrder] = [prevSibling.sortOrder, item.sortOrder];
    } else if (direction === 'down' && currentIndex < siblings.length - 1) {
        const nextSibling = siblings[currentIndex + 1];
        [item.sortOrder, nextSibling.sortOrder] = [nextSibling.sortOrder, item.sortOrder];
    }
    localStorage.setItem('gonard-ai-dataset', JSON.stringify(aiDataset));
    rerenderCurrentTabWithScroll();
};
export const indentItem = (itemId) => {
    const item = aiDataset.find(i => i.id === itemId);
    if (!item) return;
    const siblings = aiDataset.filter(i => i.parentId === item.parentId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const currentIndex = siblings.findIndex(i => i.id === itemId);
    if (currentIndex > 0) {
        const prevSibling = siblings[currentIndex - 1];
        if (prevSibling.type === 'folder') {
            item.parentId = prevSibling.id;
            item.sortOrder = Date.now();
            collapsedStates[prevSibling.id] = false;
            localStorage.setItem('gonard-ai-dataset', JSON.stringify(aiDataset));
            rerenderCurrentTabWithScroll();
        } else { alert('폴더 안으로만 이동할 수 있습니다.'); }
    }
};
export const outdentItem = (itemId) => {
    const item = aiDataset.find(i => i.id === itemId);
    if (!item || !item.parentId) return;
    const parent = aiDataset.find(i => i.id === item.parentId);
    if (parent) { 
        item.parentId = parent.parentId; 
        item.sortOrder = parent.sortOrder + 1; 
        localStorage.setItem('gonard-ai-dataset', JSON.stringify(aiDataset));
        rerenderCurrentTabWithScroll();
    }
};

const aiContext = {
    get aiModel() { return aiModel; }, setAiModel(v) { aiModel = v; },
    get aiVocab() { return aiVocab; }, setAiVocab(v) { aiVocab = v; },
    get aiClasses() { return aiClasses; }, setAiClasses(v) { aiClasses = v; },
    get aiDataset() { return aiDataset; }, setAiDataset(v) { aiDataset = v; },
    get modelStats() { return modelStats; }, setModelStats(v) { modelStats = v; },
    get collapsedStates() { return collapsedStates; }, setCollapsedStates(v) { collapsedStates = v; },
    get selectedFolderId() { return selectedFolderId; }, setSelectedFolderId(v) { selectedFolderId = v; },
    get editingItemId() { return editingItemId; }, setEditingItemId(v) { editingItemId = v; },
    get isAddingNew() { return isAddingNew; }, setIsAddingNew(v) { isAddingNew = v; },
    get movingItemId() { return movingItemId; }, setMovingItemId(v) { movingItemId = v; },
    get menuOpenStates() { return menuOpenStates; }, setMenuOpenStates(v) { menuOpenStates = v; },
    get menuTimers() { return menuTimers; }, setMenuTimers(v) { menuTimers = v; },
    get tfLoaded() { return tfLoaded; },
    bufferToBase64, tokenize, preprocessData, toggleDatasetMenu, resetDatasetMenuTimer, moveItemOrder, indentItem, outdentItem, escapeHtml
};

// 기본 제공되는 비서용 데이터셋 (나드(GoNard) 환경에 맞춤)
const defaultTrainingData = [
    { tag: "greeting", patterns: ["안녕", "반가워", "누구야", "너는 누구니", "인사해줘"], responses: ["안녕하세요! GoNard의 AI 비서입니다.", "반갑습니다! 무엇을 도와드릴까요?"] },
    { tag: "goodbye", patterns: ["잘가", "나중에 봐", "종료해", "수고했어", "안녕히 계세요"], responses: ["이용해 주셔서 감사합니다. 좋은 하루 보내세요!", "필요하시면 언제든 다시 불러주세요."] },
    { tag: "search_nard", patterns: ["나드 검색해줘", "메모 찾아줘", "기록 검색", "문서 찾아"], responses: ["어떤 키워드로 나드를 검색해 드릴까요?", "통합 검색창을 띄워드릴 수 있습니다. 검색어를 말씀해주세요."] },
    { tag: "schedule", patterns: ["오늘 일정", "스케줄 확인해", "마감일 언제야", "뭐 해야해"], responses: ["오늘 예정된 일정을 스케줄 탭에서 확인하시겠어요?", "다가오는 마감일이 있는 나드를 확인해 드릴게요."] },
    { tag: "create_memo", patterns: ["메모 작성해", "새 나드 만들어", "기록해줘", "받아적어"], responses: ["새로운 나드 작성 창을 열어드릴게요.", "어떤 내용을 기록할까요? 말씀해주세요."] },
    { tag: "time_check", patterns: ["지금 몇 시야", "현재 시간", "시간 알려줘"], responses: ["현재 시간은 {{TIME}}입니다.", "지금은 {{TIME}}이에요."]},
    { tag: "date_check", patterns: ["오늘 며칠이야", "오늘 날짜", "날짜 알려줘", "무슨 요일이야"], responses: ["오늘은 {{DATE}}입니다.", "{{DATE}}이에요."]},
    { tag: "fallback", patterns: ["ㅋㅋ", "ㅎㅎ", "아니", "음", "어", "그게", "테스트", "몰라", "아무거나", "ㅇㅇ", "뭐지"], responses: ["무슨 말씀이신지 잘 이해하지 못했어요. 다르게 표현해 주실 수 있나요?", "제가 아직 배우지 않은 내용이네요. 좀 더 구체적으로 말씀해주시면 감사하겠습니다!"] }
];

// 의존성 라이브러리(TensorFlow.js) 동적 로드
const loadDependencies = async () => {
    if (window.tf) { tfLoaded = true; return true; }
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js";
        script.onload = () => { tfLoaded = true; resolve(true); };
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });
};

export const init = async (container) => {
    currentAITab = 'dataset';
    currentTabIndex = 0;

    container.innerHTML = `
        <style>
            @media (max-width: 768px) {
                #ai-dataset-layout, #ai-train-layout {
                    flex-direction: column;
                }
                #ai-dataset-form {
                    position: static !important;
                }
            }
            .dataset-action-menu { display: flex; align-items: center; gap: 2px; overflow-x: auto; transition: all 0.3s ease; max-width: 0; opacity: 0; white-space: nowrap; scrollbar-width: none; -ms-overflow-style: none; }
            .dataset-action-menu::-webkit-scrollbar { display: none; }
            .dataset-action-menu.expanded { max-width: 90px; opacity: 1; margin-right: 4px; }
            .dataset-action-btn { background: transparent; border: 1px solid #334155; color: #94a3b8; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; }
            .dataset-action-btn:hover { background: #334155; color: white; }
            .dataset-action-btn .material-symbols-outlined { font-size: 16px; }
            
            .form-label { display: block; font-size: 12px; color: #94a3b8; margin-bottom: 5px; font-weight: bold; }
            .form-input { width: 100%; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: white; margin-bottom: 15px; box-sizing: border-box; font-size: 14px; }
            .form-input:focus { border-color: #3b82f6; outline: none; }
            }
            .ai-sub-tab-menu {
                -ms-overflow-style: none; /* IE and Edge */
                scrollbar-width: none; /* Firefox */
            }
            .ai-sub-tab-menu::-webkit-scrollbar {
                display: none; /* Chrome, Safari and Opera */
            }
        </style>
        <div style="display: flex; flex-direction: column; height: calc(100vh - 121px); overflow: hidden; background: #0f172a; color: #f1f5f9; margin: -14px -15px -20px -15px;">
            <!-- 헤더 및 탭 영역 -->
            <div style="background: linear-gradient(90deg, #1e293b, #0f172a); padding: 20px; border-bottom: 1px solid #334155; flex-shrink: 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h2 style="margin: 0; font-size: 20px; color: #38bdf8; display: flex; align-items: center; gap: 8px;">
                        <span class="material-symbols-outlined" style="font-size: 28px;">psychology</span> Ai 학습
                    </h2>
                    <div id="tfStatus" style="font-size: 12px; background: #334155; padding: 4px 8px; border-radius: 12px; display: flex; align-items: center; gap: 4px;">
                        <span class="material-symbols-outlined" style="font-size: 14px; color: #f59e0b;">sync</span> 로딩중...
                    </div>
                </div>
                <div class="ai-sub-tab-menu" style="display: flex; gap: 10px; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch;">
                    <button class="ai-tab-btn active" data-tab="dataset" style="flex-shrink: 0; background: #38bdf8; color: #0f172a; border: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">📊 데이터셋</button>
                    <button class="ai-tab-btn" data-tab="train" style="flex-shrink: 0; background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">⚙️ 학습/튜닝</button>
                    <button class="ai-tab-btn" data-tab="version" style="flex-shrink: 0; background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">📈 모델버전</button>
                    <button class="ai-tab-btn" data-tab="trigger" style="flex-shrink: 0; background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">⚡ Ai트리거</button>
                    <button class="ai-tab-btn" data-tab="test" style="flex-shrink: 0; background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">💬 봇 테스트</button>
                    <button class="ai-tab-btn" data-tab="guide" style="flex-shrink: 0; background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">📖 사용 설명서</button>
                </div>
            </div>

            <!-- 본문 영역 -->
            <div id="aiTabContent" style="flex: 1; overflow-y: auto; padding: 20px; position: relative;">
                <!-- 데이터셋 로딩 스켈레톤 -->
            </div>
        </div>
    `;

    // TF.js 로드 상태 업데이트
    const loaded = await loadDependencies();
    const tfStatus = document.getElementById('tfStatus');
    if (loaded) {
        tfStatus.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px; color: #10b981;">check_circle</span> TF.js';
        tfStatus.style.background = '#064e3b';
        tfStatus.style.color = '#34d399';
        
        const savedData = localStorage.getItem('gonard-ai-dataset');
        let loadedSuccessfully = false;
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                if (Array.isArray(parsedData) && parsedData.length > 0 && parsedData.every(item => item && typeof item === 'object' && item.id && item.type)) {
                    setAiDataset(parsedData);
                    loadedSuccessfully = true;
                } 
                else if (Array.isArray(parsedData) && parsedData.length > 0 && parsedData[0] && parsedData[0].tag && !parsedData[0].type) {
                    const newDataset = [{ id: 'folder_root', parentId: null, type: 'folder', name: '기본 분류', sortOrder: 0 }];
                    parsedData.forEach((intent, index) => {
                        if (intent && intent.tag) {
                            newDataset.push({
                                id: `intent_${Date.now()}_${index}`, parentId: 'folder_root', sortOrder: index + 1,
                                type: 'intent', name: intent.tag, 
                                patterns: Array.isArray(intent.patterns) ? intent.patterns : [], 
                                responses: Array.isArray(intent.responses) ? intent.responses : []
                            });
                        }
                    });
                    setAiDataset(newDataset);
                    localStorage.setItem('gonard-ai-dataset', JSON.stringify(newDataset));
                    loadedSuccessfully = true;
                }
            } catch (e) {
                console.error("AI 데이터셋 파싱 오류:", e);
            }
        }

        if (!loadedSuccessfully) {
            // 최초 실행 시 기본 데이터셋을 트리 구조로 초기화
            const newDataset = [{ id: 'folder_root', parentId: null, type: 'folder', name: '기본 분류', sortOrder: 0 }];
            defaultTrainingData.forEach((intent, index) => {
                newDataset.push({ id: `intent_${Date.now()}_${index}`, parentId: 'folder_root', type: 'intent', name: intent.tag, patterns: intent.patterns, responses: intent.responses, sortOrder: index + 1 });
            });
            setAiDataset(newDataset);
        }

        aiDataset.forEach((item, index) => {
            if (!item || typeof item !== 'object') return;
            if (item.sortOrder === undefined) item.sortOrder = index;
            if (item.type === 'intent') {
                if (!Array.isArray(item.patterns)) item.patterns = [];
                if (!Array.isArray(item.responses)) item.responses = [];
            }
        });
    } else {
        tfStatus.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px; color: #ef4444;">error</span> TF.js Load Failed';
        tfStatus.style.background = '#7f1d1d';
        tfStatus.style.color = '#fca5a5';
    }

    const tabBtns = container.querySelectorAll('.ai-tab-btn');
    subTabButtons = tabBtns;
    tabBtns.forEach((btn, index) => {
        btn.addEventListener('click', (e) => {
            currentTabIndex = index;
            tabBtns.forEach(b => {
                b.style.background = '#1e293b'; b.style.color = '#94a3b8'; b.style.border = '1px solid #334155'; b.classList.remove('active');
            });
            e.target.style.background = '#38bdf8'; e.target.style.color = '#0f172a'; e.target.style.border = 'none'; e.target.classList.add('active');
            currentAITab = e.target.dataset.tab;
            loadSubModule(currentAITab);
            e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
    });

    loadSubModule(currentAITab);
};

const loadSubModule = async (tabId) => {
    const content = document.getElementById('aiTabContent');
    if (!content) return;
    content.innerHTML = '<div style="text-align: center; padding: 20px; color: #94a3b8;">로딩 중...</div>';

    try {
        const module = await import(`./ai/${tabId}.js?v=20260416_06`);
        currentSubModule = module;
        module.render(content, aiContext);
    } catch (e) {
        console.error(`AI sub-module load failed (${tabId}):`, e);
        content.innerHTML = `<div style="text-align: center; padding: 20px; color: #ef4444;">모듈 로드 실패: ${e.message}</div>`;
    }
};

export const onReclick = () => {
    if (!subTabButtons) return;
    
    const now = Date.now();
    if (now - lastReclickTime < 300) return; 
    lastReclickTime = now;

    currentTabIndex = (currentTabIndex + 1) % tabIds.length;
    subTabButtons[currentTabIndex].click();
};