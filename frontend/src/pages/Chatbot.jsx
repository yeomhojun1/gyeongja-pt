import { useState, useRef, useEffect } from 'react';
import { API, NO_AI } from '../config';
import { DEMO_QA } from '../demo/answers';

const GREETING = {
  role: 'assistant',
  content: '안녕하세요! 경자피티입니다.\n경제 용어나 뉴스에서 본 현상을 물어보시면 ① 한 줄 요약 ② 쉬운 설명 ③ 내 지갑 영향 ④ 출처 순서로 답해 드려요.\n특정 종목·코인·부동산을 사고팔지는 답하지 않습니다.',
  local: true,
  demoExamples: NO_AI
};
// 서버(backend/validate.js requireMessages)가 받는 이력 상한과 맞춘다
const MAX_HISTORY = 20;

export default function Chatbot() {
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (preset) => {
    const text = (typeof preset === 'string' ? preset : input).trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const apiMessages = updatedMessages
        .filter(m => !m.local)
        .map(({ role, content }) => ({ role, content }))
        .slice(-MAX_HISTORY);
      if (apiMessages[0]?.role === 'assistant') apiMessages.shift();

      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages(prev => [...prev, { role: 'assistant', content: data.result, demoExamples: Boolean(data.demoUnknown) }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `오류: ${e.message}`, local: true }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="chat-container">
      <h1 className="page-title">경제 챗봇</h1>
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg ${msg.role === 'user' ? 'user' : 'ai'}`}>
            <span className="chat-label">{msg.role === 'user' ? '나' : '경자피티'}</span>
            <div className="chat-bubble">
              {msg.content}
              {NO_AI && msg.demoExamples && (
                <div className="demo-examples">
                  {DEMO_QA.map(qa => (
                    <button key={qa.question} className="demo-chip" onClick={() => send(qa.question)} disabled={loading}>
                      {qa.question}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-msg ai">
            <span className="chat-label">경자피티</span>
            <div className="chat-bubble" style={{ color: 'var(--text-muted)' }}>답변 생성 중...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <textarea
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="경제에 관해 질문하세요 (Enter 전송)"
          aria-label="질문 입력"
          rows={1}
        />
        <button className="submit-btn" onClick={send} disabled={loading || !input.trim()}>
          전송
        </button>
      </div>
    </div>
  );
}
