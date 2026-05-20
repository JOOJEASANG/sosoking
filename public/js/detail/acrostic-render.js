import { auth } from '../firebase.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import { ACROSTIC_REACTIONS } from './constants.js';

export function renderAcrosticSection(acrostics, postId) {
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

export function renderAcrosticCard(entry, postId) {
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
