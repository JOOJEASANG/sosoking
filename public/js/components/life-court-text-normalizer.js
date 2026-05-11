const REPLACEMENTS = [
  [/소소킹 토론배틀/g, '소소킹 생활법정'],
  [/토론배틀/g, '생활법정'],
  [/토론 배틀/g, '생활법정'],
  [/토론/g, '사건 심리'],
  [/배틀/g, '재판'],
  [/AI 심판/g, 'AI 판사'],
  [/심판/g, '판사'],
  [/판정문/g, '판결문'],
  [/판정/g, '판결'],
  [/A팀/g, '원고 측'],
  [/B팀/g, '피고 측'],
  [/찬성/g, '문제 제기'],
  [/반대/g, '상대측 설명'],
  [/변론 라운드/g, '사건 심리 단계'],
  [/라운드/g, '심리 단계'],
  [/원고 주장/g, '문제 제기 내용'],
  [/피고 주장/g, '상대측 설명'],
  [/주장/g, '진술'],
  [/반론/g, '해명'],
  [/패배 팀/g, '판결 미션 대상'],
];

let observer;
let timer;

function bootLifeCourtTextNormalizer() {
  normalizeNow();
  window.addEventListener('hashchange', scheduleNormalize);
  if (!observer) {
    observer = new MutationObserver(scheduleNormalize);
    observer.observe(document.getElementById('page-content') || document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
}

function scheduleNormalize() {
  clearTimeout(timer);
  timer = setTimeout(normalizeNow, 80);
}

function normalizeNow() {
  const root = document.getElementById('page-content') || document.body;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue || !/[토론배틀심판판정AB팀찬성반대변론라운드주장반론]/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    let text = node.nodeValue;
    REPLACEMENTS.forEach(([from, to]) => { text = text.replace(from, to); });
    if (text !== node.nodeValue) node.nodeValue = text;
  });
}

bootLifeCourtTextNormalizer();
