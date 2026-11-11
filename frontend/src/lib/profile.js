// 내 지갑 프로필: 한 번 넣어 두면 이슈 계산기·대출 계산기에 내 숫자가 자동으로 들어간다.
// 이 기기 브라우저(localStorage)에만 저장하고 서버로 보내지 않는다. 순수 함수라 테스트(frontend/test/profile.test.js)와
// 화면(lib/useProfile.js)이 같이 쓴다.

import { METHODS } from './loan.js';
import { FREEDOM_RANGES } from './freedom.js';

export const PROFILE_KEY = 'gyeongjapt.profile';

export const JOBS = ['직장인', '자영업자', '그 외'];
export const HOUSINGS = ['자가', '전세', '월세', '그 외'];

// 한 달 지출 항목. 가격 변화형 이슈는 calculator.spendKey 로 이 중 하나를 가리킨다
export const SPEND_KEYS = {
  fuel: '유류비',
  electricity: '전기요금',
  gas: '도시가스',
  transit: '대중교통',
  tobacco: '담배'
};

// 숫자 칸 규칙. 범위를 벗어난 값은 저장하지 않는다(브라우저 저장소가 손상돼도 화면이 안 깨지게)
const NUMBER_FIELDS = {
  monthlyIncome: { min: 0, max: 1_000_000_000 },
  monthlyHours: { min: 0, max: 400 },
  monthlyUsd: { min: 0, max: 10_000_000 },
  savings: { min: 0, max: 100_000_000_000 },
  // 경제적 자유 숫자(lib/freedom.js)
  monthlyExpense: FREEDOM_RANGES.monthlyExpense,
  assets: FREEDOM_RANGES.assets,
  monthlySaving: FREEDOM_RANGES.monthlySaving
};
// 가정값은 비워 두면 기본값을 쓴다. 가정만 바꾼 상태는 "빈 지갑"으로 본다
const ASSUMPTION_FIELDS = {
  returnPct: FREEDOM_RANGES.returnPct,
  withdrawPct: FREEDOM_RANGES.withdrawPct
};
const LOAN_FIELDS = {
  principal: { min: 1, max: 100_000_000_000 },
  ratePct: { min: 0, max: 30 },
  months: { min: 1, max: 600, integer: true }
};
const SPEND_RANGE = { min: 0, max: 100_000_000 };

const inRange = (v, r) => typeof v === 'number' && Number.isFinite(v) && v >= r.min && v <= r.max && (!r.integer || Number.isInteger(v));
const pick = (v, r) => (inRange(v, r) ? v : null);

export function emptyProfile() {
  return {
    job: '',
    housing: '',
    monthlyIncome: null,
    monthlyHours: null,
    monthlyUsd: null,
    savings: null,
    monthlyExpense: null,
    assets: null,
    monthlySaving: null,
    returnPct: null,
    withdrawPct: null,
    loan: null,
    spend: Object.fromEntries(Object.keys(SPEND_KEYS).map((k) => [k, null]))
  };
}

/** 저장소에서 읽은 값이나 화면 입력을 규칙에 맞게 정리한다. 이상한 값은 비운다. */
export function sanitizeProfile(raw) {
  const p = emptyProfile();
  if (!raw || typeof raw !== 'object') return p;
  if (JOBS.includes(raw.job)) p.job = raw.job;
  if (HOUSINGS.includes(raw.housing)) p.housing = raw.housing;
  for (const [k, r] of Object.entries({ ...NUMBER_FIELDS, ...ASSUMPTION_FIELDS })) p[k] = pick(raw[k], r);
  const l = raw.loan;
  if (l && typeof l === 'object') {
    const loan = Object.fromEntries(Object.entries(LOAN_FIELDS).map(([k, r]) => [k, pick(l[k], r)]));
    loan.method = METHODS[l.method] ? l.method : 'equalPayment';
    // 잔액·금리·기간이 다 있어야 계산에 쓸 수 있다
    p.loan = loan.principal !== null && loan.ratePct !== null && loan.months !== null ? loan : null;
  }
  if (raw.spend && typeof raw.spend === 'object') {
    for (const k of Object.keys(SPEND_KEYS)) p.spend[k] = pick(raw.spend[k], SPEND_RANGE);
  }
  return p;
}

/** 아무것도 안 넣은 프로필인가 */
export function isEmptyProfile(p) {
  return !p.job && !p.housing && !p.loan
    && Object.keys(NUMBER_FIELDS).every((k) => p[k] === null)
    && Object.values(p.spend).every((v) => v === null);
}

/** 프로필로 "내 상황"(이슈 페이지의 대출자·세입자 등)을 추정한다 */
export function derivePersonas(p) {
  const out = [];
  if (p.loan) out.push('대출자');
  if (p.housing === '전세' || p.housing === '월세') out.push('세입자');
  if (p.savings > 0) out.push('예금자');
  if (p.job === '직장인' || p.job === '자영업자') out.push(p.job);
  return out;
}

/** 가격 변화형 이슈가 어떤 지출 항목을 쓰는지. spendKey 가 없으면 리터 단위는 유류비로 본다 */
export function spendKeyOf(calculator) {
  if (SPEND_KEYS[calculator.spendKey]) return calculator.spendKey;
  if (calculator.vars?.unitLabel === 'L') return 'fuel';
  return null;
}

/**
 * 이슈 계산기 입력 중 프로필에서 채울 수 있는 값.
 * 돌려주는 객체의 키 = 계산 틀 입력 키(monthlySpend, principal …). 채울 게 없으면 빈 객체.
 */
export function profileInputs(calculator, p) {
  switch (calculator.template) {
    case 'price_change': {
      const k = spendKeyOf(calculator);
      return k && p.spend[k] !== null ? { monthlySpend: p.spend[k] } : {};
    }
    case 'rate_change':
      return p.loan ? { ...p.loan } : {};
    case 'wage':
      return p.monthlyHours !== null ? { monthlyHours: p.monthlyHours } : {};
    case 'fx':
      return p.monthlyUsd !== null ? { monthlyUsd: p.monthlyUsd } : {};
    default:
      return {};
  }
}

/** 이슈 계산기에 넣은 내 숫자를 프로필에 반영한 새 프로필. 저장할 게 없으면 null */
export function withCalculatorInputs(calculator, inp, p) {
  const next = sanitizeProfile(p);
  switch (calculator.template) {
    case 'price_change': {
      const k = spendKeyOf(calculator);
      if (!k || !inRange(inp.monthlySpend, SPEND_RANGE)) return null;
      next.spend[k] = inp.monthlySpend;
      return next;
    }
    case 'rate_change': {
      const loan = sanitizeProfile({ loan: inp }).loan;
      if (!loan) return null;
      next.loan = loan;
      return next;
    }
    case 'wage':
      if (!inRange(inp.monthlyHours, NUMBER_FIELDS.monthlyHours)) return null;
      next.monthlyHours = inp.monthlyHours;
      return next;
    case 'fx':
      if (!inRange(inp.monthlyUsd, NUMBER_FIELDS.monthlyUsd)) return null;
      next.monthlyUsd = inp.monthlyUsd;
      return next;
    default:
      return null;
  }
}

/** 이 계산기의 내 숫자가 프로필에 이미 같은 값으로 저장돼 있는가 */
export function sameAsProfile(calculator, inp, p) {
  const saved = profileInputs(calculator, p);
  const keys = Object.keys(saved);
  return keys.length > 0 && keys.every((k) => saved[k] === inp[k]);
}
