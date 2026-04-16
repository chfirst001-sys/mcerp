const tokenize = (text) => text.replace(/[.,!?]/g, '').trim().split(/\s+/);

/**
 * AI 모델을 사용하여 사용자의 텍스트에 대한 응답을 생성합니다.
 * @param {string} text 사용자 입력 텍스트
 * @param {tf.LayersModel} model 로드된 TensorFlow.js 모델
 * @param {string[]} vocab 어휘 사전 배열
 * @param {string[]} classes 클래스(태그) 배열
 * @param {Object.<string, string[]>} responsesMap 태그별 응답 목록 객체
 * @returns {Promise<{response: string, action: string|null}>} AI의 응답과 수행할 액션을 포함하는 객체
 */
export const getAIResponse = async (text, model, vocab, classes, responsesMap) => {
    if (!model || !vocab || !classes || !responsesMap) {
        return { response: "AI 엔진이 준비되지 않았습니다.", action: null };
    }

    const words = tokenize(text);
    const bag = vocab.map(w => words.includes(w) ? 1 : 0);
    const inputTensor = window.tf.tensor2d([bag]);
    
    const prediction = model.predict(inputTensor);
    const scores = await prediction.data();
    inputTensor.dispose();
    prediction.dispose();

    const maxScore = Math.max(...scores);
    
    let aiResponse = "무슨 말씀이신지 잘 이해하지 못했어요. 다르게 표현해 주실 수 있나요?";
    let action = null;

    if (maxScore > 0.4) {
        const intentIdx = scores.indexOf(maxScore);
        const predictedTag = classes[intentIdx];
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
            action = 'openNardModal';
        } else if (predictedTag === 'search_nard') {
            aiResponse = responses && responses.length > 0 ? responses[Math.floor(Math.random() * responses.length)] : "통합 검색창을 열어드릴게요.";
            action = 'openSearchModal';
        } else if (responses && responses.length > 0) {
            aiResponse = responses[Math.floor(Math.random() * responses.length)];
        } else {
            aiResponse = `[의도 파악됨: ${predictedTag}] 하지만 정의된 답변이 없습니다.`;
        }
    }

    return { response: aiResponse, action: action };
};