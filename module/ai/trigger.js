let mainAI;

export const render = (container, aiContext) => {
    mainAI = aiContext;
    container.innerHTML = `
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 30px; text-align: center;">
            <h3 style="color: #f1f5f9; margin-top: 0; margin-bottom: 10px; font-size: 18px;">⚡ Ai 트리거 설정</h3>
            <p style="color: #94a3b8; font-size: 14px; margin: 0;">GUI 환경의 MCP 트리거 액션 설정 기능을 준비 중입니다.</p>
        </div>
    `;
};