import { useState } from 'react';
import { API, NO_AI } from '../config';
import { COMPARE_TOPICS } from '../content/compare';
import Loading from '../components/Loading';

// 시각 비교: 미리 정리한 4개 주제는 AI 없이 바로 보여 주고, 실서비스에서는 다른 주제도 AI 에게 같은 형식으로 요청한다.
export default function Compare() {
  const [topicId, setTopicId] = useState(COMPARE_TOPICS[0].id);
  const [freeTopic, setFreeTopic] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const topic = COMPARE_TOPICS.find((t) => t.id === topicId);

  const ask = async () => {
    if (!freeTopic.trim() || loading) return;
    setLoading(true);
    setError('');
    setResult('');
    try {
      const res = await fetch(`${API}/api/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: freeTopic.trim() })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.presetId) {
        setTopicId(data.presetId);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setResult(data.result);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">시각 비교</h1>
      <p className="page-desc">견해가 갈리는 주제의 대표 시각을 같은 형식으로 나란히 놓았습니다. 어느 쪽이 옳다고 결론 내리지 않습니다.</p>

      <div className="persona-row" role="tablist" aria-label="주제">
        {COMPARE_TOPICS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === topicId}
            className={`persona-chip${t.id === topicId ? ' active' : ''}`}
            onClick={() => setTopicId(t.id)}
          >
            {t.title}
          </button>
        ))}
      </div>

      <p className="compare-intro">{topic.intro}</p>
      <div className={`views-grid cols-${topic.views.length}`}>
        {topic.views.map((v) => (
          <div key={v.name} className="view-card">
            <h3>{v.name}</h3>
            <p className="view-claim">{v.claim}</p>
            <div className="view-label">근거</div>
            <ul>{v.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            <div className="view-label">반대쪽이 지적하는 점</div>
            <p>{v.criticism}</p>
          </div>
        ))}
      </div>
      <p className="muted">참고 자료 종류: {topic.sources.join(', ')} (개별 원문과 문장 단위로 대조하지는 않았습니다)</p>

      <div className="free-topic">
        <label htmlFor="free-topic">다른 주제로 비교해 보기{NO_AI ? ' (지금은 위 4개 주제만)' : ''}</label>
        <div className="input-row">
          <input id="free-topic" type="text" value={freeTopic} onChange={(e) => setFreeTopic(e.target.value)} placeholder="예: 법인세 인하" maxLength={100} />
          <button className="submit-btn" onClick={ask} disabled={loading || !freeTopic.trim()}>비교</button>
        </div>
      </div>
      {loading && <Loading />}
      {error && <div className="error-box">{error}</div>}
      {result && <div className="result-box">{result}</div>}
    </div>
  );
}
