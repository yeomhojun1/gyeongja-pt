import express from 'express';
import cors from 'cors';
// AI 제공자: Google Gemini (REST, 무료 키). 외부 SDK 없이 Node fetch 사용.
import { config } from 'dotenv';
import {
  requireText, requireMessages,
  parseAllowedOrigins, isOriginAllowed, quote
} from './validate.js';
import { mapBodyError, mapLlmError } from './errors.js';
import { rateLimit, parseRateLimit } from './rateLimit.js';
import { BASE, CHAT, NEWS, COMPARE } from './prompts.js';
import { checkInvestAdvice, INVEST_REFUSAL } from '../shared/investFilter.js';

config();

// 어떤 입력으로도 프로세스가 죽지 않도록 하는 최종 안전망
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
// 재시작 관리자(pm2·systemd·컨테이너 등) 없이 npm start 로만 띄우므로 종료하지 않고 기록만 한다.
// 재시작 관리자 뒤에 배포하게 되면 여기서 process.exit(1) 로 끝내는 편이 안전하다.
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

const app = express();
const ALLOWED_ORIGINS = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
app.use(cors({
  origin: (origin, cb) => cb(null, isOriginAllowed(origin, ALLOWED_ORIGINS))
}));
app.use(express.json({ limit: process.env.JSON_LIMIT || '1mb' }));

// Gemini 를 부르는 경로(3종)는 IP별 분당 호출 수를 제한한다. 3종이 한 한도를 같이 쓴다.
// trust proxy 는 켜지 않는다: 배포 설정(vercel.json·.vercelignore, pages.yml)은 프론트만 올리고 백엔드는
// 직접 실행하므로 req.ip 가 곧 접속 IP다. 리버스 프록시 뒤에 둘 때만 app.set('trust proxy', 1) 을 켤 것
// (프록시 없이 켜면 X-Forwarded-For 위조로 제한을 우회할 수 있다).
const RATE_LIMIT_PER_MIN = parseRateLimit(process.env.RATE_LIMIT_PER_MIN, 10);
const llmLimit = rateLimit({ limit: RATE_LIMIT_PER_MIN, windowMs: 60_000 });

// async 핸들러의 거부된 Promise를 Express 에러 핸들러로 넘긴다
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// 검증 실패 시 400 응답을 내고 true 반환
const bad = (res, r) => {
  if (r.ok) return false;
  res.status(400).json({ error: r.error });
  return true;
};

// 투자 권유성 요청이면 AI 를 부르지 않고 거절 안내를 보내고 true 반환 (shared/investFilter.js)
const refused = (res, text) => {
  if (!checkInvestAdvice(text).blocked) return false;
  res.json({ result: INVEST_REFUSAL, refused: true });
  return true;
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-3.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const LLM_TIMEOUT_MS = 60_000;

// Anthropic messages.create 와 유사한 형태로 Gemini 를 호출해 텍스트를 반환한다.
async function geminiGenerate({ system, messages, maxTokens }) {
  if (!GEMINI_API_KEY) {
    const e = new Error('GEMINI_API_KEY missing');
    e.noKey = true;
    throw e;
  }
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof m.content === 'string' ? m.content : String(m.content) }]
  }));
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { maxOutputTokens: maxTokens || 1500 }
  };
  // 키는 URL(?key=)이 아니라 헤더로 보낸다: URL 은 프록시·접근 로그·오류 메시지에 남기 쉽다.
  const r = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j?.error?.message || `Gemini HTTP ${r.status}`);
    e.status = r.status;
    e.code = j?.error?.status; // 예: RESOURCE_EXHAUSTED, INVALID_ARGUMENT, PERMISSION_DENIED
    throw e;
  }
  const text = (j?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
  if (!text) {
    const e = new Error('Gemini empty response');
    e.status = 502;
    throw e;
  }
  return text;
}

// Gemini 오류(영문 원문)를 사용자용 한국어 메시지·상태코드로 변환한다 (errors.js mapLlmError)
function llmFail(res, e) {
  console.error('[llm]', e);
  const mapped = mapLlmError(e, Boolean(GEMINI_API_KEY));
  return res.status(mapped.status).json({ error: mapped.error });
}

app.get('/api/health', (_, res) => res.json({ ok: true }));

// AI 설정 상태 확인 (외부 호출 없음: 키 설정 여부만 확인)
app.get('/api/llm-status', (_req, res) => {
  const configured = Boolean(GEMINI_API_KEY);
  res.json({
    ok: configured,
    provider: 'google',
    model: MODEL,
    configured,
    message: configured
      ? 'AI 기능을 사용할 수 있습니다.'
      : 'GEMINI_API_KEY 가 설정되지 않아 AI 기능(경제 챗봇·뉴스 해설·자유 주제 시각 비교)은 동작하지 않습니다.'
  });
});

// 1. 경제 챗봇
app.post('/api/chat', llmLimit, wrap(async (req, res) => {
  const msgs = requireMessages(req.body?.messages);
  if (bad(res, msgs)) return;
  if (refused(res, msgs.value.at(-1).content)) return;
  try {
    const text = await geminiGenerate({
      maxTokens: 2000,
      system: BASE + CHAT,
      // 사용자 차례만 구분자로 감싼다(이전 답변은 모델 차례라 감싸지 않음). 여러 차례 대화는 그대로 유지된다.
      messages: msgs.value.map((m) => (m.role === 'user' ? { role: m.role, content: quote(m.content) } : m))
    });
    res.json({ result: text });
  } catch (e) {
    llmFail(res, e);
  }
}));

// 2. 뉴스 해설 (기사 본문에는 "매수" 같은 말이 자연스럽게 나오므로 투자 필터를 걸지 않고 원칙으로만 막는다)
app.post('/api/news-explain', llmLimit, wrap(async (req, res) => {
  const news = requireText(req.body?.newsText, { label: '기사 내용', max: 8000 });
  if (bad(res, news)) return;
  try {
    const text = await geminiGenerate({
      maxTokens: 1500,
      system: BASE + NEWS,
      messages: [{ role: 'user', content: `다음 경제 기사를 해설해주세요.\n${quote(news.value)}` }]
    });
    res.json({ result: text });
  } catch (e) {
    llmFail(res, e);
  }
}));

// 3. 자유 주제 시각 비교 (미리 정리한 4개 주제는 프론트가 AI 없이 보여 준다)
app.post('/api/compare', llmLimit, wrap(async (req, res) => {
  const topic = requireText(req.body?.topic, { label: '비교 주제', max: 100 });
  if (bad(res, topic)) return;
  if (refused(res, topic.value)) return;
  try {
    const text = await geminiGenerate({
      maxTokens: 2000,
      system: BASE + COMPARE,
      messages: [{ role: 'user', content: `다음 주제에 대한 대표 시각을 비교해주세요.\n${quote(topic.value)}` }]
    });
    res.json({ result: text });
  } catch (e) {
    llmFail(res, e);
  }
}));

// 정의되지 않은 경로
app.use((req, res) => {
  res.status(404).json({ error: `요청하신 경로를 찾을 수 없습니다: ${req.method} ${req.path}` });
});

// 최종 에러 핸들러 — HTML 스택트레이스 대신 항상 JSON을 돌려준다
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (res.headersSent) return;
  const mapped = mapBodyError(err);
  if (mapped) return res.status(mapped.status).json({ error: mapped.error });
  console.error('[error]', err);
  res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
});

const PORT = process.env.PORT || 4005;
const server = app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
  console.log(`LLM: ${MODEL} (Google Gemini)`);
  console.log(`허용 Origin: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`AI 요청 제한: ${RATE_LIMIT_PER_MIN ? `IP당 분당 ${RATE_LIMIT_PER_MIN}회` : '없음(RATE_LIMIT_PER_MIN=0)'}`);
  if (!GEMINI_API_KEY) {
    console.warn('⚠ GEMINI_API_KEY 가 없습니다. AI 기능 3종(챗봇·뉴스 해설·자유 주제 비교)은 503을 반환합니다.');
  }
});

export { app, server };
