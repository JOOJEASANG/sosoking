/* reaction-bar.js — 반응 바 컴포넌트 */
import { db, auth } from '../firebase.js';
import { doc, updateDoc, increment } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { toast } from './toast.js';
import { navigate } from '../router.js';

const REACTIONS = [
  { key: 'like',   emoji: '👍', label: '좋아요' },
  { key: 'funny',  emoji: '😂', label: '웃겨요' },
  { key: 'sad',    emoji: '😢', label: '슬퍼요' },
  { key: 'wow',    emoji: '😮', label: '놀라워요' },
];

/**
 * 반응 바 HTML 렌더링
 * @param {object} post      - { id, reactions: {like, funny, ...} }
 * @param {Set}    userReacted - 현재 사용자가 이미 반응한 키 집합
 */
export function renderReactionBar(post, userReacted = new Set()) {
  return `
    <div class="reaction-bar" id="reaction-bar-${post.id}">
      ${REACTIONS.map(r => {
        const cnt     = post.reactions?.[r.key] || 0;
        const active  = userReacted.has(r.key) ? 'active' : '';
        return `
          <button class="reaction-btn ${active}" data-post-id="${post.id}" data-reaction="${r.key}">
            ${r.emoji} ${r.label}${cnt > 0 ? ` <strong>${cnt}</strong>` : ''}
          </button>`;
      }).join('')}
    </div>`;
}

/** 반응 버튼에 이벤트 리스너 연결 (renderReactionBar 호출 후 사용) */
export function initReactionBar(postId) {
  document.querySelectorAll(`[data-post-id="${postId}"][data-reaction]`).forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!auth.currentUser) { navigate('/login'); return; }
      if (btn.disabled) return;

      const key = btn.dataset.reaction;
      btn.disabled = true;
      btn.classList.add('active');

      try {
        await updateDoc(doc(db, 'feeds', postId), {
          [`reactions.${key}`]:  increment(1),
          [`reactions.total`]:   increment(1),
        });
        const strong = btn.querySelector('strong');
        const prev = strong ? parseInt(strong.textContent) : 0;
        if (strong) {
          strong.textContent = prev + 1;
        } else {
          btn.insertAdjacentHTML('beforeend', ` <strong>1</strong>`);
        }
      } catch {
        toast.error('반응 등록에 실패했어요');
        btn.disabled = false;
        btn.classList.remove('active');
      }
    });
  });
}
