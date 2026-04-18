export const render = (container, aiContext) => {
    container.innerHTML = `
        <style>
            .guide-tab-btn { background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: 0.2s; font-weight: bold; white-space: nowrap; font-size: 13px; }
            .guide-tab-btn.active { background: #38bdf8; color: #0f172a; border-color: #38bdf8; }
            .guide-content-section { display: none; padding-top: 15px; line-height: 1.6; color: #cbd5e1; font-size: 14px; animation: fadeIn 0.3s ease; }
            .guide-content-section.active { display: block; }
            .guide-h4 { color: #f59e0b; margin-top: 0; margin-bottom: 10px; font-size: 15px; }
            .guide-box { background: #0f172a; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #334155; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        </style>
        <div style="max-width: 800px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #334155;">
            <h2 style="color: #38bdf8; margin-top: 0; border-bottom: 1px solid #334155; padding-bottom: 10px; margin-bottom: 20px;">📖 AI 비서 학습 스튜디오 사용 설명서</h2>
            
            <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 10px; border-bottom: 1px solid #334155; margin-bottom: 10px;" class="custom-scrollbar">
                <button class="guide-tab-btn active" data-target="guide-intro">👋 시작하기</button>
                <button class="guide-tab-btn" data-target="guide-dataset">📊 1. 데이터셋</button>
                <button class="guide-tab-btn" data-target="guide-train">⚙️ 2. 학습/튜닝</button>
                <button class="guide-tab-btn" data-target="guide-test">💬 3. 봇 테스트</button>
                <button class="guide-tab-btn" data-target="guide-version">📈 4. 모델버전 (배포)</button>
                <button class="guide-tab-btn" data-target="guide-trigger">⚡ 5. Ai트리거</button>
            </div>

            <!-- 0. 시작하기 -->
            <div id="guide-intro" class="guide-content-section active">
                <div style="margin-bottom: 20px;">
                    <p>GoNard의 AI 비서는 단순한 "규칙 기반(Rule-based)" 챗봇이 아닙니다.<br>
                    <strong>자연어 처리(NLP)와 딥러닝(TensorFlow.js)</strong>을 이용해 브라우저에서 직접 신경망을 학습하는 강력한 머신러닝 모델입니다.</p>
                    <p>단어의 출현 빈도와 패턴을 128차원 신경망(Dense Layer)을 통해 분석하여 사용자의 '의도(Intent)'를 파악해 냅니다.</p>
                </div>
                <div class="guide-box" style="border-color: #10b981;">
                    <h4 style="color: #10b981; margin-top: 0; margin-bottom: 10px;">🚀 전체 작업 흐름 (Workflow)</h4>
                    <ol style="margin: 0; padding-left: 20px; line-height: 1.8;">
                        <li><strong>데이터셋:</strong> AI가 이해할 질문(패턴)과 답변의 짝을 만듭니다.</li>
                        <li><strong>학습/튜닝:</strong> 모아둔 데이터를 바탕으로 신경망 모델을 훈련시킵니다.</li>
                        <li><strong>봇 테스트:</strong> 똑똑해진 AI와 대화하며, 의도를 제대로 파악하는지 테스트합니다.</li>
                        <li><strong>모델버전:</strong> 학습이 잘 되었다면 실제 사용자들이 쓸 수 있도록 서버에 배포합니다.</li>
                        <li><strong>Ai트리거:</strong> (고급) AI의 의도를 앱의 실제 기능(UI 조작 등)과 연결합니다.</li>
                    </ol>
                </div>
            </div>

            <!-- 1. 데이터셋 -->
            <div id="guide-dataset" class="guide-content-section">
                <h3 style="color: #f1f5f9; margin-top: 0;">📊 데이터셋 관리</h3>
                <p>AI에게 가르칠 대화 데이터를 관리하는 곳입니다. 폴더를 만들어 깔끔하게 정리할 수 있습니다.</p>
                
                <div class="guide-box">
                    <h4 class="guide-h4">💡 인텐트(Intent)란?</h4>
                    <p style="margin: 0 0 10px 0;">사용자가 말하는 <strong>의도</strong>입니다. 하나의 인텐트에는 영문 Tag, 질문 패턴들, 그리고 답변들이 들어갑니다.</p>
                    <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #94a3b8;">
                        <li><strong>Tag:</strong> <code>weather_check</code> 처럼 영어 소문자와 언더바로 적습니다.</li>
                        <li><strong>패턴:</strong> 사용자가 할 법한 질문들입니다. 쉼표(,)로 구분합니다.</li>
                        <li><strong>응답:</strong> AI가 대답할 말입니다. 여러 개를 적으면 랜덤으로 하나를 출력합니다.</li>
                    </ul>
                </div>

                <div class="guide-box">
                    <h4 class="guide-h4">✅ 좋은 데이터셋을 만드는 요령</h4>
                    <p style="margin: 0 0 10px 0;">다양한 패턴, 일관된 의도 (Diversity is Key)</p>
                    <ul style="margin: 0 0 10px 0; padding-left: 20px; font-size: 13px;">
                        <li><span style="color:#ef4444;">나쁜 예시 ❌</span> : 패턴에 "날씨 알려줘" 1개만 등록</li>
                        <li><span style="color:#10b981;">좋은 예시 ✅</span> : 패턴에 "날씨 알려줘, 오늘 날씨 어때?, 밖에 비 와?, 기온 몇 도야?" 처럼 다양하게 등록</li>
                    </ul>
                    <p style="margin: 0 0 10px 0;">또한, <strong>'모르겠다'고 말하게 가르치기 (Fallback Intent)</strong>도 중요합니다. 아무런 의도에도 속하지 않는 엉뚱한 문장들("ㅋㅋ", "아무거나" 등)을 모아 <code>fallback</code> 이라는 Tag로 만들어두세요.</p>
                </div>
            </div>

            <!-- 2. 학습/튜닝 -->
            <div id="guide-train" class="guide-content-section">
                <h3 style="color: #f1f5f9; margin-top: 0;">⚙️ 하이퍼파라미터 학습 및 튜닝</h3>
                <p>작성한 데이터셋을 신경망에 넣고 학습(Training)시키는 과정입니다.</p>

                <div class="guide-box">
                    <h4 class="guide-h4">파라미터 설명</h4>
                    <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
                        <li><strong>Epochs (에포크):</strong> 전체 데이터를 몇 번 반복 학습할지 정합니다. 데이터가 적을 땐 200~300, 많을 땐 100~150 정도가 적당합니다. 너무 많으면 과적합(Overfitting)이 발생할 수 있습니다.</li>
                        <li><strong>Batch Size (배치 크기):</strong> 한 번에 신경망에 넣을 문제(문장)의 개수입니다. 보통 8, 16, 32를 사용합니다.</li>
                        <li><strong>Learning Rate (학습률):</strong> AI가 정답을 찾아가는 보폭입니다. 기본값(0.01)에서 시작하여 모델 정확도(Acc)가 잘 오르지 않으면 조금씩 줄여보세요(예: 0.005).</li>
                    </ul>
                </div>
                <p style="font-size: 13px; color: #94a3b8;">💡 학습이 완료되면 자동으로 기기(브라우저)에 모델이 임시 저장됩니다.</p>
            </div>

            <!-- 3. 봇 테스트 -->
            <div id="guide-test" class="guide-content-section">
                <h3 style="color: #f1f5f9; margin-top: 0;">💬 봇 테스트</h3>
                <p>학습된 모델이 내가 의도한 대로 잘 대답하는지 확인하는 공간입니다.</p>
                
                <div class="guide-box">
                    <h4 class="guide-h4">테스트 방법</h4>
                    <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
                        <li>데이터셋에 등록하지 않은 <strong>비슷한 뉘앙스의 다른 문장</strong>을 입력해 보세요. AI가 의도를 잘 파악한다면 학습이 성공적으로 된 것입니다.</li>
                        <li>만약 엉뚱한 대답을 한다면 [데이터셋] 탭으로 돌아가 해당 의도에 패턴을 더 추가한 뒤 다시 학습시켜야 합니다.</li>
                        <li>우측 상단의 <strong>[저장된 모델 불러오기]</strong> 버튼을 누르면 기기에 저장된 가장 최근 모델을 가져옵니다.</li>
                    </ul>
                </div>
            </div>

            <!-- 4. 모델버전 -->
            <div id="guide-version" class="guide-content-section">
                <h3 style="color: #f1f5f9; margin-top: 0;">📈 모델버전 (서버 배포)</h3>
                <p>학습 결과(정확도, 손실률)와 모델 구조를 확인하고, 최종 완성된 모델을 실제 서비스에 적용합니다.</p>
                
                <div class="guide-box">
                    <h4 class="guide-h4">🚀 전역 서버로 배포하기</h4>
                    <p style="margin: 0;"><strong>[현재 모델을 전역 서버로 공식 배포하기]</strong> 버튼을 누르면 현재 기기에 있는 모델과 데이터셋이 Firebase 서버에 업로드됩니다.<br><br>
                    배포가 완료되면, 일반 입주민 및 사용자들이 <strong>[광장] > [친구] > [AI 친구]</strong> 메뉴를 통해 똑똑해진 AI와 바로 대화를 나눌 수 있습니다.</p>
                </div>
            </div>

            <!-- 5. Ai트리거 -->
            <div id="guide-trigger" class="guide-content-section">
                <h3 style="color: #f1f5f9; margin-top: 0;">⚡ Ai트리거 (MCP 연동)</h3>
                <p>AI가 단순히 말로만 대답하는 것을 넘어, <strong>실제 앱의 기능(UI)을 조작하거나 실시간 데이터를 가져오게</strong> 만드는 고급 설정입니다.</p>
                
                <div class="guide-box">
                    <h4 class="guide-h4">트리거 구조</h4>
                    <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
                        <li><strong>[IF] 의도(Intent):</strong> 사용자의 어떤 질문(Tag)에 반응할지 선택합니다. (예: <code>search_nard</code>)</li>
                        <li><strong>[SAY] AI 응답:</strong> AI가 답변할 멘트입니다. (데이터셋의 응답보다 이 트리거의 응답이 우선 적용됩니다.) <code>{{TIME}}</code>, <code>{{DATE}}</code> 같은 변수도 사용할 수 있습니다.</li>
                        <li><strong>[THEN] 액션/데이터:</strong> 앱에서 실행할 행동입니다.
                            <br> - <em>UI 액션 실행</em>: 특정 팝업이나 검색창을 엽니다. (예: <code>openSearchModal</code>, <code>openNardModal</code>)
                            <br> - <em>데이터 조회</em>: 서버나 기기에서 정보를 가져와 응답의 변수를 채워줍니다. (예: <code>getCurrentTime</code>)
                        </li>
                    </ul>
                </div>
                <p style="font-size: 13px; color: #94a3b8;">💡 AI가 사용자의 명령을 받아 비서처럼 앱을 조종하게 만들 수 있습니다!</p>
            </div>

        </div>
    `;

    const btns = container.querySelectorAll('.guide-tab-btn');
    const sections = container.querySelectorAll('.guide-content-section');

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            btn.classList.add('active');
            container.querySelector('#' + btn.dataset.target).classList.add('active');
        });
    });
};