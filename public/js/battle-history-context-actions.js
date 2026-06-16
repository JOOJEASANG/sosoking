import { db } from './firebase.js';
import {
  collection, query, orderBy, limit, getDocs,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const SLOT_ID = 'battle-history-context-slot';
let loading = false;
let cachedHistoryPost = null;

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function plainText(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function shouldShowOnBattle() {
  return location.hash.startsWith('#/battle') || location.hash === '#/';
}

function findBattleRoot() {
  return document.querySelector('.battle-page');
}

async function loadLatestHistoryIssue() {
  if (cachedHistoryPost) return cachedHistoryPost;
  const snap = await getDocs(query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(100)));
  cachedHistoryPost = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .find(p => p.isHistoryIssue && !p.hidden) || null;
  return cachedHistoryPost;
}

function renderHistoryBattleBox(post) {
  if (!post) {
    return `<div id="${SLOT_ID}" class="battle-history-context" style="margin:0 0 12px;padding:14px;border-radius:16px;border:1px solid rgba(124,58,237,.16);background:linear-gradient(135deg,rgba(124,58,237,.07),rgba(37,99,235,.04))">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px">
        <span class="feed-card__type-badge feed-card__type-badge--multi">📜 역사 쟁점</span>
        <span class="tag">대기 중</span>
      </div>
      <div style="font-size:13px;color:var(--color-text-muted);line-height:1.55">역사 이슈가 생성되면 오늘의 정당 대항전과 함께 볼 수 있습니다.</div>
    </div>`;
  }

  const day = post.historyDay ? `Day ${String(post.historyDay).padStart(3, '0')}` : '오늘의 역사';
  const era = post.historyEra || '새공화국 기록';
  const year = post.motifYear ? `${post.motifYear}년 모티브` : '역사 모티브';
  const title = post.title || '새공화국 역사 이슈';
  const question = post.eventQuestion || plainText(post.desc || '').slice(0, 120);
  const stances = post.partyStances || {};

  return `<div id="${SLOT_ID}" class="battle-history-context" style="margin:0 0 12px;padding:14px;border-radius:16px;border:1px solid rgba(124,58,237,.20);background:linear-gradient(135deg,rgba(124,58,237,.10),rgba(37,99,235,.05))">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
      <span class="feed-card__type-badge feed-card__type-badge--multi">📜 ${esc(day)}</span>
      <span class="tag">${esc(era)}</span>
      <span class="tag">${esc(year)}</span>
    </div>
    <div style="display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap">
      <div style="min-width:240px;flex:1">
        <div style="font-size:15px;font-weight:950;margin-bottom:4px">오늘의 역사 쟁점 · ${esc(title)}</div>
        ${question ? `<div style="font-size:13px;color:var(--color-text-muted);line-height:1.55">${esc(question)}</div>` : ''}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a class="btn btn--ghost btn--sm" href="#/detail/${esc(post.id)}">역사 이슈 열기</a>
        <a class="btn btn--ghost btn--sm" href="#/feed?q=역사">역사 검색</a>
      </div>
    </div>
    <details style="margin-top:10px">
      <summary style="cursor:pointer;font-size:12px;font-weight:800;color:var(--color-text-muted)">3당 기본 입장 보기</summary>
      <div style="display:grid;gap:6px;margin-top:8px;font-size:12px;line-height:1.5">
        ${stances.national ? `<div>🛡️ <b>국민질서당</b> · ${esc(stances.national)}</div>` : ''}
        ${stances.youth ? `<div>🕯️ <b>시민개혁당</b> · ${esc(stances.youth)}</div>` : ''}
        ${stances.center ? `<div>⚖️ <b>국민통합당</b> · ${esc(stances.center)}</div>` : ''}
      </div>
    </details>
  </div>`;
}

async function injectHistoryContext() {
  if (!shouldShowOnBattle()) return;
  const root = findBattleRoot();
  if (!root || root.querySelector(`#${SLOT_ID}`) || loading) return;

  const topicCard = root.querySelector('.battle-topic-card');
  const gameBar = root.querySelector('.battle-game-bar');
  const anchor = gameBar || topicCard;
  if (!anchor) return;

  const temp = document.createElement('div');
  temp.innerHTML = renderHistoryBattleBox(null);
  const slot = temp.firstElementChild;
  if (gameBar) gameBar.insertAdjacentElement('afterend', slot);
  else root.insertBefore(slot, topicCard);

  loading = true;
  try {
    const post = await loadLatestHistoryIssue();
    if (!slot.isConnected) return;
    slot.outerHTML = renderHistoryBattleBox(post);
  } catch (error) {
    console.warn('[battle-history-context] failed', error);
  } finally {
    loading = false;
  }
}

let observer = null;
function startBattleHistoryObserver() {
  if (observer) return;
  observer = new MutationObserver(() => injectHistoryContext());
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => {
    setTimeout(injectHistoryContext, 120);
  });
  setTimeout(injectHistoryContext, 300);
}

startBattleHistoryObserver();
