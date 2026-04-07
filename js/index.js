const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// 관리자가 새로운 사용자(직원, 입주민)를 생성하는 Cloud Function
exports.createUser = functions.https.onCall(async (data, context) => {
    // 1. 요청자가 관리자 권한인지 검증 (보안)
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', '인증된 사용자만 접근 가능합니다.');
    }

    try {
        // 2. Admin SDK를 사용하여 새 계정 생성 (자동 로그인 발생 안함)
        const userRecord = await admin.auth().createUser({
            email: data.email,
            password: data.password,
            displayName: data.displayName,
        });
        
        return { uid: userRecord.uid, message: '성공적으로 사용자가 생성되었습니다.' };
    } catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});