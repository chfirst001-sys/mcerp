import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db } from "../../js/main.js";
import CryptoJS from "https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/+esm";

export const isFixedNode = (id) => {
    if (!id) return false;
    return id === 'nard_quick_root' || id === 'nard_shared_root' || 
           id.startsWith('nard_bldg_') || id.startsWith('nard_fac_') || id.startsWith('nard_plaza_');
};

export const isSharedDescendant = (id, nardData) => {
    let curr = id;
    while (curr) {
        if (curr === 'nard_shared_root') return true;
        const node = nardData.find(n => n.id === curr);
        curr = node ? node.parentId : null;
    }
    return false;
};

export const fetchNardTree = async (uid, secretKey) => {
    const userDoc = await getDoc(doc(db, "users", uid));
    let hasDecryptionError = false;
    let parsedData = [];

    if (userDoc.exists()) {
        const rawData = userDoc.data().nardTree || userDoc.data().memoTree || [];
        parsedData = rawData.map(item => {
            let decryptedTitle = item.title;
            let decryptedContent = item.content;
            
            if (item.isEncrypted) {
                try {
                    const titleBytes = CryptoJS.AES.decrypt(item.title, secretKey);
                    decryptedTitle = titleBytes.toString(CryptoJS.enc.Utf8);
                    if (!decryptedTitle) throw new Error("Decryption failed");
                    
                    if (item.content) {
                        const contentBytes = CryptoJS.AES.decrypt(item.content, secretKey);
                        decryptedContent = contentBytes.toString(CryptoJS.enc.Utf8);
                    }
                } catch (e) {
                    hasDecryptionError = true;
                    decryptedTitle = "🔒 복호화 실패";
                    decryptedContent = "비밀번호가 다릅니다. 데이터를 안전하게 보호하기 위해 읽기 전용으로 표시됩니다.";
                }
            }
            return { ...item, title: decryptedTitle, content: decryptedContent, isFavorite: item.isFavorite || false };
        });
    }

    // 시스템 기본 노드(빠른나드, 공유나드) 주입
    if (!parsedData.some(m => m.id === 'nard_quick_root')) parsedData.unshift({ id: 'nard_quick_root', parentId: null, title: '빠른나드', content: '', createdAt: Date.now(), updatedAt: Date.now(), isEncrypted: false, isFavorite: false });
    if (!parsedData.some(m => m.id === 'nard_shared_root')) {
        const idx = parsedData.findIndex(m => m.id === 'nard_quick_root');
        parsedData.splice(idx >= 0 ? idx + 1 : 0, 0, { id: 'nard_shared_root', parentId: null, title: '공유나드', content: '', createdAt: Date.now(), updatedAt: Date.now(), isEncrypted: false, isFavorite: false });
    }

    return { parsedData, hasDecryptionError };
};

export const commitNardTree = async (uid, secretKey, nardData, hasDecryptionError) => {
    if (hasDecryptionError) {
        alert("복호화에 실패한 항목이 있어 데이터 보호를 위해 저장이 차단되었습니다.\n올바른 비밀번호로 다시 로그인(새로고침)해주세요.");
        return false;
    }
    try {
        const encryptedData = nardData.map(item => {
            if (isFixedNode(item.id) || isSharedDescendant(item.id, nardData)) return { ...item, isEncrypted: false };
            return { ...item, title: CryptoJS.AES.encrypt(item.title || '', secretKey).toString(), content: item.content ? CryptoJS.AES.encrypt(item.content, secretKey).toString() : '', isEncrypted: true, isFavorite: item.isFavorite || false };
        });
        await updateDoc(doc(db, "users", uid), { nardTree: encryptedData });
        return true;
    } catch (error) {
        console.error("나드 저장 실패:", error); alert("저장 중 오류가 발생했습니다.");
        return false;
    }
};