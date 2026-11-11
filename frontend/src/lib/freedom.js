// 경제적 자유 숫자: 한 달 생활비로 목표 금액을 정하고, 지금 모은 돈·한 달 저축·가정 수익률로 도달 시점을 센다.
// 모든 금액은 "오늘 돈 가치" 기준이다(수익률은 물가 상승을 뺀 실질 수익률로 받는다). 순수 함수라
// 테스트(frontend/test/freedom.test.js)와 화면(pages/Freedom.jsx)이 같이 쓴다. 상품 추천 없이 산수만 한다.

import { josa } from './templates.js';

// 기본 가정값. 화면에서 "가정"으로 표시하고 사용자가 바꿀 수 있다
export const FREEDOM_DEFAULTS = { returnPct: 2, withdrawPct: 4 };
export const STEP = 100_000; // "10만 원 더 모으면" 비교 단위
const MAX_MONTHS = 100 * 12; // 이보다 오래 걸리면 "100년 넘게"

export const FREEDOM_RANGES = {
  monthlyExpense: { min: 1, max: 1_000_000_000 },
  assets: { min: 0, max: 10_000_000_000_000 },
  monthlySaving: { min: 0, max: 1_000_000_000 },
  returnPct: { min: -5, max: 15 },
  withdrawPct: { min: 1, max: 10 }
};
const LABELS = {
  monthlyExpense: '한 달 생활비',
  assets: '지금 모아 둔 돈',
  monthlySaving: '한 달 저축',
  returnPct: '수익률 가정',
  withdrawPct: '인출률 가정'
};

const UNITS = { monthlyExpense: '원', assets: '원', monthlySaving: '원', returnPct: '%', withdrawPct: '%' };

/** 입력 검사. 문제가 있으면 안내 문장, 없으면 null */
export function validateFreedom(inp) {
  for (const [k, r] of Object.entries(FREEDOM_RANGES)) {
    const v = inp[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) return `${josa(LABELS[k], '을', '를')} 숫자로 입력해주세요.`;
    if (v < r.min || v > r.max) return `${josa(LABELS[k], '은', '는')} ${r.min.toLocaleString('ko-KR')}~${r.max.toLocaleString('ko-KR')}${UNITS[k]} 사이로 입력해주세요.`;
  }
  return null;
}

/** 목표 금액 = 1년 생활비 ÷ 인출률. 4%면 1년 생활비의 25배 */
export function targetAmount(monthlyExpense, withdrawPct) {
  return (monthlyExpense * 12 * 100) / withdrawPct;
}

/**
 * 목표까지 걸리는 개월 수. 매달 말 저축을 더하고 월 복리로 불린다.
 * 이미 넘었으면 0, 100년 안에 못 닿으면 null.
 */
export function monthsToTarget({ assets, monthlySaving, target, returnPct }) {
  if (assets >= target) return 0;
  const r = (1 + returnPct / 100) ** (1 / 12) - 1;
  let a = assets;
  for (let m = 1; m <= MAX_MONTHS; m += 1) {
    a = a * (1 + r) + monthlySaving;
    if (a >= target) return m;
  }
  return null;
}

/**
 * 화면 결과 한 번에. extraMonthly 는 내 지갑 장부의 이번 달 영향(매달 ±원)처럼 저축에 더해 볼 금액.
 * whatIf: 저축 +10만, 생활비 −10만(그만큼 저축), 수익률 가정 ±1%p
 */
export function calcFreedom(inp, { extraMonthly = 0 } = {}) {
  const target = targetAmount(inp.monthlyExpense, inp.withdrawPct);
  const run = (o) => monthsToTarget({ ...inp, target, ...o });
  const months = run({});

  const whatIf = [{ key: 'save', label: '저축을 10만 원 늘리면', months: run({ monthlySaving: inp.monthlySaving + STEP }) }];
  if (inp.monthlyExpense > STEP) {
    // 생활비를 줄이면 목표 금액이 줄고, 아낀 돈만큼 저축이 늘어 두 번 효과가 난다
    const t = targetAmount(inp.monthlyExpense - STEP, inp.withdrawPct);
    whatIf.push({
      key: 'spend', label: '생활비를 10만 원 줄여 그만큼 저축하면', target: t,
      months: monthsToTarget({ ...inp, target: t, monthlySaving: inp.monthlySaving + STEP })
    });
  }
  for (const d of [-1, 1]) {
    const returnPct = inp.returnPct + d;
    if (returnPct < FREEDOM_RANGES.returnPct.min || returnPct > FREEDOM_RANGES.returnPct.max) continue;
    whatIf.push({ key: `return${d}`, label: `수익률 가정이 ${returnPct}%면`, months: run({ returnPct }) });
  }

  const extra = Math.round(extraMonthly) !== 0 && inp.monthlySaving + extraMonthly >= 0
    ? { amount: extraMonthly, months: run({ monthlySaving: inp.monthlySaving + extraMonthly }) }
    : null;

  return {
    target,
    months,
    progress: Math.min(1, inp.assets / target),
    runwayMonths: inp.assets / inp.monthlyExpense, // 지금 멈추면 생활비 몇 달치인가(수익 없이)
    whatIf,
    extra
  };
}

/** 프로필에서 계산기 첫 값을 만든다. from 은 다른 칸에서 가져온 값의 출처 표시용 */
export function freedomInputs(p) {
  const from = {};
  let assets = p.assets;
  if (assets === null && p.savings !== null) { assets = p.savings; from.assets = 'savings'; }
  let monthlySaving = p.monthlySaving;
  if (monthlySaving === null && p.monthlyIncome !== null && p.monthlyExpense !== null && p.monthlyIncome >= p.monthlyExpense) {
    monthlySaving = p.monthlyIncome - p.monthlyExpense;
    from.monthlySaving = 'income';
  }
  return {
    inputs: {
      monthlyExpense: p.monthlyExpense,
      assets,
      monthlySaving,
      returnPct: p.returnPct ?? FREEDOM_DEFAULTS.returnPct,
      withdrawPct: p.withdrawPct ?? FREEDOM_DEFAULTS.withdrawPct
    },
    from
  };
}

/** 개월 수 → "3년 4개월" / "지금 이미" / "100년 넘게" */
export function periodText(months) {
  if (months === null) return '100년 넘게';
  if (months === 0) return '지금 이미';
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y && `${y}년`, m && `${m}개월`].filter(Boolean).join(' ');
}

/** 기준 대비 차이 → "1년 2개월 빨라짐" / "3개월 늦어짐" / "그대로" */
export function diffText(base, other) {
  if (base === null && other === null) return '그대로(100년 넘게)';
  if (base === null) return `${periodText(other)} 만에 도달`;
  if (other === null) return '100년 넘게로 늦어짐';
  const d = base - other;
  if (d === 0) return '그대로';
  return `${periodText(Math.abs(d))} ${d > 0 ? '빨라짐' : '늦어짐'}`;
}

/** 오늘에서 개월 수 뒤 → "2029년 3월" */
export function reachMonth(months, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() + months, 1);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

/** 큰 금액을 만 원 단위로 반올림해 "12억 3,456만 원"처럼 */
export function eokText(n) {
  const man = Math.round(n / 10_000);
  if (man === 0) return '0원';
  const eok = Math.floor(man / 10_000);
  const rest = man % 10_000;
  return [eok && `${eok.toLocaleString('ko-KR')}억`, rest && `${rest.toLocaleString('ko-KR')}만`].filter(Boolean).join(' ') + ' 원';
}
