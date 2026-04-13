import { openSettingsModal } from "./settings.js";

let debounceTimer;
export const debounce = (func, delay) => {
    return function(...args) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(this, args), delay);
    };
};

export const autoSaveToLocal = () => {
    const editView = document.getElementById('nardEditView');
    if (!editView || editView.style.display === 'none') return;
    const id = document.getElementById('nardId').value;
    if (id) return; // 기존 나드 수정 시에는 임시저장 안함

    const title = document.getElementById('nardTitleInput').value;
    const content = document.getElementById('nardContentInput').innerHTML;

    if (title.trim() || content.trim()) {
        localStorage.setItem('gonard_temp_save', JSON.stringify({ title, content, savedAt: Date.now() }));
    } else {
        localStorage.removeItem('gonard_temp_save');
    }
};

export const debouncedAutoSave = debounce(autoSaveToLocal, 1500);

export const initEditorEvents = (container) => {
    // 에디터 툴바 활성화 상태 업데이트
    const updateToolbarState = () => {
        container.querySelectorAll('.fmt-btn').forEach(btn => {
            if (document.queryCommandState(btn.dataset.cmd)) {
                btn.style.color = '#3498db'; btn.style.background = '#e8f4f8';
            } else {
                btn.style.color = '#7f8c8d'; btn.style.background = 'none';
            }
        });
    };

    const contentInput = document.getElementById('nardContentInput');
    if (contentInput) {
        contentInput.addEventListener('keyup', updateToolbarState);
        contentInput.addEventListener('mouseup', updateToolbarState);
        contentInput.addEventListener('touchend', updateToolbarState);
    }

    container.querySelectorAll('.fmt-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            document.execCommand(btn.dataset.cmd, false, null);
            document.getElementById('nardContentInput').focus();
            updateToolbarState();
        });
    });

    // 색상 팔레트 기능
    const colorBtn = document.getElementById('fmt-color-btn');
    const colorPopup = document.getElementById('color-palette-popup');
    const colors = ['#000000', '#7f8c8d', '#e74c3c', '#e67e22', '#f1c40f', '#27ae60', '#2980b9', '#8e44ad', '#fd79a8', '#8b4513'];
    
    if (colorPopup) {
        colorPopup.innerHTML = colors.map(c => `<div class="color-dot" data-color="${c}" style="width: 20px; height: 20px; border-radius: 50%; background-color: ${c}; cursor: pointer; border: 1px solid #ddd;"></div>`).join('');
        colorPopup.querySelectorAll('.color-dot').forEach(dot => {
            dot.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                document.execCommand('foreColor', false, dot.dataset.color);
                document.getElementById('nardContentInput').focus();
                colorPopup.style.display = 'none';
            });
        });
    }

    if (colorBtn) colorBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); colorPopup.style.display = colorPopup.style.display === 'none' ? 'flex' : 'none'; });
    if (!container._colorPopupGlobalClick) {
        container._colorPopupGlobalClick = (e) => { if (colorPopup && colorPopup.style.display === 'flex' && colorBtn && !colorBtn.contains(e.target) && !colorPopup.contains(e.target)) colorPopup.style.display = 'none'; };
        document.addEventListener('click', container._colorPopupGlobalClick);
    }
    
    const settingsBtn = document.getElementById('nardSettingsBtn');
    if (settingsBtn) settingsBtn.addEventListener('click', () => openSettingsModal());
};