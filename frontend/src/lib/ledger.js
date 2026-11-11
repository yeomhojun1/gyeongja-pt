// 내 지갑 장부: 게시된 이슈를 내 지갑 프로필 숫자로만 계산해 모은다(예시값은 쓰지 않는다).
// 순수 함수라 테스트(frontend/test/ledger.test.js)와 화면(pages/Ledger.jsx)이 같이 쓴다.
// 이슈마다 비교 기준(인하 종료 대비, 작년 시급 대비 …)이 달라서 합계는 참고값이다.
// calculator.scenario 가 true 인 이슈("오른다고 가정하면")는 실제 변화가 아니므로 합계에 넣지 않는다.
// 소득 변화형(최저임금 등)은 그 시급을 받는 사람에게만 해당해서, 근로시간만으로 내 몫이라고 볼 수 없어 이슈 페이지에서 계산하게 한다.

import { SPEND_KEYS, profileInputs, spendKeyOf } from './profile.js';
import { runTemplate } from './templates.js';

/** 내 숫자가 없어서 계산 못 할 때 무엇이 필요한지 */
export function missingReason(calculator) {
  switch (calculator.template) {
    case 'price_change': {
      const k = spendKeyOf(calculator);
      return k ? `한 달 ${SPEND_KEYS[k]}` : null;
    }
    case 'rate_change': return '대출(잔액·금리·남은 기간)';
    case 'fx': return '한 달 해외 결제';
    default: return null;
  }
}

const emptyTotals = () => ({ month: 0, year: 0, once: 0 });

function addTo(totals, e) {
  if (e.period === 'month') totals.month += e.gain;
  else if (e.period === 'year') totals.year += e.gain;
  else totals.once += e.gain;
}

/**
 * issues: 게시된 이슈(최신순). 돌려주는 것
 * - months: [{ month: 'YYYY-MM', entries, totals: { month, year, once } }] 최신 달부터. 실제 변화만
 * - scenarios: 가정 계산 이슈(합계 제외)
 * - missing: [{ issue, need }] 내 숫자가 없어 계산 못 한 이슈. need 가 null 이면 이슈 페이지에서 직접 계산해야 함
 */
export function buildLedger(issues, profile) {
  const months = [];
  const scenarios = [];
  const missing = [];
  for (const issue of issues) {
    const c = issue.calculator;
    if (!c) continue;
    const inp = c.template === 'wage' ? {} : profileInputs(c, profile);
    const r = Object.keys(inp).length ? runTemplate(c.template, c.vars, inp) : { error: 'no input' };
    if (r.error) {
      missing.push({ issue, need: missingReason(c) });
      continue;
    }
    const entry = { issue, gain: r.gain, period: r.period, yearly: r.yearly };
    if (c.scenario) {
      scenarios.push(entry);
      continue;
    }
    const month = issue.publishedAt.slice(0, 7);
    let m = months.find((x) => x.month === month);
    if (!m) {
      m = { month, entries: [], totals: emptyTotals() };
      months.push(m);
    }
    m.entries.push(entry);
    addTo(m.totals, entry);
  }
  months.sort((a, b) => b.month.localeCompare(a.month));
  return { months, scenarios, missing };
}
