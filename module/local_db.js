import { auth, db } from "../js/main.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const init = (container) => {
    if (!auth.currentUser) {
        container.innerHTML = '<div style="padding: 50px; text-align: center; color: #e74c3c;">로그인이 필요합니다.</div>';
        return;
    }

    container.innerHTML = `
        <div style="padding: 30px; height: calc(100vh - 120px); background: #f4f6f8; box-sizing: border-box; overflow-y: auto;">
            <h2 style="color: #2c3e50; margin-top: 0; display: flex; align-items: center; gap: 8px;">
                <span class="material-symbols-outlined" style="font-size: 28px; color: #27ae60;">storage</span>
                기기 저장소 관리
            </h2>
            <p style="color: #7f8c8d; font-size: 14px; margin-bottom: 20px;">스마트폰, PC 등 현재 사용 중인 기기에 안전하게 저장되는 개인 데이터를 관리하는 공간입니다.</p>
            
            <!-- 기기 저장소 사용량 및 동기화 (통합) -->
            <div style="background: #fff; padding: 25px; border-radius: 8px; border: 1px solid #e0e0e0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 20px;">
                <h3 style="margin-top: 0; color: #2980b9; display: flex; align-items: center; gap: 6px;">
                    <span class="material-symbols-outlined" style="font-size: 20px;">data_usage</span> 내 나드 및 기기 저장소 현황
                </h3>
                <p style="font-size: 13px; color: #34495e; line-height: 1.6; margin-bottom: 15px;">
                    공유 나드는 클라우드 서버와 이 기기에 동시에 복사되어 보호되며, 개인 나드는 이 기기에만 저장됩니다.<br>
                    아래 버튼을 이용해 현재 기기에 저장된 데이터를 관리할 수 있습니다.
                </p>
                
                <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; font-size: 13px; color: #7f8c8d; margin-bottom: 8px;">
                        <span id="storageUsageText">사용량 계산 중...</span>
                        <span id="storageTotalText"></span>
                    </div>
                    <div style="width: 100%; background-color: #ecf0f1; border-radius: 8px; overflow: hidden; height: 10px;">
                        <div id="storageUsageBar" style="width: 0%; height: 100%; background-color: #27ae60; transition: width 0.5s ease;"></div>
                    </div>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <!-- 동기화 설명 영역 -->
                    <div style="display: flex; flex-direction: column; gap: 8px; padding-bottom: 15px; border-bottom: 1px dashed #eee;">
                        <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">
                            <button id="syncToLocalBtn" style="background: #27ae60; color: white; border: none; padding: 12px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; display: flex; align-items: center; gap: 6px;" onmouseover="this.style.background='#219653'" onmouseout="this.style.background='#27ae60'"><span class="material-symbols-outlined" style="font-size: 18px;">cloud_download</span> 클라우드에서 데이터 가져오기</button>
                            <span style="font-size: 12px; color: #7f8c8d; flex: 1; min-width: 200px; line-height: 1.5;">서버에 있는 최신 나드 데이터를 <strong>현재 기기로 복사</strong>해옵니다. 인터넷이 안 터지는 환경(오프라인)에서도 나드를 열어볼 수 있게 해줍니다.</span>
                        </div>
                    </div>

                    <!-- 비우기 설명 영역 -->
                    <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">
                        <button id="clearLocalBtn" style="background: #e74c3c; color: white; border: none; padding: 12px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; display: flex; align-items: center; gap: 6px;" onmouseover="this.style.background='#c0392b'" onmouseout="this.style.background='#e74c3c'"><span class="material-symbols-outlined" style="font-size: 18px;">delete_sweep</span> 기기 임시 데이터 비우기</button>
                        <span style="font-size: 12px; color: #7f8c8d; flex: 1; min-width: 200px; line-height: 1.5;">이 기기에 임시로 저장해둔 데이터를 모두 지워 용량을 늘립니다.<br><strong style="color: #e74c3c;">(클라우드 서버의 원본 데이터는 절대 지워지지 않으니 안심하세요!)</strong></span>
                    </div>
                </div>
            </div>

            <!-- 백업 및 복원 (가져오기/내보내기) -->
            <div style="background: #fff; padding: 25px; border-radius: 8px; border: 1px solid #e0e0e0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <h3 style="margin-top: 0; color: #8e44ad; display: flex; align-items: center; gap: 6px;">
                    <span class="material-symbols-outlined" style="font-size: 20px;">save</span> 현재 기기 백업 및 복원
                </h3>
                <p style="font-size: 13px; color: #34495e; line-height: 1.6;">현재 기기에 저장된 오프라인 데이터를 파일(JSON)로 내보내거나, 파일에서 읽어와 복원할 수 있습니다.<br>인터넷이 없는 환경에서 데이터를 백업하고 이동할 때 유용합니다.</p>
                
                <div style="margin-top: 20px; display: flex; flex-wrap: wrap; gap: 10px;">
                    <button id="exportLocalBtn" style="background: #8e44ad; color: white; border: none; padding: 12px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; display: flex; align-items: center; gap: 6px;" onmouseover="this.style.background='#732d91'" onmouseout="this.style.background='#8e44ad'"><span class="material-symbols-outlined" style="font-size: 18px;">download</span> 파일로 내보내기</button>
                    
                    <!-- 가짜 버튼으로 파일 인풋 트리거 -->
                    <button id="importTriggerBtn" style="background: #f39c12; color: white; border: none; padding: 12px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; display: flex; align-items: center; gap: 6px;" onmouseover="this.style.background='#d68910'" onmouseout="this.style.background='#f39c12'"><span class="material-symbols-outlined" style="font-size: 18px;">upload</span> 파일에서 가져오기</button>
                    <input type="file" id="importLocalInput" accept=".json" style="display: none;">
                </div>
            </div>
        </div>
    `;

    // 1. 기기 저장소(Quota) 계산 및 UI 업데이트
    const updateStorageInfo = async () => {
        if (navigator.storage && navigator.storage.estimate) {
            try {
                const estimate = await navigator.storage.estimate();
                const usedMB = (estimate.usage / (1024 * 1024)).toFixed(2);
                const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(2);
                const percent = ((estimate.usage / estimate.quota) * 100).toFixed(1);
                
                document.getElementById('storageUsageText').textContent = `사용량: ${usedMB} MB`;
                document.getElementById('storageTotalText').textContent = `전체 할당량: ${quotaMB} MB (${percent}%)`;
                document.getElementById('storageUsageBar').style.width = `${percent}%`;
                
                // 용량이 80% 이상 차면 프로그레스 바 색상을 빨간색으로 변경
                if (percent > 80) document.getElementById('storageUsageBar').style.backgroundColor = '#e74c3c';
                else document.getElementById('storageUsageBar').style.backgroundColor = '#27ae60';
            } catch(e) {
                document.getElementById('storageUsageText').textContent = '용량 정보를 가져올 수 없습니다.';
            }
        } else {
            document.getElementById('storageUsageText').textContent = '이 브라우저는 저장소 용량 측정을 지원하지 않습니다.';
        }
    };
    updateStorageInfo();

    // 2. 서버에서 로컬로 동기화 (기존 로직)
    document.getElementById('syncToLocalBtn').addEventListener('click', async () => {
        const btn = document.getElementById('syncToLocalBtn');
        btn.textContent = '동기화 진행 중...';
        btn.disabled = true;

        try {
            const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
            if (userDoc.exists()) {
                const nardTree = userDoc.data().nardTree || userDoc.data().memoTree || [];
                
                await new Promise((resolve, reject) => {
                    const request = indexedDB.open('GoNardDB', 1);
                    request.onupgradeneeded = (e) => {
                        const idb = e.target.result;
                        // nards 라는 이름의 테이블(Object Store) 생성
                        if (!idb.objectStoreNames.contains('nards')) {
                            idb.createObjectStore('nards', { keyPath: 'id' });
                        }
                    };
                    request.onsuccess = (e) => {
                        const idb = e.target.result;
                        const tx = idb.transaction('nards', 'readwrite');
                        const store = tx.objectStore('nards');
                        store.clear(); // 기존 로컬 데이터 초기화
                        nardTree.forEach(item => store.put(item)); // 새 데이터로 덮어쓰기
                        tx.oncomplete = () => resolve();
                        tx.onerror = (err) => reject(err);
                    };
                    request.onerror = (err) => reject(err);
                });
                
                alert(`✅ 총 ${nardTree.length}개의 나드 데이터가 현재 기기에 성공적으로 복사되었습니다!\n이제 인터넷이 연결되지 않은 오프라인 상태에서도 나드를 보고 쓸 수 있습니다.`);
                updateStorageInfo();
            }
        } catch (error) {
            console.error("기기 동기화 실패:", error);
            alert("동기화 중 오류가 발생했습니다: " + error.message);
        } finally {
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">cloud_download</span> 클라우드에서 데이터 가져오기';
            btn.disabled = false;
        }
    });

    // 3. 임시 데이터 완전 비우기
    document.getElementById('clearLocalBtn').addEventListener('click', () => {
        if (confirm("현재 기기에 저장된 임시 데이터를 모두 지우시겠습니까?\n(클라우드 서버의 원본 데이터는 삭제되지 않으니 안심하세요!)")) {
            const request = indexedDB.deleteDatabase('GoNardDB');
            request.onsuccess = () => {
                alert("기기의 임시 데이터가 성공적으로 비워졌습니다.");
                updateStorageInfo();
            };
            request.onerror = () => alert("기기 데이터 지우기에 실패했습니다.");
        }
    });

    // 4. 로컬 DB 내보내기 (JSON 다운로드)
    document.getElementById('exportLocalBtn').addEventListener('click', () => {
        const request = indexedDB.open('GoNardDB', 1);
        request.onsuccess = (e) => {
            const idb = e.target.result;
            if (!idb.objectStoreNames.contains('nards')) {
                return alert('먼저 클라우드에서 기기로 데이터를 가져와주세요. 내보낼 데이터가 없습니다.');
            }
            const tx = idb.transaction('nards', 'readonly');
            const store = tx.objectStore('nards');
            const getAll = store.getAll();
            
            getAll.onsuccess = () => {
                const data = getAll.result;
                if (data.length === 0) return alert('내보낼 데이터가 없습니다.');
                
                // JSON 파일 생성 및 다운로드 트리거
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `GoNard_LocalBackup_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            };
        };
        request.onerror = () => alert('기기 저장소에 접근할 수 없습니다.');
    });

    // 5. 로컬 DB 가져오기 (JSON 업로드)
    document.getElementById('importTriggerBtn').addEventListener('click', () => {
        document.getElementById('importLocalInput').click();
    });

    document.getElementById('importLocalInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (!Array.isArray(data)) throw new Error("지원하지 않는 백업 파일 형식입니다.");
                
                const request = indexedDB.open('GoNardDB', 1);
                request.onupgradeneeded = (e) => {
                    const idb = e.target.result;
                    if (!idb.objectStoreNames.contains('nards')) idb.createObjectStore('nards', { keyPath: 'id' });
                };
                request.onsuccess = (e) => {
                    const idb = e.target.result;
                    const tx = idb.transaction('nards', 'readwrite');
                    const store = tx.objectStore('nards');
                    store.clear();
                    data.forEach(item => store.put(item));
                    
                    tx.oncomplete = () => {
                        alert(`성공적으로 복원되었습니다! 총 ${data.length}개의 데이터가 이 기기에 저장되었습니다.\n(주의: 복원된 내용은 클라우드 서버에는 자동으로 올라가지 않습니다.)`);
                        updateStorageInfo();
                        document.getElementById('importLocalInput').value = ''; // 재선택을 위해 초기화
                    };
                };
            } catch(err) {
                alert('파일을 읽는 중 오류가 발생했습니다. GoNard에서 내보낸 올바른 백업 파일인지 확인해주세요.');
            }
        };
        reader.readAsText(file);
    });
};