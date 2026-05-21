import { auth, db } from './firebase.js';
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc, where, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let unsubscribe = null;
let notifications = [];

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function timeText(ms) {
  const n = Number(ms || 0);
  if (!n) return '';
  const diff = Date.now() - n;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(n).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function iconFor(type) {
  return {
    multi_reply: '💬',
    multi_reaction: '👍',
    best_reward: '🏆',
    quiz_correct: '🧠',
  }[type] || '🔔';
}

function ensureShell() {
  if (document.getElementById('notification-fab')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="notification-widget" id="notification-widget">
      <button type="button" class="notification-fab" id="notification-fab" aria-label="알림 열기">
        <span>🔔</span><b id="notification-badge" style="display:none">0</b>
      </button>
      <div class="notification-panel" id="notification-panel" hidden>
        <div class="notification-panel__head">
          <b>알림</b>
          <button type="button" id="notification-read-all">모두 읽음</button>
        </div>
        <div class="notification-panel__list" id="notification-list"><div class="notification-empty">알림이 없습니다.</div></div>
      </div>
    </div>`);

  document.getElementById('notification-fab')?.addEventListener('click', () => {
    const panel = document.getElementById('notification-panel');
    if (!panel) return;
    panel.hidden = !panel.hidden;
  });

  document.addEventListener('click', event => {
    const widget = document.getElementById('notification-widget');
    const panel = document.getElementById('notification-panel');
    if (!widget || !panel || panel.hidden) return;
    if (!widget.contains(event.target)) panel.hidden = true;
  });

  document.getElementById('notification-read-all')?.addEventListener('click', markAllRead);
}

function removeShell() {
  document.getElementById('notification-widget')?.remove();
}

function renderNotifications() {
  const badge = document.getElementById('notification-badge');
  const list = document.getElementById('notification-list');
  if (!badge || !list) return;
  const unread = notifications.filter(n => !n.read).length;
  badge.textContent = unread > 99 ? '99+' : String(unread);
  badge.style.display = unread ? '' : 'none';

  if (!notifications.length) {
    list.innerHTML = '<div class="notification-empty">알림이 없습니다.</div>';
    return;
  }

  list.innerHTML = notifications.map(n => `
    <button type="button" class="notification-item ${n.read ? '' : 'is-unread'}" data-notification-id="${esc(n.id)}" data-post-id="${esc(n.postId || '')}">
      <span class="notification-item__icon">${iconFor(n.type)}</span>
      <span class="notification-item__body">
        <b>${esc(n.title || '새 알림')}</b>
        <small>${esc(n.body || '')}</small>
        <em>${timeText(n.createdAtMs)}</em>
      </span>
    </button>`).join('');

  list.querySelectorAll('[data-notification-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.notificationId;
      const postId = btn.dataset.postId;
      if (id) await markOneRead(id).catch(() => {});
      if (postId) location.hash = `#/detail/${encodeURIComponent(postId)}`;
      const panel = document.getElementById('notification-panel');
      if (panel) panel.hidden = true;
    });
  });
}

async function markOneRead(id) {
  const uid = auth.currentUser?.uid;
  if (!uid || !id) return;
  await updateDoc(doc(db, 'notifications', id), { read: true, readAt: new Date(), readAtMs: Date.now() });
}

async function markAllRead() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const unread = notifications.filter(n => !n.read).slice(0, 30);
  if (!unread.length) return;
  const batch = writeBatch(db);
  unread.forEach(n => batch.update(doc(db, 'notifications', n.id), { read: true, readAt: new Date(), readAtMs: Date.now() }));
  await batch.commit().catch(console.warn);
}

function watchNotifications(uid) {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  if (!uid) {
    notifications = [];
    removeShell();
    return;
  }
  ensureShell();
  const q = query(
    collection(db, 'notifications'),
    where('uid', '==', uid),
    orderBy('createdAtMs', 'desc'),
    limit(30),
  );
  unsubscribe = onSnapshot(q, snap => {
    notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderNotifications();
  }, error => {
    console.warn('[notifications] watch failed', error);
  });
}

auth.onAuthStateChanged(user => watchNotifications(user?.uid || ''));
