import { db, auth, functions } from '../firebase.js';
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { escHtml, formatTime } from '../utils/helpers.js';

const TYPE_LABELS = {
  multi: '만능 놀이글', vote: '골라봐', balance: '골라봐', battle: '대결',
  naming: '미친작명소', initial_game: '초성게임', acrostic: '삼행시', drip: '한줄드립',
  quiz: '미친퀴즈', crazy_court: '억까재판', relay: '막장릴레이', random_battle: '랜덤대결',
  story: '경험담', howto: '노하우', fail: '실패담', concern: '고민/질문'
};

const CAT_CLASS = { golra: 'golra', usgyo: 'usgyo', malhe: 'malhe', multi: 'multi' };
const registerPostView = httpsCallable(functions, 'registerPostView');

function escAttr(value) {
  return escHtml(value).replace(/`/g, '&#96;');
}

function safeImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || /[\s"'<>]/.test(raw)) return '';
  try {
    const url = new URL(raw, window.location.origin);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    if (url.protocol === 'http:' && url.hostname !== window.location.hostname && url.hostname !== 'localhost') return '';
    return url.toString();
  } catch {
    return '';
  }
}

function renderImages(images) {
  const list = (Array.isArray(images) ? images : []).map(safeImageUrl).filter(Boolean).slice(0, 12);
  if (!list.length) return '';
  return `<div class="detail-gallery detail-gallery--${Math.min(list.length, 4)}" style="margin-bottom:16px">${list.map(src => `<div class="detail-gallery__thumb"><img src="${escAttr(src)}" alt="" loading="lazy" referrerpolicy="no-referrer"></div>`).join('')}</div>`;
}

function renderOptions(post) {
  const options = Array.isArray(post.options) ? post.options : [];
  if (!options.length) return '';
  const total = options.reduce((sum, opt) => sum + (typeof opt === 'object' ? Number(opt.votes || 0) : 0), 0);
  return `<div class="quiz-options" style="margin-top:16px">${options.map((opt, i) => {
    const text = typeof opt === 'object' ? opt.text : opt;
    const votes = typeof opt === 'object' ? Number(opt.votes || 0) : 0;
    const pct = total ? Math.round(votes / total * 100) : 0;
    return `<div class="vote-option"><div class="vote-option__bar vote-option__bar--selected" style="width:${pct}%"></div><div class="vote-option__content"><span>${i + 1}. ${escHtml(text || '')}</span><span class="vote-option__pct">${pct}%</span></div></div>`;
  }).join('')}</div>`;
}

function renderModules(post) {
  if (post.type !== 'multi' || !post.modules) return '';
  const labels = [];
  if (post.modules.vote?.enabled) labels.push('투표');
  if (post.modules.naming?.enabled) labels.push('작명');
  if (post.modules.acrostic?.enabled) labels.push('삼행시');
  if (post.modules.relay?.enabled) labels.push('릴레이');
  if (post.modules.quiz?.enabled) labels.push('문제');
  if (!labels.length) return '';
  return `<div class="feed-card__multi-chips" style="margin-top:12px">${labels.map(label => `<span>${escHtml(label)}</span>`).join('')}</div>`;
}

async function tryRegisterView(id, post) {
  if (!auth.currentUser) return;
  try {
    const res = await registerPostView({ postId: id });
    if (res.data?.counted === true) post.viewCount = Number(post.viewCount || 0) + 1;
  } catch (error) {
    console.warn('[detail-safe] view registration failed', error);
  }
}

async function fetchComments(id) {
  try {
    const snap = await getDocs(query(collection(db, 'feeds', id, 'comments'), orderBy('createdAt', 'desc'), limit(30)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

function renderComments(comments) {
  return `<div style="padding:20px"><div style="font-size:15px;font-weight:900;margin-bottom:12px">댓글 ${comments.length}</div>${comments.length ? comments.map(c => `<div class="comment-item"><div class="avatar avatar--sm">${escHtml((c.authorName || '?')[0])}</div><div class="comment-item__body"><div class="comment-item__author">${escHtml(c.authorName || '익명')}</div><div class="comment-item__text">${escHtml(c.text || '').replace(/\n/g, '<br>')}</div><div class="comment-item__meta"><span>${formatTime(c.createdAt?.toDate?.() || c.createdAt)}</span></div></div></div>`).join('') : '<div class="empty-state__desc">아직 댓글이 없어요</div>'}</div>`;
}

export async function renderDetail(id) {
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;

  try {
    const snap = await getDoc(doc(db, 'feeds', id));
    if (!snap.exists()) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">😢</div><div class="empty-state__title">글을 찾을 수 없어요</div></div>`;
      return;
    }

    const post = { id: snap.id, ...snap.data() };
    await tryRegisterView(id, post);
    const comments = await fetchComments(id);
    const typeLabel = TYPE_LABELS[post.type] || post.type || '글';
    const catClass = CAT_CLASS[post.cat] || 'malhe';
    const timeStr = formatTime(post.createdAt?.toDate?.() || post.createdAt);

    document.title = post.title ? `${post.title} - 소소킹` : '소소킹';

    el.innerHTML = `
      <div style="max-width:720px;margin:0 auto">
        <button class="btn btn--ghost btn--sm" onclick="history.back()" style="margin-bottom:16px">← 뒤로</button>
        <div class="card">
          <div class="detail-header">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
              <span class="feed-card__type-badge feed-card__type-badge--${catClass}">${escHtml(typeLabel)}</span>
              ${(post.tags || []).slice(0, 5).map(t => `<span class="tag">#${escHtml(t)}</span>`).join('')}
            </div>
            <h1 class="detail-title">${escHtml(post.title || '')}</h1>
            <div class="detail-meta">
              <span>${escHtml(post.authorName || '익명')}</span>
              <span>${timeStr}</span>
              <span>조회 ${Number(post.viewCount || 0).toLocaleString()}</span>
              <div style="margin-left:auto;display:flex;gap:6px">
                <button id="btn-scrap" class="detail-action-btn" title="스크랩">🔖</button>
                <button id="btn-share" class="detail-action-btn" title="공유">🔗</button>
                <button id="btn-report" class="detail-action-btn" title="신고">🚨</button>
              </div>
            </div>
          </div>
          ${renderImages(post.images)}
          <div class="detail-body">
            ${post.desc ? `<p>${escHtml(post.desc).replace(/\n/g, '<br>')}</p>` : ''}
            ${renderOptions(post)}
            ${renderModules(post)}
          </div>
          <div class="divider" style="margin:0"></div>
          ${renderComments(comments)}
        </div>
      </div>`;
  } catch (error) {
    console.error('[detail-safe] failed', error);
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">상세 글을 불러오지 못했어요</div><div style="font-size:12px;white-space:pre-wrap;text-align:left;max-width:720px;margin-top:10px">${escHtml(error.stack || error.message || error)}</div></div>`;
  }
}
