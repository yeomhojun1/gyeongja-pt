import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_QA, findDemoAnswer } from '../src/demo/answers.js';
import { COMPARE_TOPICS, findCompareTopic } from '../src/content/compare.js';

test('데모 예시 질문은 8개이고, 각 질문 문장 그대로 넣으면 자기 답이 나온다', () => {
  assert.equal(DEMO_QA.length, 8);
  for (const qa of DEMO_QA) assert.equal(findDemoAnswer(qa.question), qa.answer, qa.question);
});

test('데모 답변은 모두 ①~④ 순서(한 줄 요약·쉬운 설명·내 지갑 영향·출처)를 지킨다', () => {
  for (const qa of DEMO_QA) {
    const idx = ['① 한 줄 요약', '② 쉬운 설명', '③ 내 지갑 영향', '④ 출처'].map((h) => qa.answer.indexOf(h));
    assert.ok(idx.every((i) => i >= 0), `${qa.question}: 네 항목이 모두 있어야 함`);
    assert.deepEqual([...idx].sort((a, b) => a - b), idx, `${qa.question}: 순서가 맞아야 함`);
  }
});

const cases = [
  ['금리 오르면 대출 이자 얼마나 늘어요', 0],
  ['기준금리 인상하면 내 주담대는', 0],
  ['인플레이션 뜻', 1],
  ['환율이 오르면 뭐가 비싸져?', 2],
  ['전세대출 금리가 오르면?', 3],
  ['전세랑 월세 중에 뭐가 나아', 3],
  ['스태그플레이션이 뭐야', 4],
  ['경기 침체랑 뭐가 달라', 4],
  ['경기침체 오면 어떻게 돼', 4],
  ['국고채가 뭐예요', 5],
  ['최저시급 오르면 좋은 거야?', 6],
  ['예금자 보호 한도 얼마예요', 7],
  ['오늘 날씨 어때', null],
  ['', null],
  ['   ', null]
];

test('키워드가 들어 있으면 질문을 똑같이 쓰지 않아도 맞는 답을 찾는다', () => {
  for (const [q, i] of cases) {
    assert.equal(findDemoAnswer(q), i === null ? null : DEMO_QA[i].answer, `"${q}"`);
  }
});

test('시각 비교 주제는 4개이고, 각 시각은 같은 형식(주장 1·근거 3·지적 1)이다', () => {
  assert.equal(COMPARE_TOPICS.length, 4);
  for (const t of COMPARE_TOPICS) {
    assert.ok(t.views.length >= 2 && t.views.length <= 3, t.title);
    for (const v of t.views) {
      assert.ok(v.claim && v.criticism, `${t.title}/${v.name}`);
      assert.equal(v.reasons.length, 3, `${t.title}/${v.name}: 근거 3개`);
    }
    // 분량이 한쪽으로 치우치지 않게: 시각별 글자 수 차이가 짧은 쪽의 40% 이내
    const lens = t.views.map((v) => (v.claim + v.reasons.join('') + v.criticism).length);
    assert.ok(Math.max(...lens) <= Math.min(...lens) * 1.4, `${t.title}: 분량 차이 ${lens.join('/')}`);
  }
});

test('시각 비교 주제 찾기: 제목·키워드로 찾고, 없으면 null', () => {
  assert.equal(findCompareTopic('최저임금 인상')?.id, 'min-wage');
  assert.equal(findCompareTopic('LTV 규제 강화')?.id, 'housing-regulation');
  assert.equal(findCompareTopic('추경 편성')?.id, 'fiscal-expansion');
  assert.equal(findCompareTopic('기본 소득')?.id, 'basic-income');
  assert.equal(findCompareTopic('법인세 인하'), null);
});
