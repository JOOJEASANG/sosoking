import { db, auth, functions } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { renderReactionBar, initReactionBar } from '../components/reaction-bar.js';
import { setMeta } from '../utils/seo.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import { fetchComments } from '../detail/data.js';
import { renderImageSection } from '../detail/body-render.js';
import { renderCommentSection } from '../detail/comment-render.js';
import { appendSimilarPosts } from '../detail/similar-render.js';

const incrementPostView = httpsCallable(functions, 'incrementPostView');
const TYPE_META = {
  judgment: { label: '판결', css: 'judgment' },
  consult: { label: '상담', css: 'consult' },
  vote: { label: '토론', css: 'vote' },
  drip: { label: '드립', css: 'drip' },
};

function subtype(post) {
  if (TYPE_META[post.subtype]) return post.subtype;
  if (post.modules?.consult?.enabled) return 'consult';
  if (post.modules?.drip?.enabled) return 'drip';
  if (post.modules?.vote?.voteMode === 'pros_cons') return 'vote';
  return 'judgment';
}

async function registerView(postId) {
  if (!auth.currentUser) return false;
  try {
    const result = await incrementPostView({ postId });
    return result.data?.counted === true;
  } catch {
    return false;
  }
}

export async function renderDetail(id) {
  const root = document.getElementById('page-content');
  if (!root) return;
  root.innerHTML = '<div class="loading-center"><div class="spinner spinner--lg"></div></div>';
  try {
    const snap = await getDoc(doc(db, 'feeds', id));
    if (!snap.exists()) {
      root.innerHTML = '<div class="empty-state"><div class="empty-state__icon">😢</div><div class="empty-state__title">글을 찾을 수 없어요</div></div>';
      return;
    }
    const post = { id: snap.id, ...snap.data() };
    const uid = auth.currentUser?.uid;
    const [comments, scrapped, counted] = await Promise.all([
      fetchComments(id),
      uid ? getDoc(doc(db, 'users', uid, 'scraps', id)).then(item => item.exists()).catch(() => false) : false,
      registerView(id),
    ]);
    if (counted) post.viewCount = Number(post.viewCount || 0) + 1;
    setMeta(post.title || '소소킹', post.desc || '', post.images?.[0], `https://sosoking.co.kr/p/${id}`);
    renderDetailPage(root, post, comments, scrapped);
  } catch (error) {
    console.error('[detail]', error);
    root.innerHTML = '<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">글을 불러오지 못했어요</div></div>';
  }
}

function renderDetailPage(root, post, comments, scrapped) {
  const meta = TYPE_META[subtype(post)];
  const time = formatTime(post.createdAt?.toDate?.() || post.createdAt);
  root.innerHTML = `
    <div data-detail-root data-post-id="${escHtml(post.id)}" style="max-width:720px;margin:0 auto">
      <article class="card">
        <header class="detail-header">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span class="feed-card__type-badge feed-card__type-badge--${meta.css}">${meta.label}</span>
            ${(post.tags || []).map(tag => `<span class="tag">#${escHtml(tag)}</span>`).join('')}
          </div>
          <h1 class="detail-title">${escHtml(post.title || '')}</h1>
          <div class="detail-meta">
            <span>${escHtml(post.authorName || '익명')}</span><span>${time}</span><span>조회 ${Number(post.viewCount || 0)}</span>
            <div style="margin-left:auto;display:flex;gap:6px">
              <button id="btn-scrap" class="detail-action-btn ${scrapped ? 'active' : ''}" title="스크랩">🔖</button>
              <button id="btn-share" class="detail-action-btn" title="공유">🔗</button>
              <button id="btn-report" class="detail-action-btn" title="신고">🚨</button>
            </div>
          </div>
        </header>
        ${(post.images || []).length ? renderImageSection(post.images) : ''}
        <div class="detail-body">${post.desc ? `<p>${escHtml(post.desc).replace(/\n/g, '<br>')}</p>` : ''}</div>
        <div style="padding:0 20px 16px">${renderReactionBar(post)}</div>
        <div class="divider" style="margin:0"></div>
        ${renderCommentSection(post, comments)}
      </article>
    </div>`;
  initReactionBar(post.id);
  appendSimilarPosts(post);
}
