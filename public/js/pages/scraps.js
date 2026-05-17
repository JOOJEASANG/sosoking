import { db } from '../firebase.js';
import {
  collection, query, orderBy, getDocs, where, documentId,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';
import { renderFeedCard } from '../components/feed-card.js';
import { appState } from '../state.js';

export async function renderScraps() {
  const el = document.getElementById('page-content');
  const user = appState.user;

  if (!user) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🔖</div>
        <div class="empty-state__title">로그인이 필요해요</div>
        <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/login')">로그인하기</button>
      </div>`;
    return;
  }

  el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;

  try {
    const q    = query(collection(db, 'users', user.uid, 'scraps'), orderBy('scrappedAt', 'desc'));
    const snap = await getDocs(q);
    const ids  = snap.docs.map(d => d.id);

    // Firestore `in` 쿼리로 배치 처리 (최대 10개씩)
    const posts = [];
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const batchSnap = await getDocs(
        query(collection(db, 'feeds'), where(documentId(), 'in', batch))
      );
      batchSnap.docs.forEach(d => {
        const data = d.data();
        if (!data.hidden) posts.push({ id: d.id, ...data });
      });
    }
    // scrappedAt 정렬 순서 복원
    posts.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

    el.innerHTML = `
      <div style="max-width:720px;margin:0 auto">
        <div class="section-header">
          <h2 class="section-title">🔖 스크랩 (${posts.length})</h2>
          <a href="#/feed" class="btn btn--ghost btn--sm">피드 보기</a>
        </div>
        ${posts.length
          ? posts.map(p => renderFeedCard(p)).join('')
          : `<div class="empty-state">
               <div class="empty-state__icon">🔖</div>
               <div class="empty-state__title">스크랩한 글이 없어요</div>
               <div class="empty-state__desc">마음에 드는 글에 🔖를 눌러보세요!</div>
               <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/feed')">피드 둘러보기</button>
             </div>`}
      </div>`;
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">불러오기에 실패했어요</div></div>`;
  }
}
