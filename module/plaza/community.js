import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, auth, escapeHtml } from "../../js/main.js";

let unsubscribePlaza = null;
let currentPlazaBuildingId = null;

export const cleanup = () => {
    if (unsubscribePlaza) {
        unsubscribePlaza();
        unsubscribePlaza = null;
    }
};

export const render = (container) => {
    const bId = localStorage.getItem('selectedBuildingId');
    const bName = localStorage.getItem('selectedBuildingName') || '전체 건물';
    
    let defaultPlazaHtml = '';
    if (bId) {
        defaultPlazaHtml = `
            <div id="defaultPlazaItem" class="plaza-list-item" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; background: #fff; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; align-items: center; gap: 15px; margin-bottom: 15px; transition: background 0.2s;" onmouseover="this.style.background='#f4f6f8'" onmouseout="this.style.background='#fff'">
                <div style="background: #e8f4f8; color: #2980b9; width: 50px; height: 50px; border-radius: 12px; display: flex; justify-content: center; align-items: center; flex-shrink: 0;">
                    <span class="material-symbols-outlined" style="font-size: 28px;">domain</span>
                </div>
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                        <h4 style="margin: 0; color: #2c3e50; font-size: 15px;">${escapeHtml(bName)} 공식 광장</h4>
                        <span style="background: #27ae60; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px;">기본</span>
                    </div>
                    <div style="font-size: 12px; color: #7f8c8d;">입주민과 관리자가 소통하는 건물 전용 커뮤니티입니다.</div>
                </div>
                <span class="material-symbols-outlined" style="color: #bdc3c7;">chevron_right</span>
            </div>
        `;
    } else {
        defaultPlazaHtml = `
            <div style="text-align: center; padding: 20px; color: #e74c3c; background: #fdf2e9; border-radius: 8px; border: 1px solid #f8c471; margin-bottom: 15px; font-size: 13px;">
                선택된 건물이 없어 기본 건물 광장을 표시할 수 없습니다.<br>사이드바에서 건물을 선택해주세요.
            </div>
        `;
    }

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0; color: #2c3e50;">내 광장 목록</h3>
            <button style="background: #f39c12; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <span class="material-symbols-outlined" style="font-size: 16px;">add_circle</span> 새 광장 만들기
            </button>
        </div>
        
        <div style="display: flex; flex-direction: column;">
            ${defaultPlazaHtml}
            
            <div style="text-align: center; padding: 30px 20px; color: #7f8c8d; background: #f8f9fa; border-radius: 8px; border: 1px dashed #ccc;">
                <span class="material-symbols-outlined" style="font-size: 32px; color: #bdc3c7; margin-bottom: 10px;">diversity_3</span><br>
                가입된 다른 광장이 없습니다.<br><span style="font-size: 12px;">관심사에 맞는 새로운 소모임 광장을 만들어보세요.</span>
            </div>
        </div>
    `;

    if (bId) {
        const plazaItem = document.getElementById('defaultPlazaItem');
        if (plazaItem) {
            plazaItem.addEventListener('click', () => openPlazaFeed(container, bId, bName));
        }
    }
};

const openPlazaFeed = (container, bId, bName) => {
    currentPlazaBuildingId = bId;
    
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <button id="backToPlazaListBtn" style="background: none; border: none; padding: 0; cursor: pointer; display: flex; align-items: center; color: #2c3e50;">
                    <span class="material-symbols-outlined" style="font-size: 24px;">arrow_back</span>
                </button>
                <h3 style="margin: 0; color: #2c3e50;">${escapeHtml(bName)} 광장</h3>
            </div>
            <button id="writePostBtn" style="background: #f39c12; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <span class="material-symbols-outlined" style="font-size: 16px;">edit_square</span> 글쓰기
            </button>
        </div>
        
        <div style="display: flex; gap: 10px; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; overflow-x: auto; white-space: nowrap;" id="plazaCategoryFilters">
            <span class="plaza-filter" data-cat="all" style="background: #e8f4f8; color: #2980b9; padding: 4px 12px; border-radius: 12px; font-size: 13px; cursor: pointer; font-weight: bold;">전체 피드</span>
            <span class="plaza-filter" data-cat="공지" style="color: #7f8c8d; padding: 4px 12px; font-size: 13px; cursor: pointer;">📌 공지사항</span>
            <span class="plaza-filter" data-cat="자유" style="color: #7f8c8d; padding: 4px 12px; font-size: 13px; cursor: pointer;">💬 자유게시판</span>
            <span class="plaza-filter" data-cat="민원" style="color: #7f8c8d; padding: 4px 12px; font-size: 13px; cursor: pointer;">🛠️ 민원/수리요청</span>
        </div>

        <div id="plazaPosts" style="display: flex; flex-direction: column; gap: 15px; padding-bottom: 20px;">
            <div style="text-align: center; padding: 20px; color: #7f8c8d; font-size: 13px;">게시물을 불러오는 중...</div>
        </div>

        <!-- 글쓰기 모달 -->
        <div id="postModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 5000; justify-content: center; align-items: center;">
            <div style="background: white; padding: 20px; border-radius: 12px; width: 90%; max-width: 500px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
                <h3 style="margin-top: 0; color: #2c3e50;">새 게시물 작성</h3>
                <select id="postCategory" style="margin-bottom: 10px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;">
                    <option value="자유">💬 자유게시판</option>
                    <option value="공지">📌 공지사항</option>
                    <option value="민원">🛠️ 민원/수리요청</option>
                </select>
                <textarea id="postContent" placeholder="이웃들과 나누고 싶은 소식을 입력하세요..." style="width: 100%; height: 150px; margin-bottom: 15px; padding: 10px; border: 1px solid #ccc; border-radius: 4px; resize: none; box-sizing: border-box; font-family: inherit; font-size: 14px;"></textarea>
                <div style="display: flex; gap: 10px;">
                    <button id="savePostBtn" style="flex: 1; background: #2980b9; padding: 12px; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">게시하기</button>
                    <button id="cancelPostBtn" style="flex: 1; background: #95a5a6; padding: 12px; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">취소</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('backToPlazaListBtn').addEventListener('click', () => {
        currentPlazaBuildingId = null;
        render(container);
    });

    document.getElementById('writePostBtn').addEventListener('click', () => {
        if (!auth.currentUser) return alert('로그인이 필요합니다.');
        document.getElementById('postContent').value = '';
        document.getElementById('postCategory').value = '자유';
        document.getElementById('postModal').style.display = 'flex';
    });

    document.getElementById('cancelPostBtn').addEventListener('click', () => document.getElementById('postModal').style.display = 'none');

    document.getElementById('savePostBtn').addEventListener('click', async () => {
        const contentVal = document.getElementById('postContent').value.trim();
        const category = document.getElementById('postCategory').value;
        if (!contentVal) return alert('내용을 입력해주세요.');
        if (!auth.currentUser) return alert('로그인이 필요합니다.');
        if (!currentPlazaBuildingId) return alert('선택된 광장이 없습니다.');

        const btn = document.getElementById('savePostBtn');
        btn.disabled = true; btn.textContent = '등록 중...';
        try {
            await addDoc(collection(db, "buildings", currentPlazaBuildingId, "plaza_posts"), {
                authorUid: auth.currentUser.uid, authorEmail: auth.currentUser.email,
                authorName: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
                category: category, content: contentVal, createdAt: serverTimestamp(), likes: 0, commentCount: 0
            });
            document.getElementById('postModal').style.display = 'none';
            document.getElementById('postContent').value = '';
        } catch (error) {
            console.error("게시물 등록 실패:", error); alert("등록에 실패했습니다.");
        } finally {
            btn.disabled = false; btn.textContent = '게시하기';
        }
    });

    const filters = document.querySelectorAll('.plaza-filter');
    filters.forEach(f => {
        f.addEventListener('click', (e) => {
            filters.forEach(el => { el.style.background = 'transparent'; el.style.color = '#7f8c8d'; el.style.fontWeight = 'normal'; });
            e.target.style.background = '#e8f4f8'; e.target.style.color = '#2980b9'; e.target.style.fontWeight = 'bold';
            loadPlazaPosts(bId, e.target.dataset.cat);
        });
    });

    loadPlazaPosts(bId, 'all');
};

const loadPlazaPosts = (bId, category) => {
    cleanup();
    const q = query(collection(db, "buildings", bId, "plaza_posts"), orderBy("createdAt", "desc"));
    unsubscribePlaza = onSnapshot(q, (snapshot) => {
        const postsDiv = document.getElementById('plazaPosts');
        if (!postsDiv) return;
        
        let html = ''; let postCount = 0;
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (category !== 'all' && data.category !== category) return;
            postCount++;
            const timeStr = data.createdAt ? data.createdAt.toDate().toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '방금 전';
            const authorName = data.authorName || (data.authorEmail ? data.authorEmail.split('@')[0] : '익명');
            
            let catBadge = '';
            if(data.category === '공지') catBadge = '<span style="background: #e74c3c; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-right: 5px;">공지</span>';
            else if(data.category === '민원') catBadge = '<span style="background: #f39c12; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-right: 5px;">민원</span>';
            else catBadge = '<span style="background: #95a5a6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-right: 5px;">자유</span>';

            html += `<div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="width: 32px; height: 32px; background: #ecf0f1; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: #7f8c8d;">
                                    <span class="material-symbols-outlined" style="font-size: 20px;">person</span>
                                </div>
                                <div><div style="font-size: 13px; font-weight: bold; color: #2c3e50;">${escapeHtml(authorName)}</div><div style="font-size: 11px; color: #95a5a6;">${timeStr}</div></div>
                            </div>
                        </div>
                        <div style="font-size: 14px; color: #34495e; line-height: 1.5; margin-bottom: 10px; white-space: pre-wrap; word-break: break-all;">${catBadge}${escapeHtml(data.content)}</div>
                        <div style="border-top: 1px solid #f0f0f0; padding-top: 10px; display: flex; gap: 15px;">
                            <span style="font-size: 12px; color: #7f8c8d; cursor: pointer; display: flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined" style="font-size: 16px;">favorite</span> 좋아요</span>
                            <span style="font-size: 12px; color: #7f8c8d; cursor: pointer; display: flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined" style="font-size: 16px;">chat_bubble</span> 댓글 쓰기</span>
                        </div>
                    </div>`;
        });
        
        if (postCount === 0) {
            postsDiv.innerHTML = `<div style="text-align: center; padding: 40px 20px; color: #7f8c8d; background: #f8f9fa; border-radius: 8px; border: 1px dashed #ccc;"><span class="material-symbols-outlined" style="font-size: 40px; color: #bdc3c7; margin-bottom: 10px;">article</span><br>등록된 게시물이 없습니다.<br><span style="font-size: 12px;">첫 번째 글을 작성해보세요!</span></div>`;
        } else {
            postsDiv.innerHTML = html;
        }
    }, (error) => console.error("게시물 로드 에러:", error));
};