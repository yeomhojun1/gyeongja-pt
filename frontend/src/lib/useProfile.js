// 내 지갑 프로필을 브라우저에 읽고 쓴다(lib/profile.js 규칙). 회원가입 없이 이 기기에서만 유지된다.
// 사생활 보호 모드 등에서 저장소 접근이 막혀도 화면은 정상 동작해야 하므로 모든 접근을 try/catch 로 감싼다.
import { useState } from 'react';
import { PROFILE_KEY, emptyProfile, isEmptyProfile, sanitizeProfile } from './profile.js';

function load() {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    return raw ? sanitizeProfile(JSON.parse(raw)) : emptyProfile();
  } catch {
    return emptyProfile();
  }
}

export function useProfile() {
  const [profile, setProfileState] = useState(load);
  const saveProfile = (p) => {
    const clean = sanitizeProfile(p);
    setProfileState(clean);
    try {
      if (isEmptyProfile(clean)) window.localStorage.removeItem(PROFILE_KEY);
      else window.localStorage.setItem(PROFILE_KEY, JSON.stringify(clean));
      return true;
    } catch {
      // 저장 실패해도 이번 화면에서는 값이 유지된다
      return false;
    }
  };
  return [profile, saveProfile];
}
