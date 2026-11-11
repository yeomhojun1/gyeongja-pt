// Gemini REST/네트워크 오류를 사용자용 한국어 메시지로 변환한다.
// 영문 원문(예: "API key not valid. Please pass a valid API key.")이 그대로 노출되지 않도록 한다.
// 외부 호출 없이 순수 함수라 단위 테스트가 가능하다.

/**
 * @param {unknown} e 잡힌 예외. server.js geminiGenerate 가 던지는 오류는
 *   status(HTTP 상태), code(Gemini error.status 예: RESOURCE_EXHAUSTED), noKey(키 미설정)를 가진다.
 * @param {boolean} hasKey GEMINI_API_KEY 설정 여부
 * @returns {{status: number, error: string}}
 */
export function mapLlmError(e, hasKey) {
  const raw = String(e?.message || '');
  const status = e?.status;
  const code = String(e?.code || '');
  const name = String(e?.name || '');
  const cause = String(e?.cause?.code || '');

  // 키 없음·키 오류·권한 없음: 사용자가 고칠 수 없는 설정 문제라 같은 안내 (Gemini 는 잘못된 키에 400 을 준다)
  if (!hasKey || e?.noKey || status === 401 || status === 403 || code === 'PERMISSION_DENIED' || code === 'UNAUTHENTICATED'
    || /api[\s_]?key|apikey|authentication/i.test(raw)) {
    return { status: 503, error: 'AI 기능이 설정되지 않았습니다. 관리자에게 문의하세요.' };
  }
  if (status === 429 || code === 'RESOURCE_EXHAUSTED' || /rate.?limit|quota/i.test(raw)) {
    return { status: 429, error: '요청이 많아 잠시 처리할 수 없습니다. 잠시 후 다시 시도해주세요.' };
  }
  // FAILED_PRECONDITION(예: 지역 미지원)은 입력 문제가 아니므로 제외
  if (status === 400 && code !== 'FAILED_PRECONDITION') {
    return { status: 400, error: '입력 내용을 AI가 처리할 수 없습니다. 내용을 줄이거나 바꿔서 다시 시도해주세요.' };
  }
  if (status === 504 || code === 'DEADLINE_EXCEEDED' || name === 'TimeoutError' || name === 'AbortError'
    || /timeout|abort|ECONNRESET|ENOTFOUND|ECONNREFUSED|fetch failed/i.test(raw) || /^E[A-Z]+/.test(cause)) {
    return { status: 504, error: 'AI 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.' };
  }
  return { status: 502, error: 'AI 응답 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' };
}

/** 본문 파싱 계열 오류를 JSON 응답으로 변환. 해당 없으면 null. */
export function mapBodyError(err) {
  if (err?.type === 'entity.too.large') {
    return { status: 413, error: '요청 본문이 너무 큽니다. 내용을 줄여서 다시 시도해주세요.' };
  }
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return { status: 400, error: '잘못된 JSON 형식입니다. 요청 본문을 확인해주세요.' };
  }
  return null;
}
