import { renderPolicy as renderBasePolicy } from './policy.js?v=20260729-brand-policy-1';
import { db } from '../firebase.js?v=20260630-3';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const OLD_LIMIT_COPY = '회원의 AI 사건 접수는 원칙적으로 계정당 하루 1회입니다. 미사용 횟수는 다음 날로 이월되지 않습니다.';
const NEW_LIMIT_COPY = 'AI 사건의 접수 횟수와 재접수 대기시간은 서비스 화면에 표시된 현재 운영 설정을 따릅니다. 운영자는 테스트, 비용 통제, 안전 및 장애 대응을 위해 제한을 해제하거나 계정당 일일 건수를 조절할 수 있습니다.';

function applyBusinessName(text, business = {}) {
  return String(text || '').replaceAll('{companyName}', business.companyName || '운영자');
}

function replaceLegacyLimitCopy(container) {
  const content = container.querySelector('.container > div:first-child');
  if (!content) return;
  content.textContent = content.textContent.replace(OLD_LIMIT_COPY, NEW_LIMIT_COPY);
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

    if (content && saved.includes(NEW_LIMIT_COPY)) {
      content.textContent = applyBusinessName(saved, business);
      return;
    }
  } catch (error) {
    console.warn('configurable policy limit copy load failed:', error?.code || error);
  }

  replaceLegacyLimitCopy(container);
}

export { NEW_LIMIT_COPY };