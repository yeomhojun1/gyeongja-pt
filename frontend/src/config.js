// 백엔드 주소는 여기 한 곳에서만 결정한다.
// 바꾸려면 frontend/.env 에 VITE_API_URL 을 설정하세요 (.env.example 참고).
export const API = import.meta.env.VITE_API_URL || 'http://localhost:4005';

// VITE_DEMO=true 로 빌드하면 서버·AI 없이 브라우저 안의 가짜 API로 동작한다 (src/demo).
export const DEMO = import.meta.env.VITE_DEMO === 'true';

// AI 서버 없이 미리 준비한 답변으로 동작하는가. 데모이거나, 배포 빌드인데 VITE_API_URL(AI 서버)을 안 넣었으면 그렇다.
// 이때 챗봇은 예시 질문 8개만 답하고 뉴스 해설은 메뉴에서 뺀다(기사마다 미리 답을 쓸 수 없음).
export const NO_AI = DEMO || (import.meta.env.PROD && !import.meta.env.VITE_API_URL);
