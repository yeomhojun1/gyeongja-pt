import { useState } from 'react';
import { API, DEMO } from '../config';
import Loading from '../components/Loading';

export default function NewsExplain() {
  const [newsText, setNewsText] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const explain = async () => {
    if (!newsText.trim() || loading) return;
    setLoading(true);
    setError('');
    setResult('');
    try {
      const res = await fetch(`${API}/api/news-explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsText: newsText.trim() })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">뉴스 해설</h1>
      <p className="page-desc">경제 기사 본문을 붙여 넣으면 ① 무슨 일인가 ② 왜 일어났나 ③ 누구에게 어떤 영향인가 ④ 다르게 보는 시각 순서로 정리합니다.</p>
      {DEMO && <div className="sample-note">데모 모드에서는 뉴스 해설이 동작하지 않습니다(기사마다 내용이 달라 미리 답을 써 둘 수 없음).</div>}
      <div className="form-group">
        <label htmlFor="news-text">경제 기사 본문</label>
        <textarea
          id="news-text"
          value={newsText}
          onChange={e => setNewsText(e.target.value)}
          placeholder="기사 내용을 복사해서 여기에 붙여넣으세요... (최대 8,000자)"
          maxLength={8000}
        />
      </div>
      <button
        className="submit-btn submit-btn-full"
        onClick={explain}
        disabled={loading || !newsText.trim()}
      >
        {loading ? '해설 중...' : '해설하기'}
      </button>
      {loading && <Loading />}
      {error && <div className="error-box">{error}</div>}
      {result && <div className="result-box">{result}</div>}
    </div>
  );
}
