import { db, auth, functions } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { renderReactionBar, initReactionBar } from '../components/reaction-bar.js';
import { setMeta } from '../utils/seo.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import { TYPE_LABELS, CAT_CLASS } from '../detail/constants.js';
import { fetchComments, fetchAdjacentPosts } from '../detail/data.js';
import { renderImageSection, renderTypeBody } from '../detail/body-render.js';
import { renderCommentSection } from '../detail/comment-render.js';
import { appendSimilarPosts } from '../detail/similar-render.js';

const callRegisterPostView = httpsCallable(functions, 'registerPostView');

async function registerDetailView(id) {
  if (!auth.currentUser) return { counted: false, reason: 'guest' };
  try {
    const result = await callRegisterPostView({ postId: id });
    return result.data || { counted: false };
  } catch (error) {
    console.warn('[detail] view registration failed', error);
    return { counted: false, error: true };
  }
}

function displayDetailTitle(post) {
  return post.title || post.situation || '';
}

function isPoliticalDetail(post) {
  return ['citizen_speech', 'ai_judge'].includes(post.feedType || post.type || post.subtype);
}

export async function renderDetail(id) {
  const el = document.getElementById('page-content');
  el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;

  try {
    const snap = await getDoc(doc(db, 'feeds', id));
    if (!snap.exists()) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">😢</div><div class="empty-state__title">글을 찾을 수 없어요</div></div>`;
      return;
    }

    const post = { id: snap.id, ...snap.data() };
    if (!isPoliticalDetail(post)) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🏛️</div><div class="empty-state__title">정치게임 콘텐츠가 아니에요</div><div class="empty-state__desc">현재 소소킹은 정치게임 콘텐츠만 표시합니다.</div></div>`;
      return;
    }

    setMeta(displayDetailTitle(post), post.desc || post.situation, post.images?.[0], `https://sosoking.co.kr/p/${id}`);

    const uid = auth.currentUser?.uid;
    const [comments, isScrapped, viewResult] = await Promise.all([
      fetchComments(id),
      uid ? getDoc(doc(db, 'users', uid, 'scraps', id)).then(s => s.exists()) : Promise.resolve(false),
      registerDetailView(id),
    ]);

    if (viewResult?.counted === true) post.viewCount = Number(post.viewCount || 0) + 1;
    renderDetailPage(el, post, comments, isScrapped);
  } catch (error) {
    console.error(error);
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">불러오기에 실패했어요</div></div>`;
  }
}

function resolvePostTypeLabel(post) {
  if (post.feedType && TYPE_LABELS[post.feedType]) return TYPE_LABELS[post.feedType];
  return TYPE_LABELS[post.type] || '시민발언';
}

function resolvePostCatClass(post) {
  if (post.feedType === 'ai_judge' || post.type === 'ai_judge') return 'golra';
  return CAT_CLASS[post.cat] || CAT_CLASS[post.type] || 'multi';
}

function renderDetailPage(el, post, comments, isScrapped = false) {
  const typeLabel = resolvePostTypeLabel(post);
  const catClass = resolvePostCatClass(post);
  const timeStr = formatTime(post.createdAt?.toDate?.() || post.createdAt);
  const detailTitle = displayDetailTitle(post);

  el.innerHTML = `
    <div data-detail-root data-post-id="${escHtml(post.id)}" style="max-width:720px;margin:0 auto">
      <div class="card">
        <div class="detail-header">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span class="feed-card__type-badge feed-card__type-badge--${catClass}">${typeLabel}</span>
            ${post.tags?.map(t => `<span class="tag">#${escHtml(t)}</span>`).join('') || ''}
          </div>
          <h1 class="detail-title">${escHtml(detailTitle || '')}</h1>
          <div class="detail-meta">
            <span>${escHtml(post.authorName || '익명')}</span>
            <span>${timeStr}</span>
            <span>조회 ${post.viewCount || 0}</span>
            <div style="margin-left:auto;display:flex;gap:6px">
              <button id="btn-scrap" class="detail-action-btn ${isScrapped ? 'active' : ''}" title="스크랩">🔖</button>
              <button id="btn-share" class="detail-action-btn" title="공유">🔗</button>
              <button id="btn-report" class="detail-action-btn" title="신고">🚨</button>
            </div>
          </div>
        </div>

        ${post.images?.length ? renderImageSection(post.images) : ''}

        <div class="detail-body">
          ${post.desc ? `<p>${escHtml(post.desc).replace(/\n/g, '<br>')}</p>` : ''}
          ${renderTypeBody(post)}
        </div>

        <div style="padding:0 20px 16px">
          ${renderReactionBar(post)}
        </div>

        <div class="divider" style="margin:0"></div>

        ${renderCommentSection(post, comments)}
      </div>
    </div>`;

  initReactionBar(post.id);
  appendSimilarPosts(post);
  appendDetailNav(post, el.querySelector('[data-detail-root]'));
}

async function appendDetailNav(post, root) {
  if (!root || !post.createdAt) return;
  try {
    const { prev, next } = await fetchAdjacentPosts(post.id, post.createdAt);
    if (!prev && !next) return;
    if (!root.isConnected) return;

    root.querySelectorAll('.detail-nav').forEach(n => n.remove());

    const nav = document.createElement('div');
    nav.className = 'detail-nav';
    nav.innerHTML = `
      <div class="detail-nav__inner">
        ${prev ? `
          <a class="detail-nav__item detail-nav__item--prev" href="#/detail/${escHtml(prev.id)}">
            <span class="detail-nav__label">← 이전글</span>
            <span class="detail-nav__title">${escHtml(String(prev.title || '').slice(0, 50))}</span>
          </a>` : '<span class="detail-nav__spacer"></span>'}
        ${next ? `
          <a class="detail-nav__item detail-nav__item--next" href="#/detail/${escHtml(next.id)}">
            <span class="detail-nav__label">다음글 →</span>
            <span class="detail-nav__title">${escHtml(String(next.title || '').slice(0, 50))}</span>
          </a>` : '<span class="detail-nav__spacer"></span>'}
      </div>`;

    const similar = root.querySelector('.similar-posts');
    if (similar) root.insertBefore(nav, similar);
    else root.appendChild(nav);
  } catch {
    // Navigation is optional
  }
}
