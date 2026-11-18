// 혜택 검색 페이지: 빌드가 끝난 뒤(npm postbuild) 혜택마다 정적 HTML 한 장씩 만든다.
// 앱 화면(/benefits)은 브라우저에서 그려서 검색에 안 걸리므로, 검색으로 들어올 입구를 따로 둔다.
//
//   dist/benefit/index.html            전체 안내(분야·지역 목록, 많이 본 혜택)
//   dist/benefit/<서비스ID>.html        혜택 한 개   → /benefit/<서비스ID>   (vercel.json cleanUrls)
//   dist/benefit/field/<분야>.html      분야별 전국 혜택
//   dist/benefit/region/<시·도>.html    시·도별 지자체 혜택
//   dist/sitemap.xml, dist/robots.txt
//
// 재료: public/benefits.json(앱이 쓰는 작은 파일) + .cache/benefit-details.json(동기화 때 같이 받은 긴 글, 있을 때만).
// 긴 글이 없으면(내 PC 처럼 키가 없을 때) 작은 파일의 잘린 글로 만든다.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROUPS, readSnapshot, withRegions } from '../src/lib/benefits.js';

export const SITE_URL = 'https://gyeongja-pt.vercel.app';
const DETAIL_MAX = 4000; // 한 칸 글이 이보다 길면 자른다(정부24 원문 링크가 있으니 충분)

// 목록(serviceList) 칸 → 상세 글 키. 칸 이름은 공공데이터포털 API 문서(data.go.kr/data/15113968) 출력결과 기준
const DETAIL_FIELDS = {
  purpose: '서비스목적요약',
  target: '지원대상',
  criteria: '선정기준',
  support: '지원내용',
  how: '신청방법',
  deadline: '신청기한',
  receiver: '접수기관',
  phone: '전화문의',
  dept: '부서명',
  updatedAt: '수정일시'
};

const cleanText = (v) => {
  if (typeof v !== 'string') return '';
  const t = v.replace(/\r\n?/g, '\n').replace(/[ \t\u00a0]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return t.length > DETAIL_MAX ? `${t.slice(0, DETAIL_MAX - 1)}…` : t;
};

/** 목록 응답 → { 서비스ID: { target, criteria, ... } } (빈 칸은 뺀다) */
export function buildDetails(listRows, syncedAt) {
  const details = {};
  for (const r of listRows) {
    const id = r && r['서비스ID'] !== undefined ? String(r['서비스ID']) : '';
    if (!id) continue;
    const d = {};
    for (const [k, col] of Object.entries(DETAIL_FIELDS)) {
      const t = cleanText(r[col]);
      if (t) d[k] = t;
    }
    details[id] = d;
  }
  return { syncedAt, details };
}

export const isSafeId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id);
// 분야·지역 이름을 파일 이름으로 쓴다(한글 그대로). 경로 문자만 막는다
export const isSafeName = (t) => typeof t === 'string' && t.length > 0 && t.length <= 40 && !/[\/\\:*?"<>|.%#]/.test(t);

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** 여러 줄 글 → 줄마다 <p> (정부24 글은 "○ …", "- …" 로 줄을 나눈다) */
export function paragraphs(text) {
  return String(text ?? '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => `<p>${esc(l)}</p>`).join('');
}

const oneLine = (t, n) => {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

export const servicePath = (id) => `/benefit/${id}`;
export const fieldPath = (f) => `/benefit/field/${encodeURIComponent(f)}`;
export const regionPath = (r) => `/benefit/region/${encodeURIComponent(r)}`;

/** 나이 조건 글 */
export function ageText(from, to) {
  const lo = Number.isFinite(from) && from > 0 ? from : null;
  const hi = Number.isFinite(to) && to > 0 && to < 100 ? to : null;
  if (lo !== null && hi !== null) return `만 ${lo}세 ~ ${hi}세`;
  if (lo !== null) return `만 ${lo}세 이상`;
  if (hi !== null) return `만 ${hi}세 이하`;
  return '';
}

/** 지원조건 코드 → [묶음 이름, 항목들] (묶음 항목이 다 켜져 있으면 조건 없음이라 뺀다) */
export function conditionRows(codes) {
  const rows = [];
  for (const g of GROUPS) {
    const keys = Object.keys(g.codes);
    const on = keys.filter((c) => codes.includes(c));
    const none = g.none && codes.includes(g.none);
    if (on.length === 0 || on.length === keys.length) continue;
    rows.push([g.label, [...on.map((c) => g.codes[c]), ...(none ? ['해당 없음도 가능'] : [])].join(', ')]);
  }
  return rows;
}

const CSS = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#f7f4ee;--surface:#fdfbf7;--surface2:#efe9df;--line:rgba(31,27,22,.1);--line2:rgba(31,27,22,.2);--text:#1f1b16;--text2:#5e554a;--muted:#6f675c;--accent:#24408e}
body{background:var(--bg);color:var(--text);font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:16px;line-height:1.65;-webkit-font-smoothing:antialiased;word-break:keep-all;overflow-wrap:anywhere}
a{color:var(--accent)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.wrap{max-width:720px;margin:0 auto;padding:0 16px 48px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;height:56px;border-bottom:1px solid var(--line);margin-bottom:24px}
header .logo{color:var(--text);font-size:17px;font-weight:600;text-decoration:none;white-space:nowrap}
header nav{display:flex;gap:16px}
header nav a{color:var(--text2);text-decoration:none;font-size:14px;white-space:nowrap}
header nav a:hover{color:var(--text)}
.crumb{font-size:13px;color:var(--muted);margin-bottom:8px}
.crumb a{color:var(--muted)}
h1{font-size:28px;line-height:1.3;font-weight:600;margin-bottom:8px}
.meta{color:var(--text2);font-size:14px;margin-bottom:20px}
h2{font-size:18px;font-weight:600;margin:32px 0 8px}
section p{margin-bottom:4px}
dl.conds{display:grid;grid-template-columns:max-content 1fr;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:4px 20px;font-size:15px}
dl.conds dt,dl.conds dd{padding:8px 0}
dl.conds dt{color:var(--text2);padding-right:16px}
dl.conds dt:not(:first-of-type),dl.conds dt:not(:first-of-type)+dd{border-top:1px dashed var(--line2)}
.cta{margin:32px 0;padding:20px;border:1px solid var(--line);border-radius:12px;background:var(--surface)}
.cta p{font-size:15px;color:var(--text2);margin-bottom:12px}
.btn{display:inline-flex;align-items:center;min-height:44px;background:var(--text);color:var(--surface);font-weight:500;text-decoration:none;padding:0 20px;border-radius:8px;font-size:15px}
.btn:hover{background:#3a332b}
.btn2{display:inline-block;margin-top:12px;font-size:15px}
ul.list{list-style:none;background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden}
ul.list li{padding:12px 20px}
ul.list li+li{border-top:1px solid var(--line)}
ul.list li a{font-weight:500;text-decoration:none}
ul.list li span{display:block;color:var(--text2);font-size:14px}
ul.chips{list-style:none;display:flex;flex-wrap:wrap;gap:8px}
ul.chips a{display:inline-block;background:var(--surface);border:1px solid var(--line2);border-radius:6px;padding:6px 12px;font-size:14px;color:var(--text);text-decoration:none}
ul.chips a:hover{background:var(--surface2)}
footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}
footer p{margin-bottom:8px}`;

function layout({ title, description, path, body, jsonLd, syncedAt, source }) {
  const url = SITE_URL + path;
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="article">
<meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="경자피티">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta name="theme-color" content="#f7f4ee">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<style>${CSS}</style>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
<div class="wrap">
<header><a class="logo" href="/">경자피티</a><nav><a href="/benefit/">혜택 둘러보기</a><a href="/benefits">내 조건으로 찾기</a></nav></header>
<main>
${body}
</main>
<footer>
<p>자료: ${esc(source)}. 받아 온 날 ${esc(String(syncedAt).slice(0, 10))}.</p>
<p>정부24에 올라온 내용을 옮긴 것입니다. 실제로 받을 수 있는지는 소득·재산·거주지 등 세부 기준에 따라 달라지니 신청 전에 기관 안내에서 꼭 확인하십시오.</p>
</footer>
</div>
</body>
</html>
`;
}

const cta = (lead = '') => `<div class="cta"><p>${lead}사는 곳·나이·상황만 고르면 정부24 혜택 1만여 개 중에서 골라 드립니다. 가입 없이 쓸 수 있고, 고른 조건은 서버로 보내지 않습니다.</p><a class="btn" href="/benefits">내 조건으로 받을 돈 찾기</a></div>`;

const listItems = (items) => `<ul class="list">${items.map((s) => `<li><a href="${servicePath(s.id)}">${esc(s.name)}</a><span>${esc([s.org, s.type].filter(Boolean).join(' · '))}${s.summary ? ` — ${esc(oneLine(s.summary, 70))}` : ''}</span></li>`).join('')}</ul>`;

/** 혜택 한 개 페이지 */
export function renderService(s, d = {}, ctx) {
  const where = [s.sido, s.sigungu].filter(Boolean).join(' ');
  const conds = conditionRows(s.codes);
  const age = ageText(s.ageFrom, s.ageTo);
  const rows = [...(where ? [['사는 곳', `${where} 주민`]] : []), ...(age ? [['나이', age]] : []), ...conds];
  const support = d.support || s.support;
  const purpose = d.purpose || s.summary;
  const deadline = d.deadline || s.deadline;
  const desc = oneLine([purpose, support].filter(Boolean).join(' '), 150) || `${s.name} 지원 대상과 신청 방법`;

  const sections = [
    ['지원 내용', support],
    ['지원 대상', d.target],
    ['선정 기준', d.criteria],
    ['신청 방법', d.how],
    ['신청 기한', deadline],
    ['접수 기관', d.receiver],
    ['문의', d.phone]
  ].filter(([, t]) => t).map(([h, t]) => `<section><h2>${h}</h2>${paragraphs(t)}</section>`).join('\n');

  const related = (ctx.related.get(s.id) || []);
  const crumb = [`<a href="/benefit/">혜택</a>`];
  if (s.sido && isSafeName(s.sido)) crumb.push(`<a href="${regionPath(s.sido)}">${esc(s.sido)}</a>`);
  else if (s.field && isSafeName(s.field)) crumb.push(`<a href="${fieldPath(s.field)}">${esc(s.field)}</a>`);

  const body = `<div class="crumb">${crumb.join(' › ')}</div>
<h1>${esc(s.name)}</h1>
<div class="meta">${esc([s.org, d.dept, s.type, s.field].filter(Boolean).join(' · '))}</div>
${purpose ? `<section>${paragraphs(purpose)}</section>` : ''}
${rows.length ? `<h2>정부24 지원조건</h2><dl class="conds">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
${sections}
${s.url ? `<p><a class="btn2" href="${esc(s.url)}" rel="noopener" target="_blank">정부24에서 원문 보기·신청하기 ↗</a></p>` : ''}
${cta('이 혜택 말고도 나한테 맞는 게 더 있을 수 있습니다. ')}
${related.length ? `<h2>함께 많이 보는 혜택</h2>${listItems(related)}` : ''}`;

  return layout({
    title: `${s.name} — 지원 대상·신청 방법 | 경자피티`,
    description: desc,
    path: servicePath(s.id),
    body,
    syncedAt: ctx.syncedAt,
    source: ctx.source,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'GovernmentService',
      name: s.name,
      description: desc,
      ...(s.org ? { provider: { '@type': 'GovernmentOrganization', name: s.org } } : {}),
      ...(s.field ? { serviceType: s.field } : {}),
      ...(where ? { areaServed: where } : { areaServed: '대한민국' }),
      ...(s.url ? { url: s.url } : {})
    }
  });
}

export function renderList({ title, h1, intro, path, items, ctx, extra = '' }) {
  return layout({
    title,
    description: oneLine(intro, 150),
    path,
    syncedAt: ctx.syncedAt,
    source: ctx.source,
    body: `<div class="crumb"><a href="/benefit/">혜택</a></div><h1>${esc(h1)}</h1><p class="meta">${esc(intro)}</p>${cta()}${extra}${listItems(items)}`
  });
}

export function renderHub({ fields, regions, top, total, ctx }) {
  const chips = (arr, pathOf) => `<ul class="chips">${arr.map(([name, n]) => `<li><a href="${pathOf(name)}">${esc(name)} ${n.toLocaleString('ko-KR')}</a></li>`).join('')}</ul>`;
  const intro = `정부24에 올라온 공공서비스(지원금·감면·바우처 등) ${total.toLocaleString('ko-KR')}개를 분야별·지역별로 모았습니다.`;
  return layout({
    title: '받을 수 있는 정부 지원금·혜택 전체 목록 | 경자피티',
    description: intro,
    path: '/benefit/',
    syncedAt: ctx.syncedAt,
    source: ctx.source,
    body: `<h1>받을 수 있는 정부 혜택 둘러보기</h1><p class="meta">${esc(intro)}</p>${cta()}
<h2>분야별 (전국 공통)</h2>${chips(fields, fieldPath)}
<h2>지역별 (지자체)</h2>${chips(regions, regionPath)}
<h2>많이 보는 혜택</h2>${listItems(top)}`
  });
}

export function buildSitemap(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(({ path, lastmod }) => `<url><loc>${esc(SITE_URL + path)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
}

/** 정부24 수정일시("20251110093000" 또는 "2025-11-10 ...") → "2025-11-10" */
export function toDate(v) {
  const m = String(v ?? '').match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

const byViews = (a, b) => b.views - a.views;

/** 스냅숏·상세 → 써야 할 파일 목록 { 상대경로: 내용 } */
export function buildPages(snapRaw, detailsDoc) {
  const snap = withRegions(readSnapshot(snapRaw));
  const details = detailsDoc?.details || {};
  const services = snap.services.filter((s) => isSafeId(s.id));
  const ctx = { syncedAt: snap.syncedAt || '', source: snap.source || '정부24 공공서비스(혜택) 정보', related: new Map() };

  // 전국 공통은 분야별, 지자체는 시·도별로 묶는다
  const byField = new Map();
  const byRegion = new Map();
  for (const s of services) {
    if (s.sido) {
      if (isSafeName(s.sido)) (byRegion.get(s.sido) || byRegion.set(s.sido, []).get(s.sido)).push(s);
    } else if (isSafeName(s.field)) (byField.get(s.field) || byField.set(s.field, []).get(s.field)).push(s);
  }
  for (const arr of [...byField.values(), ...byRegion.values()]) arr.sort(byViews);

  // 함께 보는 혜택: 같은 묶음(지역이면 같은 시·군·구 우선)에서 많이 본 순 5개
  for (const s of services) {
    const pool = s.sido ? byRegion.get(s.sido) : byField.get(s.field);
    if (!pool) continue;
    const near = s.sigungu ? pool.filter((x) => x.sigungu === s.sigungu || !x.sigungu) : pool;
    ctx.related.set(s.id, near.filter((x) => x.id !== s.id).slice(0, 5));
  }

  const files = {};
  const sitemap = [{ path: '/benefit/', lastmod: toDate(ctx.syncedAt) }];
  for (const s of services) {
    const d = details[s.id] || {};
    files[`benefit/${s.id}.html`] = renderService(s, d, ctx);
    sitemap.push({ path: servicePath(s.id), lastmod: toDate(d.updatedAt) });
  }
  for (const [f, items] of byField) {
    files[`benefit/field/${f}.html`] = renderList({
      title: `${f} 정부 지원금·혜택 ${items.length.toLocaleString('ko-KR')}개 | 경자피티`,
      h1: `${f} 혜택 (전국)`,
      intro: `정부24에 올라온 ${f} 분야 전국 공통 공공서비스 ${items.length.toLocaleString('ko-KR')}개입니다. 많이 본 순서로 정리했습니다.`,
      path: fieldPath(f), items, ctx
    });
    sitemap.push({ path: fieldPath(f), lastmod: toDate(ctx.syncedAt) });
  }
  for (const [r, items] of byRegion) {
    const gus = [...new Set(items.map((s) => s.sigungu).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
    const extra = gus.length ? `<h2>시·군·구</h2><ul class="chips">${gus.map((g) => `<li><a href="#${encodeURIComponent(g)}">${esc(g)}</a></li>`).join('')}</ul>` : '';
    const wide = items.filter((s) => !s.sigungu);
    const body = [
      ...(wide.length ? [`<h2>${esc(r)} 전체</h2>${listItems(wide)}`] : []),
      ...gus.map((g) => `<h2 id="${esc(encodeURIComponent(g))}">${esc(g)}</h2>${listItems(items.filter((s) => s.sigungu === g))}`)
    ].join('');
    files[`benefit/region/${r}.html`] = renderList({
      title: `${r} 지원금·혜택 ${items.length.toLocaleString('ko-KR')}개 | 경자피티`,
      h1: `${r} 혜택`,
      intro: `${r}와 시·군·구가 주는 공공서비스 ${items.length.toLocaleString('ko-KR')}개입니다. 그 지역에 사는 사람이 받을 수 있습니다.`,
      path: regionPath(r), items: [], ctx, extra: extra + body
    });
    sitemap.push({ path: regionPath(r), lastmod: toDate(ctx.syncedAt) });
  }

  const count = (m) => [...m.entries()].map(([k, v]) => [k, v.length]).sort((a, b) => a[0].localeCompare(b[0], 'ko'));
  files['benefit/index.html'] = renderHub({
    fields: count(byField), regions: count(byRegion), top: services.filter((s) => !s.sido).sort(byViews).slice(0, 30), total: services.length, ctx
  });
  files['sitemap.xml'] = buildSitemap(sitemap);
  files['robots.txt'] = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  return { files, stats: { services: services.length, fields: byField.size, regions: byRegion.size, withDetail: services.filter((s) => details[s.id]?.target).length } };
}

async function readJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

// npm postbuild 로 실행. 혜택 파일이 없으면(키 없는 CI 등) 건너뛴다
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const dist = join(root, 'dist');
  const snap = await readJson(join(dist, 'benefits.json'));
  if (!snap) {
    console.log('혜택 페이지: dist/benefits.json 이 없어 만들지 않습니다.');
  } else {
    const detailsDoc = await readJson(join(root, '.cache', 'benefit-details.json'));
    const { files, stats } = buildPages(snap, detailsDoc);
    await rm(join(dist, 'benefit'), { recursive: true, force: true });
    for (const [rel, text] of Object.entries(files)) {
      const out = join(dist, rel);
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, text);
    }
    console.log(`혜택 페이지: ${stats.services}개 (긴 글 있음 ${stats.withDetail}개), 분야 ${stats.fields}개, 지역 ${stats.regions}개, 파일 ${Object.keys(files).length}개`);
  }
}
