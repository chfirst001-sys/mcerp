// 설정 모달 UI를 동적으로 주입
export const injectSettingsModal = (container) => {
    if (document.getElementById('nardSettingsModal')) return;

    const html = `
        <div id="nardSettingsModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:5000; justify-content:center; align-items:center;">
            <div style="background:white; padding:24px; border-radius:12px; width:90%; max-width:320px; box-shadow:0 4px 20px rgba(0,0,0,0.2);">
                <h3 style="margin-top:0; color:#2c3e50; margin-bottom:20px;">나드 상세 설정</h3>
                
                <!-- 칸반 표시 여부 -->
                <div style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; background:#f8f9fa; padding:12px; border-radius:8px;">
                    <label style="font-size:13px; font-weight:bold; color:#34495e;">칸반 보드에서 관리하기</label>
                    <input type="checkbox" id="setKanbanToggle" style="width:auto; margin:0; accent-color:#3498db; transform:scale(1.2); cursor:pointer;">
                </div>
                
                <!-- 상태 선택 -->
                <div style="margin-bottom:15px;">
                    <label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:5px;">상태 (Status)</label>
                    <select id="setStatusSelect" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px; font-size:13px; outline:none; box-sizing:border-box;">
                        <option value="issue">🔴 Issue (문제)</option>
                        <option value="todo">🔘 To Do (할 일)</option>
                        <option value="progress">🔵 In Progress (진행 중)</option>
                        <option value="hold">🟠 Hold (보류)</option>
                        <option value="done">🟢 Done (완료)</option>
                    </select>
                </div>
                
                <!-- 마감일 -->
                <div style="margin-bottom:24px;">
                    <label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:5px;">마감일 (Due Date)</label>
                    <input type="date" id="setDueDate" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px; font-size:13px; box-sizing:border-box;">
                </div>
                
                <!-- 하단 버튼 -->
                <div style="display:flex; gap:10px;">
                    <button id="applySettingsBtn" style="flex:1; background:#2980b9; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">적용</button>
                    <button id="cancelSettingsBtn" style="flex:1; background:#95a5a6; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer;">취소</button>
                </div>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);

    document.getElementById('cancelSettingsBtn').addEventListener('click', () => { document.getElementById('nardSettingsModal').style.display = 'none'; });
    document.getElementById('applySettingsBtn').addEventListener('click', () => {
        document.getElementById('nardShowInKanban').value = document.getElementById('setKanbanToggle').checked ? 'true' : 'false';
        document.getElementById('nardStatus').value = document.getElementById('setStatusSelect').value;
        document.getElementById('nardDueDate').value = document.getElementById('setDueDate').value;
        document.getElementById('nardSettingsModal').style.display = 'none';
    });
};

export const openSettingsModal = () => {
    document.getElementById('setKanbanToggle').checked = document.getElementById('nardShowInKanban').value === 'true';
    document.getElementById('setStatusSelect').value = document.getElementById('nardStatus').value || 'todo';
    document.getElementById('setDueDate').value = document.getElementById('nardDueDate').value || '';
    document.getElementById('nardSettingsModal').style.display = 'flex';
};