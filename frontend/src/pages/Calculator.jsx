import { useState } from 'react';
import NumberInput from '../components/NumberInput';
import { METHODS, compareRates, validateLoan, won, signedWon } from '../lib/loan';

// 내 상황 계산기: 대출 잔액·금리·남은 기간·상환 방식을 넣으면 금리가 바뀔 때 납입액·이자 변화를 표로 보여 준다.
// 계산은 전부 lib/loan.js 코드가 한다. AI·서버 없이 데모에서도 똑같이 동작한다.
const FIRST_LABEL = {
  equalPayment: '월 납입액(매달 같음)',
  equalPrincipal: '첫 달 납입액',
  bullet: '월 이자(만기 전)'
};

export default function Calculator() {
  const [principal, setPrincipal] = useState(100_000_000);
  const [ratePct, setRatePct] = useState(4.5);
  const [years, setYears] = useState(30);
  const [method, setMethod] = useState('equalPayment');

  const months = Math.round(years * 12);
  const input = { principal, ratePct, months, method };
  const error = Number.isFinite(years) ? validateLoan(input) : '남은 기간을 숫자로 입력해주세요.';
  const rows = error ? [] : compareRates(input);

  return (
    <div>
      <h1 className="page-title">대출 계산기</h1>
      <p className="page-desc">금리가 0.25·0.5·1%p 오르거나 내리면 내 대출 납입액과 이자가 얼마나 바뀌는지 봅니다.</p>

      <div className="calc-form">
        <div className="form-group">
          <label htmlFor="loan-principal">대출 잔액</label>
          <NumberInput id="loan-principal" value={principal} onChange={setPrincipal} unit="원" />
        </div>
        <div className="form-group">
          <label htmlFor="loan-rate">지금 금리(연)</label>
          <NumberInput id="loan-rate" value={ratePct} onChange={setRatePct} unit="%" decimals={2} />
        </div>
        <div className="form-group">
          <label htmlFor="loan-years">남은 기간</label>
          <NumberInput id="loan-years" value={years} onChange={setYears} unit="년" decimals={2} />
        </div>
        <div className="form-group">
          <span className="group-label">상환 방식</span>
          <div className="method-row" role="radiogroup" aria-label="상환 방식">
            {Object.entries(METHODS).map(([k, label]) => (
              <button
                key={k}
                role="radio"
                aria-checked={method === k}
                className={`persona-chip${method === k ? ' active' : ''}`}
                onClick={() => setMethod(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {!error && (
        <>
          <div className="table-wrap">
            <table className="rate-table">
              <thead>
                <tr>
                  <th>금리</th>
                  <th>{FIRST_LABEL[method]}</th>
                  <th>지금보다</th>
                  <th>총이자</th>
                  <th>지금보다</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.delta} className={r.delta === 0 ? 'base-row' : ''}>
                    <td>
                      {r.rate.toFixed(2)}%
                      <span className="delta">{r.delta === 0 ? '지금' : `${r.delta > 0 ? '+' : ''}${r.delta}%p`}</span>
                      {r.clamped && <span className="delta">0% 아래라 0%로 계산</span>}
                    </td>
                    <td>{won(r.firstPayment)}</td>
                    <td className={Math.round(r.firstPaymentDiff) > 0 ? 'loss' : Math.round(r.firstPaymentDiff) < 0 ? 'gain' : ''}>{r.delta === 0 ? '—' : signedWon(r.firstPaymentDiff)}</td>
                    <td>{won(r.totalInterest)}</td>
                    <td className={Math.round(r.totalInterestDiff) > 0 ? 'loss' : Math.round(r.totalInterestDiff) < 0 ? 'gain' : ''}>{r.delta === 0 ? '—' : signedWon(r.totalInterestDiff)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="calc-notes">
            <li>원리금균등: 매달 같은 금액(원금+이자)을 냅니다. 원금균등: 원금을 똑같이 나눠 내고 이자는 점점 줄어 첫 달이 가장 많습니다. 만기일시: 매달 이자만 내고 원금은 마지막에 한 번에 갚습니다.</li>
            <li>월 이율 = 연 금리 ÷ 12로 계산했고, 중도상환수수료·보증료·우대금리는 넣지 않았습니다. 은행 실제 금액과 몇 원~몇십 원 차이가 날 수 있습니다.</li>
            <li>고정금리 대출은 고정 기간 동안 금리가 바뀌지 않습니다.</li>
          </ul>
        </>
      )}
    </div>
  );
}
