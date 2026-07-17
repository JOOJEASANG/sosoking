import { db, auth, functions } from '../firebase.js?v=20260708-1';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { renderResult as renderCaseStoryResult } from './result-case-story.js?v=20260717-ai1';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';
import { showToast } from '../components/toast.js?v=20260630-3';

function ensureGenerationStyle() {
  if (document.getElementById('ai-generation-style')) return;
  const style = document.createElement('style');
  style.id = 'ai-generation-style';
  style.textContent = `
    .ai-generation-card{margin:0 0 14px;padding:13px 15px;border-radius:15px;border:1px solid var(--ui-line-strong,var(--border));background:color-mix(in srgb,var(--ui-gold,var(--gold)) 7%,var(--ui-surface,var(--navy-card)));}
    .ai-generation-card.is-ai{border-color:color-mix(in srgb,var(--green) 48%,var(--border));background:color-mix(in srgb,var(--green) 8%,var(--ui-surface,var(--navy-card)));}
    .ai-generation-card.is-local{border-color:color-mix(in srgb,var(--red) 52%,var(--border));background:color-mix(in srgb,var(--red) 8%,var(--ui-surface,var(--navy-card)));}
    .ai-generation-title{font-size:12px;font-weight:900;color:var(--ui-text-main,var(--cream));margin-bottom:5px;}
    .ai-generation-desc{font-size:11px;line-height:1.7;color:var(--ui-text-muted,var(--cream-dim));}
    .ai-generation-card .btn{margin-top:10px;}
  `;
  document.head.appendChild(style);
}

async function loadGenerationInfo(caseId) {
  const resultSnap = await getDoc(doc(db, 'results', caseId)).catch(() => null);
  const result = resultSnap?.exists() ? resultSnap.data() : {};
  let isOwner = false;
  if (auth.currentUser) {
    const caseSnap = await getDoc(doc(db, 'cases', caseId)).catch(() => null);
    isOwner = caseSnap?.exists() && caseSnap.data()?.userId === auth.currentUser.uid;
  }
  return {
    aiGenerated: result.aiGenerated === true,
    generationMode: String(result.generationMode || ''),
    generationStatus: String(result.generationStatus || ''),
    qualityPassed: result.qualityPassed === true,
    aiModel: String(result.aiModel || ''),
    aiAttempts: Number(result.aiAttempts || 0),
    isOwner,
  };
}

function generationDescription(info) {
  if (!info.aiGenerated) {
    return '이 판결은 과거 AI 호출 실패 시 저장된 시스템 대체문입니다. 사건별 자유로운 AI 판결이 아니므로 다시 생성할 수 있습니다.';
  }
  const details = [];
  if (info.aiModel) details.push(escapeHtml(info.aiModel));
  if (info.aiAttempts) details.push(`${info.aiAttempts}회 생성·검토`);
  if (!info.qualityPassed) details.push('완성된 AI 후보 중 최고 점수 결과 채택');
  return details.length ? details.join(' · ') : '사건 원문을 바탕으로 Gemini AI가 개별 생성한 판결입니다.';
}

function decorateGeneration(container, caseId, info) {
  const existing = container.querySelector('[data-ai-generation-card]');
  if (existing) existing.remove();
  const cover = container.querySelector('.result-cover');
  if (!cover) return;

  const card = document.createElement('section');
  card.dataset.aiGenerationCard = '1';
  card.className = `ai-generation-card ${info.aiGenerated ? 'is-ai' : 'is-local'}`;
  card.innerHTML = `
    <div class="ai-generation-title">${info.aiGenerated ? '✓ Gemini AI 개별 판결' : '⚠ 기존 시스템 대체 판결문'}</div>
    <div class="ai-generation-desc">${generationDescription(info)}</div>
    ${!info.aiGenerated && info.isOwner ? '<button type="button" class="btn btn-primary" data-regenerate-ai>Gemini AI로 다시 판결받기</button>' : ''}
  `;
  cover.insertAdjacentElement('afterend', card);

  const ticker = container.querySelector('.emergency-ticker');
  if (ticker) ticker.textContent = info.aiGenerated
    ? '소소킹 긴급사건 특보 · Gemini AI 개별 재구성 완료'
    : '소소킹 기존 기록 · 시스템 대체 판결문';

  const button = card.querySelector('[data-regenerate-ai]');
  button?.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Gemini AI 재판 진행 중...';
    try {
      const response = await httpsCallable(functions, 'generateTrial')({ caseId });
      if (response.data?.aiGenerated !== true && !String(response.data?.skipped || '').includes('ai')) {
        throw new Error('AI 판결 생성 완료 여부를 확인할 수 없습니다.');
      }
      showToast('Gemini AI 판결을 새로 생성했습니다.', 'success');
      location.reload();
    } catch (error) {
      console.error(error);
      button.disabled = false;
      button.textContent = 'Gemini AI로 다시 판결받기';
      showToast((error.message || 'AI 판결을 다시 생성하지 못했습니다.').replace('FirebaseError: ', ''), 'error');
    }
  });
}

export async function renderResult(container, caseId) {
  ensureGenerationStyle();
  await renderCaseStoryResult(container, caseId);
  let info = await loadGenerationInfo(caseId);
  decorateGeneration(container, caseId, info);

  const observer = new MutationObserver(() => decorateGeneration(container, caseId, info));
  observer.observe(container, { childList: true, subtree: true });

  const previousCleanup = window._pageCleanup;
  window._pageCleanup = () => {
    observer.disconnect();
    previousCleanup?.();
  };
}
