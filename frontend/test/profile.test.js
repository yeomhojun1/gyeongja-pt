import test from 'node:test';
import assert from 'node:assert/strict';
import {
  derivePersonas, emptyProfile, isEmptyProfile, profileInputs, sameAsProfile, sanitizeProfile, spendKeyOf, withCalculatorInputs
} from '../src/lib/profile.js';
import { validateIssue } from '../src/lib/issues.js';
import { runTemplate } from '../src/lib/templates.js';

const fuel = { template: 'price_change', vars: { unitPrice: 1857.6, unitLabel: 'L', perUnitChange: -122 } };
const elec = { template: 'price_change', spendKey: 'electricity', vars: { changePct: 5 } };
const rate = { template: 'rate_change', vars: { deltaPctPoint: 0.25 } };
const loan = { principal: 200_000_000, ratePct: 4.1, months: 300, method: 'equalPrincipal' };

test('정리: 이상한 값·범위 밖 값은 비우고, 대출은 세 칸이 다 있어야 남는다', () => {
  const p = sanitizeProfile({
    job: '학생', housing: '월세', monthlyIncome: -1, monthlyHours: 209, savings: '1억',
    loan: { principal: 1e8, ratePct: 4.5 }, spend: { fuel: 150_000, tobacco: 1e12, x: 1 }
  });
  assert.equal(p.job, '');
  assert.equal(p.housing, '월세');
  assert.equal(p.monthlyIncome, null);
  assert.equal(p.monthlyHours, 209);
  assert.equal(p.savings, null);
  assert.equal(p.loan, null);
  assert.equal(p.spend.fuel, 150_000);
  assert.equal(p.spend.tobacco, null);
  assert.equal('x' in p.spend, false);
  assert.deepEqual(sanitizeProfile('망가진 값'), emptyProfile());
});

test('정리: 상환 방식이 이상하면 원리금균등, 기간은 정수 개월만', () => {
  assert.equal(sanitizeProfile({ loan: { ...loan, method: '??' } }).loan.method, 'equalPayment');
  assert.equal(sanitizeProfile({ loan: { ...loan, months: 12.5 } }).loan, null);
});

test('빈 프로필 판정', () => {
  assert.equal(isEmptyProfile(emptyProfile()), true);
  assert.equal(isEmptyProfile(sanitizeProfile({ spend: { gas: 30_000 } })), false);
  assert.equal(isEmptyProfile(sanitizeProfile({ job: '직장인' })), false);
});

test('내 상황 추정: 대출·전월세·예금·직업', () => {
  assert.deepEqual(derivePersonas(sanitizeProfile({ loan, housing: '전세', savings: 1, job: '자영업자' })), ['대출자', '세입자', '예금자', '자영업자']);
  assert.deepEqual(derivePersonas(sanitizeProfile({ housing: '자가', job: '그 외', savings: 0 })), []);
});

test('지출 항목: spendKey 우선, 없으면 리터 단위만 유류비', () => {
  assert.equal(spendKeyOf(fuel), 'fuel');
  assert.equal(spendKeyOf(elec), 'electricity');
  assert.equal(spendKeyOf({ template: 'price_change', vars: { changePct: 3 } }), null);
});

test('자동 채우기: 틀마다 맞는 프로필 값만', () => {
  const p = sanitizeProfile({ loan, monthlyHours: 180, monthlyUsd: 50, spend: { fuel: 200_000 } });
  assert.deepEqual(profileInputs(fuel, p), { monthlySpend: 200_000 });
  assert.deepEqual(profileInputs(elec, p), {});
  assert.deepEqual(profileInputs(rate, p), loan);
  assert.deepEqual(profileInputs({ template: 'wage', vars: {} }, p), { monthlyHours: 180 });
  assert.deepEqual(profileInputs({ template: 'fx', vars: {} }, p), { monthlyUsd: 50 });
  assert.deepEqual(profileInputs({ template: 'subsidy', vars: {} }, p), {});
  assert.deepEqual(profileInputs(rate, emptyProfile()), {});
});

test('자동 채운 값으로 계산하면 프로필 숫자 기준 결과가 나온다', () => {
  const p = sanitizeProfile({ spend: { fuel: 300_000 } });
  const r = runTemplate('price_change', fuel.vars, { monthlySpend: 150_000, ...profileInputs(fuel, p) });
  assert.ok(Math.abs(r.gain - (300_000 / 1857.6) * 122) < 0.01);
});

test('계산기 숫자 저장: 해당 칸만 바꾸고 나머지는 그대로', () => {
  const p = sanitizeProfile({ job: '직장인', spend: { gas: 40_000 } });
  const next = withCalculatorInputs(fuel, { monthlySpend: 120_000 }, p);
  assert.equal(next.spend.fuel, 120_000);
  assert.equal(next.spend.gas, 40_000);
  assert.equal(next.job, '직장인');
  assert.equal(p.spend.fuel, null, '원래 프로필은 바꾸지 않는다');
  assert.deepEqual(withCalculatorInputs(rate, loan, p).loan, loan);
  assert.equal(withCalculatorInputs(fuel, { monthlySpend: NaN }, p), null);
  assert.equal(withCalculatorInputs({ template: 'price_change', vars: { changePct: 1 } }, { monthlySpend: 1 }, p), null);
  assert.equal(withCalculatorInputs({ template: 'subsidy', vars: {} }, { checks: [true] }, p), null);
});

test('저장된 값과 같은지', () => {
  const p = sanitizeProfile({ loan });
  assert.equal(sameAsProfile(rate, { ...loan }, p), true);
  assert.equal(sameAsProfile(rate, { ...loan, ratePct: 4.2 }, p), false);
  assert.equal(sameAsProfile(fuel, { monthlySpend: 1 }, p), false);
});

test('이슈 형식: spendKey 는 가격 변화형에서 정해진 항목만', () => {
  const base = {
    id: 't', status: 'draft', title: 't', shortsTitle: 't', summary: 't', why: 't', publishedAt: '2026-11-11', asOf: '2026-11-11', slot: '아침',
    impacts: { 직장인: 'x' }, sources: [{ org: 'o', title: 't' }]
  };
  const calc = (extra) => ({ ...base, calculator: { template: 'price_change', resultLabel: 'r', vars: { changePct: 5 }, varSources: { changePct: 's' }, ...extra } });
  assert.deepEqual(validateIssue(calc({ spendKey: 'electricity' })), []);
  assert.equal(validateIssue(calc({ spendKey: 'rent' })).length, 1);
  assert.equal(validateIssue({ ...base, calculator: { template: 'rate_change', resultLabel: 'r', vars: { deltaPctPoint: 0.25 }, varSources: { deltaPctPoint: 's' }, spendKey: 'fuel' } }).length, 1);
});
