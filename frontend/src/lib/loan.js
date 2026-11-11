// 대출 상환 계산. AI 를 쓰지 않고 전부 코드로 계산한다(단위 테스트: frontend/test/loan.test.js).
// 금리는 연 이율(%)로 받고 월 이율 = 연 이율 / 12 로 계산한다(국내 은행 일반 방식).
// 반환값은 반올림하지 않은 원 단위 실수다. 화면에 보일 때만 반올림한다(won()).

export const METHODS = {
  equalPayment: '원리금균등',
  equalPrincipal: '원금균등',
  bullet: '만기일시'
};

export const RATE_DELTAS = [-1, -0.5, -0.25, 0, 0.25, 0.5, 1];

/** 입력 검증. 문제가 있으면 한국어 메시지, 없으면 null */
export function validateLoan({ principal, ratePct, months, method }) {
  if (!Number.isFinite(principal) || principal <= 0) return '대출 잔액을 0보다 큰 숫자로 입력해주세요.';
  if (principal > 100_000_000_000) return '대출 잔액이 너무 큽니다. 1,000억 원 이하로 입력해주세요.';
  if (!Number.isFinite(ratePct) || ratePct < 0 || ratePct > 30) return '금리는 0~30% 사이로 입력해주세요.';
  if (!Number.isInteger(months) || months < 1 || months > 600) return '남은 기간은 1~600개월 사이의 정수로 입력해주세요.';
  if (!METHODS[method]) return '상환 방식을 골라주세요.';
  return null;
}

/** 원리금균등: 매달 같은 금액 M = P·r(1+r)^n / ((1+r)^n − 1), 금리 0% 면 P/n */
export function equalPayment(principal, ratePct, months) {
  const r = ratePct / 100 / 12;
  const monthly = r === 0 ? principal / months : (principal * r * (1 + r) ** months) / ((1 + r) ** months - 1);
  return {
    firstPayment: monthly,
    firstInterest: principal * r,
    monthlyPayment: monthly,
    totalInterest: monthly * months - principal
  };
}

/** 원금균등: 원금은 매달 P/n, 이자는 남은 잔액에 붙어 점점 줄어든다. 총이자 = r·P·(n+1)/2 */
export function equalPrincipal(principal, ratePct, months) {
  const r = ratePct / 100 / 12;
  const part = principal / months;
  return {
    firstPayment: part + principal * r,
    firstInterest: principal * r,
    lastPayment: part + part * r,
    totalInterest: (r * principal * (months + 1)) / 2
  };
}

/** 만기일시: 매달 이자만 P·r, 원금은 마지막 달에 한 번에 갚는다 */
export function bullet(principal, ratePct, months) {
  const r = ratePct / 100 / 12;
  const interest = principal * r;
  return {
    firstPayment: interest,
    firstInterest: interest,
    lastPayment: principal + interest,
    totalInterest: interest * months
  };
}

const CALC = { equalPayment, equalPrincipal, bullet };

export function calcLoan({ principal, ratePct, months, method }) {
  return CALC[method](principal, ratePct, months);
}

/**
 * 금리를 deltas(%p)만큼 바꿨을 때의 표. 금리가 0% 아래로 내려가면 0% 로 고정하고 clamped 표시.
 * diff 는 기준 금리(delta 0) 대비 첫 달 납입액·총이자 차이.
 */
export function compareRates({ principal, ratePct, months, method }, deltas = RATE_DELTAS) {
  const base = calcLoan({ principal, ratePct, months, method });
  return deltas.map((delta) => {
    const raw = Math.round((ratePct + delta) * 1000) / 1000; // 0.1 + 0.2 같은 부동소수 오차 제거
    const rate = Math.max(0, raw);
    const r = calcLoan({ principal, ratePct: rate, months, method });
    return {
      delta,
      rate,
      clamped: raw < 0,
      ...r,
      firstPaymentDiff: r.firstPayment - base.firstPayment,
      totalInterestDiff: r.totalInterest - base.totalInterest
    };
  });
}

/** 화면 표시용: 원 단위 반올림 + 천 단위 쉼표 */
export function won(n) {
  // 0% 금리의 총이자처럼 부동소수 오차로 −0.0000001 이 나오면 "-0원"이 되지 않게 0 으로 바꾼다
  return `${(Math.round(n) || 0).toLocaleString('ko-KR')}원`;
}

/** 차이 표시용: +12,345원 / −12,345원 / 0원 */
export function signedWon(n) {
  const v = Math.round(n);
  if (v === 0) return '0원';
  return `${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString('ko-KR')}원`;
}
