// 이슈 페이지 데이터(content/issues/*.json) 검증·정렬. 순수 함수라 테스트(frontend/test/issues.test.js)와
// 화면(src/content/index.js)이 같이 쓴다. 쇼츠 제작 과정이 만든 초안도 이 규칙을 통과해야 게시된다.

import { TEMPLATES } from './templates.js';
import { SPEND_KEYS } from './profile.js';

export const PERSONAS = ['대출자', '세입자', '예금자', '직장인', '자영업자'];
export const SLOTS = ['아침', '점심', '저녁'];
const SLOT_ORDER = { 아침: 0, 점심: 1, 저녁: 2 };

const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** 한 이슈를 검사해 문제 목록을 돌려준다. 빈 배열이면 통과. */
export function validateIssue(issue) {
  const errs = [];
  if (!issue || typeof issue !== 'object') return ['이슈가 객체가 아닙니다.'];
  if (!isText(issue.id) || !/^[a-z0-9-]+$/.test(issue.id)) errs.push('id 는 영문 소문자·숫자·하이픈만 씁니다(주소에 들어감).');
  if (!['draft', 'approved'].includes(issue.status)) errs.push("status 는 'draft' 또는 'approved' 여야 합니다.");
  for (const k of ['title', 'shortsTitle', 'summary', 'why']) if (!isText(issue[k])) errs.push(`${k} 가 비어 있습니다.`);
  if (!isDate(issue.publishedAt)) errs.push('publishedAt 은 YYYY-MM-DD 형식이어야 합니다.');
  if (!isDate(issue.asOf)) errs.push('asOf(수치 기준일)는 YYYY-MM-DD 형식이어야 합니다.');
  if (!SLOTS.includes(issue.slot)) errs.push(`slot 은 ${SLOTS.join('·')} 중 하나여야 합니다.`);

  if (!issue.impacts || typeof issue.impacts !== 'object' || Object.keys(issue.impacts).length === 0) {
    errs.push('impacts(상황별 영향)가 하나 이상 있어야 합니다.');
  } else {
    for (const [k, v] of Object.entries(issue.impacts)) {
      if (!PERSONAS.includes(k)) errs.push(`impacts 의 "${k}" 는 알 수 없는 상황입니다(${PERSONAS.join('·')}).`);
      if (!isText(v)) errs.push(`impacts.${k} 가 비어 있습니다.`);
    }
  }

  if (!Array.isArray(issue.sources) || issue.sources.length === 0) {
    errs.push('sources(출처)가 하나 이상 있어야 합니다.');
  } else {
    issue.sources.forEach((s, i) => {
      if (!isText(s?.org) || !isText(s?.title)) errs.push(`sources[${i}] 에 org(기관명)·title(자료명)이 필요합니다.`);
      if (s?.url !== undefined && !/^https:\/\//.test(s.url)) errs.push(`sources[${i}].url 은 https:// 로 시작해야 합니다.`);
    });
  }

  if (issue.calculator !== undefined) {
    const c = issue.calculator;
    const t = TEMPLATES[c?.template];
    if (!t) {
      errs.push(`calculator.template "${c?.template}" 는 없는 계산 틀입니다(${Object.keys(TEMPLATES).join('·')}).`);
    } else {
      const v = c.vars || {};
      for (const k of t.requiredVars) if (v[k] === undefined) errs.push(`calculator.vars.${k} 가 필요합니다.`);
      const bad = t.checkVars(v);
      if (bad) errs.push(`calculator.vars: ${bad}`);
      if (!isText(c.resultLabel)) errs.push('calculator.resultLabel(결과 문장 앞부분)이 필요합니다.');
      // "오른다고 가정하면"처럼 실제 변화가 아닌 계산이면 true(내 지갑 장부 합계에서 뺀다)
      if (c.scenario !== undefined && typeof c.scenario !== 'boolean') errs.push('calculator.scenario 는 true/false 여야 합니다.');
      // 가격 변화형이 내 지갑의 어느 지출 항목을 쓰는지(없으면 리터 단위만 유류비로 본다)
      if (c.spendKey !== undefined && (c.template !== 'price_change' || !SPEND_KEYS[c.spendKey])) {
        errs.push(`calculator.spendKey 는 가격 변화형에서만 쓰고 ${Object.keys(SPEND_KEYS).join('·')} 중 하나여야 합니다.`);
      }
      // 영상에서 가져온 숫자는 전부 어디서 왔는지 적어야 한다
      for (const k of Object.keys(v)) {
        if (typeof v[k] === 'number' && !isText(c.varSources?.[k])) errs.push(`calculator.varSources.${k}(이 숫자의 출처)가 필요합니다.`);
      }
    }
  }

  if (issue.otherViews !== undefined) {
    if (!Array.isArray(issue.otherViews) || issue.otherViews.length < 2) errs.push('otherViews 는 2개 이상이어야 합니다(한쪽만 싣지 않기).');
    else issue.otherViews.forEach((o, i) => { if (!isText(o?.title) || !isText(o?.body)) errs.push(`otherViews[${i}] 에 title·body 가 필요합니다.`); });
  }
  return errs;
}

/** 게시 대상만(approved) 최신순으로. 같은 날은 저녁 → 점심 → 아침 순 */
export function publishedIssues(list) {
  return list
    .filter((i) => i.status === 'approved')
    .sort((a, b) => (a.publishedAt === b.publishedAt
      ? SLOT_ORDER[b.slot] - SLOT_ORDER[a.slot]
      : b.publishedAt.localeCompare(a.publishedAt)));
}
