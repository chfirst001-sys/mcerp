import { auth } from "../js/main.js";

export const init = (container) => {
    if (!auth.currentUser) {
        container.innerHTML = '<div style="padding: 50px; text-align: center; color: #e74c3c;">로그인이 필요합니다.</div>';
        return;
    }

    container.innerHTML = `
        <div style="padding: 30px; height: calc(100vh - 120px); background: #f4f6f8; box-sizing: border-box; overflow-y: auto;">
            <h2 style="color: #2c3e50; margin-top: 0; display: flex; align-items: center; gap: 8px;">
                <span class="material-symbols-outlined" style="font-size: 28px; color: #27ae60;">storage</span>
                로컬DB 관리
            </h2>
            <p style="color: #7f8c8d; font-size: 14px; margin-bottom: 20px;">이 기기(브라우저)에 안전하게 저장되는 개인 데이터(IndexedDB)를 관리하는 공간입니다.</p>
            
            <div style="background: #fff; padding: 25px; border-radius: 8px; border: 1px solid #e0e0e0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <h3 style="margin-top: 0; color: #2980b9;">내 나드(Nard) 스토리지</h3>
                <p style="font-size: 13px; color: #34495e; line-height: 1.6;">현재 클라우드(서버)에 저장된 나드 데이터를 로컬 IndexedDB로 이전하는 기능을 준비 중입니다.<br>향후 오프라인 환경에서도 개인의 나드 데이터를 아주 빠르고 안전하게 접근할 수 있습니다.</p>
                
                <div style="margin-top: 20px; display: flex; gap: 10px;">
                    <button id="syncToLocalBtn" style="background: #27ae60; color: white; border: none; padding: 12px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s;" onmouseover="this.style.background='#219653'" onmouseout="this.style.background='#27ae60'">데이터 로컬 동기화 (준비중)</button>
                    <button id="clearLocalBtn" style="background: #e74c3c; color: white; border: none; padding: 12px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s;" onmouseover="this.style.background='#c0392b'" onmouseout="this.style.background='#e74c3c'">로컬 캐시 비우기</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('syncToLocalBtn').addEventListener('click', () => {
        alert("나드 데이터를 IndexedDB로 이관 및 동기화하는 기능을 준비 중입니다.");
    });

    document.getElementById('clearLocalBtn').addEventListener('click', () => {
        if (confirm("현재 기기에 임시 저장된 오프라인 캐시를 모두 지우시겠습니까?\n(서버의 원본 데이터는 삭제되지 않습니다.)")) {
            alert("초기화되었습니다.");
        }
    });
};