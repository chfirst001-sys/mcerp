import { db, auth, escapeHtml } from "../js/main.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import CryptoJS from "https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/+esm";

let appContentRef = null;
let allNards = [];
let expandedCardId = null;
let startX = 0;
let currentX = 0;
let isSwiping = false;
let isAnimating = false;
let isMouseDown = false;
let lastReclickTime = 0;
let kanbanColumns = JSON.parse(localStorage.getItem('gonard-kanban-columns')) || [
    { id: 'issue', label: 'Issue', color: '#e74c3c', is_favorite: false },
    { id: 'todo', label: 'To Do', color: '#95a5a6', is_favorite: false },
    { id: 'progress', label: 'In Progress', color: '#3498db', is_favorite: false },
    { id: 'hold', label: 'Hold', color: '#e67e22', is_favorite: false },
    { id: 'done', label: 'Done', color: '#2ecc71', is_favorite: false }
];

// CSS 동적 주입 (Tailwind 대신 Vanilla CSS 사용)
const injectStyles = () => {
    if (document.getElementById('kanban-module-styles')) return;
    const style = document.createElement('style');
    style.id = 'kanban-module-styles';
    style.textContent = `
        .kanban-wrapper { display: flex; flex-direction: column; height: calc(100vh - 120px); background: #f4f6f8; overflow: hidden; }
        .kanban-container { position: relative; overflow: hidden; flex: 1; width: 100%; touch-action: pan-y; }
        .kanban-track { display: flex; height: 100%; width: 100%; will-change: transform; align-items: flex-start; }
        .kanban-column-wrapper { flex: 0 0 100%; width: 100%; padding: 16px; box-sizing: border-box; display: flex; justify-content: center; height: 100%; }
        .kanban-column { width: 100%; max-width: 400px; background: #eef2f5; border-radius: 8px; display: flex; flex-direction: column; max-height: 100%; border: 1px solid #dfe6e9; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .kanban-header { padding: 12px 16px; font-weight: bold; border-bottom: 1px solid #dfe6e9; display: flex; justify-content: space-between; align-items: center; color: #2c3e50; }
        .kanban-header-left { display: flex; align-items: center; gap: 8px; }
        .kanban-color-dot { width: 10px; height: 10px; border-radius: 50%; }
        .kanban-count { font-size: 12px; font-weight: bold; color: #7f8c8d; background: #dfe6e9; padding: 2px 8px; border-radius: 12px; }
        .kanban-list { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; min-height: 60px; }
        .kanban-card { background: white; padding: 14px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); cursor: pointer; border: 1px solid #ecf0f1; transition: transform 0.1s, box-shadow 0.2s; position: relative; }
        .kanban-card:active { transform: scale(0.98); }
        .kanban-card.drag-over { border: 2px dashed #3498db; background: #e8f4f8; }
        .kanban-card-title { font-weight: bold; font-size: 14px; color: #2c3e50; margin-bottom: 4px; word-break: break-all; }
        .kanban-card-desc { font-size: 12px; color: #7f8c8d; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.4; }
        .kanban-card-desc.expanded { -webkit-line-clamp: unset; display: block; white-space: pre-wrap; max-height: 200px; overflow-y: auto; margin-top: 8px; border-top: 1px solid #eee; padding-top: 8px; }
        .kanban-card-meta { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 11px; color: #95a5a6; }
        .drag-over-col { background: #e0e8ed !important; border: 2px dashed #3498db !important; }
        
        /* 모바일 이동 메뉴 모달 */
        .kb-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 7000; display: none; justify-content: center; align-items: center; }
        .kb-modal-content { background: white; padding: 20px; border-radius: 12px; width: 90%; max-width: 320px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
        .kb-modal-btn { width: 100%; padding: 12px; margin-bottom: 8px; border: none; border-radius: 8px; background: #f8f9fa; color: #2c3e50; font-weight: bold; cursor: pointer; text-align: left; transition: background 0.2s; }
        .kb-modal-btn:hover { background: #3498db; color: white; }
        .kb-modal-cancel { width: 100%; padding: 12px; margin-top: 10px; border: none; border-radius: 8px; background: #e74c3c; color: white; font-weight: bold; cursor: pointer; }
    `;
    document.head.appendChild(style);
};

export const init = async (container) => {
    appContentRef = container;
    injectStyles();

    if (!auth.currentUser) {
        container.innerHTML = '<div style="text-align:center; padding: 50px; color:#7f8c8d;">로그인이 필요합니다.</div>';
        return;
    }

    container.innerHTML = `
        <div class="kanban-wrapper">
            <div id="kanban-board" class="kanban-container">
                <div id="kanban-track" class="kanban-track">
                    <div style="width: 100%; text-align: center; padding: 40px; color: #7f8c8d;">데이터를 불러오는 중...</div>
                </div>
            </div>
        </div>
        
        <!-- 상태 변경 모달 (모바일 롱터치용) -->
        <div id="kbMoveModal" class="kb-modal-overlay">
            <div class="kb-modal-content">
                <h3 style="margin-top:0; margin-bottom:15px; color:#2c3e50;">상태 변경</h3>
                <div id="kbMoveOptions"></div>
                <button id="kbCloseMoveModal" class="kb-modal-cancel">취소</button>
            </div>
        </div>

        <!-- 컬럼 선택 모달 (새 나드 생성용) -->
        <div id="kbSelectColModal" class="kb-modal-overlay">
            <div class="kb-modal-content">
                <h3 style="margin-top:0; margin-bottom:15px; color:#2c3e50;">새 나드 생성 위치</h3>
                <div id="kbSelectColOptions"></div>
                <button id="kbCloseSelectColModal" class="kb-modal-cancel">취소</button>
            </div>
        </div>
    `;

    document.getElementById('kbCloseMoveModal').addEventListener('click', () => {
        document.getElementById('kbMoveModal').style.display = 'none';
    });

    document.getElementById('kbCloseSelectColModal').addEventListener('click', () => {
        document.getElementById('kbSelectColModal').style.display = 'none';
    });

    const handleOpenKanbanAdd = () => {
        const optionsContainer = document.getElementById('kbSelectColOptions');
        optionsContainer.innerHTML = kanbanColumns.map(col => `
            <button class="kb-modal-btn" data-status="${col.id}">
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${col.color}; margin-right:8px;"></span>
                ${col.label} 컬럼에 생성
            </button>
        `).join('');
        
        optionsContainer.querySelectorAll('.kb-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('kbSelectColModal').style.display = 'none';
                // 나드 생성 시 상태를 지정하기 위한 값 임시 저장
                sessionStorage.setItem('newNardKanbanStatus', btn.dataset.status);
                
                // 나드 탭으로 이동하여 새 나드 작성창 열기
                window._triggerNewNard = true;
                const nardTab = document.querySelector('.tab-item[data-module="nard"]');
                if (nardTab) nardTab.click();
            });
        });

        document.getElementById('kbSelectColModal').style.display = 'flex';
    };

    if (container._kanbanAddHandler) {
        document.removeEventListener('openKanbanAddModal', container._kanbanAddHandler);
    }
    container._kanbanAddHandler = handleOpenKanbanAdd;
    document.addEventListener('openKanbanAddModal', handleOpenKanbanAdd);

    const track = document.getElementById('kanban-track');
    
    // 무한 스와이프 로직 공통 함수
    const handleSwipeEnd = () => {
        if (!isSwiping || isAnimating) return;
        isSwiping = false;
        const diffX = currentX - startX;
        const containerWidth = track.parentElement.clientWidth;
        const threshold = containerWidth * 0.15; // 15% 스와이프시 전환
        
        if (Math.abs(diffX) > threshold) {
            isAnimating = true;
            track.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
            if (diffX < 0) {
                track.style.transform = `translateX(-200%)`;
                setTimeout(() => {
                    track.append(track.firstElementChild);
                    track.style.transition = 'none';
                    track.style.transform = `translateX(-100%)`;
                    isAnimating = false;
                }, 300);
            } else {
                track.style.transform = `translateX(0%)`;
                setTimeout(() => {
                    track.prepend(track.lastElementChild);
                    track.style.transition = 'none';
                    track.style.transform = `translateX(-100%)`;
                    isAnimating = false;
                }, 300);
            }
        } else if (Math.abs(diffX) > 0) {
            isAnimating = true;
            track.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
            track.style.transform = `translateX(-100%)`;
            setTimeout(() => { isAnimating = false; }, 300);
        }
    };

    // 터치 (모바일)
    track.addEventListener('touchstart', (e) => {
        if (isAnimating || track.children.length <= 1) return;
        startX = e.touches[0].clientX;
        currentX = startX;
        isSwiping = true;
        track.style.transition = 'none';
    }, { passive: true });

    track.addEventListener('touchmove', (e) => {
        if (!isSwiping || isAnimating) return;
        currentX = e.touches[0].clientX;
        const diffX = currentX - startX;
        const containerWidth = track.parentElement.clientWidth;
        const percent = (diffX / containerWidth) * 100;
        track.style.transform = `translateX(calc(-100% + ${percent}%))`;
    }, { passive: true });

    track.addEventListener('touchend', handleSwipeEnd);
    track.addEventListener('touchcancel', handleSwipeEnd);

    // 마우스 드래그 (데스크탑)
    track.addEventListener('mousedown', (e) => {
        if (isAnimating || track.children.length <= 1) return;
        if (e.target.closest('.kanban-card')) return; // 카드 드래그앤드롭 방해 방지
        isMouseDown = true;
        startX = e.clientX;
        currentX = startX;
        isSwiping = true;
        track.style.transition = 'none';
    });
    window.addEventListener('mousemove', (e) => {
        if (!isMouseDown || !isSwiping || isAnimating) return;
        currentX = e.clientX;
        const diffX = currentX - startX;
        const containerWidth = track.parentElement.clientWidth;
        const percent = (diffX / containerWidth) * 100;
        track.style.transform = `translateX(calc(-100% + ${percent}%))`;
    });
    window.addEventListener('mouseup', () => {
        if (!isMouseDown) return;
        isMouseDown = false;
        handleSwipeEnd();
    });

    await loadData();
};

export const onReclick = () => {
    const now = Date.now();
    // 연속 클릭 방지 (300ms)
    if (now - lastReclickTime < 300) return;
    lastReclickTime = now;

    const track = document.getElementById('kanban-track');
    if (!track || track.children.length <= 1 || isAnimating) {
        if (auth.currentUser && !isAnimating) loadData(); // 트랙이 생성되지 않았을 때는 새로고침
        return;
    }

    // 다음 컬럼으로 부드럽게 이동하는 애니메이션 적용
    isAnimating = true;
    track.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    track.style.transform = `translateX(-200%)`;
    setTimeout(() => {
        track.append(track.firstElementChild);
        track.style.transition = 'none';
        track.style.transform = `translateX(-100%)`;
        isAnimating = false;
    }, 300);
};

const loadData = async () => {
    try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) {
            const tree = userDoc.data().nardTree || userDoc.data().memoTree || [];
            const secretKey = auth.currentUser.uid;
            
            allNards = tree.map(item => {
                let decTitle = item.title;
                let decContent = item.content;
                if (item.isEncrypted) {
                    try {
                        decTitle = CryptoJS.AES.decrypt(item.title, secretKey).toString(CryptoJS.enc.Utf8);
                        if (item.content) decContent = CryptoJS.AES.decrypt(item.content, secretKey).toString(CryptoJS.enc.Utf8);
                    } catch(err) {}
                }
                return {
                    ...item,
                    title: decTitle || '제목 없음',
                    content: decContent || '',
                    status: item.status || 'todo' // 상태가 없으면 기본값 todo
                };
            });
            
            renderBoard();
        }
    } catch (error) {
        console.error("칸반 데이터 로드 오류:", error);
        document.getElementById('kanban-board').innerHTML = '<div style="color:red; padding: 20px;">오류가 발생했습니다.</div>';
    }
};

const renderBoard = () => {
    const track = document.getElementById('kanban-track');
    if (!track) return;

    // 트리가 비어있거나 최초 로드 텍스트가 있을 때 1회만 DOM 전체 생성
    if (track.children.length === 0 || track.innerHTML.includes('데이터를 불러오는 중')) {
        const colsHtml = kanbanColumns.map(col => {
            return `
                <div class="kanban-column-wrapper" data-col-id="${col.id}">
                    <div class="kanban-column" data-status="${col.id}">
                        <div class="kanban-header">
                            <div class="kanban-header-left">
                                <div class="kanban-color-dot" style="background-color: ${col.color}"></div>
                                <span>${col.label}</span>
                            </div>
                            <span class="kanban-count">0</span>
                        </div>
                        <div class="kanban-list" data-status="${col.id}"></div>
                    </div>
                </div>
            `;
        }).join('');

        track.innerHTML = colsHtml;

        // 무한 회전 캐러셀 초기화 (마지막 컬럼을 맨 앞으로 옮기고 화면은 첫번째를 보도록)
        if (track.children.length > 1) {
            track.prepend(track.lastElementChild);
            track.style.transition = 'none';
            track.style.transform = 'translateX(-100%)';
        }
        attachDropEvents();
    }

    // 기존 컬럼들의 내부 리스트 내용만 업데이트 (스크롤 및 캐러셀 순서 유지)
    kanbanColumns.forEach(col => {
        const nardsInCol = allNards.filter(n => n.status === col.id);
        const listEl = track.querySelector(`.kanban-list[data-status="${col.id}"]`);
        const countEl = track.querySelector(`.kanban-column[data-status="${col.id}"] .kanban-count`);
        
        if (countEl) countEl.innerText = nardsInCol.length;
        if (listEl) {
            listEl.innerHTML = nardsInCol.map(n => {
                const isExpanded = expandedCardId === n.id;
                const dateStr = n.updatedAt ? new Date(n.updatedAt).toLocaleDateString() : '';
                return `
                    <div class="kanban-card" data-id="${n.id}" data-status="${col.id}" draggable="true">
                        <div class="kanban-card-title">${escapeHtml(n.title)}</div>
                        <div class="kanban-card-desc ${isExpanded ? 'expanded' : ''}">${escapeHtml(n.content)}</div>
                        <div class="kanban-card-meta">
                            <span>${dateStr}</span>
                            ${isExpanded ? `<span class="material-symbols-outlined" style="font-size:16px; color:#3498db;">open_in_full</span>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }
    });

    attachCardEvents();
};

const attachDropEvents = () => {
    const lists = document.querySelectorAll('.kanban-list');
    lists.forEach(list => {
        list.addEventListener('dragover', (e) => {
            e.preventDefault();
            list.closest('.kanban-column').classList.add('drag-over-col');
        });
        list.addEventListener('dragleave', (e) => {
            list.closest('.kanban-column').classList.remove('drag-over-col');
        });
        list.addEventListener('drop', async (e) => {
            e.preventDefault();
            list.closest('.kanban-column').classList.remove('drag-over-col');
            
            const nardId = e.dataTransfer.getData('text/plain');
            const newStatus = list.dataset.status;
            const card = document.querySelector(`.kanban-card[data-id="${nardId}"]`);
            
            if (card && card.dataset.status !== newStatus) {
                await updateNardStatus(nardId, newStatus);
            }
        });
    });
};

const attachCardEvents = () => {
    const cards = document.querySelectorAll('.kanban-card');
    cards.forEach(card => {
        // 클릭 이벤트 (상세 펼치기)
        card.addEventListener('click', (e) => {
            const id = card.dataset.id;
            expandedCardId = (expandedCardId === id) ? null : id;
            renderBoard();
        });

        // 드래그 앤 드롭 (PC)
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', card.dataset.id);
            setTimeout(() => card.style.opacity = '0.5', 0);
        });
        card.addEventListener('dragend', (e) => {
            card.style.opacity = '1';
            document.querySelectorAll('.kanban-column').forEach(col => col.classList.remove('drag-over-col'));
        });

        // 터치 롱프레스 (모바일)
        let pressTimer = null;
        card.addEventListener('touchstart', (e) => {
            pressTimer = setTimeout(() => {
                pressTimer = null;
                showMoveMenu(card.dataset.id, card.dataset.status);
            }, 500); // 0.5초 길게 누르면 발동
        }, { passive: true });

        const cancelPress = () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };
        card.addEventListener('touchend', cancelPress);
        card.addEventListener('touchmove', cancelPress);
        card.addEventListener('touchcancel', cancelPress);
    });
};

const showMoveMenu = (nardId, currentStatus) => {
    const optionsContainer = document.getElementById('kbMoveOptions');
    
    const html = kanbanColumns
        .filter(col => col.id !== currentStatus)
        .map(col => `
            <button class="kb-modal-btn" data-status="${col.id}">
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${col.color}; margin-right:8px;"></span>
                ${col.label}으로 이동
            </button>
        `).join('');
        
    optionsContainer.innerHTML = html;
    
    optionsContainer.querySelectorAll('.kb-modal-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.getElementById('kbMoveModal').style.display = 'none';
            await updateNardStatus(nardId, btn.dataset.status);
        });
    });

    document.getElementById('kbMoveModal').style.display = 'flex';
};

const updateNardStatus = async (nardId, newStatus) => {
    try {
        // 1. UI 선반영 (Optimistic UI)
        const targetNard = allNards.find(n => n.id === nardId);
        if (targetNard) targetNard.status = newStatus;
        renderBoard();

        // 2. DB 업데이트
        const userRef = doc(db, "users", auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
            const nardKey = userDoc.data().nardTree ? 'nardTree' : 'memoTree';
            let tree = userDoc.data()[nardKey] || [];
            
            let updated = false;
            tree = tree.map(item => {
                if (item.id === nardId) {
                    updated = true;
                    return { ...item, status: newStatus, updatedAt: Date.now() };
                }
                return item;
            });

            if (updated) {
                await updateDoc(userRef, { [nardKey]: tree });
            }
        }
    } catch (error) {
        console.error("상태 업데이트 실패:", error);
        alert("상태 변경에 실패했습니다.");
        loadData(); // 실패 시 원래 데이터로 롤백
    }
};