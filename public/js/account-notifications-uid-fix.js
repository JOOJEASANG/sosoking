import { auth, db } from './firebase.js';
import { appState } from './state.js';
import { collection, query, where, orderBy, limit, getDocs, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function timeText(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return '방금 전';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return date.toLocaleDateString('ko-KR');
}

function isAccountNotificationsTab() {
  const path = window.location.hash.slice(1).split('?')[0] || '/';
  if (path !== '/account') return false;
  return new URLSearchParams(window.location.hash.split('?')[1] || '').get('tab') === 'notifications';
}

function renderNotice(n) {
  const title = n.title || (n.type === 'multi_reply' ? '내 참여글에 답글이 달렸어요' : n.type === 'multi_reaction' ? '내 참여글에 반응이 달렸어요' : '새 알림');
  const body = n.body || `${n.actorName || '익명'}님의 활동이 있어요.`;
  const href = n.postId ? `#/detail/${encodeURIComponent(n.postId)}` : '#/account?tab=notifications';
  return `
    <button class="notif-item ${n.read ? '' : 'notif-item--unread'}" type="button" data-notice-link="${esc(href)}" style="width:100%;text-align:left;border:0;background:transparent">
      <span class="notif-item__icon">${n.type === 'multi_reply' ? '💬' : n.type === 'multi_reaction' ? '❤️' : '🔔'}</span>
      <div class="notif-item__body">
        <div class="notif-item__text"><strong>${esc(title)}</strong><br>${esc(body)}</div>
        <div class="notif-item__time">${esc(timeText(n.createdAt) || timeText(n.createdAtMs))}</div>
      </div>
    </button>`;
}

async function patchAccountNotifications() {
  if (!isAccountNotificationsTab()) return;
  const user = auth.currentUser;
  const content = document.getElementById('account-tab-content');
  if (!user || !content) return;
  if (content.dataset.uidNoticePatched === user.uid) return;

  content.dataset.uidNoticePatched = user.uid;
  content.innerHTML = `<div class="loading-center"><div class="spinner"></div></div>`;

  try {
    const q = query(collection(db, 'notifications'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    const notices = snap.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
    const unread = notices.filter(n => !n.read);

    if (unread.length) {
      const batch = writeBatch(db);
      unread.forEach(n => batch.update(n.ref, { read: true, readAtMs: Date.now() }));
      batch.commit().then(() => { appState.unreadNotifications = 0; }).catch(() => {});
    }

    content.innerHTML = notices.length
      ? `<div class="notif-list">${notices.map(renderNotice).join('')}</div>`
      : `<div class="empty-state"><div class="empty-state__icon">🔔</div><div class="empty-state__title">아직 알림이 없어요</div><div class="empty-state__desc">글을 올리면 반응이 오기 시작해요.</div></div>`;

    content.querySelectorAll('[data-notice-link]').forEach(btn => {
      btn.addEventListener('click', () => {
        const href = btn.dataset.noticeLink;
        if (href && href !== window.location.hash) window.location.hash = href;
      });
    });
  } catch (error) {
    console.warn('[account notifications uid fix] failed', error);
    content.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">알림을 불러오지 못했어요</div></div>`;
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(patchAccountNotifications, 180);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 700);
