import { auth, db } from './firebase.js';
import { collection, doc, getDocs, limit, orderBy, query, updateDoc, where, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function isAccountPage() {
  return (window.location.hash || '').startsWith('#/account');
}

function activeTab() {
  return new URLSearchParams((window.location.hash.split('?')[1] || '')).get('tab') || 'posts';
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

async function loadNotifications(uid) {
  const q = query(
    collection(db, 'notifications'),
    where('uid', '==', uid),
    orderBy('createdAtMs', 'desc'),
    limit(50),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
}

function updateAccountUnreadBadge(notifications) {
  const unread = notifications.filter(n => !n.read).length;
  const statNums = document.querySelectorAll('.account-stat__num');
  const statLabels = [...document.querySelectorAll('.account-stat__label')];
  const notifLabel = statLabels.find(label => label.textContent.trim() === '새 알림');
  const stat = notifLabel?.closest('.account-stat');
  const num = stat?.querySelector('.account-stat__num');
  if (num) num.textContent = String(unread);

  const tab = document.querySelector('.account-tab[data-tab="notifications"]');
  if (!tab) return;
  tab.querySelector('.account-tab__badge')?.remove();
  if (unread > 0) {
    tab.insertAdjacentHTML('beforeend', `<span class="notif-badge-sm account-tab__badge">${unread > 99 ? '99+' : unread}</span>`);
  }
}

function renderItem(notification) {
  const unreadClass = notification.read ? '' : 'is-unread';
  const points = Number(notification.points || 0) > 0 ? `<span class="account-notification-item__points">+${Number(notification.points)}P</span>` : '';
  return `
    <button type="button" class="account-notification-item ${unreadClass}" data-account-notification-id="${esc(notification.id)}" data-post-id="${esc(notification.postId || '')}">
      <span class="account-notification-item__icon">${iconFor(notification.type)}</span>
      <span class="account-notification-item__body">
        <span class="account-notification-item__title">${esc(notification.title || '새 알림')}</span>
        <span class="account-notification-item__text">${esc(notification.body || '')}</span>
        <span class="account-notification-item__meta">${timeText(notification.createdAtMs)}${points}</span>
      </span>
    </button>`;
}

async function markOneRead(id) {
  if (!id) return;
  await updateDoc(doc(db, 'notifications', id), { read: true, readAt: new Date(), readAtMs: Date.now() });
}

async function markAllRead(notifications) {
  const unread = notifications.filter(n => !n.read).slice(0, 50);
  if (!unread.length) return;
  const batch = writeBatch(db);
  unread.forEach(n => batch.update(n.ref, { read: true, readAt: new Date(), readAtMs: Date.now() }));
  await batch.commit();
}

async function renderAccountNotifications() {
  if (!isAccountPage() || activeTab() !== 'notifications') return;
  const uid = auth.currentUser?.uid;
  const content = document.getElementById('account-tab-content');
  if (!uid || !content) return;
  if (content.dataset.accountNotificationsRendering === '1') return;
  content.dataset.accountNotificationsRendering = '1';

  try {
    const notifications = await loadNotifications(uid);
    updateAccountUnreadBadge(notifications);
    const unread = notifications.filter(n => !n.read).length;
    content.innerHTML = `
      <div class="account-notifications-section">
        <div class="account-notifications-section__head">
          <div><b>🔔 알림함</b><span>내 참여글, 반응, 베스트 보상 알림을 확인합니다.</span></div>
          <button type="button" id="account-notifications-read-all" ${unread ? '' : 'disabled'}>모두 읽음</button>
        </div>
        <div class="account-notifications-section__summary">
          <span>전체 ${notifications.length}개</span>
          <span>읽지 않음 ${unread}개</span>
        </div>
        <div class="account-notifications-section__list">
          ${notifications.length ? notifications.map(renderItem).join('') : `<div class="account-notifications-empty"><b>알림이 없습니다.</b><span>참여글에 반응이나 답글이 달리면 여기에 표시됩니다.</span></div>`}
        </div>
      </div>`;

    content.querySelectorAll('[data-account-notification-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.accountNotificationId;
        const postId = btn.dataset.postId;
        await markOneRead(id).catch(() => {});
        if (postId) window.location.hash = `#/detail/${encodeURIComponent(postId)}`;
      });
    });

    document.getElementById('account-notifications-read-all')?.addEventListener('click', async () => {
      await markAllRead(notifications).catch(console.warn);
      renderAccountNotifications.force = Date.now();
      content.dataset.accountNotificationsRendering = '';
      await renderAccountNotifications();
    });
  } catch (error) {
    console.warn('[account-notifications] render failed', error);
    content.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🔔</div><div class="empty-state__title">알림을 불러오지 못했어요</div></div>`;
  } finally {
    content.dataset.accountNotificationsRendering = '';
  }
}

async function refreshAccountUnreadOnly() {
  if (!isAccountPage()) return;
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    const notifications = await loadNotifications(uid);
    updateAccountUnreadBadge(notifications);
  } catch {}
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    refreshAccountUnreadOnly();
    renderAccountNotifications();
  }, 260);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 900);
