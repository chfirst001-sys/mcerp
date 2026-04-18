let mainAI;
let triggers = []; 

// 앱 내 실행 가능한 UI 액션 목록 사전 (대분류 > 중분류 > 기능)
const ACTION_REGISTRY = {
    "공통 (Global)": {
        "네비게이션 (탭 이동)": [
            { label: "대시보드 탭으로 이동", value: "nav_dashboard" },
            { label: "시설관리 탭으로 이동", value: "nav_facility" },
            { label: "회계관리 탭으로 이동", value: "nav_accounting" },
            { label: "입주민관리 탭으로 이동", value: "nav_tenant" },
            { label: "문서 탭으로 이동", value: "nav_document" },
            { label: "AI 탭으로 이동", value: "nav_ai" },
            { label: "나드 탭으로 이동", value: "nav_nard" },
            { label: "스케쥴 탭으로 이동", value: "nav_schedule" },
            { label: "칸반 탭으로 이동", value: "nav_kanban" },
            { label: "광장 탭으로 이동", value: "nav_plaza" },
            { label: "라이프 탭으로 이동", value: "nav_life" }
        ],
        "시스템 창 열기": [
            { label: "통합 검색창 열기", value: "openSearchModal" },
            { label: "나드 즐겨찾기 목록 열기", value: "openFavModal" },
            { label: "환경설정 모달 열기", value: "openSettingsModal" },
            { label: "AI 설정 모달 열기", value: "openAiSettingsModal" },
            { label: "사용자 계정 모달 열기", value: "openAccountModal" }
        ]
    },
    "나드 (Nard)": {
        "기본 조작": [
            { label: "새 나드 작성창 열기", value: "openNardModal" },
            { label: "나드 뷰 모드(트리/메모) 전환", value: "toggleNardMode" }
        ]
    },
    "칸반 (Kanban)": {
        "기본 조작": [
            { label: "새 칸반 카드 등록창 열기", value: "openKanbanAddModal" }
        ]
    }
};

// 데이터 조회 기능 목록 사전 (대분류 > 기능)
const DATA_REGISTRY = {
    "기본 시스템": {
        "시간/날짜": [
            { label: "현재 시간 가져오기", value: "getCurrentTime" },
            { label: "오늘 날짜 가져오기", value: "getCurrentDate" }
        ]
    },
    "데이터 연동 (예정)": {
        "조회": [
            { label: "특정 호실 미납액 조회 (준비중)", value: "check_unpaid" }
        ]
    }
};

export const render = (container, aiContext) => {
    mainAI = aiContext;
    
    // 임시 테스트용 데이터 (추후 Firestore에서 로드)
    triggers = [
        { id: 'trigger_1', name: '시간 확인', intentTag: 'time_check', response: '현재 시간은 {{TIME}}입니다.', actionType: 'data', actionName: 'getCurrentTime' },
        { id: 'trigger_2', name: '날짜 확인', intentTag: 'date_check', response: '오늘은 {{DATE}}입니다.', actionType: 'data', actionName: 'getCurrentDate' },
        { id: 'trigger_3', name: '메모 작성창 열기', intentTag: 'create_memo', response: '새 나드 작성창을 열어드릴게요.', actionType: 'action', actionName: 'openNardModal' },
        { id: 'trigger_4', name: '통합 검색창 열기', intentTag: 'search_nard', response: '통합 검색창을 열어드릴게요.', actionType: 'action', actionName: 'openSearchModal' },
    ];

    container.innerHTML = `
        <style>
            .trigger-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 15px; margin-bottom: 10px; cursor: pointer; transition: background 0.2s; }
            .trigger-card:hover { background: #2c3e50; }
            .trigger-tag { background: #334155; color: #94a3b8; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        </style>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; color: #f1f5f9;">⚡ AI 트리거 목록</h3>
            <div style="display: flex; gap: 10px;">
                <button id="viewRegistryBtn" style="background: #334155; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.2s;" onmouseover="this.style.background='#475569'" onmouseout="this.style.background='#334155'">
                    <span class="material-symbols-outlined" style="font-size: 18px;">menu_book</span> 사전 목록 보기
                </button>
                <button id="addNewTriggerBtn" style="background: #10b981; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                    <span class="material-symbols-outlined" style="font-size: 18px;">add</span> 새 트리거
                </button>
            </div>
        </div>
        <div id="triggerListContainer">
            <!-- Triggers will be rendered here -->
        </div>

        <!-- Registry Viewer Modal -->
        <div id="registryModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 5000; justify-content: center; align-items: center; backdrop-filter: blur(5px);">
            <div style="background: #1e293b; border: 1px solid #334155; padding: 25px; border-radius: 12px; width: 90%; max-width: 600px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); display: flex; flex-direction: column; max-height: 85vh;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; color: #f1f5f9; display: flex; align-items: center; gap: 8px;"><span class="material-symbols-outlined" style="color: #38bdf8;">menu_book</span> AI 액션/데이터 사전 목록</h3>
                    <button id="closeRegistryBtn" style="background: none; border: none; color: #94a3b8; cursor: pointer; display: flex; align-items: center; justify-content: center;"><span class="material-symbols-outlined">close</span></button>
                </div>
                <div style="font-size: 13px; color: #cbd5e1; margin-bottom: 15px; line-height: 1.5;">
                    앱 내부에 이미 등록된 기능들의 목록입니다. 이 목록에 있는 식별자(ID)를 이용해 AI가 앱을 제어할 수 있습니다.
                </div>
                <div style="overflow-y: auto; padding-right: 10px; display: flex; flex-direction: column;" id="registryContentArea"></div>
            </div>
        </div>

        <!-- Trigger Edit Modal -->
        <div id="triggerEditModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 5000; justify-content: center; align-items: center; backdrop-filter: blur(5px);">
            <div style="background: #1e293b; border: 1px solid #334155; padding: 25px; border-radius: 12px; width: 90%; max-width: 500px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); display: flex; flex-direction: column; max-height: 85vh;">
                <h3 id="triggerModalTitle" style="margin-top: 0; color: #f1f5f9; margin-bottom: 20px;">새 트리거 생성</h3>
                <input type="hidden" id="triggerId">
                
                <div style="overflow-y: auto; padding-right: 10px;">
                    <label class="form-label">트리거 이름 (설명)</label>
                    <input type="text" id="triggerName" placeholder="예: 시간 알려주기" class="form-input">

                    <label class="form-label">[IF] 의도(Intent)가 이것일 때:</label>
                    <select id="triggerIntent" class="form-input"></select>

                    <label class="form-label">[SAY] AI는 이렇게 대답합니다:</label>
                    <textarea id="triggerResponse" rows="3" placeholder="예: 현재 시간은 {{TIME}}입니다." class="form-input"></textarea>

                    <label class="form-label">[THEN] 앱은 이 행동을 합니다:</label>
                    <div style="margin-bottom: 15px;">
                        <select id="triggerActionType" class="form-input" style="margin-bottom: 10px;">
                            <option value="none">행동 없음</option>
                            <option value="action">UI 액션 실행</option>
                            <option value="data">데이터 조회</option>
                        </select>
                        
                        <!-- 3단계 액션 선택기 -->
                        <div id="actionSelectionGroup" style="display: none; flex-direction: column; gap: 8px; background: #0f172a; padding: 12px; border-radius: 8px; border: 1px solid #334155;">
                            <div style="font-size: 11px; color: #38bdf8; font-weight: bold; margin-bottom: 2px;">앱 기능(이벤트) 맵핑</div>
                            <select id="actionTabSelect" class="form-input" style="margin-bottom: 0; padding: 8px;"></select>
                            <select id="actionSubTabSelect" class="form-input" style="margin-bottom: 0; padding: 8px;"></select>
                            <select id="actionFuncSelect" class="form-input" style="margin-bottom: 0; padding: 8px; border-color: #38bdf8;"></select>
                        </div>

                        <!-- 2단계 데이터 선택기 -->
                        <div id="dataSelectionGroup" style="display: none; flex-direction: column; gap: 8px; background: #0f172a; padding: 12px; border-radius: 8px; border: 1px solid #334155;">
                            <div style="font-size: 11px; color: #10b981; font-weight: bold; margin-bottom: 2px;">데이터 조회 도구 맵핑</div>
                            <select id="dataGroupSelect" class="form-input" style="margin-bottom: 0; padding: 8px;"></select>
                            <select id="dataFuncSelect" class="form-input" style="margin-bottom: 0; padding: 8px; border-color: #10b981;"></select>
                        </div>
                        
                        <!-- 실제 저장되는 값 (숨김) -->
                        <input type="hidden" id="triggerActionName">
                    </div>
                </div>

                <div style="display: flex; gap: 10px; margin-top: 20px; border-top: 1px solid #334155; padding-top: 15px;">
                    <button id="saveTriggerBtn" style="flex: 1; background: #2980b9; padding: 12px; font-size: 14px; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">저장</button>
                    <button id="deleteTriggerBtn" style="background: #c0392b; padding: 12px; font-size: 14px; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; display:none;">삭제</button>
                    <button id="cancelTriggerBtn" style="background: #95a5a6; padding: 12px; font-size: 14px; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">취소</button>
                </div>
            </div>
        </div>
    `;

    const renderTriggerList = () => {
        const listContainer = document.getElementById('triggerListContainer');
        if (triggers.length === 0) {
            listContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: #7f8c8d;">등록된 트리거가 없습니다.</div>';
            return;
        }
        listContainer.innerHTML = triggers.map(t => `
            <div class="trigger-card" data-id="${t.id}">
                <div style="font-weight: bold; color: #f1f5f9; margin-bottom: 10px;">${mainAI.escapeHtml(t.name)}</div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <span class="trigger-tag">IF</span>
                    <span style="font-size: 13px; color: #cbd5e1;">의도가 '${mainAI.escapeHtml(t.intentTag)}'일 때</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <span class="trigger-tag" style="background: #064e3b; color: #34d399;">SAY</span>
                    <span style="font-size: 13px; color: #cbd5e1; font-style: italic;">"${mainAI.escapeHtml(t.response)}"</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="trigger-tag" style="background: #5b21b6; color: #c4b5fd;">THEN</span>
                    <span style="font-size: 13px; color: #cbd5e1;">${t.actionType !== 'none' ? `${t.actionType}: '${mainAI.escapeHtml(t.actionName)}'` : '행동 없음'}</span>
                </div>
            </div>
        `).join('');

        listContainer.querySelectorAll('.trigger-card').forEach(card => {
            card.addEventListener('click', () => {
                const trigger = triggers.find(t => t.id === card.dataset.id);
                openTriggerModal(trigger);
            });
        });
    };

    // --- 사전 목록 GUI 렌더링 로직 ---
    const renderRegistryUI = () => {
        const container = document.getElementById('registryContentArea');
        let html = '<h4 style="color: #38bdf8; margin: 0 0 10px 0; border-bottom: 1px solid #334155; padding-bottom: 5px;">▶ 앱 기능 (UI 액션)</h4>';
        
        for (const tab in ACTION_REGISTRY) {
            html += `<div style="margin-bottom: 20px;"><strong style="color: #cbd5e1; font-size: 14px;">[${tab}]</strong><div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-top: 8px;">`;
            for (const sub in ACTION_REGISTRY[tab]) {
                ACTION_REGISTRY[tab][sub].forEach(func => {
                    html += `<div style="background: #0f172a; padding: 10px 12px; border-radius: 6px; border: 1px solid #334155;">
                        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">${sub}</div>
                        <div style="font-size: 13px; color: #f1f5f9; font-weight: bold;">${func.label}</div>
                        <div style="font-size: 11px; color: #38bdf8; margin-top: 6px; font-family: monospace; background: #1e293b; padding: 2px 6px; border-radius: 4px; display: inline-block;">${func.value}</div>
                    </div>`;
                });
            }
            html += `</div></div>`;
        }

        html += '<h4 style="color: #10b981; margin: 10px 0 10px 0; border-bottom: 1px solid #334155; padding-bottom: 5px;">▶ 데이터 조회 도구</h4>';
        for (const group in DATA_REGISTRY) {
            html += `<div style="margin-bottom: 20px;"><strong style="color: #cbd5e1; font-size: 14px;">[${group}]</strong><div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-top: 8px;">`;
            for (const sub in DATA_REGISTRY[group]) {
                DATA_REGISTRY[group][sub].forEach(func => {
                    html += `<div style="background: #0f172a; padding: 10px 12px; border-radius: 6px; border: 1px solid #334155;">
                        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">${sub}</div>
                        <div style="font-size: 13px; color: #f1f5f9; font-weight: bold;">${func.label}</div>
                        <div style="font-size: 11px; color: #10b981; margin-top: 6px; font-family: monospace; background: #1e293b; padding: 2px 6px; border-radius: 4px; display: inline-block;">${func.value}</div>
                    </div>`;
                });
            }
            html += `</div></div>`;
        }
        container.innerHTML = html;
    };

    // --- 3단계 드롭다운 로직 ---
    const updateActionSubTabs = () => {
        const tab = document.getElementById('actionTabSelect').value;
        const subTabSelect = document.getElementById('actionSubTabSelect');
        subTabSelect.innerHTML = Object.keys(ACTION_REGISTRY[tab] || {}).map(sub => `<option value="${sub}">${sub}</option>`).join('');
        updateActionFuncs();
    };

    const updateActionFuncs = () => {
        const tab = document.getElementById('actionTabSelect').value;
        const sub = document.getElementById('actionSubTabSelect').value;
        const funcSelect = document.getElementById('actionFuncSelect');
        const funcs = (ACTION_REGISTRY[tab] && ACTION_REGISTRY[tab][sub]) ? ACTION_REGISTRY[tab][sub] : [];
        funcSelect.innerHTML = funcs.map(f => `<option value="${f.value}">${f.label} (${f.value})</option>`).join('');
    };

    const updateDataFuncs = () => {
        const group = document.getElementById('dataGroupSelect').value;
        const funcSelect = document.getElementById('dataFuncSelect');
        const funcs = DATA_REGISTRY[group] ? Object.values(DATA_REGISTRY[group]).flat() : [];
        funcSelect.innerHTML = funcs.map(f => `<option value="${f.value}">${f.label} (${f.value})</option>`).join('');
    };

    // 리버스 룩업 (저장된 actionName으로 대/중분류 역추적)
    const findActionPath = (val) => {
        for (const tab in ACTION_REGISTRY) {
            for (const sub in ACTION_REGISTRY[tab]) {
                const func = ACTION_REGISTRY[tab][sub].find(f => f.value === val);
                if (func) return { tab, sub, func: val };
            }
        }
        return null;
    };

    const findDataPath = (val) => {
        for (const group in DATA_REGISTRY) {
            for (const sub in DATA_REGISTRY[group]) {
                const func = DATA_REGISTRY[group][sub].find(f => f.value === val);
                if (func) return { group, func: val };
            }
        }
        return null;
    };

    // 이벤트 리스너 세팅
    setTimeout(() => {
        const tabSelect = document.getElementById('actionTabSelect');
        const subTabSelect = document.getElementById('actionSubTabSelect');
        const dataGroupSelect = document.getElementById('dataGroupSelect');
        const actionTypeSelect = document.getElementById('triggerActionType');

        tabSelect.addEventListener('change', updateActionSubTabs);
        subTabSelect.addEventListener('change', updateActionFuncs);
        dataGroupSelect.addEventListener('change', updateDataFuncs);

        actionTypeSelect.addEventListener('change', (e) => {
            const type = e.target.value;
            document.getElementById('actionSelectionGroup').style.display = type === 'action' ? 'flex' : 'none';
            document.getElementById('dataSelectionGroup').style.display = type === 'data' ? 'flex' : 'none';
        });

        // 초기 데이터 세팅
        tabSelect.innerHTML = Object.keys(ACTION_REGISTRY).map(tab => `<option value="${tab}">${tab}</option>`).join('');
        dataGroupSelect.innerHTML = Object.keys(DATA_REGISTRY).map(g => `<option value="${g}">${g}</option>`).join('');
        
        updateActionSubTabs();
        updateDataFuncs();
    }, 0);

    // 사전 목록 모달 이벤트 리스너
    document.getElementById('viewRegistryBtn').addEventListener('click', () => {
        renderRegistryUI();
        document.getElementById('registryModal').style.display = 'flex';
    });
    document.getElementById('closeRegistryBtn').addEventListener('click', () => {
        document.getElementById('registryModal').style.display = 'none';
    });

    const openTriggerModal = (trigger = null) => {
        const modal = document.getElementById('triggerEditModal');
        const title = document.getElementById('triggerModalTitle');
        const idInput = document.getElementById('triggerId');
        const nameInput = document.getElementById('triggerName');
        const intentSelect = document.getElementById('triggerIntent');
        const responseInput = document.getElementById('triggerResponse');
        const actionTypeSelect = document.getElementById('triggerActionType');
        
        const actionGroup = document.getElementById('actionSelectionGroup');
        const dataGroup = document.getElementById('dataSelectionGroup');
        const deleteBtn = document.getElementById('deleteTriggerBtn');

        const intents = mainAI.aiDataset.filter(item => item.type === 'intent').map(item => item.name);
        intentSelect.innerHTML = intents.map(name => `<option value="${name}">${name}</option>`).join('');

        if (trigger) {
            title.textContent = '트리거 수정';
            idInput.value = trigger.id;
            nameInput.value = trigger.name;
            intentSelect.value = trigger.intentTag;
            responseInput.value = trigger.response;
            actionTypeSelect.value = trigger.actionType;
            deleteBtn.style.display = 'block';

            // 드롭다운 역추적 세팅
            if (trigger.actionType === 'action') {
                actionGroup.style.display = 'flex';
                dataGroup.style.display = 'none';
                const path = findActionPath(trigger.actionName);
                if (path) {
                    document.getElementById('actionTabSelect').value = path.tab;
                    updateActionSubTabs();
                    document.getElementById('actionSubTabSelect').value = path.sub;
                    updateActionFuncs();
                    document.getElementById('actionFuncSelect').value = path.func;
                }
            } else if (trigger.actionType === 'data') {
                actionGroup.style.display = 'none';
                dataGroup.style.display = 'flex';
                const path = findDataPath(trigger.actionName);
                if (path) {
                    document.getElementById('dataGroupSelect').value = path.group;
                    updateDataFuncs();
                    document.getElementById('dataFuncSelect').value = path.func;
                }
            } else {
                actionGroup.style.display = 'none'; dataGroup.style.display = 'none';
            }
        } else {
            title.textContent = '새 트리거 생성';
            idInput.value = '';
            nameInput.value = '';
            intentSelect.value = intents[0] || '';
            responseInput.value = '';
            actionTypeSelect.value = 'none';
            deleteBtn.style.display = 'none';
            
            actionGroup.style.display = 'none'; 
            dataGroup.style.display = 'none';
            
            updateActionSubTabs();
            updateDataFuncs();
        }

        modal.style.display = 'flex';
    };

    const closeTriggerModal = () => {
        document.getElementById('triggerEditModal').style.display = 'none';
    };

    document.getElementById('addNewTriggerBtn').addEventListener('click', () => openTriggerModal());
    document.getElementById('cancelTriggerBtn').addEventListener('click', closeTriggerModal);
    
    document.getElementById('saveTriggerBtn').addEventListener('click', () => {
        const id = document.getElementById('triggerId').value;
        const actionType = document.getElementById('triggerActionType').value;
        
        // 선택된 드롭다운에 따라 actionName 결정
        let actionName = '';
        if (actionType === 'action') {
            actionName = document.getElementById('actionFuncSelect').value;
        } else if (actionType === 'data') {
            actionName = document.getElementById('dataFuncSelect').value;
        }

        const newTrigger = {
            id: id || 'trigger_' + Date.now(),
            name: document.getElementById('triggerName').value,
            intentTag: document.getElementById('triggerIntent').value,
            response: document.getElementById('triggerResponse').value,
            actionType: actionType,
            actionName: actionName,
        };

        if (id) {
            const index = triggers.findIndex(t => t.id === id);
            triggers[index] = newTrigger;
        } else {
            triggers.push(newTrigger);
        }
        
        renderTriggerList();
        closeTriggerModal();
    });

    document.getElementById('deleteTriggerBtn').addEventListener('click', () => {
        const id = document.getElementById('triggerId').value;
        if (confirm('이 트리거를 삭제하시겠습니까?')) {
            triggers = triggers.filter(t => t.id !== id);
            renderTriggerList();
            closeTriggerModal();
        }
    });

    renderTriggerList();
};