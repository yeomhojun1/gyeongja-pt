import test from 'node:test';
import assert from 'node:assert/strict';
import { checkInvestAdvice, INVEST_REFUSAL } from '../../shared/investFilter.js';

const blocked = [
  '삼성전자 주식 지금 사야 하나요?',
  '비트코인 지금 들어가도 될까요',
  '이더리움 팔까요 말까요',
  '강남 아파트 지금 사도 돼?',
  '내년에 집값 오를까요?',
  '코스피 얼마까지 갈까요',
  '테슬라 목표가 알려줘',
  '요즘 종목 추천 좀',
  '추천종목 있어요?',
  '천만 원 있으면 어디에 투자해야 해?',
  'ETF 매수 타이밍 알려줘',
  '청약 넣을까 말까 분양권 사면 돈 돼?',
  '코인 물타기 해야 할까',
  '달러 지금 사두는 게 좋아? 사야 해?',
  '삼성전자 지금 사야 해?',
  'LG전자 팔까?',
  '반도체주 지금 들어가도 돼?',
  '셀트리온 같은 바이오 제약 매수할까'
];

const allowed = [
  '주식이 뭐예요?',
  '금리가 오르면 주가는 왜 떨어지나요?',
  'PER은 무슨 뜻인가요?',
  '기준금리가 오르면 내 대출은?',
  '인플레이션이 뭔가요?',
  '환율 오르면 뭐가 비싸지나요?',
  '전세와 월세 중 금리 영향을 더 받는 건?',
  '국채는 뭔가요?',
  '예금자보호 한도는?',
  '최저임금 인상, 찬반 근거는?',
  '금리 오를까요?',
  '전세가율이 높다는 건 무슨 의미인가요?',
  '반도체 수출이 늘면 경제에 뭐가 좋아요?',
  '네이버 뉴스에서 봤는데 스태그플레이션이 뭐예요?',
  '이번 주 금리 결정 언제예요?',
  '매수와 매도가 뭐예요?',
  '손절이라는 말은 무슨 뜻이에요?',
  ''
];

test('투자 권유성 질문(매수·매도 판단, 목표가, 가격 예측, 종목 추천)은 거른다', () => {
  for (const q of blocked) assert.equal(checkInvestAdvice(q).blocked, true, `"${q}" 는 걸러야 함`);
});

test('개념 질문은 통과시킨다(과잉 차단 방지)', () => {
  for (const q of allowed) assert.equal(checkInvestAdvice(q).blocked, false, `"${q}" 는 통과해야 함`);
});

test('문자열이 아닌 값도 예외 없이 처리한다', () => {
  for (const v of [null, undefined, 123, {}, []]) assert.equal(checkInvestAdvice(v).blocked, false);
});

test('거절 안내는 판단을 거절하고 개념 질문 예시를 준다', () => {
  assert.match(INVEST_REFUSAL, /드릴 수 없습니다/);
  assert.match(INVEST_REFUSAL, /개념/);
});
