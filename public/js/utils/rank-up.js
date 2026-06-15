/* rank-up.js — 등급 상승 감지 + 배너 알림 유틸 */
import { getPoliticalRank } from './political-rank.js';
import { escHtml } from './helpers.js';

export function checkRankUp(uid, newPower) {
  try {
    const key = `rankLevel_${uid}`;
    const oldLevel = Number(localStorage.getItem(key) || 0);
    const cur = getPoliticalRank(newPower);
    localStorage.setItem(key, cur.level);
    if (oldLevel > 0 && cur.level > oldLevel) showRankUpBanner(cur);
  } catch {}
}

export function showRankUpBanner(rank) {
  const existing = document.querySelector('.home-rankup-banner');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'home-rankup-banner';
  el.style.setProperty('--rank-c', rank.color);
  el.innerHTML = `
    <div class="home-rankup-banner__inner">
      <span class="home-rankup-banner__emoji">${escHtml(rank.emoji)}</span>
      <div>
        <div class="home-rankup-banner__title">등급 상승!</div>
        <div class="home-rankup-banner__name">${escHtml(rank.title)}</div>
      </div>
      <button class="home-rankup-banner__close" aria-label="닫기">✕</button>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('home-rankup-banner--in'));
  // 게임감: 승급 사운드 + 진동 + 반짝임
  try { window.SosoGame?.celebrate(el.querySelector('.home-rankup-banner__emoji')); } catch {}
  el.querySelector('.home-rankup-banner__close').addEventListener('click', () => el.remove());
  setTimeout(() => el.classList.contains('home-rankup-banner--in') && el.remove(), 5000);
}
