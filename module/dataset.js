import * as mainAI from '../ai.js';
import { db, escapeHtml } from '../../js/main.js';
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const render = (container) => {
    container.innerHTML = `
        <div id="ai-dataset-move-banner" style="display: none; background: #ffeaa7; padding: 10px 15px; margin-bottom: 15px; border-radius: 6px; font-size: 13px; color: #d35400; align-items: center; justify-content: space-between; border: 1px solid #fdcb6e;">
            <div id="move-banner-text" style="display: flex; align-items: center; gap: 5px;"><span class="material-symbols-outlined" style="font-size: 18px;">drive_file_move</span></div>
            <div style="display: flex; gap: 5px;">
                <button id="moveRootBtn" style="background: #27ae60; padding: 4px 8px; font-size: 12px; border: none; color: white; border-radius: 4px; cursor: pointer;">최상위로</button>
                <button id="cancelMoveBtn" style="background: #c0392b; padding: 4px 8px; font-size: 12px; border: none; color: white; border-radius: 4px; cursor: pointer;">취소</button>
            </div>
        </div>
        
        <div id="ai-dataset-controls" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; gap: 10px;">
            <div style="position: relative; flex: 1;">
                <input type="search" id="aiDatasetSearchInput" placeholder="데이터셋 검색 (Tag, 패턴, 응답)..." style="width: 100%; padding: 8px 12px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: white; box-sizing: border-box;">
                <span class="material-symbols-outlined" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #64748b;">search</span>
            </div>
            <div style="display: flex; gap: 5px; align-items: center;">
                <button id="aiAddNewFolderBtn" title="새 폴더" style="background: #f59e0b; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;"><span class="material-symbols-outlined" style="font-size:18px;">create_new_folder</span></button>
                <button id="aiAddNewIntentBtn" title="새 인텐트" style="background: #10b981; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;"><span class="material-symbols-outlined" style="font-size:18px;">note_add</span></button>
                <div style="width: 1px; height: 20px; background: #334155;"></div>
                <button id="aiUpdateBtn" title="서버에서 업데이트" style="background: #10b981; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;"><span class="material-symbols-outlined" style="font-size: 18px;">cloud_download</span></button>
                <button id="aiUploadBtn" title="서버로 업로드" style="background: #8b5cf6; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;"><span class="material-symbols-outlined" style="font-size: 18px;">cloud_upload</span></button>
                <button id="aiSaveDataBtn" title="로컬에 저장" style="background: #3b82f6; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;"><span class="material-symbols-outlined" style="font-size: 18px;">save</span></button>
            </div>
        </div>
        <div id="ai-dataset-form-container"></div>
        <div id="ai-dataset-list-container" style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 15px; min-height: 300px;"></div>
    `;
    renderDatasetView();
    attachDatasetControlEvents();
};

const renderDatasetView = () => {
    const container = document.getElementById('ai-dataset-list-container');
    const searchInput = document.getElementById('aiDatasetSearchInput');
    if (!container || !searchInput) return;

    const banner = document.getElementById('ai-dataset-move-banner');
    if (mainAI.movingItemId) {
        const item = mainAI.aiDataset.find(i => i.id === mainAI.movingItemId);
        const bannerText = document.getElementById('move-banner-text');
        if (item && bannerText) bannerText.innerHTML = `<span class="material-symbols-outlined" style="font-size: 18px;">drive_file_move</span>'${escapeHtml(item.name)}' 이동 중... 목적지 폴더를 클릭하세요.`;
        if (banner) banner.style.display = 'flex';
    } else {
        if (banner) banner.style.display = 'none';
    }

    const query = searchInput.value.toLowerCase().trim();

    if (query) {
        renderSearchResults(query);
    } else {
        renderDatasetTree();
    }
};

const renderDatasetTree = () => {
    const container = document.getElementById('ai-dataset-list-container');
    if (!container) return;

    const buildTreeHTML = (parentId, depth = 0) => {
        const children = mainAI.aiDataset.filter(item => item.parentId === parentId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

        if (children.length === 0 && depth > 0) return '';

        let html = `<ul style="list-style: none; padding-left: ${depth > 0 ? '20px' : '0'};">`;
        children.forEach(item => {
            const isFolder = item.type === 'folder';
            const isCollapsed = mainAI.collapsedStates[item.id] === true;
            const isSelected = mainAI.selectedFolderId === item.id;
            const icon = isFolder ? (isCollapsed ? 'folder' : 'folder_open') : 'chat_bubble';
            const isMenuOpen = mainAI.menuOpenStates[item.id];

            html += `
                <li data-id="${item.id}" style="margin: 2px 0;">
                    <div class="dataset-item" style="display: flex; flex-direction: column; padding: 8px; border-radius: 6px; cursor: pointer; background: ${isSelected ? '#334155' : 'transparent'};" onmouseover="this.style.background='${isSelected ? '#334155' : '#2c3e50'}'" onmouseout="this.style.background='${isSelected ? '#334155' : 'transparent'}'">
                        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                            <div class="dataset-item-main" data-id="${item.id}" data-type="${item.type}" style="flex: 1; display: flex; align-items: center; gap: 8px;">
                                <span class="material-symbols-outlined" style="color: ${isFolder ? '#f59e0b' : '#38bdf8'};">${icon}</span>
                                <span style="color: #f1f5f9; font-weight: bold;">${escapeHtml(item.name)}</span>
                            </div>
                            <div style="display: flex; align-items: center;">
                                <div class="dataset-action-menu ${isMenuOpen ? 'expanded' : ''}">
                                    <button title="위로" class="dataset-action-btn move-up-btn" data-id="${item.id}"><span class="material-symbols-outlined">arrow_upward</span></button>
                                    <button title="아래로" class="dataset-action-btn move-down-btn" data-id="${item.id}"><span class="material-symbols-outlined">arrow_downward</span></button>
                                    <button title="들여쓰기" class="dataset-action-btn indent-btn" data-id="${item.id}"><span class="material-symbols-outlined">format_indent_increase</span></button>
                                    <button title="내어쓰기" class="dataset-action-btn outdent-btn" data-id="${item.id}"><span class="material-symbols-outlined">format_indent_decrease</span></button>
                                    <button title="위치 이동" class="dataset-action-btn move-item-btn" data-id="${item.id}"><span class="material-symbols-outlined">drive_file_move</span></button>
                                    <div style="width: 1px; height: 16px; background: #334155; margin: 0 4px;"></div>
                                    <button title="수정" class="dataset-action-btn ai-edit-item-btn" data-id="${item.id}"><span class="material-symbols-outlined">edit</span></button>
                                    <button title="삭제" class="dataset-action-btn ai-del-item-btn" data-id="${item.id}"><span class="material-symbols-outlined">delete</span></button>
                                </div>
                                <button class="ai-more-btn" data-id="${item.id}" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 4px; border-radius: 50%;"><span class="material-symbols-outlined">more_vert</span></button>
                            </div>
                        </div>
            `;
            if (!isFolder) {
                html += `
                    <div style="font-size: 12px; color: #cbd5e1; margin-top: 8px; padding-left: 36px; word-break: break-all;"><strong>입력 패턴:</strong> ${escapeHtml(item.patterns.join(', '))}</div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 4px; padding-left: 36px; word-break: break-all;"><strong>응답 출력:</strong> ${escapeHtml(item.responses.join(' | '))}</div>
                `;
            }
            html += `</div>`;
            if (isFolder && !isCollapsed) {
                html += buildTreeHTML(item.id, depth + 1);
            }
            html += `</li>`;
        });
        html += '</ul>';
        return html;
    };

    container.innerHTML = buildTreeHTML(null);
    attachTreeEvents();
};

const renderSearchResults = (query) => {
    const container = document.getElementById('ai-dataset-list-container');
    if (!container) return;

    const lowerQuery = query.toLowerCase();
    const tagMatches = new Set();
    const patternMatches = new Set();
    const responseMatches = new Set();

    mainAI.aiDataset.filter(item => item.type === 'intent').forEach(item => {
        if (item.name.toLowerCase().includes(lowerQuery)) tagMatches.add(item);
        if (item.patterns.some(p => p.toLowerCase().includes(lowerQuery))) patternMatches.add(item);
        if (item.responses.some(r => r.toLowerCase().includes(lowerQuery))) responseMatches.add(item);
    });

    const renderResultItem = (item) => `
        <div style="background: #2c3e50; border-radius: 6px; padding: 12px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: bold; color: #38bdf8;">Tag: ${escapeHtml(item.name)}</span>
                <div style="display: flex; gap: 5px;">
                    <button class="ai-edit-item-btn" data-id="${item.id}" style="background: transparent; color: #38bdf8; border: 1px solid #38bdf8; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 11px;">수정</button>
                    <button class="ai-del-item-btn" data-id="${item.id}" style="background: transparent; color: #ef4444; border: 1px solid #ef4444; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 11px;">삭제</button>
                </div>
            </div>
            <div style="font-size: 12px; color: #cbd5e1; margin-bottom: 5px;"><strong>입력 패턴:</strong> ${escapeHtml(item.patterns.join(', '))}</div>
            <div style="font-size: 12px; color: #94a3b8;"><strong>응답 출력:</strong> ${escapeHtml(item.responses.join(' | '))}</div>
        </div>
    `;

    const renderSection = (title, itemsSet) => {
        if (itemsSet.size === 0) return '';
        let html = `<h4 style="color: #38bdf8; margin-top: 15px; margin-bottom: 10px; border-bottom: 1px solid #334155; padding-bottom: 5px;">${title} (${itemsSet.size}개)</h4>`;
        itemsSet.forEach(item => html += renderResultItem(item));
        return html;
    };

    let resultsHtml = renderSection('Tag 일치', tagMatches) +
                      renderSection('입력 패턴 일치', patternMatches) +
                      renderSection('AI 응답 일치', responseMatches);

    if (resultsHtml === '') {
        resultsHtml = '<div style="text-align: center; color: #94a3b8; padding: 20px;">검색 결과가 없습니다.</div>';
    }

    container.innerHTML = resultsHtml;
    attachTreeEvents();
};

const attachTreeEvents = () => {
    const container = document.getElementById('ai-dataset-list-container');
    if (!container) return;

    container.querySelectorAll('.dataset-item-main').forEach(el => {
        el.addEventListener('click', () => {
            const id = el.dataset.id;
            const type = el.dataset.type;
            
            if (mainAI.movingItemId) {
                if (type === 'folder') {
                    const itemToMove = mainAI.aiDataset.find(i => i.id === mainAI.movingItemId);
                    let current = id;
                    while (current) {
                        if (current === mainAI.movingItemId) { alert('자신의 하위 폴더로는 이동할 수 없습니다.'); mainAI.setMovingItemId(null); renderDatasetView(); return; }
                        const parent = mainAI.aiDataset.find(i => i.id === current);
                        current = parent ? parent.parentId : null;
                    }
                    if (itemToMove) { itemToMove.parentId = id; itemToMove.sortOrder = Date.now(); }
                    mainAI.setMovingItemId(null);
                    saveAndRenderDataset();
                } else {
                    alert('폴더 안으로만 이동할 수 있습니다.');
                }
                return;
            }

            if (type === 'folder') {
                mainAI.setCollapsedStates({ ...mainAI.collapsedStates, [id]: !mainAI.collapsedStates[id] });
                mainAI.setSelectedFolderId(id);
                renderDatasetView();
            } else {
                mainAI.setEditingItemId(id);
                mainAI.setIsAddingNew(null);
                renderDatasetForm();
            }
        });
    });

    container.querySelectorAll('.ai-more-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            mainAI.toggleDatasetMenu(e.currentTarget.dataset.id);
        });
    });

    container.querySelectorAll('.ai-edit-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = e.currentTarget.dataset.id;
            const item = mainAI.aiDataset.find(i => i.id === id);
            if (item.type === 'folder') {
                const newName = prompt('새 폴더 이름을 입력하세요:', item.name);
                if (newName && newName.trim()) {
                    item.name = newName.trim();
                    saveAndRenderDataset();
                }
            } else {
                mainAI.setEditingItemId(id);
                mainAI.setIsAddingNew(null);
                renderDatasetForm();
            }
        });
    });

    container.querySelectorAll('.ai-del-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = e.currentTarget.dataset.id;
            const item = mainAI.aiDataset.find(i => i.id === id);
            if (confirm(`'${item.name}' 항목을 삭제하시겠습니까? ${item.type === 'folder' ? '(하위 항목도 모두 삭제됩니다)' : ''}`)) {
                const idsToDelete = new Set([id]);
                if (item.type === 'folder') {
                    const findChildrenRecursive = (parentId) => {
                        mainAI.aiDataset.filter(child => child.parentId === parentId).forEach(child => {
                            idsToDelete.add(child.id);
                            if (child.type === 'folder') findChildrenRecursive(child.id);
                        });
                    };
                    findChildrenRecursive(id);
                }
                mainAI.setAiDataset(mainAI.aiDataset.filter(i => !idsToDelete.has(i.id)));
                if (idsToDelete.has(mainAI.selectedFolderId)) mainAI.setSelectedFolderId(null);
                if (idsToDelete.has(mainAI.editingItemId)) mainAI.setEditingItemId(null);
                saveAndRenderDataset();
            }
        });
    });
    
    container.querySelectorAll('.move-up-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); mainAI.moveItemOrder(e.currentTarget.dataset.id, 'up'); }));
    container.querySelectorAll('.move-down-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); mainAI.moveItemOrder(e.currentTarget.dataset.id, 'down'); }));
    container.querySelectorAll('.indent-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); mainAI.indentItem(e.currentTarget.dataset.id); }));
    container.querySelectorAll('.outdent-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); mainAI.outdentItem(e.currentTarget.dataset.id); }));
    container.querySelectorAll('.move-item-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); mainAI.setMovingItemId(e.currentTarget.dataset.id); renderDatasetView(); }));
};

const attachDatasetControlEvents = () => {
    document.getElementById('aiDatasetSearchInput').addEventListener('input', renderDatasetView);
    document.getElementById('aiAddNewFolderBtn').addEventListener('click', () => {
        const name = prompt('새 폴더 이름을 입력하세요:');
        if (name && name.trim()) {
            mainAI.aiDataset.push({ id: `folder_${Date.now()}`, parentId: mainAI.selectedFolderId, type: 'folder', name: name.trim(), sortOrder: Date.now() });
            saveAndRenderDataset();
        }
    });
    document.getElementById('aiAddNewIntentBtn').addEventListener('click', () => {
        mainAI.setIsAddingNew({ type: 'intent' });
        mainAI.setEditingItemId(null);
        renderDatasetForm();
    });
    document.getElementById('aiSaveDataBtn').addEventListener('click', () => {
        localStorage.setItem('gonard-ai-dataset', JSON.stringify(mainAI.aiDataset));
        alert('데이터셋이 로컬에 저장되었습니다.');
    });
    
    document.getElementById('aiUploadBtn')?.addEventListener('click', async () => {
        if (!confirm('현재 데이터셋을 서버에 업로드하시겠습니까? (기존 서버 데이터는 덮어씌워집니다)')) return;
        try {
            await setDoc(doc(db, "system", "ai_dataset"), { data: mainAI.aiDataset, updatedAt: serverTimestamp() });
            alert('✅ 데이터셋이 서버에 성공적으로 업로드되었습니다.');
        } catch (e) { console.error(e); alert('서버 업로드 중 오류가 발생했습니다: ' + e.message); }
    });

    document.getElementById('aiUpdateBtn')?.addEventListener('click', async () => {
        if (!confirm('서버로부터 최신 데이터셋을 다운로드하여 현재 작업을 덮어쓰시겠습니까?')) return;
        try {
            const docSnap = await getDoc(doc(db, "system", "ai_dataset"));
            if (docSnap.exists() && Array.isArray(docSnap.data().data)) {
                mainAI.setAiDataset(docSnap.data().data);
                saveAndRenderDataset();
                alert('✅ 서버로부터 최신 데이터셋을 업데이트했습니다.');
            } else {
                alert('서버에 올바른 형식의 데이터셋이 없습니다.');
            }
        } catch (e) { console.error(e); alert('서버에서 데이터를 가져오는 중 오류가 발생했습니다: ' + e.message); }
    });

    document.getElementById('moveRootBtn')?.addEventListener('click', () => { if (mainAI.movingItemId) { const item = mainAI.aiDataset.find(i => i.id === mainAI.movingItemId); if (item) { item.parentId = null; item.sortOrder = Date.now(); } mainAI.setMovingItemId(null); saveAndRenderDataset(); } });
    document.getElementById('cancelMoveBtn')?.addEventListener('click', () => { mainAI.setMovingItemId(null); renderDatasetView(); });
};

const renderDatasetForm = () => {
    const container = document.getElementById('ai-dataset-form-container');
    if (!container) return;

    const showForm = mainAI.isAddingNew || mainAI.editingItemId !== null;
    if (!showForm) {
        container.innerHTML = '';
        return;
    }

    const itemToEdit = mainAI.editingItemId ? mainAI.aiDataset.find(i => i.id === mainAI.editingItemId) : null;

    container.innerHTML = `
        <div id="ai-dataset-form" style="background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #f1f5f9; font-size: 16px; margin-bottom: 15px;">
                ${mainAI.editingItemId !== null ? '인텐트 수정' : '새 인텐트 추가'}
            </h3>
            <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 5px;">Tag (영문 고유명칭)</label>
            <input type="text" id="aiTagInput" placeholder="예: weather_check" value="${itemToEdit ? escapeHtml(itemToEdit.name) : ''}" style="width: 100%; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: white; margin-bottom: 15px; box-sizing: border-box;">
            <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 5px;">입력 패턴 (쉼표로 구분)</label>
            <textarea id="aiPatternsInput" rows="3" placeholder="예: 날씨 어때, 오늘 비와?, 밖이 춥니" style="width: 100%; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: white; margin-bottom: 15px; box-sizing: border-box; resize: none;">${itemToEdit ? escapeHtml(itemToEdit.patterns.join(', ')) : ''}</textarea>
            <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 5px;">AI 응답 (쉼표 혹은 파이프(|)로 구분)</label>
            <textarea id="aiResponsesInput" rows="3" placeholder="예: 오늘 날씨는 맑습니다. | 현재 기온을 확인해드릴게요." style="width: 100%; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: white; margin-bottom: 15px; box-sizing: border-box; resize: none;">${itemToEdit ? escapeHtml(itemToEdit.responses.join(', ')) : ''}</textarea>
            <div style="display: flex; gap: 10px;">
                <button id="aiSaveFormBtn" style="flex: 1; background: ${mainAI.editingItemId !== null ? '#f59e0b' : '#10b981'}; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s;">
                    ${mainAI.editingItemId !== null ? '데이터셋 수정' : '목록에 추가'}
                </button>
                <button id="aiCancelFormBtn" style="background: #64748b; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer;">취소</button>
            </div>
        </div>
    `;

    attachFormEvents();
};

const attachFormEvents = () => {
    document.getElementById('aiSaveFormBtn')?.addEventListener('click', () => {
        const tag = document.getElementById('aiTagInput').value.trim();
        const patterns = document.getElementById('aiPatternsInput').value.split(/[,|]/).map(s => s.trim()).filter(s => s);
        const responses = document.getElementById('aiResponsesInput').value.split(/[,|]/).map(s => s.trim()).filter(s => s);

        if (!tag || patterns.length === 0 || responses.length === 0) return alert('모든 필드를 올바르게 입력해주세요.');

        if (mainAI.editingItemId) {
            const item = mainAI.aiDataset.find(i => i.id === mainAI.editingItemId);
            if (item) { item.name = tag; item.patterns = patterns; item.responses = responses; }
        } else if (mainAI.isAddingNew) {
            mainAI.aiDataset.push({ id: `intent_${Date.now()}`, parentId: mainAI.selectedFolderId, type: 'intent', name: tag, patterns: patterns, responses: responses, sortOrder: Date.now() });
        }
        
        mainAI.setEditingItemId(null); mainAI.setIsAddingNew(null);
        document.getElementById('ai-dataset-form-container').innerHTML = '';
        saveAndRenderDataset();
    });

    document.getElementById('aiCancelFormBtn')?.addEventListener('click', () => {
        mainAI.setEditingItemId(null); mainAI.setIsAddingNew(null);
        document.getElementById('ai-dataset-form-container').innerHTML = '';
    });
};

const saveAndRenderDataset = () => {
    localStorage.setItem('gonard-ai-dataset', JSON.stringify(mainAI.aiDataset));
    renderDatasetView();
};