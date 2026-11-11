import { Link } from 'react-router-dom';
import { ISSUES } from '../content';
import { TEMPLATES } from '../lib/templates';

const tools = [
  { path: '/calc', name: '대출 계산기', desc: '금리가 ±0.25·0.5·1%p 바뀌면 내 이자는?' },
  { path: '/chat', name: '경제 챗봇', desc: '경제 용어·현상을 쉬운 말로' },
  { path: '/news', name: '뉴스 해설', desc: '기사를 붙여 넣으면 무슨 일인지 정리' },
  { path: '/compare', name: '시각 비교', desc: '견해가 갈리는 주제를 나란히' }
];

export default function Home() {
  return (
    <div className="home">
      <h1 className="home-title">경자피티</h1>
      <p className="home-subtitle">쇼츠에서 본 그 경제 뉴스, 내 지갑엔 얼마?</p>

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
