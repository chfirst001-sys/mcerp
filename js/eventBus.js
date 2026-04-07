// Custom Event 기반 전역 상태 관리 유틸리티
export const EventBus = {
    on(event, callback) {
        document.addEventListener(event, (e) => callback(e.detail));
    },
    emit(event, data) {
        const customEvent = new CustomEvent(event, { detail: data });
        document.dispatchEvent(customEvent);
    },
    off(event, callback) {
        document.removeEventListener(event, callback);
    }
};