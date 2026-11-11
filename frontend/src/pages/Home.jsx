import { Link } from 'react-router-dom';
import { ISSUES } from '../content';
import { TEMPLATES } from '../lib/templates';
import { signedWon } from '../lib/loan';
import { buildLedger } from '../lib/ledger';
import { isEmptyProfile } from '../lib/profile';
import { useProfile } from '../lib/useProfile';
import { calcFreedom, freedomInputs, periodText, validateFreedom } from '../lib/freedom';

const tools = [
  { path: '/benefits', name: '받을 수 있는 돈 찾기', desc: '정부24 지원금·감면 중 내 조건에 맞는 것' },
  { path: '/calc', name: '대출 계산기', desc: '금리가 ±0.25·0.5·1%p 바뀌면 내 이자는?' },
  { path: '/chat', name: '경제 챗봇', desc: '경제 용어·현상을 쉬운 말로' },
  { path: '/news', name: '뉴스 해설', desc: '기사를 붙여 넣으면 무슨 일인지 정리' },
  { path: '/compare', name: '시각 비교', desc: '견해가 갈리는 주제를 나란히' }
];

export default function Home() {
  const [profile] = useProfile();
  const empty = isEmptyProfile(profile);
  const latest = empty ? null : buildLedger(ISSUES, profile).months[0];
  const { inputs: fin } = freedomInputs(profile);
  const freedom = fin.monthlyExpense !== null && !validateFreedom(fin) ? calcFreedom(fin) : null;
  return (
    <div className="home">
      <h1 className="home-title">경자피티</h1>
      <p className="home-subtitle">쇼츠에서 본 그 경제 뉴스, 내 지갑엔 얼마?</p>

      <Link to={empty ? '/me' : '/wallet'} className="wallet-card">
        {empty ? (
          <>
            <strong>내 지갑 등록하기</strong>
            <span>대출·월급·한 달 지출을 한 번 넣어 두면 모든 이슈가 내 숫자로 계산돼요. 이 기기에만 저장됩니다.</span>
          </>
        ) : (
          <>
            <strong>{latest ? `이번 달 이슈로 내 지갑 매달 ${signedWon(latest.totals.month)}` : '내 지갑 숫자로 계산 중'}</strong>
            <span>{latest ? '이슈별로 얼마나 바뀌었는지 장부에서 보기' : '이슈를 열면 내 숫자가 미리 들어가 있어요. 눌러서 장부 보기'}</span>
          </>
        )}
      </Link>

      <Link to="/freedom" className="wallet-card freedom-card">
        {freedom ? (
          <>
            <strong>{freedom.months === 0 ? '경제적 자유 숫자에 이미 닿았어요' : `경제적 자유까지 ${periodText(freedom.months)}`}</strong>
            <span>지금 {Math.floor(freedom.progress * 1000) / 10}%. 저축·생활비를 바꾸면 얼마나 당겨지는지 보기</span>
          </>
        ) : (
          <>
            <strong>내 경제적 자유 숫자는?</strong>
            <span>한 달 생활비·모아 둔 돈·한 달 저축으로 목표 금액과 도달 시점을 셉니다.</span>
          </>
        )}
      </Link>

      <section className="issue-feed" aria-label="오늘의 이슈">
        <h2 className="feed-title">방금 본 쇼츠를 찾아 누르세요</h2>
        {ISSUES.length === 0 && <p className="muted">아직 올라온 이슈가 없습니다.</p>}
        {ISSUES.map((i) => (
          <Link key={i.id} to={`/i/${i.id}`} className="issue-card">
            <div className="issue-card-meta">
              {i.publishedAt.slice(5).replace('-', '.')} {i.slot}
              {i.calculator && <span className="badge">{TEMPLATES[i.calculator.template].label} 계산</span>}
            </div>
            <div className="issue-card-title">{i.shortsTitle}</div>
          </Link>
        ))}
      </section>

      <h2 className="feed-title">도구</h2>
      <div className="feature-grid">
        {tools.map(f => (
          <Link key={f.path} to={f.path} className="feature-card">
            <div className="feature-name">{f.name}</div>
            <div className="feature-desc">{f.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
