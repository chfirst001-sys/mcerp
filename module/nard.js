import { doc, getDoc, updateDoc, collection, query, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, auth, escapeHtml } from "../js/main.js";
import CryptoJS from "https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/+esm";

let nardData = [];
let collapsedStates = {}; // id: boolean (true면 접힘)
let contentExpandedStates = {}; // id: boolean (true면 내용 펼침)
let nardSecretKey = null;
let hasDecryptionError = false;
let currentEditIsFavorite = false;
let isSelectingParent = false;
let currentEditNardId = null;
let currentNardMode = localStorage.getItem('nardDefaultMode') || 'tree';
let renderTreeRef = null;
let targetHighlightId = null; // 저장 및 이동 시 하이라이트할 나드 ID

// 고정 구조 노드 여부 확인 헬퍼
const isFixedNode = (id) => {
    if (!id) return false;
    return id === 'nard_quick_root' || id === 'nard_shared_root' || 
           id.startsWith('nard_bldg_') || id.startsWith('nard_fac_') || id.startsWith('nard_plaza_');
};

// 공유나드 하위 여부 확인 헬퍼 (평문 저장용)
const isSharedDescendant = (id) => {
    let curr = id;
    while (curr) {
        if (curr === 'nard_shared_root') return true;
        const node = nardData.find(n => n.id === curr);
        curr = node ? node.parentId : null;
    }
    return false;
};

// 하단 탭 재클릭 시 발동 (전체 접기)
export const onReclick = () => {
    nardData.forEach(item => {
        collapsedStates[item.id] = true;
        contentExpandedStates[item.id] = false;
    });
    if (renderTreeRef) renderTreeRef();
};

export const init = (container) => {
    if (!auth.currentUser) {
        container.innerHTML = `<div style="text-align: center; padding: 40px; color: #e74c3c;">로그인이 필요합니다.</div>`;
        return;
    }

    // 사용자의 계정 고유 식별자(UID)를 암호화 키로 자동 지정하여 사용자 입력을 생략
    nardSecretKey = auth.currentUser.uid;

    const setHeaderTitle = () => {
        const titleEl = document.getElementById('currentBuildingName');
        if (titleEl) titleEl.textContent = currentNardMode === 'memo' ? '나드 메모' : '나드 트리';
    };

    const handleToggleMode = () => {
        currentNardMode = currentNardMode === 'memo' ? 'tree' : 'memo';
        setHeaderTitle();
        renderTree();
    };

    if (container._nardToggleHandler) {
        document.removeEventListener('toggleNardMode', container._nardToggleHandler);
    }
    container._nardToggleHandler = handleToggleMode;
    document.addEventListener('toggleNardMode', handleToggleMode);

    container.innerHTML = `
        <style>
            .action-buttons-wrap::-webkit-scrollbar { display: none; }
            .nard-drag-item.dragging { opacity: 0.5; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
            @keyframes highlight-blue {
                0% { background-color: #fff; }
                30% { background-color: #d6eaf8; }
                100% { background-color: #fff; }
            }
            .highlight-anim { animation: highlight-blue 1.5s ease-in-out !important; }
        </style>
        <div id="nardListView">
            <div id="parentSelectBanner" style="display: none; background: #ffeaa7; padding: 10px; margin-bottom: 10px; border-radius: 4px; font-size: 13px; color: #d35400; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 5px;">
                    <span class="material-symbols-outlined" style="font-size: 18px;">ads_click</span>
                    <span>부모 나드로 지정할 항목 우측의 체크버튼을 누르세요.</span>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button id="selectRootBtn" style="background: #27ae60; padding: 4px 8px; font-size: 12px; border: none; color: white; border-radius: 4px; cursor: pointer;">최상위로 지정</button>
                    <button id="cancelSelectBtn" style="background: #c0392b; padding: 4px 8px; font-size: 12px; border: none; color: white; border-radius: 4px; cursor: pointer;">취소</button>
                </div>
            </div>
            <div id="nardTreeContainer" style="min-height: 400px; overflow-x: auto; overflow-y: auto; padding-bottom: 20px; text-align: left;">
                <div style="text-align: center; padding: 20px; color: #7f8c8d;">나드를 불러오는 중...</div>
            </div>
        </div>

        <!-- 나드 작성/수정 전체화면 뷰 (Google Keep 스타일) -->
        <div id="nardEditView" style="display: none; flex-direction: column; min-height: calc(100vh - 180px); background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; border-bottom: 1px solid #eee;">
                <button id="cancelNardBtn" style="background: none; border: none; color: #7f8c8d; cursor: pointer; display: flex; align-items: center; padding: 5px;"><span class="material-symbols-outlined">arrow_back</span></button>
                <span id="nardEditTitle" style="font-size: 14px; font-weight: bold; color: #2c3e50;">새 나드</span>
                <div style="display: flex; align-items: center;">
                    <button id="editFavoriteBtn" style="background: none; border: none; color: #e0e0e0; cursor: pointer; padding: 5px; margin-right: 10px; display: flex; align-items: center; justify-content: center;" title="즐겨찾기"><span class="material-symbols-outlined" style="font-size: 24px;">star</span></button>
                    <button id="selectLocationBtn" style="background: none; border: none; color: #f39c12; cursor: pointer; padding: 5px; margin-right: 15px; display: flex; align-items: center; justify-content: center;" title="위치지정"><span class="material-symbols-outlined" style="font-size: 24px;">place</span></button>
                    <button id="saveNardBtn" style="background: none; border: none; color: #2980b9; font-weight: bold; cursor: pointer; padding: 5px;">저장</button>
                </div>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; padding: 20px;">
                <input type="hidden" id="nardId">
                <input type="hidden" id="nardParentId">
                
                <input type="text" id="nardTitleInput" placeholder="제목" style="border: none !important; outline: none !important; font-size: 22px !important; font-weight: bold; margin-bottom: 15px; padding: 0 !important; width: 100%; max-width: 100%; background: transparent !important; box-shadow: none !important;">
                
                <textarea id="nardContentInput" placeholder="나드 작성..." style="border: none !important; outline: none !important; font-size: 16px; flex: 1; resize: none; padding: 0 !important; width: 100%; max-width: 100%; line-height: 1.6; background: transparent !important; box-shadow: none !important; min-height: 300px;"></textarea>
            </div>
        </div>
    `;

    const treeContainer = document.getElementById('nardTreeContainer');
    const listView = document.getElementById('nardListView');
    const editView = document.getElementById('nardEditView');
    const editTitle = document.getElementById('nardEditTitle');

    const loadNards = async () => {
        try {
            const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
            if (userDoc.exists()) {
                // 기존 메모 데이터와의 호환성 유지
                const rawData = userDoc.data().nardTree || userDoc.data().memoTree || [];
                hasDecryptionError = false;
                
                nardData = rawData.map(item => {
                    let decryptedTitle = item.title;
                    let decryptedContent = item.content;
                    
                    if (item.isEncrypted) {
                        try {
                            const titleBytes = CryptoJS.AES.decrypt(item.title, nardSecretKey);
                            decryptedTitle = titleBytes.toString(CryptoJS.enc.Utf8);
                            if (!decryptedTitle) throw new Error("Decryption failed");
                            
                            if (item.content) {
                                const contentBytes = CryptoJS.AES.decrypt(item.content, nardSecretKey);
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
            
            // 빠른나드 강제 주입 (삭제 불가, 평문 고정)
            if (!nardData.some(m => m.id === 'nard_quick_root')) {
                nardData.unshift({
                    id: 'nard_quick_root',
                    parentId: null,
                    title: '빠른나드',
                    content: '',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    isEncrypted: false,
                    isFavorite: false
                });
            }

            // 공유나드 강제 주입 (삭제 불가, 광장 공유용)
            if (!nardData.some(m => m.id === 'nard_shared_root')) {
                const quickIndex = nardData.findIndex(m => m.id === 'nard_quick_root');
                const insertIdx = quickIndex >= 0 ? quickIndex + 1 : 0;
                nardData.splice(insertIdx, 0, {
                    id: 'nard_shared_root',
                    parentId: null,
                    title: '공유나드',
                    content: '',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    isEncrypted: false,
                    isFavorite: false
                });
            }

            // 외부(다른 탭)에서 즐겨찾기를 눌러 나드 탭으로 넘어왔을 때 이동 및 하이라이트 처리
            const highlightId = sessionStorage.getItem('targetHighlightNardId');
            if (highlightId) {
                targetHighlightId = highlightId;
                expandParents(highlightId);
                sessionStorage.removeItem('targetHighlightNardId');
            }

            setHeaderTitle();
            renderTree();
        } catch (error) {
            console.error("나드 로드 실패:", error);
            treeContainer.innerHTML = `<div style="text-align: center; color: #e74c3c;">오류가 발생했습니다.</div>`;
        }
    };

    const saveNards = async () => {
        if (hasDecryptionError) {
            alert("복호화에 실패한 항목이 있어 데이터 보호를 위해 저장이 차단되었습니다.\n올바른 비밀번호로 다시 로그인(새로고침)해주세요.");
            return;
        }
        try {
            const encryptedData = nardData.map(item => {
                if (isFixedNode(item.id) || isSharedDescendant(item.id)) return { ...item, isEncrypted: false };
                return {
                    ...item,
                    title: CryptoJS.AES.encrypt(item.title || '', nardSecretKey).toString(),
                    content: item.content ? CryptoJS.AES.encrypt(item.content, nardSecretKey).toString() : '',
                    isEncrypted: true,
                    isFavorite: item.isFavorite || false
                };
            });
            await updateDoc(doc(db, "users", auth.currentUser.uid), { nardTree: encryptedData });
        } catch (error) {
            console.error("나드 저장 실패:", error);
            alert("저장 중 오류가 발생했습니다.");
        }
    };

    const expandParents = (id) => {
        let node = nardData.find(n => n.id === id);
        while (node && node.parentId) {
            collapsedStates[node.parentId] = false;
            node = nardData.find(n => n.id === node.parentId);
        }
    };

    const doHighlight = () => {
        if (!targetHighlightId) return;
        const id = targetHighlightId;
        targetHighlightId = null;
        setTimeout(() => {
            let targetEl = currentNardMode === 'memo' ? document.querySelector(`.memo-card[data-id="${id}"]`) : document.getElementById(`nard-node-${id}`);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const innerCard = currentNardMode === 'memo' ? targetEl : targetEl.querySelector('.nard-main-card');
                if (innerCard) {
                    innerCard.classList.remove('highlight-anim');
                    void innerCard.offsetWidth; // reflow 유발하여 애니메이션 재시작 허용
                    innerCard.classList.add('highlight-anim');
                }
            }
        }, 100);
    };

    const renderTree = () => {
        if (currentNardMode === 'memo' && !isSelectingParent) {
            // 메모(구글 Keep) 모드 렌더링
            let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; padding: 10px;">';
            const memos = nardData.filter(m => !isFixedNode(m.id)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            
            if (memos.length === 0) {
                html += `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #7f8c8d;">작성된 나드가 없습니다.</div>`;
            } else {
                memos.forEach(item => {
                    const favIcon = `<span class="material-symbols-outlined fav-btn" data-id="${item.id}" style="color: ${item.isFavorite ? '#f1c40f' : '#e0e0e0'}; font-variation-settings: 'FILL' ${item.isFavorite ? '1' : '0'}; font-size: 20px; position: absolute; top: 10px; right: 10px; z-index: 2; cursor: pointer; transition: color 0.2s;" title="즐겨찾기" onmouseover="this.style.color='#f1c40f'" onmouseout="this.style.color='${item.isFavorite ? '#f1c40f' : '#e0e0e0'}'">star</span>`;
                    const dateStr = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('ko-KR', {month:'short', day:'numeric'}) : '';
                    html += `
                        <div class="memo-card" data-id="${item.id}" style="background: #fff; position: relative; border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column; height: 160px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                            ${favIcon}
                            <div style="font-weight: bold; font-size: 14px; color: #2c3e50; margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 24px;">${escapeHtml(item.title || '제목 없음')}</div>
                            <div style="font-size: 12px; color: #7f8c8d; flex: 1; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; line-height: 1.5; word-break: break-all;">${escapeHtml(item.content || '')}</div>
                            <div style="font-size: 10px; color: #bdc3c7; text-align: right; margin-top: 8px;">${dateStr}</div>
                        </div>
                    `;
                });
            }
            html += '</div>';
            treeContainer.innerHTML = html;
            treeContainer.style.textAlign = 'left';
            treeContainer.querySelectorAll('.memo-card').forEach(card => {
                card.addEventListener('click', (e) => openEditView(null, e.currentTarget.dataset.id));
            });
            treeContainer.querySelectorAll('.fav-btn').forEach(btn => btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // 클릭 시 카드 수정 모드로 넘어가는 것을 방지
                const id = e.currentTarget.dataset.id;
                const node = nardData.find(m => m.id === id);
                if (node) {
                    node.isFavorite = !node.isFavorite;
                    await saveNards(); renderTree();
                }
            }));
            return;
        }

        // 트리 모드 렌더링
        const buildTreeHTML = (parentId, depth) => {
            const children = nardData.filter(m => m.parentId === parentId);
            if (children.length === 0) return '';

            // 모바일 반응형(가로 폭 100%)을 막는 min-width 속성 제거
            let html = `<ul style="list-style: none; padding-left: 0; margin: 0;">`;
            
            children.forEach(item => {
                const isCollapsed = collapsedStates[item.id];
                const hasChildren = nardData.some(m => m.parentId === item.id);
                
                const fixedNode = isFixedNode(item.id);
                let actionArea = '';
                
                if (isSelectingParent) {
                    // 자신이거나 자신의 하위 나드 안으로는 이동할 수 없도록 필터링
                    const isDescendant = (pId, cId) => {
                        let curr = cId;
                        while (curr) {
                            if (curr === pId) return true;
                            const node = nardData.find(m => m.id === curr);
                            curr = node ? node.parentId : null;
                        }
                        return false;
                    };
                    const isInvalidTarget = currentEditNardId && (item.id === currentEditNardId || isDescendant(currentEditNardId, item.id));
                    
                    if (!isInvalidTarget) {
                        actionArea = `
                            <button class="select-parent-btn" data-id="${item.id}" style="background: transparent; color: #27ae60; border: none; padding: 4px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; transition: background 0.2s;" onmouseover="this.style.background='#eafaf1'" onmouseout="this.style.background='transparent'" title="이 나드의 하위로 지정">
                                <span class="material-symbols-outlined" style="font-size: 24px;">check_circle</span>
                            </button>
                        `;
                    }
                } else {
                    if (fixedNode) {
                        const isRootNode = item.id === 'nard_quick_root' || item.id === 'nard_shared_root';
                        actionArea = `
                            <div class="action-buttons-wrap" id="actions-${item.id}" style="display: flex; align-items: center; overflow-x: auto; overflow-y: hidden; max-width: 0; opacity: 0; transition: max-width 0.3s ease, opacity 0.3s ease; scrollbar-width: none; -ms-overflow-style: none;">
                                <div style="display: flex; align-items: center; gap: 2px; padding-right: 4px; width: max-content;">
                                    <button class="fav-btn" data-id="${item.id}" style="background: transparent; color: ${item.isFavorite ? '#f1c40f' : '#7f8c8d'}; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" title="즐겨찾기" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px; ${item.isFavorite ? 'font-variation-settings: \'FILL\' 1;' : ''}">star</span></button>
                                    <div style="width: 1px; height: 14px; background: #e0e0e0; margin: 0 4px;"></div>
                                    <button class="add-sub-btn" data-id="${item.id}" style="background: transparent; color: #2980b9; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" title="하위 나드 추가" onmouseover="this.style.background='#e8f4f8'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">add</span></button>
                                    ${!isRootNode ? `<button class="del-btn" data-id="${item.id}" style="background: transparent; color: #c0392b; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" title="삭제" onmouseover="this.style.background='#fadbd8'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">delete</span></button>` : ''}
                                </div>
                            </div>
                            <button class="more-options-btn" data-id="${item.id}" style="background: transparent; border: none; padding: 4px; border-radius: 50%; cursor: pointer; color: #7f8c8d; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" onmouseover="this.style.background='#f0f3f4'" onmouseout="this.style.background='transparent'" title="작업 메뉴">
                                <span class="material-symbols-outlined" style="font-size: 20px;">more_vert</span>
                            </button>
                        `;
                    } else {
                        actionArea = `
                            <div class="action-buttons-wrap" id="actions-${item.id}" style="display: flex; align-items: center; overflow-x: auto; overflow-y: hidden; max-width: 0; opacity: 0; transition: max-width 0.3s ease, opacity 0.3s ease; scrollbar-width: none; -ms-overflow-style: none;">
                                <div style="display: flex; align-items: center; gap: 2px; padding-right: 4px; width: max-content;">
                                    <button class="outdent-btn" data-id="${item.id}" style="background: transparent; color: #7f8c8d; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" title="내어쓰기 (상위로)" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">format_indent_decrease</span></button>
                                    <button class="indent-btn" data-id="${item.id}" style="background: transparent; color: #7f8c8d; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" title="들여쓰기 (하위로)" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">format_indent_increase</span></button>
                                    <button class="move-up-btn" data-id="${item.id}" style="background: transparent; color: #7f8c8d; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" title="위로 이동" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">arrow_upward</span></button>
                                    <button class="move-down-btn" data-id="${item.id}" style="background: transparent; color: #7f8c8d; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" title="아래로 이동" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">arrow_downward</span></button>
                                    <div style="width: 1px; height: 14px; background: #e0e0e0; margin: 0 4px;"></div>
                                    <button class="fav-btn" data-id="${item.id}" style="background: transparent; color: ${item.isFavorite ? '#f1c40f' : '#7f8c8d'}; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" title="즐겨찾기" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px; ${item.isFavorite ? 'font-variation-settings: \'FILL\' 1;' : ''}">star</span></button>
                                    <button class="add-sub-btn" data-id="${item.id}" style="background: transparent; color: #2980b9; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" title="하위 나드 추가" onmouseover="this.style.background='#e8f4f8'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">add</span></button>
                                    <button class="edit-btn" data-id="${item.id}" style="background: transparent; color: #27ae60; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" title="수정" onmouseover="this.style.background='#eafaf1'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">edit</span></button>
                                    <button class="del-btn" data-id="${item.id}" style="background: transparent; color: #c0392b; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" title="삭제" onmouseover="this.style.background='#fadbd8'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">delete</span></button>
                                    <div style="width: 1px; height: 14px; background: #e0e0e0; margin: 0 4px;"></div>
                                </div>
                            </div>
                            <button class="more-options-btn" data-id="${item.id}" style="background: transparent; border: none; padding: 4px; border-radius: 50%; cursor: pointer; color: #7f8c8d; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" onmouseover="this.style.background='#f0f3f4'" onmouseout="this.style.background='transparent'" title="작업 메뉴">
                                <span class="material-symbols-outlined" style="font-size: 20px;">more_vert</span>
                            </button>
                        `;
                    }
                }

                let leftIcon = '';
                let iconSize = '20px';
                const isExpanded = contentExpandedStates[item.id] || false;

                let toggleButtonColor = '#2980b9';
                let toggleButtonCursor = 'default';
                let toggleButtonHover = '';

                if (item.id === 'nard_quick_root') {
                    leftIcon = 'bolt';
                    iconSize = '18px';
                    toggleButtonColor = '#f39c12';
                } else if (item.id === 'nard_shared_root') {
                    leftIcon = 'share';
                    iconSize = '18px';
                    toggleButtonColor = '#8e44ad';
                } else if (item.id.startsWith('nard_bldg_')) {
                    leftIcon = 'domain'; iconSize = '18px'; toggleButtonColor = '#34495e';
                } else if (item.id.startsWith('nard_fac_sub_')) {
                    leftIcon = 'folder'; iconSize = '18px'; toggleButtonColor = '#d35400';
                } else if (item.id.startsWith('nard_fac_item_')) {
                    leftIcon = 'article'; iconSize = '18px'; toggleButtonColor = '#8e44ad';
                } else if (item.id.startsWith('nard_plaza_item_')) {
                    leftIcon = 'chat_bubble'; iconSize = '18px'; toggleButtonColor = '#27ae60';
                } else if (item.id.startsWith('nard_fac_')) {
                    leftIcon = 'handyman'; iconSize = '18px'; toggleButtonColor = '#e67e22';
                } else if (item.id.startsWith('nard_plaza_')) {
                    leftIcon = 'forum'; iconSize = '18px'; toggleButtonColor = '#27ae60';
                } else if (item.content) {
                    leftIcon = isExpanded ? 'expand_less' : 'expand_more';
                    toggleButtonCursor = 'pointer';
                    toggleButtonHover = `onmouseover="this.style.background='#f0f3f4'" onmouseout="this.style.background='none'" title="내용 펼치기/접기"`;
                }

                // 제목을 정확히 10글자로 제한 (나머지는 ...)
                const shortTitle = item.title && item.title.length > 8 ? item.title.substring(0, 10) + '...' : (item.title || '');

                html += `
                    <li style="margin: 6px 0; position: relative;" id="nard-node-${item.id}" class="nard-drag-item" data-id="${item.id}">
                        <div style="display: flex; align-items: flex-start; gap: 8px; width: 100%;">
                            <div class="nard-main-card" style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: ${isExpanded ? '12px' : '8px 10px'}; border-radius: 8px; background: #fff; border: 1px solid #e0e0e0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); ${isExpanded ? 'flex: 1;' : 'width: fit-content;'} min-width: ${isExpanded ? '280px' : 'auto'}; transition: all 0.3s ease;" onmouseover="this.style.borderColor='#bdc3c7'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.08)';" onmouseout="this.style.borderColor='#e0e0e0'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.05)';">
                                <div style="display: flex; align-items: flex-start; gap: 8px; overflow: hidden; ${isExpanded ? 'flex: 1;' : 'width: 100px;'}">
                                    <button class="content-toggle-btn" data-id="${item.id}" style="background: none; border: none; padding: 0; cursor: ${toggleButtonCursor}; color: ${toggleButtonColor}; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 4px; flex-shrink: 0; transition: background 0.2s;" ${toggleButtonHover}>
                                        <span class="material-symbols-outlined" style="font-size: ${iconSize}; transition: transform 0.2s;">${leftIcon}</span>
                                    </button>
                                    <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding-top: 2px; text-align: left; width: 100%;">
                                        <div class="nard-title-box" data-id="${item.id}" style="font-weight: ${depth === 0 ? 'bold' : 'normal'}; font-size: 14px; color: ${hasChildren ? '#2c3e50' : '#34495e'}; cursor: pointer; display: flex; align-items: center; justify-content: flex-start; text-align: left; gap: 4px; white-space: ${isExpanded ? 'normal' : 'nowrap'}; overflow: hidden; text-overflow: ellipsis; line-height: 1.4; width: 100%;" title="클릭하여 하위 나드 열기/닫기">
                                            ${escapeHtml(isExpanded ? (item.title || '') : shortTitle)}
                                        </div>
                                        ${item.content ? `
                                        <div class="nard-content-box" data-id="${item.id}" style="display: ${isExpanded ? 'block' : 'none'}; width: 100%; text-align: left !important; font-size: 13px; color: #333; margin-top: 8px; line-height: 1.5; max-height: none; white-space: pre-wrap; word-break: break-all; cursor: pointer; background: transparent; padding: 0; border: none;" title="클릭하여 내용 전체보기/수정">${escapeHtml(item.content)}</div>` : ''}
                                    </div>
                                </div>
                                
                                <div style="display: flex; align-items: center; flex-shrink: 0;">
                                    ${actionArea}
                                </div>
                            </div>
                            ${item.isFavorite ? `<span class="material-symbols-outlined" style="color: #f1c40f; font-variation-settings: 'FILL' 1; font-size: 24px; flex-shrink: 0; align-self: center;" title="즐겨찾기됨">star</span>` : ''}
                        </div>
                        <div style="display: ${isCollapsed ? 'none' : 'block'}; border-left: 2px solid #ecf0f1; margin-left: 12px; padding-left: 10px; margin-top: 6px;">
                            ${buildTreeHTML(item.id, depth + 1)}
                        </div>
                    </li>
                `;
            });
            html += '</ul>';
            return html;
        };

        // 이벤트 및 드래그 앤 드롭 바인딩 헬퍼
        const bindTreeEvents = () => {
            treeContainer.querySelectorAll('.nard-drag-item').forEach(itemEl => {
                let pressTimer;
                const id = itemEl.dataset.id;
                
                const startDragReady = () => {
                    if (isFixedNode(id)) return; 
                    pressTimer = setTimeout(() => {
                        itemEl.setAttribute('draggable', 'true');
                        if (navigator.vibrate) navigator.vibrate(50);
                    }, 400); // 0.4초 꾹 누르면 드래그 활성화
                };
                const cancelDragReady = () => { clearTimeout(pressTimer); };

                itemEl.addEventListener('touchstart', startDragReady, {passive: true});
                itemEl.addEventListener('touchend', cancelDragReady);
                itemEl.addEventListener('touchmove', cancelDragReady, {passive: true});
                itemEl.addEventListener('mousedown', startDragReady);
                itemEl.addEventListener('mouseup', cancelDragReady);
                itemEl.addEventListener('mouseleave', cancelDragReady);

                itemEl.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', id);
                    e.stopPropagation();
                    setTimeout(() => itemEl.classList.add('dragging'), 0);
                });

                itemEl.addEventListener('dragover', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    if (id === 'nard_quick_root') return;
                    itemEl.style.borderTop = '2px solid #2980b9';
                });

                itemEl.addEventListener('dragleave', (e) => { itemEl.style.borderTop = ''; });

                itemEl.addEventListener('drop', async (e) => {
                    e.preventDefault(); e.stopPropagation();
                    itemEl.style.borderTop = '';
                    const draggedId = e.dataTransfer.getData('text/plain');
                    if (!draggedId || draggedId === id || id === 'nard_quick_root') return;

                    const draggedNode = nardData.find(n => n.id === draggedId);
                    if (draggedNode && isFixedNode(draggedNode.id)) return alert('고정된 폴더는 이동할 수 없습니다.');
                    const targetNode = nardData.find(n => n.id === id);
                    
                    if (draggedNode && targetNode) {
                        let curr = targetNode.parentId; let isInvalid = false;
                        while(curr) { if(curr === draggedId) { isInvalid = true; break; } const p = nardData.find(n => n.id === curr); curr = p ? p.parentId : null; }
                        if(isInvalid) return alert('자신의 하위 나드로는 이동할 수 없습니다.');

                        draggedNode.parentId = targetNode.parentId;
                        nardData.splice(nardData.indexOf(draggedNode), 1);
                        nardData.splice(nardData.indexOf(targetNode), 0, draggedNode); // 타겟 위로 끼워넣기
                        await saveNards(); renderTree();
                    }
                });

                itemEl.addEventListener('dragend', () => {
                    itemEl.setAttribute('draggable', 'false');
                    itemEl.classList.remove('dragging');
                    document.querySelectorAll('.nard-drag-item').forEach(el => el.style.borderTop = '');
                });
            });
            // 이하 기존 바인딩 로직 계속...
        };

        const treeHTML = buildTreeHTML(null, 0);
        treeContainer.innerHTML = treeHTML || `<div style="text-align: center; padding: 40px 20px; color: #7f8c8d;"><span class="material-symbols-outlined" style="font-size: 40px; color: #bdc3c7; margin-bottom: 10px;">edit_document</span><br>작성된 나드가 없습니다.<br><span style="font-size:12px;">상단의 '+' 버튼을 눌러 나드를 생성하세요.</span></div>`;

        bindTreeEvents();

        treeContainer.querySelectorAll('.content-toggle-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            contentExpandedStates[id] = !contentExpandedStates[id];
            renderTree();
            
            // 나드 확장 시 화면(카메라)이 나드를 중앙에 맞추도록 이동
            if (contentExpandedStates[id]) {
                setTimeout(() => {
                    const node = document.getElementById(`nard-node-${id}`);
                    if (node) {
                        node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                    }
                }, 50);
            }
        }));

        treeContainer.querySelectorAll('.nard-title-box').forEach(box => box.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            collapsedStates[id] = !collapsedStates[id];
            renderTree();
        }));

        treeContainer.querySelectorAll('.more-options-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.currentTarget.dataset.id;
                const wrap = document.getElementById(`actions-${id}`);
                const isOpening = wrap.style.maxWidth === '0px' || wrap.style.maxWidth === '';
                
                document.querySelectorAll('.action-buttons-wrap').forEach(el => {
                    el.style.maxWidth = '0px';
                    el.style.opacity = '0';
                });

                if (isOpening) {
                    wrap.style.maxWidth = '85px';
                    wrap.style.opacity = '1';
                    
                    if (wrap.dataset.timeoutId) clearTimeout(parseInt(wrap.dataset.timeoutId));
                    
                    wrap.dataset.timeoutId = setTimeout(() => {
                        wrap.style.maxWidth = '0px';
                        wrap.style.opacity = '0';
                    }, 5000);
                }
            });
        });

        if (isSelectingParent) {
            treeContainer.querySelectorAll('.select-parent-btn').forEach(btn => btn.addEventListener('click', (e) => {
                const targetId = e.currentTarget.dataset.id;
                document.getElementById('nardParentId').value = targetId;
                exitSelectionMode();
            }));
        }

        treeContainer.querySelectorAll('.nard-content-box').forEach(box => box.addEventListener('click', (e) => {
            if (isFixedNode(e.currentTarget.dataset.id)) return;
            openEditView(null, e.currentTarget.dataset.id);
        }));
        treeContainer.querySelectorAll('.add-sub-btn').forEach(btn => btn.addEventListener('click', (e) => openEditView(e.currentTarget.dataset.id, null)));
        treeContainer.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', (e) => openEditView(null, e.currentTarget.dataset.id)));
        treeContainer.querySelectorAll('.del-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            if (confirm('이 나드를 삭제하시겠습니까?\n(하위 나드가 있다면 모두 함께 삭제됩니다)')) {
                const idsToDelete = new Set([id]);
                const findChildren = (pId) => { nardData.forEach(m => { if (m.parentId === pId && !idsToDelete.has(m.id)) { idsToDelete.add(m.id); findChildren(m.id); } }); };
                findChildren(id);
                nardData = nardData.filter(m => !idsToDelete.has(m.id));
                await saveNards();
                renderTree();
            }
        }));

        treeContainer.querySelectorAll('.fav-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = e.currentTarget.dataset.id;
            const node = nardData.find(m => m.id === id);
            if (node) {
                node.isFavorite = !node.isFavorite;
                await saveNards(); renderTree();
            }
        }));

        // 계층/순서 이동 이벤트 등록
        treeContainer.querySelectorAll('.move-up-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const node = nardData.find(m => m.id === id);
            const siblings = nardData.filter(m => m.parentId === node.parentId);
            const sibIndex = siblings.findIndex(m => m.id === id);
            if (sibIndex > 0) {
                const prevSibling = siblings[sibIndex - 1];
                const idx1 = nardData.findIndex(m => m.id === id);
                const idx2 = nardData.findIndex(m => m.id === prevSibling.id);
                [nardData[idx1], nardData[idx2]] = [nardData[idx2], nardData[idx1]];
                await saveNards(); renderTree();
            }
        }));
        treeContainer.querySelectorAll('.move-down-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const node = nardData.find(m => m.id === id);
            const siblings = nardData.filter(m => m.parentId === node.parentId);
            const sibIndex = siblings.findIndex(m => m.id === id);
            if (sibIndex < siblings.length - 1) {
                const nextSibling = siblings[sibIndex + 1];
                const idx1 = nardData.findIndex(m => m.id === id);
                const idx2 = nardData.findIndex(m => m.id === nextSibling.id);
                [nardData[idx1], nardData[idx2]] = [nardData[idx2], nardData[idx1]];
                await saveNards(); renderTree();
            }
        }));
        treeContainer.querySelectorAll('.indent-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const node = nardData.find(m => m.id === id);
            const siblings = nardData.filter(m => m.parentId === node.parentId);
            const sibIndex = siblings.findIndex(m => m.id === id);
            if (sibIndex > 0) {
                const prevSibling = siblings[sibIndex - 1];
                node.parentId = prevSibling.id;
                collapsedStates[prevSibling.id] = false; // 상위 폴더 펼치기
                const nodeIdx = nardData.findIndex(m => m.id === node.id);
                nardData.splice(nodeIdx, 1);
                const parentIdx = nardData.findIndex(m => m.id === prevSibling.id);
                nardData.splice(parentIdx + 1, 0, node);
                await saveNards(); renderTree();
            }
        }));
        treeContainer.querySelectorAll('.outdent-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const node = nardData.find(m => m.id === id);
            if (node.parentId) {
                const parent = nardData.find(m => m.id === node.parentId);
                if (parent) {
                    node.parentId = parent.parentId;
                    const nodeIdx = nardData.findIndex(m => m.id === node.id);
                    nardData.splice(nodeIdx, 1);
                    const parentIdx = nardData.findIndex(m => m.id === parent.id);
                    nardData.splice(parentIdx + 1, 0, node);
                    await saveNards(); renderTree();
                }
            }
        }));

        doHighlight();
    };
    renderTreeRef = renderTree;

    const openEditView = (parentId = null, editId = null) => {
        const titleInput = document.getElementById('nardTitleInput'); const contentInput = document.getElementById('nardContentInput');
        const idInput = document.getElementById('nardId'); const pIdInput = document.getElementById('nardParentId');
        const editFavBtn = document.getElementById('editFavoriteBtn');
        const editFavIcon = editFavBtn.querySelector('span');
        
        if (editId) {
            const nard = nardData.find(m => m.id === editId);
            if (nard) { 
                editTitle.textContent = '나드 수정'; idInput.value = nard.id; pIdInput.value = nard.parentId || ''; titleInput.value = nard.title || ''; contentInput.value = nard.content || ''; 
                currentEditIsFavorite = nard.isFavorite || false;
            }
        } else {
            editTitle.textContent = parentId ? '하위 나드 추가' : '새 나드 추가'; idInput.value = ''; pIdInput.value = parentId || 'nard_quick_root'; titleInput.value = ''; contentInput.value = '';
            currentEditIsFavorite = false;
        }
        
        editFavBtn.style.color = currentEditIsFavorite ? '#f1c40f' : '#e0e0e0';
        editFavIcon.style.fontVariationSettings = currentEditIsFavorite ? "'FILL' 1" : "'FILL' 0";

        listView.style.display = 'none';
        editView.style.display = 'flex';
        setTimeout(() => titleInput.focus(), 100);
    };

    document.getElementById('cancelNardBtn').addEventListener('click', () => {
        editView.style.display = 'none';
        listView.style.display = 'block';
    });

    document.getElementById('editFavoriteBtn').addEventListener('click', () => {
        currentEditIsFavorite = !currentEditIsFavorite;
        const editFavBtn = document.getElementById('editFavoriteBtn');
        const editFavIcon = editFavBtn.querySelector('span');
        editFavBtn.style.color = currentEditIsFavorite ? '#f1c40f' : '#e0e0e0';
        editFavIcon.style.fontVariationSettings = currentEditIsFavorite ? "'FILL' 1" : "'FILL' 0";
    });

    document.getElementById('saveNardBtn').addEventListener('click', async () => {
        const title = document.getElementById('nardTitleInput').value.trim(); const content = document.getElementById('nardContentInput').value.trim();
        const id = document.getElementById('nardId').value; const parentId = document.getElementById('nardParentId').value || null;

        if (!title) return alert('제목을 입력해주세요.');

        let targetId = id;
        if (targetId) {
            const nard = nardData.find(m => m.id === targetId);
            if (nard) { nard.title = title; nard.content = content; nard.updatedAt = Date.now(); nard.isFavorite = currentEditIsFavorite; }
        } else {
            targetId = 'nard_' + Date.now();
            nardData.push({ id: targetId, parentId: parentId, title: title, content: content, createdAt: Date.now(), updatedAt: Date.now(), isFavorite: currentEditIsFavorite });
            if (parentId) collapsedStates[parentId] = false;
        }
        await saveNards(); 
        editView.style.display = 'none';
        listView.style.display = 'block';
        targetHighlightId = targetId;
        expandParents(targetId);
        renderTree();
    });

    const exitSelectionMode = () => {
        isSelectingParent = false;
        currentEditNardId = null;
        document.getElementById('parentSelectBanner').style.display = 'none';
        document.getElementById('nardListView').style.display = 'none';
        document.getElementById('nardEditView').style.display = 'flex';
        renderTree();
    };

    document.getElementById('selectLocationBtn').addEventListener('click', () => {
        isSelectingParent = true;
        currentEditNardId = document.getElementById('nardId').value;
        document.getElementById('nardEditView').style.display = 'none';
        document.getElementById('nardListView').style.display = 'block';
        document.getElementById('parentSelectBanner').style.display = 'flex';
        renderTree();
    });

    document.getElementById('selectRootBtn').addEventListener('click', () => {
        document.getElementById('nardParentId').value = '';
        exitSelectionMode();
    });

    document.getElementById('cancelSelectBtn').addEventListener('click', () => {
        exitSelectionMode();
    });

    // 상단 '+' 버튼 클릭 시 전역 커스텀 이벤트 연동
    const handleOpenModal = () => openEditView(null, null);
    if (container._nardOpenHandler) {
        document.removeEventListener('openNardModal', container._nardOpenHandler);
    }
    container._nardOpenHandler = handleOpenModal;
    document.addEventListener('openNardModal', handleOpenModal);

    // 외부(다른 탭)에서 '+' 버튼을 눌러 나드 탭으로 진입한 경우 자동 모달 오픈
    if (window._triggerNewNard) {
        window._triggerNewNard = false;
        setTimeout(() => openEditView(null, null), 100);
    }

    // 여백 클릭 시 열려있는 액션 버튼(점세개 메뉴) 닫기
    if (container._nardGlobalClick) {
        document.removeEventListener('click', container._nardGlobalClick);
    }
    container._nardGlobalClick = (e) => {
        if (!e.target.closest('.more-options-btn') && !e.target.closest('.action-buttons-wrap')) {
            document.querySelectorAll('.action-buttons-wrap').forEach(el => { 
                el.style.maxWidth = '0px'; 
                el.style.opacity = '0'; 
                if (el.dataset.timeoutId) clearTimeout(parseInt(el.dataset.timeoutId));
            });
        }
    };
    document.addEventListener('click', container._nardGlobalClick);

    // 메인(전역)에서 즐겨찾기 항목 클릭 시 호출되는 이동 이벤트
    if (container._nardGotoHandler) document.removeEventListener('gotoNardItem', container._nardGotoHandler);
    container._nardGotoHandler = (e) => {
        const id = e.detail;
        targetHighlightId = id;
        expandParents(id);
        renderTree();
    };
    document.addEventListener('gotoNardItem', container._nardGotoHandler);

    loadNards();
};