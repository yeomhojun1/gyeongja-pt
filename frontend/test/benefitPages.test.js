import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSnapshot } from '../src/lib/benefits.js';
import { ageText, buildDetails, buildPages, conditionRows, esc, isSafeId, isSafeName, paragraphs, toDate } from '../scripts/benefit-pages.mjs';
import { syncBenefits } from '../scripts/sync-benefits.mjs';

// 테스트용 가짜 서비스(실제 정부24 서비스 아님)
const LIST = [
  { 서비스ID: 'A1', 서비스명: '청년 월세 지원', 소관기관명: '국토교통부', 서비스분야: '주거·자립', 지원유형: '현금', 조회수: 900,
    서비스목적요약: '청년 주거비 부담을 덜어 줌', 지원내용: '○ 월 최대 20만 원\n- 12개월', 지원대상: '만 19~34세 무주택 청년',
    선정기준: '중위소득 60% 이하', 신청방법: '온라인 신청', 신청기한: '상시', 접수기관: '주민센터', 전화문의: '1599-0001', 수정일시: '20261101093000',
    상세조회URL: 'https://www.gov.kr/portal/rcvfvrSvc/dtlEx/A1' },
  { 서비스ID: 'B2', 서비스명: '<script>alert(1)</script> 출산 지원', 소관기관명: '서울특별시 종로구', 서비스분야: '임신·출산', 조회수: 50 },
  { 서비스ID: 'C3', 서비스명: '서울 공통 지원', 소관기관명: '서울특별시', 서비스분야: '생활안정', 조회수: 70 },
  { 서비스ID: '../x', 서비스명: '이상한 ID', 소관기관명: '가부', 서비스분야: '생활안정' },
  { 서비스ID: 'D4', 서비스명: '전국 생활 지원', 소관기관명: '보건복지부', 서비스분야: '주거·자립', 조회수: 10 }
];
const CONDS = [{ 서비스ID: 'A1', JA0110: 19, JA0111: 34, JA0412: 'Y', JA0404: 'Y' }];
// 지역 판정은 데이터에 10개 이상 나온 시·도만 쓰므로 기준을 맞추려고 서울 서비스를 채운다
const FILL = Array.from({ length: 10 }, (_, i) => ({ 서비스ID: `S${i}`, 서비스명: `서울 채움 ${i}`, 소관기관명: '서울특별시 종로구', 서비스분야: '생활안정' }));
const SNAP = buildSnapshot([...LIST, ...FILL], CONDS, '2026-11-17T00:00:00.000Z');

test('글 다듬기: HTML 이스케이프, 줄마다 문단, 안전한 ID·이름만', () => {
  assert.equal(esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.equal(paragraphs('○ 가\n\n - 나 '), '<p>○ 가</p><p>- 나</p>');
  assert.ok(isSafeId('105100000001') && isSafeId('WLF0000_1-2'));
  assert.ok(!isSafeId('../x') && !isSafeId('a/b') && !isSafeId(''));
  assert.ok(isSafeName('주거·자립') && isSafeName('서울특별시'));
  assert.ok(!isSafeName('a/b') && !isSafeName('..') && !isSafeName(''));
  assert.equal(toDate('20261101093000'), '2026-11-01');
  assert.equal(toDate('2026-11-01 09:30'), '2026-11-01');
  assert.equal(toDate('모름'), '');
});

test('나이·지원조건 글: 상한 100 이상은 없음, 묶음 전부 켜진 건 조건 아님', () => {
  assert.equal(ageText(19, 34), '만 19세 ~ 34세');
  assert.equal(ageText(65, 120), '만 65세 이상');
  assert.equal(ageText(0, 39), '만 39세 이하');
  assert.equal(ageText(null, null), '');
  assert.deepEqual(conditionRows(['JA0404', 'JA0412', 'JA0410']), [['우리 집', '1인 가구, 무주택 세대, 해당 없음도 가능']]);
  assert.deepEqual(conditionRows(['JA0101', 'JA0102']), []);
});

test('긴 글 저장: 목록 칸을 키로 옮기고 빈 칸은 뺀다', () => {
  const d = buildDetails(LIST, 'T');
  assert.equal(d.syncedAt, 'T');
  assert.equal(d.details.A1.target, '만 19~34세 무주택 청년');
  assert.equal(d.details.A1.support, '○ 월 최대 20만 원\n- 12개월');
  assert.equal(d.details.A1.updatedAt, '20261101093000');
  assert.deepEqual(d.details.D4, {});
});

test('페이지 만들기: 긴 글이 있으면 칸마다, 없으면 짧은 글로', () => {
  const { files, stats } = buildPages(SNAP, buildDetails(LIST, 'T'));
  assert.equal(stats.services, 14); // 이상한 ID 1개 뺌
  assert.equal(files['benefit/../x.html'], undefined);
  const a = files['benefit/A1.html'];
  assert.match(a, /<title>청년 월세 지원 — 지원 대상·신청 방법 \| 경자피티<\/title>/);
  assert.match(a, /<link rel="canonical" href="https:\/\/gyeongja-pt\.vercel\.app\/benefit\/A1">/);
  for (const h of ['지원 내용', '지원 대상', '선정 기준', '신청 방법', '신청 기한', '접수 기관', '문의']) assert.ok(a.includes(`<h2>${h}</h2>`), h);
  assert.match(a, /<p>○ 월 최대 20만 원<\/p><p>- 12개월<\/p>/);
  assert.match(a, /<dt>나이<\/dt><dd>만 19세 ~ 34세<\/dd>/);
  assert.match(a, /href="\/benefits"/);
  assert.match(a, /"@type":"GovernmentService"/);
  // 함께 보는 혜택: 같은 분야(전국)에서 자기 자신 빼고
  assert.ok(a.includes('href="/benefit/D4"') && !a.includes('href="/benefit/A1"'));

  const b = files['benefit/B2.html'];
  assert.ok(!b.includes('<script>alert'), '서비스명 이스케이프');
  assert.match(b, /<dt>사는 곳<\/dt><dd>서울특별시 종로구 주민<\/dd>/);
  assert.ok(!b.includes('<h2>지원 대상</h2>'), '긴 글 없으면 그 칸은 안 만든다');

  const { files: plain, stats: s2 } = buildPages(SNAP, null);
  assert.equal(s2.withDetail, 0);
  assert.match(plain['benefit/A1.html'], /<h2>지원 내용<\/h2>/); // 작은 파일의 잘린 글
});

test('목록 페이지·사이트맵·robots', () => {
  const { files } = buildPages(SNAP, buildDetails(LIST, 'T'));
  assert.ok(files['benefit/field/주거·자립.html'].includes('href="/benefit/A1"'));
  assert.ok(!files['benefit/field/주거·자립.html'].includes('href="/benefit/B2"'), '지자체 혜택은 지역 페이지로');
  const seoul = files['benefit/region/서울특별시.html'];
  assert.ok(seoul.includes('href="/benefit/C3"') && seoul.includes('<h2 id="%EC%A2%85%EB%A1%9C%EA%B5%AC">종로구</h2>'));
  assert.ok(files['benefit/index.html'].includes(`href="/benefit/field/${encodeURIComponent('주거·자립')}"`));
  const map = files['sitemap.xml'];
  assert.equal((map.match(/<url>/g) || []).length, 1 + 14 + 1 + 1); // 안내 + 혜택 14 + 분야 1(전국 공통은 주거·자립뿐) + 지역 1
  assert.ok(map.includes('<loc>https://gyeongja-pt.vercel.app/benefit/A1</loc><lastmod>2026-11-01</lastmod>'));
  assert.match(files['robots.txt'], /Sitemap: https:\/\/gyeongja-pt\.vercel\.app\/sitemap\.xml/);
});

test('동기화: detailsOut 을 주면 긴 글 파일도 쓴다', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gjpt-'));
  const fetchImpl = async (url) => ({
    ok: true,
    text: async () => JSON.stringify(url.includes('serviceList') ? { data: LIST.slice(0, 1), totalCount: 1 } : { data: CONDS, totalCount: 1 })
  });
  await syncBenefits({ key: 'k', out: join(dir, 'b.json'), detailsOut: join(dir, 'c', 'd.json'), fetchImpl, log: () => {}, now: new Date('2026-11-17T00:00:00Z') });
  const d = JSON.parse(await readFile(join(dir, 'c', 'd.json'), 'utf8'));
  assert.equal(d.details.A1.criteria, '중위소득 60% 이하');
});
