const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// 생성형 AI(ChatGPT / Gemini) 연동을 위한 Cloud Function
exports.askGenerativeAI = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', '인증된 사용자만 접근할 수 있습니다.');
    }

    const userMessage = data.message;
    const openAIKey = functions.config().openai?.key;

    // Firebase 환경변수에 API 키가 설정되지 않았다면, 임시 메시지를 반환합니다.
    if (!openAIKey) {
        return { reply: `[생성형 AI 모드] OpenAI API 키가 서버에 설정되지 않았습니다. (사용자 질문: ${userMessage})` };
    }
    
    try {
        // 실제 OpenAI API 호출 로직
        const { Configuration, OpenAIApi } = require("openai");
        const configuration = new Configuration({ apiKey: openAIKey });
        const openai = new OpenAIApi(configuration);
        
        const response = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "당신은 GoNard(나드터)의 유능하고 다정한 AI 비서입니다. 짧고 간결하게 대답해주세요." },
                { role: "user", content: userMessage }
            ]
        });
        
        return { reply: response.data.choices[0].message.content };
        
    } catch (error) {
        console.error("OpenAI API 호출 오류:", error);
        throw new functions.https.HttpsError('internal', 'AI 생성 중 오류가 발생했습니다.');
    }
});