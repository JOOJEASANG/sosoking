import { renderPolicy as renderBasePolicy } from './policy.js?v=20260730-final-audit-1';
import { db } from '../firebase.js?v=20260630-3';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const OLD_LIMIT_COPY = '회원의 AI 사건 접수는 원칙적으로 계정당 하루 1회입니다. 미사용 횟수는 다음 날로 이월되지 않습니다.';
const NEW_LIMIT_COPY = 'AI 사건의 접수 횟수와 재접수 대기시간은 서비스 화면에 표시된 현재 운영 설정을 따릅니다. 운영자는 테스트, 비용 통제, 안전 및 장애 대응을 위해 제한을 해제하거나 계정당 일일 건수를 조절할 수 있습니다.';

function applyBusinessName(text, business = {}) {
  return String(text || '').replaceAll('{companyName}', business.companyName || '운영자');
}

function removeDailyCourtCopy(value, type = '') {
  let text = String(value || '');

  if (type === 'terms') {
    text = text.replace(/\n제5조 \(오늘의 재판 이용\)[\s\S]*?(?=\n제6조 \()/, '\n');
    text = text.replace(/제(6|7|8|9|10|11|12|13)조/g, match => {
      const number = Number(match.match(/\d+/)?.[0] || 0);
      return `제${number - 1}조`;
    });
  }

  const removedLinePatterns = [
    /오늘의 재판/,
    /실제 판례/,
    /판례 맞히기/,
    /판례 식별자/,
    /원문 판례/,
    /판례·AI 결과/,
    /판례의 원문/,
    /편집된 게임 콘텐츠/
  ];

  text = text
    .split('\n')
    .filter(line => !removedLinePatterns.some(pattern => pattern.test(line)))
    .join('\n')
    .replace('AI 생활판결, 공개 판결기록,  및 관련 기능', 'AI 생활판결, 공개 판결기록 및 관련 기능')
    .replace('사건 접수,  판결 제출, 내 사건 관리', '사건 접수, 공개 판결 참여, 내 사건 관리')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

function replaceCurrentPolicyCopy(text, type) {
  const withLimit = type === 'terms'
    ? String(text || '').replace(OLD_LIMIT_COPY, NEW_LIMIT_COPY)
    : String(text || '');
  return removeDailyCourtCopy(withLimit, type);
}

function contentElement(container) {
  return container.querySelector('.container > div:first-child');
}

export async function renderPolicy(container, type) {
  await renderBasePolicy(container, type);

  let saved = '';
  let business = {};
  try {
    const [policySnapshot, publicSnapshot] = await Promise.all([
      getDoc(doc(db, 'policy_docs', type)),
      getDoc(doc(db, 'site_public', 'config'))
    ]);
    if (!container.isConnected) return;
    saved = policySnapshot.exists() ? String(policySnapshot.data().content || '') : '';
    business = publicSnapshot.exists() ? (publicSnapshot.data().businessInfo || {}) : {};
  } catch (error) {
    console.warn('current policy copy load failed:', error?.code || error);
  }

  const content = contentElement(container);
  if (!content) return;
  const source = saved || content.textContent;
  content.textContent = applyBusinessName(replaceCurrentPolicyCopy(source, type), business);
}

export { NEW_LIMIT_COPY, removeDailyCourtCopy };
