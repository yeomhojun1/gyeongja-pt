// 백엔드 주소는 여기 한 곳에서만 결정한다.
// 바꾸려면 frontend/.env 에 VITE_API_URL 을 설정하세요 (.env.example 참고).
export const API = import.meta.env.VITE_API_URL || 'http://localhost:4005';

// VITE_DEMO=true 로 빌드하면 서버·AI 없이 브라우저 안의 가짜 API로 동작한다 (src/demo).
export const DEMO = import.meta.env.VITE_DEMO === 'true';
