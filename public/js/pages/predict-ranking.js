import { getRankings, getMySummary } from '../predict/prediction-engine.js';
import { injectPredictStyle } from './predict-home.js';

export function renderPredictRanking(container) {
  injectPredictStyle();
  injectRankingStyle();
  const rankings = getRankings();
  const summary = getMySummary();
  container.innerHTML = `
    <main class="predict-app ranking-page">
      <div class="simple-header rank-header">
        <a href="#/" class="back-link">‹</a>
        <div><span>SOSOKING RANKING</span><h1>이번 주 소소킹</h1></div>
        <b>${summary.wallet.balance.toLocaleString()}</b>
      </div>
      <section class="my-rank-card">
        <div><span>내 소소머니</span><strong>${summary.wallet.balance.toLocaleString()}</strong></div>
        <div><span>참여 횟수</span><strong>${summary.totalPredictions}</strong></div>
        <div><span>칭호</span><strong>${summary.wallet.title}</strong></div>
      </section>
      <section class="ranking-list">
        ${rankings.map((item, index) => `
          <div class="rank-item ${item.name === '나' ? 'me' : ''}">
            <div class="rank-no">${index + 1}</div>
            <div class="rank-body"><b>${item.name}</b><span>${item.title} · 연속 적중 ${item.streak}</span></div>
            <strong>${item.balance.toLocaleString()}</strong>
          </div>`).join('')}
      </section>
      <section class="notice-strip rank-notice"><b>안내</b><span>랭킹은 현재 데모 기준이며, 다음 단계에서 Firebase 기록 기반 주간 랭킹으로 전환됩니다.</span></section>
    </main>`;
}

function injectRankingStyle() {
  if (document.getElementById('sosoking-ranking-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-ranking-style';
  style.textContent = `
    .ranking-page { padding:16px 16px 92px; }
    .rank-header, .my-rank-card, .ranking-list { max-width:820px; margin-left:auto; margin-right:auto; }
    .my-rank-card { display:grid; grid-template-columns:1fr 1fr 1.2fr; gap:10px; margin-bottom:14px; }
    .my-rank-card div { border:1px solid var(--predict-line); border-radius:20px; padding:16px; background:var(--predict-card); }
    .my-rank-card span { display:block; color:var(--predict-muted); font-size:11px; font-weight:900; margin-bottom:5px; }
    .my-rank-card strong { display:block; font-size:20px; color:var(--predict-ink); }
    .my-rank-card div:first-child strong { color:var(--predict-money); }
    .ranking-list { display:grid; gap:10px; }
    .rank-item { display:grid; grid-template-columns:42px 1fr auto; gap:12px; align-items:center; border:1px solid var(--predict-line); border-radius:20px; padding:14px; background:var(--predict-card); }
    .rank-item.me { border-color:rgba(79,124,255,.38); background:linear-gradient(135deg,rgba(79,124,255,.08),var(--predict-card)); }
    .rank-no { width:38px; height:38px; border-radius:14px; display:flex; align-items:center; justify-content:center; background:var(--predict-bg); color:var(--predict-main); font-weight:1000; }
    .rank-body b { display:block; font-size:15px; } .rank-body span { display:block; color:var(--predict-muted); font-size:12px; margin-top:3px; }
    .rank-item > strong { color:var(--predict-money); }
    .rank-notice { max-width:820px; margin-top:14px; }
    @media(max-width:640px){ .my-rank-card{grid-template-columns:1fr;} .rank-item{grid-template-columns:36px 1fr;} .rank-item>strong{grid-column:2;} }
  `;
  document.head.appendChild(style);
}
