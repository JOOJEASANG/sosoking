import { getBoards, getWallet, getMySummary, syncPredictionHomeFromServer, claimDailyBonusAsync } from '../predict/prediction-engine.js';

export function renderPredictHome(container) {
  injectPredictStyle();
  draw(container, true, null);
  Promise.all([syncPredictionHomeFromServer(), claimDailyBonusAsync()])
    .then(([, bonus]) => draw(container, false, bonus))
    .catch(() => draw(container, false, null));
}

function draw(container, syncing, bonus) {
  const wallet = getWallet();
  const summary = getMySummary();
  const boards = getBoards();
  const main = boards[0];
  const totalParticipants = boards.reduce((sum, board) => sum + Number(board.participants || 0), 0);
  container.innerHTML = `
    <main class="predict-app home-v2">
      <section class="home-hero-v2">
        <div class="home-orb orb-a"></div><div class="home-orb orb-b"></div>
        <div class="home-shell">
          <div class="home-topbar-v2">
            <div class="brand-lockup"><span class="brand-mark">소</span><div><b>소소킹</b><small>내일 일은 아무도 모른다</small></div></div>
            <span class="sync-pill">${syncing ? '최신 데이터 확인 중' : '실제 운영 데이터 기준'}</span>
          </div>
          <div class="home-hero-grid">
            <div class="home-copy-v2">
              <p class="home-kicker">TODAY ISSUE PREDICTION</p>
              <h1>오늘 뜬 이슈,<br><em>내일도 살아남을까?</em></h1>
              <p class="home-lead">하루에 딱 몇 개만 열리는 예측판. 사람들의 관심이 내일까지 이어질지, 오늘로 식을지, 내 촉을 소소머니로 가볍게 테스트해보세요.</p>
              <div class="home-actions-v2"><a class="primary-action" href="#/predict">오늘의 3판 보기</a><a class="secondary-action" href="#/feed">소소피드 보기</a></div>
              <div class="home-proof-row"><span>현금가치 없음</span><span>오락용 포인트</span><span>근거 한 줄 참여</span></div>
            </div>
            <aside class="hero-command-card">
              ${bonus?.claimed ? `<div class="daily-bonus-v2">🎁 오늘 보너스 +${Number(bonus.amount || 0).toLocaleString()}</div>` : ''}
              <div class="command-head"><span>MY SOSO WALLET</span><b>${Number(wallet.balance || 0).toLocaleString()}</b></div>
              <div class="command-grid"><div><small>참여중</small><strong>${Number(summary.openCount || 0)}</strong></div><div><small>참여기록</small><strong>${Number(summary.totalPredictions || 0)}</strong></div><div><small>열린 판</small><strong>${Number(boards.length || 0)}</strong></div><div><small>총 참여</small><strong>${Number(totalParticipants || 0).toLocaleString()}</strong></div></div>
              <div class="command-title"><small>칭호</small><strong>${e(wallet.title || '새내기 예측러')}</strong></div>
            </aside>
          </div>
        </div>
      </section>

      <section class="live-brief-section">
        <div class="live-brief-main">${spotlight(main)}</div>
        <div class="live-brief-side">
          <article><b>01</b><span>오늘 이슈 확인</span><p>실제 운영 데이터로 열린 판만 표시됩니다.</p></article>
          <article><b>02</b><span>내일 흐름 선택</span><p>살아남을지, 식을지, 반전이 나올지 선택합니다.</p></article>
          <article><b>03</b><span>근거 한 줄</span><p>내일 다시 보면 가장 재밌는 기록입니다.</p></article>
        </div>
      </section>

      <section class="home-feature-grid">
        <a class="feature-tile predict-tile" href="#/predict"><span>🔮</span><b>오늘의 3판</b><p>핫이슈 예측판에 참여하고 소소머니 흐름을 확인하세요.</p></a>
        <a class="feature-tile feed-tile" href="#/feed"><span>📸</span><b>소소피드</b><p>웃긴 글, 사진, 소소한 논쟁을 쌓고 댓글과 투표를 붙입니다.</p></a>
        <a class="feature-tile rank-tile" href="#/ranking"><span>👑</span><b>이번 주 소소킹</b><p>가짜 랭킹 없이 실제 운영 데이터가 쌓이면 순위가 열립니다.</p></a>
      </section>

      <section class="board-preview-section home-board-v2"><div class="section-head"><div><span>TODAY PICKS</span><h2>지금 열린 예측판</h2></div><a href="#/predict">전체보기</a></div><div class="board-list">${boards.length ? boards.map(card).join('') : emptyBoards()}</div></section>
      <section class="home-bottom-note"><b>운영 안내</b><span>소소머니는 게임 전용 포인트이며 현금 가치, 충전, 환전, 출금, 현물 보상은 제공하지 않습니다.</span></section>
    </main>`;
}

function tagRow(board) {
  const tags = Array.isArray(board?.gameTags) && board.gameTags.length ? board.gameTags : [board?.status === 'settled' ? '정산 완료' : '오늘의 판'];
  return `<div class="game-tags">${tags.slice(0,3).map(t => `<span>${e(t)}</span>`).join('')}</div>`;
}

function spotlight(board) {
  if (!board) return `<article class="spotlight-card-v2 empty"><div class="spotlight-label"><span>LIVE BOARD</span><b>대기</b></div><h2>예측판 준비 중</h2><p>현재 공개된 실제 예측판이 없습니다. 서버에서 오늘의 3판이 열리면 이곳에 바로 표시됩니다.</p><a href="#/predict">예측판 확인</a></article>`;
  return `<article class="spotlight-card-v2"><div class="spotlight-label"><span>가장 먼저 볼 판</span><b>🔥 ${Number(board.heat || 0)}</b></div><h2>${e(board.title)}</h2><p>${e(board.summary)}</p>${tagRow(board)}<div class="spotlight-stats"><div><small>참여</small><strong>${Number(board.participants||0).toLocaleString()}</strong></div><div><small>마감</small><strong>${e(board.closeAt)}</strong></div><div><small>분류</small><strong>${e(board.category)}</strong></div></div><a href="#/predict/${encodeURIComponent(board.id)}">이 판 예측하기</a></article>`;
}

function card(board) {
  return `<a class="board-card" href="#/predict/${encodeURIComponent(board.id)}"><div class="board-card-top"><span>${e(board.category)}</span><b>🔥 ${Number(board.heat || 0)}</b></div><h3>${e(board.title)}</h3><p>${e(board.summary)}</p>${tagRow(board)}<div class="board-meta"><span>참여 ${Number(board.participants||0).toLocaleString()}</span><span>마감 ${e(board.closeAt)}</span></div></a>`;
}

function emptyBoards() {
  return `<div class="board-card empty-home-board"><div class="board-card-top"><span>READY</span><b>🔮</b></div><h3>예측판을 준비 중입니다</h3><p>가짜 예측판 없이 실제 서버 데이터만 표시됩니다. 오늘의 3판이 열리면 이곳에 자동으로 나타납니다.</p><div class="game-tags"><span>실제 데이터</span><span>준비중</span></div><div class="board-meta"><span>대기</span><span>곧 공개</span></div></div>`;
}

export function injectPredictStyle() {
  if (document.getElementById('sosoking-predict-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-predict-style';
  style.textContent = `:root{--predict-bg:#f5f7fb;--predict-ink:#121724;--predict-muted:#697386;--predict-card:#fff;--predict-line:#e5eaf2;--predict-main:#4f7cff;--predict-hot:#ff5c7a;--predict-money:#16a36a}[data-theme="dark"]{--predict-bg:#070b13;--predict-ink:#eef4ff;--predict-muted:#8f9bb1;--predict-card:#101722;--predict-line:#243044;--predict-main:#72a2ff;--predict-hot:#ff6d88;--predict-money:#48d597}.predict-app{min-height:100vh;background:var(--predict-bg);color:var(--predict-ink);padding-bottom:88px;font-family:var(--font-sans)}.home-v2{background:radial-gradient(circle at 18% 0%,rgba(79,124,255,.18),transparent 28%),radial-gradient(circle at 86% 10%,rgba(255,92,122,.14),transparent 26%),var(--predict-bg)}.home-hero-v2{position:relative;overflow:hidden;padding:20px clamp(16px,4vw,34px) 22px}.home-orb{position:absolute;border-radius:999px;filter:blur(4px);opacity:.5;pointer-events:none}.orb-a{width:220px;height:220px;left:-90px;top:40px;background:rgba(79,124,255,.18)}.orb-b{width:260px;height:260px;right:-120px;top:90px;background:rgba(255,92,122,.14)}.home-shell{max-width:1120px;margin:0 auto}.home-topbar-v2{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.brand-lockup{display:flex;align-items:center;gap:10px}.brand-mark{width:42px;height:42px;display:flex;align-items:center;justify-content:center;border-radius:16px;background:linear-gradient(135deg,#4f7cff,#7c5cff);color:#fff;font-weight:1000;box-shadow:0 16px 38px rgba(79,124,255,.28)}.brand-lockup b{display:block;font-size:15px}.brand-lockup small{display:block;color:var(--predict-muted);font-size:12px;margin-top:1px}.sync-pill{display:inline-flex;padding:8px 11px;border-radius:999px;border:1px solid rgba(79,124,255,.14);background:rgba(255,255,255,.68);color:var(--predict-main);font-size:12px;font-weight:900}.home-hero-grid{display:grid;grid-template-columns:1fr 330px;gap:18px;align-items:stretch}.home-copy-v2{position:relative;overflow:hidden;border-radius:38px;padding:42px;background:linear-gradient(135deg,#101b3c,#4f7cff 58%,#7c5cff);color:#fff;box-shadow:0 30px 90px rgba(79,124,255,.22)}.home-copy-v2:after{content:'?';position:absolute;right:26px;bottom:-52px;font-size:190px;font-weight:1000;opacity:.10}.home-kicker{margin:0 0 10px;color:rgba(255,255,255,.72);font-size:11px;font-weight:1000;letter-spacing:.18em}.home-copy-v2 h1{position:relative;z-index:1;margin:0;font-size:clamp(42px,7vw,78px);letter-spacing:-.085em;line-height:.98;font-weight:1000}.home-copy-v2 h1 em{font-style:normal;color:#ffe083}.home-lead{position:relative;z-index:1;max-width:650px;margin:18px 0 0;color:rgba(255,255,255,.78);font-size:16px;line-height:1.75}.home-actions-v2{position:relative;z-index:1;display:flex;gap:10px;margin-top:26px}.home-actions-v2 a{text-decoration:none;border-radius:18px;padding:15px 17px;font-weight:1000}.home-actions-v2 .primary-action{background:#fff;color:#17245f}.home-actions-v2 .secondary-action{border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.13);color:#fff}.home-proof-row{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}.home-proof-row span{display:inline-flex;padding:8px 10px;border-radius:999px;background:rgba(255,255,255,.13);font-size:12px;font-weight:900;color:rgba(255,255,255,.86)}.hero-command-card{display:flex;flex-direction:column;gap:12px;justify-content:center;border:1px solid rgba(79,124,255,.14);border-radius:34px;padding:22px;background:rgba(255,255,255,.86);box-shadow:0 22px 70px rgba(55,90,170,.13)}.daily-bonus-v2{padding:11px 12px;border-radius:16px;background:rgba(22,163,106,.12);color:var(--predict-money);font-size:13px;font-weight:1000}.command-head span,.command-title small,.command-grid small{display:block;color:var(--predict-muted);font-size:11px;font-weight:1000;letter-spacing:.08em}.command-head b{display:block;margin-top:6px;color:var(--predict-money);font-size:36px;letter-spacing:-.06em}.command-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.command-grid div,.command-title{padding:13px;border-radius:18px;background:rgba(79,124,255,.07)}.command-grid strong,.command-title strong{display:block;margin-top:4px;font-size:18px;color:var(--predict-ink)}.live-brief-section{max-width:1120px;margin:0 auto;padding:0 clamp(16px,4vw,34px) 18px;display:grid;grid-template-columns:1fr 330px;gap:18px}.spotlight-card-v2{height:100%;position:relative;overflow:hidden;border-radius:32px;padding:24px;background:rgba(255,255,255,.88);border:1px solid rgba(79,124,255,.13);box-shadow:0 18px 54px rgba(55,90,170,.11)}.spotlight-card-v2.empty{border-style:dashed}.spotlight-label{display:flex;justify-content:space-between;gap:10px;margin-bottom:14px}.spotlight-label span{color:var(--predict-main);font-size:11px;font-weight:1000;letter-spacing:.1em}.spotlight-label b{color:var(--predict-hot);font-size:13px}.spotlight-card-v2 h2{max-width:680px;margin:0;font-size:30px;line-height:1.22;letter-spacing:-.06em}.spotlight-card-v2 p{max-width:720px;margin:10px 0 0;color:var(--predict-muted);line-height:1.7}.spotlight-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:15px}.spotlight-stats div{padding:12px;border-radius:16px;background:rgba(79,124,255,.06)}.spotlight-stats small{display:block;color:var(--predict-muted);font-size:11px;font-weight:900}.spotlight-stats strong{display:block;margin-top:3px;font-size:13px}.spotlight-card-v2>a{display:inline-flex;margin-top:16px;padding:13px 15px;border-radius:16px;background:linear-gradient(135deg,#4f7cff,#7c5cff);color:#fff;text-decoration:none;font-weight:1000}.live-brief-side{display:grid;gap:10px}.live-brief-side article{padding:17px;border-radius:24px;background:rgba(255,255,255,.75);border:1px solid rgba(79,124,255,.11);box-shadow:0 12px 34px rgba(55,90,170,.07)}.live-brief-side b{display:inline-flex;width:31px;height:31px;align-items:center;justify-content:center;border-radius:12px;background:rgba(79,124,255,.10);color:var(--predict-main);font-size:12px}.live-brief-side span{display:block;margin-top:10px;font-weight:1000}.live-brief-side p{margin:5px 0 0;color:var(--predict-muted);font-size:13px;line-height:1.55}.home-feature-grid{max-width:1120px;margin:0 auto;padding:0 clamp(16px,4vw,34px) 20px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.feature-tile{position:relative;overflow:hidden;min-height:166px;padding:20px;border-radius:28px;background:rgba(255,255,255,.86);border:1px solid rgba(79,124,255,.12);text-decoration:none;color:var(--predict-ink);box-shadow:0 16px 46px rgba(55,90,170,.09);transition:transform .18s ease,box-shadow .18s ease}.feature-tile:hover{transform:translateY(-3px);box-shadow:0 24px 70px rgba(55,90,170,.15)}.feature-tile span{font-size:32px}.feature-tile b{display:block;margin-top:12px;font-size:20px;letter-spacing:-.04em}.feature-tile p{margin:8px 0 0;color:var(--predict-muted);line-height:1.6;font-size:13px}.home-board-v2{max-width:1120px;padding:0 clamp(16px,4vw,34px) 22px}.section-head{display:flex;justify-content:space-between;gap:12px;margin-bottom:14px}.section-head span{color:var(--predict-main);font-size:10px;font-weight:1000;letter-spacing:.08em}.section-head h2{margin:4px 0 0;font-size:24px;letter-spacing:-.05em}.section-head a{color:var(--predict-main);font-weight:900;text-decoration:none}.board-list{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.board-card{display:flex;flex-direction:column;min-height:200px;text-decoration:none;color:var(--predict-ink);border:1px solid rgba(79,124,255,.12);border-radius:26px;padding:17px;background:var(--predict-card);box-shadow:0 14px 38px rgba(55,90,170,.08)}.board-card-top{display:flex;justify-content:space-between;margin-bottom:12px}.board-card-top span{color:var(--predict-main);font-size:11px;font-weight:1000}.board-card-top b{color:var(--predict-hot);font-size:12px}.board-card h3{margin:0;font-size:19px;line-height:1.35;letter-spacing:-.04em}.board-card p{color:var(--predict-muted);font-size:13px;line-height:1.6}.game-tags{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}.game-tags span{display:inline-flex;padding:6px 8px;border-radius:999px;background:rgba(79,124,255,.10);color:var(--predict-main);font-size:11px;font-weight:900}.board-meta{margin-top:auto;padding-top:14px;display:flex;justify-content:space-between;color:var(--predict-muted);font-size:11px}.home-bottom-note{max-width:1086px;margin:0 auto 24px;padding:15px 18px;border:1px solid rgba(79,124,255,.12);border-radius:20px;background:rgba(255,255,255,.74);color:var(--predict-muted);font-size:13px}.home-bottom-note b{color:var(--predict-main);margin-right:8px}@media(max-width:880px){.home-hero-grid,.live-brief-section,.home-feature-grid,.board-list{grid-template-columns:1fr}.home-copy-v2{padding:30px}.home-actions-v2{flex-direction:column}.spotlight-stats{grid-template-columns:1fr}.home-topbar-v2{align-items:flex-start;gap:12px;flex-direction:column}.sync-pill{align-self:flex-start}}[data-theme="dark"] .sync-pill,[data-theme="dark"] .hero-command-card,[data-theme="dark"] .spotlight-card-v2,[data-theme="dark"] .live-brief-side article,[data-theme="dark"] .feature-tile,[data-theme="dark"] .home-bottom-note{background:rgba(16,23,34,.88);box-shadow:none}[data-theme="dark"] .home-copy-v2{background:linear-gradient(135deg,#0f1726,#1f3b7a 58%,#533aa2)}`;
  document.head.appendChild(style);
}

function e(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
