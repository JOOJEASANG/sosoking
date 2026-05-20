import { db, auth } from '../firebase.js';
import { doc, getDoc, updateDoc, increment } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { renderReactionBar, initReactionBar } from '../components/reaction-bar.js';
import { setMeta } from '../utils/seo.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import { TYPE_LABELS, CAT_CLASS, ACROSTIC_REACTIONS } from '../detail/constants.js';
import { fetchComments, fetchAcrostics, fetchSimilarPosts } from '../detail/data.js';
import { renderImageSection, renderTypeBody, renderLegacyInteractive } from '../detail/body-render.js';
import { renderCommentSection } from '../detail/comment-render.js';

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
    await updateDoc(doc(db, 'feeds', id), { viewCount: increment(1) }).catch(() => {});

    const uid = auth.currentUser?.uid;
    const [comments, acrostics, isScrapped] = await Promise.all([
      fetchComments(id),
      post.type === 'acrostic' ? fetchAcrostics(id) : Promise.resolve([]),
      uid ? getDoc(doc(db, 'users', uid, 'scraps', id)).then(s => s.exists()) : Promise.resolve(false),
    ]);

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
    <div style="max-width:720px;margin:0 auto">
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

function setupRelayCounter() {
  document.getElementById('comment-input')?.addEventListener('input', function () {
    const counter = document.getElementById('relay-char-count');
    if (counter) counter.textContent = `${this.value.length} / 150`;
  });
}

function setupCharBoxInput() {
  const freeInput = document.getElementById('free-naming-input');
  if (freeInput) {
    freeInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') document.getElementById('btn-char-submit')?.click();
    });
    return;
  }

  const boxes = [...document.querySelectorAll('.char-box')];
  boxes.forEach((box, index) => {
    let composing = false;
    box.addEventListener('compositionstart', () => { composing = true; });
    box.addEventListener('compositionend', () => {
      composing = false;
      trimCharBox(box);
      if (box.value && index < boxes.length - 1) boxes[index + 1].focus();
    });
    box.addEventListener('input', () => {
      if (composing) return;
      trimCharBox(box);
      if (box.value && index < boxes.length - 1) boxes[index + 1].focus();
    });
    box.addEventListener('keydown', event => {
      if (event.key === 'Backspace' && !box.value && index > 0) {
        event.preventDefault();
        boxes[index - 1].value = '';
        boxes[index - 1].focus();
      }
      if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault();
        boxes[index - 1].focus();
      }
      if (event.key === 'ArrowRight' && index < boxes.length - 1) {
        event.preventDefault();
        boxes[index + 1].focus();
      }
      if (event.key === 'Enter') document.getElementById('btn-char-submit')?.click();
    });
    box.addEventListener('paste', event => {
      event.preventDefault();
      const text = (event.clipboardData || window.clipboardData).getData('text');
      [...text].slice(0, boxes.length - index).forEach((char, offset) => {
        if (boxes[index + offset]) boxes[index + offset].value = char;
      });
      boxes[Math.min(index + [...text].length, boxes.length - 1)]?.focus();
    });
  });
}

function trimCharBox(box) {
  if ([...box.value].length > 1) box.value = [...box.value].slice(-1).join('');
}

function renderAcrosticSection(acrostics, postId) {
  return `
    <div class="acrostic-section">
      <div class="acrostic-section__title">✍️ 삼행시 ${acrostics.length}개</div>
      <div id="acrostic-list">
        ${acrostics.length
          ? acrostics.map(entry => renderAcrosticCard(entry, postId)).join('')
          : '<div class="acrostic-empty">첫 삼행시를 올려보세요!</div>'}
      </div>
    </div>`;
}

function renderAcrosticCard(entry, postId) {
  const timeStr = formatTime(entry.createdAt?.toDate?.() || entry.createdAt);
  const lines = entry.lines || [];
  const uid = auth.currentUser?.uid;
  const myReaction = uid ? (entry.reactedWith?.[uid] ?? null) : null;
  const linesHtml = lines.length
    ? lines.map(line => `
        <div class="acrostic-card__line">
          <span class="acrostic-card__char">${escHtml(line.char)}</span>
          <span class="acrostic-card__text">${escHtml(line.line)}</span>
        </div>`).join('')
    : `<div style="font-size:13px;color:var(--color-text-secondary)">${escHtml(entry.text || '').replace(/\n/g, '<br>')}</div>`;

  return `
    <div class="acrostic-card" data-acrostic-id="${entry.id}">
      <div class="acrostic-card__header">
        <div class="avatar avatar--sm">${escHtml((entry.authorName || '?')[0])}</div>
        <div>
          <div class="acrostic-card__name">${escHtml(entry.authorName || '익명')}</div>
          <div class="acrostic-card__time">${timeStr}</div>
        </div>
      </div>
      <div class="acrostic-card__lines">${linesHtml}</div>
      <div class="acrostic-card__footer">
        ${ACROSTIC_REACTIONS.map(reaction => {
          const count = entry.reactions?.[reaction.key] || 0;
          const active = myReaction === reaction.key ? 'active' : '';
          return `<button class="reaction-btn reaction-btn--sm ${active}" data-acrostic-id="${entry.id}" data-post-id="${postId}" data-acrostic-reaction="${reaction.key}">
            ${reaction.emoji}${count > 0 ? ` <strong>${count}</strong>` : ''}
          </button>`;
        }).join('')}
      </div>
    </div>`;
}

function appendSimilarPosts(post) {
  fetchSimilarPosts(post.id, post.type).then(similar => {
    if (!similar.length) return;
    const area = document.createElement('div');
    area.className = 'similar-posts';
    area.innerHTML = `
      <div class="similar-posts__title">🎮 비슷한 놀이판</div>
      <div class="similar-posts__list">
        ${similar.map(item => `
          <div class="similar-post-card" onclick="navigate('/detail/${item.id}')">
            <span class="similar-post-card__type">${TYPE_LABELS[item.type] || item.type}</span>
            <div class="similar-post-card__title">${escHtml(item.title || '')}</div>
            <div class="similar-post-card__meta">❤️${item.reactions?.total || 0} 💬${item.commentCount || 0}</div>
          </div>`).join('')}
      </div>`;
    document.querySelector('[style*="max-width:720px"]')?.appendChild(area);
  }).catch(() => {});
}
