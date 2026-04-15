import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, escapeHtml } from "../js/main.js";

let tfLoaded = false;
let currentAITab = 'dataset';
let aiModel = null;
let aiVocab = [];
let aiClasses = [];
let editingDataIndex = null;
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
let trainingData = [
    { tag: "greeting", patterns: ["안녕", "반가워", "누구야", "너는 누구니", "인사해줘"], responses: ["안녕하세요! GoNard의 AI 비서입니다.", "반갑습니다! 무엇을 도와드릴까요?"] },
    { tag: "goodbye", patterns: ["잘가", "나중에 봐", "종료해", "수고했어", "안녕히 계세요"], responses: ["이용해 주셔서 감사합니다. 좋은 하루 보내세요!", "필요하시면 언제든 다시 불러주세요."] },
    { tag: "search_nard", patterns: ["나드 검색해줘", "메모 찾아줘", "기록 검색", "문서 찾아"], responses: ["어떤 키워드로 나드를 검색해 드릴까요?", "통합 검색창을 띄워드릴 수 있습니다. 검색어를 말씀해주세요."] },
    { tag: "schedule", patterns: ["오늘 일정", "스케줄 확인해", "마감일 언제야", "뭐 해야해"], responses: ["오늘 예정된 일정을 스케줄 탭에서 확인하시겠어요?", "다가오는 마감일이 있는 나드를 확인해 드릴게요."] },
    { tag: "create_memo", patterns: ["메모 작성해", "새 나드 만들어", "기록해줘", "받아적어"], responses: ["새로운 나드 작성 창을 열어드릴게요.", "어떤 내용을 기록할까요? 말씀해주세요."] }
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

    trainingData.forEach(intent => {
        if (!classes.includes(intent.tag)) classes.push(intent.tag);
        intent.patterns.forEach(pattern => {
            const w = tokenize(pattern);
            words.push(...w);
            documents.push({ words: w, tag: intent.tag });
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
        </style>
        <div class="module-card" style="display: flex; flex-direction: column; height: calc(100vh - 120px); padding: 0; overflow: hidden; background: #0f172a; color: #f1f5f9;">
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
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="ai-tab-btn active" data-tab="dataset" style="background: #38bdf8; color: #0f172a; border: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">📊 데이터셋</button>
                    <button class="ai-tab-btn" data-tab="train" style="background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">⚙️ 학습/튜닝</button>
                    <button class="ai-tab-btn" data-tab="version" style="background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">📈 모델버전</button>
                    <button class="ai-tab-btn" data-tab="test" style="background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">💬 봇 테스트</button>
                    <button class="ai-tab-btn" data-tab="guide" style="background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">📖 사용 설명서</button>
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
        
        // 저장된 데이터셋이 있다면 불러오기
        const savedData = localStorage.getItem('gonard-ai-dataset');
        if (savedData) trainingData = JSON.parse(savedData);
    } else {
        tfStatus.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px; color: #ef4444;">error</span> TF.js Load Failed';
        tfStatus.style.background = '#7f1d1d';
        tfStatus.style.color = '#fca5a5';
    }

    const tabBtns = container.querySelectorAll('.ai-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => {
                b.style.background = '#1e293b'; b.style.color = '#94a3b8'; b.style.border = '1px solid #334155'; b.classList.remove('active');
            });
            e.target.style.background = '#38bdf8'; e.target.style.color = '#0f172a'; e.target.style.border = 'none'; e.target.classList.add('active');
            currentAITab = e.target.dataset.tab;
            renderAITab();
        });
    });

    renderAITab();
};

const renderAITab = () => {
    const content = document.getElementById('aiTabContent');
    if (!content) return;

    if (currentAITab === 'dataset') {
        let listHtml = trainingData.map((d, i) => `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 10px; margin-bottom: 10px;">
                    <span style="font-weight: bold; color: #38bdf8;">Tag: ${escapeHtml(d.tag)}</span>
                    <div style="display: flex; gap: 5px;">
                        <button class="ai-edit-data-btn" data-idx="${i}" style="background: transparent; color: #38bdf8; border: 1px solid #38bdf8; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">수정</button>
                        <button class="ai-del-data-btn" data-idx="${i}" style="background: transparent; color: #ef4444; border: 1px solid #ef4444; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">삭제</button>
                    </div>
                </div>
                <div style="font-size: 13px; color: #cbd5e1; margin-bottom: 5px;"><strong>입력 패턴:</strong> ${escapeHtml(d.patterns.join(', '))}</div>
                <div style="font-size: 13px; color: #94a3b8;"><strong>응답 출력:</strong> ${escapeHtml(d.responses.join(' | '))}</div>
            </div>
        `).join('');

        const itemToEdit = editingDataIndex !== null ? trainingData[editingDataIndex] : null;

        content.innerHTML = `
            <div id="ai-dataset-layout" style="display: flex; gap: 20px; align-items: flex-start;">
                <!-- 데이터 입력 폼 -->
                <div id="ai-dataset-form" style="flex: 1; background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; position: sticky; top: 0;">
                    <h3 style="margin-top: 0; color: #f1f5f9; font-size: 16px; margin-bottom: 15px;">
                        ${editingDataIndex !== null ? '인텐트 수정' : '새 인텐트(의도) 추가'}
                    </h3>
                    
                    <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 5px;">Tag (영문 고유명칭)</label>
                    <input type="text" id="aiTagInput" placeholder="예: weather_check" value="${itemToEdit ? escapeHtml(itemToEdit.tag) : ''}" style="width: 100%; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: white; margin-bottom: 15px; box-sizing: border-box;">
                    
                    <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 5px;">입력 패턴 (쉼표로 구분)</label>
                    <textarea id="aiPatternsInput" rows="3" placeholder="예: 날씨 어때, 오늘 비와?, 밖이 춥니" style="width: 100%; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: white; margin-bottom: 15px; box-sizing: border-box; resize: none;">${itemToEdit ? escapeHtml(itemToEdit.patterns.join(', ')) : ''}</textarea>
                    
                    <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 5px;">AI 응답 (쉼표 혹은 파이프(|)로 구분)</label>
                    <textarea id="aiResponsesInput" rows="3" placeholder="예: 오늘 날씨는 맑습니다. | 현재 기온을 확인해드릴게요." style="width: 100%; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: white; margin-bottom: 15px; box-sizing: border-box; resize: none;">${itemToEdit ? escapeHtml(itemToEdit.responses.join(', ')) : ''}</textarea>
                    
                    <div style="display: flex; gap: 10px;">
                        <button id="aiAddDataBtn" style="flex: 1; background: ${editingDataIndex !== null ? '#f59e0b' : '#10b981'}; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s;">
                            ${editingDataIndex !== null ? '데이터셋 수정' : '목록에 추가'}
                        </button>
                        ${editingDataIndex !== null ? `<button id="aiCancelEditBtn" style="background: #64748b; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer;">취소</button>` : ''}
                    </div>
                </div>

                <!-- 데이터셋 목록 -->
                <div style="flex: 2;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px;">
                        <h3 style="margin: 0; color: #f1f5f9; font-size: 16px;">학습 데이터셋 목록 (${trainingData.length}개)</h3>
                        <div style="display: flex; gap: 5px;">
                            <button id="aiImportDataBtn" style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">가져오기</button>
                            <button id="aiExportDataBtn" style="background: #8b5cf6; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">내보내기</button>
                            <button id="aiSaveDataBtn" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">로컬에 저장</button>
                            <input type="file" id="aiImportFileInput" accept=".json" style="display: none;">
                        </div>
                    </div>
                    <div id="aiDatasetList">${listHtml}</div>
                </div>
            </div>
        `;

        document.getElementById('aiAddDataBtn').addEventListener('click', () => {
            const tag = document.getElementById('aiTagInput').value.trim();
            const patterns = document.getElementById('aiPatternsInput').value.split(/[,|]/).map(s => s.trim()).filter(s => s);
            const responses = document.getElementById('aiResponsesInput').value.split(/[,|]/).map(s => s.trim()).filter(s => s);

            if (!tag || patterns.length === 0 || responses.length === 0) return alert('모든 필드를 올바르게 입력해주세요.');

            if (editingDataIndex !== null) {
                trainingData[editingDataIndex] = { tag, patterns, responses };
                editingDataIndex = null;
            } else {
                trainingData.push({ tag, patterns, responses });
            }
            renderAITab();
        });

        if (editingDataIndex !== null) {
            document.getElementById('aiCancelEditBtn').addEventListener('click', () => {
                editingDataIndex = null;
                renderAITab();
            });
        }

        document.getElementById('aiSaveDataBtn').addEventListener('click', () => {
            localStorage.setItem('gonard-ai-dataset', JSON.stringify(trainingData));
            alert('데이터셋이 로컬에 저장되었습니다.');
        });

        document.getElementById('aiExportDataBtn').addEventListener('click', () => {
            const dataStr = JSON.stringify(trainingData, null, 2);
            const blob = new Blob([dataStr], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            a.download = `gonard_ai_dataset_${timestamp}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });

        const importBtn = document.getElementById('aiImportDataBtn');
        const importFileInput = document.getElementById('aiImportFileInput');

        importBtn.addEventListener('click', () => {
            importFileInput.click();
        });

        importFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            if (confirm('현재 데이터셋을 덮어쓰고 새 파일을 가져오시겠습니까?')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const importedData = JSON.parse(e.target.result);
                        if (Array.isArray(importedData) && importedData.every(item => item.tag && item.patterns && item.responses)) {
                            trainingData = importedData;
                            localStorage.setItem('gonard-ai-dataset', JSON.stringify(trainingData));
                            alert('데이터셋을 성공적으로 가져왔습니다.');
                            renderAITab();
                        } else {
                            alert('올바르지 않은 데이터셋 파일 형식입니다.');
                        }
                    } catch (err) {
                        alert('파일을 읽는 중 오류가 발생했습니다: ' + err.message);
                    }
                };
                reader.readAsText(file);
            }
            event.target.value = '';
        });

        document.querySelectorAll('.ai-del-data-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.dataset.idx;
                trainingData.splice(idx, 1);
                if (editingDataIndex === parseInt(idx, 10)) editingDataIndex = null;
                else if (editingDataIndex > parseInt(idx, 10)) editingDataIndex--;
                renderAITab();
            });
        });

        document.querySelectorAll('.ai-edit-data-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                editingDataIndex = parseInt(e.currentTarget.dataset.idx, 10);
                renderAITab();
            });
        });

    } else if (currentAITab === 'train') {
        content.innerHTML = `
            <div id="ai-train-layout" style="display: flex; gap: 20px; height: 100%;">
                <!-- 모델 튜닝 파라미터 -->
                <div style="flex: 1; background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; display: flex; flex-direction: column; margin-bottom: 20px;">
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
                <div style="flex: 2; background: #050505; padding: 15px; border-radius: 12px; border: 1px solid #334155; display: flex; flex-direction: column; font-family: 'Courier New', monospace;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 10px;">
                        <span style="color: #10b981; font-size: 14px; font-weight: bold;">[TF.js Console] Training Logs</span>
                        <button id="aiSaveModelBtn" style="background: #27ae60; color: white; border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; display: none;">모델 디바이스 저장</button>
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
            
            const startTime = Date.now();
            document.getElementById('aiStartTrainBtn').disabled = true;
            document.getElementById('aiStartTrainBtn').style.opacity = '0.5';
            document.getElementById('aiSaveModelBtn').style.display = 'none';
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
                document.getElementById('aiStartTrainBtn').disabled = false;
                document.getElementById('aiStartTrainBtn').style.opacity = '1';
            }
        });

        document.getElementById('aiSaveModelBtn').addEventListener('click', async () => {
            if (!aiModel) return;
            try {
                await aiModel.save('indexeddb://gonard-ai-model');
                localStorage.setItem('gonard-ai-metadata', JSON.stringify({ vocab: aiVocab, classes: aiClasses }));
                alert('모델이 브라우저 로컬 저장소에 저장되었습니다.');
            } catch(e) { alert('저장 실패: ' + e.message); }
        });

    } else if (currentAITab === 'test') {
        content.innerHTML = `
            <div style="display: flex; flex-direction: column; height: 100%; max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
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
                <div style="padding: 15px; background: #0f172a; border-top: 1px solid #334155; display: flex; gap: 10px;">
                    <input type="text" id="aiChatInput" placeholder="비서에게 메시지 전송..." ${!aiModel ? 'disabled' : ''} style="flex: 1; padding: 12px 15px; background: #1e293b; border: 1px solid #334155; border-radius: 24px; color: white; outline: none; font-size: 14px; transition: 0.2s;">
                    <button id="aiChatSendBtn" ${!aiModel ? 'disabled' : ''} style="width: 45px; height: 45px; background: #38bdf8; color: #0f172a; border: none; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: ${!aiModel ? 'not-allowed' : 'pointer'}; opacity: ${!aiModel ? '0.5' : '1'};">
                        <span class="material-symbols-outlined" style="margin-left: 2px;">send</span>
                    </button>
                </div>
            </div>
        `;

        document.getElementById('aiLoadModelBtn').addEventListener('click', async () => {
            if (!tfLoaded) return alert('TF.js가 로드되지 않았습니다.');
            try {
                const btn = document.getElementById('aiLoadModelBtn');
                btn.textContent = '로딩중...';
                aiModel = await window.tf.loadLayersModel('indexeddb://gonard-ai-model');
                const meta = JSON.parse(localStorage.getItem('gonard-ai-metadata'));
                if (meta) { aiVocab = meta.vocab; aiClasses = meta.classes; }
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

            // 사용중 피드백 표시
            const typingDiv = document.createElement('div');
            typingDiv.style.alignSelf = 'flex-start';
            typingDiv.style.color = '#94a3b8';
            typingDiv.style.fontSize = '12px';
            typingDiv.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle; animation: spin 1s linear infinite;">sync</span> 생각하는 중...';
            chatWindow.appendChild(typingDiv);
            chatWindow.scrollTop = chatWindow.scrollHeight;

            setTimeout(() => {
                chatWindow.removeChild(typingDiv);

                // 1. 입력 토큰화 및 BoW 생성
                const words = tokenize(text);
                const bag = aiVocab.map(w => words.includes(w) ? 1 : 0);
                const inputTensor = window.tf.tensor2d([bag]);

                // 2. 모델 예측
                const prediction = aiModel.predict(inputTensor);
                const scores = prediction.dataSync();
                const maxScore = Math.max(...scores);
                const intentIdx = scores.indexOf(maxScore);

                // 3. 임계값(Threshold) 확인 및 응답
                if (maxScore > 0.4) {
                    const predictedTag = aiClasses[intentIdx];
                    const intentData = trainingData.find(i => i.tag === predictedTag);
                    if (intentData) {
                        const responses = intentData.responses;
                        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                        appendMessage(randomResponse, false);
                    } else {
                        appendMessage("응답 데이터를 찾을 수 없습니다.", false);
                    }
                } else {
                    appendMessage("무슨 말씀이신지 잘 이해하지 못했어요. 다르게 표현해 주실 수 있나요?", false);
                }
                
                // 메모리 누수 방지
                inputTensor.dispose();
                prediction.dispose();
            }, 600); // 봇의 답변 지연(UX)
        };

        if (chatSendBtn) chatSendBtn.addEventListener('click', handleChat);
        if (chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleChat(); });
    } else if (currentAITab === 'version') {
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
    } else if (currentAITab === 'guide') {
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
}