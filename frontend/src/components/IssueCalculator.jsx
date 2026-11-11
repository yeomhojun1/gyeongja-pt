import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import NumberInput from './NumberInput';
import { TEMPLATES, runTemplate } from '../lib/templates';
import { signedWon } from '../lib/loan';
import { profileInputs, sameAsProfile, withCalculatorInputs } from '../lib/profile';

const VAR_LABELS = {
  unitPrice: '현재 가격',
  perUnitChange: '단위당 가격 변화',
  changePct: '가격 변화율',
  passThroughPct: '가격 반영률(가정)',
  deltaPctPoint: '금리 변화',
  hourlyBefore: '이전 시급',
  hourlyAfter: '바뀐 시급',
  rateBefore: '이전 환율',
  rateAfter: '바뀐 환율',
  amount: '지원 금액'
};

const VAR_UNITS = { unitPrice: '원', perUnitChange: '원', changePct: '%', passThroughPct: '%', deltaPctPoint: '%p', hourlyBefore: '원', hourlyAfter: '원', rateBefore: '원', rateAfter: '원', amount: '원' };

const PERIOD_TEXT = { month: '매달', year: '매년', once: '한 번' };

// 이슈 페이지 첫 화면의 계산기. 영상에서 가져온 값(vars)은 이미 들어가 있고, 시청자는 내 숫자만 바꾼다.
// 내 지갑 프로필이 있으면 내 숫자도 미리 채우고, 없으면 지금 넣은 숫자를 프로필에 저장할 수 있게 한다.
export default function IssueCalculator({ calculator, profile, onSaveProfile }) {
  const { template, vars, varSources = {}, inputs: defaults = {}, inputNotes = {}, notes = [], resultLabel } = calculator;
  const t = TEMPLATES[template];
  const initial = () => {
    const v = { ...defaults, ...profileInputs(calculator, profile) };
    if (template === 'subsidy' && !Array.isArray(v.checks)) v.checks = vars.conditions.map(() => false);
    return v;
  };
  const [inp, setInp] = useState(initial);
  const [pass, setPass] = useState(vars.passThroughPct);
  const [saved, setSaved] = useState(false);

  // 다른 이슈로 이동하면 기본값으로 되돌린다
  useEffect(() => { setInp(initial()); setPass(vars.passThroughPct); setSaved(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [calculator]);

  const effVars = pass === undefined ? vars : { ...vars, passThroughPct: Number.isFinite(pass) ? Math.min(100, Math.max(0, pass)) : vars.passThroughPct };
  const r = runTemplate(template, effVars, inp);
  const set = (k) => (v) => setInp((prev) => ({ ...prev, [k]: v }));
  const fromProfile = profileInputs(calculator, profile);
  const usingProfile = sameAsProfile(calculator, inp, profile);
  const nextProfile = r.error || usingProfile ? null : withCalculatorInputs(calculator, inp, profile);
  const save = () => { onSaveProfile(nextProfile); setSaved(true); };

  const shownVars = Object.entries(vars).filter(([k, v]) => typeof v === 'number' && k !== 'passThroughPct');

  return (
    // 휴대폰 첫 화면에 결과까지 보이도록 내 숫자 → 결과 → 영상에서 가져온 값(출처·가정) 순서로 둔다
    <section className="calc-card" aria-label="내 지갑 계산기">
      <div className={`calc-mine calc-mine-${template}`}>
        <div className="calc-section-label">내 숫자</div>
        {t.inputs.map((f) => {
          if (f.checklist) {
            return (
              <fieldset key={f.key} className="check-list">
                <legend>{f.label}</legend>
                {vars.conditions.map((c, i) => (
                  <label key={c}>
                    <input
                      type="checkbox"
                      checked={Boolean(inp.checks?.[i])}
                      onChange={(e) => setInp((prev) => {
                        const checks = [...(prev.checks || [])];
                        checks[i] = e.target.checked;
                        return { ...prev, checks };
                      })}
                    />
                    {c}
                  </label>
                ))}
              </fieldset>
            );
          }
          if (f.options) {
            return (
              <div key={f.key} className="form-group">
                <label htmlFor={`in-${f.key}`}>{f.label}</label>
                <select id={`in-${f.key}`} value={inp[f.key]} onChange={(e) => set(f.key)(e.target.value)}>
                  {Object.entries(f.options).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
            );
          }
          return (
            <div key={f.key} className="form-group">
              <label htmlFor={`in-${f.key}`}>{f.label}</label>
              <NumberInput id={`in-${f.key}`} value={inp[f.key]} onChange={set(f.key)} unit={f.unit} decimals={f.step ? 2 : 0} />
              {f.key in fromProfile
                ? <div className="input-note">내 지갑에 저장된 값입니다.</div>
                : inputNotes[f.key] && <div className="input-note">{inputNotes[f.key]}</div>}
            </div>
          );
        })}
        {usingProfile && (
          <div className="profile-bar">
            {saved ? '내 지갑에 저장했어요. 다음 이슈부터 자동으로 들어갑니다.' : '내 지갑 숫자로 계산했어요.'}
            <Link to="/me">내 지갑 고치기</Link>
          </div>
        )}
        {nextProfile && (
          <div className="profile-bar">
            <button type="button" className="profile-save" onClick={save}>이 숫자를 내 지갑에 저장</button>
            <span>다음 이슈부터 자동으로 들어갑니다. 이 기기에만 저장돼요.</span>
          </div>
        )}
      </div>

      <div className="calc-result" aria-live="polite">
        {r.error ? (
          <div className="calc-error">{r.error}</div>
        ) : (
          <>
            <div className="result-label">{resultLabel}</div>
            <div className={`result-amount ${Math.round(r.gain) > 0 ? 'gain' : Math.round(r.gain) < 0 ? 'loss' : ''}`}>
              {PERIOD_TEXT[r.period]} {signedWon(r.gain)}
              <span className="result-tag">{Math.round(r.gain) > 0 ? '이득' : Math.round(r.gain) < 0 ? '손해' : '변화 없음'}</span>
            </div>
            {r.yearly !== null && Math.round(r.gain) !== 0 && <div className="result-sub">1년이면 {signedWon(r.yearly)}</div>}
            {r.totalGain !== undefined && <div className="result-sub">남은 기간 총이자 기준 {signedWon(r.totalGain)}</div>}
            <ul className="result-details">
              {r.details.map(([k, v]) => <li key={k}><span>{k}</span><span>{v}</span></li>)}
            </ul>
          </>
        )}
      </div>

      <div className="calc-from">
        <div className="calc-section-label">영상에서 가져온 값</div>
        <ul className="var-list">
          {shownVars.map(([k, v]) => (
            <li key={k}>
              <span className="var-name">{VAR_LABELS[k] || k}</span>
              <span className="var-value">{v > 0 && (k === 'perUnitChange' || k === 'deltaPctPoint' || k === 'changePct') ? '+' : ''}{v.toLocaleString('ko-KR')}{VAR_UNITS[k] || ''}{k === 'unitPrice' && vars.unitLabel ? `/${vars.unitLabel}` : ''}</span>
              {varSources[k] && <span className="var-source">{varSources[k]}</span>}
            </li>
          ))}
        </ul>
        {pass !== undefined && (
          <div className="form-group pass-group">
            <label htmlFor="in-pass">{template === 'rate_change' ? '내 대출금리에 반영되는 비율(가정)' : '가격에 반영되는 비율(가정)'}</label>
            <NumberInput id="in-pass" value={pass} onChange={setPass} unit="%" />
            {varSources.passThroughPct && <div className="input-note">{varSources.passThroughPct}</div>}
          </div>
        )}
      </div>

      {notes.length > 0 && (
        <ul className="calc-notes">
          {notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
    </section>
  );
}
