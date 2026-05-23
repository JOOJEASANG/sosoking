import { db, auth, functions } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { renderReactionBar, initReactionBar } from '../components/reaction-bar.js';
import { setMeta } from '../utils/seo.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import { TYPE_LABELS, CAT_CLASS } from '../detail/constants.js';
import { fetchComments, fetchAcrostics } from '../detail/data.js';
import { renderImageSection, renderTypeBody, renderLegacyInteractive } from '../detail/body-render.js';
import { renderCommentSection } from '../detail/comment-render.js';
import { renderAcrosticSection } from '../detail/acrostic-render.js';
import { appendSimilarPosts } from '../detail/similar-render.js';
import { setupRelayCounter, setupCharBoxInput } from '../detail/input-ux.js';

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
    setMeta(post.title, post.desc, post.images?.[0]);

    const uid = auth.currentUser?.uid;
    const [comments, acrostics, isScrapped, viewResult] = await Promise.all([
      fetchComments(id),
      post.type === 'acrostic' ? fetchAcrostics(id) : Promise.resolve([]),
      uid ? getDoc(doc(db, 'users', uid, 'scraps', id)).then(s => s.exists()) : Promise.resolve(false),
      registerDetailView(id),
    ]);

    if (viewResult?.counted === true) post.viewCount = Number(post.viewCount || 0) + 1;
    renderDetailPage(el, post, comments, acrostics, isScrapped);
  } catch (error) {
    console.error(error);
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">불러오기에 실패했어요</div></div>`;
  }
}

function renderDetailPage(el, post, comments, acrostics, isScrapped = false) {
  const typeLabel = TYPE_LABELS[post.type] || post.type;
  const catClass = CAT_CLASS[post.cat] || 'malhe';
  const timeStr = formatTime(post.createdAt?.toDate?.() || post.createdAt);

  el.innerHTML = `
    <div data-detail-root data-post-id="${escHtml(post.id)}" style="max-width:720px;margin:0 auto">
      <button class="btn btn--ghost btn--sm" onclick="history.back()" style="margin-bottom:16px">← 뒤로</button>
      <div class="card">
        <div class="detail-header">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span class="feed-card__type-badge feed-card__type-badge--${catClass}">${typeLabel}</span>
            ${post.tags?.map(t => `<span class="tag">#${escHtml(t)}</span>`).join('') || ''}
          </div>
          <h1 class="detail-title">${escHtml(post.title || '')}</h1>
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

        ${renderLegacyInteractive(post)}
        ${post.type === 'acrostic' ? renderAcrosticSection(acrostics, post.id) : ''}
        ${renderCommentSection(post, comments)}
      </div>
    </div>`;

  setupDetailPage(post);
  appendSimilarPosts(post);
}

function setupDetailPage(post) {
  initReactionBar(post.id);
  setupRelayCounter();
  setupCharBoxInput();
}