import { auth, db, onAuthStateChanged } from './firebase.js';
import { appState } from './state.js';
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let unsubscribe = null;
let liveNotifications = [];
let outsideClickBound = false;

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const date = value?.toDate?.() || new Date(value);
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function timeText(value) {
  const n = toMillis(value);
  if (!n) return '';
  const diff = Date.now() - n;
  if (diff < 60_000) return '방금 전';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}일 전`;
  return new Date(n).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function iconFor(type) {
  return ({ multi_reply:'💬', comment:'💬', multi_reaction:'❤️', best_reward:'🏆' })[type] || '🔔';
}

function unreadCount(items = liveNotifications) {
  return items.filter(item => item.read !== true).length;
}

function itemTitle(item) {
  return item.title || (item.type === 'comment' || item.type === 'multi_reply' ? '새 댓글이 달렸어요' : '새 알림');
}

function itemBody(item) {
  return item.body || `${item.actorName || '누군가'}님의 활동이 있어요.`;
}

function ensurePanelShell() {
  if (!document.getElementById('notification-widget')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="notification-widget notification-widget--header" id="notification-widget">
        <div class="notification-panel" id="notification-panel" hidden>
          <div class="notification-panel__head"><b>알림</b><button type="button" id="notification-read-all">모두 읽음</button></div>
          <div class="notification-panel__list" id="notification-list"><div class="notification-empty">알림이 없습니다.</div></div>
        </div>
      </div>`);
    document.getElementById('notification-read-all')?.addEventListener('click', () => markAllRead());
  }
  bindHeaderBell();
  if (!outsideClickBound) {
    outsideClickBound = true;
    document.addEventListener('click', event => {
      const widget = document.getElementById('notification-widget');
      const panel = document.getElementById('notification-panel');
      const bell = event.target.closest?.('.notif-bell');
      if (!widget || !panel || panel.hidden || bell) return;
      if (!widget.contains(event.target)) panel.hidden = true;
    });
  }
}

function removePanelShell() {
  document.getElementById('notification-widget')?.remove();
  document.querySelectorAll('.notif-bell .notif-badge').forEach(badge => badge.remove());
}

function updateBadges(items = liveNotifications) {
  const unread = unreadCount(items);
  appState.unreadNotifications = unread;
  document.querySelectorAll('.notif-bell').forEach(bell => {
    let badge = bell.querySelector('.notif-badge');
    if (!unread) {
      badge?.remove();
      bell.setAttribute('aria-label', '알림');
      return;
    }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'notif-badge';
      bell.appendChild(badge);
    }
    badge.textContent = unread > 99 ? '99+' : String(unread);
    bell.setAttribute('aria-label', `알림 (${unread}개 읽지 않음)`);
  });

  const stat = [...document.querySelectorAll('.account-stat__label')]
    .find(label => label.textContent.trim() === '새 알림')?.closest('.account-stat');
  const num = stat?.querySelector('.account-stat__num');
  if (num) num.textContent = String(unread);

  const tab = document.querySelector('.account-tab[data-tab="notifications"]');
  if (tab) {
    tab.querySelector('.account-tab__badge')?.remove();
    if (unread > 0) tab.insertAdjacentHTML('beforeend', `<span class="notif-badge-sm account-tab__badge">${unread > 99 ? '99+' : unread}</span>`);
  }
}

function bindHeaderBell() {
  document.querySelectorAll('.notif-bell').forEach(bell => {
    if (bell.dataset.notificationPanelBound === '1') return;
    bell.dataset.notificationPanelBound = '1';
    bell.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      ensurePanelShell();
      const panel = document.getElementById('notification-panel');
      if (!panel) return;
      panel.hidden = !panel.hidden;
      renderPanel();
    });
  });
  updateBadges();
}

function renderPanel() {
  const list = document.getElementById('notification-list');
  if (!list) return;
  updateBadges();
  if (!liveNotifications.length) {
    list.innerHTML = '<div class="notification-empty">알림이 없습니다.</div>';
    return;
  }
  list.innerHTML = liveNotifications.map(item => `
    <button type="button" class="notification-item ${item.read ? '' : 'is-unread'}" data-notification-id="${esc(item.id)}" data-post-id="${esc(item.postId || '')}">
      <span class="notification-item__icon">${iconFor(item.type)}</span>
      <span class="notification-item__body"><b>${esc(itemTitle(item))}</b><small>${esc(itemBody(item))}</small><em>${timeText(item.createdAtMs || item.createdAt)}</em></span>
    </button>`).join('');

  list.querySelectorAll('[data-notification-id]').forEach(button => {
    button.addEventListener('click', async () => {
      await markOneRead(button.dataset.notificationId).catch(() => {});
      if (button.dataset.postId) location.hash = `#/detail/${encodeURIComponent(button.dataset.postId)}`;
      const panel = document.getElementById('notification-panel');
      if (panel) panel.hidden = true;
    });
  });
}

async function markOneRead(id) {
  if (!id) return;
  await updateDoc(doc(db, 'notifications', id), {
    read: true,
    readAt: serverTimestamp(),
  });
}

async function markAllRead() {
  const unread = liveNotifications.filter(item => item.read !== true).slice(0, 50);
  if (!unread.length) return;
  const batch = writeBatch(db);
  unread.forEach(item => batch.update(item.ref || doc(db, 'notifications', item.id), {
    read: true,
    readAt: serverTimestamp(),
  }));
  await batch.commit();
}

function stopWatching() {
  unsubscribe?.();
  unsubscribe = null;
}

function watchNotifications(uid) {
  stopWatching();
  if (!uid) {
    liveNotifications = [];
    updateBadges([]);
    removePanelShell();
    return;
  }
  ensurePanelShell();
  const q = query(
    collection(db, 'notifications'),
    where('uid', '==', uid),
    orderBy('createdAtMs', 'desc'),
    limit(30),
  );
  unsubscribe = onSnapshot(q, snap => {
    liveNotifications = snap.docs.map(item => ({ id: item.id, ref: item.ref, ...item.data() }));
    renderPanel();
  }, error => console.warn('[notifications] watch failed', error));
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const user = auth.currentUser || appState.user;
    if (!user) {
      removePanelShell();
      updateBadges([]);
      return;
    }
    ensurePanelShell();
    bindHeaderBell();
  }, 120);
}

onAuthStateChanged(auth, user => watchNotifications(user?.uid || ''));
window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:auth-ready', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('pagehide', stopWatching, { once: true });
setTimeout(schedule, 500);
