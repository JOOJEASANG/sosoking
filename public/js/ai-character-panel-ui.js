/* ai-character-panel-ui.js
   상세페이지 AI 캐릭터 사회자/토론/드립 패널 표시 및 누락 시 생성
*/
import { auth, db, functions } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { getDetailId } from './multi-detail/utils.js';

const callGenerateCharacterPanel = httpsCallable(functions, 'generateCharacterPanel');
const STYLE_ID = 'soso-ai-character-panel-style';
const generating = new Set();

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function teamLabel(ch, panel) {
  if (panel.kind !== 'vote') return '';
  if (ch.team === 'left') return ch.targetOption ? `왼쪽팀 · ${ch.targetOption}` : '왼쪽팀';
  if (ch.team === 'right') return ch.targetOption ? `오른쪽팀 · ${ch.targetOption}` : '오른쪽팀';
  return ch.targetOption || '';
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .ai-character-panel {
      margin: 18px 0;
      border-radius: 26px;
      border: 1px solid rgba(255,107,74,.18);
      background:
        radial-gradient(circle at 7% 0%, rgba(255,107,74,.12), rgba(255,107,74,0) 38%),
        linear-gradient(135deg, rgba(255,255,255,.98), rgba(248,250,252,.92));
      box-shadow: 0 16px 38px rgba(15,23,42,.065);
      overflow: hidden;
    }
    .ai-character-panel__head {
      padding: 18px 18px 14px;
      border-bottom: 1px solid rgba(148,163,184,.16);
    }
    .ai-character-panel__badge {
      display: inline-flex;
      align-items: center;
      height: 28px;
      padding: 0 11px;
      border-radius: 999px;
      background: rgba(255,107,74,.11);
      color: #ef4b2f;
      font-size: 11px;
      font-weight: 950;
      letter-spacing: -.01em;
    }
    .ai-character-panel__title {
      margin-top: 10px;
      font-size: clamp(19px, 4vw, 24px);
      font-weight: 950;
      line-height: 1.25;
      letter-spacing: -.055em;
      color: var(--color-text-primary);
    }
    .ai-host-card {
      margin: 14px 18px;
      padding: 16px;
      border-radius: 22px;
      background: rgba(17,24,39,.94);
      color: #fff;
      box-shadow: 0 14px 28px rgba(17,24,39,.17);
    }
    .ai-host-card__top,
    .ai-character-card__top {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .ai-host-card__avatar,
    .ai-character-card__avatar {
      width: 38px;
      height: 38px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 14px;
      background: rgba(255,255,255,.13);
      font-size: 22px;
      flex-shrink: 0;
    }
    .ai-host-card__name,
    .ai-character-card__name {
      font-size: 14px;
      font-weight: 950;
      letter-spacing: -.03em;
    }
    .ai-host-card__role,
    .ai-character-card__role {
      margin-top: 2px;
      font-size: 11px;
      font-weight: 800;
      opacity: .72;
    }
    .ai-host-card__text {
      margin-top: 12px;
      font-size: 14px;
      font-weight: 750;
      line-height: 1.6;
      letter-spacing: -.03em;
    }
    .ai-host-card__question {
      margin-top: 10px;
      padding: 11px 12px;
      border-radius: 16px;
      background: rgba(255,255,255,.10);
      font-size: 13px;
      font-weight: 900;
      line-height: 1.5;
    }
    .ai-character-panel__image-read {
      margin: 0 18px 12px;
      padding: 13px 14px;
      border-radius: 18px;
      background: rgba(255,107,74,.075);
      border: 1px solid rgba(255,107,74,.14);
      color: var(--color-text-muted);
      font-size: 13px;
      font-weight: 750;
      line-height: 1.55;
    }
    .ai-character-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      padding: 0 18px 16px;
    }
    .ai-character-card {
      padding: 14px;
      border-radius: 20px;
      background: var(--color-surface);
      border: 1px solid rgba(148,163,184,.16);
      box-shadow: 0 8px 20px rgba(15,23,42,.045);
    }
    .ai-character-card--left {
      border-color: rgba(59,130,246,.24);
      background: linear-gradient(180deg, rgba(59,130,246,.055), var(--color-surface));
    }
    .ai-character-card--right {
      border-color: rgba(255,107,74,.26);
      background: linear-gradient(180deg, rgba(255,107,74,.065), var(--color-surface));
    }
    .ai-character-card__avatar {
      background: rgba(255,107,74,.10);
    }
    .ai-character-card--left .ai-character-card__avatar {
      background: rgba(59,130,246,.12);
    }
    .ai-character-card__team {
      display: inline-flex;
      margin-top: 10px;
      min-height: 24px;
      align-items: center;
      padding: 0 9px;
      border-radius: 999px;
      background: rgba(15,23,42,.055);
      color: var(--color-text-muted);
      font-size: 11px;
      font-weight: 950;
      letter-spacing: -.02em;
    }
    .ai-character-card--left .ai-character-card__team {
      background: rgba(59,130,246,.12);
      color: #2563eb;
    }
    .ai-character-card--right .ai-character-card__team {
      background: rgba(255,107,74,.13);
      color: #ef4b2f;
    }
    .ai-character-card__reply {
      margin-top: 8px;
      color: var(--color-text-muted);
      font-size: 11px;
      font-weight: 850;
    }
    .ai-character-card__stance {
      margin: 11px 0 8px;
      color: #ef4b2f;
      font-size: 12px;
      font-weight: 950;
      letter-spacing: -.02em;
    }
    .ai-character-card--left .ai-character-card__stance {
      color: #2563eb;
    }
    .ai-character-card__line {
      margin: 6px 0 0;
      color: var(--color-text-primary);
      font-size: 13px;
      font-weight: 760;
      line-height: 1.55;
      letter-spacing: -.025em;
    }
    .ai-character-card__punch {
      margin-top: 10px;
      padding: 10px 11px;
      border-radius: 14px;
      background: rgba(255,107,74,.09);
      color: var(--color-text-primary);
      font-size: 13px;
      font-weight: 950;
      line-height: 1.45;
      letter-spacing: -.03em;
    }
    .ai-character-card--left .ai-character-card__punch {
      background: rgba(59,130,246,.09);
    }
    .ai-character-panel__best {
      margin: 0 18px 16px;
      padding: 14px;
      border-radius: 20px;
      background: rgba(15,23,42,.035);
      border: 1px solid rgba(148,163,184,.14);
    }
    .ai-character-panel__best-title {
      font-size: 12px;
      font-weight: 950;
      color: var(--color-text-muted);
      margin-bottom: 8px;
    }
    .ai-character-panel__best-list {
      display: flex;
      gap: 7px;
      flex-wrap: wrap;
    }
    .ai-character-panel__best-list span {
      display: inline-flex;
      padding: 7px 10px;
      border-radius: 999px;
      background: #fff;
      border: 1px solid rgba(148,163,184,.18);
      color: var(--color-text-primary);
      font-size: 12px;
      font-weight: 850;
    }
    .ai-character-panel__footer {
      padding: 14px 18px 18px;
      border-top: 1px solid rgba(148,163,184,.14);
      color: var(--color-text-muted);
      font-size: 13px;
      font-weight: 850;
      line-height: 1.5;
    }
    .ai-character-panel--loading {
      padding: 18px;
      color: var(--color-text-muted);
      font-size: 13px;
      font-weight: 850;
    }
    [data-theme="dark"] .ai-character-panel,
    html.dark .ai-character-panel,
    html[data-theme="dark"] .ai-character-panel {
      background: linear-gradient(135deg, rgba(31,41,55,.96), rgba(17,24,39,.90));
      border-color: rgba(255,255,255,.08);
      box-shadow: 0 16px 38px rgba(0,0,0,.28);
    }
    [data-theme="dark"] .ai-character-panel__best-list span,
    html.dark .ai-character-panel__best-list span,
    html[data-theme="dark"] .ai-character-panel__best-list span {
      background: rgba(255,255,255,.06);
      border-color: rgba(255,255,255,.09);
    }
    @media (max-width: 1100px) {
      .ai-character-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 820px) {
      .ai-character-grid { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
}

function renderPanel(panel) {
  const host = panel.host || {};
  const characters = Array.isArray(panel.characters) ? panel.characters : [];
  const bestLines = Array.isArray(panel.bestLines) ? panel.bestLines : [];
  const badge = panel.kind === 'vote' ? 'AI 캐릭터 4대4 토론' : 'AI 캐릭터 드립 참여';
  return `
    <section class="ai-character-panel" data-ai-character-panel-root>
      <div class="ai-character-panel__head">
        <div class="ai-character-panel__badge">${badge}</div>
        <div class="ai-character-panel__title">${esc(panel.headline || 'AI 캐릭터가 먼저 열어본 판')}</div>
      </div>
      <div class="ai-host-card">
        <div class="ai-host-card__top">
          <div class="ai-host-card__avatar">${esc(host.emoji || '🤖')}</div>
          <div><div class="ai-host-card__name">${esc(host.name || '운영봇')}</div><div class="ai-host-card__role">${esc(host.role || '사회자')}</div></div>
        </div>
        <div class="ai-host-card__text">${esc(host.opening || '').replace(/\n/g, '<br>')}</div>
        ${host.summary ? `<div class="ai-host-card__text">${esc(host.summary).replace(/\n/g, '<br>')}</div>` : ''}
        ${host.question ? `<div class="ai-host-card__question">${esc(host.question)}</div>` : ''}
      </div>
      ${panel.imageRead ? `<div class="ai-character-panel__image-read">📷 이미지 포인트: ${esc(panel.imageRead)}</div>` : ''}
      ${characters.length ? `<div class="ai-character-grid">${characters.map(ch => {
        const team = teamLabel(ch, panel);
        const teamClass = panel.kind === 'vote' && (ch.team === 'left' || ch.team === 'right') ? ` ai-character-card--${ch.team}` : '';
        return `
        <article class="ai-character-card${teamClass}">
          <div class="ai-character-card__top">
            <div class="ai-character-card__avatar">${esc(ch.emoji || '💬')}</div>
            <div><div class="ai-character-card__name">${esc(ch.name || 'AI 캐릭터')}</div><div class="ai-character-card__role">${esc(ch.role || '')}</div></div>
          </div>
          ${team ? `<div class="ai-character-card__team">${esc(team)}</div>` : ''}
          ${ch.replyTo ? `<div class="ai-character-card__reply">↳ ${esc(ch.replyTo)} 말에 받아치기</div>` : ''}
          ${ch.stance ? `<div class="ai-character-card__stance">${esc(ch.stance)}</div>` : ''}
          ${(Array.isArray(ch.lines) ? ch.lines : []).map(line => `<p class="ai-character-card__line">${esc(line)}</p>`).join('')}
          ${ch.punchline ? `<div class="ai-character-card__punch">“${esc(ch.punchline)}”</div>` : ''}
        </article>`;
      }).join('')}</div>` : ''}
      ${bestLines.length ? `<div class="ai-character-panel__best"><div class="ai-character-panel__best-title">바로 써먹기 좋은 한 줄</div><div class="ai-character-panel__best-list">${bestLines.map(line => `<span>${esc(line)}</span>`).join('')}</div></div>` : ''}
      ${panel.commentPrompt ? `<div class="ai-character-panel__footer">${esc(panel.commentPrompt)}</div>` : ''}
    </section>`;
}

function renderLoading() {
  return `<section class="ai-character-panel ai-character-panel--loading" data-ai-character-panel-root>🤖 운영봇이 제목·내용·이미지를 읽고 캐릭터 판을 여는 중입니다...</section>`;
}

async function maybeGenerate(postId, post, mountAfter) {
  if (generating.has(postId)) return;
  if (!auth.currentUser || auth.currentUser.uid !== post.authorId) return;
  generating.add(postId);
  mountAfter.insertAdjacentHTML('afterend', renderLoading());
  try {
    await callGenerateCharacterPanel({ postId });
    const snap = await getDoc(doc(db, 'feeds', postId));
    const next = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    const root = document.querySelector('[data-ai-character-panel-root]');
    if (root && next?.aiCharacterPanel?.enabled) root.outerHTML = renderPanel(next.aiCharacterPanel);
    else root?.remove();
  } catch (error) {
    console.warn('[ai-character-panel-ui] generation failed', error);
    document.querySelector('[data-ai-character-panel-root]')?.remove();
  } finally {
    generating.delete(postId);
  }
}

async function enhance() {
  injectStyle();
  const postId = getDetailId();
  if (!postId) return;
  const root = document.getElementById('page-content');
  if (!root || root.querySelector('[data-ai-character-panel-root]')) return;
  const body = root.querySelector('.detail-body');
  if (!body) return;

  try {
    const snap = await getDoc(doc(db, 'feeds', postId));
    if (!snap.exists()) return;
    const post = { id: snap.id, ...snap.data() };
    if (post.aiCharacterPanel?.enabled) {
      body.insertAdjacentHTML('afterend', renderPanel(post.aiCharacterPanel));
      return;
    }
    if (post.type === 'multi' && !post.isAiGenerated) await maybeGenerate(postId, post, body);
  } catch (error) {
    console.warn('[ai-character-panel-ui] render failed', error);
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(enhance, 260);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
document.addEventListener('DOMContentLoaded', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });

schedule();
