import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDocs, doc, getDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, auth, escapeHtml } from "../../js/main.js";

let unsubscribePlaza = null;
let currentPlazaBuildingId = null;

export const cleanup = () => {
    if (unsubscribePlaza) {
        unsubscribePlaza();
        unsubscribePlaza = null;
    }
};

export const render = async (container) => {
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #7f8c8d;">광장 목록을 불러오는 중...</div>';

    let userRole = 'tenant';
    let userBuildingId = null;
    if (auth.currentUser) {
        const uDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (uDoc.exists()) {
            userRole = uDoc.data().role;
            userBuildingId = uDoc.data().buildingId;
        }
    }

    let buildings = [];
    try {
        const q = query(collection(db, "buildings"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        snap.forEach(docSnap => {
            const b = docSnap.data();
            if (['architect', 'mc_header', 'mc_front', 'admin', 'staff', 'mega_admin', 'mega_staff'].includes(userRole)) {
                buildings.push({ id: docSnap.id, name: b.name });
            } else {
                if (docSnap.id === userBuildingId) {
                    buildings.push({ id: docSnap.id, name: b.name });
                }
            }
        });
    } catch (e) {
        console.error("광장 목록 로드 실패:", e);
    }

    let listHtml = '';
    if (buildings.length > 0) {
        buildings.forEach(b => {
            listHtml += `
                <div class="plaza-list-item" data-id="${b.id}" data-name="${escapeHtml(b.name)}" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; background: #fff; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; align-items: center; gap: 15px; margin-bottom: 10px; transition: background 0.2s;" onmouseover="this.style.background='#f4f6f8'" onmouseout="this.style.background='#fff'">
                    <div style="background: #e8f4f8; color: #2980b9; width: 50px; height: 50px; border-radius: 12px; display: flex; justify-content: center; align-items: center; flex-shrink: 0;">
                        <span class="material-symbols-outlined" style="font-size: 28px;">domain</span>
                    </div>
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                            <h4 style="margin: 0; color: #2c3e50; font-size: 15px;">${escapeHtml(b.name)} 공식 광장</h4>
                        </div>
                        <div style="font-size: 12px; color: #7f8c8d;">입주민과 관리자가 소통하는 건물 전용 커뮤니티입니다.</div>
                    </div>
                    <span class="material-symbols-outlined" style="color: #bdc3c7;">chevron_right</span>
                </div>
            `;
        });
    } else {
        listHtml = `
            <div style="text-align: center; padding: 30px 20px; color: #7f8c8d; background: #f8f9fa; border-radius: 8px; border: 1px dashed #ccc;">
                <span class="material-symbols-outlined" style="font-size: 32px; color: #bdc3c7; margin-bottom: 10px;">diversity_3</span><br>
                가입된 광장이 없습니다.
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
            ${listHtml}
        </div>
    `;

    container.querySelectorAll('.plaza-list-item').forEach(item => {
        item.addEventListener('click', () => openPlazaFeed(container, item.dataset.id, item.dataset.name));
    });
};

// Nard 연동: 현재 광장의 게시물 데이터를 나드로 동기화
const syncPlazaToNard = async () => {
    if (!auth.currentUser || !currentPlazaBuildingId) return;
    const bId = currentPlazaBuildingId;

    try {
        const userRef = doc(db, "users", auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) return;

        let nardTree = userDoc.data().nardTree || [];

        // 1. 기본 루트(건물, 광장) 보장
        const bldgNardId = `nard_bldg_${bId}`;
        const plazaRootNardId = `nard_plaza_${bId}`;

        if (!nardTree.some(n => n.id === bldgNardId)) {
            const bDoc = await getDoc(doc(db, "buildings", bId));
            const bName = bDoc.exists() ? (bDoc.data().name || bDoc.data().buildingName || '건물') : '건물';
            nardTree.push({ id: bldgNardId, parentId: 'nard_shared_root', title: bName, content: '', createdAt: Date.now(), updatedAt: Date.now(), isEncrypted: false, isFavorite: false });
        }
        if (!nardTree.some(n => n.id === plazaRootNardId)) {
            nardTree.push({ id: plazaRootNardId, parentId: bldgNardId, title: '광장', content: '', createdAt: Date.now(), updatedAt: Date.now(), isEncrypted: false, isFavorite: false });
        }

        // 2. 현재 광장의 모든 게시물 가져오기
        const postsSnapshot = await getDocs(query(collection(db, "buildings", bId, "plaza_posts")));
        const currentPostIds = new Set();
        const currentPosts = [];
        postsSnapshot.forEach(postDoc => {
            currentPostIds.add(postDoc.id);
            currentPosts.push({ id: postDoc.id, ...postDoc.data() });
        });

        // 3. 삭제된 항목을 Nard 트리에서 제거 (현재 건물 광장에 속한 것만)
        const nardPrefix = 'nard_plaza_item_';
        nardTree = nardTree.filter(n => {
            if (n.parentId === plazaRootNardId) return currentPostIds.has(n.id.replace(nardPrefix, ''));
            return true;
        });

        // 4. treeData 생성 및 수정 내용 동기화
        currentPosts.forEach(post => {
            const nardId = `${nardPrefix}${post.id}`;
            const title = `${post.category ? `[${post.category}] ` : ''}${post.content.substring(0, 20)}...`;
            const content = `작성자: ${post.authorName}\n작성일: ${post.createdAt ? post.createdAt.toDate().toLocaleString('ko-KR') : '방금 전'}\n\n${post.content}`;
            
            const existingIdx = nardTree.findIndex(n => n.id === nardId);
            if (existingIdx >= 0) {
                nardTree[existingIdx].title = title; nardTree[existingIdx].content = content; nardTree[existingIdx].updatedAt = post.createdAt ? post.createdAt.toMillis() : Date.now();
            } else {
                nardTree.push({ id: nardId, parentId: plazaRootNardId, title: title, content: content, createdAt: post.createdAt ? post.createdAt.toMillis() : Date.now(), updatedAt: post.createdAt ? post.createdAt.toMillis() : Date.now(), isEncrypted: false, isFavorite: false });
            }
        });

        await updateDoc(userRef, { nardTree });
    } catch (err) {
        console.error("광장-나드 동기화 실패:", err);
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
        
        // 1공간 1프로필 정책 적용 (광장 ID별 고정)
        let authorName = localStorage.getItem('lockedProfile_' + currentPlazaBuildingId);
        const defaultName = auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
        const activeProfile = localStorage.getItem('activeProfileName') || defaultName;

        if (!authorName) {
            authorName = activeProfile;
            localStorage.setItem('lockedProfile_' + currentPlazaBuildingId, authorName);
        } else if (activeProfile !== authorName) {
            if (confirm(`안내: 이 광장에서는 기존에 '${authorName}' 프로필을 사용하셨습니다.\n\n새로 선택하신 '${activeProfile}' 프로필로 변경하여 활동하시겠습니까?\n(기존에 작성한 글의 닉네임은 소급 변경되지 않습니다.)`)) {
                authorName = activeProfile;
                localStorage.setItem('lockedProfile_' + currentPlazaBuildingId, authorName);
            }
        }

        try {
            await addDoc(collection(db, "buildings", currentPlazaBuildingId, "plaza_posts"), {
                authorUid: auth.currentUser.uid, authorEmail: auth.currentUser.email,
                authorName: authorName,
                category: category, content: contentVal, createdAt: serverTimestamp(), likes: 0, commentCount: 0
            });
            document.getElementById('postModal').style.display = 'none';
            document.getElementById('postContent').value = '';
            await syncPlazaToNard(); // Nard 동기화
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
            
            const isAuthor = data.authorUid === auth.currentUser.uid;
            const isAdmin = (window.currentUserWeight || 0) > 50;
            let deleteBtnHtml = '';
            if (isAuthor || isAdmin) {
                deleteBtnHtml = `<button class="delete-post-btn" data-id="${docSnap.id}" style="background: none; border: none; color: #c0392b; cursor: pointer; padding: 0; font-size: 12px; display: flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined" style="font-size: 16px;">delete</span> 삭제</button>`;
            }
            
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
                        <div style="border-top: 1px solid #f0f0f0; padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; gap: 15px;">
                                <span style="font-size: 12px; color: #7f8c8d; cursor: pointer; display: flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined" style="font-size: 16px;">favorite</span> 좋아요</span>
                                <span style="font-size: 12px; color: #7f8c8d; cursor: pointer; display: flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined" style="font-size: 16px;">chat_bubble</span> 댓글 쓰기</span>
                            </div>
                            ${deleteBtnHtml}
                        </div>
                    </div>`;
        });
        
        if (postCount === 0) {
            postsDiv.innerHTML = `<div style="text-align: center; padding: 40px 20px; color: #7f8c8d; background: #f8f9fa; border-radius: 8px; border: 1px dashed #ccc;"><span class="material-symbols-outlined" style="font-size: 40px; color: #bdc3c7; margin-bottom: 10px;">article</span><br>등록된 게시물이 없습니다.<br><span style="font-size: 12px;">첫 번째 글을 작성해보세요!</span></div>`;
        } else {
            postsDiv.innerHTML = html;
        }

        // 삭제 버튼 이벤트 리스너
        postsDiv.querySelectorAll('.delete-post-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const postId = e.currentTarget.dataset.id;
                if (confirm('이 게시물을 정말 삭제하시겠습니까?')) {
                    try {
                        await deleteDoc(doc(db, "buildings", currentPlazaBuildingId, "plaza_posts", postId));
                        await syncPlazaToNard(); // Nard 동기화
                    } catch (error) {
                        console.error("게시물 삭제 실패:", error); alert("삭제에 실패했습니다.");
                    }
                }
            });
        });
    }, (error) => console.error("게시물 로드 에러:", error));
};