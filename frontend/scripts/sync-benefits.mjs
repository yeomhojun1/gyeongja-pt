// 정부24 공공서비스(혜택) 목록·지원조건을 받아 public/benefits.json 으로 저장한다(받을 수 있는 돈 찾기 화면이 읽음).
// 공공데이터포털 "행정안전부_대한민국 공공서비스(혜택) 정보" 활용신청 후 받은 일반 인증키를 환경 변수로 넘긴다(인코딩된 키도 됨).
//
//   PowerShell:  $env:DATA_GO_KR_KEY = Read-Host "인증키"; npm run sync:benefits
//
// 키는 화면·로그·파일 어디에도 남기지 않는다(오류 문구에서도 지운다). 무료 API 지만 하루 호출 한도가 있으니 하루 한 번이면 충분하다.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSnapshot } from '../src/lib/benefits.js';

// 문서에는 경로(/gov24/v3/...)만 있고 호스트가 없다. odcloud 계열 API 의 일반 주소를 기본값으로 두고 바꿀 수 있게 한다
const DEFAULT_BASE = 'https://api.odcloud.kr/api/gov24/v3';
const PER_PAGE = 500;
const MAX_PAGES = 100;

/** 포털이 인코딩된 키(%2B 등)만 보여 주는 경우가 있어, 인코딩돼 있으면 풀어서 쓴다(주소에 넣을 때 다시 인코딩함) */
export function normalizeKey(raw) {
  const key = String(raw ?? '').trim();
  if (!/%[0-9A-Fa-f]{2}/.test(key)) return key;
  try { return decodeURIComponent(key); } catch { return key; }
}

const redact = (text, key) => (key ? String(text).split(key).join('***').split(encodeURIComponent(key)).join('***') : String(text));

/** 한 오퍼레이션의 모든 페이지를 받는다. 응답 형식: { data: [...], totalCount, page, perPage } */
export async function fetchAllPages(operation, { key, base = DEFAULT_BASE, perPage = PER_PAGE, fetchImpl = fetch, log = () => {} }) {
  const rows = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${base}/${operation}?page=${page}&perPage=${perPage}&returnType=JSON&serviceKey=${encodeURIComponent(key)}`;
    let res;
    try {
      res = await fetchImpl(url, { headers: { Authorization: `Infuser ${key}`, Accept: 'application/json' } });
    } catch (e) {
      throw new Error(`${operation} ${page}쪽 요청 실패: ${redact(e.message, key)}`);
    }
    const body = await res.text();
    if (!res.ok) throw new Error(`${operation} ${page}쪽 응답 ${res.status}: ${redact(body.slice(0, 200), key)}`);
    let json;
    try { json = JSON.parse(body); } catch { throw new Error(`${operation} ${page}쪽 응답이 JSON 이 아닙니다: ${redact(body.slice(0, 200), key)}`); }
    const data = Array.isArray(json.data) ? json.data : [];
    rows.push(...data);
    const total = Number(json.totalCount ?? json.matchCount ?? 0);
    log(`${operation}: ${rows.length}/${total || '?'}`);
    if (data.length < perPage || (total && rows.length >= total)) return rows;
  }
  throw new Error(`${operation}: ${MAX_PAGES}쪽을 넘어 멈췄습니다(perPage 확인 필요).`);
}

export async function syncBenefits({ key, base, out, fetchImpl, log = console.log, now = new Date() }) {
  if (!key) throw new Error('DATA_GO_KR_KEY 환경 변수에 공공데이터포털 인증키를 넣어 주세요.');
  const list = await fetchAllPages('serviceList', { key, base, fetchImpl, log });
  const conds = await fetchAllPages('supportConditions', { key, base, fetchImpl, log });
  const snap = buildSnapshot(list, conds, now.toISOString());
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(snap));
  log(`저장: ${out} (서비스 ${snap.count}개, 목록 ${list.length} · 지원조건 ${conds.length})`);
  return snap;
}

// --if-key: 빌드 전에 자동으로 부를 때 쓴다(npm prebuild). 키가 없으면(내 PC·CI) 건너뛰고 있던 파일을 그대로 쓴다.
// 키가 있는데 실패하면 빌드를 멈춘다 — Vercel 은 빌드가 실패하면 이전 배포(이전 데이터)를 그대로 두므로 그게 더 안전하다
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const here = dirname(fileURLToPath(import.meta.url));
  const key = normalizeKey(process.env.DATA_GO_KR_KEY);
  if (!key && process.argv.includes('--if-key')) {
    console.log('혜택 데이터: DATA_GO_KR_KEY 가 없어 받지 않고 넘어갑니다(있던 public/benefits.json 을 그대로 씀).');
    process.exit(0);
  }
  syncBenefits({
    key,
    base: process.env.BENEFITS_API_BASE || DEFAULT_BASE,
    out: resolve(here, '../public/benefits.json')
  }).catch((e) => {
    console.error(`실패: ${e.message}`);
    process.exitCode = 1;
  });
}
