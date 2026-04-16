export const render = (container, aiContext) => {
    container.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto; line-height: 1.6;">
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
};