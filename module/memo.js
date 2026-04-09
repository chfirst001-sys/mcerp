import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, auth, escapeHtml } from "../js/main.js";

let memoData = [];
let collapsedStates = {}; // id: boolean (true면 접힘)

export const init = (container) => {
    if (!auth.currentUser) {
        container.innerHTML = `<div style="text-align: center; padding: 40px; color: #e74c3c;">로그인이 필요합니다.</div>`;
        return;
    }

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h2 style="margin: 0; color: #2c3e50;">📝 내 메모</h2>
            <button id="addRootMemoBtn" style="background-color: #2980b9; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: bold;">
                <span class="material-symbols-outlined" style="font-size: 18px;">add</span> 새 메모
            </button>
        </div>

        <div id="memoTreeContainer" style="min-height: 400px; overflow-y: auto; padding-bottom: 20px;">
            <div style="text-align: center; padding: 20px; color: #7f8c8d;">메모를 불러오는 중...</div>
        </div>

        <!-- 메모 작성/수정 모달 -->
        <div id="memoModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 4000; justify-content: center; align-items: center;">
            <div style="background: white; padding: 25px; border-radius: 12px; width: 90%; max-width: 500px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); display: flex; flex-direction: column;">
                <h3 id="memoModalTitle" style="margin-top: 0; color: #2c3e50; margin-bottom: 20px;">새 메모</h3>
                <input type="hidden" id="memoId">
                <input type="hidden" id="memoParentId">
                
                <input type="text" id="memoTitleInput" placeholder="제목을 입력하세요" style="margin-bottom: 15px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; font-size: 15px; font-weight: bold; box-sizing: border-box; outline: none;">
                
                <textarea id="memoContentInput" placeholder="메모 내용을 입력하세요..." style="margin-bottom: 20px; padding: 10px; width: 100%; height: 200px; border: 1px solid #ccc; border-radius: 4px; resize: none; font-size: 14px; box-sizing: border-box; outline: none;"></textarea>
                
                <div style="display: flex; gap: 10px;">
                    <button id="saveMemoBtn" style="flex: 1; background: #2980b9; padding: 12px; color: white; border: none; border-radius: 4px; font-size: 14px; cursor: pointer; font-weight: bold;">저장</button>
                    <button id="cancelMemoBtn" style="flex: 1; background: #95a5a6; padding: 12px; color: white; border: none; border-radius: 4px; font-size: 14px; cursor: pointer; font-weight: bold;">취소</button>
                </div>
            </div>
        </div>
    `;

    const treeContainer = document.getElementById('memoTreeContainer');
    const memoModal = document.getElementById('memoModal');

    const loadMemos = async () => {
        try {
            const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
            if (userDoc.exists()) {
                memoData = userDoc.data().memoTree || [];
            }
            renderTree();
        } catch (error) {
            console.error("메모 로드 실패:", error);
            treeContainer.innerHTML = `<div style="text-align: center; color: #e74c3c;">오류가 발생했습니다.</div>`;
        }
    };

    const saveMemos = async () => {
        try {
            await updateDoc(doc(db, "users", auth.currentUser.uid), { memoTree: memoData });
        } catch (error) {
            console.error("메모 저장 실패:", error);
            alert("저장 중 오류가 발생했습니다.");
        }
    };

    const renderTree = () => {
        const buildTreeHTML = (parentId, depth) => {
            const children = memoData.filter(m => m.parentId === parentId);
            if (children.length === 0) return '';

            let html = `<ul style="list-style: none; padding-left: ${depth === 0 ? '0' : '20px'}; margin: 0;">`;
            
            children.forEach(item => {
                const isCollapsed = collapsedStates[item.id];
                const hasChildren = memoData.some(m => m.parentId === item.id);
                
                const dotIcon = depth === 0 ? 'trip_origin' : 'fiber_manual_record';
                const iconSize = depth === 0 ? '16px' : '12px';

                html += `
                    <li style="margin: 4px 0;">
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 6px 8px; border-radius: 6px; background: transparent; border: 1px solid transparent; transition: all 0.2s;" onmouseover="this.style.background='#f8f9fa'; this.style.borderColor='#e0e0e0';" onmouseout="this.style.background='transparent'; this.style.borderColor='transparent';">
                            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <button class="toggle-btn" data-id="${item.id}" style="background: none; border: none; padding: 0; cursor: pointer; color: ${hasChildren ? '#2c3e50' : '#bdc3c7'}; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 4px; transition: background 0.2s;" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='none'">
                                        <span class="material-symbols-outlined" style="font-size: ${hasChildren ? '20px' : iconSize}; transition: transform 0.2s; ${isCollapsed ? 'transform: rotate(-90deg);' : ''}">${hasChildren ? 'expand_more' : dotIcon}</span>
                                    </button>
                                    <span style="font-weight: ${depth === 0 ? 'bold' : 'normal'}; font-size: 15px; color: #2c3e50; word-break: break-all;">${escapeHtml(item.title)}</span>
                                </div>
                                ${item.content ? `<div style="font-size: 13px; color: #7f8c8d; padding-left: 30px; margin-top: 4px; white-space: pre-wrap; line-height: 1.5; word-break: break-all;">${escapeHtml(item.content)}</div>` : ''}
                            </div>
                            
                            <div style="display: flex; gap: 2px; flex-shrink: 0; align-items: center; opacity: 0.8; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
                                <button class="outdent-btn" data-id="${item.id}" style="background: transparent; color: #7f8c8d; border: none; padding: 4px; border-radius: 4px; cursor: pointer;" title="내어쓰기 (상위로)" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">format_indent_decrease</span></button>
                                <button class="indent-btn" data-id="${item.id}" style="background: transparent; color: #7f8c8d; border: none; padding: 4px; border-radius: 4px; cursor: pointer;" title="들여쓰기 (하위로)" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">format_indent_increase</span></button>
                                <button class="move-up-btn" data-id="${item.id}" style="background: transparent; color: #7f8c8d; border: none; padding: 4px; border-radius: 4px; cursor: pointer;" title="위로 이동" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">arrow_upward</span></button>
                                <button class="move-down-btn" data-id="${item.id}" style="background: transparent; color: #7f8c8d; border: none; padding: 4px; border-radius: 4px; cursor: pointer;" title="아래로 이동" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">arrow_downward</span></button>
                                
                                <div style="width: 1px; height: 16px; background: #ccc; margin: 0 4px;"></div>
                                
                                <button class="add-sub-btn" data-id="${item.id}" style="background: transparent; color: #2980b9; border: none; padding: 4px; border-radius: 4px; cursor: pointer;" title="하위 메모 추가" onmouseover="this.style.background='#e8f4f8'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">add</span></button>
                                <button class="edit-btn" data-id="${item.id}" style="background: transparent; color: #d35400; border: none; padding: 4px; border-radius: 4px; cursor: pointer;" title="수정" onmouseover="this.style.background='#fef5e7'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">edit</span></button>
                                <button class="del-btn" data-id="${item.id}" style="background: transparent; color: #c0392b; border: none; padding: 4px; border-radius: 4px; cursor: pointer;" title="삭제" onmouseover="this.style.background='#fadbd8'" onmouseout="this.style.background='transparent'"><span class="material-symbols-outlined" style="font-size: 16px;">delete</span></button>
                            </div>
                        </div>
                        <div style="display: ${isCollapsed ? 'none' : 'block'}; border-left: 2px solid #ecf0f1; margin-left: 11px; padding-left: 14px; margin-top: 2px;">
                            ${buildTreeHTML(item.id, depth + 1)}
                        </div>
                    </li>
                `;
            });
            html += '</ul>';
            return html;
        };

        const treeHTML = buildTreeHTML(null, 0);
        treeContainer.innerHTML = treeHTML || `<div style="text-align: center; padding: 40px 20px; color: #7f8c8d;"><span class="material-symbols-outlined" style="font-size: 40px; color: #bdc3c7; margin-bottom: 10px;">edit_document</span><br>작성된 메모가 없습니다.<br><span style="font-size:12px;">'새 메모' 버튼을 눌러 생각을 기록하세요.</span></div>`;

        // 이벤트 바인딩
        treeContainer.querySelectorAll('.toggle-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            collapsedStates[id] = !collapsedStates[id];
            renderTree();
        }));

        treeContainer.querySelectorAll('.add-sub-btn').forEach(btn => btn.addEventListener('click', (e) => openModal(e.currentTarget.dataset.id, null)));
        treeContainer.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', (e) => openModal(null, e.currentTarget.dataset.id)));
        treeContainer.querySelectorAll('.del-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            if (confirm('이 메모를 삭제하시겠습니까?\n(하위 메모가 있다면 모두 함께 삭제됩니다)')) {
                const idsToDelete = new Set([id]);
                const findChildren = (pId) => { memoData.forEach(m => { if (m.parentId === pId && !idsToDelete.has(m.id)) { idsToDelete.add(m.id); findChildren(m.id); } }); };
                findChildren(id);
                memoData = memoData.filter(m => !idsToDelete.has(m.id));
                await saveMemos();
                renderTree();
            }
        }));

        // 계층/순서 이동 이벤트 등록
        treeContainer.querySelectorAll('.move-up-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const node = memoData.find(m => m.id === id);
            const siblings = memoData.filter(m => m.parentId === node.parentId);
            const sibIndex = siblings.findIndex(m => m.id === id);
            if (sibIndex > 0) {
                const prevSibling = siblings[sibIndex - 1];
                const idx1 = memoData.findIndex(m => m.id === id);
                const idx2 = memoData.findIndex(m => m.id === prevSibling.id);
                [memoData[idx1], memoData[idx2]] = [memoData[idx2], memoData[idx1]];
                await saveMemos(); renderTree();
            }
        }));
        treeContainer.querySelectorAll('.move-down-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const node = memoData.find(m => m.id === id);
            const siblings = memoData.filter(m => m.parentId === node.parentId);
            const sibIndex = siblings.findIndex(m => m.id === id);
            if (sibIndex < siblings.length - 1) {
                const nextSibling = siblings[sibIndex + 1];
                const idx1 = memoData.findIndex(m => m.id === id);
                const idx2 = memoData.findIndex(m => m.id === nextSibling.id);
                [memoData[idx1], memoData[idx2]] = [memoData[idx2], memoData[idx1]];
                await saveMemos(); renderTree();
            }
        }));
        treeContainer.querySelectorAll('.indent-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const node = memoData.find(m => m.id === id);
            const siblings = memoData.filter(m => m.parentId === node.parentId);
            const sibIndex = siblings.findIndex(m => m.id === id);
            if (sibIndex > 0) {
                const prevSibling = siblings[sibIndex - 1];
                node.parentId = prevSibling.id;
                collapsedStates[prevSibling.id] = false; // 상위 폴더 펼치기
                const nodeIdx = memoData.findIndex(m => m.id === node.id);
                memoData.splice(nodeIdx, 1);
                const parentIdx = memoData.findIndex(m => m.id === prevSibling.id);
                memoData.splice(parentIdx + 1, 0, node);
                await saveMemos(); renderTree();
            }
        }));
        treeContainer.querySelectorAll('.outdent-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const node = memoData.find(m => m.id === id);
            if (node.parentId) {
                const parent = memoData.find(m => m.id === node.parentId);
                if (parent) {
                    node.parentId = parent.parentId;
                    const nodeIdx = memoData.findIndex(m => m.id === node.id);
                    memoData.splice(nodeIdx, 1);
                    const parentIdx = memoData.findIndex(m => m.id === parent.id);
                    memoData.splice(parentIdx + 1, 0, node);
                    await saveMemos(); renderTree();
                }
            }
        }));
    };

    const openModal = (parentId = null, editId = null) => {
        const titleInput = document.getElementById('memoTitleInput'); const contentInput = document.getElementById('memoContentInput');
        const idInput = document.getElementById('memoId'); const pIdInput = document.getElementById('memoParentId');
        
        if (editId) {
            const memo = memoData.find(m => m.id === editId);
            if (memo) { document.getElementById('memoModalTitle').textContent = '메모 수정'; idInput.value = memo.id; pIdInput.value = memo.parentId || ''; titleInput.value = memo.title || ''; contentInput.value = memo.content || ''; }
        } else {
            document.getElementById('memoModalTitle').textContent = parentId ? '하위 메모 추가' : '새 메모 추가'; idInput.value = ''; pIdInput.value = parentId || ''; titleInput.value = ''; contentInput.value = '';
        }
        memoModal.style.display = 'flex'; setTimeout(() => titleInput.focus(), 100);
    };

    document.getElementById('addRootMemoBtn').addEventListener('click', () => openModal(null, null));
    document.getElementById('cancelMemoBtn').addEventListener('click', () => memoModal.style.display = 'none');
    document.getElementById('saveMemoBtn').addEventListener('click', async () => {
        const title = document.getElementById('memoTitleInput').value.trim(); const content = document.getElementById('memoContentInput').value.trim();
        const id = document.getElementById('memoId').value; const parentId = document.getElementById('memoParentId').value || null;

        if (!title) return alert('제목을 입력해주세요.');

        if (id) {
            const memo = memoData.find(m => m.id === id);
            if (memo) { memo.title = title; memo.content = content; memo.updatedAt = Date.now(); }
        } else {
            memoData.push({ id: 'memo_' + Date.now(), parentId: parentId, title: title, content: content, createdAt: Date.now(), updatedAt: Date.now() });
            if (parentId) collapsedStates[parentId] = false;
        }
        await saveMemos(); memoModal.style.display = 'none'; renderTree();
    });

    loadMemos();
};