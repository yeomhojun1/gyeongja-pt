import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FREEDOM_DEFAULTS, calcFreedom, diffText, eokText, freedomInputs, monthsToTarget, periodText, reachMonth, targetAmount, validateFreedom
} from '../src/lib/freedom.js';
import { isEmptyProfile, sanitizeProfile } from '../src/lib/profile.js';

const base = { monthlyExpense: 3_000_000, assets: 50_000_000, monthlySaving: 1_000_000, returnPct: 2, withdrawPct: 4 };

test('목표 금액 = 1년 생활비 ÷ 인출률 (4%면 25배)', () => {
  assert.equal(targetAmount(3_000_000, 4), 900_000_000);
  assert.equal(targetAmount(2_500_000, 5), 600_000_000);
});

test('수익률 0%면 단순 나눗셈과 같다', () => {
  // 1억 남음 ÷ 월 100만 = 정확히 100개월
  assert.equal(monthsToTarget({ assets: 0, monthlySaving: 1_000_000, target: 100_000_000, returnPct: 0 }), 100);
  // 100,000,001원이면 한 달 더
  assert.equal(monthsToTarget({ assets: 0, monthlySaving: 1_000_000, target: 100_000_001, returnPct: 0 }), 101);
});

test('수익률이 있으면 닫힌 식(적립식 미래가치)과 같은 달에 닿는다', () => {
  const inp = { assets: 50_000_000, monthlySaving: 1_000_000, target: 900_000_000, returnPct: 2 };
  const n = monthsToTarget(inp);
  const r = 1.02 ** (1 / 12) - 1;
  const fv = (k) => inp.assets * (1 + r) ** k + inp.monthlySaving * (((1 + r) ** k - 1) / r);
  assert.ok(fv(n) >= inp.target && fv(n - 1) < inp.target, `n=${n}`);
});

test('이미 넘었으면 0, 못 닿으면 null', () => {
  assert.equal(monthsToTarget({ assets: 1e9, monthlySaving: 0, target: 9e8, returnPct: 0 }), 0);
  assert.equal(monthsToTarget({ assets: 0, monthlySaving: 0, target: 9e8, returnPct: 2 }), null);
  assert.equal(monthsToTarget({ assets: 1e8, monthlySaving: 0, target: 9e8, returnPct: -1 }), null);
});

test('비교: 저축을 늘리거나 생활비를 줄이면 빨라지고, 생활비 줄이기가 더 크다', () => {
  const r = calcFreedom(base);
  const by = Object.fromEntries(r.whatIf.map((w) => [w.key, w]));
  assert.ok(by.save.months < r.months);
  assert.ok(by.spend.months < by.save.months, '목표도 줄고 저축도 늘어 두 번 효과');
  assert.equal(by.spend.target, 870_000_000);
  assert.ok(by['return-1'].months > r.months && by.return1.months < r.months);
  assert.equal(r.progress, 50_000_000 / 900_000_000);
  assert.equal(r.runwayMonths, 50_000_000 / 3_000_000);
  assert.equal(r.extra, null);
});

test('장부 영향을 저축에 더해 보기: 손해면 늦어지고, 저축이 음수가 되면 계산 안 함', () => {
  const r = calcFreedom(base);
  assert.ok(calcFreedom(base, { extraMonthly: 13_135 }).extra.months <= r.months);
  assert.ok(calcFreedom(base, { extraMonthly: -500_000 }).extra.months > r.months);
  assert.equal(calcFreedom(base, { extraMonthly: -2_000_000 }).extra, null);
  assert.equal(calcFreedom(base, { extraMonthly: 0.3 }).extra, null);
});

test('입력 검사', () => {
  assert.equal(validateFreedom(base), null);
  assert.equal(validateFreedom({ ...base, monthlyExpense: NaN }), '한 달 생활비를 숫자로 입력해주세요.');
  assert.equal(validateFreedom({ ...base, monthlyExpense: 0 }), '한 달 생활비는 1~1,000,000,000원 사이로 입력해주세요.');
  assert.equal(validateFreedom({ ...base, withdrawPct: 0.5 }), '인출률 가정은 1~10% 사이로 입력해주세요.');
  assert.equal(validateFreedom({ ...base, assets: -1 }), '지금 모아 둔 돈은 0~10,000,000,000,000원 사이로 입력해주세요.');
});

test('글자: 기간·차이·도달 달·억 단위', () => {
  assert.equal(periodText(0), '지금 이미');
  assert.equal(periodText(null), '100년 넘게');
  assert.equal(periodText(5), '5개월');
  assert.equal(periodText(24), '2년');
  assert.equal(periodText(40), '3년 4개월');
  assert.equal(diffText(100, 86), '1년 2개월 빨라짐');
  assert.equal(diffText(100, 103), '3개월 늦어짐');
  assert.equal(diffText(100, 100), '그대로');
  assert.equal(diffText(null, 30), '2년 6개월 만에 도달');
  assert.equal(diffText(100, null), '100년 넘게로 늦어짐');
  assert.equal(reachMonth(14, new Date(2026, 10, 11)), '2028년 1월');
  assert.equal(eokText(900_000_000), '9억 원');
  assert.equal(eokText(1_234_567_890), '12억 3,457만 원');
  assert.equal(eokText(87_000_000), '8,700만 원');
});

test('프로필에서 첫 값: 비면 예금 잔액·(실수령 − 생활비)로 채우고, 가정은 기본값', () => {
  const { inputs, from } = freedomInputs(sanitizeProfile({ savings: 30_000_000, monthlyIncome: 2_700_000, monthlyExpense: 2_000_000 }));
  assert.deepEqual(inputs, { monthlyExpense: 2_000_000, assets: 30_000_000, monthlySaving: 700_000, ...FREEDOM_DEFAULTS });
  assert.deepEqual(from, { assets: 'savings', monthlySaving: 'income' });

  const own = freedomInputs(sanitizeProfile({ savings: 1, assets: 5, monthlyIncome: 9, monthlyExpense: 2, monthlySaving: 3, returnPct: 0, withdrawPct: 3.5 }));
  assert.deepEqual(own.inputs, { monthlyExpense: 2, assets: 5, monthlySaving: 3, returnPct: 0, withdrawPct: 3.5 });
  assert.deepEqual(own.from, {});
});

test('프로필 저장 규칙: 범위 밖은 비우고, 가정값만 있으면 빈 지갑', () => {
  const p = sanitizeProfile({ monthlyExpense: 0, assets: 1e8, returnPct: 20, withdrawPct: 4 });
  assert.equal(p.monthlyExpense, null);
  assert.equal(p.assets, 1e8);
  assert.equal(p.returnPct, null);
  assert.equal(p.withdrawPct, 4);
  assert.equal(isEmptyProfile(sanitizeProfile({ returnPct: 3, withdrawPct: 4 })), true);
  assert.equal(isEmptyProfile(sanitizeProfile({ monthlySaving: 0 })), false);
});
