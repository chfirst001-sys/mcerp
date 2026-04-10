import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, escapeHtml } from "../../js/main.js";

export const render = async (container) => {
    container.innerHTML = '<div style="text-align:center; padding: 40px; color: #7f8c8d;"><span class="material-symbols-outlined" style="font-size: 32px; color: #bdc3c7; display: block; margin-bottom: 10px;">hourglass_empty</span>새로운 소식을 불러오는 중...</div>';

    try {
        // 'community' 컬렉션에서 작성일(createdAt) 기준으로 최신 30개 로드
        const q = query(collection(db, "community"), orderBy("createdAt", "desc"), limit(30));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<div style="text-align:center; padding: 40px; color: #7f8c8d;"><span class="material-symbols-outlined" style="font-size: 32px; color: #bdc3c7; display: block; margin-bottom: 10px;">article</span>최근에 올라온 게시물이 없습니다.</div>';
            return;
        }

        let html = '<ul style="list-style: none; padding: 0; margin: 0; background: white;">';
        snapshot.forEach(doc => {
            const data = doc.data();
            const timestamp = data.createdAt || data.updatedAt; // createdAt을 우선 적용
            const dateStr = timestamp ? new Date(timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
            
            html += `
                <li class="news-item" data-id="${doc.id}" style="padding: 15px; border-bottom: 1px solid #eee; display: flex; flex-direction: column; gap: 6px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: bold; color: #2c3e50; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${escapeHtml(data.title || '제목 없음')}</span>
                        <span style="font-size: 11px; color: #95a5a6; flex-shrink: 0; margin-left: 10px;">${dateStr}</span>
                    </div>
                    <div style="font-size: 13px; color: #7f8c8d; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.4;">${escapeHtml(data.content || '')}</div>
                </li>
            `;
        });
        html += '</ul>';
        
        container.innerHTML = html;
    } catch (error) {
        console.error("NEWS 게시물 로드 실패:", error);
        container.innerHTML = '<div style="text-align:center; padding: 40px; color: #e74c3c;">데이터를 불러오지 못했습니다.</div>';
    }
};

export const cleanup = () => {
    // 컴포넌트 언마운트 시 처리할 로직 (필요 시 작성)
};