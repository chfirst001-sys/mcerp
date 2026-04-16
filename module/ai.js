import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, escapeHtml } from "../js/main.js";

let tfLoaded = false;
let currentAITab = 'dataset';
const tabIds = ['dataset', 'train', 'version', 'test', 'guide'];
let currentTabIndex = 0;
let subTabButtons = null;
let lastReclickTime = 0;

let aiModel = null;
let aiVocab = [];
let aiClasses = [];
let aiDataset = [];
let collapsedStates = {};
let selectedFolderId = null;
let editingItemId = null;
let isAddingNew = null; // { type: 'folder' | 'intent' }
let modelStats = {
    isTrained: false,
    lastTrainTime: null,
    trainingDuration: 0,
    epochs: 0,
    batchSize: 0,
    learningRate: 0,
    finalLoss: null,
    finalAccuracy: null,
    vocabSize: 0,
    numClasses: 0,
    numSamples: 0,
};

// 모델 데이터를 DB에 올리기 위해 텍스트(Base64)로 변환하는 유틸리티
const bufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
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
    if (window.tf) {
        tfLoaded = true;
        return true;
    }
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js";
        script.onload = () => {
            tfLoaded = true;
            resolve(true);
        };
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });
};

// 간단한 한국어 토크나이저 (형태소 분석 대신 띄어쓰기 및 특수문자 제거 활용)
const tokenize = (text) => {
    return text.replace(/[.,!?]/g, '').trim().split(/\s+/);
};

// 데이터 전처리 및 Bag of Words (BoW) 생성
const preprocessData = () => {
    let words = [];
    let classes = [];
    let documents = [];
    
    const intents = aiDataset.filter(item => item.type === 'intent');
    intents.forEach(intent => {
        if (!classes.includes(intent.name)) classes.push(intent.name);
        intent.patterns.forEach(pattern => {
            const w = tokenize(pattern);
            words.push(...w);
            documents.push({ words: w, tag: intent.name });
        });
    });

    // 중복 제거 및 정렬
    words = [...new Set(words)].sort();
    classes = classes.sort();
    
    aiVocab = words;
    aiClasses = classes;

    let trainingX = [];
    let trainingY = [];

    documents.forEach(doc => {
        let bag = words.map(w => doc.words.includes(w) ? 1 : 0);
        let outputRow = classes.map(c => c === doc.tag ? 1 : 0);
        trainingX.push(bag);
        trainingY.push(outputRow);
    });

    return { x: trainingX, y: trainingY };
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
                        <span class="material-symbols-outlined" style="font-size: 28px;">psychology</span> AI 비서 학습 스튜디오
                    </h2>
                    <div id="tfStatus" style="font-size: 12px; background: #334155; padding: 4px 8px; border-radius: 12px; display: flex; align-items: center; gap: 4px;">
                        <span class="material-symbols-outlined" style="font-size: 14px; color: #f59e0b;">sync</span> 로딩중...
                    </div>
                </div>
                <div class="ai-sub-tab-menu" style="display: flex; gap: 10px; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch;">
                    <button class="ai-tab-btn active" data-tab="dataset" style="flex-shrink: 0; background: #38bdf8; color: #0f172a; border: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">📊 데이터셋</button>
                    <button class="ai-tab-btn" data-tab="train" style="flex-shrink: 0; background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">⚙️ 학습/튜닝</button>
                    <button class="ai-tab-btn" data-tab="version" style="flex-shrink: 0; background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">📈 모델버전</button>
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
        tfStatus.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px; color: #10b981;">check_circle</span> TF.js Ready';
        tfStatus.style.background = '#064e3b';
        tfStatus.style.color = '#34d399';

        const savedData = localStorage.getItem('gonard-ai-dataset');
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            // 구버전(평탄한 배열) 데이터를 신규 트리 구조로 마이그레이션
            if (Array.isArray(parsedData) && parsedData.length > 0 && parsedData[0].tag && !parsedData[0].type) {
                aiDataset = [{ id: 'folder_root', parentId: null, type: 'folder', name: '기본 분류' }];
                parsedData.forEach((intent, index) => {
                    aiDataset.push({
                        id: `intent_${Date.now()}_${index}`,
                        parentId: 'folder_root',
                        type: 'intent',
                        name: intent.tag,
                        patterns: intent.patterns,
                        responses: intent.responses
                    });
                });
                localStorage.setItem('gonard-ai-dataset', JSON.stringify(aiDataset));
            } else {
                aiDataset = parsedData;
            }
        } else {
            // 최초 실행 시 기본 데이터셋을 트리 구조로 초기화
            aiDataset = [{ id: 'folder_root', parentId: null, type: 'folder', name: '기본 분류' }];
            defaultTrainingData.forEach((intent, index) => {
                const newIntent = { id: `intent_${Date.now()}_${index}`, parentId: 'folder_root', type: 'intent', name: intent.tag, patterns: intent.patterns, responses: intent.responses };
                aiDataset.push(newIntent);
            });
        }
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
            renderAITab();
            e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
    });

    renderAITab();
};

const renderAITab = () => {
    const content = document.getElementById('aiTabContent');
    if (!content) return;

    if (currentAITab === 'dataset') { // ------------------- 데이터셋 탭 -------------------
        content.innerHTML = `
            <div id="ai-dataset-controls" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; gap: 10px;">
                <div style="position: relative; flex: 1;">
                    <input type="search" id="aiDatasetSearchInput" placeholder="데이터셋 검색 (Tag, 패턴, 응답)..." style="width: 100%; padding: 8px 12px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: white; box-sizing: border-box;">
                    <span class="material-symbols-outlined" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #64748b;">search</span>
                </div>
                <div style="display: flex; gap: 5px; align-items: center;">
                    <button id="aiAddNewFolderBtn" title="새 폴더" style="background: #f59e0b; color: white; border: none; padding: 6px; border-radius: 4px; font-size: 12px; cursor: pointer; display: flex; align-items: center;"><span class="material-symbols-outlined" style="font-size:18px;">create_new_folder</span></button>
                    <button id="aiAddNewIntentBtn" title="새 인텐트" style="background: #10b981; color: white; border: none; padding: 6px; border-radius: 4px; font-size: 12px; cursor: pointer; display: flex; align-items: center;"><span class="material-symbols-outlined" style="font-size:18px;">note_add</span></button>
                    <div style="width: 1px; height: 20px; background: #334155;"></div>
                    <button id="aiUpdateBtn" title="서버에서 업데이트" style="background: #10b981; color: white; border: none; padding: 6px; border-radius: 4px; font-size: 12px; cursor: pointer; display: flex; align-items: center;"><span class="material-symbols-outlined" style="font-size: 18px;">cloud_download</span></button>
                    <button id="aiUploadBtn" title="서버로 업로드" style="background: #8b5cf6; color: white; border: none; padding: 6px; border-radius: 4px; font-size: 12px; cursor: pointer; display: flex; align-items: center;"><span class="material-symbols-outlined" style="font-size: 18px;">cloud_upload</span></button>
                    <button id="aiSaveDataBtn" title="로컬에 저장" style="background: #3b82f6; color: white; border: none; padding: 6px; border-radius: 4px; font-size: 12px; cursor: pointer; display: flex; align-items: center;"><span class="material-symbols-outlined" style="font-size: 18px;">save</span></button>
                </div>
            </div>
            <div id="ai-dataset-form-container"></div>
            <div id="ai-dataset-list-container" style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 15px; min-height: 300px;"></div>
        `;
        renderDatasetView();
        attachDatasetControlEvents();

    } else if (currentAITab === 'train') { // ------------------- 학습/튜닝 탭 -------------------
        content.innerHTML = `
            <div id="ai-train-layout" style="height: 100%;">
                <!-- 모델 튜닝 파라미터 -->
                <div id="ai-hp-form" style="background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; display: flex; flex-direction: column; margin-bottom: 20px; max-width: 600px; margin: 0 auto;">
                    <h3 style="margin-top: 0; color: #f1f5f9; font-size: 16px; margin-bottom: 20px;">하이퍼파라미터 튜닝</h3>
                    
                    <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 5px;">Epochs (반복 횟수)</label>
                    <input type="number" id="hpEpochs" value="150" style="width: 100%; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: white; margin-bottom: 15px; box-sizing: border-box;">
                    
                    <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 5px;">Batch Size (배치 크기)</label>
                    <input type="number" id="hpBatch" value="8" style="width: 100%; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: white; margin-bottom: 15px; box-sizing: border-box;">
                    
                    <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 5px;">Learning Rate (학습률)</label>
                    <input type="number" id="hpLr" value="0.01" step="0.001" style="width: 100%; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: white; margin-bottom: 20px; box-sizing: border-box;">
                    
                    <div style="background: #0f172a; border: 1px dashed #38bdf8; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <div style="font-size: 13px; color: #38bdf8; font-weight: bold; margin-bottom: 8px;">신경망 아키텍처 (Fixed)</div>
                        <ul style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 12px; line-height: 1.6;">
                            <li>Input Layer: BoW (Vocab Size)</li>
                            <li><strong>Hidden Layer 1: Dense (128 units, ReLU)</strong></li>
                            <li>Dropout Layer: Rate 0.5</li>
                            <li>Hidden Layer 2: Dense (64 units, ReLU)</li>
                            <li>Output Layer: Dense (Classes, Softmax)</li>
                        </ul>
                    </div>

                    <button id="aiStartTrainBtn" style="width: 100%; background: #3b82f6; color: white; border: none; padding: 14px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 15px;">🚀 모델 학습 시작</button>
                </div>

                <!-- 학습 로그 출력 -->
                <div id="ai-log-view" style="display: none; height: 100%; background: #050505; padding: 15px; border-radius: 12px; border: 1px solid #334155; flex-direction: column; font-family: 'Courier New', monospace;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 10px;">
                        <span style="color: #10b981; font-size: 14px; font-weight: bold;">[TF.js Console] Training Logs</span>
                        <div style="display: flex; gap: 5px;">
                            <button id="aiBackToHpBtn" style="background: #334155; color: white; border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; display: none;">다시 튜닝하기</button>
                            <button id="aiSaveModelBtn" style="background: #27ae60; color: white; border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; display: none;">모델 디바이스 저장</button>
                        </div>
                    </div>
                    <div id="aiLogArea" style="flex: 1; overflow-y: auto; color: #d4d4d4; font-size: 13px; line-height: 1.5; padding-right: 5px;">
                        시스템 준비 완료. '모델 학습 시작' 버튼을 누르세요...
                    </div>
                </div>
            </div>
        `;

        document.getElementById('aiStartTrainBtn').addEventListener('click', async () => {
            if (!tfLoaded) return alert('TensorFlow.js가 로드되지 않았습니다.');
            
            const epochs = parseInt(document.getElementById('hpEpochs').value) || 150;
            const batchSize = parseInt(document.getElementById('hpBatch').value) || 8;
            const lr = parseFloat(document.getElementById('hpLr').value) || 0.01;
            
            const logArea = document.getElementById('aiLogArea');
            const log = (msg) => { logArea.innerHTML += `<div>${msg}</div>`; logArea.scrollTop = logArea.scrollHeight; };
            
            document.getElementById('ai-hp-form').style.display = 'none';
            document.getElementById('ai-log-view').style.display = 'flex';

            const startTime = Date.now();
            document.getElementById('aiSaveModelBtn').style.display = 'none';
            document.getElementById('aiBackToHpBtn').style.display = 'none';
            logArea.innerHTML = '';

            try {
                log('<span style="color: #38bdf8;">[1/4]</span> 데이터 전처리 및 토큰화 중...');
                const { x, y } = preprocessData();
                log(` - Vocab Size: ${aiVocab.length}`);
                log(` - Classes: ${aiClasses.length}`);
                log(` - Training Samples: ${x.length}`);

                const xs = window.tf.tensor2d(x);
                const ys = window.tf.tensor2d(y);

                log('<span style="color: #38bdf8;">[2/4]</span> 128차원 신경망 모델 빌드 중...');
                aiModel = window.tf.sequential();
                aiModel.add(window.tf.layers.dense({ units: 128, inputShape: [aiVocab.length], activation: 'relu' }));
                aiModel.add(window.tf.layers.dropout({ rate: 0.5 }));
                aiModel.add(window.tf.layers.dense({ units: 64, activation: 'relu' }));
                aiModel.add(window.tf.layers.dense({ units: aiClasses.length, activation: 'softmax' }));

                const optimizer = window.tf.train.adam(lr);
                aiModel.compile({ optimizer: optimizer, loss: 'categoricalCrossentropy', metrics: ['accuracy'] });

                log('<span style="color: #38bdf8;">[3/4]</span> 학습 시작 (GPU 가속 대기)...');
                
                const history = await aiModel.fit(xs, ys, {
                    epochs: epochs,
                    batchSize: batchSize,
                    callbacks: {
                        onEpochEnd: (epoch, logs) => {
                            if ((epoch + 1) % 10 === 0 || epoch === 0) {
                                log(`Epoch ${epoch + 1}/${epochs} - loss: ${logs.loss.toFixed(4)} - acc: ${(logs.acc * 100).toFixed(2)}%`);
                            }
                        }
                    }
                });

                const endTime = Date.now();
                const lastEpochLogs = history.history;
                const lastLoss = lastEpochLogs.loss[lastEpochLogs.loss.length - 1];
                const lastAcc = lastEpochLogs.acc[lastEpochLogs.acc.length - 1];

                modelStats = {
                    isTrained: true,
                    lastTrainTime: new Date(endTime).toLocaleString(),
                    trainingDuration: ((endTime - startTime) / 1000).toFixed(2),
                    epochs: epochs,
                    batchSize: batchSize,
                    learningRate: lr,
                    finalLoss: lastLoss.toFixed(4),
                    finalAccuracy: (lastAcc * 100).toFixed(2),
                    vocabSize: aiVocab.length,
                    numClasses: aiClasses.length,
                    numSamples: x.length,
                };

                log('<span style="color: #10b981;">[4/4]</span> 학습 완료! 이제 봇 테스트 탭에서 확인해보세요.');
                document.getElementById('aiSaveModelBtn').style.display = 'block';
                
            } catch (error) {
                console.error(error);
                log(`<span style="color: #ef4444;">[오류]</span> 학습 중 문제가 발생했습니다: ${error.message}`);
            } finally {
                document.getElementById('aiBackToHpBtn').style.display = 'block';
            }
        });

        document.getElementById('aiBackToHpBtn').addEventListener('click', () => {
            document.getElementById('ai-log-view').style.display = 'none';
            document.getElementById('ai-hp-form').style.display = 'flex';
        });

        document.getElementById('aiSaveModelBtn').addEventListener('click', async () => {
            if (!aiModel) return;
            try {
                await aiModel.save('indexeddb://user-ai-model');
                localStorage.setItem('user_ai_meta', JSON.stringify({ 
                    vocab: aiVocab, 
                    classes: aiClasses, 
                    trainingData: aiDataset 
                }));
                localStorage.setItem('user_ai_version', Date.now().toString());
                alert('모델이 브라우저 로컬 저장소에 저장되었습니다.');
            } catch(e) { alert('저장 실패: ' + e.message); }
        });

    } else if (currentAITab === 'test') { // ------------------- 봇 테스트 탭 -------------------
        content.innerHTML = `
            <div style="display: flex; flex-direction: column; height: calc(100% + 40px); margin: -20px; background: #1e293b; overflow: hidden;">
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
                <div id="aiChatWindow" style="flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; background: #1e293b;">
                    ${!aiModel ? `
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
                    <textarea id="aiChatInput" rows="1" oninput="autoResizeTextarea(this)" placeholder="비서에게 메시지 전송..." ${!aiModel ? 'disabled' : ''} style="flex: 1; padding: 10px 15px; background: #1e293b; border: 1px solid #334155; border-radius: 20px; color: white; outline: none; font-size: 14px; resize: none; min-height: 40px; height: 40px; max-height: 120px; line-height: 1.4; font-family: inherit; margin: 0; overflow-y: auto;"></textarea>
                    <button id="aiChatSendBtn" ${!aiModel ? 'disabled' : ''} style="width: 40px; height: 40px; background: #38bdf8; color: #0f172a; border: none; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: ${!aiModel ? 'not-allowed' : 'pointer'}; opacity: ${!aiModel ? '0.5' : '1'}; flex-shrink: 0;">
                        <span class="material-symbols-outlined" style="font-size: 20px; margin-left: 2px;">send</span>
                    </button>
                </div>
            </div>
        `;

        document.getElementById('aiLoadModelBtn').addEventListener('click', async () => {
            if (!tfLoaded) return alert('TF.js가 로드되지 않았습니다.');
            try {
                const btn = document.getElementById('aiLoadModelBtn');
                btn.textContent = '로딩중...';
                aiModel = await window.tf.loadLayersModel('indexeddb://user-ai-model');
                const meta = JSON.parse(localStorage.getItem('user_ai_meta'));
                if (meta) { 
                    aiVocab = meta.vocab; 
                    aiClasses = meta.classes;
                    if (meta.trainingData) {
                        aiDataset = meta.trainingData;
                    }
                }
                alert('저장된 모델을 성공적으로 불러왔습니다!');
                renderAITab(); // UI 새로고침
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
            if (!aiModel) return;
            const text = chatInput.value.trim();
            if (!text) return;

            appendMessage(text, true);
            chatInput.value = '';
            chatInput.style.height = '40px';

            // 사용중 피드백 표시
            const typingDiv = document.createElement('div');
            typingDiv.style.alignSelf = 'flex-start';
            typingDiv.style.color = '#94a3b8';
            typingDiv.style.fontSize = '12px';
            typingDiv.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle; animation: spin 1s linear infinite;">sync</span> 생각하는 중...';
            chatWindow.appendChild(typingDiv);
            chatWindow.scrollTop = chatWindow.scrollHeight;

            setTimeout(async () => {
                chatWindow.removeChild(typingDiv);

                const words = tokenize(text);
                const bag = aiVocab.map(w => words.includes(w) ? 1 : 0);
                const inputTensor = window.tf.tensor2d([bag]);

                const prediction = aiModel.predict(inputTensor);
                const scores = prediction.dataSync();
                const maxScore = Math.max(...scores);
                const intentIdx = scores.indexOf(maxScore);
                
                let aiResponse = "무슨 말씀이신지 잘 이해하지 못했어요. 다르게 표현해 주실 수 있나요?";

                if (maxScore > 0.4) {
                    const predictedTag = aiClasses[intentIdx];
                    
                    const responsesMap = {};
                    aiDataset.filter(i => i.type === 'intent').forEach(intent => { responsesMap[intent.name] = intent.responses; });
                    const responses = responsesMap[predictedTag];

                    // --- 메타데이터 및 액션 처리 ---
                    const now = new Date();
                    const timeString = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
                    const dateString = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

                    if (predictedTag === 'time_check') {
                        const baseResponse = (responses && responses.length > 0) ? responses[Math.floor(Math.random() * responses.length)] : "현재 시간은 {{TIME}}입니다.";
                        aiResponse = baseResponse.replace('{{TIME}}', timeString);
                    } else if (predictedTag === 'date_check') {
                        const baseResponse = (responses && responses.length > 0) ? responses[Math.floor(Math.random() * responses.length)] : "오늘은 {{DATE}}입니다.";
                        aiResponse = baseResponse.replace('{{DATE}}', dateString);
                    } else if (predictedTag === 'create_memo') {
                        aiResponse = responses && responses.length > 0 ? responses[Math.floor(Math.random() * responses.length)] : "새 나드 작성창을 열어드릴게요.";
                        document.dispatchEvent(new CustomEvent('openNardModal'));
                    } else if (predictedTag === 'search_nard') {
                        aiResponse = responses && responses.length > 0 ? responses[Math.floor(Math.random() * responses.length)] : "통합 검색창을 열어드릴게요.";
                        document.getElementById('globalSearchBtn')?.click();
                    } else if (responses && responses.length > 0) {
                        aiResponse = responses[Math.floor(Math.random() * responses.length)];
                    } else {
                        aiResponse = `[의도 파악됨: ${predictedTag}] 하지만 정의된 답변이 없습니다.`;
                    }
                }
                
                appendMessage(aiResponse, false);

                inputTensor.dispose();
                prediction.dispose();
            }, 600); // 봇의 답변 지연(UX)
        };

        if (chatSendBtn) chatSendBtn.addEventListener('click', handleChat);
        if (chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat(); } });
    } else if (currentAITab === 'version') { // ------------------- 모델버전 탭 -------------------
        const renderStatCard = (label, value, icon, color) => `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 15px; display: flex; align-items: center; gap: 15px;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: ${color}20; color: ${color}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <span class="material-symbols-outlined" style="font-size: 22px;">${icon}</span>
                </div>
                <div>
                    <div style="font-size: 12px; color: #94a3b8; margin-bottom: 2px;">${label}</div>
                    <div style="font-size: 18px; font-weight: bold; color: #f1f5f9;">${value}</div>
                </div>
            </div>
        `;

        const renderDetailRow = (label, value) => `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #334155; font-size: 13px;">
                <span style="color: #94a3b8;">${label}</span>
                <span style="color: #f1f5f9; font-weight: bold;">${value}</span>
            </div>
        `;

        content.innerHTML = `
            <div style="max-width: 800px; margin: 0 auto;">
                <h3 style="color: #f1f5f9; font-size: 18px; margin-bottom: 20px;">모델 상태 및 분석</h3>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 15px; margin-bottom: 25px;">
                    ${renderStatCard('모델 상태', aiModel ? '로드됨' : '로드되지 않음', 'memory', '#38bdf8')}
                    ${renderStatCard('최종 정확도', modelStats.isTrained ? `${modelStats.finalAccuracy}%` : 'N/A', 'verified', '#10b981')}
                    ${renderStatCard('어휘 사전 크기', `${aiVocab.length}개`, 'translate', '#f59e0b')}
                    ${renderStatCard('의도(클래스) 수', `${aiClasses.length}개`, 'label', '#8b5cf6')}
                </div>

                <div id="ai-train-layout" style="display: flex; gap: 20px;">
                    <!-- 학습 정보 -->
                    <div style="flex: 1; background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155;">
                        <h4 style="margin-top: 0; color: #f1f5f9; font-size: 16px; margin-bottom: 15px;">최근 학습 정보</h4>
                        ${modelStats.isTrained ? `
                            ${renderDetailRow('학습 완료 시간', modelStats.lastTrainTime)}
                            ${renderDetailRow('학습 소요 시간', `${modelStats.trainingDuration}초`)}
                            ${renderDetailRow('Epochs', modelStats.epochs)}
                            ${renderDetailRow('Batch Size', modelStats.batchSize)}
                            ${renderDetailRow('Learning Rate', modelStats.learningRate)}
                            ${renderDetailRow('Final Loss', modelStats.finalLoss)}
                            ${renderDetailRow('데이터 샘플 수', modelStats.numSamples)}
                        ` : '<div style="font-size: 13px; color: #94a3b8; text-align: center; padding: 20px;">학습 기록이 없습니다.</div>'}
                    </div>

                    <!-- 아키텍처 정보 -->
                    <div style="flex: 1; background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155;">
                        <h4 style="margin-top: 0; color: #f1f5f9; font-size: 16px; margin-bottom: 15px;">신경망 아키텍처</h4>
                        <ul style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 12px; line-height: 1.8;">
                            <li>Input Layer: BoW (${aiVocab.length || 'N/A'} units)</li>
                            <li><strong>Hidden Layer 1: Dense (128 units, ReLU)</strong></li>
                            <li>Dropout Layer: Rate 0.5</li>
                            <li>Hidden Layer 2: Dense (64 units, ReLU)</li>
                            <li>Output Layer: Dense (${aiClasses.length || 'N/A'} units, Softmax)</li>
                        </ul>
                    </div>
                </div>
                
                ${modelStats.isTrained ? `
                <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #334155; text-align: center;">
                    <button id="aiDeployGlobalBtn" style="background: #e84393; color: white; border: none; padding: 14px 24px; border-radius: 8px; font-weight: bold; font-size: 15px; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 15px rgba(232, 67, 147, 0.3);">
                        🚀 현재 모델을 전역 서버로 공식 배포하기
                    </button>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 10px;">배포 즉시 사용자들은 채팅방 입장 시 자동으로 최신 모델을 다운로드하게 됩니다.</div>
                </div>
                ` : ''}
            </div>
        `;

        document.getElementById('aiDeployGlobalBtn')?.addEventListener('click', async () => {
            if (!confirm('학습된 현재 버전을 실제 사용자 서비스에 반영(배포)하시겠습니까?')) return;
            const btn = document.getElementById('aiDeployGlobalBtn');
            btn.textContent = '서버로 업로드 중... 잠시만 기다려주세요.';
            btn.disabled = true;
            
            try {
                let artifacts;
                await aiModel.save(window.tf.io.withSaveHandler(async a => { artifacts = a; return null; }));
                const weightBase64 = bufferToBase64(artifacts.weightData);
                
                // 모델 데이터를 통째로 Firestore 문서 하나에 압축 저장
                await setDoc(doc(db, "system", "ai_model"), {
                    version: Date.now(), vocab: aiVocab, classes: aiClasses,
                    trainingData: aiDataset, // 변경된 데이터 구조 전송
                    topology: JSON.stringify(artifacts.modelTopology), weightSpecs: JSON.stringify(artifacts.weightSpecs),
                    weightData: weightBase64
                });
                alert('✅ 성공적으로 서버에 배포되었습니다! 이제 사용자들이 챗봇을 사용할 수 있습니다.');
            } catch(e) {
                console.error(e); alert('배포 실패: ' + e.message);
            } finally {
                btn.textContent = '🚀 현재 모델을 전역 서버로 공식 배포하기'; btn.disabled = false;
            }
        });
    } else if (currentAITab === 'guide') { // ------------------- 사용설명서 탭 -------------------
        content.innerHTML = `
            <div style="max-width: 800px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #334155; color: #f1f5f9; line-height: 1.6;">
                <h2 style="color: #38bdf8; margin-top: 0; border-bottom: 1px solid #334155; padding-bottom: 10px; margin-bottom: 20px;">📖 AI 비서 학습 스튜디오 사용 설명서</h2>
                
                <div style="margin-bottom: 30px;">
                    <p>GoNard의 AI 비서는 단순한 "규칙 기반(Rule-based)" 챗봇이 아닙니다.<br>
                    <strong>자연어 처리(NLP)와 딥러닝(TensorFlow.js)</strong>을 이용해 브라우저에서 직접 신경망을 학습하는 강력한 머신러닝 모델입니다.<br>
                    단어의 출현 빈도와 패턴을 128차원 신경망(Dense Layer)을 통해 분석하여 사용자의 '의도(Intent)'를 파악해 냅니다.</p>
                </div>

                <h3 style="color: #10b981; margin-bottom: 15px;">🧠 AI를 더 똑똑하게 학습시키는 요령</h3>
                
                <div style="background: #0f172a; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #334155;">
                    <h4 style="margin: 0 0 10px 0; color: #f59e0b;">1. 다양한 패턴, 일관된 의도 (Diversity is Key)</h4>
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #cbd5e1;">하나의 의도(Tag)에 대해 사용자가 쓸 법한 다양한 표현을 최대한 많이 추가해주세요.</p>
                    <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #94a3b8;">
                        <li><span style="color:#ef4444;">나쁜 예시 ❌</span> : {"tag": "날씨", "patterns": ["날씨 알려줘"]}</li>
                        <li><span style="color:#10b981;">좋은 예시 ✅</span> : {"tag": "날씨", "patterns": ["날씨 알려줘", "오늘 날씨 어때?", "밖에 비 와?", "기온 몇 도야?"]}</li>
                    </ul>
                </div>

                <div style="background: #0f172a; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #334155;">
                    <h4 style="margin: 0 0 10px 0; color: #f59e0b;">2. 의도(Tag)는 명확하게 분리하기</h4>
                    <p style="margin: 0; font-size: 14px; color: #cbd5e1;">'일정 검색'과 '일정 추가'는 비슷해 보이지만 완전히 다른 의도입니다. <br><code>search_schedule</code>과 <code>create_schedule</code>처럼 목적별로 Tag를 명확히 분리해야 AI가 헷갈리지 않습니다.</p>
                </div>

                <div style="background: #0f172a; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #334155;">
                    <h4 style="margin: 0 0 10px 0; color: #f59e0b;">3. 반복 학습과 파라미터 튜닝 (Iterative Training)</h4>
                    <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #cbd5e1; line-height: 1.8;">
                        <li><strong>Epochs (에포크):</strong> 전체 데이터를 몇 번 반복 학습할지 정합니다. 데이터가 적을 땐 200~300, 많을 땐 100~150 정도가 적당합니다.</li>
                        <li><strong>Learning Rate (학습률):</strong> AI가 정답을 찾는 보폭입니다. 기본값(0.01)에서 시작하여 모델 정확도(Acc)가 오르지 않으면 조금씩 조절해보세요.</li>
                    </ul>
                </div>

                <div style="background: #0f172a; padding: 15px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #334155;">
                    <h4 style="margin: 0 0 10px 0; color: #f59e0b;">4. '모르겠다'고 말하게 가르치기 (Fallback Intent)</h4>
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #cbd5e1;">아무런 의도에도 속하지 않는 엉뚱한 문장들을 모아 <code>fallback</code> 이라는 Tag를 만들어두세요.</p>
                    <div style="background: #1e293b; padding: 10px; border-radius: 6px; font-size: 13px; color: #94a3b8;">
                        예: ["강아지가 몇 살이야", "피자 먹고 싶다"] → "무슨 말씀이신지 잘 이해하지 못했어요."
                    </div>
                </div>

                <h3 style="color: #10b981; margin-bottom: 15px;">🛠️ 학습 진행 순서</h3>
                <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #cbd5e1; line-height: 1.8;">
                    <li><strong>[데이터셋] 탭:</strong> AI가 이해할 질문(패턴)과 답변의 짝을 만듭니다.</li>
                    <li><strong>[학습/튜닝] 탭:</strong> 모아둔 데이터를 바탕으로 128차원 신경망 모델을 훈련시키고 디바이스에 저장합니다.</li>
                    <li><strong>[봇 테스트] 탭:</strong> 똑똑해진 AI와 대화하며, 의도를 제대로 파악하는지 테스트합니다.</li>
                </ol>
            </div>
        `;
    }
};

const renderDatasetForm = () => {
    const container = document.getElementById('ai-dataset-form-container');
    if (!container) return;

    const showForm = isAddingNew || editingItemId !== null;
    if (!showForm) {
        container.innerHTML = '';
        return;
    }

    const itemToEdit = editingItemId ? aiDataset.find(i => i.id === editingItemId) : null;

    container.innerHTML = `
        <div id="ai-dataset-form" style="background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #f1f5f9; font-size: 16px; margin-bottom: 15px;">
                ${editingItemId !== null ? '인텐트 수정' : '새 인텐트 추가'}
            </h3>
            
            <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 5px;">Tag (영문 고유명칭)</label>
            <input type="text" id="aiTagInput" placeholder="예: weather_check" value="${itemToEdit ? escapeHtml(itemToEdit.name) : ''}" style="width: 100%; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: white; margin-bottom: 15px; box-sizing: border-box;">
            
            <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 5px;">입력 패턴 (쉼표로 구분)</label>
            <textarea id="aiPatternsInput" rows="3" placeholder="예: 날씨 어때, 오늘 비와?, 밖이 춥니" style="width: 100%; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: white; margin-bottom: 15px; box-sizing: border-box; resize: none;">${itemToEdit ? escapeHtml(itemToEdit.patterns.join(', ')) : ''}</textarea>
            
            <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 5px;">AI 응답 (쉼표 혹은 파이프(|)로 구분)</label>
            <textarea id="aiResponsesInput" rows="3" placeholder="예: 오늘 날씨는 맑습니다. | 현재 기온을 확인해드릴게요." style="width: 100%; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: white; margin-bottom: 15px; box-sizing: border-box; resize: none;">${itemToEdit ? escapeHtml(itemToEdit.responses.join(', ')) : ''}</textarea>
            
            <div style="display: flex; gap: 10px;">
                <button id="aiSaveFormBtn" style="flex: 1; background: ${editingItemId !== null ? '#f59e0b' : '#10b981'}; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s;">
                    ${editingItemId !== null ? '데이터셋 수정' : '목록에 추가'}
                </button>
                <button id="aiCancelFormBtn" style="background: #64748b; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer;">취소</button>
            </div>
        </div>
    `;

    attachFormEvents();
};

const attachFormEvents = () => {
    document.getElementById('aiSaveFormBtn')?.addEventListener('click', () => {
        const tag = document.getElementById('aiTagInput').value.trim();
        const patterns = document.getElementById('aiPatternsInput').value.split(/[,|]/).map(s => s.trim()).filter(s => s);
        const responses = document.getElementById('aiResponsesInput').value.split(/[,|]/).map(s => s.trim()).filter(s => s);

        if (!tag || patterns.length === 0 || responses.length === 0) return alert('모든 필드를 올바르게 입력해주세요.');

        if (editingItemId) {
            const item = aiDataset.find(i => i.id === editingItemId);
            if (item) { item.name = tag; item.patterns = patterns; item.responses = responses; }
        } else if (isAddingNew) {
            aiDataset.push({ id: `intent_${Date.now()}`, parentId: selectedFolderId, type: 'intent', name: tag, patterns: patterns, responses: responses });
        }
        
        editingItemId = null; isAddingNew = null;
        document.getElementById('ai-dataset-form-container').innerHTML = '';
        saveAndRenderDataset();
    });

    document.getElementById('aiCancelFormBtn')?.addEventListener('click', () => {
        editingItemId = null; isAddingNew = null;
        document.getElementById('ai-dataset-form-container').innerHTML = '';
    });
};

const renderDatasetView = () => {
    const container = document.getElementById('ai-dataset-list-container');
    const searchInput = document.getElementById('aiDatasetSearchInput');
    if (!container || !searchInput) return;

    const query = searchInput.value.toLowerCase().trim();

    if (query) {
        renderSearchResults(query);
    } else {
        renderDatasetTree();
    }
};

const renderDatasetTree = () => {
    const container = document.getElementById('ai-dataset-list-container');
    if (!container) return;

    const buildTreeHTML = (parentId, depth = 0) => {
        const children = aiDataset.filter(item => item.parentId === parentId).sort((a, b) => {
            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        });

        if (children.length === 0 && depth > 0) return '';

        let html = `<ul style="list-style: none; padding-left: ${depth > 0 ? '20px' : '0'};">`;
        children.forEach(item => {
            const isFolder = item.type === 'folder';
            const isCollapsed = collapsedStates[item.id] === true;
            const isSelected = selectedFolderId === item.id;
            const icon = isFolder ? (isCollapsed ? 'folder' : 'folder_open') : 'chat_bubble';

            html += `
                <li data-id="${item.id}" style="margin: 2px 0;">
                    <div class="dataset-item" style="display: flex; flex-direction: column; padding: 8px; border-radius: 6px; cursor: pointer; background: ${isSelected ? '#334155' : 'transparent'};" onmouseover="this.style.background='${isSelected ? '#334155' : '#2c3e50'}'" onmouseout="this.style.background='${isSelected ? '#334155' : 'transparent'}'">
                        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                            <div class="dataset-item-main" data-id="${item.id}" data-type="${item.type}" style="flex: 1; display: flex; align-items: center; gap: 8px;">
                                <span class="material-symbols-outlined" style="color: ${isFolder ? '#f59e0b' : '#38bdf8'};">${icon}</span>
                                <span style="color: #f1f5f9; font-weight: bold;">${escapeHtml(item.name)}</span>
                            </div>
                            <div style="display: flex; gap: 5px;">
                                <button class="ai-edit-item-btn" data-id="${item.id}" style="background: transparent; color: #38bdf8; border: 1px solid #38bdf8; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 11px;">수정</button>
                                <button class="ai-del-item-btn" data-id="${item.id}" style="background: transparent; color: #ef4444; border: 1px solid #ef4444; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 11px;">삭제</button>
                            </div>
                        </div>
            `;
            if (!isFolder) {
                html += `
                    <div style="font-size: 12px; color: #cbd5e1; margin-top: 8px; padding-left: 36px; word-break: break-all;"><strong>입력 패턴:</strong> ${escapeHtml(item.patterns.join(', '))}</div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 4px; padding-left: 36px; word-break: break-all;"><strong>응답 출력:</strong> ${escapeHtml(item.responses.join(' | '))}</div>
                `;
            }
            html += `</div>`;
            if (isFolder && !isCollapsed) {
                html += buildTreeHTML(item.id, depth + 1);
            }
            html += `</li>`;
        });
        html += '</ul>';
        return html;
    };

    container.innerHTML = buildTreeHTML(null);
    attachTreeEvents();
};

const renderSearchResults = (query) => {
    const container = document.getElementById('ai-dataset-list-container');
    if (!container) return;

    const lowerQuery = query.toLowerCase();
    const tagMatches = new Set();
    const patternMatches = new Set();
    const responseMatches = new Set();

    aiDataset.filter(item => item.type === 'intent').forEach(item => {
        if (item.name.toLowerCase().includes(lowerQuery)) tagMatches.add(item);
        if (item.patterns.some(p => p.toLowerCase().includes(lowerQuery))) patternMatches.add(item);
        if (item.responses.some(r => r.toLowerCase().includes(lowerQuery))) responseMatches.add(item);
    });

    const renderResultItem = (item) => `
        <div style="background: #2c3e50; border-radius: 6px; padding: 12px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: bold; color: #38bdf8;">Tag: ${escapeHtml(item.name)}</span>
                <div style="display: flex; gap: 5px;">
                    <button class="ai-edit-item-btn" data-id="${item.id}" style="background: transparent; color: #38bdf8; border: 1px solid #38bdf8; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 11px;">수정</button>
                    <button class="ai-del-item-btn" data-id="${item.id}" style="background: transparent; color: #ef4444; border: 1px solid #ef4444; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 11px;">삭제</button>
                </div>
            </div>
            <div style="font-size: 12px; color: #cbd5e1; margin-bottom: 5px;"><strong>입력 패턴:</strong> ${escapeHtml(item.patterns.join(', '))}</div>
            <div style="font-size: 12px; color: #94a3b8;"><strong>응답 출력:</strong> ${escapeHtml(item.responses.join(' | '))}</div>
        </div>
    `;

    const renderSection = (title, itemsSet) => {
        if (itemsSet.size === 0) return '';
        let html = `<h4 style="color: #38bdf8; margin-top: 15px; margin-bottom: 10px; border-bottom: 1px solid #334155; padding-bottom: 5px;">${title} (${itemsSet.size}개)</h4>`;
        itemsSet.forEach(item => html += renderResultItem(item));
        return html;
    };

    let resultsHtml = renderSection('Tag 일치', tagMatches) +
                      renderSection('입력 패턴 일치', patternMatches) +
                      renderSection('AI 응답 일치', responseMatches);

    if (resultsHtml === '') {
        resultsHtml = '<div style="text-align: center; color: #94a3b8; padding: 20px;">검색 결과가 없습니다.</div>';
    }

    container.innerHTML = resultsHtml;
    attachTreeEvents(); // Edit/Delete buttons need events
};

const attachTreeEvents = () => {
    const container = document.getElementById('ai-dataset-list-container');
    if (!container) return;

    container.querySelectorAll('.dataset-item-main').forEach(el => {
        el.addEventListener('click', () => {
            const id = el.dataset.id;
            const type = el.dataset.type;
            if (type === 'folder') {
                collapsedStates[id] = !collapsedStates[id];
                selectedFolderId = id;
                renderDatasetView();
            } else {
                editingItemId = id;
                isAddingNew = null;
                renderDatasetForm();
            }
        });
    });

    container.querySelectorAll('.ai-edit-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = e.currentTarget.dataset.id;
            const item = aiDataset.find(i => i.id === id);
            if (item.type === 'folder') {
                const newName = prompt('새 폴더 이름을 입력하세요:', item.name);
                if (newName && newName.trim()) {
                    item.name = newName.trim();
                    saveAndRenderDataset();
                }
            } else {
                editingItemId = id;
                isAddingNew = null;
                renderDatasetForm();
            }
        });
    });

    container.querySelectorAll('.ai-del-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = e.currentTarget.dataset.id;
            const item = aiDataset.find(i => i.id === id);
            if (confirm(`'${item.name}' 항목을 삭제하시겠습니까? ${item.type === 'folder' ? '(하위 항목도 모두 삭제됩니다)' : ''}`)) {
                const idsToDelete = new Set([id]);
                if (item.type === 'folder') {
                    const findChildrenRecursive = (parentId) => {
                        aiDataset.filter(child => child.parentId === parentId).forEach(child => {
                            idsToDelete.add(child.id);
                            if (child.type === 'folder') findChildrenRecursive(child.id);
                        });
                    };
                    findChildrenRecursive(id);
                }
                aiDataset = aiDataset.filter(i => !idsToDelete.has(i.id));
                if (idsToDelete.has(selectedFolderId)) selectedFolderId = null;
                if (idsToDelete.has(editingItemId)) editingItemId = null;
                saveAndRenderDataset();
            }
        });
    });
};

const attachDatasetControlEvents = () => {
    document.getElementById('aiDatasetSearchInput').addEventListener('input', renderDatasetView);
    document.getElementById('aiAddNewFolderBtn').addEventListener('click', () => {
        const name = prompt('새 폴더 이름을 입력하세요:');
        if (name && name.trim()) {
            aiDataset.push({ id: `folder_${Date.now()}`, parentId: selectedFolderId, type: 'folder', name: name.trim() });
            saveAndRenderDataset();
        }
    });
    document.getElementById('aiAddNewIntentBtn').addEventListener('click', () => {
        isAddingNew = { type: 'intent' };
        editingItemId = null;
        renderDatasetForm();
    });
    document.getElementById('aiSaveDataBtn').addEventListener('click', () => {
        localStorage.setItem('gonard-ai-dataset', JSON.stringify(aiDataset));
        alert('데이터셋이 로컬에 저장되었습니다.');
    });

    // 서버로 업로드 (기존 내보내기)
    document.getElementById('aiUploadBtn').addEventListener('click', async () => {
        if (!confirm('현재 데이터셋을 서버에 업로드하시겠습니까? (기존 서버 데이터는 덮어씌워집니다)')) return;
        
        try {
            await setDoc(doc(db, "system", "ai_dataset"), {
                data: aiDataset,
                updatedAt: serverTimestamp()
            });
            alert('✅ 데이터셋이 서버에 성공적으로 업로드되었습니다.');
        } catch (e) {
            console.error(e);
            alert('서버 업로드 중 오류가 발생했습니다: ' + e.message);
        }
    });

    // 서버에서 업데이트 (기존 가져오기)
    document.getElementById('aiUpdateBtn').addEventListener('click', async () => {
        if (!confirm('서버로부터 최신 데이터셋을 다운로드하여 현재 작업을 덮어쓰시겠습니까?')) return;
        
        try {
            const docRef = doc(db, "system", "ai_dataset");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const serverData = docSnap.data().data;
                if (Array.isArray(serverData)) {
                    aiDataset = serverData;
                    saveAndRenderDataset(); // This saves to localstorage and re-renders
                    alert('✅ 서버로부터 최신 데이터셋을 업데이트했습니다.');
                } else {
                    alert('서버 데이터 형식이 올바르지 않습니다.');
                }
            } else {
                alert('서버에 저장된 데이터셋이 없습니다.');
            }
        } catch (e) {
            console.error(e);
            alert('서버에서 데이터를 가져오는 중 오류가 발생했습니다: ' + e.message);
        }
    });
};

const saveAndRenderDataset = () => {
    localStorage.setItem('gonard-ai-dataset', JSON.stringify(aiDataset));
    renderDatasetView();
};

export const onReclick = () => {
    if (!subTabButtons) return;
    
    const now = Date.now();
    if (now - lastReclickTime < 300) return; 
    lastReclickTime = now;

    currentTabIndex = (currentTabIndex + 1) % tabIds.length;
    subTabButtons[currentTabIndex].click();
};