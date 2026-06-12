// three-party-ui.js
// 화면 노출을 3당 체제로 정리합니다. 기존 데이터는 보존하고, 사용자에게 보이는 정당 구도만 핵심 3당 중심으로 다듬습니다.

const CORE_PARTY_IDS = new Set(['national', 'youth', 'center']);
const CORE_PARTY_NAMES = ['국민안정당', '청년혁명당', '중도민주당'];
const LEGACY_PARTY_NAMES = ['진실방송당', '함께미래당', '알권리당', '법치정의당'];

let timer = null;
let observer = null;

function currentPath() {
  const hashPath = (window.location.hash.slice(1) || '').split('?')[0];
  if (hashPath && hashPath !== '/') return hashPath;
  return window.location.pathname || '/';
}

function isLegacyPartyText(text) {
  return LEGACY_PARTY_NAMES.some(name => String(text || '').includes(name));
}

function hideLegacyPartyCards() {
  if (!['/parties', '/election', '/ranking', '/'].includes(currentPath())) return;
  const selectors = [
    '[data-party-id]',
    '[data-party]',
    '.party-card',
    '.party-list-card',
    '.party-rank-card',
    '.election-candidate-card',
    '.candidate-card',
  ];
  document.querySelectorAll(selectors.join(',')).forEach(el => {
    const partyId = el.dataset?.partyId || el.dataset?.party || '';
    const text = el.textContent || '';
    if ((partyId && !CORE_PARTY_IDS.has(partyId)) || isLegacyPartyText(text)) {
      el.style.display = 'none';
      el.setAttribute('data-three-party-hidden', 'true');
    }
  });
}

function addThreePartyNotice() {
  if (currentPath() !== '/parties') return;
  const page = document.getElementById('page-content');
  if (!page || document.getElementById('three-party-notice')) return;
  const anchor = page.querySelector('.parties-page') || page.firstElementChild;
  if (!anchor) return;

  const notice = document.createElement('section');
  notice.id = 'three-party-notice';
  notice.style.cssText = 'margin:0 0 16px;padding:16px;border-radius:20px;background:linear-gradient(135deg,rgba(59,130,246,.12),rgba(255,255,255,.8));border:1px solid rgba(100,116,139,.22);box-shadow:0 10px 26px rgba(15,23,42,.06)';
  notice.innerHTML = `
    <div style="font-size:13px;font-weight:900;color:var(--color-text-muted);margin-bottom:4px">🏛️ 소소공화국 3당 체제</div>
    <div style="font-size:19px;font-weight:1000;color:var(--color-text-primary)">국민안정당 · 청년혁명당 · 중도민주당</div>
    <div style="font-size:13px;color:var(--color-text-secondary);margin-top:6px;line-height:1.55">정당 경쟁은 3개 핵심 정당 중심으로 운영됩니다. 여당·제1야당·캐스팅보트 구도가 대선, 정당전, 소소신문에 반영됩니다.</div>
  `;
  anchor.parentNode.insertBefore(notice, anchor);
}

function addElectionNotice() {
  if (currentPath() !== '/election') return;
  const page = document.getElementById('page-content');
  if (!page || document.getElementById('three-party-election-notice')) return;
  const first = page.firstElementChild;
  if (!first) return;
  const notice = document.createElement('section');
  notice.id = 'three-party-election-notice';
  notice.style.cssText = 'margin:0 0 14px;padding:14px;border-radius:18px;background:rgba(15,23,42,.04);border:1px solid var(--color-border);font-size:13px;line-height:1.55;color:var(--color-text-secondary)';
  notice.innerHTML = '<b style="color:var(--color-text-primary)">🗳️ 대선은 3당 후보 구도 중심으로 진행됩니다.</b><br>국민안정당·청년혁명당·중도민주당의 당대표 또는 대표 후보가 대통령 자리를 두고 경쟁합니다.';
  page.insertBefore(notice, first);
}

function relabelLegacyMentions() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    let text = node.nodeValue || '';
    text = text.replaceAll('진실방송당', '청년혁명당');
    text = text.replaceAll('함께미래당', '중도민주당');
    text = text.replaceAll('알권리당', '중도민주당');
    text = text.replaceAll('법치정의당', '국민안정당');
    node.nodeValue = text;
  });
}

function run() {
  addThreePartyNotice();
  addElectionNotice();
  hideLegacyPartyCards();
  relabelLegacyMentions();
}

function schedule(delay = 150) {
  clearTimeout(timer);
  timer = setTimeout(run, delay);
}

function observe() {
  if (observer) return;
  observer = new MutationObserver(() => schedule(120));
  observer.observe(document.body, { childList: true, subtree: true });
}

window.addEventListener('hashchange', () => schedule(200));
window.addEventListener('popstate', () => schedule(200));
window.addEventListener('sosoking:extensions-ready', () => schedule(200));
observe();
schedule(200);
