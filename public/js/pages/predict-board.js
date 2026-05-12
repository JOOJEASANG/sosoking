import { getBoards, getBoard, getWallet, getPrediction, placePrediction, getComments, addComment } from '../predict/prediction-engine.js';
import { injectPredictStyle } from './predict-home.js';

export function renderPredictList(container) {
  injectPredictStyle();
  const boards = getBoards();
  const wallet = getWallet();
  container.innerHTML = `
    <main class="predict-app simple-page">
      <div class="simple-header">
        <a href="#/" class="back-link">‹</a>
        <div><span>오늘의 예측판</span><h1>핫이슈의 내일을 맞혀라</h1></div>
        <b>${wallet.balance.toLocaleString()}</b>
      </div>
      <section class="board-preview-section list-mode">
        <div class="board-list">
          ${boards.map(board => boardCard(board)).join('')}
        </div>
      </section>
    </main>`;
}

export function renderPredictDetail(container, boardId) {
  injectPredictStyle();
  injectDetailStyle();
  const board = getBoard(boardId);
  const wallet = getWallet();
  const existing = getPrediction(board.id);
  const comments = getComments(board.id);
  container.innerHTML = `
    <main class="predict-app simple-page">
      <div class="simple-header">
        <a href="#/predict" class="back-link">‹</a>
        <div><span>${board.category}</span><h1>${board.title}</h1></div>
        <b>${wallet.balance.toLocaleString()}</b>
      </div>
      <section class="detail-layout">
        <article class="detail-main-card">
          <div class="heat-row"><span>🔥 핫이슈 점수 ${board.heat}</span><span>참여 ${board.participants.toLocaleString()}</span></div>
          <h2>${board.question}</h2>
          <p>${board.summary}</p>
          <div class="issue-box"><b>AI 요약</b><span>${board.aiComment}</span></div>
          <div class="rule-grid">
            <div><b>마감</b><span>${board.closeAt}</span></div>
            <div><b>정산</b><span>${board.resultAt}</span></div>
            <div><b>기준</b><span>${board.resultRule}</span></div>
          </div>
        </article>

        <aside class="prediction-panel">
          ${existing ? renderExisting(existing) : renderForm(board)}
        </aside>
      </section>

      <section class="comments-section">
        <div class="section-head compact"><div><span>COMMENTS</span><h2>예측 근거</h2></div></div>
        <form id="comment-form" class="comment-form">
          <input id="comment-input" maxlength="120" placeholder="내 생각엔 이쪽이 맞을 것 같은데..." />
          <button>등록</button>
        </form>
        <div class="comment-list">
          ${comments.map(c => `<div class="comment-item ${c.mine ? 'mine' : ''}"><b>${c.side}</b><p>${escapeHtml(c.text)}</p><small>좋아요 ${c.likes}</small></div>`).join('')}
        </div>
      </section>
    </main>`;

  document.getElementById('prediction-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const optionId = document.querySelector('input[name="predict-option"]:checked')?.value;
    const amount = document.getElementById('predict-amount')?.value;
    const comment = document.getElementById('predict-comment')?.value;
    try {
      placePrediction({ boardId: board.id, optionId, amount, comment });
      renderPredictDetail(container, board.id);
    } catch (error) {
      alert(error.message || '예측 등록에 실패했습니다.');
    }
  });

  document.getElementById('comment-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('comment-input');
    addComment(board.id, input.value, '내 의견', true);
    renderPredictDetail(container, board.id);
  });
}

function renderForm(board) {
  return `
    <form id="prediction-form" class="prediction-form">
      <div class="panel-title">내 예측 선택</div>
      <div class="option-list">
        ${board.options.map((option, index) => `
          <label class="option-card">
            <input type="radio" name="predict-option" value="${option.id}" ${index === 0 ? 'checked' : ''}>
            <span><b>${option.label}</b><small>예상 배율 x${option.odds}</small></span>
          </label>`).join('')}
      </div>
      <label class="input-label">사용할 소소머니</label>
      <select id="predict-amount">
        <option value="500">500</option>
        <option value="1000" selected>1,000</option>
        <option value="3000">3,000</option>
        <option value="5000">5,000</option>
      </select>
      <label class="input-label">내 근거 한마디</label>
      <textarea id="predict-comment" maxlength="120" placeholder="왜 그렇게 생각하는지 짧게 남겨보세요."></textarea>
      <button class="submit-prediction">예측 등록하기</button>
      <p class="money-note">소소머니는 게임 전용 포인트이며 현금 가치가 없습니다.</p>
    </form>`;
}

function renderExisting(prediction) {
  return `
    <div class="prediction-done">
      <div class="done-icon">✅</div>
      <h3>예측 완료</h3>
      <p><b>${prediction.optionLabel}</b>에 ${prediction.amount.toLocaleString()} 소소머니를 사용했습니다.</p>
      ${prediction.comment ? `<blockquote>${escapeHtml(prediction.comment)}</blockquote>` : ''}
      <span>정산 전까지 결과를 기다려주세요.</span>
    </div>`;
}

function boardCard(board) {
  return `
    <a class="board-card" href="#/predict/${board.id}">
      <div class="board-card-top"><span>${board.category}</span><b>🔥 ${board.heat}</b></div>
      <h3>${board.title}</h3>
      <p>${board.summary}</p>
      <div class="board-meta"><span>참여 ${board.participants.toLocaleString()}</span><span>마감 ${board.closeAt}</span></div>
    </a>`;
}

function injectDetailStyle() {
  if (document.getElementById('sosoking-predict-detail-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-predict-detail-style';
  style.textContent = `
    .simple-page { padding:16px 16px 92px; }
    .simple-header { max-width:980px; margin:0 auto 18px; display:grid; grid-template-columns:44px 1fr auto; align-items:center; gap:12px; }
    .back-link { width:40px; height:40px; border-radius:14px; display:flex; align-items:center; justify-content:center; background:var(--predict-card); border:1px solid var(--predict-line); color:var(--predict-ink); text-decoration:none; font-size:28px; }
    .simple-header span { color:var(--predict-main); font-size:10px; font-weight:1000; letter-spacing:.14em; }
    .simple-header h1 { margin:3px 0 0; font-size:22px; letter-spacing:-.04em; }
    .simple-header > b { color:var(--predict-money); font-size:15px; }
    .list-mode { padding-top:0; }
    .detail-layout { max-width:980px; margin:0 auto; display:grid; grid-template-columns:1fr 340px; gap:14px; }
    .detail-main-card, .prediction-panel, .comments-section { border:1px solid var(--predict-line); border-radius:24px; padding:18px; background:var(--predict-card); }
    .heat-row { display:flex; justify-content:space-between; color:var(--predict-muted); font-size:12px; font-weight:900; margin-bottom:14px; }
    .detail-main-card h2 { margin:0; font-size:28px; letter-spacing:-.05em; line-height:1.25; }
    .detail-main-card p { color:var(--predict-muted); line-height:1.7; }
    .issue-box { border-radius:16px; padding:14px; background:rgba(79,124,255,.08); border:1px solid rgba(79,124,255,.16); }
    .issue-box b { display:block; color:var(--predict-main); font-size:12px; margin-bottom:5px; }
    .issue-box span { color:var(--predict-muted); font-size:13px; line-height:1.6; }
    .rule-grid { display:grid; grid-template-columns:1fr 1fr 1.4fr; gap:8px; margin-top:12px; }
    .rule-grid div { padding:12px; border-radius:14px; border:1px solid var(--predict-line); }
    .rule-grid b { display:block; font-size:11px; color:var(--predict-main); margin-bottom:4px; }
    .rule-grid span { color:var(--predict-muted); font-size:12px; line-height:1.5; }
    .panel-title { font-weight:1000; color:var(--predict-ink); margin-bottom:12px; }
    .option-list { display:grid; gap:8px; }
    .option-card { display:flex; gap:9px; align-items:center; padding:12px; border:1px solid var(--predict-line); border-radius:16px; cursor:pointer; }
    .option-card b { display:block; } .option-card small { color:var(--predict-muted); }
    .input-label { display:block; margin:14px 0 6px; color:var(--predict-muted); font-size:12px; font-weight:900; }
    .prediction-form select, .prediction-form textarea, .comment-form input { width:100%; box-sizing:border-box; border:1px solid var(--predict-line); border-radius:14px; background:var(--predict-bg); color:var(--predict-ink); padding:12px; font-family:inherit; }
    .prediction-form textarea { min-height:88px; resize:vertical; }
    .submit-prediction, .comment-form button { width:100%; border:0; border-radius:16px; padding:14px; margin-top:12px; background:linear-gradient(135deg,var(--predict-main),#2f5cff); color:#fff; font-weight:1000; cursor:pointer; }
    .money-note { color:var(--predict-muted); font-size:11px; line-height:1.5; }
    .prediction-done { text-align:center; } .done-icon { font-size:42px; } .prediction-done h3 { margin:8px 0; } .prediction-done p, .prediction-done span { color:var(--predict-muted); line-height:1.6; } .prediction-done blockquote { margin:12px 0; padding:12px; border-radius:14px; background:var(--predict-bg); color:var(--predict-ink); }
    .comments-section { max-width:980px; margin:14px auto 0; }
    .compact { margin-bottom:12px; }
    .comment-form { display:grid; grid-template-columns:1fr 96px; gap:8px; margin-bottom:12px; }
    .comment-form button { margin:0; }
    .comment-list { display:grid; gap:8px; }
    .comment-item { padding:12px; border:1px solid var(--predict-line); border-radius:15px; background:var(--predict-bg); }
    .comment-item.mine { border-color:rgba(79,124,255,.34); }
    .comment-item b { color:var(--predict-main); font-size:12px; } .comment-item p { margin:5px 0; color:var(--predict-ink); font-size:13px; line-height:1.5; } .comment-item small { color:var(--predict-muted); }
    @media(max-width:820px){ .detail-layout{grid-template-columns:1fr;} .rule-grid{grid-template-columns:1fr;} .comment-form{grid-template-columns:1fr;} }
  `;
  document.head.appendChild(style);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
