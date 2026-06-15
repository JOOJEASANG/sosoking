/* reaction-bar.js — 반응 바 컴포넌트 */
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from './toast.js';
import { navigate } from '../router.js';

const REACTIONS = [
  { key: 'like',  emoji: '👍', label: '좋아요' },
  { key: 'funny', emoji: '😂', label: '웃겨요' },
  { key: 'fire',  emoji: '🔥', label: '뜨거워' },
  { key: 'skull', emoji: '💀', label: 'ㅋㅋㅋ' },
];

const reactToPost = httpsCallable(functions, 'reactToPost');

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

export function initReactionBar(postId) {
  const bar = document.getElementById(`reaction-bar-${postId}`);
  if (!bar) return;

  bar.querySelectorAll('[data-reaction]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!auth.currentUser) {
        const returnTo = window.location.hash.slice(1) || '/';
        navigate('/login?return=' + encodeURIComponent(returnTo));
        return;
      }

      if (btn._pending) return;
      btn._pending = true;

      try {
        const result = await reactToPost({ postId, reaction: btn.dataset.reaction });
        applyReactionResult(bar, btn, result.data || {});
      } catch (error) {
        toast.error(error?.message || '반응 등록에 실패했어요');
      } finally {
        btn._pending = false;
      }
    });
  });
}

function applyReactionResult(bar, btn, result) {
  const previous = result.previousReaction;
  const reaction = result.reaction || btn.dataset.reaction;

  if (previous && previous !== reaction) {
    const prevBtn = bar.querySelector(`[data-reaction="${previous}"]`);
    prevBtn?.classList.remove('active');
    adjustCount(prevBtn, -1);
  }

  if (result.active) {
    btn.classList.add('active');
    adjustCount(btn, 1);
  } else {
    btn.classList.remove('active');
    adjustCount(btn, -1);
  }
}

function adjustCount(btn, delta) {
  if (!btn) return;
  const strong = btn.querySelector('strong');
  if (strong) {
    const next = Math.max(0, parseInt(strong.textContent || '0', 10) + delta);
    if (next === 0) strong.remove();
    else strong.textContent = String(next);
  } else if (delta > 0) {
    btn.insertAdjacentHTML('beforeend', ` <strong>1</strong>`);
  }
}