import { auth, db, functions } from '../firebase.js';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc, addDoc, serverTimestamp, where }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { setMeta } from '../utils/seo.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import { toast } from '../components/toast.js';

let _unsub = null;

function fmtCountdown(ms) {
  if (ms <= 0) return '💥 폭발!';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}시간 ${m}분 남음`;
  if (m > 0) return `${m}분 ${s}초 남음`;
  return `${s}초 남음`;
}

function renderCard(post) {
  const now = Date.now();
  const expiresAt = post.expiresAt?.toDate?.()?.getTime?.() || 0;
  const remaining = expiresAt - now;
  const exploded = post.exploded || remaining <= 0;
  const holder = post.lastCommentName || '(아직 없음)';
  const holderUid = post.lastCommentUid || '';
  const isHolder = auth.currentUser?.uid === holderUid;

  return `
    <div class="hot-potato-card ${exploded ? 'hot-potato-card--exploded' : ''}" data-post-id="${escHtml(post.id)}">
      <div class="hot-potato-card__header">
        <span class="hot-potato-card__title">${escHtml(post.title || '핫포테이토')}</span>
        ${exploded
          ? `<span class="hot-potato-card__badge hot-potato-card__badge--exploded">💥 폭발</span>`
          : `<span class="hot-potato-card__badge hot-potato-card__badge--live">🔥 진행중</span>`}
      </div>
      <div class="hot-potato-card__holder ${isHolder ? 'hot-potato-card__holder--mine' : ''}">
        💣 현재 폭탄 보유자: <strong>${escHtml(holder)}</strong>
        ${isHolder ? ' ← 나!' : ''}
        ${exploded && post.explodedName ? `<div style="margin-top:4px;font-size:12px;color:var(--color-danger)">💥 <strong>${escHtml(post.explodedName)}</strong> 님이 폭탄을 안고 터졌어요!</div>` : ''}
      </div>
      ${!exploded
        ? `<div class="hot-potato-card__timer" data-expires="${expiresAt}">${fmtCountdown(remaining)}</div>`
        : ''}
      <div class="hot-potato-card__meta">댓글 ${post.commentCount || 0}개 · ${formatTime(post.createdAt?.toDate?.() || post.createdAt)}</div>
      ${!exploded
        ? `<div class="hot-potato-card__comment-area">
            <input class="form-input hot-potato-comment-input" placeholder="${auth.currentUser ? '댓글 달면 폭탄이 넘어와요! 🔥' : '로그인 후 참여'}" ${!auth.currentUser ? 'disabled' : ''} maxlength="150">
            <button class="btn btn--danger btn--sm hot-potato-submit" ${!auth.currentUser ? 'disabled' : ''}>던지기 💣</button>
          </div>`
        : ''}
    </div>`;
}

export async function renderHotPotato() {
  setMeta('🔥 핫포테이토');
  const el = document.getElementById('page-content');
  if (_unsub) { _unsub(); _unsub = null; }

  const isAdmin = auth.currentUser
    ? await getDoc(doc(db, 'admins', auth.currentUser.uid)).then(s => s.exists()).catch(() => false)
    : false;

  el.innerHTML = `
    <div class="hot-potato-page">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
          <div style="font-size:22px;font-weight:900">🔥 핫포테이토</div>
          <div style="font-size:13px;color:var(--color-text-muted);margin-top:2px">마지막으로 댓글 단 사람이 폭탄을 안고 터집니다!</div>
        </div>
        ${isAdmin ? `<button class="btn btn--danger btn--sm" id="btn-create-potato">+ 새 폭탄 만들기</button>` : ''}
      </div>
      <div id="potato-list"><div class="loading-center"><div class="spinner"></div></div></div>
    </div>`;

  if (isAdmin) {
    el.querySelector('#btn-create-potato')?.addEventListener('click', async () => {
      const title = prompt('폭탄 주제를 입력하세요 (예: 오늘 점심 뭐 먹을지 못 정하면 쏘기)');
      if (!title?.trim()) return;
      const hours = Number(prompt('몇 시간짜리 폭탄인가요? (1~24)', '2'));
      if (!hours || hours < 1 || hours > 24) return;
      try {
        await httpsCallable(functions, 'createHotPotato')({ title: title.trim(), hours });
        toast.success('핫포테이토 생성 완료! 🔥');
      } catch (e) { toast.error(e.message || '생성 실패'); }
    });
  }

  const listEl = el.querySelector('#potato-list');
  const q = query(collection(db, 'hot_potatoes'), orderBy('createdAt', 'desc'), limit(20));

  _unsub = onSnapshot(q, (snap) => {
    const posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!posts.length) {
      listEl.innerHTML = `<div style="text-align:center;padding:48px;color:var(--color-text-muted)">아직 핫포테이토가 없어요 🥔</div>`;
      return;
    }
    listEl.innerHTML = posts.map(renderCard).join('');
    attachHandlers(listEl, posts);
    startTimers(listEl);
  });
}

function attachHandlers(listEl, posts) {
  listEl.querySelectorAll('.hot-potato-submit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('[data-post-id]');
      const postId = card?.dataset.postId;
      const input = card?.querySelector('.hot-potato-comment-input');
      const text = input?.value.trim();
      if (!text || !postId) return;
      btn.disabled = true;
      btn.textContent = '전달 중...';
      try {
        await httpsCallable(functions, 'throwHotPotato')({ postId, text });
        input.value = '';
        toast.success('폭탄 던졌어요! 🔥 이제 다른 사람이 받았습니다');
      } catch (e) {
        toast.error(e.message || '실패했어요');
      } finally {
        btn.disabled = false;
        btn.textContent = '던지기 💣';
      }
    });
  });
}

let _timerInterval = null;
function startTimers(listEl) {
  if (_timerInterval) clearInterval(_timerInterval);
  _timerInterval = setInterval(() => {
    listEl.querySelectorAll('.hot-potato-card__timer[data-expires]').forEach(el => {
      const remaining = Number(el.dataset.expires) - Date.now();
      el.textContent = fmtCountdown(remaining);
      if (remaining <= 0) clearInterval(_timerInterval);
    });
  }, 1000);
}
