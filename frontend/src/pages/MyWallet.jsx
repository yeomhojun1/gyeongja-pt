import { useState } from 'react';
import { Link } from 'react-router-dom';
import NumberInput from '../components/NumberInput';
import { METHODS } from '../lib/loan';
import { HOUSINGS, JOBS, SPEND_KEYS, derivePersonas, sanitizeProfile } from '../lib/profile';
import { useProfile } from '../lib/useProfile';

// 내 지갑: 한 번 넣어 두면 이슈 계산기·대출 계산기에 내 숫자가 들어간다. 모든 칸은 선택이고,
// 이 기기 브라우저에만 저장한다(lib/useProfile.js). 비워 둔 칸은 이슈에 적힌 예시값으로 계산한다.
const toNull = (v) => (Number.isFinite(v) ? v : null);

function Chips({ label, options, value, onChange }) {
  return (
    <div className="form-group">
      <span className="group-label">{label}</span>
      <div className="method-row" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            className={`persona-chip${value === o ? ' active' : ''}`}
            onClick={() => onChange(value === o ? '' : o)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function Num({ id, label, value, onChange, unit, decimals, note }) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <NumberInput id={id} value={value} onChange={(v) => onChange(toNull(v))} unit={unit} decimals={decimals} />
      {note && <div className="input-note">{note}</div>}
    </div>
  );
}

export default function MyWallet() {
  const [profile, saveProfile] = useProfile();
  // 대출은 세 칸이 다 차야 저장되므로, 입력 중인 값은 따로 들고 있는다
  const [draft, setDraft] = useState(() => ({
    ...profile,
    loan: profile.loan || { principal: null, ratePct: null, months: null, method: 'equalPayment' }
  }));
  const [msg, setMsg] = useState('');

  const set = (k) => (v) => { setDraft((d) => ({ ...d, [k]: v })); setMsg(''); };
  const setLoan = (k) => (v) => { setDraft((d) => ({ ...d, loan: { ...d.loan, [k]: v } })); setMsg(''); };
  const setSpend = (k) => (v) => { setDraft((d) => ({ ...d, spend: { ...d.spend, [k]: v } })); setMsg(''); };

  const { principal, ratePct, months } = draft.loan;
  const loanFilled = [principal, ratePct, months].filter((v) => v !== null).length;
  const loanPartial = loanFilled > 0 && loanFilled < 3;
  const personas = derivePersonas(sanitizeProfile(draft));

  const save = () => {
    const ok = saveProfile(draft);
    setMsg(ok ? '저장했어요. 이제 이슈 계산기에 내 숫자가 들어갑니다.' : '브라우저가 저장을 막았어요(사생활 보호 모드 등). 이 화면을 닫으면 사라집니다.');
  };
  const clear = () => {
    if (!window.confirm('이 기기에 저장한 내 지갑 숫자를 모두 지울까요?')) return;
    const empty = sanitizeProfile(null);
    saveProfile(empty);
    setDraft({ ...empty, loan: { principal: null, ratePct: null, months: null, method: 'equalPayment' } });
    setMsg('모두 지웠어요.');
  };

  return (
    <div className="wallet">
      <h1 className="page-title">내 지갑</h1>
      <p className="page-desc">
        한 번 넣어 두면 모든 이슈 계산기와 대출 계산기에 내 숫자가 들어갑니다. 모든 칸은 선택이고,
        이 기기 브라우저에만 저장돼 서버로 보내지 않습니다.
      </p>

      <section className="wallet-section">
        <h2>나</h2>
        <Chips label="일하는 형태" options={JOBS} value={draft.job} onChange={set('job')} />
        <Chips label="사는 집" options={HOUSINGS} value={draft.housing} onChange={set('housing')} />
        <div className="calc-form">
          <Num id="w-income" label="한 달 실수령" value={draft.monthlyIncome} onChange={set('monthlyIncome')} unit="원" />
          <Num id="w-hours" label="한 달 유급 근로시간" value={draft.monthlyHours} onChange={set('monthlyHours')} unit="시간" note="주 40시간(주휴 포함)이면 209시간" />
        </div>
      </section>

      <section className="wallet-section">
        <h2>대출</h2>
        <div className="calc-form">
          <Num id="w-principal" label="대출 잔액" value={principal} onChange={setLoan('principal')} unit="원" />
          <Num id="w-rate" label="지금 금리(연)" value={ratePct} onChange={setLoan('ratePct')} unit="%" decimals={2} />
          <Num id="w-months" label="남은 기간" value={months} onChange={setLoan('months')} unit="개월" />
          <div className="form-group wide">
            <span className="group-label">상환 방식</span>
            <div className="method-row" role="radiogroup" aria-label="상환 방식">
              {Object.entries(METHODS).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={draft.loan.method === k}
                  className={`persona-chip${draft.loan.method === k ? ' active' : ''}`}
                  onClick={() => setLoan('method')(k)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {loanPartial && <p className="muted">잔액·금리·남은 기간을 모두 넣어야 계산에 쓰입니다.</p>}
      </section>

      <section className="wallet-section">
        <h2>한 달 지출</h2>
        <div className="calc-form">
          {Object.entries(SPEND_KEYS).map(([k, label]) => (
            <Num key={k} id={`w-spend-${k}`} label={label} value={draft.spend[k]} onChange={setSpend(k)} unit="원" />
          ))}
        </div>
      </section>

      <section className="wallet-section">
        <h2>그 밖</h2>
        <div className="calc-form">
          <Num id="w-usd" label="한 달 해외 결제" value={draft.monthlyUsd} onChange={set('monthlyUsd')} unit="달러" />
          <Num id="w-savings" label="예금·적금 잔액" value={draft.savings} onChange={set('savings')} unit="원" />
        </div>
      </section>

      {personas.length > 0 && <p className="muted">이슈 페이지에서 {personas.join('·')} 영향을 먼저 보여 줍니다.</p>}

      <div className="wallet-actions">
        <button type="button" className="submit-btn" onClick={save}>저장</button>
        <button type="button" className="ghost-btn" onClick={clear}>이 기기에서 지우기</button>
      </div>
      {msg && <p className="save-msg" role="status">{msg}</p>}
      {msg.startsWith('저장했어요') && <Link to="/wallet" className="ghost-btn wallet-next">내 지갑 장부 보기</Link>}
    </div>
  );
}
