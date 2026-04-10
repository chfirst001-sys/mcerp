import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, auth, escapeHtml } from "../js/main.js";
import CryptoJS from "https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/+esm";

let nardData = [];
let collapsedStates = {}; // id: boolean (true면 접힘)
let contentExpandedStates = {}; // id: boolean (true면 내용 펼침)
let nardSecretKey = null;
let hasDecryptionError = false;

export const init = (container) => {
    if (!auth.currentUser) {
        container.innerHTML = `<div style="text-align: center; padding: 40px; color: #e74c3c;">로그인이 필요합니다.</div>`;
        return;
    }

    // 사용자의 계정 고유 식별자(UID)를 암호화 키로 자동 지정하여 사용자 입력을 생략
    nardSecretKey = auth.currentUser.uid;

    container.innerHTML = `
        <style>
            .action-buttons-wrap::-webkit-scrollbar { display: none; }
        </style>
        <div id="nardListView">
            <div id="nardTreeContainer" style="min-height: 400px; overflow-x: auto; overflow-y: auto; padding-bottom: 20px;">
                <div style="text-align: center; padding: 20px; color: #7f8c8d;">나드를 불러오는 중...</div>
            </div>
        </div>

        <!-- 나드 작성/수정 전체화면 뷰 (Google Keep 스타일) -->
        <div id="nardEditView" style="display: none; flex-direction: column; min-height: calc(100vh - 180px); background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; border-bottom: 1px solid #eee;">
                <button id="cancelNardBtn" style="background: none; border: none; color: #7f8c8d; cursor: pointer; display: flex; align-items: center; padding: 5px;"><span class="material-symbols-outlined">arrow_back</span></button>
                <span id="nardEditTitle" style="font-size: 14px; font-weight: bold; color: #2c3e50;">새 나드</span>
                <button id="saveNardBtn" style="background: none; border: none; color: #2980b9; font-weight: bold; cursor: pointer; padding: 5px;">저장</button>
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
                    return { ...item, title: decryptedTitle, content: decryptedContent };
                });
            }
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
                return {
                    ...item,
                    title: CryptoJS.AES.encrypt(item.title || '', nardSecretKey).toString(),
                    content: item.content ? CryptoJS.AES.encrypt(item.content, nardSecretKey).toString() : '',
                    isEncrypted: true
                };
            });
            await updateDoc(doc(db, "users", auth.currentUser.uid), { nardTree: encryptedData });
        } catch (error) {
            console.error("나드 저장 실패:", error);
            alert("저장 중 오류가 발생했습니다.");
        }
    };

    const renderTree = () => {
        const buildTreeHTML = (parentId, depth) => {
            const children = nardData.filter(m => m.parentId === parentId);
            if (children.length === 0) return '';

            let html = `<ul style="list-style: none; padding-left: 0; margin: 0; ${depth === 0 ? 'min-width: max-content;' : ''}">`;
            
            children.forEach(item => {
                const isCollapsed = collapsedStates[item.id];
                const hasChildren = nardData.some(m => m.parentId === item.id);
                
                let leftIcon = '';
                let iconSize = '20px';
                
                if (item.content) {
                    leftIcon = contentExpandedStates[item.id] ? 'expand_less' : 'expand_more';
                }

                // 제목을 정확히 10글자로 제한 (나머지는 ...)
                const shortTitle = item.title && item.title.length > 10 ? item.title.substring(0, 10) + '...' : (item.title || '');

                html += `
                    <li style="margin: 6px 0; position: relative;">
                        <div style="display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border-radius: 8px; background: #fff; border: 1px solid #e0e0e0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); width: fit-content; transition: all 0.3s ease;" onmouseover="this.style.borderColor='#bdc3c7'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.08)';" onmouseout="this.style.borderColor='#e0e0e0'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.05)';">
                            <div style="display: flex; align-items: flex-start; gap: 8px; overflow: hidden; width: 100px;">
                                <button class="content-toggle-btn" data-id="${item.id}" style="background: none; border: none; padding: 0; cursor: ${item.content ? 'pointer' : 'default'}; color: #2980b9; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 4px; flex-shrink: 0; transition: background 0.2s;" ${item.content ? `onmouseover="this.style.background='#f0f3f4'" onmouseout="this.style.background='none'" title="내용 펼치기/접기"` : ''}>
                                    <span class="material-symbols-outlined" style="font-size: ${iconSize}; transition: transform 0.2s;">${leftIcon}</span>
                                </button>
                                <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; padding-top: 2px;">
                                    <div class="nard-title-box" data-id="${item.id}" style="font-weight: ${depth === 0 ? 'bold' : 'normal'}; font-size: 14px; color: ${hasChildren ? '#2c3e50' : '#34495e'}; cursor: pointer; display: flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.4;" title="클릭하여 하위 나드 열기/닫기">
                                        ${escapeHtml(shortTitle)}
                                    </div>
                                    ${item.content ? `
                                    <div class="nard-content-box" data-id="${item.id}" style="display: ${contentExpandedStates[item.id] ? 'block' : 'none'}; font-size: 12px; color: #7f8c8d; margin-top: 4px; line-height: 1.4; max-height: 7em; overflow-y: auto; white-space: pre-wrap; word-break: break-all; cursor: pointer; background: #f8f9fa; padding: 6px; border-radius: 4px; border: 1px solid #eee;" title="클릭하여 내용 전체보기/수정">
                                        ${escapeHtml(item.content)}
                                    </div>` : ''}
                                </div>
                            </div>
                            
                            <div style="display: flex; align-items: center; flex-shrink: 0;">
                                <div class="action-buttons-wrap" id="actions-${item.id}" style="display: flex; align-items: center; overflow-x: auto; overflow-y: hidden; max-width: 0; opacity: 0; transition: max-width 0.3s ease, opacity 0.3s ease; scrollbar-width: none; -ms-overflow-style: none;">
                                    <div style="display: flex; align-items: center; gap: 2px; padding-right: 4px; width: max-content;">
                                        <button class="outdent-btn" data-id="${item.id}" style="background: transparent; color: #7f8c8d; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" title="내어쓰기 (상위로)" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">format_indent_decrease</span></button>
                                        <button class="indent-btn" data-id="${item.id}" style="background: transparent; color: #7f8c8d; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" title="들여쓰기 (하위로)" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">format_indent_increase</span></button>
                                        <button class="move-up-btn" data-id="${item.id}" style="background: transparent; color: #7f8c8d; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" title="위로 이동" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">arrow_upward</span></button>
                                        <button class="move-down-btn" data-id="${item.id}" style="background: transparent; color: #7f8c8d; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" title="아래로 이동" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">arrow_downward</span></button>
                                        <div style="width: 1px; height: 14px; background: #e0e0e0; margin: 0 4px;"></div>
                                        <button class="add-sub-btn" data-id="${item.id}" style="background: transparent; color: #2980b9; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" title="하위 나드 추가" onmouseover="this.style.background='#e8f4f8'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">add</span></button>
                                        <button class="del-btn" data-id="${item.id}" style="background: transparent; color: #c0392b; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" title="삭제" onmouseover="this.style.background='#fadbd8'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">delete</span></button>
                                        <div style="width: 1px; height: 14px; background: #e0e0e0; margin: 0 4px;"></div>
                                    </div>
                                </div>
                                <button class="more-options-btn" data-id="${item.id}" style="background: transparent; border: none; padding: 4px; border-radius: 50%; cursor: pointer; color: #7f8c8d; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" onmouseover="this.style.background='#f0f3f4'" onmouseout="this.style.background='transparent'" title="작업 메뉴">
                                    <span class="material-symbols-outlined" style="font-size: 20px;">more_vert</span>
                                </button>
                            </div>
                        </div>
                        <div style="display: ${isCollapsed ? 'none' : 'block'}; border-left: 2px solid #ecf0f1; margin-left: 17px; padding-left: 18px; margin-top: 6px;">
                            ${buildTreeHTML(item.id, depth + 1)}
                        </div>
                    </li>
                `;
            });
            html += '</ul>';
            return html;
        };

        const treeHTML = buildTreeHTML(null, 0);
        treeContainer.innerHTML = treeHTML || `<div style="text-align: center; padding: 40px 20px; color: #7f8c8d;"><span class="material-symbols-outlined" style="font-size: 40px; color: #bdc3c7; margin-bottom: 10px;">edit_document</span><br>작성된 나드가 없습니다.<br><span style="font-size:12px;">상단의 '+' 버튼을 눌러 나드를 생성하세요.</span></div>`;

        // 이벤트 바인딩
        treeContainer.querySelectorAll('.content-toggle-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            contentExpandedStates[id] = !contentExpandedStates[id];
            renderTree();
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

        treeContainer.querySelectorAll('.nard-content-box').forEach(box => box.addEventListener('click', (e) => {
            openEditView(null, e.currentTarget.dataset.id);
        }));
        treeContainer.querySelectorAll('.add-sub-btn').forEach(btn => btn.addEventListener('click', (e) => openEditView(e.currentTarget.dataset.id, null)));
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
    };

    const openEditView = (parentId = null, editId = null) => {
        const titleInput = document.getElementById('nardTitleInput'); const contentInput = document.getElementById('nardContentInput');
        const idInput = document.getElementById('nardId'); const pIdInput = document.getElementById('nardParentId');
        
        if (editId) {
            const nard = nardData.find(m => m.id === editId);
            if (nard) { editTitle.textContent = '나드 수정'; idInput.value = nard.id; pIdInput.value = nard.parentId || ''; titleInput.value = nard.title || ''; contentInput.value = nard.content || ''; }
        } else {
            editTitle.textContent = parentId ? '하위 나드 추가' : '새 나드 추가'; idInput.value = ''; pIdInput.value = parentId || ''; titleInput.value = ''; contentInput.value = '';
        }
        listView.style.display = 'none';
        editView.style.display = 'flex';
        setTimeout(() => titleInput.focus(), 100);
    };

    document.getElementById('cancelNardBtn').addEventListener('click', () => {
        editView.style.display = 'none';
        listView.style.display = 'block';
    });
    document.getElementById('saveNardBtn').addEventListener('click', async () => {
        const title = document.getElementById('nardTitleInput').value.trim(); const content = document.getElementById('nardContentInput').value.trim();
        const id = document.getElementById('nardId').value; const parentId = document.getElementById('nardParentId').value || null;

        if (!title) return alert('제목을 입력해주세요.');

        if (id) {
            const nard = nardData.find(m => m.id === id);
            if (nard) { nard.title = title; nard.content = content; nard.updatedAt = Date.now(); }
        } else {
            nardData.push({ id: 'nard_' + Date.now(), parentId: parentId, title: title, content: content, createdAt: Date.now(), updatedAt: Date.now() });
            if (parentId) collapsedStates[parentId] = false;
        }
        await saveNards(); 
        editView.style.display = 'none';
        listView.style.display = 'block';
        renderTree();
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

    loadNards();
};