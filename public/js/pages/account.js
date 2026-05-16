import { auth, db, signOut } from '../firebase.js';
import {
  collection, query, where, orderBy, limit, getDocs,
  doc, getDoc, updateDoc, writeBatch, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { renderFeedCard } from '../components/feed-card.js';
import { appState } from '../state.js';
import { setMeta } from '../utils/seo.js';

const TITLES = [
  { min: 30, label: '👑 소소킹' },
  { min: 20, label: '⭐ 소소러' },
  { min: 10, label: '🔥 놀이꾼' },
  { min: 3,  label: '😊 소소인' },
  { min: 1,  label: '🌱 새싹'  },
  { min: 0,  label: '🥚 뉴비'  },
];

function computeTitle(count) {
  return (TITLES.find(t => count >= t.min) || TITLES.at(-1)).label;
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatTime(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)    return '방금 전';
  if (diff < 3600)  return `${Math.floor(diff/60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff/3600)}시간 전`;
  return `${Math.floor(diff/86400)}일 전`;
}

export async function renderAccount() {
  setMeta('내 계정');
  const el   = document.getElementById('page-content');
  const user = appState.user;

  if (!user) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">👤</div>
        <div class="empty-state__title">로그인이 필요해요</div>
        <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/login')">로그인하기</button>
      </div>`;
    return;
  }

  el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;

  const [myPosts, userSnap] = await Promise.all([
    fetchMyPosts(user.uid),
    getDoc(doc(db, 'users', user.uid)).catch(() => null),
  ]);

  const userData  = userSnap?.exists() ? userSnap.data() : {};
  const title     = computeTitle(myPosts.length);
  const streak    = appState.streak || userData.streak || 0;

  // save computed title back to user doc (non-blocking)
  if (userSnap?.exists()) {
    updateDoc(doc(db, 'users', user.uid), { title }).catch(() => {});
    appState.userTitle = title;
  }

  const activeTab = new URLSearchParams(window.location.hash.split('?')[1] || '').get('tab') || 'posts';

  el.innerHTML = `
    <div style="max-width:720px;margin:0 auto">
      <div class="card" style="margin-bottom:16px">
        <div class="account-header">
          <div class="avatar" style="width:72px;height:72px;font-size:24px;font-weight:800">
            ${user.photoURL
              ? `<img src="${user.photoURL}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
              : (user.displayName?.[0] || user.email?.[0] || '나')}
          </div>
          <div class="account-nickname">${escHtml(user.displayName || user.email?.split('@')[0] || '익명')}</div>
          <div class="account-level">
            <span class="title-badge">${title}</span>
            ${streak > 0 ? `<span class="streak-pill">🔥 ${streak}일 연속</span>` : ''}
          </div>
          <div class="account-stats">
            <div class="account-stat">
              <div class="account-stat__num">${myPosts.length}</div>
              <div class="account-stat__label">작성한 글</div>
            </div>
            <div class="account-stat">
              <div class="account-stat__num">${appState.unreadNotifications || 0}</div>
              <div class="account-stat__label">새 알림</div>
            </div>
          </div>
        </div>
        <div class="card__footer" style="display:flex;gap:8px">
          <button class="btn btn--ghost btn--sm" id="btn-logout">로그아웃</button>
        </div>
      </div>

      <!-- 탭 -->
      <div class="account-tabs">
        <button class="account-tab ${activeTab === 'posts' ? 'active' : ''}" data-tab="posts">📝 내 글 (${myPosts.length})</button>
        <button class="account-tab ${activeTab === 'scraps' ? 'active' : ''}" data-tab="scraps">🔖 스크랩</button>
        <button class="account-tab ${activeTab === 'notifications' ? 'active' : ''}" data-tab="notifications">
          🔔 알림${appState.unreadNotifications > 0 ? ` <span class="notif-badge-sm">${appState.unreadNotifications}</span>` : ''}
        </button>
      </div>
      <div id="account-tab-content"></div>
    </div>`;

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await signOut(auth);
    toast.success('로그아웃됐어요');
    navigate('/');
  });

  const renderTab = async (tab) => {
    const content = document.getElementById('account-tab-content');
    if (!content) return;
    content.innerHTML = `<div class="loading-center"><div class="spinner"></div></div>`;

    if (tab === 'posts') {
      content.innerHTML = myPosts.length
        ? myPosts.map(p => renderFeedCard(p)).join('')
        : `<div class="empty-state"><div class="empty-state__icon">✏️</div>
           <div class="empty-state__title">아직 쓴 글이 없어요</div>
           <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/write')">첫 글 쓰기</button></div>`;

    } else if (tab === 'scraps') {
      const scrapSnap = await getDocs(
        query(collection(db, 'users', user.uid, 'scraps'), orderBy('scrappedAt', 'desc'))
      ).catch(() => null);
      const ids = scrapSnap?.docs.map(d => d.id) || [];
      const posts = ids.length
        ? (await Promise.all(ids.map(id => getDoc(doc(db, 'feeds', id)))))
            .filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() })).filter(p => !p.hidden)
        : [];
      content.innerHTML = posts.length
        ? posts.map(p => renderFeedCard(p)).join('')
        : `<div class="empty-state"><div class="empty-state__icon">🔖</div>
           <div class="empty-state__title">스크랩한 글이 없어요</div>
           <div class="empty-state__desc">마음에 드는 글에 🔖를 눌러보세요!</div></div>`;

    } else if (tab === 'notifications') {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(50),
      );
      const notifSnap = await getDocs(q).catch(() => null);
      const notifs = notifSnap?.docs.map(d => ({ id: d.id, ...d.data() })) || [];

      // mark all unread as read (batch)
      const unread = notifSnap?.docs.filter(d => !d.data().read) || [];
      if (unread.length) {
        const batch = writeBatch(db);
        unread.forEach(d => batch.update(d.ref, { read: true }));
        batch.commit().then(() => { appState.unreadNotifications = 0; }).catch(() => {});
      }

      content.innerHTML = notifs.length
        ? `<div class="notif-list">${notifs.map(n => renderNotifItem(n)).join('')}</div>`
        : `<div class="empty-state"><div class="empty-state__icon">🔔</div>
           <div class="empty-state__title">새 알림이 없어요</div></div>`;
    }
  };

  document.querySelectorAll('.account-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.account-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTab(btn.dataset.tab);
    });
  });

  renderTab(activeTab);
}

function renderNotifItem(n) {
  const timeStr = formatTime(n.createdAt?.toDate?.() || n.createdAt);
  const icon = n.type === 'comment' ? '💬' : '❤️';
  return `
    <div class="notif-item ${n.read ? '' : 'notif-item--unread'}" onclick="navigate('/detail/${n.postId}')">
      <span class="notif-item__icon">${icon}</span>
      <div class="notif-item__body">
        <div class="notif-item__text">
          <strong>${escHtml(n.actorName || '익명')}</strong>님이
          <strong>${escHtml(n.postTitle || '내 글')}</strong>에 ${n.type === 'comment' ? '댓글을 달았어요' : '반응했어요'}
        </div>
        <div class="notif-item__time">${timeStr}</div>
      </div>
    </div>`;
}

async function fetchMyPosts(uid) {
  try {
    const q = query(
      collection(db, 'feeds'),
      where('authorId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(30),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}
