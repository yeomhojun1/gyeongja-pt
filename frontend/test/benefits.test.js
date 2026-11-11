import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CODE_ORDER, withRegions, buildSnapshot, decodeCodes, encodeCodes, findBenefits, matchService, normalizeService, readSnapshot, sanitizeBenefitProfile, withJobHints
} from '../src/lib/benefits.js';
import { isEmptyProfile, sanitizeProfile } from '../src/lib/profile.js';
import { fetchAllPages, normalizeKey, syncBenefits } from '../scripts/sync-benefits.mjs';

// 테스트용 가짜 서비스(실제 정부24 서비스 아님)
const svc = (id, codes = [], age = {}, views = 0) => ({ id, name: id, codes, ageFrom: age.from ?? null, ageTo: age.to ?? null, views });
const NOW = new Date(2026, 10, 11);
const me = (raw) => sanitizeBenefitProfile(raw, NOW);

test('목록·지원조건 합치기: Y 만 코드로, 모르는 코드·http 주소는 버리고 법인 전용은 뺀다', () => {
  const list = [
    { 서비스ID: 'A1', 서비스명: '  청년   월세 지원 ', 소관기관명: '가부', 상세조회URL: 'https://www.gov.kr/x', 조회수: 120, 지원내용: '가'.repeat(300) },
    { 서비스ID: 'B2', 서비스명: '법인 지원', 상세조회URL: 'http://x' },
    { 서비스ID: 'C3', 서비스명: '조건 없음' },
    { 서비스명: 'ID 없음' }
  ];
  const conds = [
    { 서비스ID: 'A1', JA0101: 'Y', JA0102: 'y', JA0110: '19', JA0111: 34, JA0404: 'N', JA9999: 'Y', JA0412: null },
    { 서비스ID: 'B2', JA2101: 'Y' }
  ];
  const snap = readSnapshot(buildSnapshot(list, conds, '2026-11-11T00:00:00.000Z'));
  assert.equal(snap.count, 2);
  const [a, c] = snap.services;
  assert.equal(a.name, '청년 월세 지원');
  assert.deepEqual(a.codes, ['JA0101', 'JA0102']);
  assert.equal(a.ageFrom, 19);
  assert.equal(a.ageTo, 34);
  assert.equal(a.views, 120);
  assert.equal(a.support.length, 100);
  assert.equal('target' in a, false, '화면에 안 쓰는 지원대상은 저장하지 않는다');
  assert.equal(a.url, 'https://www.gov.kr/x');
  assert.ok(a.support.endsWith('…'));
  assert.equal(c.id, 'C3');
  assert.deepEqual(c.codes, []);
  assert.equal(normalizeService({ 서비스ID: 1, 서비스명: 'x', 상세조회URL: 'http://x' }).url, '');
});

test('조건 정리: 모르는 코드·"해당사항없음" 코드는 버리고, 한 개 묶음은 하나만, 해당 없음이면 그 묶음 비움', () => {
  const p = me({ birthYear: 1994, codes: ['JA0101', 'JA0102', 'JA0326', 'JA0322', 'JA0404', 'JA9999', 'JA1102'], none: ['household', 'gender', 'x'] });
  assert.deepEqual(p.codes, ['JA0102', 'JA0326', 'JA1102']);
  assert.deepEqual(p.none, ['household']);
  assert.equal(me({ birthYear: 2030 }).birthYear, null);
  assert.equal(me({ birthYear: 1994.5 }).birthYear, null);
  assert.deepEqual(me('x'), { birthYear: null, codes: [], none: [], sido: '', sigungu: '' });
  assert.deepEqual([me({ sido: '서울특별시', sigungu: '종로구' }).sigungu, me({ sigungu: '종로구' }).sigungu, me({ sido: '<b>' }).sido], ['종로구', '', '']);
});

test('묶음 안은 하나라도, 묶음끼리는 모두 맞아야 한다', () => {
  const s = svc('s', ['JA0326', 'JA0327', 'JA0404']);
  assert.equal(matchService(s, me({ codes: ['JA0327', 'JA0404'] })).status, 'match');
  assert.equal(matchService(s, me({ codes: ['JA0320', 'JA0404'] })).status, 'no');
  const r = matchService(s, me({ codes: ['JA0326'] }));
  assert.equal(r.status, 'check');
  assert.deepEqual(r.unknown, ['우리 집']);
});

test('해당 없음: 서비스가 "해당사항없음"을 받으면 맞고, 아니면 안 맞음', () => {
  assert.equal(matchService(svc('a', ['JA0326', 'JA0322']), me({ none: ['life'] })).status, 'match');
  assert.equal(matchService(svc('b', ['JA0326']), me({ none: ['life'] })).status, 'no');
  assert.equal(matchService(svc('c', ['JA1102']), me({ none: ['biz'] })).status, 'no');
});

test('묶음 항목이 전부 켜져 있으면 조건 없음으로 본다(성별 둘 다 등)', () => {
  assert.equal(matchService(svc('a', ['JA0101', 'JA0102'], { from: 0, to: 0 }), me({})).status, 'check', '조건 정보가 사실상 없으면 확인 필요');
  assert.equal(matchService(svc('b', ['JA0101', 'JA0102', 'JA0404']), me({ codes: ['JA0404'] })).status, 'match');
});

test('나이: 생일을 몰라 한 살 차이는 확인 필요, 밖이면 제외, 출생연도 없으면 확인 필요', () => {
  const youth = svc('y', ['JA0404'], { from: 19, to: 34 });
  const one = { codes: ['JA0404'] };
  assert.equal(matchService(youth, me({ ...one, birthYear: 2000 }), NOW).status, 'match'); // 25~26세
  assert.equal(matchService(youth, me({ ...one, birthYear: 1991 }), NOW).status, 'check'); // 34~35세
  assert.deepEqual(matchService(youth, me({ ...one, birthYear: 1991 }), NOW).unknown, ['나이(생일에 따라 다름)']);
  assert.equal(matchService(youth, me({ ...one, birthYear: 1980 }), NOW).status, 'no');
  assert.equal(matchService(youth, me({ ...one, birthYear: 2010 }), NOW).status, 'no');
  assert.deepEqual(matchService(youth, me(one), NOW).unknown, ['나이']);
  // 상한 100 이상(실데이터 120·200·999)은 상한 없음, 0~120 은 나이 조건 없음
  assert.equal(matchService(svc('all', ['JA0404'], { from: 0, to: 120 }), me(one), NOW).status, 'match');
  assert.equal(matchService(svc('kid', ['JA0404'], { from: 0, to: 17 }), me({ ...one, birthYear: 2000 }), NOW).status, 'no');
  // 상한 150 이상은 상한 없음
  assert.equal(matchService(svc('o', ['JA0404'], { from: 65, to: 150 }), me({ ...one, birthYear: 1950 }), NOW).status, 'match');
});

test('법인 전용은 제외, 결과 정렬: 맞음은 조회수 순, 확인 필요는 모르는 게 적은 순', () => {
  assert.equal(matchService(svc('org', ['JA2101']), me({})).status, 'no');
  const list = [
    svc('m1', ['JA0404'], {}, 5), svc('m2', ['JA0404'], {}, 50),
    svc('c2', ['JA0326', 'JA0201'], {}, 999), svc('c1', ['JA0326'], {}, 1), svc('x', ['JA0412'], {}, 1)
  ];
  const r = findBenefits(list, me({ codes: ['JA0404'] }), NOW);
  assert.deepEqual(r.match.map((m) => m.service.id), ['m2', 'm1']);
  assert.deepEqual(r.check.map((m) => m.service.id), ['c1', 'c2']);
  // 여러 개 고르는 묶음에서 안 고른 항목(무주택)은 해당 없음으로 본다 → x 는 제외
  assert.ok(![...r.match, ...r.check].some((m) => m.service.id === 'x'));
});

test('일하는 형태로 기본 조건 채우기(이미 답한 묶음은 그대로)', () => {
  assert.deepEqual(withJobHints(me({}), '직장인').codes, ['JA0326']);
  assert.deepEqual(withJobHints(me({}), '자영업자').codes, ['JA1102']);
  assert.deepEqual(withJobHints(me({ codes: ['JA0327'] }), '직장인').codes, ['JA0327']);
  assert.deepEqual(withJobHints(me({ none: ['life'] }), '직장인').codes, []);
});

test('프로필에 조건 저장: 조건만 있어도 빈 지갑 아님', () => {
  const p = sanitizeProfile({ benefit: { birthYear: 1994, codes: ['JA0404'] } });
  assert.deepEqual(p.benefit, { birthYear: 1994, codes: ['JA0404'], none: [], sido: '', sigungu: '' });
  assert.equal(isEmptyProfile(sanitizeProfile({ benefit: { sido: '경기도' } })), false);
  assert.equal(isEmptyProfile(p), false);
  assert.equal(isEmptyProfile(sanitizeProfile({})), true);
});

test('동기화: 모든 쪽을 받고, 키는 주소에만 넣고 오류 문구에선 지운다', async () => {
  const KEY = 'abc+/=key';
  const calls = [];
  const pages = { serviceList: [[{ 서비스ID: '1', 서비스명: 'a' }, { 서비스ID: '2', 서비스명: 'b' }], [{ 서비스ID: '3', 서비스명: 'c' }]], supportConditions: [[{ 서비스ID: '1', JA0404: 'Y' }]] };
  const fake = async (url) => {
    calls.push(url);
    const u = new URL(url);
    const op = u.pathname.split('/').pop();
    const page = Number(u.searchParams.get('page'));
    assert.equal(u.searchParams.get('serviceKey'), KEY);
    const data = pages[op][page - 1] || [];
    const total = pages[op].flat().length;
    return new Response(JSON.stringify({ data, totalCount: total, page, perPage: 2 }), { status: 200 });
  };
  const rows = await fetchAllPages('serviceList', { key: KEY, perPage: 2, fetchImpl: fake });
  assert.deepEqual(rows.map((r) => r['서비스ID']), ['1', '2', '3']);
  assert.equal(calls.length, 2);

  const bad = async () => new Response(`잘못된 키 ${KEY} / ${encodeURIComponent(KEY)}`, { status: 401 });
  await assert.rejects(fetchAllPages('serviceList', { key: KEY, fetchImpl: bad }), (e) => {
    assert.ok(!e.message.includes(KEY) && !e.message.includes(encodeURIComponent(KEY)), e.message);
    assert.match(e.message, /응답 401/);
    return true;
  });
  await assert.rejects(syncBenefits({ key: '', out: 'x', log: () => {} }), /DATA_GO_KR_KEY/);
});

test('인증키: 인코딩된 키(%2B 등)는 풀고, 일반 키는 앞뒤 공백만 지운다', () => {
  assert.equal(normalizeKey(' abc%2Bdef%2F%3D%3D '), 'abc+def/==');
  assert.equal(normalizeKey('abc+def/=='), 'abc+def/==');
  assert.equal(normalizeKey('0a1b2c3d'), '0a1b2c3d');
  assert.equal(normalizeKey('bad%E0%A4%A'), 'bad%E0%A4%A');
  assert.equal(normalizeKey(undefined), '');
});

test('정적 파일 줄이기: 코드 비트열·주소 앞부분이 읽을 때 그대로 돌아온다', () => {
  const codes = ['JA0101', 'JA0326', 'JA0410', 'JA1299', 'JA2299'];
  assert.deepEqual(decodeCodes(encodeCodes(codes)), [...codes].sort());
  assert.equal(encodeCodes(CODE_ORDER).length, Math.ceil(CODE_ORDER.length / 4));
  const base = 'https://plus.gov.kr/portal/x/dtl?';
  const list = [1, 2, 3].map((i) => ({ 서비스ID: String(i), 서비스명: `s${i}`, 상세조회URL: i === 3 ? 'https://other.kr/a?b=1' : `${base}svcId=${i}` }));
  const raw = buildSnapshot(list, [{ 서비스ID: '1', JA0404: 'Y', JA0412: 'Y' }], 't');
  assert.equal(raw.v, 2);
  assert.equal(raw.urlBase, base);
  assert.equal(raw.services[0].url, 'svcId=1');
  assert.equal(typeof raw.services[0].codes, 'string');
  const back = readSnapshot(JSON.parse(JSON.stringify(raw)));
  assert.equal(back.services[0].url, base + 'svcId=1');
  assert.equal(back.services[2].url, 'https://other.kr/a?b=1');
  assert.deepEqual(back.services[0].codes, ['JA0404', 'JA0412']);
  // 옛 형식(v 없음)은 그대로
  const old = { services: [{ codes: ['JA0101'] }] };
  assert.equal(readSnapshot(old), old);
});

test('사는 곳: 기관명으로 지자체 서비스를 가려 그 지역 주민에게만', () => {
  const org = (id, o) => ({ ...svc(id, ['JA0404']), org: o });
  const snap = withRegions({ services: [
    ...Array.from({ length: 10 }, (_, i) => org('s' + i, '서울특별시')),
    org('jongno', '서울특별시 종로구'), org('edu', '서울특별시교육청'), org('gg', '경기도 수원시'),
    ...Array.from({ length: 9 }, (_, i) => org('g' + i, '경기도')),
    org('nat', '보건복지부'), org('few', '어느특별자치도')
  ] }, 10);
  assert.deepEqual(snap.regions.sidos, ['경기도', '서울특별시']);
  assert.deepEqual(snap.regions.sigungu['서울특별시'], ['종로구']);
  const by = Object.fromEntries(snap.services.map((s) => [s.id, s]));
  assert.deepEqual([by.jongno.sido, by.jongno.sigungu], ['서울특별시', '종로구']);
  assert.deepEqual([by.edu.sido, by.edu.sigungu], ['서울특별시', '']);
  assert.equal(by.nat.sido, '');
  assert.equal(by.few.sido, '', '서비스가 적은 이름은 시·도로 보지 않는다');

  const base = { codes: ['JA0404'] };
  const st = (id, m) => matchService(by[id], me({ ...base, ...m }), NOW);
  assert.deepEqual(st('jongno', {}).unknown, ['사는 곳']);
  assert.equal(st('jongno', { sido: '경기도' }).status, 'no');
  assert.deepEqual(st('jongno', { sido: '서울특별시' }).unknown, ['사는 곳(시·군·구)']);
  assert.equal(st('jongno', { sido: '서울특별시', sigungu: '종로구' }).status, 'match');
  assert.equal(st('jongno', { sido: '서울특별시', sigungu: '강남구' }).status, 'no');
  assert.equal(st('edu', { sido: '서울특별시', sigungu: '강남구' }).status, 'match');
  assert.equal(st('nat', { sido: '경기도' }).status, 'match');
});
