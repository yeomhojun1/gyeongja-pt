import { Link } from 'react-router-dom';
import { ISSUES } from '../content';
import { TEMPLATES } from '../lib/templates';
import { signedWon } from '../lib/loan';
import { buildLedger } from '../lib/ledger';
import { isEmptyProfile } from '../lib/profile';
import { useProfile } from '../lib/useProfile';
import { NO_AI } from '../config';
import { calcFreedom, freedomInputs, periodText, validateFreedom } from '../lib/freedom';

const tools = [
  { path: '/benefits', name: '받을 수 있는 돈 찾기', desc: '정부24 지원금·감면 중 내 조건에 맞는 것' },
  { path: '/calc', name: '대출 계산기', desc: '금리가 ±0.25·0.5·1%p 바뀔 때 내 이자 비교' },
  { path: '/chat', name: '경제 챗봇', desc: '경제 용어·현상을 쉬운 말로' },
  { path: '/news', name: '뉴스 해설', desc: '기사를 붙여 넣으면 무슨 일인지 정리', ai: true },
  { path: '/compare', name: '시각 비교', desc: '견해가 갈리는 주제를 나란히' }
];

const tone = (v) => (Math.round(v) > 0 ? 'gain' : Math.round(v) < 0 ? 'loss' : '');

export default function Home() {
  const [profile] = useProfile();
  const empty = isEmptyProfile(profile);
  const latest = empty ? null : buildLedger(ISSUES, profile).months[0];
  const { inputs: fin } = freedomInputs(profile);
  const freedom = fin.monthlyExpense !== null && !validateFreedom(fin) ? calcFreedom(fin) : null;
  return (
    <div className="home">
      <header className="home-head">
        <h1 className="home-title">경제 뉴스 한 건이 내 지갑에 얼마인지 원 단위로 계산합니다</h1>
        <p className="home-subtitle">대출·월급·한 달 지출을 한 번 넣어 두면 쇼츠에서 본 이슈마다 내 숫자로 셉니다</p>
      </header>

      <section className="passbook" aria-label="내 지갑">
        <div className="passbook-head">
          <strong>내 지갑</strong>
          <Link to="/me">{empty ? '숫자 넣기' : '숫자 고치기'}</Link>
        </div>
        <ul className="passbook-lines">
          <li>
            <Link to={empty ? '/me' : '/wallet'} className="passbook-line">
              <span className="pb-label">
                이번 달 이슈 반영
                <small>{latest ? '이슈별로 얼마나 바뀌었는지 장부에서 보기' : empty ? '대출·월급·한 달 지출을 넣으면 계산됩니다' : '이슈를 열면 내 숫자가 미리 들어가 있습니다'}</small>
              </span>
              {latest
                ? <span className={`pb-amount ${tone(latest.totals.month)}`}>매달 {signedWon(latest.totals.month)}</span>
                : <span className="pb-amount todo">{empty ? '내 지갑 등록' : '장부 보기'}</span>}
            </Link>
          </li>
          <li>
            <Link to="/freedom" className="passbook-line">
              <span className="pb-label">
                경제적 자유까지
                <small>{freedom ? `지금 ${Math.floor(freedom.progress * 1000) / 10}% · 저축·생활비를 바꾸면 얼마나 당겨지는지 보기` : '한 달 생활비·모아 둔 돈·한 달 저축으로 목표 금액과 도달 시점을 셉니다'}</small>
              </span>
              {freedom
                ? <span className="pb-amount">{freedom.months === 0 ? '도달' : periodText(freedom.months)}</span>
                : <span className="pb-amount todo">계산하기</span>}
            </Link>
          </li>
        </ul>
        <p className="passbook-note">넣은 숫자는 이 기기에만 저장됩니다</p>
      </section>

      <section className="home-section" aria-label="오늘의 이슈">
        <h2 className="section-title">쇼츠에서 본 이슈</h2>
        {ISSUES.length === 0 ? (
          <p className="muted">아직 올라온 이슈가 없습니다.</p>
        ) : (
          <ul className="row-list">
            {ISSUES.map((i) => (
              <li key={i.id}>
                <Link to={`/i/${i.id}`} className="issue-row">
                  <span className="issue-row-meta">
                    {i.publishedAt.slice(5).replace('-', '.')} {i.slot}
                    {i.calculator && ` · ${TEMPLATES[i.calculator.template].label} 계산`}
                  </span>
                  <span className="issue-row-title">{i.shortsTitle}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="home-section" aria-label="도구">
        <h2 className="section-title">도구</h2>
        <ul className="row-list">
          {tools.filter(f => !(NO_AI && f.ai)).map(f => (
            <li key={f.path}>
              <Link to={f.path} className="tool-row">
                <span className="tool-name">{f.name}</span>
                <span className="tool-desc">{f.desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
