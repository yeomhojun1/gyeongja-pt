import test from 'node:test';
import assert from 'node:assert/strict';
import { mapLlmError, mapBodyError } from '../errors.js';

// 외부 호출이 전혀 없는 순수 함수 테스트 (API 키 불필요, 과금 없음)

// server.js geminiGenerate 가 던지는 것과 같은 모양의 오류
const gemErr = (message, status, code) => Object.assign(new Error(message), { status, code });

test('mapLlmError: 키 없음·잘못된 키·권한 없음은 503 + 한국어 안내, 영문 원문·환경변수명은 노출하지 않는다', () => {
  const noKey = Object.assign(new Error('GEMINI_API_KEY missing'), { noKey: true });
  const r = mapLlmError(noKey, false);
  assert.equal(r.status, 503);
  assert.equal(r.error, 'AI 기능이 설정되지 않았습니다. 관리자에게 문의하세요.');
  assert.doesNotMatch(r.error, /GEMINI_API_KEY|api key/i);

  // 키가 있어도 Gemini 가 키를 거부하면(400 INVALID_ARGUMENT "API key not valid") 같은 처리
  const badKey = gemErr('API key not valid. Please pass a valid API key.', 400, 'INVALID_ARGUMENT');
  assert.equal(mapLlmError(badKey, true).status, 503);
  assert.equal(mapLlmError(gemErr('Permission denied', 403, 'PERMISSION_DENIED'), true).status, 503);
  assert.equal(mapLlmError(gemErr('x', 401), true).status, 503);
});

test('mapLlmError: Gemini 상태별 분기 (429 / 400 / 타임아웃·네트워크 / 기타)', () => {
  assert.equal(mapLlmError(gemErr('Resource has been exhausted (e.g. check quota).', 429, 'RESOURCE_EXHAUSTED'), true).status, 429);
  assert.equal(mapLlmError(gemErr('Request contains an invalid argument.', 400, 'INVALID_ARGUMENT'), true).status, 400);
  // 지역 미지원 등 FAILED_PRECONDITION 은 입력 문제가 아니므로 400 이 아니라 502
  assert.equal(mapLlmError(gemErr('User location is not supported for the API use.', 400, 'FAILED_PRECONDITION'), true).status, 502);
  // AbortSignal.timeout 이 던지는 오류
  const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
  assert.equal(mapLlmError(timeout, true).status, 504);
  assert.equal(mapLlmError(gemErr('Deadline expired', 504, 'DEADLINE_EXCEEDED'), true).status, 504);
  // Node fetch 네트워크 오류: TypeError('fetch failed') + cause.code
  const net = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
  assert.equal(mapLlmError(net, true).status, 504);
  assert.equal(mapLlmError(gemErr('The model is overloaded.', 503, 'UNAVAILABLE'), true).status, 502);
  assert.equal(mapLlmError(gemErr('Gemini empty response', 502), true).status, 502);
  assert.equal(mapLlmError(gemErr('boom', 500, 'INTERNAL'), true).status, 502);
});

test('mapLlmError: 모든 메시지가 한국어이며 원문 문자열을 포함하지 않는다', () => {
  const cases = [
    [Object.assign(new Error('GEMINI_API_KEY missing'), { noKey: true }), false],
    [gemErr('The model is overloaded.', 503, 'UNAVAILABLE'), true],
    [gemErr('Resource has been exhausted', 429, 'RESOURCE_EXHAUSTED'), true],
    [undefined, true],
    [null, true]
  ];
  for (const [e, hasKey] of cases) {
    const r = mapLlmError(e, hasKey);
    assert.ok(/[가-힣]/.test(r.error), '한국어 메시지여야 함');
    assert.ok(r.status >= 400 && r.status < 600);
    if (e?.message) assert.ok(!r.error.includes(e.message), '원문 노출 금지');
  }
});

test('mapBodyError: 과대 본문 413, 잘못된 JSON 400, 그 외는 null (버그 6)', () => {
  assert.deepEqual(mapBodyError({ type: 'entity.too.large' }), {
    status: 413, error: '요청 본문이 너무 큽니다. 내용을 줄여서 다시 시도해주세요.'
  });
  assert.equal(mapBodyError({ type: 'entity.parse.failed' }).status, 400);
  assert.equal(mapBodyError(new SyntaxError('Unexpected token b in JSON')).status, 400);
  assert.equal(mapBodyError(new Error('그 밖의 오류')), null);
  assert.equal(mapBodyError(undefined), null);
});
