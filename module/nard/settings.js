// 설정 모달 UI를 동적으로 주입
export const injectSettingsModal = (container) => {
    if (document.getElementById('nardSettingsModal')) return;

    const html = `
        <div id="nardSettingsModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:5000; justify-content:center; align-items:center; font-family: Pretendard, sans-serif;">
            <div style="background:white; padding:0; border-radius:12px; width:90%; max-width:360px; box-shadow:0 4px 20px rgba(0,0,0,0.2); overflow:hidden; display:flex; flex-direction:column;">
                
                <!-- 헤더 & 탭 -->
                <div style="padding: 20px 20px 0 20px;">
                    <h3 style="margin-top:0; color:#2c3e50; margin-bottom:15px;">나드 상세 설정</h3>
                    <div style="display:flex; border-bottom: 1px solid #ecf0f1; margin-bottom: 20px;">
                        <button class="ns-tab-btn" data-tab="kanban" style="flex:1; background:none; border:none; padding:10px 0; font-size:14px; font-weight:bold; color:#2980b9; border-bottom:2px solid #2980b9; cursor:pointer;">칸반</button>
                        <button class="ns-tab-btn" data-tab="doc" style="flex:1; background:none; border:none; padding:10px 0; font-size:14px; color:#7f8c8d; cursor:pointer;">문서타입</button>
                        <button class="ns-tab-btn" data-tab="art" style="flex:1; background:none; border:none; padding:10px 0; font-size:14px; color:#7f8c8d; cursor:pointer;">나드아트</button>
                    </div>
                </div>

                <!-- 본문 컨텐츠 -->
                <div style="padding: 0 20px 20px 20px; overflow-y:auto; max-height:60vh;">
                    
                    <!-- 1. 칸반 탭 -->
                    <div id="ns-tab-kanban" class="ns-tab-content">
                        <div style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; background:#e8f4f8; padding:12px; border-radius:8px; border:1px solid #bce0fd;">
                            <label style="font-size:13px; font-weight:bold; color:#2980b9;">이 나드를 칸반 전용으로 사용</label>
                            <input type="checkbox" id="setKanbanToggle" style="width:auto; margin:0; accent-color:#3498db; transform:scale(1.2); cursor:pointer;">
                        </div>
                        <div id="ns-kanban-options" style="opacity:0.5; pointer-events:none; transition: opacity 0.3s;">
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
                            <div>
                                <label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:5px;">마감일 (Due Date)</label>
                                <input type="date" id="setDueDate" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px; font-size:13px; box-sizing:border-box;">
                            </div>
                        </div>
                    </div>

                    <!-- 2. 문서타입 탭 -->
                    <div id="ns-tab-doc" class="ns-tab-content" style="display:none;">
                        <div style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; background:#f4ebf7; padding:12px; border-radius:8px; border:1px solid #d7bde2;">
                            <label style="font-size:13px; font-weight:bold; color:#8e44ad;">특수 문서 타입으로 사용</label>
                            <input type="checkbox" id="setDocToggle" style="width:auto; margin:0; accent-color:#8e44ad; transform:scale(1.2); cursor:pointer;">
                        </div>
                        <div id="ns-doc-options" style="opacity:0.5; pointer-events:none; transition: opacity 0.3s;">
                            <label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:5px;">문서 형식 선택</label>
                            <select id="setDocTypeSelect" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px; font-size:13px; outline:none; box-sizing:border-box; margin-bottom: 15px;">
                                <option value="word">📝 MS 워드 (.docx)</option>
                                <option value="excel">📊 MS 엑셀 (.xlsx)</option>
                                <option value="html">🌐 HTML (.html)</option>
                                <option value="paint">🎨 그림판 (.png)</option>
                            </select>
                            <div style="font-size: 11px; color: #e74c3c; line-height: 1.4; padding: 10px; background: #fadbd8; border-radius: 6px;">
                                ※ 주의: 문서 타입으로 지정되면 해당 문서 전용 에디터로 변경되며, 칸반 보드에서 사용할 수 없게 됩니다.<br>(에디터 변경 및 다운로드 기능은 추후 업데이트 예정)
                            </div>
                        </div>
                    </div>

                    <!-- 3. 나드아트 탭 -->
                    <div id="ns-tab-art" class="ns-tab-content" style="display:none;">
                        <p style="font-size: 12px; color: #7f8c8d; margin-bottom: 15px;">나드 목록에서 보여질 모양과 색상을 취향대로 꾸며보세요.</p>
                        <label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:5px;">카드 배경 색상</label>
                        <input type="color" id="setArtBgColor" value="#ffffff" style="width:100%; height:45px; border:1px solid #ccc; border-radius:4px; cursor:pointer;">
                    </div>

                </div>

                <!-- 하단 적용/취소 버튼 -->
                <div style="padding: 15px 20px; border-top: 1px solid #eee; display:flex; gap:10px; background: #fafafa;">
                    <button id="applySettingsBtn" style="flex:1; background:#2c3e50; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer; transition: background 0.2s;" onmouseover="this.style.background='#34495e'" onmouseout="this.style.background='#2c3e50'">적용</button>
                    <button id="cancelSettingsBtn" style="flex:1; background:#95a5a6; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer; transition: background 0.2s;" onmouseover="this.style.background='#7f8c8d'" onmouseout="this.style.background='#95a5a6'">취소</button>
                </div>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);

    // 탭 전환 이벤트
    const tabBtns = document.querySelectorAll('.ns-tab-btn');
    const tabContents = document.querySelectorAll('.ns-tab-content');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => { b.style.color = '#7f8c8d'; b.style.borderBottom = 'none'; b.style.fontWeight = 'normal'; });
            e.target.style.color = '#2980b9'; e.target.style.borderBottom = '2px solid #2980b9'; e.target.style.fontWeight = 'bold';
            tabContents.forEach(content => content.style.display = 'none');
            document.getElementById('ns-tab-' + e.target.dataset.tab).style.display = 'block';
        });
    });

    // 상호 배타적 토글 로직 (칸반 vs 문서타입)
    const kanbanToggle = document.getElementById('setKanbanToggle');
    const docToggle = document.getElementById('setDocToggle');
    const kanbanOpts = document.getElementById('ns-kanban-options');
    const docOpts = document.getElementById('ns-doc-options');

    kanbanToggle.addEventListener('change', () => {
        if (kanbanToggle.checked) { docToggle.checked = false; docOpts.style.opacity = '0.5'; docOpts.style.pointerEvents = 'none'; kanbanOpts.style.opacity = '1'; kanbanOpts.style.pointerEvents = 'auto'; }
        else { kanbanOpts.style.opacity = '0.5'; kanbanOpts.style.pointerEvents = 'none'; }
    });

    docToggle.addEventListener('change', () => {
        if (docToggle.checked) { kanbanToggle.checked = false; kanbanOpts.style.opacity = '0.5'; kanbanOpts.style.pointerEvents = 'none'; docOpts.style.opacity = '1'; docOpts.style.pointerEvents = 'auto'; }
        else { docOpts.style.opacity = '0.5'; docOpts.style.pointerEvents = 'none'; }
    });

    document.getElementById('cancelSettingsBtn').addEventListener('click', () => { document.getElementById('nardSettingsModal').style.display = 'none'; });
    document.getElementById('applySettingsBtn').addEventListener('click', () => {
        document.getElementById('nardShowInKanban').value = document.getElementById('setKanbanToggle').checked ? 'true' : 'false';
        document.getElementById('nardStatus').value = document.getElementById('setStatusSelect').value;
        document.getElementById('nardDueDate').value = document.getElementById('setDueDate').value;
        
        document.getElementById('nardDocType').value = document.getElementById('setDocToggle').checked ? document.getElementById('setDocTypeSelect').value : '';
        document.getElementById('nardArtBg').value = document.getElementById('setArtBgColor').value;
        
        document.getElementById('nardSettingsModal').style.display = 'none';
    });
};

export const openSettingsModal = () => {
    const isKanban = document.getElementById('nardShowInKanban').value === 'true';
    const docType = document.getElementById('nardDocType').value;
    const isDoc = docType !== '';

    const kanbanToggle = document.getElementById('setKanbanToggle');
    const docToggle = document.getElementById('setDocToggle');
    const kanbanOpts = document.getElementById('ns-kanban-options');
    const docOpts = document.getElementById('ns-doc-options');

    kanbanToggle.checked = isKanban;
    docToggle.checked = isDoc;

    if (isKanban) { kanbanOpts.style.opacity = '1'; kanbanOpts.style.pointerEvents = 'auto'; docOpts.style.opacity = '0.5'; docOpts.style.pointerEvents = 'none'; }
    else if (isDoc) { kanbanOpts.style.opacity = '0.5'; kanbanOpts.style.pointerEvents = 'none'; docOpts.style.opacity = '1'; docOpts.style.pointerEvents = 'auto'; document.getElementById('setDocTypeSelect').value = docType; }
    else { kanbanOpts.style.opacity = '0.5'; kanbanOpts.style.pointerEvents = 'none'; docOpts.style.opacity = '0.5'; docOpts.style.pointerEvents = 'none'; }

    document.getElementById('setStatusSelect').value = document.getElementById('nardStatus').value || 'todo';
    document.getElementById('setDueDate').value = document.getElementById('nardDueDate').value || '';
    document.getElementById('setArtBgColor').value = document.getElementById('nardArtBg').value || '#ffffff';
    
    // 초기 탭은 항상 '칸반'이 선택되도록 초기화
    document.querySelector('.ns-tab-btn[data-tab="kanban"]').click();

    document.getElementById('nardSettingsModal').style.display = 'flex';
};