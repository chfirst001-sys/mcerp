import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, auth } from "../../js/main.js";
import CryptoJS from "https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/+esm";

export const state = {
    currentDate: new Date(),
    schedules: [],
    nardTreeCache: [],
    editEventId: null,
    currentTabIndex: 2 // 0: day, 1: week, 2: month, 3: year
};

export const loadSchedules = async () => {
    try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) {
            let userData = userDoc.data();
            state.nardTreeCache = userData.nardTree || userData.memoTree || [];
            
            let migrated = false;
            if (userData.schedules && userData.schedules.length > 0) {
                userData.schedules.forEach(s => {
                    if (!state.nardTreeCache.some(n => n.id === s.id)) {
                        state.nardTreeCache.push({
                            id: s.id, parentId: 'nard_quick_root', title: s.title, content: s.memo || '',
                            dueDate: s.date, startDate: s.date, endDate: s.date, isAllDay: true,
                            scheduleType: s.type || 'basic', createdAt: s.createdAt || Date.now(),
                            updatedAt: s.updatedAt || Date.now(), isEncrypted: false, isFavorite: false
                        });
                        migrated = true;
                    }
                });
                if (migrated) await updateDoc(doc(db, "users", auth.currentUser.uid), { nardTree: state.nardTreeCache, schedules: [] });
            }
            
            const secretKey = auth.currentUser.uid;
            state.schedules = state.nardTreeCache.filter(n => n.dueDate || n.startDate).map(n => {
                let decTitle = n.title; let decMemo = n.content;
                if (n.isEncrypted) {
                    try { decTitle = CryptoJS.AES.decrypt(n.title, secretKey).toString(CryptoJS.enc.Utf8); if (n.content) decMemo = CryptoJS.AES.decrypt(n.content, secretKey).toString(CryptoJS.enc.Utf8); } catch(e) {}
                }
                return {
                    id: n.id, startDate: n.startDate || n.dueDate || '', startTime: n.startTime || '09:00',
                    endDate: n.endDate || n.dueDate || n.startDate || '', endTime: n.endTime || '10:00',
                    isAllDay: n.isAllDay !== false, title: decTitle || '제목 없음', type: n.scheduleType || 'basic', memo: decMemo || '', parentId: n.parentId || 'nard_quick_root'
                };
            });
        }
    } catch (error) {
        console.error("일정 로드 실패:", error);
    }
};

export const saveSchedules = async () => {
    await updateDoc(doc(db, "users", auth.currentUser.uid), { nardTree: state.nardTreeCache });
};