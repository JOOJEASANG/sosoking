import { auth, db } from '../firebase.js';
import { appState } from '../state.js';
import { addDoc, collection, doc, increment, serverTimestamp, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ensureAnonymousActor } from './action-utils.js';

function authorPayload() {
  return {
    authorId: auth.currentUser.uid,
    authorName: appState.nickname || auth.currentUser.displayName || '익명',
    authorPhoto: auth.currentUser.photoURL || '',
  };
}

export async function submitDetailComment(postId, data = {}) {
  if (!(await ensureAnonymousActor('로그인 후 참여해주세요'))) return null;
  const text = String(data.text || '').trim();
  if (!text) throw new Error('내용을 입력해주세요');

  const payload = {
    text,
    ...authorPayload(),
    reactions: {},
    reactedWith: {},
    createdAt: serverTimestamp(),
  };

  if (data.side) payload.side = data.side;

  const ref = await addDoc(collection(db, 'feeds', postId, 'comments'), payload);
  await updateDoc(doc(db, 'feeds', postId), { commentCount: increment(1) }).catch(e => console.warn('commentCount update failed:', e));
  return { id: ref.id, ...payload, createdAt: new Date() };
}

export async function submitCbattleComment(postId, text, side) {
  if (!side) throw new Error('A팀 또는 B팀을 선택해주세요');
  return submitDetailComment(postId, { text, side });
}

export function getSelectedCbattleSide(root = document) {
  return root.querySelector('.cbattle-side-btn.active')?.dataset.side || '';
}

export function bindCbattleSideButtons(root = document) {
  root.querySelectorAll('.cbattle-side-btn').forEach(btn => {
    if (btn.dataset.sideReady === '1') return;
    btn.dataset.sideReady = '1';
    btn.addEventListener('click', event => {
      event.preventDefault();
      root.querySelectorAll('.cbattle-side-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

/**
 * 퀴즈 제출 후 결과 공유 카드를 모달로 표시
 * @param {{ isCorrect: boolean, answer: string, postId: string, postTitle?: string, stats?: { total: number, correctRate: number } }} opts
 */
export function showQuizResultCard({ isCorrect, answer, postId, postTitle = '', stats = null }) {
  const MODAL_ID = 'quiz-result-modal-root';
  if (document.getElementById(MODAL_ID)) return; // 중복 방지

  const emoji   = isCorrect ? '🎉' : '😅';
  const verdict = isCorrect ? '정답!' : '아깝다!';
  const modClass = isCorrect ? 'quiz-result-card--correct' : 'quiz-result-card--wrong';
  const headerText = isCorrect ? '✅ 정답입니다' : '❌ 오답입니다';

  const statsHtml = stats
    ? `<p class="quiz-result-card__stats">참여자 <strong>${stats.total.toLocaleString()}명</strong> 중 <strong>${stats.correctRate}%</strong> 정답</p>`
    : '';

  const shareUrl = `${location.origin}/p/${postId}`;

  const html = `
    <div class="quiz-result-modal" id="${MODAL_ID}" role="dialog" aria-modal="true" aria-label="퀴즈 결과">
      <div class="quiz-result-card ${modClass}">
        <div class="quiz-result-card__header">${headerText}</div>
        <div class="quiz-result-card__emoji" aria-hidden="true">${emoji}</div>
        <p class="quiz-result-card__verdict">${verdict}</p>
        <p class="quiz-result-card__answer">정답: <strong>${answer.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</strong></p>
        ${statsHtml}
        <button class="quiz-result-card__share-btn" id="qrc-share-btn">🔗 공유하기</button>
        <button class="quiz-result-card__close" id="qrc-close-btn">닫기</button>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);

  const modal = document.getElementById(MODAL_ID);

  function closeModal() {
    modal.remove();
  }

  // 닫기 버튼
  modal.querySelector('#qrc-close-btn').addEventListener('click', closeModal);

  // 오버레이 클릭으로 닫기
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  // 공유 버튼
  modal.querySelector('#qrc-share-btn').addEventListener('click', async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: postTitle || '퀴즈', url: shareUrl });
      } catch (_) { /* 사용자 취소 등 무시 */ }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        const btn = modal.querySelector('#qrc-share-btn');
        btn.textContent = '✅ 링크 복사됨!';
        setTimeout(() => { btn.textContent = '🔗 공유하기'; }, 2000);
      } catch (_) {
        alert(`링크를 복사해주세요:\n${shareUrl}`);
      }
    }
  });

  // 5초 후 자동 닫힘
  const autoClose = setTimeout(closeModal, 5000);
  modal.querySelector('#qrc-close-btn').addEventListener('click', () => clearTimeout(autoClose), { once: true });
}
