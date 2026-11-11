import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="notfound">
      <div className="notfound-code">404</div>
      <h1 className="page-title">페이지를 찾을 수 없습니다</h1>
      <p className="notfound-desc">주소가 바뀌었거나 삭제된 페이지입니다.</p>
      <Link to="/" className="submit-btn notfound-btn">홈으로 돌아가기</Link>
    </div>
  );
}
