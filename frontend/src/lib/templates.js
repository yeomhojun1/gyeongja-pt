// 이슈 페이지 계산 틀. 이슈마다 계산식을 새로 짜지 않고, 이슈 데이터(content/issues/*.json)가
// 틀 이름(template)과 영상에서 가져온 값(vars)만 고른다. 계산은 전부 여기 코드가 한다(AI 계산 없음).
// gain 은 "시청자 지갑 기준 한 달 변화": 양수 = 이득(덜 냄·더 받음), 음수 = 손해.

import { calcLoan, METHODS } from './loan.js';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);

export const TEMPLATES = {
  // 가격 변화형: 유류세·전기요금·담뱃값 등. 단위 가격 변화(perUnitChange, 음수=싸짐) 또는 변화율(changePct)
  price_change: {
    label: '가격 변화형',
    requiredVars: [],
    inputs: [{ key: 'monthlySpend', label: '한 달 지출', unit: '원', min: 0, max: 100_000_000 }],
    checkVars(v) {
      const unitMode = v.perUnitChange !== undefined;
      if (unitMode) {
        if (!(num(v.unitPrice) > 0)) return 'unitPrice(현재 단위 가격)는 0보다 큰 숫자여야 합니다.';
        if (Number.isNaN(num(v.perUnitChange))) return 'perUnitChange 는 숫자여야 합니다.';
      } else if (Number.isNaN(num(v.changePct))) {
        return 'perUnitChange+unitPrice 또는 changePct 중 하나가 필요합니다.';
      }
      if (v.passThroughPct !== undefined && !(num(v.passThroughPct) >= 0 && v.passThroughPct <= 100)) {
        return 'passThroughPct(가격 반영률)는 0~100 이어야 합니다.';
      }
      return null;
    },
    compute(v, inp) {
      const spend = inp.monthlySpend;
      const pass = (v.passThroughPct ?? 100) / 100;
      if (v.perUnitChange !== undefined) {
        const units = spend / v.unitPrice;
        const gain = -units * v.perUnitChange * pass;
        return {
          gain,
          details: [
            [`한 달 사용량(현재 가격 ${v.unitPrice.toLocaleString('ko-KR')}원/${v.unitLabel || '단위'} 기준)`, `약 ${units.toFixed(1)}${v.unitLabel || ''}`],
            [`${v.unitLabel || '단위'}당 가격 변화`, `${v.perUnitChange > 0 ? '+' : ''}${v.perUnitChange.toLocaleString('ko-KR')}원`],
            ['가격 반영률', `${Math.round(pass * 100)}%`]
          ]
        };
      }
      const gain = -spend * (v.changePct / 100) * pass;
      return {
        gain,
        details: [
          ['가격 변화율', `${v.changePct > 0 ? '+' : ''}${v.changePct}%`],
          ['가격 반영률', `${Math.round(pass * 100)}%`]
        ]
      };
    }
  },

  // 금리 변화형: 기준금리·대출금리. 내 대출 조건에 금리 변화(deltaPctPoint)를 더해 첫 달 납입액 차이를 본다
  rate_change: {
    label: '금리 변화형',
    requiredVars: ['deltaPctPoint'],
    inputs: [
      { key: 'principal', label: '대출 잔액', unit: '원', min: 1, max: 100_000_000_000 },
      { key: 'ratePct', label: '지금 금리', unit: '%', min: 0, max: 30, step: 0.01 },
      { key: 'months', label: '남은 기간', unit: '개월', min: 1, max: 600, integer: true },
      { key: 'method', label: '상환 방식', options: METHODS }
    ],
    checkVars(v) {
      if (Number.isNaN(num(v.deltaPctPoint))) return 'deltaPctPoint(금리 변화 %p)는 숫자여야 합니다.';
      if (v.passThroughPct !== undefined && !(num(v.passThroughPct) >= 0 && v.passThroughPct <= 100)) {
        return 'passThroughPct(대출금리 반영률)는 0~100 이어야 합니다.';
      }
      return null;
    },
    compute(v, inp) {
      const pass = (v.passThroughPct ?? 100) / 100;
      const newRate = Math.max(0, Math.round((inp.ratePct + v.deltaPctPoint * pass) * 1000) / 1000);
      const before = calcLoan(inp);
      const after = calcLoan({ ...inp, ratePct: newRate });
      return {
        gain: -(after.firstPayment - before.firstPayment),
        totalGain: -(after.totalInterest - before.totalInterest),
        details: [
          ['금리', `${inp.ratePct}% → ${newRate}%`],
          ['첫 달 납입액', `${Math.round(before.firstPayment).toLocaleString('ko-KR')}원 → ${Math.round(after.firstPayment).toLocaleString('ko-KR')}원`]
        ]
      };
    }
  },

  // 소득 변화형(시급): 최저임금 등. 시급 차이 × 한 달 근무시간
  wage: {
    label: '소득 변화형',
    requiredVars: ['hourlyBefore', 'hourlyAfter'],
    inputs: [{ key: 'monthlyHours', label: '한 달 유급 근로시간', unit: '시간', min: 0, max: 400 }],
    checkVars(v) {
      if (!(num(v.hourlyBefore) > 0) || !(num(v.hourlyAfter) > 0)) return 'hourlyBefore·hourlyAfter 는 0보다 큰 숫자여야 합니다.';
      return null;
    },
    compute(v, inp) {
      const diff = v.hourlyAfter - v.hourlyBefore;
      return {
        gain: inp.monthlyHours * diff,
        details: [
          ['시급', `${v.hourlyBefore.toLocaleString('ko-KR')}원 → ${v.hourlyAfter.toLocaleString('ko-KR')}원 (${diff >= 0 ? '+' : ''}${diff.toLocaleString('ko-KR')}원)`],
          ['월 환산(입력한 시간 기준)', `${Math.round(inp.monthlyHours * v.hourlyBefore).toLocaleString('ko-KR')}원 → ${Math.round(inp.monthlyHours * v.hourlyAfter).toLocaleString('ko-KR')}원`]
        ]
      };
    }
  },

  // 환율형: 해외 결제·여행 경비(달러). 환율이 오르면 같은 달러를 내는 데 원화가 더 든다
  fx: {
    label: '환율형',
    requiredVars: ['rateBefore', 'rateAfter'],
    inputs: [{ key: 'monthlyUsd', label: '한 달 해외 결제', unit: '달러', min: 0, max: 10_000_000 }],
    checkVars(v) {
      if (!(num(v.rateBefore) > 0) || !(num(v.rateAfter) > 0)) return 'rateBefore·rateAfter(원/달러)는 0보다 큰 숫자여야 합니다.';
      return null;
    },
    compute(v, inp) {
      return {
        gain: -inp.monthlyUsd * (v.rateAfter - v.rateBefore),
        details: [
          ['환율(원/달러)', `${v.rateBefore.toLocaleString('ko-KR')} → ${v.rateAfter.toLocaleString('ko-KR')}`],
          ['원화로 낼 돈', `${Math.round(inp.monthlyUsd * v.rateBefore).toLocaleString('ko-KR')}원 → ${Math.round(inp.monthlyUsd * v.rateAfter).toLocaleString('ko-KR')}원`]
        ]
      };
    }
  },

  // 지원금·공제형: 조건을 모두 충족하면 amount 를 받는다
  subsidy: {
    label: '지원금·공제형',
    requiredVars: ['amount', 'conditions'],
    inputs: [{ key: 'checks', label: '해당하는 조건', checklist: true }],
    checkVars(v) {
      if (!(num(v.amount) > 0)) return 'amount 는 0보다 큰 숫자여야 합니다.';
      if (!Array.isArray(v.conditions) || v.conditions.length === 0 || v.conditions.some((c) => typeof c !== 'string')) {
        return 'conditions 는 비어 있지 않은 문자열 배열이어야 합니다.';
      }
      if (v.period !== undefined && !['once', 'month', 'year'].includes(v.period)) return "period 는 'once'·'month'·'year' 중 하나여야 합니다.";
      return null;
    },
    compute(v, inp) {
      const checks = Array.isArray(inp.checks) ? inp.checks : [];
      const eligible = v.conditions.every((_, i) => checks[i] === true);
      const period = v.period || 'once';
      return {
        gain: eligible ? v.amount : 0,
        period,
        eligible,
        details: [['조건 충족', eligible ? '모두 충족' : `${checks.filter(Boolean).length}/${v.conditions.length}개 충족`]]
      };
    }
  }
};

// 받침 유무에 따라 조사를 고른다 ('지출을' / '금리를'). backend/validate.js josa 와 같은 방식
function josa(word, withFinal, withoutFinal) {
  const last = String(word).slice(-1).charCodeAt(0);
  const hasFinal = last >= 0xac00 && last <= 0xd7a3 ? (last - 0xac00) % 28 !== 0 : true;
  return `${word}${hasFinal ? withFinal : withoutFinal}`;
}

/** 계산기 입력값 검증. 문제가 있으면 한국어 메시지, 없으면 null */
export function validateInputs(template, inp) {
  const t = TEMPLATES[template];
  if (!t) return '알 수 없는 계산 틀입니다.';
  for (const f of t.inputs) {
    const v = inp[f.key];
    if (f.checklist) continue;
    if (f.options) {
      if (!f.options[v]) return `${josa(f.label, '을', '를')} 골라주세요.`;
      continue;
    }
    if (typeof v !== 'number' || !Number.isFinite(v)) return `${josa(f.label, '을', '를')} 숫자로 입력해주세요.`;
    if (v < f.min || v > f.max) return `${josa(f.label, '은', '는')} ${f.min.toLocaleString('ko-KR')}~${f.max.toLocaleString('ko-KR')}${f.unit} 사이로 입력해주세요.`;
    if (f.integer && !Number.isInteger(v)) return `${josa(f.label, '은', '는')} 정수로 입력해주세요.`;
  }
  return null;
}

/** 계산 실행. 입력이 틀리면 {error}, 맞으면 compute 결과 + 연간 환산 */
export function runTemplate(template, vars, inp) {
  const error = validateInputs(template, inp);
  if (error) return { error };
  const r = TEMPLATES[template].compute(vars, inp);
  const period = r.period || 'month';
  return { ...r, period, yearly: period === 'month' ? r.gain * 12 : null };
}
