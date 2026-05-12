import { getMySummary } from '../predict/prediction-engine.js';
import { injectPredictStyle } from './predict-home.js';

export function renderPredictHistory(container) {
  injectPredictStyle();
  addStyle();
  const s = getMySummary();
  const items = s.predictions || [];
  container.innerHTML = `
    <main class="predict-app history-page">
      <div class="simple-header history-header">
        <a href="#/" class="back-link">‹</a>
        <div><span>MY LOG</span><h1>내 예측 기록</h1></div>
        <b>${s.wallet.balance.toLocaleString()}</b>
      </div>
      <section class="history-summary">
        <div><span>보유 포인트</span><strong>${s.wallet.balance.toLocaleString()}</strong></div>
        <div><span>대기중</span><strong>${s.openCount}</strong></div>
        <div><span>총 참여</span><strong>${s.totalPredictions}</strong></div>
      </section>
      <section class="history-list">
        ${items.length ? items.map(card).join('') : `<div class="history-empty"><div>🔮</div><h2>기록이 없습니다</h2><p>오늘의 예측판에 참여해보세요.</p><a href="#/predict">예측판 보기</a></div>`}
      </section>
    </main>`;
}

function card(item) {
  const state = item.settled ? (item.won ? '맞힘' : '틀림') : '결과 대기';
  const icon = item.settled ? (item.won ? '🎯' : '🫠') : '⏳';
  return `
    <article class="history-card">
      <div class="history-icon">${icon}</div>
      <div class="history-body">
        <b>${escapeHtml(item.optionLabel || '선택 완료')}</b>
        <span>${state} · 사용 ${Number(item.amount || 0).toLocaleString()}</span>
        ${item.comment ? `<p>${escapeHtml(item.comment)}</p>` : ''}
      </div>
    </article>`;
}

function addStyle() {
  if (document.getElementById('sosoking-history-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-history-style';
  style.textContent = `
    .history-page{padding:16px 16px 92px}.history-header,.history-summary,.history-list{max-width:820px;margin-left:auto;margin-right:auto}.history-summary{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:10px;margin-bottom:14px}.history-summary div,.history-card,.history-empty{border:1px solid var(--predict-line);border-radius:20px;background:var(--predict-card)}.history-summary div{padding:16px}.history-summary span{display:block;color:var(--predict-muted);font-size:11px;font-weight:900;margin-bottom:5px}.history-summary strong{font-size:20px}.history-list{display:grid;gap:10px}.history-card{display:grid;grid-template-columns:44px 1fr;gap:12px;align-items:center;padding:14px}.history-icon{width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:14px;background:var(--predict-bg);font-size:20px}.history-body b{display:block;font-size:15px}.history-body span,.history-body p{color:var(--predict-muted);font-size:13px;line-height:1.5}.history-body p{margin:7px 0 0}.history-empty{text-align:center;padding:34px 18px}.history-empty div{font-size:44px}.history-empty p{color:var(--predict-muted)}.history-empty a{display:inline-block;margin-top:12px;padding:13px 18px;border-radius:16px;background:var(--predict-main);color:#fff;text-decoration:none;font-weight:900}@media(max-width:640px){.history-summary{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function escapeHtml(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
