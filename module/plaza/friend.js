export const render = (container) => {
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0; color: #2c3e50;">내 친구 목록</h3>
            <button style="background: #27ae60; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <span class="material-symbols-outlined" style="font-size: 16px;">person_add</span> 친구 추가
            </button>
        </div>
        <div style="text-align: center; padding: 40px 20px; color: #7f8c8d; background: #f8f9fa; border-radius: 8px; border: 1px dashed #ccc;">
            <span class="material-symbols-outlined" style="font-size: 40px; color: #bdc3c7; margin-bottom: 10px;">group</span><br>
            등록된 친구가 없습니다.<br><span style="font-size: 12px;">새로운 친구를 추가하고 소통을 시작해보세요.</span>
        </div>
    `;
};

// 모듈이 언마운트될 때 호출될 수 있는 정리 함수 (필수 인터페이스)
export const cleanup = () => {};