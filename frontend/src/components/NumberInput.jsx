import { useEffect, useState } from 'react';

// 숫자 입력칸. 쓰는 중에는 자유롭게 두고, 숫자로 읽히면 바로 onChange 로 넘긴다.
// 천 단위 쉼표를 붙여 보여 주되 커서가 칸을 떠날 때만 정리한다(입력 중 커서 튐 방지).
// grouping=false 는 연도처럼 쉼표를 붙이면 안 되는 값
const fmt = (n, decimals, grouping = true) => (Number.isFinite(n)
  ? n.toLocaleString('ko-KR', { maximumFractionDigits: decimals, useGrouping: grouping })
  : '');

export function parseNumber(text) {
  const t = String(text).replace(/[,\s원%]/g, '');
  if (t === '' || t === '-' || t === '.') return NaN;
  return /^-?\d*\.?\d+$|^-?\d+\.?$/.test(t) ? Number(t) : NaN;
}

export default function NumberInput({ id, value, onChange, unit, decimals = 0, ariaLabel, grouping = true }) {
  const [text, setText] = useState(fmt(value, decimals, grouping));

  // 바깥에서 값이 바뀌면(예: 다른 이슈로 이동) 칸을 다시 맞춘다
  useEffect(() => {
    if (parseNumber(text) !== value) setText(fmt(value, decimals, grouping));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="num-input">
      <input
        id={id}
        type="text"
        inputMode={decimals > 0 ? 'decimal' : 'numeric'}
        aria-label={ariaLabel}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseNumber(e.target.value));
        }}
        onBlur={() => { if (Number.isFinite(value)) setText(fmt(value, decimals, grouping)); }}
      />
      {unit && <span className="num-unit">{unit}</span>}
    </div>
  );
}
