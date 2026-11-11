// LLM 호출 경로용 IP별 요청 제한 (고정 윈도우, 메모리 저장, 외부 의존성 없음).
// 인증이 없는 API라 누구나 반복 호출로 Gemini 사용량을 소진시킬 수 있어서 둔다.
// 카운트는 프로세스 메모리에만 있으므로 재시작하면 초기화되고, 여러 인스턴스 사이에 공유되지 않는다(단일 서버용).

/** RATE_LIMIT_PER_MIN 환경변수 해석. 0 이상의 정수만 인정, 0 이면 제한 끔. 그 밖의 값은 기본값. */
export function parseRateLimit(raw, fallback = 10) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

/**
 * 키(IP)별로 windowMs 동안 limit 회까지 허용한다. now 는 테스트에서 시간을 주입하기 위한 것.
 * @returns {{ check(key: string): {allowed: boolean, remaining: number, retryAfterSec: number}, size(): number }}
 */
export function createRateLimiter({ limit, windowMs = 60_000, now = Date.now } = {}) {
  const hits = new Map(); // key -> { start, count }
  let lastSweep = now();

  // 만료된 키를 주기적으로 지워 메모리가 계속 늘지 않게 한다
  function sweep(t) {
    if (t - lastSweep < windowMs) return;
    for (const [k, e] of hits) if (t - e.start >= windowMs) hits.delete(k);
    lastSweep = t;
  }

  function check(key) {
    const t = now();
    sweep(t);
    let e = hits.get(key);
    if (!e || t - e.start >= windowMs) {
      e = { start: t, count: 0 };
      hits.set(key, e);
    }
    e.count += 1;
    return {
      allowed: e.count <= limit,
      remaining: Math.max(0, limit - e.count),
      retryAfterSec: Math.max(1, Math.ceil((e.start + windowMs - t) / 1000))
    };
  }

  return { check, size: () => hits.size };
}

/** Express 미들웨어. limit 이 0 이면 제한하지 않는다. 초과 시 429 + 한국어 JSON. */
export function rateLimit({ limit, windowMs = 60_000, now } = {}) {
  if (!limit) return (_req, _res, next) => next();
  const limiter = createRateLimiter({ limit, windowMs, now });
  return (req, res, next) => {
    const r = limiter.check(req.ip || req.socket?.remoteAddress || 'unknown');
    if (r.allowed) return next();
    res.set('Retry-After', String(r.retryAfterSec));
    res.status(429).json({ error: `요청이 너무 많습니다. ${r.retryAfterSec}초 후에 다시 시도해주세요.` });
  };
}
