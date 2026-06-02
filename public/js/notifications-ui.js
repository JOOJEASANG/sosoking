import { auth, db } from './firebase.js';
import { appState } from './state.js';
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, updateDoc, where, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let unsubscribe = null;
let liveNotifications = [];
let outsideClickBound = false;

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'": '&#39;' }[ch]));
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
  return ({ multi_reply:'💬', multi_reaction:'❤️', best_reward:'🏆' })[type] || '🔔';
}
function isAccountPage() { return (location.hash || '').startsWith('#/account'); }
function activeAccountTab() { return new URLSearchParams((location.hash.split('?')[1] || '')).get('tab') || 'posts'; }
function unreadCount(items = liveNotifications) { return items.filter(n => !n.read).length; }

async function loadNotifications(uid, max = 50) {
  const base = collection(db, 'notifications');
  const queries = [
    query(base, where('uid', '==', uid), orderBy('createdAtMs', 'desc'), limit(max)),
    query(base, where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(max)),
  ];
  let lastError = null;
  for (const q of queries) {
    try {
      const snap = await getDocs(q);
      return snap.docs
        .map(d => ({ id: d.id, ref: d.ref, ...d.data() }))
        .sort((a, b) => toMillis(b.createdAtMs || b.createdAt) - toMillis(a.createdAtMs || a.createdAt));
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('알림을 불러오지 못했어요');
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
    document.getElementById('notification-read-all')?.addEventListener('click', () => markAllRead(liveNotifications));
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
    if (!unread) { badge?.remove(); bell.setAttribute('aria-label', '알림'); return; }
    if (!badge) { badge = document.createElement('span'); badge.className = 'notif-badge'; bell.appendChild(badge); }
    badge.textContent = unread > 99 ? '99+' : String(unread);
    bell.setAttribute('aria-label', `알림 (${unread}개 읽지 않음)`);
  });

  const stat = [...document.querySelectorAll('.account-stat__label')].find(label => label.textContent.trim() === '새 알림')?.closest('.account-stat');
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
      event.preventDefault(); event.stopPropagation();
      ensurePanelShell();
      const panel = document.getElementById('notification-panel');
      if (!panel) return;
      panel.hidden = !panel.hidden;
      renderPanel();
    });
  });
  updateBadges();
}
function itemTitle(n) {
  return n.title || (n.type === 'multi_reply' ? '내 참여글에 답글이 달렸어요' : n.type === 'multi_reaction' ? '내 참여글에 반응이 달렸어요' : '새 알림');
}
function itemBody(n) { return n.body || `${n.actorName || '익명'}님의 활동이 있어요.`; }
function renderPanel() {
  ensurePanelShell(); updateBadges();
  const list = document.getElementById('notification-list');
  if (!list) return;
  if (!liveNotifications.length) { list.innerHTML = '<div class="notification-empty">알림이 없습니다.</div>'; return; }
  list.innerHTML = liveNotifications.map(n => `
    <button type="button" class="notification-item ${n.read ? '' : 'is-unread'}" data-notification-id="${esc(n.id)}" data-post-id="${esc(n.postId || '')}">
      <span class="notification-item__icon">${iconFor(n.type)}</span><span class="notification-item__body"><b>${esc(itemTitle(n))}</b><small>${esc(itemBody(n))}</small><em>${timeText(n.createdAtMs || n.createdAt)}</em></span>
    </button>`).join('');
  list.querySelectorAll('[data-notification-id]').forEach(bindNotificationOpen);
}
function bindNotificationOpen(btn) {
  btn.addEventListener('click', async () => {
    const id = btn.dataset.notificationId;
    const postId = btn.dataset.postId;
    await markOneRead(id).catch(() => {});
    if (postId) location.hash = `#/detail/${encodeURIComponent(postId)}`;
    const panel = document.getElementById('notification-panel');
    if (panel) panel.hidden = true;
  });
}
async function markOneRead(id) {
  if (!id) return;
  await updateDoc(doc(db, 'notifications', id), { read: true, readAt: new Date(), readAtMs: Date.now() });
}
async function markAllRead(items) {
  const unread = (items || []).filter(n => !n.read).slice(0, 50);
  if (!unread.length) return;
  const batch = writeBatch(db);
  unread.forEach(n => batch.update(n.ref || doc(db, 'notifications', n.id), { read: true, readAt: new Date(), readAtMs: Date.now() }));
  await batch.commit().catch(console.warn);
}
function watchNotifications(uid) {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  if (!uid) { liveNotifications = []; removePanelShell(); return; }
  ensurePanelShell();
  const q = query(collection(db, 'notifications'), where('uid', '==', uid), orderBy('createdAtMs', 'desc'), limit(30));
  unsubscribe = onSnapshot(q, snap => {
    liveNotifications = snap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
    renderPanel();
    updateBadges(liveNotifications);
  }, error => console.warn('[notifications] watch failed', error));
}

function renderAccountItem(n) {
  const points = Number(n.points || 0) > 0 ? `<span class="account-notification-item__points">+${Number(n.points)}P</span>` : '';
  return `<button type="button" class="account-notification-item ${n.read ? '' : 'is-unread'}" data-account-notification-id="${esc(n.id)}" data-post-id="${esc(n.postId || '')}"><span class="account-notification-item__icon">${iconFor(n.type)}</span><span class="account-notification-item__body"><span class="account-notification-item__title">${esc(itemTitle(n))}</span><span class="account-notification-item__text">${esc(itemBody(n))}</span><span class="account-notification-item__meta">${timeText(n.createdAtMs || n.createdAt)}${points}</span></span></button>`;
}
async function renderAccountNotifications() {
  if (!isAccountPage() || activeAccountTab() !== 'notifications') return;
  const uid = auth.currentUser?.uid;
  const content = document.getElementById('account-tab-content');
  if (!uid || !content || content.dataset.accountNotificationsRendering === '1') return;
  content.dataset.accountNotificationsRendering = '1';
  try {
    content.innerHTML = `<div class="loading-center"><div class="spinner"></div></div>`;
    const items = await loadNotifications(uid, 50);
    updateBadges(items);
    const unread = unreadCount(items);
    content.innerHTML = `<div class="account-notifications-section"><div class="account-notifications-section__head"><div><b>🔔 알림함</b><span>내 참여글, 반응, 베스트 보상 알림을 확인합니다.</span></div><button type="button" id="account-notifications-read-all" ${unread ? '' : 'disabled'}>모두 읽음</button></div><div class="account-notifications-section__summary"><span>전체 ${items.length}개</span><span>읽지 않음 ${unread}개</span></div><div class="account-notifications-section__list">${items.length ? items.map(renderAccountItem).join('') : `<div class="account-notifications-empty"><b>알림이 없습니다.</b><span>참여글에 반응이나 답글이 달리면 여기에 표시됩니다.</span></div>`}</div></div>`;
    content.querySelectorAll('[data-account-notification-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await markOneRead(btn.dataset.accountNotificationId).catch(() => {});
        if (btn.dataset.postId) location.hash = `#/detail/${encodeURIComponent(btn.dataset.postId)}`;
      });
    });
    document.getElementById('account-notifications-read-all')?.addEventListener('click', async () => {
      await markAllRead(items).catch(console.warn);
      content.dataset.accountNotificationsRendering = '';
      await renderAccountNotifications();
    });
  } catch (error) {
    console.warn('[account-notifications] render failed', error);
    content.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">알림을 불러오지 못했어요</div></div>`;
  } finally { content.dataset.accountNotificationsRendering = ''; }
}

let timer = null;
function schedule() { clearTimeout(timer); timer = setTimeout(() => { bindHeaderBell(); renderAccountNotifications(); }, 240); }
auth.onAuthStateChanged(user => watchNotifications(user?.uid || ''));
window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 900);
