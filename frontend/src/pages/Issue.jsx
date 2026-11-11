import { Link, useParams } from 'react-router-dom';
import { findIssue } from '../content';
import { PERSONAS } from '../lib/issues';
import { usePersona } from '../lib/persona';
import { TEMPLATES } from '../lib/templates';
import IssueCalculator from '../components/IssueCalculator';
import NotFound from './NotFound';

// 쇼츠 1편 = 이슈 페이지 1개. 계산기를 맨 위(첫 화면)에 두고, 해설은 그 아래에 둔다.
export default function Issue() {
  const { id } = useParams();
  const issue = findIssue(id);
  const [persona, setPersona] = usePersona();
  if (!issue) return <NotFound />;

  // 내 상황을 골랐으면 그 영향을 맨 앞에, 고르지 않았으면 이슈에 적힌 순서대로
  const impactKeys = Object.keys(issue.impacts);
  const ordered = persona && issue.impacts[persona] ? [persona, ...impactKeys.filter((k) => k !== persona)] : impactKeys;

  return (
    <article className="issue">
      {issue.sample && (
        <div className="sample-note">
          시연용 샘플 이슈입니다. 수치는 언론 보도 등 2차 출처 기준이며 정부·기관 공식 원문과 대조하지 않았습니다.
        </div>
      )}
      <div className="issue-meta">
        {issue.publishedAt.replace(/-/g, '.')} {issue.slot} 쇼츠
        {issue.calculator && <span className="badge">{TEMPLATES[issue.calculator.template].label}</span>}
      </div>
      <h1 className="issue-title">{issue.title}</h1>
      <p className="issue-shorts">쇼츠 제목: {issue.shortsTitle}</p>

      {issue.calculator && <IssueCalculator calculator={issue.calculator} />}

      <section className="issue-section">
        <h2>30초 요약</h2>
        <p>{issue.summary}</p>
        <p className="as-of">수치 기준일: {issue.asOf.replace(/-/g, '.')}</p>
      </section>

      <section className="issue-section">
        <h2>내 상황별 영향</h2>
        <div className="persona-row" role="group" aria-label="내 상황 고르기">
          {PERSONAS.map((p) => (
            <button
              key={p}
              className={`persona-chip${persona === p ? ' active' : ''}`}
              onClick={() => setPersona(persona === p ? '' : p)}
              aria-pressed={persona === p}
            >
              {p}
            </button>
          ))}
        </div>
        {persona && !issue.impacts[persona] && (
          <p className="muted">이 이슈는 {persona}에게 직접적인 영향이 크지 않습니다.</p>
        )}
        <ul className="impact-list">
          {ordered.map((k) => (
            <li key={k} className={k === persona ? 'mine' : ''}>
              <strong>{k}</strong>
              <span>{issue.impacts[k]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="issue-section">
        <h2>왜 이런 일이?</h2>
        <p>{issue.why}</p>
      </section>

      {issue.otherViews && (
        <section className="issue-section">
          <h2>다르게 보는 시각</h2>
          <div className="views-grid">
            {issue.otherViews.map((v) => (
              <div key={v.title} className="view-card">
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </div>
            ))}
          </div>
          <p className="muted">경자피티는 어느 쪽이 옳다고 결론 내리지 않습니다.</p>
        </section>
      )}

      {issue.terms?.length > 0 && (
        <section className="issue-section">
          <h2>나온 용어</h2>
          <dl className="terms">
            {issue.terms.map((t) => (
              <div key={t.term}><dt>{t.term}</dt><dd>{t.desc}</dd></div>
            ))}
          </dl>
        </section>
      )}

      <section className="issue-section">
        <h2>출처</h2>
        <ul className="source-list">
          {issue.sources.map((s) => (
            <li key={s.org + s.title}>
              {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.org} — {s.title}</a> : <span>{s.org} — {s.title}</span>}
            </li>
          ))}
        </ul>
      </section>

      <div className="issue-actions">
        <Link to="/chat" className="submit-btn">더 궁금한 건 경제 챗봇에게</Link>
        <Link to="/" className="ghost-btn">다른 이슈 보기</Link>
      </div>
      <p className="disclaimer">경자피티의 계산과 해설은 참고용이며 투자·금융 상품 권유가 아닙니다.</p>
    </article>
  );
}
