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
  container.innerHTML = `
    <main class="predict-app">
      <section class="predict-hero">
        <div class="predict-topline"><span>SOSOKING</span><b>${syncing ? '동기화 중' : '게임 포인트 · 현금가치 없음'}</b></div>
        <div class="predict-hero-inner">
          <div class="predict-hero-copy">
            <p class="predict-kicker">🔮 소소킹 예측소</p>
            <h1>내일 일은<br><em>아무도 모른다</em></h1>
            <p class="predict-lead">오늘 뜬 이슈를 보고 내일의 흐름을 맞히세요. 촉이 맞으면 소소머니가 쌓이고, 랭킹에 이름이 올라갑니다.</p>
            <div class="hero-badges"><span class="hero-badge hot">🔥 오늘의 핫판</span><span class="hero-badge gold">👑 주간 소소킹</span><span class="hero-badge">🎯 연속 적중</span></div>
            <div class="wallet-card"><div><span>보유 소소머니</span><strong>${Number(wallet.balance || 0).toLocaleString()}</strong></div><div><span>참여중</span><strong>${Number(summary.openCount || 0)}</strong></div><div><span>칭호</span><strong>${e(wallet.title || '새내기 예측러')}</strong></div></div>
            ${bonus?.claimed ? `<div class="daily-bonus">🎁 오늘 보너스 +${Number(bonus.amount || 0).toLocaleString()}</div>` : ''}
            <div class="predict-actions"><a href="#/predict" class="primary-action">예측판 보기</a><a href="#/history" class="secondary-action">내 기록</a></div>
          </div>
          <div class="predict-hero-panel">${spotlight(main)}</div>
        </div>
      </section>
      <section class="king-strip"><div class="king-strip-inner"><div class="king-chip"><b>⚡ 의견 갈림</b><span>팽팽할수록 더 재밌음</span></div><div class="king-chip"><b>⏰ 마감 임박</b><span>오늘 23:59 전 참여</span></div><div class="king-chip"><b>🎖 칭호 성장</b><span>맞히면 캐릭터 강화</span></div><div class="king-chip"><b>💬 성지 댓글</b><span>근거를 남기면 재미 증가</span></div></div></section>
      <section class="fun-section"><div class="fun-grid"><article class="mission-card"><strong>오늘의 미션</strong><div class="mission-list"><div class="mission-item"><div class="mission-check">1</div><div><b>예측 1회 참여</b><span>오늘의 첫 선택을 남기기</span></div></div><div class="mission-item"><div class="mission-check">2</div><div><b>근거 댓글 작성</b><span>내 촉을 한 줄로 기록</span></div></div><div class="mission-item"><div class="mission-check">3</div><div><b>역전판 도전</b><span>반전 이슈를 노려보기</span></div></div></div></article><article class="briefing-card"><strong>AI 관전평</strong><p>오늘은 이슈 흐름이 빠르게 바뀌는 날입니다. 기사량만 보지 말고, 내일까지 이어질 댓글 흐름과 반전 가능성을 같이 보세요.</p><span class="mini-reward">오늘의 팁: 하루짜리 이슈 조심</span></article></div></section>
      <section class="board-preview-section"><div class="section-head"><div><span>OPEN BOARDS</span><h2>오늘 열린 예측판</h2></div><a href="#/predict">전체보기</a></div><div class="board-list">${boards.length ? boards.map(card).join('') : emptyBoards()}</div></section>
      <section class="notice-strip"><b>안전 안내</b><span>소소머니는 게임 전용 포인트이며 현금 가치가 없습니다.</span></section>
    </main>`;
}

function tagRow(board) {
  const tags = Array.isArray(board?.gameTags) && board.gameTags.length ? board.gameTags : [board?.status === 'settled' ? '정산 완료' : '오늘의 판'];
  return `<div class="game-tags">${tags.slice(0,3).map(t => `<span>${e(t)}</span>`).join('')}</div>`;
}

function spotlight(board) {
  if (!board) return `<div class="spotlight-card"><div class="spotlight-inner"><div class="spotlight-title">예측판 준비 중</div><p class="spotlight-summary">오늘의 핫이슈를 불러오고 있습니다.</p><a class="spotlight-action" href="#/predict">예측판 확인하기</a></div></div>`;
  return `<div class="spotlight-card"><div class="spotlight-inner"><div class="spotlight-label"><span>오늘의 메인 예측</span><b>🔥 ${Number(board.heat || 0)}</b></div><div class="spotlight-title">${e(board.title)}</div><p class="spotlight-summary">${e(board.summary)}</p>${tagRow(board)}<div class="spotlight-stats"><div><span>참여</span><b>${Number(board.participants||0).toLocaleString()}</b></div><div><span>마감</span><b>${e(board.closeAt)}</b></div><div><span>분류</span><b>${e(board.category)}</b></div></div><a class="spotlight-action" href="#/predict/${encodeURIComponent(board.id)}">이 판 예측하기</a></div></div>`;
}

function card(board) {
  return `<a class="board-card" href="#/predict/${encodeURIComponent(board.id)}"><div class="board-card-top"><span>${e(board.category)}</span><b>🔥 ${Number(board.heat || 0)}</b></div><h3>${e(board.title)}</h3><p>${e(board.summary)}</p>${tagRow(board)}<div class="board-meta"><span>참여 ${Number(board.participants||0).toLocaleString()}</span><span>마감 ${e(board.closeAt)}</span></div></a>`;
}

function emptyBoards() {
  return `<div class="board-card"><div class="board-card-top"><span>READY</span><b>🔮</b></div><h3>예측판을 준비 중입니다</h3><p>잠시 후 오늘의 핫이슈 예측판이 열립니다. 관리자 수집 또는 자동 스케줄 후 표시됩니다.</p><div class="game-tags"><span>준비중</span><span>자동수집</span></div><div class="board-meta"><span>대기</span><span>곧 공개</span></div></div>`;
}

export function injectPredictStyle() {
  if (document.getElementById('sosoking-predict-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-predict-style';
  style.textContent = `:root{--predict-bg:#f7f8fb;--predict-ink:#151821;--predict-muted:#6f7787;--predict-card:#fff;--predict-line:#e7eaf0;--predict-main:#4f7cff;--predict-hot:#ff5c7a;--predict-money:#16a36a}[data-theme="dark"]{--predict-bg:#070b13;--predict-ink:#eef4ff;--predict-muted:#8f9bb1;--predict-card:#101722;--predict-line:#243044;--predict-main:#72a2ff;--predict-hot:#ff6d88;--predict-money:#48d597}.predict-app{min-height:100vh;background:var(--predict-bg);color:var(--predict-ink);padding-bottom:88px;font-family:var(--font-sans)}.predict-hero{position:relative;overflow:hidden;padding:18px;background:linear-gradient(180deg,#eef4ff 0%,var(--predict-bg) 88%)}.predict-topline{display:flex;justify-content:space-between;max-width:980px;margin:0 auto}.predict-topline span{font-size:10px;letter-spacing:.16em;font-weight:900;color:var(--predict-main)}.predict-topline b{font-size:11px;color:var(--predict-muted)}.predict-hero-inner{max-width:760px;margin:0 auto;text-align:center;padding:48px 0 28px}.predict-kicker{margin:0 0 10px;color:var(--predict-main);font-weight:1000;font-size:12px}.predict-hero h1{margin:0;font-size:clamp(42px,12vw,88px);letter-spacing:-.08em;line-height:1;font-weight:1000}.predict-hero h1 em{font-style:normal;color:var(--predict-hot)}.predict-lead{max-width:590px;margin:18px auto 0;color:var(--predict-muted);font-size:16px;line-height:1.75}.wallet-card{margin:26px auto 0;max-width:650px;display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:10px}.wallet-card>div{padding:16px;border:1px solid var(--predict-line);border-radius:20px;background:rgba(255,255,255,.74);text-align:left}.wallet-card span{display:block;color:var(--predict-muted);font-size:11px;font-weight:900}.wallet-card strong{font-size:22px;font-weight:1000}.wallet-card div:first-child strong{color:var(--predict-money)}.daily-bonus{margin:14px auto 0;padding:11px 13px;border-radius:14px;background:rgba(22,163,106,.12);font-size:13px;font-weight:900}.predict-actions{display:grid;grid-template-columns:1.4fr .8fr;gap:10px;max-width:460px;margin:24px auto 0}.predict-actions a{text-decoration:none;border-radius:18px;padding:16px 14px;font-weight:1000}.primary-action{color:#fff;background:var(--predict-main)}.secondary-action{color:var(--predict-ink);background:var(--predict-card);border:1px solid var(--predict-line)}.board-preview-section{max-width:980px;margin:0 auto;padding:24px 18px}.section-head{display:flex;justify-content:space-between;gap:12px;margin-bottom:14px}.section-head span{color:var(--predict-main);font-size:10px;font-weight:1000}.section-head h2{margin:4px 0 0;font-size:22px}.section-head a{color:var(--predict-main);font-weight:900;text-decoration:none}.board-list{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.board-card{display:flex;flex-direction:column;min-height:190px;text-decoration:none;color:var(--predict-ink);border:1px solid var(--predict-line);border-radius:22px;padding:16px;background:var(--predict-card)}.board-card-top{display:flex;justify-content:space-between;margin-bottom:12px}.board-card-top span{color:var(--predict-main);font-size:11px;font-weight:1000}.board-card-top b{color:var(--predict-hot);font-size:12px}.board-card h3{margin:0;font-size:18px;line-height:1.35}.board-card p{color:var(--predict-muted);font-size:13px;line-height:1.6}.game-tags{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}.game-tags span{display:inline-flex;padding:6px 8px;border-radius:999px;background:rgba(79,124,255,.10);color:var(--predict-main);font-size:11px;font-weight:900}.spotlight-card .game-tags span{background:rgba(255,255,255,.14);color:#fff}.board-meta{margin-top:auto;padding-top:14px;display:flex;justify-content:space-between;color:var(--predict-muted);font-size:11px}.notice-strip{max-width:944px;margin:0 auto 24px;padding:14px 18px;border:1px solid var(--predict-line);border-radius:18px;background:var(--predict-card);color:var(--predict-muted);font-size:13px}@media(max-width:760px){.wallet-card,.predict-actions,.board-list{grid-template-columns:1fr}.predict-hero-inner{text-align:left}}`;
  document.head.appendChild(style);
}

function e(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
