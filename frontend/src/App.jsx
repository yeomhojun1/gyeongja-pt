import { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { DEMO } from './config';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Issue from './pages/Issue';
import Calculator from './pages/Calculator';
import Chatbot from './pages/Chatbot';
import NewsExplain from './pages/NewsExplain';
import Compare from './pages/Compare';
import MyWallet from './pages/MyWallet';
import Ledger from './pages/Ledger';
import Freedom from './pages/Freedom';
import Benefits from './pages/Benefits';
import NotFound from './pages/NotFound';

// 데모(GitHub Pages)는 새로고침 404 를 피하려고 HashRouter 를 쓴다.
const Router = DEMO ? HashRouter : BrowserRouter;

// 이슈 목록에서 이슈 페이지로 넘어가면 맨 위(계산기)부터 보이게 한다
function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function App() {
  return (
    <Router>
      <ScrollTop />
      <div className="app">
        {DEMO && <div className="demo-banner">데모 모드: 실제 AI 서버 없이 미리 준비한 답변으로 동작합니다(이슈·계산기는 그대로 동작)</div>}
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/i/:id" element={<Issue />} />
            <Route path="/calc" element={<Calculator />} />
            <Route path="/chat" element={<Chatbot />} />
            <Route path="/news" element={<NewsExplain />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/me" element={<MyWallet />} />
            <Route path="/wallet" element={<Ledger />} />
            <Route path="/freedom" element={<Freedom />} />
            <Route path="/benefits" element={<Benefits />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
