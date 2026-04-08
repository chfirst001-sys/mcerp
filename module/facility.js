import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, escapeHtml } from "../js/main.js";

const tabIds = ['partner', 'equipment', 'fixture', 'zone'];
let currentTabIndex = 0; // 현재 선택된 서브 탭 인덱스 유지
let lastBuildingId = null; // 마지막으로 로드된 건물 ID 추적

let subTabButtons = null;

// --- 트리 관리를 위한 전역 상태 ---
let currentTreeType = null; // 'equipmentTree' 또는 'fixtureTree'
let treeData = [];          // 트리 데이터 배열
let selectedFolderId = null; // 현재 선택(활성화)된 폴더의 ID
let movingItemId = null;     // 현재 이동 모드인 항목의 ID

export const init = (container) => {
    // 건물이 변경되었는지 확인하여 서브 탭 인덱스 리셋
    const currentBuildingId = localStorage.getItem('selectedBuildingId');
    if (lastBuildingId !== currentBuildingId) {
        currentTabIndex = 0;
        lastBuildingId = currentBuildingId;
    }

    container.innerHTML = `
        <!-- 상단 서브 탭 메뉴 (가로 스크롤 & 고정) -->
        <div class="sub-tab-menu">
            <button class="sub-tab-btn active" data-tab="partner">협력업체</button>
            <button class="sub-tab-btn" data-tab="equipment">설비시설</button>
            <button class="sub-tab-btn" data-tab="fixture">기구/비품</button>
            <button class="sub-tab-btn" data-tab="zone">건물구역</button>
        </div>

        <!-- 하위 메뉴별 컨텐츠가 렌더링될 영역 -->
        <div id="facilityContent"></div>

        <!-- 공통 파일(설비/비품) 상세 정보 모달 -->
        <div id="fileDetailModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 4000; justify-content: center; align-items: center;">
            <div style="background: white; padding: 25px; border-radius: 12px; width: 90%; max-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); display: flex; flex-direction: column; max-height: 80vh;">
                <h3 id="fileDetailModalTitle" style="margin-top: 0; color: #2c3e50; margin-bottom: 20px; flex-shrink: 0;">상세 정보</h3>
                <div style="overflow-y: auto; padding-right: 5px;">
                    <input type="hidden" id="detailItemId">
                    
                    <label style="font-size: 12px; color: #7f8c8d;">사진 등록</label>
                    <div style="margin-bottom: 15px; text-align: center; border: 1px dashed #ccc; padding: 10px; border-radius: 4px;">
                        <img id="detailPhotoPreview" src="" style="max-width: 100%; max-height: 150px; display: none; margin: 0 auto 10px auto; border-radius: 4px;">
                        <input type="file" id="detailPhotoInput" accept="image/*" style="font-size: 12px; max-width: 100%;">
                    </div>

                    <label style="font-size: 12px; color: #7f8c8d;">구입일자</label>
                    <input type="date" id="detailPurchaseDate" style="margin-bottom: 15px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; max-width: 100%;">

                    <label style="font-size: 12px; color: #7f8c8d;">관리자</label>
                    <input type="text" id="detailManager" placeholder="관리자 이름 입력" style="margin-bottom: 20px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; max-width: 100%;">
                </div>
                
                <div style="display: flex; gap: 10px; flex-shrink: 0;">
                    <button id="saveDetailBtn" style="flex: 1; background: #2980b9; padding: 12px; font-size: 14px; color: white; border: none; border-radius: 4px; cursor: pointer;">저장</button>
                    <button id="cancelDetailBtn" style="flex: 1; background: #95a5a6; padding: 12px; font-size: 14px; color: white; border: none; border-radius: 4px; cursor: pointer;">취소</button>
                </div>
            </div>
        </div>
    `;

    subTabButtons = container.querySelectorAll('.sub-tab-btn');
    const facilityContent = document.getElementById('facilityContent');

    // 공통 파일 상세 모달 이벤트 바인딩
    const fileDetailModal = document.getElementById('fileDetailModal');
    const photoInput = document.getElementById('detailPhotoInput');
    const photoPreview = document.getElementById('detailPhotoPreview');

    if (photoInput) {
        photoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    photoPreview.src = ev.target.result;
                    photoPreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    document.getElementById('cancelDetailBtn')?.addEventListener('click', () => {
        fileDetailModal.style.display = 'none';
    });

    document.getElementById('saveDetailBtn')?.addEventListener('click', () => {
        const itemId = document.getElementById('detailItemId').value;
        const item = treeData.find(i => i.id === itemId);
        if (item) {
            item.purchaseDate = document.getElementById('detailPurchaseDate').value;
            item.manager = document.getElementById('detailManager').value;
            item.photo = photoPreview.style.display !== 'none' ? photoPreview.src : null;
            
            saveTreeData().then(() => {
                alert('상세 정보가 저장되었습니다.');
                fileDetailModal.style.display = 'none';
            });
        }
    });

    // 협력업체 데이터를 불러오는 함수
    const loadPartners = async () => {
        const bId = localStorage.getItem('selectedBuildingId');
        const partnerContent = document.getElementById('partnerContent');
        
        if (!bId) {
            partnerContent.innerHTML = '<div style="color:#e74c3c; padding: 20px; text-align: center; font-weight: bold;">선택된 건물이 없습니다.<br><span style="font-size:13px; font-weight:normal; color:#7f8c8d;">사이드바의 "건물선택" 메뉴에서 건물을 먼저 선택해주세요.</span></div>';
            return;
        }

        try {
            const docSnap = await getDoc(doc(db, "buildings", bId));
            if (!docSnap.exists()) {
                partnerContent.innerHTML = '<div style="color:#e74c3c; padding: 20px; text-align: center;">건물 정보를 찾을 수 없습니다.</div>';
                return;
            }

            const expenseConfig = docSnap.data().expenseConfig || {};
            const partners = {};

            // expenseConfig를 순회하면서 업체명(company)이 있는 항목 추출하여 업체명 기준으로 그룹화
            for (const [itemName, config] of Object.entries(expenseConfig)) {
                if (config.company && config.company.trim() !== '') {
                    const comp = config.company.trim();
                    if (!partners[comp]) {
                        partners[comp] = {
                            company: comp,
                            contact: config.contact || '연락처 없음',
                            items: [] // 이 업체가 담당하는 업무(부과명) 목록 및 상세 정보
                        };
                    }
                    partners[comp].items.push({
                        name: itemName,
                        amount: config.amount || 0,
                        cycleNum: config.cycleNum || 1,
                        cycleUnit: config.cycleUnit || '개월',
                        note: config.note || '',
                        exceptions: config.exceptions || ''
                    });
                }
            }

            const partnerKeys = Object.keys(partners);
            if (partnerKeys.length === 0) {
                partnerContent.innerHTML = '<div style="color:#7f8c8d; padding:20px; text-align:center; background:#f8f9fa; border-radius:8px;">등록된 협력업체가 없습니다.<br><span style="font-size:12px;">(회계관리 > 부과조정에서 항목별 상세 정보에 업체명을 입력하면 여기에 표시됩니다.)</span></div>';
                return;
            }

            let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
            
            partnerKeys.sort().forEach(comp => {
                const p = partners[comp];
                const itemNames = p.items.map(i => i.name).join(', ');
                
                const partnerDataStr = encodeURIComponent(JSON.stringify(p));

                html += `
                    <div class="partner-card" data-info="${partnerDataStr}" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; background: #fff; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: background 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <h4 style="margin: 0; color: #2980b9; font-size: 16px;">${escapeHtml(p.company)}</h4>
                            <span style="font-size: 13px; color: #7f8c8d; background: #f0f3f4; padding: 3px 8px; border-radius: 12px;">${escapeHtml(p.contact)}</span>
                        </div>
                        <div style="font-size: 13px; color: #34495e;">
                            <span style="font-weight: bold; color: #7f8c8d;">업무:</span> ${escapeHtml(itemNames)}
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            partnerContent.innerHTML = html;

            // 모달 클릭 이벤트 등록
            const partnerCards = partnerContent.querySelectorAll('.partner-card');
            const modal = document.getElementById('partnerModal');
            const modalTitle = document.getElementById('partnerModalTitle');
            const modalBody = document.getElementById('partnerModalBody');
            const closeBtn = document.getElementById('closePartnerModalBtn');

            partnerCards.forEach(card => {
                card.addEventListener('click', () => {
                    const p = JSON.parse(decodeURIComponent(card.dataset.info));
                    modalTitle.textContent = p.company;
                    
                    let bodyHtml = `
                        <div style="margin-bottom: 10px;"><strong style="color:#7f8c8d;">연락처:</strong> ${escapeHtml(p.contact)}</div>
                        <hr style="border: 0; border-top: 1px dashed #ccc; margin: 15px 0;">
                        <strong style="color:#7f8c8d; display:block; margin-bottom: 10px;">담당 업무 상세:</strong>
                        <div style="display:flex; flex-direction:column; gap: 10px;">
                    `;

                    p.items.forEach(item => {
                        bodyHtml += `
                            <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; border: 1px solid #eee;">
                                <div style="font-weight: bold; color: #2c3e50; margin-bottom: 5px;">${escapeHtml(item.name)}</div>
                                <div style="font-size: 13px; color: #555;">
                                    <div>- 계약금액: ${Number(item.amount).toLocaleString()}원</div>
                                    <div>- 납부주기: ${item.cycleNum}${item.cycleUnit}</div>
                                    ${item.note ? `<div>- 비고: ${escapeHtml(item.note)}</div>` : ''}
                                    ${item.exceptions ? `<div>- 예외: ${escapeHtml(item.exceptions)}</div>` : ''}
                                </div>
                            </div>
                        `;
                    });

                    bodyHtml += '</div>';
                    modalBody.innerHTML = bodyHtml;
                    modal.style.display = 'flex';
                });
                
                // 호버 효과
                card.addEventListener('mouseenter', () => { card.style.background = '#f4f6f8'; });
                card.addEventListener('mouseleave', () => { card.style.background = '#fff'; });
            });

            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }

        } catch (error) {
            console.error("협력업체 로드 실패:", error);
            partnerContent.innerHTML = '<div style="color:red; padding: 20px; text-align: center;">데이터를 불러오는 중 오류가 발생했습니다.</div>';
        }
    };

    // --- 트리(설비/비품) 데이터 로드 및 저장 ---
    const loadTreeData = async (prefix) => {
        const bId = localStorage.getItem('selectedBuildingId');
        currentTreeType = prefix === 'equipment' ? 'equipmentTree' : 'fixtureTree';
        selectedFolderId = null;
        movingItemId = null;

        const contentContainer = document.getElementById(`${prefix}Content`);
        if (!contentContainer) return;

        if (!bId) {
            contentContainer.innerHTML = '<div style="color:#e74c3c; padding: 20px; text-align: center;">선택된 건물이 없습니다.</div>';
            return;
        }

        contentContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #7f8c8d;">데이터를 불러오는 중...</div>';

        try {
            const docSnap = await getDoc(doc(db, "buildings", bId));
            if (docSnap.exists()) {
                treeData = docSnap.data()[currentTreeType] || [];
                renderTreeUI(prefix);
            }
        } catch (error) {
            console.error("트리 로드 실패:", error);
            contentContainer.innerHTML = '<div style="color:red; padding: 20px; text-align: center;">오류가 발생했습니다.</div>';
        }
    };

    const saveTreeData = async () => {
        const bId = localStorage.getItem('selectedBuildingId');
        if (!bId) return;
        try {
            await updateDoc(doc(db, "buildings", bId), {
                [currentTreeType]: treeData
            });
        } catch(e) {
            console.error(e);
            alert("저장 중 오류가 발생했습니다.");
        }
    };

    const getPathName = (folderId) => {
        if (!folderId) return '최상위';
        const folder = treeData.find(f => f.id === folderId);
        return folder ? escapeHtml(folder.name) : '최상위';
    };

    // --- 트리 UI 렌더링 ---
    const renderTreeUI = (prefix) => {
        const container = document.getElementById(`${prefix}Content`);
        const pathEl = document.getElementById(`${prefix}SelectedPath`);
        const bannerEl = document.getElementById(`${prefix}MoveBanner`);

        if (!container) return;
        if (pathEl) pathEl.textContent = `현재 위치: ${getPathName(selectedFolderId)}`;
        if (bannerEl) bannerEl.style.display = movingItemId ? 'flex' : 'none';

        // 재귀적으로 트리를 구성하는 내부 함수
        const buildTree = (parentId, depth) => {
            const children = treeData.filter(item => item.parentId === parentId);
            if (children.length === 0) return '';

            let html = `<ul style="list-style: none; padding-left: ${depth === 0 ? '5px' : '20px'}; margin: 5px 0;">`;
            children.forEach(item => {
                const isSelected = item.id === selectedFolderId;
                const isMoving = item.id === movingItemId;
                const icon = item.type === 'folder' ? (isSelected ? 'folder_open' : 'folder') : (currentTreeType === 'equipmentTree' ? 'build' : 'devices');
                const color = item.type === 'folder' ? '#f39c12' : '#7f8c8d';

                html += `
                    <li style="margin: 4px 0;">
                        <div class="tree-node" data-id="${item.id}" data-type="${item.type}"
                            style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border-radius: 6px;
                                   background-color: ${isSelected ? '#e8f4f8' : (isMoving ? '#ffeaa7' : 'transparent')};
                                   border: 1px solid ${isMoving ? '#e74c3c' : (isSelected ? '#3498db' : 'transparent')};
                                   cursor: pointer; transition: background 0.2s;">
                            <div style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden;">
                                <span class="material-symbols-outlined" style="color: ${color}; font-size: 20px; flex-shrink: 0;">${icon}</span>
                                <span style="font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ${isMoving ? 'font-weight:bold; color:#d35400;' : ''}">${escapeHtml(item.name)}</span>
                            </div>
                            <div style="display: flex; gap: 4px; flex-shrink: 0;">
                                <span class="material-symbols-outlined edit-btn" style="font-size: 16px; color: #3498db; padding: 4px; background: #fff; border-radius: 4px; border: 1px solid #eee; transition: all 0.2s;" title="수정" onmouseover="this.style.background='#e8f4f8'" onmouseout="this.style.background='#fff'">edit</span>
                                <span class="material-symbols-outlined del-btn" style="font-size: 16px; color: #e74c3c; padding: 4px; background: #fff; border-radius: 4px; border: 1px solid #eee; transition: all 0.2s;" title="삭제" onmouseover="this.style.background='#fdf2e9'" onmouseout="this.style.background='#fff'">delete</span>
                            </div>
                        </div>
                        ${item.type === 'folder' ? buildTree(item.id, depth + 1) : ''}
                    </li>
                `;
            });
            html += '</ul>';
            return html;
        };

        const treeHtml = buildTree(null, 0);
        container.innerHTML = treeHtml || '<div style="padding: 20px; text-align: center; color: #7f8c8d;">등록된 항목이 없습니다.</div>';
        attachTreeEvents(prefix);
    };

    // --- 트리 항목 이벤트 (롱클릭, 선택, 이동) ---
    const attachTreeEvents = (prefix) => {
        const container = document.getElementById(`${prefix}Content`);
        if (!container) return;

        const nodes = container.querySelectorAll('.tree-node');
        nodes.forEach(node => {
            let pressTimer;
            let startX, startY;
            const id = node.dataset.id;
            const type = node.dataset.type;

            const cancelPress = () => clearTimeout(pressTimer);

            // 마우스/터치 시작 시 3초 타이머 동작 (기본 브라우저 기능 방지됨)
            const startPress = () => {
                pressTimer = setTimeout(() => {
                    movingItemId = id;
                    renderTreeUI(prefix);
                }, 3000);
            };

            node.addEventListener('mousedown', (e) => { if (e.button === 0) startPress(); });
            node.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX; startY = e.touches[0].clientY;
                startPress();
            }, { passive: true });

            // 이벤트 취소 처리
            node.addEventListener('mouseup', cancelPress);
            node.addEventListener('mouseleave', cancelPress);
            node.addEventListener('touchend', cancelPress);
            node.addEventListener('touchmove', (e) => {
                if (!startX) return;
                if (Math.abs(e.touches[0].clientX - startX) > 10 || Math.abs(e.touches[0].clientY - startY) > 10) cancelPress();
            }, { passive: true });

            // 수정 및 삭제 버튼 이벤트
            const editBtn = node.querySelector('.edit-btn');
            const delBtn = node.querySelector('.del-btn');

            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    cancelPress();
                    const item = treeData.find(i => i.id === id);
                    if (item) {
                        const newName = prompt('새 이름을 입력하세요:', item.name);
                        if (newName && newName.trim()) {
                            item.name = newName.trim();
                            saveTreeData().then(() => renderTreeUI(prefix));
                        }
                    }
                });
            }

            if (delBtn) {
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    cancelPress();
                    const item = treeData.find(i => i.id === id);
                    if (item) {
                        if (confirm(`'${item.name}' 항목을 삭제하시겠습니까?${item.type === 'folder' ? '\\n(주의: 하위 항목들도 모두 삭제됩니다.)' : ''}`)) {
                            const idsToDelete = new Set([id]);
                            const findChildren = (parentId) => {
                                treeData.forEach(child => {
                                    if (child.parentId === parentId && !idsToDelete.has(child.id)) {
                                        idsToDelete.add(child.id);
                                        findChildren(child.id);
                                    }
                                });
                            };
                            findChildren(id);
                            
                            treeData = treeData.filter(i => !idsToDelete.has(i.id));
                            if (idsToDelete.has(selectedFolderId)) selectedFolderId = null;
                            if (idsToDelete.has(movingItemId)) movingItemId = null;
                            
                            saveTreeData().then(() => renderTreeUI(prefix));
                        }
                    }
                });
            }

            // 탭(클릭) 이벤트
            node.addEventListener('click', (e) => {
                cancelPress();
                e.stopPropagation();

                // 이동 모드 처리
                if (movingItemId) {
                    if (movingItemId === id) { alert('자기 자신으로 이동할 수 없습니다.'); movingItemId = null; renderTreeUI(prefix); return; }
                    if (type !== 'folder') { alert('폴더 안으로만 이동할 수 있습니다.'); return; }

                    let current = id;
                    while (current) {
                        if (current === movingItemId) { alert('자신의 하위 폴더로는 이동할 수 없습니다.'); movingItemId = null; renderTreeUI(prefix); return; }
                        const parent = treeData.find(item => item.id === current);
                        current = parent ? parent.parentId : null;
                    }

                    const itemToMove = treeData.find(item => item.id === movingItemId);
                    if (itemToMove) itemToMove.parentId = id;
                    movingItemId = null;
                    saveTreeData().then(() => renderTreeUI(prefix));
                    return;
                }

                // 일반 폴더 선택
                if (type === 'folder') {
                    selectedFolderId = selectedFolderId === id ? null : id;
                    renderTreeUI(prefix);
                } else if (type === 'file') {
                    const item = treeData.find(i => i.id === id);
                    if (item) {
                        document.getElementById('detailItemId').value = item.id;
                        document.getElementById('fileDetailModalTitle').textContent = item.name + ' 상세 정보';
                        
                        const preview = document.getElementById('detailPhotoPreview');
                        if (item.photo) {
                            preview.src = item.photo;
                            preview.style.display = 'block';
                        } else {
                            preview.src = '';
                            preview.style.display = 'none';
                        }
                        document.getElementById('detailPhotoInput').value = '';
                        document.getElementById('detailPurchaseDate').value = item.purchaseDate || '';
                        document.getElementById('detailManager').value = item.manager || '';
                        
                        document.getElementById('fileDetailModal').style.display = 'flex';
                    }
                }
            });
        });
    };

    // 서브 탭 컨텐츠 렌더링 함수
    const renderTabContent = (tabId) => {
        let html = '';
        switch(tabId) {
            case 'partner': 
                html = `
                    <div class="module-card">
                        <h3 style="margin-top:0;">협력업체</h3>
                        <p style="font-size: 12px; color: #7f8c8d; margin-bottom: 15px;">회계관리에서 등록된 협력업체 목록입니다.</p>
                        <div id="partnerContent">
                            <div style="text-align: center; padding: 20px; color: #7f8c8d;">데이터를 불러오는 중...</div>
                        </div>
                    </div>

                    <!-- 협력업체 상세 정보 모달 -->
                    <div id="partnerModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 4000; justify-content: center; align-items: center;">
                        <div style="background: white; padding: 25px; border-radius: 12px; width: 90%; max-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); display: flex; flex-direction: column; max-height: 80vh;">
                            <h3 id="partnerModalTitle" style="margin-top: 0; color: #2c3e50; margin-bottom: 20px; flex-shrink: 0;">업체 상세 정보</h3>
                            <div id="partnerModalBody" style="font-size: 14px; line-height: 1.6; color: #333; margin-bottom: 20px; overflow-y: auto;">
                            </div>
                            <button id="closePartnerModalBtn" style="width: 100%; background: #95a5a6; color: white; padding: 12px; font-size: 14px; border: none; border-radius: 4px; cursor: pointer; flex-shrink: 0;">닫기</button>
                        </div>
                    </div>
                `;
                break;
            case 'equipment': 
                html = `
                    <div class="module-card">
                        <h3 style="margin-top:0;">설비시설</h3>
                        <p style="font-size: 12px; color: #7f8c8d; margin-bottom: 15px;">건물에 부착되어 있는 대형 혹은 고정 기계들을 그룹(폴더) 및 개별 설비(파일) 형태로 관리합니다.<br>항목을 3초간 길게 누르면 이동할 수 있습니다.</p>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <div style="font-size: 13px; color: #2980b9; font-weight: bold; flex: 1;">
                                <span id="equipmentSelectedPath">현재 위치: 최상위</span>
                            </div>
                            <div style="display: flex; gap: 5px;">
                                <button id="createEquipmentGroupBtn" style="display: flex; align-items: center; gap: 2px; background-color: #2c3e50; padding: 6px 10px; font-size: 12px;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">create_new_folder</span> 폴더생성
                                </button>
                                <button id="createEquipmentBtn" style="display: flex; align-items: center; gap: 2px; background-color: #2980b9; padding: 6px 10px; font-size: 12px;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">note_add</span> 설비생성
                                </button>
                            </div>
                        </div>
                        <div id="equipmentMoveBanner" style="display: none; background: #ffeaa7; padding: 10px; margin-bottom: 15px; border-radius: 4px; font-size: 13px; color: #d35400; align-items: center; justify-content: space-between;">
                            <span>이동 모드: 목적지 폴더를 클릭하세요.</span>
                            <div style="display: flex; gap: 5px;">
                                <button id="equipmentMoveRootBtn" style="background: #27ae60; padding: 4px 8px; font-size: 12px; border: none; color: white; border-radius: 4px; cursor: pointer;">최상위로</button>
                                <button id="equipmentMoveCancelBtn" style="background: #c0392b; padding: 4px 8px; font-size: 12px; border: none; color: white; border-radius: 4px; cursor: pointer;">취소</button>
                            </div>
                        </div>
                        <div id="equipmentContent" style="padding: 10px; border: 1px dashed #ccc; border-radius: 8px; background: #fafafa; min-height: 150px; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;" oncontextmenu="return false;">
                        </div>
                    </div>
                `;
                break;
            case 'fixture': 
                html = `
                    <div class="module-card">
                        <h3 style="margin-top:0;">기구/비품</h3>
                        <p style="font-size: 12px; color: #7f8c8d; margin-bottom: 15px;">이동가능한 건물 소유의 기계 혹은 물품들을 그룹(폴더) 및 개별 기구/비품(파일) 형태로 관리합니다.<br>항목을 3초간 길게 누르면 이동할 수 있습니다.</p>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <div style="font-size: 13px; color: #2980b9; font-weight: bold; flex: 1;">
                                <span id="fixtureSelectedPath">현재 위치: 최상위</span>
                            </div>
                            <div style="display: flex; gap: 5px;">
                                <button id="createFixtureGroupBtn" style="display: flex; align-items: center; gap: 2px; background-color: #2c3e50; padding: 6px 10px; font-size: 12px;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">create_new_folder</span> 폴더생성
                                </button>
                                <button id="createFixtureBtn" style="display: flex; align-items: center; gap: 2px; background-color: #2980b9; padding: 6px 10px; font-size: 12px;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">note_add</span> 기구생성
                                </button>
                            </div>
                        </div>
                        <div id="fixtureMoveBanner" style="display: none; background: #ffeaa7; padding: 10px; margin-bottom: 15px; border-radius: 4px; font-size: 13px; color: #d35400; align-items: center; justify-content: space-between;">
                            <span>이동 모드: 목적지 폴더를 클릭하세요.</span>
                            <div style="display: flex; gap: 5px;">
                                <button id="fixtureMoveRootBtn" style="background: #27ae60; padding: 4px 8px; font-size: 12px; border: none; color: white; border-radius: 4px; cursor: pointer;">최상위로</button>
                                <button id="fixtureMoveCancelBtn" style="background: #c0392b; padding: 4px 8px; font-size: 12px; border: none; color: white; border-radius: 4px; cursor: pointer;">취소</button>
                            </div>
                        </div>
                        <div id="fixtureContent" style="padding: 10px; border: 1px dashed #ccc; border-radius: 8px; background: #fafafa; min-height: 150px; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;" oncontextmenu="return false;">
                        </div>
                    </div>
                `;
                break;
            case 'zone': html = '<div class="module-card"><h3>건물구역</h3><p>건물 내 다양한 구역(층, 공용부 등)을 관리합니다.</p></div>'; break;
        }
        facilityContent.innerHTML = html;

        if (tabId === 'partner') {
            loadPartners();
        }
        
        if (tabId === 'equipment' || tabId === 'fixture') {
            const prefix = tabId;
            
            // 폴더 생성
            document.getElementById(`create${prefix === 'equipment' ? 'Equipment' : 'Fixture'}GroupBtn`).addEventListener('click', () => {
                const name = prompt('새 폴더 이름을 입력하세요:');
                if (name && name.trim()) {
                    treeData.push({ id: Date.now().toString(), parentId: selectedFolderId, name: name.trim(), type: 'folder' });
                    saveTreeData().then(() => renderTreeUI(prefix));
                }
            });

            // 파일(설비/비품) 생성
            document.getElementById(`create${prefix === 'equipment' ? 'Equipment' : 'Fixture'}Btn`).addEventListener('click', () => {
                const name = prompt(`새 ${prefix === 'equipment' ? '설비' : '기구/비품'} 이름을 입력하세요:`);
                if (name && name.trim()) {
                    treeData.push({ id: Date.now().toString(), parentId: selectedFolderId, name: name.trim(), type: 'file' });
                    saveTreeData().then(() => renderTreeUI(prefix));
                }
            });

            // 이동 모드 시 최상위로 이동 버튼
            document.getElementById(`${prefix}MoveRootBtn`).addEventListener('click', () => {
                if (movingItemId) {
                    const itemToMove = treeData.find(item => item.id === movingItemId);
                    if (itemToMove) itemToMove.parentId = null;
                    movingItemId = null;
                    saveTreeData().then(() => renderTreeUI(prefix));
                }
            });

            // 이동 취소 버튼
            document.getElementById(`${prefix}MoveCancelBtn`).addEventListener('click', () => { movingItemId = null; renderTreeUI(prefix); });

            loadTreeData(prefix);
        }
    };

    // 탭 클릭 이벤트 등록
    subTabButtons.forEach((btn, index) => {
        btn.addEventListener('click', (e) => {
            currentTabIndex = index;
            subTabButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderTabContent(e.target.dataset.tab);
            e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
    });

    // 초기 로드 시 이전에 선택했던 탭으로 복구 (기본값은 0번째)
    subTabButtons.forEach(b => b.classList.remove('active'));
    const activeBtn = subTabButtons[currentTabIndex];
    activeBtn.classList.add('active');
    renderTabContent(activeBtn.dataset.tab);
    setTimeout(() => { activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }, 50);
};

// 하단 탭을 다시 누를 때 (로테이션 기능)
export const onReclick = () => {
    if (!subTabButtons) return;
    currentTabIndex = (currentTabIndex + 1) % tabIds.length;
    subTabButtons[currentTabIndex].click();
};