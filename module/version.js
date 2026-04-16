import * as mainAI from '../ai.js';
import { db } from '../../js/main.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const render = (container) => {
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

    container.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto;">
            <h3 style="color: #f1f5f9; font-size: 18px; margin-bottom: 20px;">모델 상태 및 분석</h3>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 15px; margin-bottom: 25px;">
                ${renderStatCard('모델 상태', mainAI.aiModel ? '로드됨' : '로드되지 않음', 'memory', '#38bdf8')}
                ${renderStatCard('최종 정확도', mainAI.modelStats.isTrained ? `${mainAI.modelStats.finalAccuracy}%` : 'N/A', 'verified', '#10b981')}
                ${renderStatCard('어휘 사전 크기', `${mainAI.aiVocab.length}개`, 'translate', '#f59e0b')}
                ${renderStatCard('의도(클래스) 수', `${mainAI.aiClasses.length}개`, 'label', '#8b5cf6')}
            </div>

            <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                <!-- 학습 정보 -->
                <div style="flex: 1; min-width: 300px; background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155;">
                    <h4 style="margin-top: 0; color: #f1f5f9; font-size: 16px; margin-bottom: 15px;">최근 학습 정보</h4>
                    ${mainAI.modelStats.isTrained ? `
                        ${renderDetailRow('학습 완료 시간', mainAI.modelStats.lastTrainTime)}
                        ${renderDetailRow('학습 소요 시간', `${mainAI.modelStats.trainingDuration}초`)}
                        ${renderDetailRow('Epochs', mainAI.modelStats.epochs)}
                        ${renderDetailRow('Batch Size', mainAI.modelStats.batchSize)}
                        ${renderDetailRow('Learning Rate', mainAI.modelStats.learningRate)}
                        ${renderDetailRow('Final Loss', mainAI.modelStats.finalLoss)}
                        ${renderDetailRow('데이터 샘플 수', mainAI.modelStats.numSamples)}
                    ` : '<div style="font-size: 13px; color: #94a3b8; text-align: center; padding: 20px;">학습 기록이 없습니다.</div>'}
                </div>

                <!-- 아키텍처 정보 -->
                <div style="flex: 1; min-width: 300px; background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155;">
                    <h4 style="margin-top: 0; color: #f1f5f9; font-size: 16px; margin-bottom: 15px;">신경망 아키텍처</h4>
                    <ul style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 12px; line-height: 1.8;">
                        <li>Input Layer: BoW (${mainAI.aiVocab.length || 'N/A'} units)</li>
                        <li><strong>Hidden Layer 1: Dense (128 units, ReLU)</strong></li>
                        <li>Dropout Layer: Rate 0.5</li>
                        <li>Hidden Layer 2: Dense (64 units, ReLU)</li>
                        <li>Output Layer: Dense (${mainAI.aiClasses.length || 'N/A'} units, Softmax)</li>
                    </ul>
                </div>
            </div>
            
            ${mainAI.modelStats.isTrained ? `
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
        btn.textContent = '서버로 업로드 중...'; btn.disabled = true;
        try {
            let artifacts;
            await mainAI.aiModel.save(window.tf.io.withSaveHandler(async a => { artifacts = a; }));
            const weightBase64 = mainAI.bufferToBase64(artifacts.weightData);
            await setDoc(doc(db, "system", "ai_model"), {
                version: Date.now(), vocab: mainAI.aiVocab, classes: mainAI.aiClasses, trainingData: mainAI.aiDataset,
                topology: JSON.stringify(artifacts.modelTopology), weightSpecs: JSON.stringify(artifacts.weightSpecs), weightData: weightBase64
            });
            alert('✅ 성공적으로 서버에 배포되었습니다!');
        } catch(e) {
            console.error(e); alert('배포 실패: ' + e.message);
        } finally {
            btn.textContent = '🚀 현재 모델을 전역 서버로 공식 배포하기'; btn.disabled = false;
        }
    });
};