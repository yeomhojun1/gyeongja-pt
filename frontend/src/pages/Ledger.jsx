import { Link } from 'react-router-dom';
import { ISSUES } from '../content';
import { signedWon } from '../lib/loan';
import { buildLedger } from '../lib/ledger';
import { isEmptyProfile } from '../lib/profile';
import { useProfile } from '../lib/useProfile';

// 내 지갑 장부: 이슈가 올라올 때마다 내 숫자 기준 영향이 한 줄씩 쌓인다(lib/ledger.js). 다시 들어올 이유가 되는 화면.
const PERIOD_TEXT = { month: '매달', year: '매년', once: '한 번' };
const tone = (v) => (Math.round(v) > 0 ? 'gain' : Math.round(v) < 0 ? 'loss' : '');
const monthLabel = (m) => `${m.slice(0, 4)}년 ${Number(m.slice(5))}월`;

function Row({ e }) {
  return (
    <li>
      <Link to={`/i/${e.issue.id}`} className="ledger-row">
        <span className="ledger-title">
          <span className="ledger-date">{e.issue.publishedAt.slice(5).replace('-', '.')}</span>
          {e.issue.title}
        </span>
        <span className={`ledger-amount ${tone(e.gain)}`}>{PERIOD_TEXT[e.period]} {signedWon(e.gain)}</span>
      </Link>
    </li>
  );
}

export default function Ledger() {
  const [profile] = useProfile();

  if (isEmptyProfile(profile)) {
    return (
      <div>
        <h1 className="page-title">내 지갑 장부</h1>
        <p className="page-desc">이슈가 올라올 때마다 내 지갑에 생기는 변화를 한 줄씩 모아 보여 줍니다.</p>
        <Link to="/me" className="wallet-card">
          <strong>먼저 내 숫자를 넣어 주세요</strong>
          <span>대출·월급·한 달 지출을 넣으면 지금까지 올라온 이슈가 내 숫자로 계산돼 여기에 쌓입니다. 이 기기에만 저장됩니다.</span>
        </Link>
      </div>
    );
  }

  const { months, scenarios, missing } = buildLedger(ISSUES, profile);
  const latest = months[0];

  return (
    <div className="ledger">
      <h1 className="page-title">내 지갑 장부</h1>
      <p className="page-desc">
        올라온 이슈를 내 지갑 숫자로 계산해 모았어요. <Link to="/me">내 숫자 고치기</Link>
      </p>

      {latest ? (
        <section className="ledger-summary" aria-label="이번 달 합계">
          <div className="result-label">{monthLabel(latest.month)} 이슈로 내 지갑은</div>
          <div className={`result-amount ${tone(latest.totals.month)}`}>매달 {signedWon(latest.totals.month)}</div>
          {Math.round(latest.totals.month) !== 0 && <div className="result-sub">1년이면 {signedWon(latest.totals.month * 12)}</div>}
          {Math.round(latest.totals.year) !== 0 && <div className="result-sub">매년 {signedWon(latest.totals.year)}</div>}
          {Math.round(latest.totals.once) !== 0 && <div className="result-sub">한 번 {signedWon(latest.totals.once)}</div>}
        </section>
      ) : (
        <p className="muted">아직 내 숫자로 계산된 이슈가 없어요. 아래에서 필요한 숫자를 확인해 보세요.</p>
      )}

      {months.map((m) => (
        <section key={m.month} className="issue-section">
          <h2>{monthLabel(m.month)}</h2>
          <ul className="ledger-list">{m.entries.map((e) => <Row key={e.issue.id} e={e} />)}</ul>
        </section>
      ))}

      {scenarios.length > 0 && (
        <section className="issue-section">
          <h2>가정 계산</h2>
          <p className="muted">실제로 바뀐 게 아니라 "이렇게 된다면"을 계산한 이슈라서 합계에 넣지 않았어요.</p>
          <ul className="ledger-list">{scenarios.map((e) => <Row key={e.issue.id} e={e} />)}</ul>
        </section>
      )}

      {missing.length > 0 && (
        <section className="issue-section">
          <h2>장부에 아직 안 들어간 이슈</h2>
          <p className="muted">내 숫자를 넣으면 계산되는 이슈와, 최저임금처럼 해당하는 사람만 이슈 페이지에서 직접 계산하는 이슈입니다.</p>
          <ul className="ledger-list">
            {missing.map(({ issue, need }) => (
              <li key={issue.id}>
                <Link to={need ? '/me' : `/i/${issue.id}`} className="ledger-row">
                  <span className="ledger-title">
                    <span className="ledger-date">{issue.publishedAt.slice(5).replace('-', '.')}</span>
                    {issue.title}
                  </span>
                  <span className="ledger-need">{need ? `${need} 넣기` : '이슈에서 계산'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="disclaimer">
        이슈마다 비교 기준(인하 종료 대비, 작년 시급 대비 등)이 달라 합계는 참고값입니다. 가격 반영률 같은 가정은 각 이슈 페이지에서 바꿔 볼 수 있습니다.
        투자·금융 상품 권유가 아닙니다.
      </p>
    </div>
  );
}
