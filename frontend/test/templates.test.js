import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, runTemplate, validateInputs } from '../src/lib/templates.js';
import { equalPayment } from '../src/lib/loan.js';

const near = (actual, expected, eps = 0.01) =>
  assert.ok(Math.abs(actual - expected) <= eps, `${actual} 는 ${expected} 와 ${eps} 이내여야 함`);

test('가격 변화형(단위): 월 15만 원·리터당 1,857.6원·122원 인하 → 매달 약 9,851원 이득', () => {
  const r = runTemplate('price_change', { unitPrice: 1857.6, perUnitChange: -122, passThroughPct: 100 }, { monthlySpend: 150_000 });
  near(r.gain, (150_000 / 1857.6) * 122);
  near(r.gain, 9_851.4, 0.1);
  near(r.yearly, r.gain * 12);
  assert.equal(r.period, 'month');
});

test('가격 변화형: 반영률 50% 면 효과도 절반, 값이 오르면(양수) 손해', () => {
  const half = runTemplate('price_change', { unitPrice: 1000, perUnitChange: -100, passThroughPct: 50 }, { monthlySpend: 100_000 });
  near(half.gain, 5_000);
  const up = runTemplate('price_change', { unitPrice: 1000, perUnitChange: 100 }, { monthlySpend: 100_000 });
  near(up.gain, -10_000);
});

test('가격 변화형(비율): 전기요금 5% 인상, 월 6만 원 → 매달 3,000원 손해', () => {
  near(runTemplate('price_change', { changePct: 5 }, { monthlySpend: 60_000 }).gain, -3_000);
});

test('금리 변화형: 1억·4.5%·30년 원리금균등에 +0.25%p → 첫 달 약 14,962원 손해', () => {
  const inp = { principal: 100_000_000, ratePct: 4.5, months: 360, method: 'equalPayment' };
  const r = runTemplate('rate_change', { deltaPctPoint: 0.25 }, inp);
  const expected = equalPayment(100_000_000, 4.75, 360).monthlyPayment - equalPayment(100_000_000, 4.5, 360).monthlyPayment;
  near(r.gain, -expected);
  near(r.gain, -14_962.03);
  assert.ok(r.totalGain < 0);
});

test('금리 변화형: 반영률 0% 면 변화 없음, 인하는 이득, 0% 아래로는 안 내려감', () => {
  const inp = { principal: 10_000_000, ratePct: 0.1, months: 12, method: 'bullet' };
  near(runTemplate('rate_change', { deltaPctPoint: 0.25, passThroughPct: 0 }, inp).gain, 0);
  const cut = runTemplate('rate_change', { deltaPctPoint: -0.25 }, inp);
  near(cut.gain, 10_000_000 * 0.001 / 12); // 0.1% → 0% 로 고정, 이자 전부 사라짐
});

test('소득 변화형: 10,320원 → 10,700원, 209시간 → 매달 79,420원 이득', () => {
  const r = runTemplate('wage', { hourlyBefore: 10_320, hourlyAfter: 10_700 }, { monthlyHours: 209 });
  assert.equal(r.gain, 79_420);
  assert.equal(r.yearly, 953_040);
});

test('환율형: 월 300달러, 1,350원 → 1,400원 → 매달 15,000원 손해', () => {
  near(runTemplate('fx', { rateBefore: 1350, rateAfter: 1400 }, { monthlyUsd: 300 }).gain, -15_000);
});

test('지원금형: 조건을 모두 체크해야 지급, 일회성은 연간 환산 없음', () => {
  const vars = { amount: 500_000, conditions: ['만 19~34세', '무주택'], period: 'once' };
  const no = runTemplate('subsidy', vars, { checks: [true, false] });
  assert.equal(no.gain, 0);
  assert.equal(no.eligible, false);
  const yes = runTemplate('subsidy', vars, { checks: [true, true] });
  assert.equal(yes.gain, 500_000);
  assert.equal(yes.period, 'once');
  assert.equal(yes.yearly, null);
});

test('입력 검증: 숫자 아님·범위 밖·정수 아님·방식 없음은 계산하지 않고 한국어 오류', () => {
  assert.match(runTemplate('price_change', { changePct: 5 }, { monthlySpend: NaN }).error, /숫자/);
  assert.match(runTemplate('price_change', { changePct: 5 }, { monthlySpend: -1 }).error, /사이/);
  const loan = { principal: 1_000_000, ratePct: 4, months: 12.5, method: 'bullet' };
  assert.match(validateInputs('rate_change', loan), /정수/);
  assert.match(validateInputs('rate_change', { ...loan, months: 12, method: 'nope' }), /골라/);
  assert.match(validateInputs('nope', {}), /계산 틀/);
});

test('틀마다 vars 검사가 빠진 값을 잡아낸다', () => {
  assert.ok(TEMPLATES.price_change.checkVars({}));
  assert.ok(TEMPLATES.price_change.checkVars({ perUnitChange: -1 }));
  assert.equal(TEMPLATES.price_change.checkVars({ changePct: 3 }), null);
  assert.ok(TEMPLATES.price_change.checkVars({ changePct: 3, passThroughPct: 120 }));
  assert.ok(TEMPLATES.rate_change.checkVars({ deltaPctPoint: '0.25' }));
  assert.ok(TEMPLATES.wage.checkVars({ hourlyBefore: 0, hourlyAfter: 10 }));
  assert.ok(TEMPLATES.fx.checkVars({ rateBefore: 1300 }));
  assert.ok(TEMPLATES.subsidy.checkVars({ amount: 1, conditions: [] }));
  assert.ok(TEMPLATES.subsidy.checkVars({ amount: 1, conditions: ['a'], period: 'week' }));
});
