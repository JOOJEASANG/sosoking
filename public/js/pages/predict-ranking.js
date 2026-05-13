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
  const hasRankings = rankings.length > 0;
  container.innerHTML = `
    <main class="predict-app ranking-page">
      <section class="ranking-hero">
        <a href="#/" class="back-link rank-back">‹</a>
        <div class="ranking-hero-copy">
          <span>${syncing ? 'RANKING SYNC' : 'SOSOKING LEAGUE'}</span>
          <h1>이번 주<br><em>소소킹</em></h1>
          <p>이번 주 실제 참여 데이터만 기준으로 순위를 보여줍니다. 가짜 랭킹 없이 운영 데이터가 쌓이면 이곳에 자동으로 표시됩니다.</p>
          <div class="ranking-badges"><b>👑 주간 왕관</b><b>🎯 연속 적중</b><b>💰 소소머니 기준</b></div>
        </div>
        <aside class="ranking-my-card">
          <span>내 현황</span>
          <strong>${Number(summary.wallet.balance || 0).toLocaleString()}</strong>
          <p>${summary.wallet.title || '새내기 예측러'} · 참여 ${Number(summary.totalPredictions || 0).toLocaleString()}회</p>
          <a href="#/predict">예측판 참여</a>
        </aside>
      </section>
      ${hasRankings ? podiumSection(top3) : emptyRanking(syncing)}
      <section class="my-rank-card upgraded-my-rank">
        <div><span>내 소소머니</span><strong>${Number(summary.wallet.balance || 0).toLocaleString()}</strong></div>
        <div><span>참여 횟수</span><strong>${Number(summary.totalPredictions || 0).toLocaleString()}</strong></div>
        <div><span>칭호</span><strong>${escapeHtml(summary.wallet.title || '새내기 예측러')}</strong></div>
      </section>
      ${hasRankings ? `<section class="ranking-list upgraded-ranking-list">${(rest.length ? rest : rankings).map((item, index) => rankRow(item, rest.length ? index + 4 : index + 1)).join('')}</section>` : ''}
      <section class="notice-strip rank-notice"><b>운영 기준</b><span>랭킹은 실제 user_wallets 데이터 기준으로만 표시됩니다. 소소머니는 게임 전용 포인트입니다.</span></section>
    </main>`;
}

function podiumSection(top3) {
  return `<section class="podium-wrap upgraded-podium">${podiumCard(top3[1], 2)}${podiumCard(top3[0], 1)}${podiumCard(top3[2], 3)}</section>`;
}

function emptyRanking(syncing) {
  return `<section class="ranking-empty-state"><div class="empty-crown">👑</div><span>${syncing ? '랭킹 확인 중' : '아직 소소킹 없음'}</span><h2>${syncing ? '실제 랭킹 데이터를 불러오고 있습니다' : '첫 번째 소소킹이 곧 나옵니다'}</h2><p>아직 공개할 실제 랭킹 데이터가 없습니다. 사용자가 예측에 참여하고 정산 데이터가 쌓이면 이 영역에 순위가 자동으로 나타납니다.</p><a href="#/predict">오늘의 3판 참여하기</a></section>`;
}

function podiumCard(item, rank) {
  if (!item) return `<div class="podium-card empty"><div class="podium-crown">${rank}</div><h3>대기중</h3><p>실제 데이터 없음</p><strong>-</strong><span>운영 데이터 대기</span></div>`;
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
    .ranking-page{padding:18px clamp(16px,4vw,34px) 104px;background:radial-gradient(circle at 18% 0%,rgba(255,197,66,.18),transparent 30%),radial-gradient(circle at 92% 10%,rgba(79,124,255,.14),transparent 30%),var(--predict-bg)}
    .ranking-hero,.podium-wrap,.my-rank-card,.ranking-list,.ranking-empty-state,.rank-notice{max-width:1040px;margin-left:auto;margin-right:auto}.ranking-hero{display:grid;grid-template-columns:44px 1fr 300px;gap:14px;align-items:stretch;margin-bottom:16px}.rank-back{margin-top:4px}.ranking-hero-copy{position:relative;overflow:hidden;border-radius:34px;padding:32px;background:linear-gradient(135deg,#16121f,#4f3dba 45%,#f0a83a);color:#fff;box-shadow:0 28px 82px rgba(120,78,200,.2)}.ranking-hero-copy:after{content:'👑';position:absolute;right:26px;bottom:-34px;font-size:150px;opacity:.11;transform:rotate(10deg)}.ranking-hero-copy span{font-size:11px;font-weight:1000;letter-spacing:.16em;color:rgba(255,255,255,.72)}.ranking-hero-copy h1{position:relative;z-index:1;margin:8px 0 10px;font-size:clamp(42px,7vw,76px);line-height:.96;letter-spacing:-.08em}.ranking-hero-copy h1 em{font-style:normal;color:#ffe083}.ranking-hero-copy p{position:relative;z-index:1;max-width:620px;margin:0;color:rgba(255,255,255,.78);font-size:15px;line-height:1.75}.ranking-badges{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}.ranking-badges b{display:inline-flex;padding:8px 10px;border-radius:999px;background:rgba(255,255,255,.16);font-size:12px;color:#fff}.ranking-my-card{display:flex;flex-direction:column;justify-content:center;border:1px solid rgba(240,168,58,.24);border-radius:30px;padding:22px;background:rgba(255,255,255,.88);box-shadow:0 18px 56px rgba(120,78,200,.12)}.ranking-my-card span{color:var(--predict-muted);font-size:12px;font-weight:1000}.ranking-my-card strong{margin-top:8px;color:var(--predict-money);font-size:34px;letter-spacing:-.05em}.ranking-my-card p{margin:10px 0 14px;color:var(--predict-muted);font-size:13px;line-height:1.55}.ranking-my-card a{display:inline-flex;justify-content:center;border-radius:16px;padding:12px;background:linear-gradient(135deg,#4f7cff,#7c5cff);color:#fff;text-decoration:none;font-weight:1000}.podium-wrap{display:grid;grid-template-columns:1fr 1.15fr 1fr;gap:14px;align-items:end;margin-bottom:16px}.podium-card{position:relative;overflow:hidden;text-align:center;border-radius:30px;padding:20px 14px;background:rgba(255,255,255,.9);box-shadow:0 20px 60px rgba(55,90,170,.13);min-height:190px;border:1px solid rgba(255,197,66,.18)}.podium-card.rank-1{min-height:245px;background:linear-gradient(180deg,#fff1b8,#fff);transform:translateY(-10px)}.podium-card.rank-2{background:linear-gradient(180deg,#eef4ff,#fff)}.podium-card.rank-3{background:linear-gradient(180deg,#fff0e4,#fff)}.podium-card.empty{opacity:.72;border-style:dashed}.podium-crown{font-size:34px;margin-bottom:8px}.podium-avatar{width:62px;height:62px;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;border-radius:24px;background:linear-gradient(135deg,#4f7cff,#7c5cff);color:#fff;font-weight:1000;font-size:22px;box-shadow:0 12px 30px rgba(79,124,255,.24)}.podium-card h3{margin:0;font-size:18px;letter-spacing:-.03em}.podium-card p{margin:6px 0 10px;color:var(--predict-muted);font-size:12px}.podium-card strong{display:block;color:var(--predict-money);font-size:24px}.podium-card span{color:var(--predict-muted);font-size:12px}.ranking-empty-state{text-align:center;margin-bottom:16px;border:1px solid rgba(255,197,66,.25);border-radius:32px;padding:34px 22px;background:linear-gradient(135deg,rgba(255,255,255,.9),rgba(255,246,214,.78));box-shadow:0 18px 54px rgba(120,78,200,.1)}.empty-crown{font-size:54px}.ranking-empty-state span{display:block;margin-top:8px;color:#b27a00;font-size:11px;font-weight:1000;letter-spacing:.14em}.ranking-empty-state h2{margin:8px 0 8px;font-size:28px;letter-spacing:-.05em}.ranking-empty-state p{max-width:560px;margin:0 auto;color:var(--predict-muted);line-height:1.7}.ranking-empty-state a{display:inline-flex;margin-top:18px;padding:13px 16px;border-radius:16px;background:linear-gradient(135deg,#4f7cff,#7c5cff);color:#fff;text-decoration:none;font-weight:1000}.my-rank-card{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:10px;margin-bottom:16px}.my-rank-card div{border:1px solid var(--predict-line);border-radius:22px;padding:17px;background:var(--predict-card)}.my-rank-card span{display:block;color:var(--predict-muted);font-size:11px;font-weight:900;margin-bottom:5px}.my-rank-card strong{display:block;font-size:20px;color:var(--predict-ink)}.my-rank-card div:first-child strong{color:var(--predict-money)}.ranking-list{display:grid;gap:10px}.rank-item{display:grid;grid-template-columns:42px 1fr auto;gap:12px;align-items:center;border:1px solid var(--predict-line);border-radius:22px;padding:15px;background:var(--predict-card)}.rank-item.me{border-color:rgba(79,124,255,.38);background:linear-gradient(135deg,rgba(79,124,255,.08),var(--predict-card))}.rank-no{width:38px;height:38px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:var(--predict-bg);color:var(--predict-main);font-weight:1000}.rank-body b{display:block;font-size:15px}.rank-body span{display:block;color:var(--predict-muted);font-size:12px;margin-top:3px}.rank-item>strong{color:var(--predict-money)}.rank-notice{margin-top:14px}@media(max-width:820px){.ranking-hero{grid-template-columns:1fr}.podium-wrap{grid-template-columns:1fr}.podium-card.rank-1{transform:none;order:-1}.my-rank-card{grid-template-columns:1fr}.rank-item{grid-template-columns:36px 1fr}.rank-item>strong{grid-column:2}.ranking-hero-copy{padding:27px}.ranking-my-card{padding:18px}}[data-theme="dark"] .ranking-my-card,[data-theme="dark"] .podium-card,[data-theme="dark"] .ranking-empty-state{background:rgba(16,23,34,.9);box-shadow:none}[data-theme="dark"] .podium-card.rank-1,[data-theme="dark"] .podium-card.rank-2,[data-theme="dark"] .podium-card.rank-3{background:rgba(16,23,34,.9)}
  `;
  document.head.appendChild(style);
}

function escapeHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
