// "내 상황"(대출자·세입자 등)을 브라우저에 기억한다. 회원가입 없이 이 기기에서만 유지된다.
// 사생활 보호 모드 등에서 저장소 접근이 막혀도 화면은 정상 동작해야 하므로 모든 접근을 try/catch 로 감싼다.
import { useState } from 'react';
import { PERSONAS } from './issues.js';

const KEY = 'gyeongjapt.persona';

function load() {
  try {
    const v = window.localStorage.getItem(KEY);
    return PERSONAS.includes(v) ? v : '';
  } catch {
    return '';
  }
}

export function usePersona() {
  const [persona, setPersonaState] = useState(load);
  const setPersona = (p) => {
    setPersonaState(p);
    try {
      if (p) window.localStorage.setItem(KEY, p);
      else window.localStorage.removeItem(KEY);
    } catch {
      // 저장 실패해도 이번 화면에서는 선택이 유지된다
    }
  };
  return [persona, setPersona];
}
