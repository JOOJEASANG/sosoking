/* king-history.js — 역대 집권 대표 기록 */
import { functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';

const PARTY_BY_NAME = {
  '국민안정당': { emoji: '🎙️', color: '#8B7355' },
  '진실방송당': { emoji: '📺', color: '#6C5CE7' },
  '청년혁명당': { emoji: '📱', color: '#E84393' },
  '중도민주당': { emoji: '📊', color: '#00CEC9' },
  '함께미래당': { emoji: '🤝', color: '#FDCB6E' },
  '알권리당':   { emoji: '🔍', color: '#00B894' },
  '법치정의당': { emoji: '⚖️', color: '#2D3436' },
};

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n || 0);
}

export async function renderKingHistory() {
  setMeta('소소킹 · 역대 집권 기록');
  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `
    <div class="king-history-page page-enter">
      <div class="skeleton" style="height:200px;border-radius:16px;margin-bottom:12px"></div>
      <div class="skeleton" style="height:300px;border-radius:16px"></div>
    </div>`;

  try {
    const getKingHistory = httpsCallable(functions, 'getKingHistory');
    const { data } = await getKingHistory();
    const { history = [], stats = {}, chars = [] } = data;

    // 왕 순위 계산 + 연속 집권 streak 계산
    const winCounts = {};
    chars.forEach(c => { winCounts[c.id] = stats[c.id]?.totalWins || 0; });
    const ranked = [...chars].sort((a, b) => (winCounts[b.id] || 0) - (winCounts[a.id] || 0));
    const totalBattles = history.length;

    // 현재 streak 계산 (history는 최신순)
    let streakChar = null, streak = 0;
    if (history.length > 0) {
      const latestCharId = history[0].charId;
      for (const h of history) {
        if (h.charId === latestCharId) streak++;
        else break;
      }
      streakChar = latestCharId;
    }

    el.innerHTML = `
      <div class="king-history-page page-enter">

        <div class="kh-hero">
          <div class="kh-hero__badge">🏛️ 소소공화국</div>
          <h1 class="kh-hero__title">명예의 전당</h1>
          <p class="kh-hero__sub">총 ${totalBattles}일간의 정치 배틀 기록</p>
        </div>

        ${streak >= 3 ? `<div class="kh-streak-banner">
          <span class="kh-streak-banner__fire">🔥</span>
          <span class="kh-streak-banner__text">${escHtml(history[0]?.charName || '')} <b>${streak}일 연속 집권 중!</b></span>
        </div>` : ''}

        <div class="kh-rank-section">
          <div class="kh-section-title">🏆 역대 집권 횟수</div>
          <div class="king-rank-list">
            ${ranked.map((c, i) => {
              const wins = winCounts[c.id] || 0;
              const pInfo = PARTY_BY_NAME[c.party] || {};
              const winRate = totalBattles > 0 ? Math.round((wins / totalBattles) * 100) : 0;
              const isCurrentKing = c.id === streakChar && streak > 0;
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
              return `
                <div class="king-rank-item${isCurrentKing ? ' king-rank-item--current' : ''}" style="--char-color:${c.color}">
                  <span class="king-rank-item__medal">${medal}</span>
                  <span class="king-rank-item__emoji">${c.emoji}</span>
                  <div class="king-rank-item__info">
                    <div class="king-rank-item__name-row">
                      <span class="king-rank-item__name">${escHtml(c.name)}</span>
                      ${pInfo.emoji ? `<span class="king-rank-item__party" style="color:${pInfo.color}">${pInfo.emoji} ${escHtml(c.party)}</span>` : ''}
                      ${isCurrentKing && streak >= 2 ? `<span class="king-rank-item__streak">🔥 ${streak}연속</span>` : ''}
                    </div>
                    <div class="king-rank-item__bar-wrap">
                      <div class="king-rank-item__bar" style="width:${winRate}%"></div>
                    </div>
                  </div>
                  <div class="king-rank-item__stats">
                    <span class="king-rank-item__wins">${wins}회</span>
                    <span class="king-rank-item__rate">${winRate}%</span>
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>

        <div class="kh-rank-section" style="margin-top:20px">
          <div class="kh-section-title">📜 최근 집권 기록</div>
          ${history.length === 0
            ? '<div class="empty-state"><div class="empty-state__title">아직 기록이 없어요</div></div>'
            : `<div class="king-log-list">
                ${history.map((h, i) => {
                  const pInfo = PARTY_BY_NAME[h.party] || {};
                  const votePct = h.totalVotes > 0 ? Math.round((h.votes / h.totalVotes) * 100) : null;
                  const isStreak = i > 0 && history[i - 1].charId === h.charId;
                  return `
                  <div class="king-log-item${isStreak ? ' king-log-item--streak' : ''}" style="--char-color:${chars.find(c => c.id === h.charId)?.color || '#888'}">
                    <span class="king-log-item__date">${h.date || ''}</span>
                    <span class="king-log-item__emoji">${h.emoji || ''}</span>
                    <div class="king-log-item__body">
                      <span class="king-log-item__name">${escHtml(h.charName || '')}</span>
                      ${pInfo.emoji ? `<span class="king-log-item__party" style="color:${pInfo.color}">${pInfo.emoji}</span>` : ''}
                    </div>
                    <div class="king-log-item__right">
                      <span class="king-log-item__votes">${fmtNum(h.votes)}표</span>
                      ${votePct != null ? `<span class="king-log-item__pct">${votePct}%</span>` : ''}
                      ${isStreak ? '<span class="king-log-item__streak-dot">🔥</span>' : ''}
                    </div>
                  </div>`;
                }).join('')}
              </div>`}
        </div>

      </div>`;

  } catch (err) {
    console.error('[king-history] load error', err);
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">👑</div>
        <div class="empty-state__title">기록을 불러오지 못했어요</div>
        <button class="btn btn--primary" style="margin-top:16px" id="btn-retry">다시 시도</button>
      </div>`;
    el.querySelector('#btn-retry')?.addEventListener('click', renderKingHistory);
  }
}
