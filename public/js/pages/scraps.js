import { db } from '../firebase.js';
import {
  collection, query, orderBy, getDocs, where, documentId,
  doc, deleteDoc, writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';
import { renderFeedCard } from '../components/feed-card.js';
import { toast } from '../components/toast.js';
import { appState } from '../state.js';

function wrapScrapCard(post) {
  return `
    <div class="scrap-item" id="scrap-item-${post.id}">
      <button class="scrap-delete-btn" onclick="window.__scrapDelete('${post.id}')" title="스크랩 삭제">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
        삭제
      </button>
      ${renderFeedCard(post)}
    </div>`;
}

export async function renderScraps() {
  const el = document.getElementById('page-content');
  const user = appState.user;

  if (!user) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🔖</div>
        <div class="empty-state__title">로그인이 필요해요</div>
        <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/login?return=/scraps')">로그인하기</button>
      </div>`;
    return;
  }

  el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;

  try {
    const q    = query(collection(db, 'users', user.uid, 'scraps'), orderBy('scrappedAt', 'desc'));
    const snap = await getDocs(q);
    const ids  = snap.docs.map(d => d.id);

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
    posts.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

    const renderList = (items) => items.map(p => wrapScrapCard(p)).join('');

    el.innerHTML = `
      <div style="max-width:720px;margin:0 auto">
        <div class="section-header">
          <h2 class="section-title">🔖 스크랩 <span id="scrap-count">(${posts.length})</span></h2>
          <div style="display:flex;gap:8px">
            ${posts.length ? `<button class="btn btn--ghost btn--sm" id="btn-scrap-delete-all" style="color:var(--color-danger)">전체 삭제</button>` : ''}
            <a href="#/feed" class="btn btn--ghost btn--sm">피드 보기</a>
          </div>
        </div>
        <div id="scrap-list">
          ${posts.length
            ? renderList(posts)
            : `<div class="empty-state">
                 <div class="empty-state__icon">🔖</div>
                 <div class="empty-state__title">스크랩한 글이 없어요</div>
                 <div class="empty-state__desc">마음에 드는 글에 🔖를 눌러보세요!</div>
                 <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/feed')">피드 둘러보기</button>
               </div>`}
        </div>
      </div>`;

    // 개별 삭제
    window.__scrapDelete = async (postId) => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'scraps', postId));
        document.getElementById(`scrap-item-${postId}`)?.remove();
        const remaining = document.querySelectorAll('.scrap-item').length;
        const countEl = document.getElementById('scrap-count');
        if (countEl) countEl.textContent = `(${remaining})`;
        if (!remaining) {
          document.getElementById('scrap-list').innerHTML = `
            <div class="empty-state">
              <div class="empty-state__icon">🔖</div>
              <div class="empty-state__title">스크랩한 글이 없어요</div>
              <div class="empty-state__desc">마음에 드는 글에 🔖를 눌러보세요!</div>
              <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/feed')">피드 둘러보기</button>
            </div>`;
          document.getElementById('btn-scrap-delete-all')?.remove();
        }
        toast.success('스크랩을 삭제했어요');
      } catch { toast.error('삭제에 실패했어요'); }
    };

    // 전체 삭제
    document.getElementById('btn-scrap-delete-all')?.addEventListener('click', async () => {
      if (!confirm('스크랩한 글을 전부 삭제할까요?')) return;
      try {
        const allSnap = await getDocs(collection(db, 'users', user.uid, 'scraps'));
        if (!allSnap.empty) {
          const batch = writeBatch(db);
          allSnap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
        document.getElementById('scrap-list').innerHTML = `
          <div class="empty-state">
            <div class="empty-state__icon">🔖</div>
            <div class="empty-state__title">스크랩한 글이 없어요</div>
            <div class="empty-state__desc">마음에 드는 글에 🔖를 눌러보세요!</div>
            <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/feed')">피드 둘러보기</button>
          </div>`;
        const countEl = document.getElementById('scrap-count');
        if (countEl) countEl.textContent = '(0)';
        document.getElementById('btn-scrap-delete-all')?.remove();
        toast.success('전체 스크랩을 삭제했어요');
      } catch { toast.error('삭제에 실패했어요'); }
    });

  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">불러오기에 실패했어요</div></div>`;
  }
}
