import { auth, db } from './firebase.js';
import { appState } from './state.js';
import { canOfferInstall, isStandalone, requestPwaInstall } from './pwa-install.js';
import { collection, limit, orderBy, query, serverTimestamp, where, getDocs, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let renderPending = false;
let notificationLoading = false;

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

function isAccountPage() {
  return (location.hash || '').startsWith('#/account');
}

function activeTab() {
  return new URLSearchParams((location.hash.split('?')[1] || '')).get('tab') || 'posts';
}

function googlePhoto(user) {
  const providers = Array.isArray(user?.providerData) ? user.providerData : [];
  return user?.photoURL && providers.some(item => item?.providerId === 'google.com') ? String(user.photoURL) : '';
}

function toMillis(value) {
  if (typeof value === 'number') return value;
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function timeText(value) {
  const time = toMillis(value);
  if (!time) return '방금 전';
  const diff = Math.max(0, Date.now() - time);
  if (diff < 60_000) return '방금 전';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}

function notificationIcon(type) {
  return type === 'comment' || type === 'multi_reply' ? '💬' : type === 'best_reward' ? '🏆' : '❤️';
}

function renderNotification(item) {
  const postId = String(item.postId || '');
  return `
    <button type="button" class="account-notification-item ${item.read ? '' : 'is-unread'}" ${postId ? `data-account-notification-post="${esc(postId)}"` : ''}>
      <span class="account-notification-item__icon">${notificationIcon(item.type)}</span>
      <span class="account-notification-item__body">
        <span class="account-notification-item__title">${esc(item.title || '새 알림')}</span>
        <span class="account-notification-item__text">${esc(item.body || `${item.actorName || '누군가'}님의 활동이 있어요.`)}</span>
        <span class="account-notification-item__meta">${timeText(item.createdAtMs || item.createdAt)}</span>
      </span>
    </button>`;
}

async function renderAccountNotifications() {
  if (!isAccountPage() || activeTab() !== 'notifications' || notificationLoading) return;
  const user = auth.currentUser || appState.user;
  const content = document.getElementById('account-tab-content');
  if (!user || !content) return;

  notificationLoading = true;
  content.dataset.accountNotificationOwner = 'runtime-controller';
  content.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';
  try {
    const snap = await getDocs(query(
      collection(db, 'notifications'),
      where('uid', '==', user.uid),
      orderBy('createdAtMs', 'desc'),
      limit(50),
    ));
    const items = snap.docs.map(item => ({ id: item.id, ref: item.ref, ...item.data() }));
    const unread = items.filter(item => item.read !== true);
    content.innerHTML = `
      <div class="account-notifications-section">
        <div class="account-notifications-section__head">
          <div><b>🔔 알림함</b><span>내 글과 참여에 생긴 새 소식을 확인합니다.</span></div>
          <button type="button" data-account-read-all ${unread.length ? '' : 'disabled'}>모두 읽음</button>
        </div>
        <div class="account-notifications-section__summary"><span>전체 ${items.length}개</span><span>읽지 않음 ${unread.length}개</span></div>
        <div class="account-notifications-section__list">
          ${items.length ? items.map(renderNotification).join('') : '<div class="account-notifications-empty"><b>알림이 없습니다.</b><span>댓글이나 반응이 생기면 여기에 표시됩니다.</span></div>'}
        </div>
      </div>`;

    content.querySelectorAll('[data-account-notification-post]').forEach(button => {
      button.addEventListener('click', () => {
        location.hash = `#/detail/${encodeURIComponent(button.dataset.accountNotificationPost)}`;
      });
    });

    const markRead = async docs => {
      if (!docs.length) return;
      const batch = writeBatch(db);
      docs.forEach(item => batch.update(item.ref, { read: true, readAt: serverTimestamp() }));
      await batch.commit();
    };

    content.querySelector('[data-account-read-all]')?.addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      await markRead(unread).catch(error => console.warn('[account notifications read]', error));
    });

    if (unread.length) {
      await markRead(unread).catch(error => console.warn('[account notifications auto read]', error));
      appState.unreadNotifications = 0;
    }
  } catch (error) {
    console.warn('[account notifications]', error);
    content.innerHTML = '<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">알림을 불러오지 못했어요</div></div>';
  } finally {
    notificationLoading = false;
  }
}

function normalizeAccountUi() {
  if (!isAccountPage()) return;

  document.querySelectorAll('.account-tab[data-tab="follows"]').forEach(tab => tab.remove());
  if (activeTab() === 'follows') {
    history.replaceState(null, '', '#/account?tab=stats');
  }

  const user = auth.currentUser || appState.user;
  const photo = googlePhoto(user);
  const accountAvatar = document.querySelector('.account-avatar');
  if (photo && accountAvatar && accountAvatar.dataset.googlePhoto !== photo) {
    accountAvatar.dataset.googlePhoto = photo;
    accountAvatar.classList.add('avatar--nickname-icon');
    accountAvatar.innerHTML = `<img class="account-avatar__img" src="${esc(photo)}" referrerpolicy="no-referrer" alt="">`;
  }

  const adminAvatar = document.querySelector('.admin-profile-card__avatar');
  if (photo && adminAvatar && adminAvatar.dataset.googlePhoto !== photo) {
    adminAvatar.dataset.googlePhoto = photo;
    adminAvatar.innerHTML = `<img class="admin-profile-card__avatar-img" src="${esc(photo)}" referrerpolicy="no-referrer" alt="">`;
  }

  const logout = document.getElementById('btn-logout');
  if (logout) {
    let install = document.getElementById('btn-pwa-install') || document.querySelector('[data-account-install-button]');
    if (isStandalone()) {
      install?.remove();
    } else if (!install && canOfferInstall()) {
      install = document.createElement('button');
      install.type = 'button';
      install.id = 'btn-pwa-install';
      install.className = 'btn btn--ghost btn--sm';
      install.textContent = '📲 앱 설치';
      logout.insertAdjacentElement('beforebegin', install);
    }
  }

  if (activeTab() === 'notifications') void renderAccountNotifications();
}

function schedule() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    normalizeAccountUi();
  });
}

document.addEventListener('click', event => {
  const install = event.target.closest?.('#btn-pwa-install, [data-account-install-button]');
  if (install) {
    event.preventDefault();
    event.stopImmediatePropagation();
    void requestPwaInstall({ button: install });
    return;
  }

  const notificationTab = event.target.closest?.('.account-tab[data-tab="notifications"]');
  if (notificationTab) {
    event.preventDefault();
    event.stopImmediatePropagation();
    document.querySelectorAll('.account-tab').forEach(tab => tab.classList.toggle('active', tab === notificationTab));
    history.replaceState(null, '', '#/account?tab=notifications');
    void renderAccountNotifications();
  }
}, true);

window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:auth-ready', schedule);
window.addEventListener('sosoking:pwa-statechange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 300);
