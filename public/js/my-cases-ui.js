import { db, functions } from './firebase.js';
import { collection, getDocs, limit, orderBy, query, where } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const updateVisibilityCallable = httpsCallable(functions, 'updateCaseVisibility');
const deleteCaseCallable = httpsCallable(functions, 'deleteMyCase');

function safe(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
function formatDate(timestamp) {
  const date = timestamp?.toDate?.();
  if (!date) return '날짜 미상';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
function statusInfo(item) {
  if (item.generationStatus === 'completed' || item.status === 'judged') return ['판결 완료', 'complete'];
  if (item.generationStatus === 'processing') return ['AI 심리 중', 'processing'];
  if (item.generationStatus === 'failed') return ['재심리 필요', 'failed'];
  return ['접수 완료', 'received'];
}

export async function loadMyCases(userId) {
  const casesQuery = query(collection(db, 'cases'), where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(50));
  const snapshot = await getDocs(casesQuery);
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

export function myCasesPageHtml(items = []) {
  return `<section class="my-cases-page"><div class="container"><div class="my-cases-head"><div><div class="eyebrow">내 재판 기록</div><h1>접수한 사건과 판결을<br>한곳에서 관리합니다</h1><p>진행 중인 재판을 이어서 시작하고, 판결 공개 여부나 삭제도 직접 관리할 수 있습니다.</p></div><a class="button button-primary" href="#/submit">새 사건 접수</a></div>
  ${items.length ? `<div class="case-list">${items.map(item => {
    const [label, statusClass] = statusInfo(item);
    const completed = item.generationStatus === 'completed' || item.status === 'judged';
    const actionHref = completed ? `#/result/${encodeURIComponent(item.id)}` : `#/trial/${encodeURIComponent(item.id)}`;
    const actionLabel = completed ? '판결 보기' : item.generationStatus === 'processing' ? '진행 확인' : 'AI 재판 시작';
    return `<article class="card case-item" data-case-id="${safe(item.id)}"><div class="case-item-main"><div class="case-item-meta"><span class="case-status ${statusClass}">${label}</span><span>${formatDate(item.createdAt)}</span><span>${item.isPublic ? '공개 사건' : '비공개 사건'}</span></div><h2>${safe(item.title)}</h2><p>${safe(item.caseDescription)}</p><div class="case-item-tags"><span>${safe(item.defendantName || '피고 미지정')}</span><span>${safe(item.judgeType || 'AI 판사')}</span><span>억울함 ${safe(item.grievanceIndex || 5)}/10</span></div></div><div class="case-item-actions"><a class="button button-primary" href="${actionHref}">${actionLabel}</a><button class="button visibility-button" type="button" data-public="${item.isPublic === true}">${item.isPublic ? '비공개로 전환' : '공개로 전환'}</button><button class="button button-danger delete-case-button" type="button">삭제</button></div></article>`;
  }).join('')}</div>` : `<div class="card empty-cases"><div class="receipt-check">＋</div><h2>아직 접수한 사건이 없습니다</h2><p>그냥 넘기기에는 계속 생각나는 일을 첫 사건으로 접수해 보세요.</p><a class="button button-primary" href="#/submit">첫 사건 접수</a></div>`}</div></section>`;
}

export function bindMyCasesActions({ onRefresh, showToast, showError }) {
  document.querySelectorAll('.visibility-button').forEach(button => {
    button.addEventListener('click', async () => {
      const item = button.closest('.case-item');
      const caseId = item?.dataset.caseId;
      const nextPublic = button.dataset.public !== 'true';
      button.disabled = true;
      try {
        await updateVisibilityCallable({ caseId, isPublic: nextPublic });
        showToast(nextPublic ? '판결을 공개 상태로 변경했습니다.' : '판결을 비공개 상태로 변경했습니다.');
        await onRefresh();
      } catch (error) { showError(error); button.disabled = false; }
    });
  });
  document.querySelectorAll('.delete-case-button').forEach(button => {
    button.addEventListener('click', async () => {
      const item = button.closest('.case-item');
      const caseId = item?.dataset.caseId;
      const title = item?.querySelector('h2')?.textContent || '이 사건';
      if (!window.confirm(`“${title}” 사건과 판결을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
      button.disabled = true;
      try { await deleteCaseCallable({ caseId }); showToast('사건과 판결을 삭제했습니다.'); await onRefresh(); }
      catch (error) { showError(error); button.disabled = false; }
    });
  });
}
