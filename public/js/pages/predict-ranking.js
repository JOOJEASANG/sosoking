import { getRankings, getMySummary, syncRankingsFromServer } from '../predict/prediction-engine.js';
import { injectPredictStyle } from './predict-home.js';

export function renderPredictRanking(container) {
  injectPredictStyle();
  injectRankingStyle();
  renderRankingMarkup(container, true);
  syncRankingsFromServer().then(() => renderRankingMarkup(container, false)).catch(() => renderRankingMarkup(container, false));
}

function renderRankingMarkup(container, syncing = false) {
  const rankings = getRankings();
  const summary = getMySummary();
  const top3 = rankings.slice(0, 3);
  const rest = rankings.slice(3);
  container.innerHTML = `
    <main class="predict-app ranking-page">
      <div class="simple-header rank-header">
        <a href="#/" class="back-link">‹</a>
        <div><span>${syncing ? '랭킹 동기화 중...' : 'SOSOKING LEAGUE'}</span><h1>이번 주 소소킹</h1></div>
        <b>${summary.wallet.balance.toLocaleString()}</b>
      </div>
      <section class="league-hero">
        <div><span>WEEKLY KING</span><h2>촉 좋은 사람들이<br>왕관을 가져갑니다</h2><p>소소머니, 연속 적중, 칭호가 쌓이면 이번 주 소소킹에 가까워집니다.</p></div>
        <a href="#/predict">예측판 참여</a>
      </section>
      <section class="podium-wrap">
        ${podiumCard(top3[1], 2)}${podiumCard(top3[0], 1)}${podiumCard(top3[2], 3)}
      </section>
      <section class="my-rank-card">
        <div><span>내 소소머니</span><strong>${summary.wallet.balance.toLocaleString()}</strong></div>
        <div><span>참여 횟수</span><strong>${summary.totalPredictions}</strong></div>
        <div><span>칭호</span><strong>${summary.wallet.title}</strong></div>
      </section>
      <section class="ranking-list">
        ${(rest.length ? rest : rankings).map((item, index) => rankRow(item, rest.length ? index + 4 : index + 1)).join('')}
      </section>
      <section class="notice-strip rank-notice"><b>안내</b><span>랭킹은 user_wallets의 소소머니 기준으로 표시됩니다. 소소머니는 게임 전용 포인트입니다.</span></section>
    </main>`;
}

function podiumCard(item, rank) {
  if (!item) return `<div class="podium-card empty"><b>${rank}</b><span>도전자 대기</span></div>`;
  const crown = rank === 1 ? '👑' : rank === 2 ? '🥈' : '🥉';
  return `<article class="podium-card rank-${rank}"><div class="podium-crown">${crown}</div><div class="podium-avatar">${rank}</div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.title)}</p><strong>${Number(item.balance || 0).toLocaleString()}</strong><span>연속 적중 ${Number(item.streak || 0)}</span></article>`;
}

function rankRow(item, rank) {
  return `<div class="rank-item ${item.name === '나' ? 'me' : ''}"><div class="rank-no">${rank}</div><div class="rank-body"><b>${escapeHtml(item.name)}</b><span>${escapeHtml(item.title)} · 연속 적중 ${Number(item.streak || 0)}</span></div><strong>${Number(item.balance || 0).toLocaleString()}</strong></div>`;
}

function injectRankingStyle() {
  if (document.getElementById('sosoking-ranking-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-ranking-style';
  style.textContent = `
    .ranking-page { padding:16px 16px 92px; }
    .rank-header, .league-hero, .podium-wrap, .my-rank-card, .ranking-list { max-width:920px; margin-left:auto; margin-right:auto; }
    .league-hero { overflow:hidden; position:relative; display:grid; grid-template-columns:1fr auto; align-items:end; gap:14px; margin-bottom:14px; border-radius:28px; padding:22px; color:#fff; background:linear-gradient(135deg,#101b3c,#4f7cff 56%,#7c5cff); box-shadow:0 24px 70px rgba(79,124,255,.22); }
    .league-hero:after { content:'👑'; position:absolute; right:24px; top:12px; font-size:82px; opacity:.14; transform:rotate(12deg); }
    .league-hero span { font-size:11px; font-weight:1000; letter-spacing:.16em; color:rgba(255,255,255,.72); }
    .league-hero h2 { margin:6px 0 8px; font-size:30px; line-height:1.12; letter-spacing:-.06em; }
    .league-hero p { margin:0; color:rgba(255,255,255,.74); line-height:1.6; }
    .league-hero a { position:relative; z-index:2; display:inline-flex; padding:13px 16px; border-radius:16px; background:#fff; color:#17245f; text-decoration:none; font-weight:1000; }
    .podium-wrap { display:grid; grid-template-columns:1fr 1.15fr 1fr; gap:12px; align-items:end; margin-bottom:14px; }
    .podium-card { position:relative; overflow:hidden; text-align:center; border-radius:26px; padding:18px 14px; background:rgba(255,255,255,.88); box-shadow:0 18px 54px rgba(55,90,170,.13); min-height:190px; }
    .podium-card.rank-1 { min-height:232px; background:linear-gradient(180deg,#fff6d6,#fff); transform:translateY(-10px); }
    .podium-card.rank-2 { background:linear-gradient(180deg,#eef4ff,#fff); }
    .podium-card.rank-3 { background:linear-gradient(180deg,#fff0e4,#fff); }
    .podium-crown { font-size:30px; margin-bottom:7px; }
    .podium-avatar { width:58px; height:58px; margin:0 auto 10px; display:flex; align-items:center; justify-content:center; border-radius:22px; background:linear-gradient(135deg,#4f7cff,#7c5cff); color:#fff; font-weight:1000; font-size:22px; box-shadow:0 12px 30px rgba(79,124,255,.24); }
    .podium-card h3 { margin:0; font-size:17px; letter-spacing:-.03em; }
    .podium-card p { margin:5px 0 9px; color:var(--predict-muted); font-size:12px; }
    .podium-card strong { display:block; color:var(--predict-money); font-size:22px; }
    .podium-card span { color:var(--predict-muted); font-size:12px; }
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
    .rank-notice { max-width:920px; margin-top:14px; }
    @media(max-width:720px){ .league-hero{grid-template-columns:1fr;} .podium-wrap{grid-template-columns:1fr;} .podium-card.rank-1{transform:none;order:-1;} .my-rank-card{grid-template-columns:1fr;} .rank-item{grid-template-columns:36px 1fr;} .rank-item>strong{grid-column:2;} }
  `;
  document.head.appendChild(style);
}

function escapeHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
