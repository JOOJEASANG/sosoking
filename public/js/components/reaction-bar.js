/* reaction-bar.js — 반응 바 컴포넌트 (토글 + 중복 방지) */
import { db, auth } from '../firebase.js';
import { doc, updateDoc, increment, deleteField } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { toast } from './toast.js';
import { navigate } from '../router.js';

const REACTIONS = [
  { key: 'like',  emoji: '👍', label: '좋아요' },
  { key: 'funny', emoji: '😂', label: '웃겨요' },
  { key: 'sad',   emoji: '😢', label: '슬퍼요' },
  { key: 'wow',   emoji: '😮', label: '놀라워요' },
];

/**
 * 반응 바 HTML 렌더링
 * post.reactedWith = { uid: reactionKey } 형태로 현재 유저 반응 표시
 */
export function renderReactionBar(post) {
  const uid = auth.currentUser?.uid;
  const myReaction = uid ? (post.reactedWith?.[uid] ?? null) : null;

  return `
    <div class="reaction-bar" id="reaction-bar-${post.id}">
      ${REACTIONS.map(r => {
        const cnt    = post.reactions?.[r.key] || 0;
        const active = myReaction === r.key ? 'active' : '';
        return `
          <button class="reaction-btn ${active}" data-post-id="${post.id}" data-reaction="${r.key}">
            ${r.emoji} ${r.label}${cnt > 0 ? ` <strong>${cnt}</strong>` : ''}
          </button>`;
      }).join('')}
    </div>`;
}

/** 반응 버튼 이벤트 연결 — 토글(같은 반응 재클릭 시 취소), 반응 변경 지원 */
export function initReactionBar(postId) {
  const bar = document.getElementById(`reaction-bar-${postId}`);
  if (!bar) return;

  bar.querySelectorAll('[data-reaction]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!auth.currentUser) { navigate('/login'); return; }

      const uid        = auth.currentUser.uid;
      const key        = btn.dataset.reaction;
      const activeBtn  = bar.querySelector('.reaction-btn.active');
      const currentKey = activeBtn?.dataset.reaction ?? null;

      if (btn._pending) return;
      btn._pending = true;

      try {
        const postRef = doc(db, 'feeds', postId);

        if (currentKey === key) {
          // 같은 반응 재클릭 → 반응 취소
          await updateDoc(postRef, {
            [`reactions.${key}`]:  increment(-1),
            'reactions.total':     increment(-1),
            [`reactedWith.${uid}`]: deleteField(),
          });
          btn.classList.remove('active');
          adjustCount(btn, -1);

        } else if (currentKey) {
          // 다른 반응으로 변경
          await updateDoc(postRef, {
            [`reactions.${currentKey}`]: increment(-1),
            [`reactions.${key}`]:        increment(1),
            [`reactedWith.${uid}`]:      key,
          });
          activeBtn.classList.remove('active');
          adjustCount(activeBtn, -1);
          btn.classList.add('active');
          adjustCount(btn, 1);

        } else {
          // 새 반응 추가
          await updateDoc(postRef, {
            [`reactions.${key}`]:  increment(1),
            'reactions.total':     increment(1),
            [`reactedWith.${uid}`]: key,
          });
          btn.classList.add('active');
          adjustCount(btn, 1);
        }
      } catch {
        toast.error('반응 등록에 실패했어요');
      }

      btn._pending = false;
    });
  });
}

function adjustCount(btn, delta) {
  if (!btn) return;
  const strong = btn.querySelector('strong');
  if (strong) {
    const next = Math.max(0, parseInt(strong.textContent || '0') + delta);
    if (next === 0) strong.remove();
    else strong.textContent = next;
  } else if (delta > 0) {
    btn.insertAdjacentHTML('beforeend', ` <strong>1</strong>`);
  }
}
