import { useState } from 'react';
import { Link } from 'react-router-dom';
import NumberInput from '../components/NumberInput';
import { ISSUES } from '../content';
import { signedWon } from '../lib/loan';
import { buildLedger } from '../lib/ledger';
import { isEmptyProfile } from '../lib/profile';
import { useProfile } from '../lib/useProfile';
import {
  calcFreedom, diffText, eokText, freedomInputs, periodText, reachMonth, validateFreedom
} from '../lib/freedom';

// 경제적 자유 숫자: 목표 금액과 도달 시점을 내 숫자로 센다(lib/freedom.js). 넣은 값은 내 지갑 프로필에 같이 저장한다.
const toNull = (v) => (Number.isFinite(v) ? v : null);
const FROM_NOTE = {
  savings: '내 지갑의 예금·적금 잔액에서 가져온 값입니다.',
  income: '내 지갑의 한 달 실수령 − 생활비로 계산한 값입니다.'
};
const KEYS = ['monthlyExpense', 'assets', 'monthlySaving', 'returnPct', 'withdrawPct'];

function Num({ id, label, value, onChange, unit, decimals, note }) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <NumberInput id={id} value={value} onChange={(v) => onChange(toNull(v))} unit={unit} decimals={decimals} />
      {note && <div className="input-note">{note}</div>}
    </div>
  );
}

export default function Freedom() {
  const [profile, saveProfile] = useProfile();
  const [{ inputs: start, from }] = useState(() => freedomInputs(profile));
  const [inp, setInp] = useState(start);
  const [msg, setMsg] = useState('');
  const set = (k) => (v) => { setInp((d) => ({ ...d, [k]: v })); setMsg(''); };
  // 저축 칸을 직접 고치기 전까지는 (실수령 − 생활비)를 따라간다
  const income = profile.monthlyIncome;
  const [autoSaving, setAutoSaving] = useState(income !== null && (start.monthlySaving === null || from.monthlySaving === 'income'));
  const setExpense = (v) => {
    setInp((d) => ({ ...d, monthlyExpense: v, monthlySaving: autoSaving && v !== null && v <= income ? income - v : autoSaving ? null : d.monthlySaving }));
    setMsg('');
  };
  const setSaving = (v) => { setAutoSaving(false); set('monthlySaving')(v); };

  const filled = inp.monthlyExpense !== null;
  const error = filled ? validateFreedom(inp) : null;
  // 내 지갑 장부의 이번 달 영향(매달 ±원)을 저축에 더해 보면 도달 시점이 얼마나 바뀌는지
  const latest = isEmptyProfile(profile) ? null : buildLedger(ISSUES, profile).months[0];
  const r = filled && !error ? calcFreedom(inp, { extraMonthly: latest?.totals.month ?? 0 }) : null;

  const saved = KEYS.every((k) => (profile[k] ?? null) === inp[k]);
  const save = () => {
    const ok = saveProfile({ ...profile, ...inp });
    setMsg(ok ? '내 지갑에 저장했어요. 다음에 오면 이 숫자로 시작합니다.' : '브라우저가 저장을 막았어요(사생활 보호 모드 등). 이 화면을 닫으면 사라집니다.');
  };

  return (
    <div className="freedom wallet">
      <h1 className="page-title">경제적 자유 숫자</h1>
      <p className="page-desc">
        일하지 않아도 생활비가 나오려면 얼마가 필요하고, 지금 속도로 언제 닿는지 셉니다. 모든 금액은 오늘 돈 가치 기준입니다.
      </p>

      <section className="wallet-section">
        <div className="calc-form">
          <Num id="f-expense" label="한 달 생활비" value={inp.monthlyExpense} onChange={setExpense} unit="원" note="일을 그만둔 뒤에도 쓸 돈(대출 상환 제외 권장)" />
          <Num id="f-assets" label="지금 모아 둔 돈" value={inp.assets} onChange={set('assets')} unit="원" note={from.assets ? FROM_NOTE[from.assets] : '예금·적금·투자금 합계(빚은 빼고)'} />
          <Num id="f-saving" label="한 달 저축" value={inp.monthlySaving} onChange={setSaving} unit="원" note={autoSaving && inp.monthlySaving !== null ? FROM_NOTE.income : undefined} />
        </div>
      </section>

      {!filled && <p className="muted">한 달 생활비를 넣으면 바로 계산됩니다.</p>}
      {error && <p className="calc-error" role="alert">{error}</p>}

      {r && (
        <>
          <section className="ledger-summary freedom-result" aria-label="계산 결과">
            <div className="result-label">내 경제적 자유 숫자</div>
            <div className="result-amount gain">{eokText(r.target)}</div>
            <div className="result-sub">1년 생활비 {eokText(inp.monthlyExpense * 12)} ÷ 인출률 {inp.withdrawPct}%</div>

            <div className="freedom-bar" role="progressbar" aria-valuenow={Math.round(r.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="목표 대비 지금">
              <span style={{ width: `${r.progress * 100}%` }} />
            </div>
            <div className="result-sub">지금 {Math.floor(r.progress * 1000) / 10}% (모아 둔 돈 {eokText(inp.assets)})</div>

            <div className="freedom-when">
              {r.months === 0 && <>이미 목표를 넘었어요</>}
              {r.months === null && <>지금 속도로는 100년 넘게 걸려요</>}
              {r.months > 0 && <>지금 속도면 <strong>{periodText(r.months)}</strong> 뒤 ({reachMonth(r.months)})</>}
            </div>
            <ul className="result-details">
              <li><span>지금 일을 멈추면</span><span>생활비 {Math.floor(r.runwayMonths)}개월치</span></li>
              <li><span>가정</span><span>실질 수익률 {inp.returnPct}% · 인출률 {inp.withdrawPct}% (아래에서 바꾸기)</span></li>
            </ul>
          </section>

          {r.months !== 0 && (
            <section className="issue-section">
              <h2>이렇게 하면</h2>
              <ul className="ledger-list">
                {r.whatIf.map((w) => (
                  <li key={w.key} className="ledger-row">
                    <span className="ledger-title">
                      {w.label}
                      <span className="ledger-date">{w.months === null ? '100년 넘게' : `${periodText(w.months)} 뒤`}{w.target ? ` · 목표 ${eokText(w.target)}` : ''}</span>
                    </span>
                    <span className={`ledger-amount ${w.months === r.months ? '' : (w.months !== null && (r.months === null || w.months < r.months)) ? 'gain' : 'loss'}`}>
                      {diffText(r.months, w.months)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {r.extra && r.months !== 0 && (
            <section className="issue-section">
              <h2>이번 달 이슈를 반영하면</h2>
              <Link to="/wallet" className="ledger-row">
                <span className="ledger-title">
                  내 지갑 장부의 이번 달 영향(매달 {signedWon(r.extra.amount)})을 저축에 더하면
                  <span className="ledger-date">{r.extra.months === null ? '100년 넘게' : `${periodText(r.extra.months)} 뒤`}</span>
                </span>
                <span className={`ledger-amount ${r.extra.months === r.months ? '' : r.extra.amount > 0 ? 'gain' : 'loss'}`}>{diffText(r.months, r.extra.months)}</span>
              </Link>
            </section>
          )}
        </>
      )}

      <section className="wallet-section">
        <h2>가정</h2>
        <div className="calc-form">
          <Num id="f-return" label="실질 수익률(연)" value={inp.returnPct} onChange={set('returnPct')} unit="%" decimals={1} note="물가 상승을 뺀 수익률 가정입니다. 특정 상품의 수익률이 아닙니다." />
          <Num id="f-withdraw" label="인출률(연)" value={inp.withdrawPct} onChange={set('withdrawPct')} unit="%" decimals={1} note="모은 돈에서 해마다 꺼내 쓰는 비율. 4%는 미국 과거 자료에서 나온 경험 규칙이고, 앞으로도 맞는다는 보장은 없습니다." />
        </div>
      </section>

      <div className="wallet-actions">
        <button type="button" className="submit-btn" onClick={save} disabled={saved}>{saved ? '내 지갑에 저장됨' : '내 지갑에 저장'}</button>
      </div>
      {msg && <p className="save-msg" role="status">{msg}</p>}

      <ul className="calc-notes">
        <li>매달 말에 저축하고 월 복리로 불어난다고 보고 계산합니다. 세금·수수료·국민연금은 넣지 않았습니다.</li>
        <li>실제 수익률은 해마다 오르내리고, 손실이 날 수도 있습니다. 결과는 계획을 세우기 위한 참고값입니다.</li>
      </ul>
      <p className="disclaimer">투자·금융 상품 권유가 아닙니다. 수익률·인출률은 가정이며 사용자가 직접 바꿀 수 있습니다.</p>
    </div>
  );
}
