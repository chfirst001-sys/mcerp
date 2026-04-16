import * as mainAI from '../ai.js';

export const render = (container) => {
    container.innerHTML = `
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
        if (!mainAI.tfLoaded) return alert('TensorFlow.js가 로드되지 않았습니다.');
        
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
            const { x, y } = mainAI.preprocessData();
            log(` - Vocab Size: ${mainAI.aiVocab.length}`);
            log(` - Classes: ${mainAI.aiClasses.length}`);
            log(` - Training Samples: ${x.length}`);

            const xs = window.tf.tensor2d(x);
            const ys = window.tf.tensor2d(y);

            log('<span style="color: #38bdf8;">[2/4]</span> 128차원 신경망 모델 빌드 중...');
            const model = window.tf.sequential();
            model.add(window.tf.layers.dense({ units: 128, inputShape: [mainAI.aiVocab.length], activation: 'relu' }));
            model.add(window.tf.layers.dropout({ rate: 0.5 }));
            model.add(window.tf.layers.dense({ units: 64, activation: 'relu' }));
            model.add(window.tf.layers.dense({ units: mainAI.aiClasses.length, activation: 'softmax' }));

            const optimizer = window.tf.train.adam(lr);
            model.compile({ optimizer: optimizer, loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
            mainAI.setAiModel(model);

            log('<span style="color: #38bdf8;">[3/4]</span> 학습 시작 (GPU 가속 대기)...');
            
            const history = await mainAI.aiModel.fit(xs, ys, {
                epochs: epochs, batchSize: batchSize,
                callbacks: { onEpochEnd: (epoch, logs) => { if ((epoch + 1) % 10 === 0 || epoch === 0) { log(`Epoch ${epoch + 1}/${epochs} - loss: ${logs.loss.toFixed(4)} - acc: ${(logs.acc * 100).toFixed(2)}%`); } } }
            });

            const endTime = Date.now();
            const lastEpochLogs = history.history;
            const lastLoss = lastEpochLogs.loss[lastEpochLogs.loss.length - 1];
            const lastAcc = lastEpochLogs.acc[lastEpochLogs.acc.length - 1];

            mainAI.setModelStats({
                isTrained: true, lastTrainTime: new Date(endTime).toLocaleString(), trainingDuration: ((endTime - startTime) / 1000).toFixed(2),
                epochs: epochs, batchSize: batchSize, learningRate: lr, finalLoss: lastLoss.toFixed(4), finalAccuracy: (lastAcc * 100).toFixed(2),
                vocabSize: mainAI.aiVocab.length, numClasses: mainAI.aiClasses.length, numSamples: x.length,
            });

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
        if (!mainAI.aiModel) return;
        try {
            await mainAI.aiModel.save('indexeddb://user-ai-model');
            localStorage.setItem('user_ai_meta', JSON.stringify({ vocab: mainAI.aiVocab, classes: mainAI.aiClasses, trainingData: mainAI.aiDataset }));
            localStorage.setItem('user_ai_version', Date.now().toString());
            alert('모델이 브라우저 로컬 저장소에 저장되었습니다.');
        } catch(e) { alert('저장 실패: ' + e.message); }
    });
};