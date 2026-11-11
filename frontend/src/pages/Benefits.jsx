import { useEffect, useMemo, useState } from 'react';
import NumberInput from '../components/NumberInput';
import { useProfile } from '../lib/useProfile';
import { GROUPS, findBenefits, isEmptyBenefitProfile, readSnapshot, sanitizeBenefitProfile, withJobHints, withRegions } from '../lib/benefits';

// 받을 수 있는 돈 찾기: 정부24 공공서비스 지원조건과 내 조건을 이 기기 안에서 맞춘다(lib/benefits.js).
// 혜택 데이터는 빌드 때 넣은 정적 파일(public/benefits.json, scripts/sync-benefits.mjs 로 생성)을 읽는다.
const PAGE = 20;
const TABS = { match: '조건이 맞아요', check: '확인이 더 필요해요' };
const LABEL = Object.fromEntries(GROUPS.flatMap((g) => Object.entries(g.codes)));

/** 접힌 조건 칸에 보여 줄 한 줄 요약 */
function summaryText(me) {
  const parts = [[me.sido, me.sigungu].filter(Boolean).join(' '), me.birthYear !== null && `${me.birthYear}년생`, ...me.codes.map((c) => LABEL[c])];
  return parts.filter(Boolean).join(' · ') || '아직 고른 조건이 없어요';
}

function useBenefitData() {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}benefits.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (alive) setState(Array.isArray(d?.services) ? { status: 'ok', data: withRegions(readSnapshot(d)) } : { status: 'missing' }); })
      .catch(() => { if (alive) setState({ status: 'missing' }); });
    return () => { alive = false; };
  }, []);
  return state;
}

function GroupChips({ group, me, onChange }) {
  const none = me.none.includes(group.key);
  const toggle = (code) => {
    const others = me.codes.filter((c) => !Object.hasOwn(group.codes, c));
    const mine = me.codes.filter((c) => Object.hasOwn(group.codes, c));
    const next = group.single
      ? (mine.includes(code) ? [] : [code])
      : (mine.includes(code) ? mine.filter((c) => c !== code) : [...mine, code]);
    onChange({ ...me, codes: [...others, ...next], none: me.none.filter((k) => k !== group.key) });
  };
  const setNone = () => onChange({
    ...me,
    codes: me.codes.filter((c) => !Object.hasOwn(group.codes, c)),
    none: none ? me.none.filter((k) => k !== group.key) : [...me.none, group.key]
  });
  return (
    <div className="form-group">
      <span className="group-label">{group.label}{!group.single && ' (해당하는 것 모두)'}</span>
      <div className="method-row" role="group" aria-label={group.label}>
        {Object.entries(group.codes).map(([code, label]) => (
          <button key={code} type="button" aria-pressed={me.codes.includes(code)}
            className={`persona-chip${me.codes.includes(code) ? ' active' : ''}`} onClick={() => toggle(code)}>
            {label}
          </button>
        ))}
        {!group.single && (
          <button type="button" aria-pressed={none} className={`persona-chip${none ? ' active' : ''}`} onClick={setNone}>해당 없음</button>
        )}
      </div>
    </div>
  );
}

function Card({ item }) {
  const s = item.service;
  return (
    <li className="benefit-card">
      <div className="benefit-meta">{[s.org, s.type, s.field].filter(Boolean).join(' · ')}</div>
      <h3>{s.name}</h3>
      {(s.support || s.summary) && <p>{s.support || s.summary}</p>}
      {s.deadline && <div className="benefit-deadline">신청 기한: {s.deadline}</div>}
      {item.unknown.length > 0 && <div className="benefit-unknown">확인 필요: {item.unknown.join(', ')}</div>}
      {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="benefit-link">정부24에서 자세히 보기 ↗</a>}
    </li>
  );
}

export default function Benefits() {
  const [profile, saveProfile] = useProfile();
  const data = useBenefitData();
  // 저장된 조건이 없으면 내 지갑의 일하는 형태로 시작한다
  const [me, setMe] = useState(() => sanitizeBenefitProfile(withJobHints(profile.benefit, profile.job)));
  const [tab, setTab] = useState('match');
  const [shown, setShown] = useState(PAGE);
  const [msg, setMsg] = useState('');
  const change = (next) => { setMe(sanitizeBenefitProfile(next)); setShown(PAGE); setMsg(''); };

  // 서비스가 1만 개가 넘어 조건이 바뀔 때만 다시 맞춘다
  const result = useMemo(() => (data.status === 'ok' ? findBenefits(data.data.services, me) : null), [data, me]);
  const list = result ? result[tab] : [];
  const saved = JSON.stringify(sanitizeBenefitProfile(me)) === JSON.stringify(profile.benefit);
  const save = () => {
    const ok = saveProfile({ ...profile, benefit: me });
    setMsg(ok ? '내 지갑에 저장했어요. 다음에 오면 이 조건으로 찾습니다.' : '브라우저가 저장을 막았어요(사생활 보호 모드 등). 이 화면을 닫으면 사라집니다.');
  };

  return (
    <div className="benefits wallet">
      <h1 className="page-title">받을 수 있는 돈 찾기</h1>
      <p className="page-desc">
        정부24에 올라온 공공서비스(지원금·감면·바우처 등) 중 내 조건에 맞는 것을 찾습니다. 조건은 이 기기 안에서만 맞춰 보고 서버로 보내지 않습니다.
      </p>

      {/* 저장한 조건이 있으면 접어서 결과가 먼저 보이게 한다 */}
      <details className="wallet-section benefit-conds" open={isEmptyBenefitProfile(profile.benefit)}>
        <summary>
          <span className="benefit-conds-title">내 조건</span>
          <span className="benefit-conds-sum">{summaryText(me)}</span>
        </summary>
        <div className="calc-form">
          {data.status === 'ok' && (
            <>
              <div className="form-group">
                <label htmlFor="b-sido">사는 곳(시·도)</label>
                <select id="b-sido" value={me.sido} onChange={(e) => change({ ...me, sido: e.target.value, sigungu: '' })}>
                  <option value="">고르기</option>
                  {data.data.regions.sidos.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="b-sigungu">시·군·구</label>
                <select id="b-sigungu" value={me.sigungu} disabled={!me.sido} onChange={(e) => change({ ...me, sigungu: e.target.value })}>
                  <option value="">{me.sido ? '고르기' : '시·도를 먼저'}</option>
                  {(data.data.regions.sigungu[me.sido] || []).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </>
          )}
          <div className="form-group">
            <label htmlFor="b-birth">출생 연도</label>
            <NumberInput id="b-birth" value={me.birthYear} unit="년" grouping={false} onChange={(v) => change({ ...me, birthYear: Number.isInteger(v) ? v : null })} />
          </div>
        </div>
        {GROUPS.map((g) => <GroupChips key={g.key} group={g} me={me} onChange={change} />)}
        <p className="input-note">고르지 않은 묶음은 "확인 필요"로 보여 줍니다. 여러 개 고르는 묶음에서 고르지 않은 항목은 해당하지 않는 것으로 봅니다.</p>
        <div className="wallet-actions">
          <button type="button" className="submit-btn" onClick={save} disabled={saved}>{saved ? '내 지갑에 저장됨' : '내 지갑에 저장'}</button>
        </div>
      </details>
      {msg && <p className="save-msg" role="status">{msg}</p>}

      <section className="issue-section" aria-live="polite">
        {data.status === 'loading' && <p className="muted">혜택 목록을 불러오는 중…</p>}
        {data.status === 'missing' && (
          <p className="muted">혜택 목록이 아직 준비되지 않았어요. (운영자: 공공데이터포털 인증키로 <code>npm run sync:benefits</code> 를 실행해 주세요)</p>
        )}
        {result && (
          <>
            <div className="persona-row benefit-tabs" role="tablist">
              {Object.entries(TABS).map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k}
                  className={`persona-chip${tab === k ? ' active' : ''}`} onClick={() => { setTab(k); setShown(PAGE); }}>
                  {label} {result[k].length.toLocaleString('ko-KR')}
                </button>
              ))}
            </div>
            {list.length === 0 && <p className="muted">{tab === 'match' ? '지금 넣은 조건으로 모두 맞는 서비스가 없어요. 조건을 더 넣거나 "확인이 더 필요해요"를 보세요.' : '확인이 더 필요한 서비스가 없어요.'}</p>}
            <ul className="benefit-list">{list.slice(0, shown).map((item) => <Card key={item.service.id} item={item} />)}</ul>
            {list.length > shown && (
              <button type="button" className="ghost-btn benefit-more" onClick={() => setShown(shown + PAGE)}>
                {Math.min(PAGE, list.length - shown)}개 더 보기 ({shown}/{list.length})
              </button>
            )}
            <p className="as-of muted">
              자료: {data.data.source}. 받아 온 때 {data.data.syncedAt.slice(0, 10)}, 서비스 {data.data.count.toLocaleString('ko-KR')}개.
            </p>
          </>
        )}
      </section>

      <p className="disclaimer">
        정부24의 지원조건 코드(성별·나이·소득 구간·가구 상황 등)만 맞춘 결과입니다. 실제로 받을 수 있는지는 소득·재산 기준, 거주지 등 세부 조건에 따라 달라지니 기관 안내에서 꼭 확인하세요.
      </p>
    </div>
  );
}
