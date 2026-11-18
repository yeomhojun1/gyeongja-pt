import { Link, useLocation } from 'react-router-dom';
import { NO_AI } from '../config';

// PC는 위쪽 메뉴 전체, 휴대폰은 아래 고정 메뉴 5개(tab: true). 나머지는 홈의 도구 목록에서 들어간다
const links = [
  { to: '/', label: '홈', tab: true, icon: 'home' },
  { to: '/wallet', label: '내 지갑', also: ['/me'], tab: true, icon: 'wallet' },
  { to: '/benefits', label: '받을 돈', tab: true, icon: 'gift' },
  { to: '/freedom', label: '경제적 자유', tab: true, icon: 'flag' },
  { to: '/calc', label: '대출 계산', tab: true, icon: 'calc' },
  { to: '/chat', label: '챗봇' },
  { to: '/news', label: '뉴스해설', ai: true },
  { to: '/compare', label: '시각비교' },
];

const ICONS = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v12h14V9" /><path d="M10 21v-6h4v6" /></>,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18" /><path d="M16 15h2" /></>,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" /></>,
  flag: <><path d="M5 22V4" /><path d="M5 4h12l-2 4 2 4H5" /></>,
  calc: <><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M8 6h8" /><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4" /></>,
};

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

export default function Navbar() {
  const { pathname } = useLocation();
  const shown = links.filter(l => !(NO_AI && l.ai));
  const isActive = (l) => pathname === l.to || l.also?.includes(pathname);
  return (
    <>
      <nav className="navbar" aria-label="메뉴">
        <Link to="/" className="navbar-brand">경자피티</Link>
        <div className="navbar-links">
          {shown.map(l => (
            <Link key={l.to} to={l.to} className={`nav-link${isActive(l) ? ' active' : ''}`}>
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
      <nav className="tabbar" aria-label="아래 메뉴">
        {shown.filter(l => l.tab).map(l => (
          <Link key={l.to} to={l.to} className={`tab-link${isActive(l) ? ' active' : ''}`} aria-current={isActive(l) ? 'page' : undefined}>
            <Icon name={l.icon} />
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
