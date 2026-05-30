import { db, auth, functions } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { renderReactionBar, initReactionBar } from '../components/reaction-bar.js';
import { setMeta } from '../utils/seo.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import { TYPE_LABELS, CAT_CLASS } from '../detail/constants.js';
import { fetchComments } from '../detail/data.js';
import { renderImageSection, renderTypeBody, renderLegacyInteractive } from '../detail/body-render.js';
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

function shouldHideMainDesc(post) {
  if (post.type === 'cbattle') return true;
  return post.type === 'multi' && (
    post.modules?.quiz?.enabled === true ||
    post.modules?.drip?.enabled === true ||
    post.modules?.vote?.enabled === true
  );
}

function displayDetailTitle(post) {
  if (post.type === 'multi' && post.modules?.drip?.enabled) {
    const title = String(post.title || '').trim();
    const topic = String(post.modules.drip.prompt || post.desc || '').trim();
    return ['오늘의 드립 주제', '오늘의 한줄', '드립방 AI 글'].includes(title) ? (topic || title) : title || topic;
  }
  if (post.type === 'multi' && post.modules?.vote?.enabled) {
    const title = String(post.title || '').trim();
    const topic = String(post.modules.vote.question || post.desc || '').trim();
    return title || topic || '토론 주제';
  }
  return post.title || '';
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
    setMeta(displayDetailTitle(post), post.desc, post.images?.[0], `https://sosoking.co.kr/p/${id}`);

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

function renderDetailPage(el, post, comments, isScrapped = false) {
  const typeLabel = TYPE_LABELS[post.type] || post.type;
  const catClass = CAT_CLASS[post.cat] || 'malhe';
  const timeStr = formatTime(post.createdAt?.toDate?.() || post.createdAt);
  const detailTitle = displayDetailTitle(post);
  const hideMainDesc = shouldHideMainDesc(post);

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

        <div class="detail-body ${hideMainDesc ? 'detail-body--module-only' : ''}">
          ${post.desc && !hideMainDesc ? `<p>${escHtml(post.desc).replace(/\n/g, '<br>')}</p>` : ''}
          ${renderTypeBody(post)}
        </div>

        <div style="padding:0 20px 16px">
          ${renderReactionBar(post)}
        </div>

        <div class="divider" style="margin:0"></div>

        ${renderLegacyInteractive()}
        ${renderCommentSection(post, comments)}
      </div>
    </div>`;

  initReactionBar(post.id);
  appendSimilarPosts(post);
}
