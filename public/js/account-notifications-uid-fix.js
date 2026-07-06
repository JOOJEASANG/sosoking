import { auth, db } from './firebase.js';
import { appState } from './state.js';
import { collection, query, where, orderBy, limit, getDocs, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function formatTime(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return '방금 전';
  const diff = Math.max(0, Date.now() - date.getTime()) / 1000;
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function isNotificationTab() {
  return /^#\/account(?:\?|$)/.test(location.hash || '')
    && new URLSearchParams((location.hash.split('?')[1] || '')).get('tab') === 'notifications';
}

function renderNotification(n) {
  const postId = String(n.postId || '');
  const icon = n.type === 'multi_reply' || n.type === 'comment' ? '💬' : '❤️';
  const title = n.title || (n.type === 'multi_reply' ? '새 답글이 달렸어요' : '새 알림');
  const body = n.body || `${n.actorName || '누군가'}님이 내 글에 반응했어요.`;
  return `
    <div class="notif-item ${n.read ? '' : 'notif-item--unread'}" ${postId ? `data-go-detail="${esc(postId)}"` : ''}>
      <span class="notif-item__icon">${icon}</span>
      <div class="notif-item__body">
        <div class="notif-item__text"><strong>${esc(title)}</strong><br>${esc(body)}</div>
        <div class="notif-item__time">${formatTime(n.createdAt || n.createdAtMs)}</div>
      </div>
    </div>`;
}

async function renderUidNotifications() {
  if (!isNotificationTab()) return;
  const user = auth.currentUser || appState.user;
  const content = document.getElementById('account-tab-content');
  if (!user || !content || content.dataset.uidNotificationRendered === user.uid) return;

  try {
    const snap = await getDocs(query(
      collection(db, 'notifications'),
      where('uid', '==', user.uid),
      orderBy('createdAtMs', 'desc'),
      limit(50),
    ));
    const notifications = snap.docs.map(docSnap => ({ id: docSnap.id, ref: docSnap.ref, ...docSnap.data() }));
    if (!notifications.length) return;

    content.dataset.uidNotificationRendered = user.uid;
    content.innerHTML = `<div class="notif-list">${notifications.map(renderNotification).join('')}</div>`;

    content.querySelectorAll('[data-go-detail]').forEach(item => {
      item.addEventListener('click', () => navigate(`/detail/${item.dataset.goDetail}`));
    });

    const unread = snap.docs.filter(docSnap => docSnap.data().read !== true);
    if (unread.length) {
      const batch = writeBatch(db);
      unread.forEach(docSnap => batch.update(docSnap.ref, {
        read: true,
        readAt: serverTimestamp(),
        readAtMs: Date.now(),
      }));
      await batch.commit().catch(() => {});
      appState.unreadNotifications = 0;
    }
  } catch (error) {
    console.warn('[account-notifications-uid-fix] failed', error);
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(renderUidNotifications, 180);
}

window.addEventListener('hashchange', schedule);
document.addEventListener('click', event => {
  if (event.target.closest?.('[data-tab="notifications"]')) schedule();
}, true);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 800);
