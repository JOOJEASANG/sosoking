/* ranking.js — 소소공화국 정치력 랭킹 */
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';

function fmtPower(n) {
  n = Number(n || 0);
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  if (n >= 1000)  return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function rankMedal(rank) {
  if (rank === 1) return '<span class="rank-medal rank-medal--1">🥇</span>';
  if (rank === 2) return '<span class="rank-medal rank-medal--2">🥈</span>';
  if (rank === 3) return '<span class="rank-medal rank-medal--3">🥉</span>';
  return `<span class="rank-medal rank-medal--rest">${rank}</span>`;
}

function renderUserRow(m, myUid) {
  const isMe = myUid && m.uid === myUid;
  return `
    <div class="rank-row${isMe ? ' rank-row--me' : ''}">
      ${rankMedal(m.rank)}
      <span class="rank-party-dot" style="background:${m.partyColor}" title="${escHtml(m.partyName)}"></span>
      <span class="rank-nickname">${m.icon ? `${m.icon} ` : ''}${escHtml(m.nickname)}${isMe ? ' <em>(나)</em>' : ''}</span>
      <span class="rank-party-name">${m.partyEmoji} ${escHtml(m.partyName)}</span>
      <span class="rank-power">${fmtPower(m.power)}P</span>
    </div>`;
}

function renderLeaderCard(party) {
  const { leader } = party;
  return `
    <div class="leader-card" style="--party-c:${party.color}">
      <div class="leader-card__party">
        <span class="leader-card__emoji">${party.emoji}</span>
        <span class="leader-card__name">${escHtml(party.name)}</span>
      </div>
      ${leader
        ? `<div class="leader-card__leader">
            <span class="leader-card__crown">👑</span>
            <span class="leader-card__nick">${leader.icon ? `${leader.icon} ` : ''}${escHtml(leader.nickname)}</span>
            <span class="leader-card__power">${fmtPower(leader.power)}P</span>
           </div>`
        : `<div class="leader-card__empty">당대표 없음 — 입당하면 당대표!</div>`}
    </div>`;
}

export async function renderRanking() {
  setMeta('소소공화국 정치력 랭킹');
  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `<div class="ranking-page page-enter">
    <div class="skeleton" style="height:100px;border-radius:16px;margin-bottom:12px"></div>
    <div class="skeleton" style="height:400px;border-radius:16px"></div>
  </div>`;

  let data;
  try {
    const call = httpsCallable(functions, 'getRankings');
    const res = await call();
    data = res.data;
  } catch (err) {
    console.error('[ranking] load error', err);
    el.innerHTML = `<div class="empty-state">
      <div class="empty-state__icon">⚠️</div>
      <div class="empty-state__title">랭킹을 불러오지 못했어요</div>
      <button class="btn btn--primary" style="margin-top:16px" id="rank-retry">다시 시도</button>
    </div>`;
    el.querySelector('#rank-retry')?.addEventListener('click', renderRanking);
    return;
  }

  const { top30 = [], leaders = [], myEntry = null } = data;
  const myUid = auth.currentUser?.uid || '';

  const myBanner = myEntry
    ? `<div class="rank-my-banner">
        <span>내 순위</span>
        <strong>${myEntry.rank}위</strong>
        <span>${myEntry.partyEmoji} ${escHtml(myEntry.partyName)}</span>
        <strong>${fmtPower(myEntry.power)}P</strong>
       </div>`
    : !auth.currentUser
      ? `<div class="rank-my-banner rank-my-banner--guest">
          입당하고 정치력을 쌓으면 랭킹에 등장합니다!
          <a href="#/parties" style="color:var(--color-primary);font-weight:700">입당하기 →</a>
         </div>`
      : `<div class="rank-my-banner rank-my-banner--guest">아직 정치력이 없어요. 활동하면 바로 등장합니다!</div>`;

  el.innerHTML = `<div class="ranking-page page-enter">
    <div class="ranking-hero">
      <div class="ranking-hero__badge">🏆 소소공화국</div>
      <h1 class="ranking-hero__title">정치력 랭킹</h1>
      <p class="ranking-hero__sub">활동할수록 정치력이 쌓이고, 당내 1위는 당대표가 됩니다</p>
    </div>

    ${myBanner}

    <div class="ranking-tabs" id="rank-tabs">
      <button class="ranking-tab active" data-tab="overall">🏅 전체 순위</button>
      <button class="ranking-tab" data-tab="leaders">👑 당대표 현황</button>
    </div>

    <div id="rank-panel-overall" class="rank-panel">
      ${top30.length
        ? top30.map(m => renderUserRow(m, myUid)).join('')
        : `<div class="empty-state" style="padding:40px 0">
            <div class="empty-state__icon">🌱</div>
            <div class="empty-state__title">아직 활동 중인 당원이 없어요</div>
            <div class="empty-state__desc">첫 번째로 입당하고 정치력 1위가 되어보세요!</div>
           </div>`}
    </div>

    <div id="rank-panel-leaders" class="rank-panel" hidden>
      <div class="leaders-grid">
        ${leaders.map(renderLeaderCard).join('')}
      </div>
    </div>
  </div>`;

  el.querySelectorAll('.ranking-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      el.querySelectorAll('.ranking-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      el.querySelector('#rank-panel-overall').hidden = (target !== 'overall');
      el.querySelector('#rank-panel-leaders').hidden = (target !== 'leaders');
    });
  });
}
