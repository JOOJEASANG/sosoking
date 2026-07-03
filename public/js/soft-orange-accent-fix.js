// soft-orange-accent-fix.js
// 메인/커뮤니티 AI 캐릭터 카드의 강조 문구를 빨강 대신 밝은 오렌지·살구색으로 통일합니다.

const LIGHT_ORANGE = '#e28650';
const DARK_ORANGE = '#ffc9a3';

function isDarkTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark'
    || document.documentElement.classList.contains('dark');
}

function applySoftOrangeAccent(root = document) {
  const color = isDarkTheme() ? DARK_ORANGE : LIGHT_ORANGE;
  const selectors = [
    '.soso-ai-resident-card__phrase',
    '.home-ai-resident-card__desc',
    '.home-ai-resident-card__phrase',
    '.ai-resident-card__phrase',
    '.character-card .phrase',
    '.ai-character-card .phrase',
    '.home-character-card .phrase',
  ].join(',');

  root.querySelectorAll(selectors).forEach(el => {
    el.style.setProperty('color', color, 'important');
    el.style.setProperty('font-weight', '850', 'important');
  });
}

let timer = null;
function scheduleApply() {
  clearTimeout(timer);
  timer = setTimeout(() => applySoftOrangeAccent(), 80);
}

window.addEventListener('hashchange', () => setTimeout(scheduleApply, 120));
window.addEventListener('themechange', scheduleApply);
new MutationObserver(scheduleApply).observe(document.documentElement, { childList: true, subtree: true });

setTimeout(scheduleApply, 0);
setTimeout(scheduleApply, 400);
setTimeout(scheduleApply, 1200);
