// 데모 모드(VITE_DEMO=true) 전용 가짜 백엔드.
// window.fetch 를 감싸서 `${API}/api/...` 요청만 브라우저 안에서 처리한다.
// 투자 권유 필터는 서버와 같은 규칙(shared/investFilter.js)을 쓴다.
import { API } from '../config';
import { findDemoAnswer, DEMO_UNKNOWN } from './answers';
import { findCompareTopic } from '../content/compare';
import { checkInvestAdvice, INVEST_REFUSAL } from '../../../shared/investFilter.js';

const DELAY_MS = 600;
const NEWS_DEMO =
  '데모 모드에서는 뉴스 해설이 동작하지 않습니다. 기사마다 내용이 달라 미리 답을 써 둘 수 없기 때문입니다.\n' +
  '홈 화면의 "오늘의 이슈"에서 미리 정리한 이슈 해설을 보거나, "경제 챗봇"의 예시 질문을 눌러 보세요.';

const json = (body, status = 200) =>
  new Promise(resolve =>
    setTimeout(
      () => resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })),
      DELAY_MS
    )
  );

function handle(path, body) {
  switch (path) {
    case '/api/health':
      return json({ ok: true });
    case '/api/chat': {
      const last = [...(body?.messages || [])].reverse().find(m => m.role === 'user');
      const text = last ? String(last.content) : '';
      if (checkInvestAdvice(text).blocked) return json({ result: INVEST_REFUSAL, refused: true });
      const answer = text ? findDemoAnswer(text) : null;
      return json({ result: answer || DEMO_UNKNOWN, demoUnknown: !answer });
    }
    case '/api/news-explain':
      return json({ result: NEWS_DEMO });
    case '/api/compare': {
      const topic = String(body?.topic || '');
      if (checkInvestAdvice(topic).blocked) return json({ result: INVEST_REFUSAL, refused: true });
      const found = findCompareTopic(topic);
      return json(found
        ? { presetId: found.id }
        : { result: '데모 모드에서는 미리 정리한 4개 주제(최저임금 인상·부동산 규제·재정 확대·기본소득)만 비교할 수 있습니다.' });
    }
    default:
      return json({ error: '데모 모드에서 지원하지 않는 요청입니다.' }, 404);
  }
}

export function installMockApi() {
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.startsWith(`${API}/api/`)) return realFetch(input, init);
    let body = null;
    try { body = init.body ? JSON.parse(init.body) : null; } catch { body = null; }
    return handle(url.slice(API.length).split('?')[0], body);
  };
}
