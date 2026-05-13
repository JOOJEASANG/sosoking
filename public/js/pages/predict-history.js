import { getMySummary } from '../predict/prediction-engine.js';
import { injectPredictStyle } from './predict-home.js';

export function renderPredictHistory(container) {
  injectPredictStyle();
  addStyle();
  const s = getMySummary();
  const items = s.predictions || [];
  const wins = items.filter(x => x.settled && x.won).length;
  const settled = items.filter(x => x.settled).length;
  const rate = settled ? Math.round((wins / settled) * 100) : 0;
  container.innerHTML = `
    <main class="predict-app history-page">
      <div class="simple-header history-header"><a href="#/" class="back-link">‹</a><div><span>MY SOSO PROFILE</span><h1>내 예측 프로필</h1></div><b>${s.wallet.balance.toLocaleString()}</b></div>
      <section class="profile-hero"><div class="profile-avatar">🔮</div><div><span>현재 칭호</span><h2>${escapeHtml(s.wallet.title)}</h2><p>오늘의 촉을 기록하고, 연속 적중과 배지를 모아보세요.</p></div><a href="#/predict">예측하기</a></section>
      <section class="history-summary"><div><span>보유 포인트</span><strong>${s.wallet.balance.toLocaleString()}</strong></div><div><span>대기중</span><strong>${s.openCount}</strong></div><div><span>총 참여</span><strong>${s.totalPredictions}</strong></div><div><span>적중률</span><strong>${rate}%</strong></div></section>
      <section class="badge-row"><div><b>🎯 첫 적중</b><span>${wins ? '획득' : '도전중'}</span></div><div><b>💬 근거 작성</b><span>${items.some(x=>x.comment) ? '획득' : '도전중'}</span></div><div><b>🔥 핫판 참여</b><span>${items.length ? '획득' : '도전중'}</span></div></section>
      <section class="history-list">${items.length ? items.map(card).join('') : empty()}</section>
    </main>`;
}

function card(item) {
  const state = item.settled ? (item.won ? '맞힘' : '틀림') : '결과 대기';
  const icon = item.settled ? (item.won ? '🎯' : '🫠') : '⏳';
  return `<article class="history-card ${item.won ? 'win' : ''}"><div class="history-icon">${icon}</div><div class="history-body"><b>${escapeHtml(item.optionLabel || '선택 완료')}</b><span>${state} · 사용 ${Number(item.amount || 0).toLocaleString()}</span>${item.comment ? `<p>${escapeHtml(item.comment)}</p>` : ''}</div></article>`;
}

function empty() { return `<div class="history-empty"><div>🔮</div><h2>아직 기록이 없습니다</h2><p>첫 예측을 남기면 내 프로필이 채워집니다.</p><a href="#/predict">예측판 보기</a></div>`; }

function addStyle() {
  if (document.getElementById('sosoking-history-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-history-style';
  style.textContent = `
    .history-page{padding:16px 16px 92px}.history-header,.profile-hero,.history-summary,.badge-row,.history-list{max-width:860px;margin-left:auto;margin-right:auto}.profile-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:72px 1fr auto;gap:14px;align-items:center;margin-bottom:14px;padding:20px;border-radius:28px;background:linear-gradient(135deg,#101b3c,#4f7cff 62%,#7c5cff);color:#fff;box-shadow:0 24px 70px rgba(79,124,255,.20)}.profile-hero:after{content:'✨';position:absolute;right:22px;top:10px;font-size:70px;opacity:.12}.profile-avatar{width:68px;height:68px;display:flex;align-items:center;justify-content:center;border-radius:24px;background:rgba(255,255,255,.16);font-size:34px}.profile-hero span{font-size:11px;font-weight:1000;letter-spacing:.12em;color:rgba(255,255,255,.70)}.profile-hero h2{margin:4px 0 5px;font-size:25px;letter-spacing:-.05em}.profile-hero p{margin:0;color:rgba(255,255,255,.75);line-height:1.55}.profile-hero a{position:relative;z-index:2;padding:13px 16px;border-radius:16px;background:#fff;color:#17245f;text-decoration:none;font-weight:1000}.history-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}.history-summary div,.history-card,.history-empty,.badge-row div{border:1px solid var(--predict-line);border-radius:20px;background:rgba(255,255,255,.88);box-shadow:0 18px 54px rgba(55,90,170,.10)}.history-summary div{padding:16px}.history-summary span,.badge-row span{display:block;color:var(--predict-muted);font-size:11px;font-weight:900;margin-bottom:5px}.history-summary strong{font-size:20px}.badge-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}.badge-row div{padding:14px}.badge-row b{display:block;font-size:14px}.history-list{display:grid;gap:10px}.history-card{display:grid;grid-template-columns:48px 1fr;gap:12px;align-items:center;padding:14px}.history-card.win{background:linear-gradient(135deg,rgba(255,197,66,.22),rgba(255,255,255,.9))}.history-icon{width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:16px;background:var(--predict-bg);font-size:21px}.history-body b{display:block;font-size:15px}.history-body span,.history-body p{color:var(--predict-muted);font-size:13px;line-height:1.5}.history-body p{margin:7px 0 0}.history-empty{text-align:center;padding:34px 18px}.history-empty div{font-size:44px}.history-empty p{color:var(--predict-muted)}.history-empty a{display:inline-block;margin-top:12px;padding:13px 18px;border-radius:16px;background:var(--predict-main);color:#fff;text-decoration:none;font-weight:900}@media(max-width:720px){.profile-hero{grid-template-columns:56px 1fr}.profile-hero a{grid-column:2}.profile-avatar{width:56px;height:56px}.history-summary,.badge-row{grid-template-columns:1fr 1fr}}@media(max-width:480px){.history-summary,.badge-row{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function escapeHtml(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
