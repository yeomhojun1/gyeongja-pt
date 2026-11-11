import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, parseRateLimit, rateLimit } from '../rateLimit.js';

// 시간을 주입해 검사하는 순수 함수 테스트 (서버·외부 호출 없음)

test('createRateLimiter: 윈도우 안에서 limit 회까지 허용하고 그 다음부터 거부', () => {
  let t = 1_000;
  const lim = createRateLimiter({ limit: 3, windowMs: 60_000, now: () => t });
  assert.deepEqual([1, 2, 3].map(() => lim.check('1.1.1.1').allowed), [true, true, true]);
  const over = lim.check('1.1.1.1');
  assert.equal(over.allowed, false);
  assert.equal(over.remaining, 0);
  assert.equal(over.retryAfterSec, 60);

  // 다른 IP 는 별도 카운트
  assert.equal(lim.check('2.2.2.2').allowed, true);

  // 윈도우가 지나면 다시 허용
  t += 30_000;
  assert.equal(lim.check('1.1.1.1').retryAfterSec, 30);
  t += 30_000;
  assert.equal(lim.check('1.1.1.1').allowed, true);
});

test('createRateLimiter: 만료된 키는 정리되어 메모리가 계속 늘지 않는다', () => {
  let t = 0;
  const lim = createRateLimiter({ limit: 1, windowMs: 1_000, now: () => t });
  for (let i = 0; i < 100; i++) lim.check(`ip${i}`);
  assert.equal(lim.size(), 100);
  t += 1_000;
  lim.check('new');
  assert.equal(lim.size(), 1);
});

test('parseRateLimit: 정수만 인정, 0 은 끔, 잘못된 값은 기본값', () => {
  assert.equal(parseRateLimit(undefined), 10);
  assert.equal(parseRateLimit(''), 10);
  assert.equal(parseRateLimit('5'), 5);
  assert.equal(parseRateLimit('0'), 0);
  assert.equal(parseRateLimit('-1'), 10);
  assert.equal(parseRateLimit('abc'), 10);
  assert.equal(parseRateLimit('2.5', 7), 7);
});

test('rateLimit 미들웨어: 초과 시 429 + Retry-After + 한국어 JSON, limit 0 이면 통과', () => {
  const mkRes = () => {
    const res = { headers: {}, code: 200, body: null };
    res.set = (k, v) => { res.headers[k] = v; return res; };
    res.status = (c) => { res.code = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    return res;
  };
  const mw = rateLimit({ limit: 2, windowMs: 60_000, now: () => 0 });
  const req = { ip: '9.9.9.9' };
  let passed = 0;
  for (let i = 0; i < 2; i++) mw(req, mkRes(), () => passed++);
  const res = mkRes();
  mw(req, res, () => passed++);
  assert.equal(passed, 2);
  assert.equal(res.code, 429);
  assert.equal(res.headers['Retry-After'], '60');
  assert.match(res.body.error, /요청이 너무 많습니다/);

  const off = rateLimit({ limit: 0 });
  let n = 0;
  for (let i = 0; i < 50; i++) off(req, mkRes(), () => n++);
  assert.equal(n, 50);
});
