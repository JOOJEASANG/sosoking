// account-request-cleanup.js
// 내정보 화면 요청사항 보정: 팔로우 탭 제거, 작명소 통계 숨김, 알림 탭 깜박임 제거

import { db } from './firebase.js';
import { appState } from './state.js';
import { escHtml, formatTime } from './utils/helpers.js';
import {
  collection, query, where, orderBy, limit, getDocs, writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let notificationLoading = false;

function isAccountPage() {
  return (window.location.hash || '').startsWith('#/account');
}

function normalizeAccountHash() {
  if (!isAccountPage()) return;
  const hash = window.location.hash || '';
  if (/tab=follows\b/.test(hash)) {
    history.replaceState(null, '', '#/account?tab=stats');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}

function renderQuietNotifItem(n) {
  const timeStr = formatTime(n.createdAt?.toDate?.() || n.createdAt);
  const text = n.type === 'comment' ? '댓글을 달았어요' : '반응했어요';
  return `
    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="navigate('/detail/${escHtml(n.postId || '')}')">
      <div class="notif-item__icon">${n.type === 'comment' ? '💬' : '❤️'}</div>
      <div class="notif-item__body">
        <div class="notif-item__text">
          <strong>${escHtml(n.actorName || '익명')}</strong>님이
          <strong>${escHtml(n.postTitle || '내 글')}</strong>에 ${text}
        </div>
        <div class="notif-item__time">${timeStr}</div>
      </div>
    </div>`;
}

function syncUnreadUi() {
  appState.unreadNotifications = 0;
  document.querySelectorAll('.account-tab__badge,.notif-badge-sm,.bottom-nav__badge,.sidebar__nav-badge').forEach(el => el.remove());
  document.querySelectorAll('.account-stat').forEach(stat => {
    const label = stat.querySelector('.account-stat__label');
    if ((label?.textContent || '').includes('새 알림')) {
      const num = stat.querySelector('.account-stat__num');
      if (num) num.textContent = '0';
    }
  });
}

async function renderNotificationsQuietly() {
  if (!isAccountPage() || notificationLoading) return;
  const user = appState.user;
  const content = document.getElementById('account-tab-content');
  if (!user || !content) return;

  notificationLoading = true;
  document.querySelectorAll('.account-tab').forEach(b => b.classList.remove('active'));
  document.querySelector('.account-tab[data-tab="notifications"]')?.classList.add('active');
  history.replaceState(null, '', '#/account?tab=notifications');

  const previousMinHeight = Math.max(content.offsetHeight || 0, 180);
  content.style.minHeight = `${previousMinHeight}px`;
  content.setAttribute('aria-busy', 'true');

  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const notifSnap = await getDocs(q).catch(() => null);
    const notifs = notifSnap?.docs.map(d => ({ id: d.id, ...d.data() })) || [];
    const unread = notifSnap?.docs.filter(d => !d.data().read) || [];

    content.innerHTML = notifs.length
      ? `<div class="notif-list">${notifs.map(renderQuietNotifItem).join('')}</div>`
      : `<div class="empty-state"><div class="empty-state__icon">🔔</div>
         <div class="empty-state__title">아직 알림이 없어요</div>
         <div class="empty-state__desc">모음을 올리면 반응이 오기 시작해요.</div></div>`;

    if (unread.length) {
      const batch = writeBatch(db);
      unread.forEach(d => batch.update(d.ref, { read: true }));
      batch.commit().then(syncUnreadUi).catch(() => {});
    } else {
      syncUnreadUi();
    }
  } catch (error) {
    console.warn('[account cleanup] notifications failed', error);
    content.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🔔</div><div class="empty-state__title">알림을 불러오지 못했어요</div></div>`;
  } finally {
    content.removeAttribute('aria-busy');
    setTimeout(() => { content.style.minHeight = ''; }, 150);
    notificationLoading = false;
  }
}

function cleanupAccountUi() {
  if (!isAccountPage()) return;

  document.querySelectorAll('.account-tab[data-tab="follows"]').forEach(el => el.remove());

  document.querySelectorAll('.stats-page .card .card__body > div').forEach(row => {
    if ((row.textContent || '').includes('작명소')) row.remove();
  });

  const notifTab = document.querySelector('.account-tab[data-tab="notifications"]');
  if (notifTab && notifTab.dataset.cleanupBound !== '2') {
    notifTab.dataset.cleanupBound = '2';
    notifTab.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      renderNotificationsQuietly();
    }, { capture: true });
  }

  if (/tab=notifications\b/.test(window.location.hash || '') && notifTab && !document.querySelector('#account-tab-content .notif-list') && !notificationLoading) {
    renderNotificationsQuietly();
  }
}

normalizeAccountHash();
window.addEventListener('hashchange', () => {
  normalizeAccountHash();
  setTimeout(cleanupAccountUi, 80);
  setTimeout(cleanupAccountUi, 400);
});
window.addEventListener('sosoking:extensions-ready', () => setTimeout(cleanupAccountUi, 100));
new MutationObserver(() => cleanupAccountUi()).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(cleanupAccountUi, 300);
