/* home-empty-polish.js
   메인 인기 콘텐츠/댓글 반응 빈 상태를 작고 깔끔한 카드로 보정
*/
import { navigate } from './router.js';

const STYLE_ID = 'sosoking-home-empty-polish-style';

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .home-dash--v2 .home-rank-list,
    .home-dash--v2 .home-compact-feed-list {
      display: grid;
      gap: 10px;
    }

    .home-dash--v2 .home-rank-list > .empty-state,
    .home-dash--v2 .home-compact-feed-list > .empty-state {
      min-height: 0 !important;
      height: auto !important;
      margin: 0 !important;
      padding: 18px 16px !important;
      border-radius: 18px !important;
      border: 1px solid rgba(148, 163, 184, .18) !important;
      background:
        radial-gradient(circle at 0% 0%, rgba(255, 107, 74, .08), rgba(255, 107, 74, 0) 42%),
        rgba(255, 255, 255, .72) !important;
      box-shadow: 0 8px 22px rgba(15, 23, 42, .05) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: flex-start !important;
      text-align: left !important;
    }

    .home-dash--v2 .home-rank-list > .empty-state::before,
    .home-dash--v2 .home-compact-feed-list > .empty-state::before {
      content: '✨';
      display: inline-flex;
      width: 36px;
      height: 36px;
      margin-right: 12px;
      align-items: center;
      justify-content: center;
      border-radius: 14px;
      background: rgba(255, 107, 74, .10);
      font-size: 18px;
      flex: 0 0 auto;
    }

    .home-dash--v2 .home-compact-feed-list > .empty-state::before {
      content: '💬';
    }

    .home-dash--v2 .home-rank-list > .empty-state .empty-state__title,
    .home-dash--v2 .home-compact-feed-list > .empty-state .empty-state__title {
      margin: 0 !important;
      color: var(--color-text-muted) !important;
      font-size: 14px !important;
      font-weight: 850 !important;
      line-height: 1.45 !important;
      letter-spacing: -.035em;
    }

    .home-dash--v2 .home-section-header {
      margin-top: 18px;
      margin-bottom: 8px;
    }

    .home-dash--v2 .home-section-title {
      font-size: 18px;
      font-weight: 950;
      letter-spacing: -.045em;
    }

    [data-theme="dark"] .home-dash--v2 .home-rank-list > .empty-state,
    [data-theme="dark"] .home-dash--v2 .home-compact-feed-list > .empty-state,
    html.dark .home-dash--v2 .home-rank-list > .empty-state,
    html.dark .home-dash--v2 .home-compact-feed-list > .empty-state,
    html[data-theme="dark"] .home-dash--v2 .home-rank-list > .empty-state,
    html[data-theme="dark"] .home-dash--v2 .home-compact-feed-list > .empty-state {
      background:
        radial-gradient(circle at 0% 0%, rgba(255, 107, 74, .10), rgba(255, 107, 74, 0) 44%),
        rgba(30, 41, 59, .72) !important;
      border-color: rgba(255, 255, 255, .08) !important;
      box-shadow: 0 10px 24px rgba(0, 0, 0, .18) !important;
    }

    @media (max-width: 640px) {
      .home-dash--v2 .home-rank-list > .empty-state,
      .home-dash--v2 .home-compact-feed-list > .empty-state {
        padding: 16px 14px !important;
        border-radius: 16px !important;
      }
      .home-dash--v2 .home-section-title {
        font-size: 17px;
      }
    }
  `;
  document.head.appendChild(style);
}

function patchHomeEmptyText() {
  const root = document.querySelector('.home-dash--v2');
  if (!root) return;

  root.querySelectorAll('.home-rank-list > .empty-state .empty-state__title').forEach(el => {
    if (/아직 인기 콘텐츠가 없어요/.test(el.textContent || '')) {
      el.textContent = '아직 인기 콘텐츠가 없어요. 첫 드립소 글을 열어보세요.';
    }
  });

  root.querySelectorAll('.home-compact-feed-list > .empty-state .empty-state__title').forEach(el => {
    if (/아직 댓글이 없어요/.test(el.textContent || '')) {
      el.textContent = '아직 댓글 반응이 없어요. 가장 먼저 받아쳐보세요.';
    }
  });

  root.querySelector('#hbtn-write')?.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    navigate('/write?type=multi&preset=drip');
  }, true);
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    injectStyle();
    patchHomeEmptyText();
  }, 80);
}

document.addEventListener('DOMContentLoaded', schedule);
window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

schedule();
