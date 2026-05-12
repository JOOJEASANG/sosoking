import { getBoards, getWallet, getMySummary, syncPredictionHomeFromServer, claimDailyBonusAsync } from '../predict/prediction-engine.js';

export function renderPredictHome(container) {
  injectPredictStyle();
  renderHomeMarkup(container, { bonus: null, syncing: true });

  Promise.all([syncPredictionHomeFromServer(), claimDailyBonusAsync()])
    .then(([, bonus]) => renderHomeMarkup(container, { bonus, syncing: false }))
    .catch(() => renderHomeMarkup(container, { bonus: null, syncing: false }));
}

function renderHomeMarkup(container, { bonus = null, syncing = false } = {}) {
  const wallet = getWallet();
  const summary = getMySummary();
  const boards = getBoards();

  container.innerHTML = `
    <main class="predict-app">
      <section class="predict-hero">
        <div class="predict-orb"></div>
        <div class="predict-topline">
          <span>SOSOKING PREDICTION</span>
          <b>${syncing ? '서버 동기화 중...' : '게임머니 · 현금가치 없음'}</b>
        </div>
        <div class="predict-hero-inner">
          <p class="predict-kicker">소소킹</p>
          <h1>내일 일은<br><em>아무도 모른다</em></h1>
          <p class="predict-lead">오늘 가장 뜨거운 이슈를 보고, 내일도 살아남을지 예측하세요. 맞히면 소소머니가 오르고, 틀리면 줄어듭니다.</p>
          <div class="wallet-card">
            <div>
              <span>보유 소소머니</span>
              <strong>${wallet.balance.toLocaleString()}</strong>
            </div>
            <div>
              <span>참여중</span>
              <strong>${summary.openCount}</strong>
            </div>
            <div>
              <span>칭호</span>
              <strong>${wallet.title}</strong>
            </div>
          </div>
          ${bonus?.claimed ? `<div class="daily-bonus">🎁 오늘의 접속 보너스 +${Number(bonus.amount || 0).toLocaleString()} 소소머니 지급</div>` : ''}
          <div class="predict-actions">
            <a href="#/predict" class="primary-action">오늘의 예측판 보기</a>
            <a href="#/ranking" class="secondary-action">랭킹 보기</a>
          </div>
        </div>
      </section>

      <section class="board-preview-section">
        <div class="section-head">
          <div><span>OPEN BOARDS</span><h2>오늘 열린 예측판</h2></div>
          <a href="#/predict">전체보기</a>
        </div>
        <div class="board-list">
          ${boards.map(board => boardCard(board)).join('')}
        </div>
      </section>

      <section class="notice-strip">
        <b>안전 안내</b>
        <span>소소머니는 게임 전용 포인트입니다. 충전, 환전, 출금, 현물 보상은 제공하지 않습니다.</span>
      </section>
    </main>`;
}

function boardCard(board) {
  return `
    <a class="board-card" href="#/predict/${board.id}">
      <div class="board-card-top"><span>${board.category}</span><b>🔥 ${board.heat}</b></div>
      <h3>${board.title}</h3>
      <p>${board.summary}</p>
      <div class="board-meta"><span>참여 ${Number(board.participants || 0).toLocaleString()}</span><span>마감 ${board.closeAt}</span></div>
    </a>`;
}

export function injectPredictStyle() {
  if (document.getElementById('sosoking-predict-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-predict-style';
  style.textContent = `
    :root { --predict-bg:#f7f8fb; --predict-ink:#151821; --predict-muted:#6f7787; --predict-card:#ffffff; --predict-line:#e7eaf0; --predict-main:#4f7cff; --predict-hot:#ff5c7a; --predict-money:#16a36a; }
    [data-theme="dark"] { --predict-bg:#070b13; --predict-ink:#eef4ff; --predict-muted:#8f9bb1; --predict-card:#101722; --predict-line:#243044; --predict-main:#72a2ff; --predict-hot:#ff6d88; --predict-money:#48d597; }
    .predict-app { min-height:100vh; background:var(--predict-bg); color:var(--predict-ink); padding-bottom:88px; font-family:var(--font-sans); }
    .predict-hero { position:relative; overflow:hidden; min-height:72vh; padding:18px; display:flex; flex-direction:column; background:linear-gradient(180deg,#eef4ff 0%, var(--predict-bg) 88%); }
    [data-theme="dark"] .predict-hero { background:radial-gradient(circle at 70% 10%,rgba(79,124,255,.26),transparent 34%),linear-gradient(180deg,#091225 0%, var(--predict-bg) 88%); }
    .predict-orb { position:absolute; width:320px; height:320px; border-radius:50%; right:-120px; top:80px; background:radial-gradient(circle,#c9d8ff,transparent 68%); opacity:.75; }
    [data-theme="dark"] .predict-orb { background:radial-gradient(circle,rgba(114,162,255,.25),transparent 68%); }
    .predict-topline { position:relative; z-index:2; display:flex; justify-content:space-between; align-items:center; gap:12px; max-width:980px; width:100%; margin:0 auto; }
    .predict-topline span { font-size:10px; letter-spacing:.16em; font-weight:900; color:var(--predict-main); }
    .predict-topline b { font-size:11px; color:var(--predict-muted); }
    .predict-hero-inner { position:relative; z-index:2; flex:1; width:100%; max-width:760px; margin:0 auto; display:flex; flex-direction:column; justify-content:center; text-align:center; padding:48px 0 28px; }
    .predict-kicker { margin:0 0 10px; color:var(--predict-main); font-weight:1000; letter-spacing:.18em; font-size:12px; }
    .predict-hero h1 { margin:0; font-size:clamp(42px,12vw,88px); letter-spacing:-.08em; line-height:1; font-weight:1000; }
    .predict-hero h1 em { font-style:normal; color:var(--predict-hot); }
    .predict-lead { max-width:590px; margin:18px auto 0; color:var(--predict-muted); font-size:16px; line-height:1.75; }
    .wallet-card { margin:26px auto 0; width:100%; max-width:650px; display:grid; grid-template-columns:1fr 1fr 1.3fr; gap:10px; }
    .wallet-card > div { padding:16px; border:1px solid var(--predict-line); border-radius:20px; background:rgba(255,255,255,.74); backdrop-filter:blur(12px); text-align:left; box-shadow:0 14px 30px rgba(35,55,100,.08); }
    [data-theme="dark"] .wallet-card > div { background:rgba(16,23,34,.78); box-shadow:none; }
    .wallet-card span { display:block; color:var(--predict-muted); font-size:11px; font-weight:900; margin-bottom:5px; }
    .wallet-card strong { display:block; color:var(--predict-ink); font-size:22px; font-weight:1000; word-break:keep-all; }
    .wallet-card div:first-child strong { color:var(--predict-money); }
    .daily-bonus { max-width:520px; margin:14px auto 0; padding:11px 13px; border-radius:14px; color:#09603b; background:rgba(22,163,106,.12); border:1px solid rgba(22,163,106,.24); font-size:13px; font-weight:900; }
    [data-theme="dark"] .daily-bonus { color:#76f0b2; }
    .predict-actions { display:grid; grid-template-columns:1.4fr .8fr; gap:10px; max-width:460px; margin:24px auto 0; }
    .predict-actions a { text-decoration:none; border-radius:18px; padding:16px 14px; font-weight:1000; }
    .primary-action { color:#fff; background:linear-gradient(135deg,var(--predict-main),#2f5cff); box-shadow:0 14px 32px rgba(79,124,255,.28); }
    .secondary-action { color:var(--predict-ink); background:var(--predict-card); border:1px solid var(--predict-line); }
    .board-preview-section { max-width:980px; margin:0 auto; padding:24px 18px; }
    .section-head { display:flex; align-items:end; justify-content:space-between; gap:12px; margin-bottom:14px; }
    .section-head span { display:block; color:var(--predict-main); font-size:10px; font-weight:1000; letter-spacing:.14em; }
    .section-head h2 { margin:4px 0 0; font-size:22px; letter-spacing:-.04em; }
    .section-head a { color:var(--predict-main); font-weight:900; text-decoration:none; font-size:13px; }
    .board-list { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
    .board-card { display:flex; flex-direction:column; min-height:190px; text-decoration:none; color:var(--predict-ink); border:1px solid var(--predict-line); border-radius:22px; padding:16px; background:var(--predict-card); box-shadow:0 12px 30px rgba(35,55,100,.07); }
    [data-theme="dark"] .board-card { box-shadow:none; }
    .board-card-top { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:12px; }
    .board-card-top span { color:var(--predict-main); font-size:11px; font-weight:1000; }
    .board-card-top b { color:var(--predict-hot); font-size:12px; }
    .board-card h3 { margin:0; font-size:18px; line-height:1.35; letter-spacing:-.04em; }
    .board-card p { margin:10px 0 0; color:var(--predict-muted); font-size:13px; line-height:1.6; }
    .board-meta { margin-top:auto; padding-top:14px; display:flex; justify-content:space-between; color:var(--predict-muted); font-size:11px; font-weight:800; }
    .notice-strip { max-width:944px; margin:0 auto 24px; padding:14px 18px; border:1px solid var(--predict-line); border-radius:18px; background:var(--predict-card); color:var(--predict-muted); display:flex; gap:10px; align-items:center; font-size:13px; }
    .notice-strip b { color:var(--predict-hot); white-space:nowrap; }
    @media(max-width:760px){ .predict-hero-inner{text-align:left;} .wallet-card{grid-template-columns:1fr;} .predict-actions{grid-template-columns:1fr;} .board-list{grid-template-columns:1fr;} .notice-strip{margin-left:18px;margin-right:18px;align-items:flex-start;} }
  `;
  document.head.appendChild(style);
}
