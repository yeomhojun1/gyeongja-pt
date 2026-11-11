import { Link, useLocation } from 'react-router-dom';

const links = [
  { to: '/', label: '홈' },
  { to: '/wallet', label: '내 지갑', also: ['/me'] },
  { to: '/freedom', label: '자유 숫자' },
  { to: '/calc', label: '계산기' },
  { to: '/chat', label: '챗봇' },
  { to: '/news', label: '뉴스해설' },
  { to: '/compare', label: '시각비교' },
];

export default function Navbar() {
  const { pathname } = useLocation();
  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">경자피티</Link>
      <div className="navbar-links">
        {links.map(l => (
          <Link key={l.to} to={l.to} className={`nav-link${pathname === l.to || l.also?.includes(pathname) ? ' active' : ''}`}>
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
