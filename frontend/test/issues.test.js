import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { validateIssue, publishedIssues } from '../src/lib/issues.js';
import { runTemplate } from '../src/lib/templates.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../src/content/issues');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

const sample = () => ({
  id: 'test-issue',
  status: 'approved',
  publishedAt: '2026-11-11',
  slot: '아침',
  asOf: '2026-11-01',
  shortsTitle: '쇼츠 제목',
  title: '제목',
  summary: '요약',
  why: '이유',
  impacts: { 직장인: '영향' },
  sources: [{ org: '한국은행', title: '자료' }]
});

test('content/issues 의 모든 이슈 파일이 형식 검사를 통과한다', () => {
  assert.ok(files.length > 0, '이슈 파일이 하나 이상 있어야 함');
  const ids = new Set();
  for (const f of files) {
    const issue = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    assert.deepEqual(validateIssue(issue), [], `${f} 형식 오류`);
    assert.equal(`${issue.id}.json`, f, '파일 이름은 id 와 같아야 함');
    assert.ok(!ids.has(issue.id), `id 중복: ${issue.id}`);
    ids.add(issue.id);
  }
});

test('이슈 파일에 들어 있는 기본 입력값으로 계산하면 오류 없이 결과가 나온다(첫 화면 자동 계산)', () => {
  for (const f of files) {
    const issue = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    if (!issue.calculator) continue;
    const { template, vars, inputs } = issue.calculator;
    const r = runTemplate(template, vars, template === 'subsidy' ? { checks: [], ...inputs } : inputs);
    assert.equal(r.error, undefined, `${f}: ${r.error}`);
    assert.ok(Number.isFinite(r.gain), `${f}: gain 이 숫자가 아님`);
  }
});

test('validateIssue: 필수 항목·형식 오류를 잡는다', () => {
  assert.deepEqual(validateIssue(sample()), []);
  assert.ok(validateIssue({ ...sample(), id: '한글 주소' }).length);
  assert.ok(validateIssue({ ...sample(), status: 'published' }).length);
  assert.ok(validateIssue({ ...sample(), slot: '새벽' }).length);
  assert.ok(validateIssue({ ...sample(), asOf: '2026/11/01' }).length);
  assert.ok(validateIssue({ ...sample(), impacts: {} }).length);
  assert.ok(validateIssue({ ...sample(), impacts: { 학생: '영향' } }).length);
  assert.ok(validateIssue({ ...sample(), sources: [] }).length);
  assert.ok(validateIssue({ ...sample(), sources: [{ org: '한국은행', title: '자료', url: 'http://x' }] }).length);
  assert.ok(validateIssue({ ...sample(), otherViews: [{ title: '한쪽', body: '만' }] }).length, '시각 하나만 싣기 금지');
  assert.ok(validateIssue(null).length);
});

test('validateIssue: 계산기 숫자에는 출처(varSources)가 꼭 있어야 한다', () => {
  const calc = {
    template: 'wage',
    resultLabel: '비교하면',
    vars: { hourlyBefore: 10_000, hourlyAfter: 10_500 },
    varSources: { hourlyBefore: '최저임금위원회' },
    inputs: { monthlyHours: 209 }
  };
  const errs = validateIssue({ ...sample(), calculator: calc });
  assert.ok(errs.some((e) => e.includes('varSources.hourlyAfter')));
  assert.deepEqual(validateIssue({ ...sample(), calculator: { ...calc, varSources: { hourlyBefore: 'a', hourlyAfter: 'b' } } }), []);
  assert.ok(validateIssue({ ...sample(), calculator: { ...calc, template: 'magic' } }).length);
});

test('publishedIssues: 초안은 빼고, 최신 날짜 → 같은 날은 저녁·점심·아침 순', () => {
  const list = [
    { ...sample(), id: 'a', publishedAt: '2026-11-10', slot: '저녁' },
    { ...sample(), id: 'b', publishedAt: '2026-11-11', slot: '아침' },
    { ...sample(), id: 'c', publishedAt: '2026-11-11', slot: '저녁' },
    { ...sample(), id: 'd', publishedAt: '2026-11-11', slot: '점심', status: 'draft' }
  ];
  assert.deepEqual(publishedIssues(list).map((i) => i.id), ['c', 'b', 'a']);
});
