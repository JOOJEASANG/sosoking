/* king-history.js — 역대 당선자 기록 */
import { functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';

export async function renderKingHistory() {
  setMeta('소소킹 · 역대 당선자');
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

    // 왕 순위 계산
    const winCounts = {};
    chars.forEach(c => { winCounts[c.id] = stats[c.id]?.totalWins || 0; });
    const ranked = [...chars].sort((a, b) => (winCounts[b.id] || 0) - (winCounts[a.id] || 0));

    el.innerHTML = `
      <div class="king-history-page page-enter">

        <div class="king-history-header">
          <div class="king-history-header__title">🏛️ 소소공화국 명예의 전당</div>
          <div class="king-history-header__sub">누적 당선 횟수 기록</div>
        </div>

        <div class="king-rank-list">
          ${ranked.map((c, i) => {
            const wins = winCounts[c.id] || 0;
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            return `
              <div class="king-rank-item" style="--char-color:${c.color}">
                <span class="king-rank-item__medal">${medal}</span>
                <span class="king-rank-item__emoji">${c.emoji}</span>
                <div class="king-rank-item__info">
                  <span class="king-rank-item__name">${escHtml(c.name)}</span>
                  <span class="king-rank-item__title">${escHtml(c.title)}</span>
                </div>
                <span class="king-rank-item__wins">${wins}회</span>
              </div>`;
          }).join('')}
        </div>

        <div class="king-history-header" style="margin-top:24px">
          <div class="king-history-header__title">📜 최근 집권 기록</div>
        </div>

        ${history.length === 0
          ? '<div class="empty-state"><div class="empty-state__title">아직 기록이 없어요</div></div>'
          : `<div class="king-log-list">
              ${history.map(h => `
                <div class="king-log-item">
                  <span class="king-log-item__date">${h.date || ''}</span>
                  <span class="king-log-item__emoji">${h.emoji || ''}</span>
                  <span class="king-log-item__name">${escHtml(h.charName || '')}</span>
                  <span class="king-log-item__votes">${h.votes || 0}표</span>
                </div>`).join('')}
            </div>`}

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
