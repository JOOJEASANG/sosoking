import { renderPolicy as renderBasePolicy } from './policy.js?v=20260802-community-court-1';
import { db } from '../firebase.js?v=20260630-3';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const OLD_LIMIT_COPY = '회원의 AI 사건 접수는 원칙적으로 계정당 하루 1회입니다. 미사용 횟수는 다음 날로 이월되지 않습니다.';
const NEW_LIMIT_COPY = 'AI 사건의 접수 횟수와 재접수 대기시간은 서비스 화면에 표시된 현재 운영 설정을 따릅니다. 운영자는 테스트, 비용 통제, 안전 및 장애 대응을 위해 제한을 해제하거나 계정당 일일 건수를 조절할 수 있습니다.';
const OLD_DAILY_COPY = '오늘의 재판은 매일 실제 판례 한 건을 제시하고 이용자가 결론을 선택한 뒤 실제 판단과 비교하는 게임입니다.';
const OLD_THREE_DAILY_COPY = '오늘의 재판은 매일 실제 판례 3건을 제시하고 이용자가 각 결론을 선택한 뒤 실제 판단과 비교하는 게임입니다.';
const NEW_DAILY_COPY = '오늘의 재판은 매일 공개에 동의한 익명 생활사건 3건을 우선 제시하고, 이용자가 원고·피고·쌍방 중 하나를 선택한 뒤 AI 판단과 전체 선택 비율을 비교하는 게임입니다.';
const OLD_DAILY_VOTE_COPY = '로그인 회원은 같은 날짜의 사건에 한 번만 판결을 제출할 수 있습니다.';
const NEW_DAILY_VOTE_COPY = '로그인 회원은 같은 날짜에 출제된 각 사건에 한 번씩 판결을 제출할 수 있습니다.';
const OLD_DAILY_STATS_COPY = '이용자가 확인한 증거 수, 선택한 답변, 정답 여부, 점수, 연속 참여 기록 및 누적 통계가 저장될 수 있습니다.';
const OLD_THREE_DAILY_STATS_COPY = '이용자가 확인한 증거 수, 선택한 답변, 정답 여부, 점수, 연속 참여 기록과 일간·주간·누적 랭킹 통계가 저장될 수 있습니다.';
const NEW_DAILY_STATS_COPY = '이용자가 선택한 답변, AI 판단과의 일치 여부, 참여 점수, 연속 참여 기록과 일간·주간·누적 랭킹 통계가 저장될 수 있습니다.';

function applyBusinessName(text, business = {}) {
  return String(text || '').replaceAll('{companyName}', business.companyName || '운영자');
}

function replaceCurrentPolicyCopy(text) {
  return String(text || '')
    .replace(OLD_LIMIT_COPY, NEW_LIMIT_COPY)
    .replace(OLD_DAILY_COPY, NEW_DAILY_COPY)
    .replace(OLD_THREE_DAILY_COPY, NEW_DAILY_COPY)
    .replace(OLD_DAILY_VOTE_COPY, NEW_DAILY_VOTE_COPY)
    .replace(OLD_DAILY_STATS_COPY, NEW_DAILY_STATS_COPY)
    .replace(OLD_THREE_DAILY_STATS_COPY, NEW_DAILY_STATS_COPY)
    .replaceAll('실제 판례를 게임용으로 짧게 재구성한 콘텐츠', '공개 동의된 익명 생활사건을 선택형 게임으로 구성한 콘텐츠')
    .replaceAll('실제 판례의 결론', 'AI 비교 판단')
    .replaceAll('판례 요약', '생활사건 요약');
}

function replaceLegacyLimitCopy(container) {
  const content = container.querySelector('.container > div:first-child');
  if (!content) return;
  content.textContent = replaceCurrentPolicyCopy(content.textContent);
}

export async function renderPolicy(container, type) {
  await renderBasePolicy(container, type);
  if (type !== 'terms') return;

  try {
    const [policySnapshot, publicSnapshot] = await Promise.all([
      getDoc(doc(db, 'policy_docs', 'terms')),
      getDoc(doc(db, 'site_public', 'config'))
    ]);
    if (!container.isConnected) return;

    const saved = policySnapshot.exists() ? String(policySnapshot.data().content || '') : '';
    const business = publicSnapshot.exists() ? (publicSnapshot.data().businessInfo || {}) : {};
    const content = container.querySelector('.container > div:first-child');
    const isCommunityPolicy = saved.includes('원고·피고·쌍방')
      && saved.includes('공개')
      && saved.includes('익명 생활사건');

    if (content && saved && isCommunityPolicy) {
      content.textContent = applyBusinessName(replaceCurrentPolicyCopy(saved), business);
      return;
    }
  } catch (error) {
    console.warn('configurable policy copy load failed:', error?.code || error);
  }

  replaceLegacyLimitCopy(container);
}

export { NEW_LIMIT_COPY, NEW_DAILY_COPY };
