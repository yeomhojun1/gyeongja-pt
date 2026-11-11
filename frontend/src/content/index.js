// 이슈 데이터 불러오기. content/issues/*.json 을 빌드 시점에 모두 읽고, 게시(approved)된 것만 최신순으로 쓴다.
// 초안(draft)은 빌드에 포함돼도 화면에 나오지 않는다. 게시 = status 를 'approved' 로 바꾸기.
import { publishedIssues, validateIssue } from '../lib/issues.js';

const files = import.meta.glob('./issues/*.json', { eager: true, import: 'default' });

const all = Object.values(files).filter((issue) => {
  const errs = validateIssue(issue);
  if (errs.length) console.warn(`[이슈 형식 오류] ${issue?.id}:`, errs);
  return errs.length === 0;
});

export const ISSUES = publishedIssues(all);

export const findIssue = (id) => ISSUES.find((i) => i.id === id) || null;
