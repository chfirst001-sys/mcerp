const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// 관리자가 새로운 사용자(직원, 입주민)를 생성하는 Cloud Function
exports.createUser = functions.https.onCall(async (data, context) => {
    // 1. 요청자가 로그인한 사용자인지 기본 검증
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', '인증된 사용자만 접근 가능합니다.');
    }

    // 2. Firestore에서 호출자의 실제 권한(Role) 확인하여 철저한 보안 통제
    const callerDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    const callerRole = callerDoc.exists ? callerDoc.data().role : 'tenant';
    
    // 일반 입주자(tenant)이거나 임원(building_exec)인 경우 계정 생성 API 호출 원천 차단
    if (callerRole === 'tenant' || callerRole === 'building_exec') {
        throw new functions.https.HttpsError('permission-denied', '계정 생성 권한이 없습니다.');
    }

    try {
        // 3. Admin SDK를 사용하여 새 계정 생성 (자동 로그인 발생 안함)
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