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

// 접었다 펴는 묶음. 넣은 칸이 있거나 첫 묶음이면 펼친 채로 시작한다
function Fold({ title, hint, filled, defaultOpen, children }) {
  const [open] = useState(defaultOpen || filled > 0);
  return (
    <details className="fold" open={open}>
      <summary>
        <span className="fold-title">{title}</span>
        <span className="fold-sum">{filled > 0 ? `${filled}칸 넣음` : hint}</span>
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}

const countFilled = (vals) => vals.filter((v) => v !== null && v !== '' && v !== undefined).length;

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
    setMsg(ok ? '저장했습니다. 이제 이슈 계산기에 내 숫자가 들어갑니다.' : '브라우저가 저장을 막았습니다(사생활 보호 모드 등). 이 화면을 닫으면 사라집니다.');
  };
  const clear = () => {
    if (!window.confirm('이 기기에 저장한 내 지갑 숫자를 모두 지우시겠습니까?')) return;
    const empty = sanitizeProfile(null);
    saveProfile(empty);
    setDraft({ ...empty, loan: { principal: null, ratePct: null, months: null, method: 'equalPayment' } });
    setMsg('모두 지웠습니다.');
  };

  return (
    <div className="wallet">
      <h1 className="page-title">내 지갑</h1>
      <p className="page-desc">
        아는 칸만 넣으시면 됩니다. 넣어 두면 이슈마다 내 숫자로 계산하고, 비워 둔 칸은 예시값으로 계산합니다.
        이 기기에만 저장되고 서버로 보내지 않습니다.
      </p>

      <Fold title="나" hint="일하는 형태·사는 집·실수령" defaultOpen filled={countFilled([draft.job, draft.housing, draft.monthlyIncome])}>
        <Chips label="일하는 형태" options={JOBS} value={draft.job} onChange={set('job')} />
        <Chips label="사는 집" options={HOUSINGS} value={draft.housing} onChange={set('housing')} />
        <div className="calc-form">
          <Num id="w-income" label="한 달 실수령" value={draft.monthlyIncome} onChange={set('monthlyIncome')} unit="원" />
        </div>
      </Fold>

      <Fold title="대출" hint="대출이 있을 때만" filled={loanFilled}>
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
      </Fold>

      <Fold title="한 달 지출" hint="기름값·전기·가스·교통·담배" filled={countFilled(Object.values(draft.spend))}>
        <div className="calc-form">
          {Object.entries(SPEND_KEYS).map(([k, label]) => (
            <Num key={k} id={`w-spend-${k}`} label={label} value={draft.spend[k]} onChange={setSpend(k)} unit="원" />
          ))}
        </div>
      </Fold>

      <Fold title="그 밖" hint="근로시간·해외 결제·예금" filled={countFilled([draft.monthlyHours, draft.monthlyUsd, draft.savings])}>
        <div className="calc-form">
          <Num id="w-hours" label="한 달 유급 근로시간" value={draft.monthlyHours} onChange={set('monthlyHours')} unit="시간" note="최저임금 이슈에 씁니다. 주 40시간(주휴 포함)이면 209시간" />
          <Num id="w-usd" label="한 달 해외 결제" value={draft.monthlyUsd} onChange={set('monthlyUsd')} unit="달러" />
          <Num id="w-savings" label="예금·적금 잔액" value={draft.savings} onChange={set('savings')} unit="원" />
        </div>
      </Fold>

      {personas.length > 0 && <p className="muted">이슈 페이지에서 {personas.join('·')} 영향을 먼저 보여 줍니다.</p>}
      <button type="button" className="text-btn" onClick={clear}>이 기기에서 모두 지우기</button>

      <div className="save-bar">
        {msg.startsWith('저장했습니다')
          ? <Link to="/wallet" className="submit-btn">내 지갑 장부 보기</Link>
          : <button type="button" className="submit-btn" onClick={save}>저장</button>}
        {msg && <p className="save-msg" role="status">{msg}</p>}
      </div>
    </div>
  );
}
