import test from 'node:test';
import assert from 'node:assert/strict';
import {
  equalPayment, equalPrincipal, bullet, calcLoan, compareRates, validateLoan, won, signedWon, RATE_DELTAS
} from '../src/lib/loan.js';

const near = (actual, expected, eps = 0.01) =>
  assert.ok(Math.abs(actual - expected) <= eps, `${actual} 는 ${expected} 와 ${eps} 이내여야 함`);

test('원리금균등: 1억·연 5%·30년 → 월 536,821.62원 (표준 상환표 값)', () => {
  const r = equalPayment(100_000_000, 5, 360);
  near(r.monthlyPayment, 536_821.62);
  near(r.totalInterest, 536_821.623 * 360 - 100_000_000, 1);
  near(r.firstInterest, 416_666.67);
});

test('원리금균등: 1,200만·연 6%·12개월 → 월 1,032,797.16원', () => {
  // r=0.005, M = P·r(1+r)^n/((1+r)^n−1) 손계산
  near(equalPayment(12_000_000, 6, 12).monthlyPayment, 1_032_797.16);
});

test('원리금균등: 금리 0% 면 원금 ÷ 개월, 총이자 0', () => {
  const r = equalPayment(12_000_000, 0, 12);
  assert.equal(r.monthlyPayment, 1_000_000);
  assert.equal(r.totalInterest, 0);
});

test('원금균등: 1,200만·연 6%·12개월 → 첫 달 1,060,000원, 마지막 달 1,005,000원, 총이자 390,000원', () => {
  const r = equalPrincipal(12_000_000, 6, 12);
  near(r.firstPayment, 1_060_000);
  near(r.firstInterest, 60_000);
  near(r.lastPayment, 1_005_000);
  near(r.totalInterest, 390_000);
});

test('원금균등: 총이자 공식이 매달 이자를 직접 더한 값과 같다', () => {
  const P = 50_000_000, rate = 4.2, n = 120, r = rate / 100 / 12;
  let sum = 0;
  for (let k = 0; k < n; k++) sum += (P - (P / n) * k) * r;
  near(equalPrincipal(P, rate, n).totalInterest, sum, 0.001);
});

test('원리금균등: 매달 같은 금액을 내면 잔액이 정확히 0이 된다', () => {
  const P = 30_000_000, rate = 3.9, n = 60, r = rate / 100 / 12;
  const M = equalPayment(P, rate, n).monthlyPayment;
  let bal = P;
  for (let k = 0; k < n; k++) bal = bal * (1 + r) - M;
  near(bal, 0, 0.001);
});

test('만기일시: 1억·연 4% → 매달 이자 333,333.33원, 마지막 달 원금 포함, 1년 총이자 400만 원', () => {
  const r = bullet(100_000_000, 4, 12);
  near(r.firstPayment, 333_333.33);
  near(r.lastPayment, 100_333_333.33);
  near(r.totalInterest, 4_000_000);
});

test('calcLoan 은 방식 이름으로 세 공식을 고른다', () => {
  const args = { principal: 10_000_000, ratePct: 5, months: 24 };
  assert.deepEqual(calcLoan({ ...args, method: 'equalPayment' }), equalPayment(10_000_000, 5, 24));
  assert.deepEqual(calcLoan({ ...args, method: 'equalPrincipal' }), equalPrincipal(10_000_000, 5, 24));
  assert.deepEqual(calcLoan({ ...args, method: 'bullet' }), bullet(10_000_000, 5, 24));
});

test('compareRates: ±0.25·0.5·1%p 7행, 기준 행 차이 0, 금리가 오르면 납입액·총이자 증가', () => {
  const rows = compareRates({ principal: 100_000_000, ratePct: 4.5, months: 360, method: 'equalPayment' });
  assert.deepEqual(rows.map((r) => r.delta), RATE_DELTAS);
  assert.deepEqual(rows.map((r) => r.rate), [3.5, 4, 4.25, 4.5, 4.75, 5, 5.5]);
  const base = rows.find((r) => r.delta === 0);
  assert.equal(base.firstPaymentDiff, 0);
  assert.equal(base.totalInterestDiff, 0);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].firstPayment > rows[i - 1].firstPayment);
  // 4.5% → 4.75%: 월 약 14,962원 증가 (데모 답변에 쓴 값)
  near(rows[4].firstPaymentDiff, 14_962.03);
});

test('compareRates: 금리가 0% 아래로 내려가면 0% 로 고정하고 clamped 표시', () => {
  const rows = compareRates({ principal: 10_000_000, ratePct: 0.3, months: 12, method: 'bullet' });
  const minus1 = rows.find((r) => r.delta === -1);
  assert.equal(minus1.rate, 0);
  assert.equal(minus1.clamped, true);
  assert.equal(minus1.firstPayment, 0);
  assert.equal(rows.find((r) => r.delta === -0.25).clamped, false);
  near(rows.find((r) => r.delta === -0.25).rate, 0.05, 1e-9);
});

test('validateLoan: 잘못된 입력은 한국어 메시지, 올바른 입력은 null', () => {
  const ok = { principal: 1_000_000, ratePct: 4, months: 12, method: 'bullet' };
  assert.equal(validateLoan(ok), null);
  assert.match(validateLoan({ ...ok, principal: 0 }), /대출 잔액/);
  assert.match(validateLoan({ ...ok, principal: NaN }), /대출 잔액/);
  assert.match(validateLoan({ ...ok, ratePct: -1 }), /금리/);
  assert.match(validateLoan({ ...ok, ratePct: 31 }), /금리/);
  assert.match(validateLoan({ ...ok, months: 0 }), /기간/);
  assert.match(validateLoan({ ...ok, months: 12.5 }), /기간/);
  assert.match(validateLoan({ ...ok, months: 601 }), /기간/);
  assert.match(validateLoan({ ...ok, method: 'x' }), /상환 방식/);
});

test('won·signedWon: 원 단위 반올림과 부호', () => {
  assert.equal(won(536_821.62), '536,822원');
  assert.equal(won(-1e-9), '0원', '부동소수 오차로 -0원이 나오면 안 됨(화면 확인 중 발견)');
  assert.equal(signedWon(14_962.03), '+14,962원');
  assert.equal(signedWon(-9_851.4), '−9,851원');
  assert.equal(signedWon(0.4), '0원');
});
