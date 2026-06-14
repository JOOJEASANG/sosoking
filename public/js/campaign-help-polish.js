// campaign-help-polish.js
// 홈의 유세 활동 카드가 무엇을 의미하는지 쉽게 이해되도록 설명과 진행 상태를 보강합니다.
import './party-detail-polish.js';
import './account-republic-polish.js';

function currentPath() {
  const hashPath = (window.location.hash.slice(1) || '').split('?')[0];
  if (hashPath && hashPath !== '/') return hashPath;
  return window.location.pathname || '/';
}

function ensureStyle() {
  if (document.getElementById('campaign-help-polish-style')) return;
  const style = document.createElement('style');
  style.id = 'campaign-help-polish-style';
  style.textContent = `
    .home-campaign-card.campaign-help-ready{position:relative;overflow:hidden;border-radius:22px!important;border:1px solid rgba(255,107,74,.18)!important;background:linear-gradient(135deg,#fff,rgba(255,247,237,.94))!important;box-shadow:0 12px 28px rgba(15,23,42,.08)!important}
    .campaign-help-box{margin:10px 0 0;padding:11px 12px;border-radius:16px;background:rgba(255,255,255,.78);border:1px solid rgba(100,116,139,.14);display:grid;gap:9px}
    .campaign-help-box__title{font-size:12px;font-weight:1000;color:var(--color-text-primary);display:flex;align-items:center;gap:5px}
    .campaign-help-box__desc{font-size:12px;line-height:1.5;color:var(--color-text-secondary)}
    .campaign-help-box__grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
    .campaign-help-box__item{border-radius:13px;background:rgba(248,250,252,.92);border:1px solid rgba(100,116,139,.1);padding:8px;text-align:center}
    .campaign-help-box__item span{display:block;font-size:10px;font-weight:900;color:var(--color-text-secondary);margin-bottom:2px}
    .campaign-help-box__item b{display:block;font-size:13px;font-weight:1000;color:var(--color-text-primary)}
    .campaign-help-warning{font-size:11px;line-height:1.45;color:#9a3412;background:rgba(255,237,213,.72);border-radius:12px;padding:8px 9px}
    .home-campaign-card__sub{line-height:1.35!important}
    .home-campaign-card__desc{display:block!important;line-height:1.45!important}
    .home-campaign-btn:not(.home-campaign-btn--disabled){box-shadow:0 8px 18px rgba(255,107,74,.2)!important}
    @media(max-width:520px){.campaign-help-box__grid{grid-template-columns:1fr}.campaign-help-box__item{text-align:left}}
  `;
  document.head.appendChild(style);
}

function textNumber(text, fallback = 0) {
  const match = String(text || '').match(/(\d+)/);
  return match ? Number(match[1]) : fallback;
}

function polishCampaignCard() {
  if (currentPath() !== '/') return;
  const card = document.querySelector('.home-campaign-card');
  if (!card || card.dataset.campaignHelpReady === '1') return;

  ensureStyle();
  card.dataset.campaignHelpReady = '1';
  card.classList.add('campaign-help-ready');

  const sub = card.querySelector('.home-campaign-card__sub');
  const desc = card.querySelector('.home-campaign-card__desc');
  const btn = card.querySelector('#home-campaign-btn');
  const done = card.querySelectorAll('.home-campaign-pip--done').length;
  const total = card.querySelectorAll('.home-campaign-pip').length || 3;
  const remaining = Math.max(0, total - done);
  const descText = desc?.textContent || '';
  const cost = textNumber(descText, 20);
  const boostMatch = descText.match(/\+(\d+)/);
  const boost = boostMatch ? Number(boostMatch[1]) : 15;

  if (sub) {
    sub.textContent = '내 포인트를 써서 내 정당의 세력을 올리는 활동입니다.';
  }
  if (desc) {
    desc.innerHTML = `내 개인 정치력은 쓰이고, <b>정당 세력은 +${boost}P</b> 올라갑니다. 하루 최대 ${total}번.`;
  }
  if (btn && !btn.disabled) {
    btn.textContent = `유세하기 ${remaining}/${total} 남음 · -${cost}P`;
    btn.setAttribute('aria-label', `유세하기. ${cost}포인트를 사용해 정당 세력을 ${boost} 올립니다. 오늘 ${remaining}번 남았습니다.`);
  }

  const help = document.createElement('div');
  help.className = 'campaign-help-box';
  help.innerHTML = `
    <div class="campaign-help-box__title">🎤 유세하기란?</div>
    <div class="campaign-help-box__desc">내 정당을 시민들에게 홍보하는 행동입니다. 대선 후보를 직접 뽑는 투표와 다르게, 유세는 <b>내 정당 전체의 세력</b>을 밀어 올립니다.</div>
    <div class="campaign-help-box__grid">
      <div class="campaign-help-box__item"><span>소모</span><b>내 포인트 -${cost}P</b></div>
      <div class="campaign-help-box__item"><span>효과</span><b>정당 세력 +${boost}P</b></div>
      <div class="campaign-help-box__item"><span>횟수</span><b>오늘 ${remaining}/${total} 남음</b></div>
    </div>
    <div class="campaign-help-warning">정리하면, 유세는 “나 개인 점수 올리기”가 아니라 “내 정당 밀어주기”입니다. 정당 세력이 오르면 정당 순위와 대선 분위기에 영향을 줍니다.</div>`;
  card.appendChild(help);
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(polishCampaignCard, 120);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('popstate', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);

function observe() {
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', observe, { once: true });
    return;
  }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
}

observe();
