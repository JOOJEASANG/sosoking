// republic-polish.js
// 가상현실 정치게임 몰입을 깨는 일반 AI 도구식 문구를 공화국 세계관 문구로 보정합니다.

import { runRepublicGameFlow } from './republic-game-flow.js';

function replaceTextNode(root, from, to) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    if (node.nodeValue && node.nodeValue.includes(from)) {
      node.nodeValue = node.nodeValue.split(from).join(to);
    }
  });
}

function polishGlobalCopy() {
  replaceTextNode(document.body, '⚖️ 판결소', '📮 국민신문고');
  replaceTextNode(document.body, '판결소', '국민신문고');
  replaceTextNode(document.body, 'AI킹', '대통령실');
  replaceTextNode(document.body, '7인 AI 정치인의 가상 정치 드라마', '소소공화국 가상 정치 시뮬레이션');
}

function enhanceImpeachmentCopy() {
  const text = document.body.innerText || '';
  if (!text.includes('탄핵') && !text.includes('불신임')) return;

  replaceTextNode(document.body, '불신임 투표', '국회 탄핵소추 표결');
  replaceTextNode(document.body, '불신임', '탄핵소추');
  replaceTextNode(document.body, '청원', '탄핵 청원');

  document.querySelectorAll('button, a, .btn').forEach(el => {
    const label = (el.textContent || '').trim();
    if (label.includes('탄핵') || label.includes('소추')) {
      el.setAttribute('title', '국회 탄핵소추가 가결되면 헌법재판소 심판 단계로 넘어갑니다');
    }
  });
}

function addConstitutionalCourtNotice() {
  const path = (window.location.hash.slice(1).split('?')[0] || '/');
  if (path !== '/constitutional-court' && path !== '/congress') return;

  const page = document.getElementById('page-content');
  if (!page || document.getElementById('constitutional-court-notice')) return;

  const target = page.querySelector('section, .card');
  if (!target) return;

  const notice = document.createElement('div');
  notice.id = 'constitutional-court-notice';
  notice.style.cssText = 'margin:12px 0;padding:14px;border-radius:16px;border:1px solid rgba(100,116,139,.25);background:rgba(15,23,42,.04);font-size:13px;line-height:1.55;color:var(--color-text-secondary)';
  notice.innerHTML = '<b style="color:var(--color-text-primary)">🏛️ 헌법재판소는 탄핵 전용 기관입니다.</b><br>국회 탄핵소추 표결이 통과되면 헌법재판소 심판으로 넘어가고, 인용 시 대통령은 파면되며 조기 대선 국면으로 전환됩니다.';
  target.parentNode.insertBefore(notice, target.nextSibling);
}

function runPolish() {
  polishGlobalCopy();
  enhanceImpeachmentCopy();
  addConstitutionalCourtNotice();
  runRepublicGameFlow();
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(runPolish, 120);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('popstate', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
schedule();
