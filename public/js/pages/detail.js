import { db, auth, functions } from '../firebase.js';
import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { renderReactionBar, initReactionBar } from '../components/reaction-bar.js';
import { setMeta } from '../utils/seo.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import { navigate } from '../router.js';
import { fetchComments } from '../detail/data.js';
import { renderImageSection } from '../detail/body-render.js';
import { renderComment, renderCommentSection, refreshCommentListUI } from '../detail/comment-render.js';
import { appendSimilarPosts } from '../detail/similar-render.js';

const incrementPostView = httpsCallable(functions, 'incrementPostView');
let unsubscribeComments = null;

const TYPE_META = {
  judgment: { label: '판결', css: 'judgment' },
  consult: { label: '상담', css: 'consult' },
  vote: { label: '토론', css: 'vote' },
  drip: { label: '드립', css: 'drip' },
};

const DETAIL_CATEGORIES = [
  { key: '', icon: '✨', label: '전체' },
  { key: 'judgment', icon: '⚖️', label: '판결' },
  { key: 'consult', icon: '💬', label: '상담' },
  { key: 'vote', icon: '🗳️', label: '토론' },
  { key: 'drip', icon: '😂', label: '드립' },
];

function subtype(post) {
  if (TYPE_META[post.subtype]) return post.subtype;
  if (post.modules?.consult?.enabled) return 'consult';
  if (post.modules?.drip?.enabled) return 'drip';
  if (post.modules?.vote?.voteMode === 'pros_cons') return 'vote';
  return 'judgment';
}

function renderDetailCategories(activeType) {
  return `
    <nav class="soso-room-tabs detail-community-tabs" aria-label="커뮤니티 카테고리">
      ${DETAIL_CATEGORIES.map(item => `
        <button type="button" class="soso-room-tab ${item.key === activeType ? 'active' : ''}" data-detail-category="${item.key}">
          <span aria-hidden="true">${item.icon}</span>${item.label}
        </button>`).join('')}
    </nav>`;
}

function aiComments(comments) {
  return (comments || []).filter(comment => comment.isAiCharacter === true || comment.aiGenerated === true);
}

function renderDripAiSection(comments) {
  const items = aiComments(comments);
  return `
    <div class="comment-section" id="drip-ai-comment-section">
      <div class="comment-section__title">🎭 AI 캐릭터 반응 ${items.length}</div>
      <div id="comment-list">
        ${items.length
          ? items.map(renderComment).join('')
          : '<div style="text-align:center;padding:24px;font-size:13px;color:var(--color-text-muted)">AI 캐릭터가 글과 사진을 읽고 있어요. 댓글이 생성되면 자동으로 표시됩니다.</div>'}
      </div>
    </div>`;
}

function updateDripAiSection(comments) {
  const section = document.getElementById('drip-ai-comment-section');
  if (!section) return;
  const items = aiComments(comments);
  const title = section.querySelector('.comment-section__title');
  const list = section.querySelector('#comment-list');
  if (title) title.textContent = `🎭 AI 캐릭터 반응 ${items.length}`;
  if (list) {
    list.innerHTML = items.length
      ? items.map(renderComment).join('')
      : '<div style="text-align:center;padding:24px;font-size:13px;color:var(--color-text-muted)">AI 캐릭터가 글과 사진을 읽고 있어요. 댓글이 생성되면 자동으로 표시됩니다.</div>';
  }
}

function stopCommentWatch() {
  unsubscribeComments?.();
  unsubscribeComments = null;
}

function currentDetailId() {
  const match = (location.hash || '').match(/^#\/detail\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function watchComments(post) {
  stopCommentWatch();
  const commentsQuery = query(collection(db, 'feeds', post.id, 'comments'), orderBy('createdAt', 'asc'));
  unsubscribeComments = onSnapshot(commentsQuery, snapshot => {
    if (currentDetailId() !== post.id) {
      stopCommentWatch();
      return;
    }
    const comments = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    if (subtype(post) === 'drip') updateDripAiSection(comments);
    else {
      refreshCommentListUI(post, comments);
      const title = document.querySelector('[data-detail-root] .comment-section__title');
      if (title && /^댓글\s+\d+/.test(title.textContent || '')) title.textContent = `댓글 ${comments.length}`;
    }
  }, error => console.warn('[detail comments watch]', error));
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
  stopCommentWatch();
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
    if (currentDetailId() !== id) return;
    if (counted) post.viewCount = Number(post.viewCount || 0) + 1;
    setMeta(post.title || '소소킹', post.desc || '', post.images?.[0], `https://sosoking.co.kr/p/${id}`);
    renderDetailPage(root, post, comments, scrapped);
    watchComments(post);
  } catch (error) {
    console.error('[detail]', error);
    root.innerHTML = '<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">글을 불러오지 못했어요</div></div>';
  }
}

function renderDetailPage(root, post, comments, scrapped) {
  const activeType = subtype(post);
  const meta = TYPE_META[activeType];
  const time = formatTime(post.createdAt?.toDate?.() || post.createdAt);
  const commentsHtml = activeType === 'drip' ? renderDripAiSection(comments) : renderCommentSection(post, comments);
  root.innerHTML = `
    <div data-detail-root data-post-id="${escHtml(post.id)}" data-detail-subtype="${activeType}" style="max-width:720px;margin:0 auto">
      ${renderDetailCategories(activeType)}
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
        ${commentsHtml}
      </article>
    </div>`;

  root.querySelectorAll('[data-detail-category]').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.detailCategory || '';
      navigate(key ? `/feed?type=${encodeURIComponent(key)}` : '/feed');
    });
  });

  initReactionBar(post.id);
  appendSimilarPosts(post);
}

window.addEventListener('hashchange', () => {
  if (!currentDetailId()) stopCommentWatch();
});
window.addEventListener('pagehide', stopCommentWatch, { once: true });
