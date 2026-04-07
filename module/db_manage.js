export const init = (container) => {
    container.innerHTML = `
        <div class="module-card">
            <h2 style="display: flex; align-items: center; gap: 8px;"><span class="material-symbols-outlined">database</span> DB관리</h2>
            <p>데이터베이스 백업, 기초 데이터 설정 등을 수행하는 관리자 전용 화면입니다.</p>
        </div>
    `;
};