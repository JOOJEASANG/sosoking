import { auth, signOut, db } from '../firebase.js';
import { collection, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { renderFeedCard } from '../components/feed-card.js';
import { appState } from '../app.js';

export async function renderAccount() {
  const el = document.getElementById('page-content');
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

  const myPosts = await fetchMyPosts(user.uid);

  el.innerHTML = `
    <div style="max-width:720px;margin:0 auto">
      <div class="card" style="margin-bottom:16px">
        <div class="account-header">
          <div class="avatar" style="width:72px;height:72px;font-size:24px;font-weight:800">
            ${user.photoURL
              ? `<img src="${user.photoURL}" alt="">`
              : (user.displayName?.[0] || user.email?.[0] || '나')}
          </div>
          <div class="account-nickname">${user.displayName || user.email?.split('@')[0] || '익명'}</div>
          <div class="account-level"><span class="badge badge--primary">일반 회원</span></div>
          <div class="account-stats">
            <div class="account-stat">
              <div class="account-stat__num">${myPosts.length}</div>
              <div class="account-stat__label">작성한 글</div>
            </div>
          </div>
        </div>
        <div class="card__footer" style="display:flex;gap:8px">
          <button class="btn btn--ghost btn--sm" id="btn-logout">로그아웃</button>
        </div>
      </div>

      <div class="section-header">
        <h2 class="section-title">내가 쓴 글</h2>
      </div>
      ${myPosts.length
        ? myPosts.map(p => renderFeedCard(p)).join('')
        : `<div class="empty-state">
            <div class="empty-state__icon">✏️</div>
            <div class="empty-state__title">아직 쓴 글이 없어요</div>
            <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/write')">첫 글 쓰기</button>
          </div>`}
    </div>`;

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await signOut(auth);
    toast.success('로그아웃됐어요');
    navigate('/');
  });
}

async function fetchMyPosts(uid) {
  try {
    const q = query(
      collection(db, 'feeds'),
      where('authorId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}
