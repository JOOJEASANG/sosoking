import { getBoards, getBoard, getWallet, getPrediction, placePredictionAsync, getComments, addCommentAsync, syncPredictionHomeFromServer, syncPredictionDetailFromServer } from '../predict/prediction-engine.js';
import { injectPredictStyle } from './predict-home.js';

export function renderPredictList(container) {
  injectPredictStyle();
  injectListStyle();
  renderListMarkup(container, true);
  syncPredictionHomeFromServer().then(() => renderListMarkup(container, false)).catch(() => renderListMarkup(container, false));
}

function renderListMarkup(container, syncing = false) {
  const boards = getBoards();
  const wallet = getWallet();
  const hottest = [...boards].sort((a, b) => Number(b.heat || 0) - Number(a.heat || 0))[0] || null;
  const openCount = boards.filter(board => board.status !== 'settled').length;
  const participantTotal = boards.reduce((sum, board) => sum + Number(board.participants || 0), 0);
  container.innerHTML = `
    <main class="predict-app simple-page predict-list-page">
      <section class="predict-list-hero">
        <a href="#/" class="back-link list-back">‹</a>
        <div class="list-hero-copy">
          <span>${syncing ? 'SERVER SYNC' : 'TODAY 3 PICKS'}</span>
          <h1>오늘의 3판,<br><em>어디에 걸어볼까?</em></h1>
          <p>오늘 뜬 이슈 중 실제로 열린 예측판만 보여줍니다. 내일도 살아남을 이슈인지, 오늘로 식을 이슈인지 빠르게 판단해보세요.</p>
          <div class="list-hero-badges"><b>🔥 최고 관심도 ${Number(hottest?.heat || 0)}</b><b>⏰ 실제 데이터</b><b>💬 근거 한 줄</b></div>
        </div>
        <aside class="list-wallet-card">
          <span>내 소소머니</span>
          <strong>${Number(wallet.balance || 0).toLocaleString()}</strong>
          <p>현재 열린 판 ${openCount}개 · 전체 참여 ${participantTotal.toLocaleString()}명</p>
        </aside>
      </section>
      <section class="pick-briefing">
        <article><span>01</span><b>이슈 읽기</b><p>제목과 AI 힌트로 흐름을 먼저 봅니다.</p></article>
        <article><span>02</span><b>선택하기</b><p>내일 실제 흐름에 가까운 쪽을 고릅니다.</p></article>
        <article><span>03</span><b>근거 남기기</b><p>한 줄 근거가 있어야 나중에 더 재밌습니다.</p></article>
      </section>
      <section class="board-preview-section list-mode upgraded-list-mode">
        <div class="section-head list-section-head"><div><span>CHOOSE YOUR ISSUE</span><h2>예측할 이슈를 선택하세요</h2></div><p>${syncing ? '최신 예측판을 불러오는 중입니다.' : '실제 운영 데이터만 표시됩니다.'}</p></div>
        <div class="board-list upgraded-board-list">${boards.length ? boards.map((board, index) => boardCard(board, index)).join('') : predictionEmptyState()}</div>
      </section>
    </main>`;
}

export function renderPredictDetail(container, boardId) {
  injectPredictStyle();
  injectDetailStyle();
  renderDetailMarkup(container, boardId, true);
  syncPredictionDetailFromServer(boardId).then((result) => renderDetailMarkup(container, result?.board?.id || boardId, false)).catch(() => renderDetailMarkup(container, boardId, false));
}

function renderDetailMarkup(container, boardId, syncing = false) {
  const board = getBoard(boardId);
  const wallet = getWallet();
  if (!board) {
    container.innerHTML = `<main class="predict-app simple-page"><div class="simple-header"><a href="#/predict" class="back-link">‹</a><div><span>${syncing ? 'SERVER SYNC' : 'NO BOARD'}</span><h1>예측판을 찾을 수 없습니다</h1></div><b>${Number(wallet.balance || 0).toLocaleString()}</b></div><section class="prediction-empty-state"><div>🔮</div><span>NO PREDICTION BOARD</span><h3>아직 공개된 예측판이 없습니다</h3><p>가짜 예측판 없이 실제 서버에서 열린 판만 표시됩니다. 오늘의 3판이 열리면 이곳에 자동으로 나타납니다.</p><a href="#/">홈으로 돌아가기</a></section></main>`;
    return;
  }
  const existing = getPrediction(board.id);
  const comments = getComments(board.id);
  const resultNotice = board.status === 'settled' ? `<div class="result-box"><b>정산 완료</b><span>${escapeHtml(board.resultLine || `정답은 ${board.winningOptionLabel || '공개 완료'}입니다.`)}</span></div>` : '';
  container.innerHTML = `
    <main class="predict-app simple-page">
      <div class="simple-header"><a href="#/predict" class="back-link">‹</a><div><span>${escapeHtml(syncing ? '서버 확인 중...' : board.category)}</span><h1>${escapeHtml(board.title)}</h1></div><b>${wallet.balance.toLocaleString()}</b></div>
      <section class="detail-layout">
        <article class="detail-main-card">
          <div class="heat-row"><span>🔥 관심도 ${Number(board.heat || 0)}</span><span>참여 ${Number(board.participants || 0).toLocaleString()}</span></div>
          <h2>${escapeHtml(board.question)}</h2><p>${escapeHtml(board.summary)}</p>${resultNotice}
          ${moodPanel(board)}
          <div class="issue-box"><b>판단 힌트</b><span>${escapeHtml(board.aiComment)}</span></div>
          <div class="rule-grid"><div><b>마감</b><span>${escapeHtml(board.closeAt)}</span></div><div><b>결과 확인</b><span>${escapeHtml(board.resultAt)}</span></div><div><b>정답 기준</b><span>${escapeHtml(board.resultRule)}</span></div></div>
        </article>
        <aside class="prediction-panel">${existing ? renderExisting(existing) : renderForm(board)}</aside>
      </section>
      <section class="comments-section"><div class="section-head compact"><div><span>REASONS</span><h2>예측 근거 한 줄</h2></div><p class="comment-guide">사람들이 왜 그쪽을 골랐는지 보는 곳입니다. 짧고 명확할수록 좋아요.</p></div><form id="comment-form" class="comment-form"><input id="comment-input" maxlength="120" placeholder="예: 오늘 너무 과열돼서 내일은 식을 듯" /><button>등록</button></form><div class="comment-list">${comments.length ? comments.map(c => `<div class="comment-item ${c.mine ? 'mine' : ''}"><b>${escapeHtml(c.side)}</b><p>${escapeHtml(c.text)}</p><small>공감 ${Number(c.likes || 0)}</small></div>`).join('') : `<div class="comment-item"><b>아직 근거 없음</b><p>첫 번째 근거를 남겨보세요.</p><small>공감 0</small></div>`}</div></section>
    </main>`;

  document.getElementById('prediction-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const btn = form.querySelector('.submit-prediction');
    const optionId = document.querySelector('input[name="predict-option"]:checked')?.value;
    const amount = document.getElementById('predict-amount')?.value;
    const comment = document.getElementById('predict-comment')?.value;
    if (btn) { btn.disabled = true; btn.textContent = '예측 등록 중...'; }
    try {
      const result = await placePredictionAsync({ boardId: board.id, optionId, amount, comment });
      if (result.fallback) showMiniNotice('서버 연결 전이라 기기 저장 방식으로 참여했습니다.');
      await syncPredictionDetailFromServer(board.id);
      renderDetailMarkup(container, board.id, false);
    } catch (error) {
      alert(error.message || '예측 등록에 실패했습니다.');
      if (btn) { btn.disabled = false; btn.textContent = '예측 등록하기'; }
    }
  });

  document.getElementById('comment-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = document.getElementById('comment-input');
    if (!input?.value?.trim()) return;
    const btn = event.currentTarget.querySelector('button');
    if (btn) { btn.disabled = true; btn.textContent = '등록 중'; }
    await addCommentAsync(board.id, input.value, existing?.optionLabel || '내 근거');
    await syncPredictionDetailFromServer(board.id);
    renderDetailMarkup(container, board.id, false);
  });
}

function predictionEmptyState() {
  return `<section class="prediction-empty-state"><div>🔮</div><span>NO BOARDS YET</span><h3>아직 열린 예측판이 없습니다</h3><p>실제 운영 데이터만 표시되도록 정리했습니다. 서버에서 오늘의 3판이 생성되면 이곳에 바로 나타납니다.</p><a href="#/feed">소소피드 둘러보기</a></section>`;
}

function moodPanel(board) {
  const options = board.options || [];
  const seed = String(board.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const mainRate = 54 + (seed % 23);
  const aiPick = options[seed % Math.max(1, options.length)]?.label || '관망';
  const difficulty = board.heat > 86 ? '판단 어려움' : board.heat > 75 ? '적당히 갈리는 판' : '비교적 단순한 판';
  return `<div class="mood-panel"><div class="mood-head"><b>이 판을 보는 법</b><span>${escapeHtml(difficulty)}</span></div><div class="mood-bars"><div><span>현재 쏠림 예상</span><b>${mainRate}%</b><i style="--w:${mainRate}%"></i></div><div><span>반전 여지</span><b>${100-mainRate}%</b><i style="--w:${100-mainRate}%"></i></div></div><div class="ai-pick"><b>AI 참고 의견</b><span>${escapeHtml(aiPick)}</span><small>정답 보장이 아니라 판단을 돕는 참고 신호입니다.</small></div></div>`;
}

function renderForm(board) {
  if (board.status === 'settled') return `<div class="prediction-done"><div class="done-icon">📌</div><h3>마감된 예측판</h3><p>이미 결과 확인이 끝난 예측판입니다.</p></div>`;
  const options = Array.isArray(board.options) ? board.options : [];
  return `<form id="prediction-form" class="prediction-form"><div class="panel-title">내 선택</div><p class="panel-help">내일 실제 흐름이 어느 쪽에 가까울지 하나만 고르세요.</p><div class="option-list">${options.map((option, index) => `<label class="option-card"><input type="radio" name="predict-option" value="${escapeAttr(option.id)}" ${index === 0 ? 'checked' : ''}><span><b>${escapeHtml(option.label)}</b><small>예상 배율 x${Number(option.odds || 1)}</small></span></label>`).join('')}</div><label class="input-label">사용할 소소머니</label><select id="predict-amount"><option value="500">500</option><option value="1000" selected>1,000</option><option value="3000">3,000</option><option value="5000">5,000</option></select><label class="input-label">예측 근거 한 줄</label><textarea id="predict-comment" maxlength="120" placeholder="왜 그렇게 생각하는지 짧게 남겨보세요."></textarea><button class="submit-prediction">내 예측 등록</button><p class="money-note">소소머니는 게임 전용 포인트이며 현금 가치가 없습니다.</p></form>`;
}

function renderExisting(prediction) {
  const settledLine = prediction.settled ? (prediction.won ? `적중 성공 · +${Number(prediction.payout || 0).toLocaleString()}` : `적중 실패 · ${Number(prediction.profit || 0).toLocaleString()}`) : (prediction.source === 'server' ? '서버에 저장되었습니다.' : '결과 확인 전까지 기다려주세요.');
  return `<div class="prediction-done"><div class="done-icon">${prediction.settled ? (prediction.won ? '🎯' : '🫠') : '✅'}</div><h3>${prediction.settled ? '결과 확인 완료' : '내 예측 완료'}</h3><p><b>${escapeHtml(prediction.optionLabel)}</b>에 ${Number(prediction.amount || 0).toLocaleString()} 소소머니를 사용했습니다.</p>${prediction.comment ? `<blockquote>${escapeHtml(prediction.comment)}</blockquote>` : ''}<span>${escapeHtml(settledLine)}</span></div>`;
}

function boardCard(board, index = 0) {
  const statusText = board.status === 'settled' ? '결과 공개' : `마감 ${escapeHtml(board.closeAt)}`;
  return `<a class="board-card upgraded-board-card" href="#/predict/${encodeURIComponent(board.id)}"><div class="board-rank">0${index + 1}</div><div class="board-card-top"><span>${escapeHtml(board.category)}</span><b>🔥 ${Number(board.heat || 0)}</b></div><h3>${escapeHtml(board.title)}</h3><p>${escapeHtml(board.summary)}</p><div class="board-mini-tags"><span>참여 ${Number(board.participants || 0).toLocaleString()}</span><span>${statusText}</span></div><div class="board-card-cta"><b>이 판 예측하기</b><span>›</span></div></a>`;
}
function showMiniNotice(message) { const box = document.getElementById('toast-container'); if (!box) return; const el = document.createElement('div'); el.className = 'toast show'; el.innerHTML = `<strong>안내</strong><br>${escapeHtml(message)}`; box.appendChild(el); setTimeout(() => el.remove(), 2600); }

function injectListStyle() {
  if (document.getElementById('sosoking-predict-list-upgrade-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-predict-list-upgrade-style';
  style.textContent = `
    .predict-list-page{padding:18px clamp(16px,4vw,34px) 104px;background:radial-gradient(circle at 20% 0%,rgba(79,124,255,.16),transparent 32%),var(--predict-bg)}
    .predict-list-hero{max-width:1080px;margin:0 auto 14px;display:grid;grid-template-columns:44px 1fr 280px;gap:14px;align-items:stretch}.list-back{margin-top:4px}.list-hero-copy{position:relative;overflow:hidden;border-radius:32px;padding:30px;background:linear-gradient(135deg,#101b3c,#4f7cff 60%,#7c5cff);color:#fff;box-shadow:0 26px 78px rgba(79,124,255,.22)}.list-hero-copy:after{content:'?';position:absolute;right:24px;bottom:-36px;font-size:150px;font-weight:1000;opacity:.10}.list-hero-copy span{font-size:11px;font-weight:1000;letter-spacing:.16em;color:rgba(255,255,255,.7)}.list-hero-copy h1{position:relative;z-index:1;margin:8px 0 10px;font-size:clamp(36px,6vw,64px);line-height:.98;letter-spacing:-.08em}.list-hero-copy h1 em{font-style:normal;color:#ffe083}.list-hero-copy p{position:relative;z-index:1;max-width:620px;margin:0;color:rgba(255,255,255,.78);font-size:15px;line-height:1.75}.list-hero-badges{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}.list-hero-badges b{display:inline-flex;padding:8px 10px;border-radius:999px;background:rgba(255,255,255,.15);font-size:12px;color:#fff}.list-wallet-card{display:flex;flex-direction:column;justify-content:center;border:1px solid rgba(79,124,255,.13);border-radius:28px;padding:22px;background:rgba(255,255,255,.86);box-shadow:0 18px 54px rgba(55,90,170,.12)}.list-wallet-card span{color:var(--predict-muted);font-size:12px;font-weight:1000}.list-wallet-card strong{margin-top:7px;color:var(--predict-money);font-size:34px;letter-spacing:-.04em}.list-wallet-card p{margin:10px 0 0;color:var(--predict-muted);font-size:13px;line-height:1.6}.pick-briefing{max-width:1080px;margin:0 auto 16px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.pick-briefing article{position:relative;overflow:hidden;border:1px solid rgba(79,124,255,.11);border-radius:22px;padding:16px;background:rgba(255,255,255,.78);box-shadow:0 12px 36px rgba(55,90,170,.08)}.pick-briefing span{display:inline-flex;width:30px;height:30px;align-items:center;justify-content:center;border-radius:12px;background:rgba(79,124,255,.1);color:var(--predict-main);font-size:12px;font-weight:1000}.pick-briefing b{display:block;margin-top:10px;font-size:15px}.pick-briefing p{margin:4px 0 0;color:var(--predict-muted);font-size:13px;line-height:1.55}.upgraded-list-mode{max-width:1080px;padding:10px 0 0}.list-section-head{align-items:end}.list-section-head p{margin:0;color:var(--predict-muted);font-size:13px;line-height:1.5}.upgraded-board-list{grid-template-columns:repeat(3,1fr);gap:14px}.upgraded-board-card{position:relative;min-height:250px;padding:18px;border-radius:28px;background:rgba(255,255,255,.9);box-shadow:0 18px 54px rgba(55,90,170,.11);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.upgraded-board-card:hover{transform:translateY(-3px);box-shadow:0 24px 70px rgba(55,90,170,.18);border-color:rgba(79,124,255,.28)}.board-rank{position:absolute;right:16px;top:14px;font-size:38px;font-weight:1000;line-height:1;color:rgba(79,124,255,.12)}.upgraded-board-card h3{position:relative;margin-top:18px;font-size:22px;letter-spacing:-.055em}.upgraded-board-card p{font-size:13px;line-height:1.65}.board-mini-tags{display:flex;flex-wrap:wrap;gap:7px;margin-top:auto;padding-top:14px}.board-mini-tags span{display:inline-flex;padding:7px 9px;border-radius:999px;background:rgba(79,124,255,.08);color:var(--predict-main);font-size:11px;font-weight:900}.board-card-cta{display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding:12px 13px;border-radius:16px;background:linear-gradient(135deg,#4f7cff,#7c5cff);color:#fff}.board-card-cta b{font-size:13px}.board-card-cta span{font-size:20px;line-height:1}.upgraded-board-card .board-meta{display:none}@media(max-width:900px){.predict-list-hero{grid-template-columns:1fr}.list-back{width:40px}.pick-briefing,.upgraded-board-list{grid-template-columns:1fr}.list-section-head{align-items:flex-start;flex-direction:column}.list-hero-copy{padding:26px}.list-wallet-card{padding:18px}.upgraded-board-card{min-height:auto}}
    [data-theme="dark"] .list-wallet-card,[data-theme="dark"] .pick-briefing article,[data-theme="dark"] .upgraded-board-card{background:rgba(16,23,34,.88);box-shadow:none}
  `;
  document.head.appendChild(style);
}

function injectDetailStyle() {
  if (document.getElementById('sosoking-predict-detail-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-predict-detail-style';
  style.textContent = `
    .simple-page { padding:16px 16px 92px; }.simple-header { max-width:980px; margin:0 auto 18px; display:grid; grid-template-columns:44px 1fr auto; align-items:center; gap:12px; }.back-link { width:40px; height:40px; border-radius:14px; display:flex; align-items:center; justify-content:center; background:var(--predict-card); border:1px solid var(--predict-line); color:var(--predict-ink); text-decoration:none; font-size:28px; }.simple-header span { color:var(--predict-main); font-size:10px; font-weight:1000; letter-spacing:.14em; }.simple-header h1 { margin:3px 0 0; font-size:22px; letter-spacing:-.04em; }.simple-header > b { color:var(--predict-money); font-size:15px; }.list-mode { padding-top:0; }.detail-layout { max-width:980px; margin:0 auto; display:grid; grid-template-columns:1fr 340px; gap:14px; }.detail-main-card,.prediction-panel,.comments-section{border:1px solid var(--predict-line);border-radius:24px;padding:18px;background:var(--predict-card)}.heat-row{display:flex;justify-content:space-between;color:var(--predict-muted);font-size:12px;font-weight:900;margin-bottom:14px}.detail-main-card h2{margin:0;font-size:28px;letter-spacing:-.05em;line-height:1.25}.detail-main-card p{color:var(--predict-muted);line-height:1.7}.result-box{margin:12px 0;border-radius:16px;padding:13px;background:rgba(22,163,106,.1);border:1px solid rgba(22,163,106,.2)}.result-box b{display:block;color:var(--predict-money);font-size:12px;margin-bottom:4px}.result-box span{color:var(--predict-muted);font-size:13px}.issue-box{border-radius:16px;padding:14px;background:rgba(79,124,255,.08);border:1px solid rgba(79,124,255,.16)}.issue-box b{display:block;color:var(--predict-main);font-size:12px;margin-bottom:5px}.issue-box span{color:var(--predict-muted);font-size:13px;line-height:1.6}.mood-panel{margin:14px 0;padding:14px;border-radius:20px;background:linear-gradient(135deg,rgba(79,124,255,.10),rgba(255,92,138,.08));border:1px solid rgba(79,124,255,.14)}.mood-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.mood-head b{font-size:14px}.mood-head span{font-size:12px;color:var(--predict-hot);font-weight:900}.mood-bars{display:grid;gap:9px}.mood-bars div{position:relative;overflow:hidden;border-radius:14px;padding:10px;background:rgba(255,255,255,.68)}.mood-bars span{font-size:12px;color:var(--predict-muted);font-weight:900}.mood-bars b{float:right;font-size:12px}.mood-bars i{display:block;clear:both;height:7px;width:var(--w);margin-top:8px;border-radius:999px;background:linear-gradient(90deg,#4f7cff,#ff5c8a)}.ai-pick{margin-top:10px;padding:12px;border-radius:16px;background:var(--predict-card)}.ai-pick b{display:block;color:var(--predict-main);font-size:12px}.ai-pick span{display:block;font-weight:1000;margin-top:3px}.ai-pick small{display:block;color:var(--predict-muted);font-size:11px;margin-top:4px}.rule-grid{display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:8px;margin-top:12px}.rule-grid div{padding:12px;border-radius:14px;border:1px solid var(--predict-line)}.rule-grid b{display:block;font-size:11px;color:var(--predict-main);margin-bottom:4px}.rule-grid span{color:var(--predict-muted);font-size:12px;line-height:1.5}.panel-title{font-weight:1000;color:var(--predict-ink);margin-bottom:5px}.panel-help{margin:0 0 12px;color:var(--predict-muted);font-size:12px;line-height:1.55}.comment-guide{margin:5px 0 0;color:var(--predict-muted);font-size:12px;line-height:1.55}.option-list{display:grid;gap:8px}.option-card{display:flex;gap:9px;align-items:center;padding:12px;border:1px solid var(--predict-line);border-radius:16px;cursor:pointer}.option-card b{display:block}.option-card small{color:var(--predict-muted)}.input-label{display:block;margin:14px 0 6px;color:var(--predict-muted);font-size:12px;font-weight:900}.prediction-form select,.prediction-form textarea,.comment-form input{width:100%;box-sizing:border-box;border:1px solid var(--predict-line);border-radius:14px;background:var(--predict-bg);color:var(--predict-ink);padding:12px;font-family:inherit}.prediction-form textarea{min-height:88px;resize:vertical}.submit-prediction,.comment-form button{width:100%;border:0;border-radius:16px;padding:14px;margin-top:12px;background:linear-gradient(135deg,var(--predict-main),#2f5cff);color:#fff;font-weight:1000;cursor:pointer}.money-note{color:var(--predict-muted);font-size:11px;line-height:1.5}.prediction-done{text-align:center}.done-icon{font-size:42px}.prediction-done h3{margin:8px 0}.prediction-done p,.prediction-done span{color:var(--predict-muted);line-height:1.6}.prediction-done blockquote{margin:12px 0;padding:12px;border-radius:14px;background:var(--predict-bg);color:var(--predict-ink)}.comments-section{max-width:980px;margin:14px auto 0}.compact{margin-bottom:12px}.comment-form{display:grid;grid-template-columns:1fr 96px;gap:8px;margin-bottom:12px}.comment-form button{margin:0}.comment-list{display:grid;gap:8px}.comment-item{padding:12px;border:1px solid var(--predict-line);border-radius:15px;background:var(--predict-bg)}.comment-item.mine{border-color:rgba(79,124,255,.34)}.comment-item b{color:var(--predict-main);font-size:12px}.comment-item p{margin:5px 0;color:var(--predict-ink);font-size:13px;line-height:1.5}.comment-item small{color:var(--predict-muted)}@media(max-width:820px){.detail-layout{grid-template-columns:1fr}.rule-grid{grid-template-columns:1fr}.comment-form{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function escapeAttr(s) { return escapeHtml(s).replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function escapeHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
