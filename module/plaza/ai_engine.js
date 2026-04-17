const tokenize = (text) => text.replace(/[.,!?]/g, '').trim().split(/\s+/);

// MCP Lite: 인텐트(Tag)별로 실행할 데이터 조회 기능이나 UI 액션을 정의하는 확장 가능한 레지스트리
const mcpRegistry = {
    'time_check': {
        type: 'data',
        execute: async (text) => {
            const now = new Date();
            return { 'TIME': now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) };
        }
    },
    'date_check': {
        type: 'data',
        execute: async (text) => {
            const now = new Date();
            return { 'DATE': now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }) };
        }
    },
    'create_memo': {
        type: 'action',
        actionName: 'openNardModal'
    },
    'search_nard': {
        type: 'action',
        actionName: 'openSearchModal'
    }
    // 향후 외부 데이터 연동 (LLM 보강) 예시:
    // 'check_unpaid': {
    //     type: 'data',
    //     execute: async (text) => {
    //         // 1차적으로 정규식을 시도하고, 실패하면 LLM을 통해 "동/호수"만 추출하도록 보강 가능
    //         const match = text.match(/(\d+)호/);
    //         if (match) {
    //             return { 'ROOM': match[1], 'AMOUNT': '150,000' }; // 실제 DB 조회 로직 대체
    //         }
    //         return { 'ROOM': '알 수 없음', 'AMOUNT': '확인 불가(호수를 입력해주세요)' };
    //     }
    // }
};

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

    // 1. 점수와 인덱스를 함께 저장하고 내림차순으로 정렬합니다.
    const scoresWithIndices = Array.from(scores).map((score, index) => ({ score, index }));
    scoresWithIndices.sort((a, b) => b.score - a.score);

    let aiResponse = "무슨 말씀이신지 잘 이해하지 못했어요. 다르게 표현해 주실 수 있나요?";
    let action = null;
    let combinedResponse = "";
    const usedTags = new Set();

    // 3. 최상위(1순위) 의도를 처리합니다. (신뢰도 40% 이상)
    if (scoresWithIndices.length > 0 && scoresWithIndices[0].score > 0.4) {
        const topIntent = scoresWithIndices[0];
        const topTag = classes[topIntent.index];
        const topResponses = responsesMap[topTag];
        let baseResponse = (topResponses && topResponses.length > 0) ? topResponses[Math.floor(Math.random() * topResponses.length)] : "";
        
        // MCP 레지스트리에서 등록된 도구(Tool) 확인 및 실행
        const tool = mcpRegistry[topTag];
        if (tool) {
            if (tool.type === 'data') {
                const variables = await tool.execute(text);
                for (const [key, value] of Object.entries(variables)) {
                    baseResponse = baseResponse.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
                }
                combinedResponse = baseResponse;
            } else if (tool.type === 'action') {
                combinedResponse = baseResponse || `[${topTag} 액션 실행]`;
                action = tool.actionName;
            }
        } else if (baseResponse) {
            combinedResponse = baseResponse;
        } else {
            combinedResponse = `[의도 파악됨: ${topTag}] 하지만 정의된 답변이 없습니다.`;
        }
        usedTags.add(topTag);
    }

    // 4. 2순위, 3순위 등 추가 의도를 조건 하에 조합합니다. (최대 3개까지 조합)
    const MAX_INTENTS_TO_COMBINE = 3;
    for (let i = 1; i < Math.min(scoresWithIndices.length, MAX_INTENTS_TO_COMBINE); i++) {
        const intent = scoresWithIndices[i];
        const tag = classes[intent.index];
        
        // 1순위와 점수 차이가 3배 이하이고, 최소 신뢰도가 20%(0.2) 이상일 때만 추가
        if (intent.score > 0.2 && (scoresWithIndices[0].score / intent.score < 3)) {
            const tool = mcpRegistry[tag];
            
            // 액션 타입은 중복 실행(모달창 여러 개 열림 방지)을 막기 위해 조합에서 제외
            if (!usedTags.has(tag) && (!tool || tool.type !== 'action')) {
                const responses = responsesMap[tag];
                if (responses && responses.length > 0) {
                    let secondResponse = responses[Math.floor(Math.random() * responses.length)];
                    
                    // 서브 의도가 데이터 조회형 도구라면 변수 치환 실행
                    if (tool && tool.type === 'data') {
                        const variables = await tool.execute(text);
                        for (const [key, value] of Object.entries(variables)) {
                            secondResponse = secondResponse.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
                        }
                    }
                    
                    combinedResponse += " " + secondResponse;
                    usedTags.add(tag);
                }
            }
        }
    }

    // 5. 최종 응답을 결정합니다.
    const finalResponse = combinedResponse || aiResponse;

    return { response: finalResponse, action: action };
};