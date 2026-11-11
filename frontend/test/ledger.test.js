import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLedger, missingReason } from '../src/lib/ledger.js';
import { emptyProfile, sanitizeProfile } from '../src/lib/profile.js';

const issue = (id, publishedAt, calculator) => ({ id, publishedAt, title: id, calculator });
const fuel = issue('fuel', '2026-11-11', { template: 'price_change', vars: { unitPrice: 2000, unitLabel: 'L', perUnitChange: -100 } });
const elec = issue('elec', '2026-11-05', { template: 'price_change', spendKey: 'electricity', vars: { changePct: 10 } });
const wage = issue('wage', '2026-10-20', { template: 'wage', vars: { hourlyBefore: 10_000, hourlyAfter: 10_500 } });
const rate = issue('rate', '2026-11-10', { template: 'rate_change', scenario: true, vars: { deltaPctPoint: 0.25 } });
const bonus = issue('bonus', '2026-11-01', { template: 'subsidy', vars: { amount: 100_000, conditions: ['a'], period: 'once' } });
const plain = issue('plain', '2026-11-02', undefined);
const ISSUES = [fuel, rate, elec, plain, bonus, wage];

const p = sanitizeProfile({
  spend: { fuel: 200_000, electricity: 50_000 }, monthlyHours: 100,
  loan: { principal: 120_000_000, ratePct: 4, months: 360, method: 'bullet' }
});

test('달별로 묶고 최신 달부터, 매달 합계', () => {
  const { months } = buildLedger(ISSUES, p);
  assert.deepEqual(months.map((m) => m.month), ['2026-11']);
  assert.deepEqual(months[0].entries.map((e) => e.issue.id), ['fuel', 'elec']);
  // 유류비 20만 ÷ 2,000원 × 100원 = +10,000, 전기요금 5만 × 10% 인상 = −5,000
  assert.equal(Math.round(months[0].totals.month), 5_000);
  assert.equal(months.length, 1, '최저임금(소득 변화형)은 근로시간이 있어도 장부 합계에 넣지 않는다');
});

test('가정 계산(scenario)은 합계에 넣지 않고 따로', () => {
  const { months, scenarios } = buildLedger(ISSUES, p);
  assert.deepEqual(scenarios.map((e) => e.issue.id), ['rate']);
  // 1.2억 만기일시 0.25%p → 월 이자 25,000원 증가
  assert.equal(Math.round(scenarios[0].gain), -25_000);
  assert.ok(months.every((m) => m.entries.every((e) => e.issue.id !== 'rate')));
});

test('내 숫자가 없으면 예시값으로 계산하지 않고 필요한 항목을 알려 준다', () => {
  const { months, scenarios, missing } = buildLedger(ISSUES, sanitizeProfile({ spend: { fuel: 100_000 } }));
  assert.deepEqual(months[0].entries.map((e) => e.issue.id), ['fuel']);
  assert.equal(scenarios.length, 0);
  assert.deepEqual(missing.map((x) => [x.issue.id, x.need]), [
    ['rate', '대출(잔액·금리·남은 기간)'], ['elec', '한 달 전기요금'], ['bonus', null], ['wage', null]
  ]);
});

test('계산기 없는 이슈는 장부에 안 나오고, 빈 프로필이면 전부 missing', () => {
  const r = buildLedger(ISSUES, emptyProfile());
  assert.equal(r.months.length, 0);
  assert.equal(r.missing.length, 5);
  assert.ok(!r.missing.some((x) => x.issue.id === 'plain'));
});

test('지출 항목을 모르는 가격 변화형은 이슈에서 직접 계산', () => {
  assert.equal(missingReason({ template: 'price_change', vars: { changePct: 3 } }), null);
  assert.equal(missingReason({ template: 'fx', vars: {} }), '한 달 해외 결제');
  assert.equal(missingReason({ template: 'wage', vars: {} }), null);
});
