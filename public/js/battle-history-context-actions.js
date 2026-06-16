import { functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

const SLOT_ID = 'battle-history-context-slot';
let loading = false;
let cachedBattle = null;

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function shouldShowOnBattle() {
  return location.hash.startsWith('#/battle');
}

function findBattleRoot() {
  return document.querySelector('.battle-page');
}

async function loadBattleHistoryContext() {
  if (cachedBattle) return cachedBattle;
  const { data } = await httpsCallable(functions, 'getBattleStatus')();
  cachedBattle = data || null;
  return cachedBattle;
}

function renderHistoryBattleBox(battle) {
  if (!battle?.exists) {
    return `<div id="${SLOT_ID}" class="battle-history-context" style="margin:0 0 12px;padding:14px;border-radius:16px;border:1px solid rgba(124,58,237,.16);background:linear-gradient(135deg,rgba(124,58,237,.07),rgba(37,99,235,.04))">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px">
        <span class="feed-card__type-badge feed-card__type-badge--multi">📚 역사정치게임</span>
        <span class="tag">준비 중</span>
      </div>
      <div style="font-size:13px;color:var(--color-text-muted);line-height:1.55">오늘의 역사 사건이 생성되면 실제 모티브와 가상 정당 선택을 함께 볼 수 있습니다.</div>
    </div>`;
  }

  const day = battle.historyDay ? `DAY ${String(battle.historyDay).padStart(2, '0')}` : '오늘의 역사';
  const era = battle.historyEra || '새공화국 기록';
  const year = battle.motifYear ? `${battle.motifYear}년 모티브` : '역사 모티브';
  const title = battle.topic || '오늘의 역사정치 사건';
  const question = battle.historyQuestion || battle.topicDesc || '';
  const motif = battle.motif || '';
  const historyHref = battle.historyDay ? `#/history?day=${battle.historyDay}` : '#/history';

  return `<div id="${SLOT_ID}" class="battle-history-context" style="margin:0 0 12px;padding:14px;border-radius:18px;border:1px solid rgba(124,58,237,.22);background:linear-gradient(135deg,rgba(124,58,237,.10),rgba(37,99,235,.055))">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
      <span class="feed-card__type-badge feed-card__type-badge--multi">📚 ${esc(day)}</span>
      <span class="tag">${esc(era)}</span>
      <span class="tag">${esc(year)}</span>
      <span class="tag">인물·정당 가상화</span>
    </div>
    <div style="display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap">
      <div style="min-width:240px;flex:1">
        <div style="font-size:15px;font-weight:950;margin-bottom:4px">오늘의 역사정치 사건 · ${esc(title)}</div>
        ${question ? `<div style="font-size:13px;color:var(--color-text-muted);line-height:1.55">${esc(question)}</div>` : ''}
        ${motif ? `<div style="font-size:12px;color:var(--color-text-muted);line-height:1.45;margin-top:5px">실제 모티브 · ${esc(motif)}</div>` : ''}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a class="btn btn--primary btn--sm" href="${historyHref}">자료/선택 보기</a>
        <a class="btn btn--ghost btn--sm" href="#/history">전체 자료실</a>
      </div>
    </div>
    <details style="margin-top:10px">
      <summary style="cursor:pointer;font-size:12px;font-weight:800;color:var(--color-text-muted)">3당 가상 해석 보기</summary>
      <div style="display:grid;gap:6px;margin-top:8px;font-size:12px;line-height:1.5">
        ${battle.partyDebates?.national?.stance ? `<div>🛡️ <b>국민질서당</b> · ${esc(battle.partyDebates.national.stance)}</div>` : ''}
        ${battle.partyDebates?.youth?.stance ? `<div>🕯️ <b>시민개혁당</b> · ${esc(battle.partyDebates.youth.stance)}</div>` : ''}
        ${battle.partyDebates?.center?.stance ? `<div>⚖️ <b>국민통합당</b> · ${esc(battle.partyDebates.center.stance)}</div>` : ''}
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
    const battle = await loadBattleHistoryContext();
    if (!slot.isConnected) return;
    slot.outerHTML = renderHistoryBattleBox(battle);
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
    cachedBattle = null;
    setTimeout(injectHistoryContext, 120);
  });
  setTimeout(injectHistoryContext, 300);
}

startBattleHistoryObserver();
