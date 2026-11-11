// 받을 수 있는 돈 찾기: 행정안전부 "대한민국 공공서비스(혜택) 정보"(정부24) 의 지원조건 코드와 내 조건을 맞춘다.
// 혜택 데이터는 scripts/sync-benefits.mjs 가 미리 받아 둔 정적 파일(public/benefits.json)이고, 맞춰 보는 일은
// 브라우저 안에서만 한다(내 조건은 서버로 보내지 않는다). 순수 함수라 테스트(frontend/test/benefits.test.js)와
// 화면(pages/Benefits.jsx)·동기화 스크립트가 같이 쓴다.
//
// 코드 뜻은 공공데이터포털 API 문서(data.go.kr/data/15113968) 출력결과 표 기준. 다음은 문서에 없어 추정한 규칙이다:
// - 같은 묶음 안의 코드는 "하나라도 맞으면"(OR), 묶음끼리는 "모두 맞아야"(AND)
// - "해당사항없음"(JA0322·JA0410) 은 그 묶음의 어느 것에도 해당하지 않는 사람도 받을 수 있다는 뜻
//
// 실제 응답(11-11, 10,942개)으로 확인: 값은 "Y", 나이는 숫자이고 상한 120·200·999 는 "제한 없음" 뜻으로 쓰인다

export const GROUPS = [
  { key: 'gender', label: '성별', single: true, codes: { JA0101: '남성', JA0102: '여성' } },
  {
    key: 'income', label: '가구 소득(기준 중위소득 대비)', single: true,
    codes: { JA0201: '50% 이하', JA0202: '51~75%', JA0203: '76~100%', JA0204: '101~200%', JA0205: '200% 초과' }
  },
  {
    key: 'life', label: '나의 상황', none: 'JA0322',
    codes: {
      JA0326: '근로자·직장인', JA0327: '구직자·실업자', JA0317: '초등학생', JA0318: '중학생', JA0319: '고등학생',
      JA0320: '대학생·대학원생', JA0301: '예비부모·난임', JA0302: '임산부', JA0303: '출산·입양', JA0328: '장애인',
      JA0329: '국가보훈대상자', JA0330: '질병·질환자', JA0313: '농업인', JA0314: '어업인', JA0315: '축산업인', JA0316: '임업인'
    }
  },
  {
    key: 'household', label: '우리 집', none: 'JA0410',
    codes: {
      JA0404: '1인 가구', JA0412: '무주택 세대', JA0411: '다자녀 가구', JA0403: '한부모·조손 가정', JA0401: '다문화 가족',
      JA0402: '북한이탈주민', JA0413: '신규 전입', JA0414: '확대 가족'
    }
  },
  { key: 'biz', label: '가게(소상공인)', codes: { JA1101: '예비 창업자', JA1102: '영업 중', JA1103: '생계 곤란·폐업 예정' } },
  { key: 'bizType', label: '가게 업종', codes: { JA1201: '음식점업', JA1202: '제조업', JA1299: '기타 업종' } }
];
// 법인·단체 대상 코드. 개인 묶음 코드 없이 이것만 있는 서비스는 결과에서 뺀다
export const ORG_CODES = ['JA2101', 'JA2102', 'JA2103', 'JA2201', 'JA2202', 'JA2203', 'JA2299'];
export const AGE_FROM = 'JA0110';
export const AGE_TO = 'JA0111';
const NO_MAX_AGE = 100; // 나이 상한이 이 이상이면 상한 없음

const GROUP_OF = Object.fromEntries(GROUPS.flatMap((g) => [...Object.keys(g.codes), ...(g.none ? [g.none] : [])].map((c) => [c, g])));
const KNOWN = new Set([...Object.keys(GROUP_OF), ...ORG_CODES]);
// 정적 파일에서 코드 목록을 짧은 16진 비트열로 줄일 때 쓰는 순서
export const CODE_ORDER = [...KNOWN].sort();
const MULTI = GROUPS.filter((g) => !g.single).map((g) => g.key);

const isOn = (v) => v === true || (typeof v === 'string' && v.trim().toUpperCase() === 'Y');
const toAge = (v) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const clip = (v, n) => {
  const t = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/** 목록(serviceList) 한 줄 + 지원조건(supportConditions) 한 줄 → 화면에 쓸 작은 객체 */
export function normalizeService(row, cond = {}) {
  const codes = Object.keys(cond).filter((k) => KNOWN.has(k) && isOn(cond[k])).sort();
  const url = typeof row['상세조회URL'] === 'string' && /^https:\/\//.test(row['상세조회URL'].trim()) ? row['상세조회URL'].trim() : '';
  return {
    id: String(row['서비스ID'] ?? ''),
    name: clip(row['서비스명'], 80),
    org: clip(row['소관기관명'], 40),
    field: clip(row['서비스분야'], 30),
    type: clip(row['지원유형'], 30),
    summary: clip(row['서비스목적요약'], 120),
    support: clip(row['지원내용'], 100),
    deadline: clip(row['신청기한'], 60),
    url,
    views: toAge(row['조회수']) ?? 0,
    codes,
    ageFrom: toAge(cond[AGE_FROM]),
    ageTo: toAge(cond[AGE_TO])
  };
}

/** 코드 배열 → 16진 비트열(4개씩 한 글자) */
export function encodeCodes(codes, order = CODE_ORDER) {
  const on = new Set(codes);
  let out = '';
  for (let i = 0; i < order.length; i += 4) {
    let n = 0;
    for (let j = 0; j < 4; j += 1) if (on.has(order[i + j])) n |= 1 << j;
    out += n.toString(16);
  }
  return out;
}

export function decodeCodes(hex, order = CODE_ORDER) {
  const out = [];
  for (let i = 0; i < hex.length; i += 1) {
    const n = parseInt(hex[i], 16);
    for (let j = 0; j < 4; j += 1) if (n & (1 << j) && order[i * 4 + j]) out.push(order[i * 4 + j]);
  }
  return out;
}

// 상세 주소는 대부분 같은 앞부분(…?svcSeq=…)이라 한 번만 적는다
function commonUrlBase(urls) {
  const count = new Map();
  for (const u of urls) { const i = u.indexOf('?'); if (i > 0) count.set(u.slice(0, i + 1), (count.get(u.slice(0, i + 1)) || 0) + 1); }
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

/** 목록과 지원조건을 서비스ID 로 합쳐 정적 파일 내용을 만든다(v2: 코드는 비트열, 주소는 공통 앞부분 생략) */
export function buildSnapshot(listRows, condRows, syncedAt) {
  const condById = new Map(condRows.map((c) => [String(c['서비스ID']), c]));
  const services = listRows
    .filter((r) => r && r['서비스ID'] !== undefined && r['서비스명'])
    .map((r) => normalizeService(r, condById.get(String(r['서비스ID']))))
    .filter((s) => !isOrgOnly(s));
  const urlBase = commonUrlBase(services.map((x) => x.url));
  return {
    v: 2,
    source: '행정안전부_대한민국 공공서비스(혜택) 정보 (공공데이터포털, 이용허락범위 제한 없음)',
    syncedAt,
    count: services.length,
    codeOrder: CODE_ORDER,
    urlBase,
    services: services.map((x) => ({
      ...x,
      codes: encodeCodes(x.codes),
      url: urlBase && x.url.startsWith(urlBase) ? x.url.slice(urlBase.length) : x.url
    }))
  };
}

/** 정적 파일 → 화면에서 쓰는 모양(코드 배열·전체 주소). v2 가 아니면 그대로 */
export function readSnapshot(snap) {
  if (snap?.v !== 2) return snap;
  const order = Array.isArray(snap.codeOrder) ? snap.codeOrder : CODE_ORDER;
  return {
    ...snap,
    services: snap.services.map((x) => ({
      ...x,
      codes: decodeCodes(String(x.codes || ''), order),
      url: !x.url || x.url.startsWith('https://') ? x.url : snap.urlBase + x.url
    }))
  };
}

/** 법인·단체만 대상인가(개인 묶음 코드가 하나도 없고 법인 코드만 있음) */
export function isOrgOnly(s) {
  return s.codes.some((c) => ORG_CODES.includes(c)) && !s.codes.some((c) => GROUP_OF[c]);
}

export function emptyBenefitProfile() {
  return { birthYear: null, codes: [], none: [], sido: '', sigungu: '' };
}

// 사는 곳: 지원조건 코드에는 거주지가 없어서, 소관기관명 앞부분("서울특별시 종로구", "경기도", "대구광역시교육청")으로
// 지자체 서비스를 가려낸다. 시·도 이름은 데이터에서 뽑는다(전남광주통합특별시처럼 바뀌어도 따라가게)
const SIDO_RE = /^[가-힣]+(특별시|광역시|특별자치시|특별자치도|통합특별시|도)$/;
const SIGUNGU_RE = /^[가-힣]+(시|군|구)$/;
const REGION_RE = /^[가-힣]{2,20}$/;

/** 서비스마다 sido·sigungu 를 붙이고, 화면에 쓸 시·도 → 시·군·구 목록을 만든다 */
export function withRegions(snap, minCount = 10) {
  const first = new Map();
  for (const s of snap.services) {
    const t = s.org.split(' ')[0];
    if (SIDO_RE.test(t)) first.set(t, (first.get(t) || 0) + 1);
  }
  const sidos = [...first.entries()].filter(([, n]) => n >= minCount).map(([t]) => t).sort((a, b) => a.localeCompare(b, 'ko'));
  const sigungu = Object.fromEntries(sidos.map((d) => [d, new Set()]));
  const services = snap.services.map((s) => {
    const [t, t2] = s.org.split(' ');
    const sido = sidos.find((d) => t.startsWith(d)) || '';
    const gu = sido && t === sido && t2 && SIGUNGU_RE.test(t2) ? t2 : '';
    if (gu) sigungu[sido].add(gu);
    return { ...s, sido, sigungu: gu };
  });
  return {
    ...snap,
    services,
    regions: { sidos, sigungu: Object.fromEntries(sidos.map((d) => [d, [...sigungu[d]].sort((a, b) => a.localeCompare(b, 'ko'))])) }
  };
}

/** 저장소·화면 값 정리: 모르는 코드는 버리고, 한 개만 고르는 묶음은 마지막 하나만, "해당 없음"이면 그 묶음 코드는 비운다 */
export function sanitizeBenefitProfile(raw, now = new Date()) {
  const p = emptyBenefitProfile();
  if (!raw || typeof raw !== 'object') return p;
  const y = raw.birthYear;
  if (Number.isInteger(y) && y >= 1900 && y <= now.getFullYear()) p.birthYear = y;
  if (REGION_RE.test(raw.sido ?? '')) p.sido = raw.sido;
  if (p.sido && REGION_RE.test(raw.sigungu ?? '')) p.sigungu = raw.sigungu;
  p.none = Array.isArray(raw.none) ? [...new Set(raw.none.filter((k) => MULTI.includes(k)))] : [];
  const codes = Array.isArray(raw.codes) ? raw.codes.filter((c) => GROUP_OF[c] && !GROUPS.some((g) => g.none === c)) : [];
  for (const g of GROUPS) {
    const mine = [...new Set(codes.filter((c) => GROUP_OF[c] === g))];
    if (p.none.includes(g.key)) continue;
    p.codes.push(...(g.single ? mine.slice(-1) : mine));
  }
  return p;
}

export function isEmptyBenefitProfile(b) {
  return b.birthYear === null && b.codes.length === 0 && b.none.length === 0 && !b.sido;
}

/**
 * 한 서비스와 내 조건을 맞춘다.
 * status: 'match'(지금 넣은 조건으로는 다 맞음) / 'check'(모르는 조건이 있음) / 'no'(안 맞음)
 * unknown: 더 넣으면 확인되는 묶음 이름들
 */
export function matchService(s, me, now = new Date()) {
  const unknown = [];
  if (isOrgOnly(s)) return { status: 'no', unknown };
  let limited = false; // 실제로 대상을 좁히는 조건이 하나라도 있었나

  // 지자체 서비스는 그 지역 주민만
  if (s.sido) {
    limited = true;
    if (!me.sido) unknown.push('사는 곳');
    else if (me.sido !== s.sido) return { status: 'no', unknown };
    else if (s.sigungu) {
      if (!me.sigungu) unknown.push('사는 곳(시·군·구)');
      else if (me.sigungu !== s.sigungu) return { status: 'no', unknown };
    }
  }

  for (const g of GROUPS) {
    const need = s.codes.filter((c) => GROUP_OF[c] === g);
    if (need.length === 0) continue;
    // 묶음의 모든 항목이 다 켜져 있으면 조건이 없는 것과 같다
    if (Object.keys(g.codes).every((c) => need.includes(c))) continue;
    limited = true;
    const mine = me.codes.filter((c) => GROUP_OF[c] === g);
    if (mine.some((c) => need.includes(c))) continue;
    if (me.none.includes(g.key)) {
      if (g.none && need.includes(g.none)) continue;
      return { status: 'no', unknown };
    }
    if (mine.length === 0) { unknown.push(g.label); continue; }
    return { status: 'no', unknown };
  }

  const from = s.ageFrom ?? 0;
  const to = s.ageTo ?? 0;
  const max = to > 0 && to < NO_MAX_AGE ? to : Infinity;
  if (from > 0 || max !== Infinity) {
    limited = true;
    if (me.birthYear === null) unknown.push('나이');
    else {
      // 생일을 모르므로 만 나이는 (올해 − 출생연도 − 1) ~ (올해 − 출생연도) 중 하나
      const hi = now.getFullYear() - me.birthYear;
      const lo = hi - 1;
      if (hi < from || lo > max) return { status: 'no', unknown };
      if (lo < from || hi > max) unknown.push('나이(생일에 따라 다름)');
    }
  }

  if (!limited) unknown.push('지원조건 정보 없음');
  return { status: unknown.length ? 'check' : 'match', unknown };
}

/** 전체 서비스에서 맞는 것·확인 필요한 것을 골라 정렬한다(맞음 → 확인할 게 적은 순 → 조회수) */
export function findBenefits(services, me, now = new Date()) {
  const out = { match: [], check: [] };
  for (const s of services) {
    const r = matchService(s, me, now);
    if (r.status !== 'no') out[r.status].push({ service: s, unknown: r.unknown });
  }
  const byViews = (a, b) => b.service.views - a.service.views;
  out.match.sort(byViews);
  out.check.sort((a, b) => a.unknown.length - b.unknown.length || byViews(a, b));
  return out;
}

/** 내 지갑 프로필에서 고를 수 있는 기본 조건(일하는 형태 → 직장인·영업 중). 이미 답한 묶음은 건드리지 않는다 */
export function withJobHints(b, job) {
  const has = (key) => b.codes.some((c) => GROUP_OF[c]?.key === key) || b.none.includes(key);
  const codes = [...b.codes];
  if (job === '직장인' && !has('life')) codes.push('JA0326');
  if (job === '자영업자' && !has('biz')) codes.push('JA1102');
  return { ...b, codes };
}
