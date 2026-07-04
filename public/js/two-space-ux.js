/* two-space-ux.js
   토론소/드립소 UX 보정: 커뮤니티 리스트 정리, 토론소 VS 입력 UI
*/
import { navigate } from './router.js';

const STYLE_ID = 'sosoking-two-space-ux-style';

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .feed-page-list-only {
      max-width: 920px !important;
      gap: 14px !important;
      padding-top: clamp(10px, 2vw, 18px);
    }

    .soso-feed-modern-head {
      display: flex;
      align-items: stretch;
      justify-content: space-between;
      gap: 14px;
      padding: clamp(18px, 3vw, 24px);
      border-radius: 24px;
      border: 1px solid rgba(148,163,184,.22);
      background:
        radial-gradient(circle at 10% 0%, rgba(255,107,74,.16), rgba(255,107,74,0) 34%),
        linear-gradient(135deg, rgba(255,255,255,.96), rgba(248,250,252,.88));
      box-shadow: 0 14px 36px rgba(15,23,42,.07);
    }

    .soso-feed-modern-head__eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 28px;
      padding: 0 12px;
      border-radius: 999px;
      background: rgba(255,107,74,.10);
      color: #ef4b2f;
      font-size: 12px;
      font-weight: 950;
      letter-spacing: -.02em;
    }

    .soso-feed-modern-head__title {
      margin-top: 10px;
      font-size: clamp(24px, 4.8vw, 34px);
      font-weight: 950;
      line-height: 1.15;
      letter-spacing: -.07em;
      color: var(--color-text-primary);
    }

    .soso-feed-modern-head__desc {
      margin-top: 8px;
      color: var(--color-text-muted);
      font-size: 14px;
      font-weight: 750;
      line-height: 1.55;
      letter-spacing: -.035em;
    }

    .soso-feed-modern-tabs {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
      min-width: 230px;
    }

    .soso-feed-modern-tab,
    .soso-feed-modern-write {
      min-height: 42px;
      padding: 0 15px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,.28);
      background: rgba(255,255,255,.72);
      color: var(--color-text-primary);
      font-size: 13px;
      font-weight: 950;
      letter-spacing: -.03em;
      cursor: pointer;
      transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
    }

    .soso-feed-modern-tab:hover,
    .soso-feed-modern-write:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 24px rgba(15,23,42,.09);
    }

    .soso-feed-modern-tab.is-active {
      border-color: rgba(255,107,74,.35);
      background: linear-gradient(135deg, #ff5a3d, #ff8a00);
      color: #fff;
      box-shadow: 0 12px 24px rgba(255,107,74,.22);
    }

    .soso-feed-modern-write {
      border: 0;
      background: #111827;
      color: #fff;
    }

    .feed-page-list-only .soso-feed-summary {
      margin-top: 2px;
      border-radius: 18px;
      background: var(--color-surface);
      border: 1px solid rgba(148,163,184,.18);
      box-shadow: 0 8px 20px rgba(15,23,42,.045);
    }

    .feed-page-list-only .soso-feed-list {
      gap: 12px !important;
    }

    .feed-page-list-only .feed-card {
      border-radius: 22px !important;
      border-color: rgba(148,163,184,.20) !important;
      box-shadow: 0 10px 28px rgba(15,23,42,.055) !important;
      overflow: hidden;
    }

    .feed-page-list-only .feed-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 18px 38px rgba(15,23,42,.09) !important;
    }

    .feed-page-list-only .feed-card__title {
      font-size: clamp(17px, 3.8vw, 20px);
      line-height: 1.38;
      letter-spacing: -.045em;
    }

    .feed-page-list-only .feed-card__meta {
      color: var(--color-text-muted);
      font-weight: 700;
    }

    .mw-vote-guide-card {
      margin-bottom: 14px;
      padding: 16px;
      border-radius: 18px;
      border: 1px solid rgba(255,107,74,.20);
      background: linear-gradient(135deg, rgba(255,107,74,.10), rgba(255,183,77,.08));
    }

    .mw-vote-guide-card__badge {
      display: inline-flex;
      align-items: center;
      height: 26px;
      padding: 0 10px;
      border-radius: 999px;
      background: rgba(255,107,74,.13);
      color: #ef4b2f;
      font-size: 11px;
      font-weight: 950;
    }

    .mw-vote-guide-card__title {
      margin-top: 8px;
      font-size: 18px;
      font-weight: 950;
      letter-spacing: -.05em;
      color: var(--color-text-primary);
    }

    .mw-vote-guide-card__desc {
      margin-top: 6px;
      color: var(--color-text-muted);
      font-size: 13px;
      font-weight: 750;
      line-height: 1.55;
    }

    .mw-vs-options {
      position: relative;
      display: grid !important;
      grid-template-columns: minmax(0,1fr) auto minmax(0,1fr);
      align-items: center;
      gap: 10px !important;
    }

    .mw-vs-options .mw-vote-option {
      min-height: 52px;
      text-align: center;
      font-size: 15px;
      font-weight: 950;
      border-radius: 16px;
      border: 1px solid rgba(148,163,184,.28);
      background: var(--color-surface);
    }

    .mw-vs-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: linear-gradient(135deg, #111827, #374151);
      color: #fff;
      font-size: 13px;
      font-weight: 950;
      box-shadow: 0 10px 22px rgba(17,24,39,.20);
    }

    [data-theme="dark"] .soso-feed-modern-head,
    html.dark .soso-feed-modern-head,
    html[data-theme="dark"] .soso-feed-modern-head {
      background: linear-gradient(135deg, rgba(31,41,55,.96), rgba(17,24,39,.90));
      border-color: rgba(255,255,255,.08);
      box-shadow: 0 16px 36px rgba(0,0,0,.28);
    }

    [data-theme="dark"] .soso-feed-modern-tab,
    html.dark .soso-feed-modern-tab,
    html[data-theme="dark"] .soso-feed-modern-tab {
      background: rgba(255,255,255,.06);
      border-color: rgba(255,255,255,.09);
    }

    @media (max-width: 640px) {
      .soso-feed-modern-head {
        flex-direction: column;
      }
      .soso-feed-modern-tabs {
        justify-content: flex-start;
        min-width: 0;
      }
      .soso-feed-modern-tab,
      .soso-feed-modern-write {
        flex: 1 1 auto;
      }
      .mw-vs-options {
        grid-template-columns: 1fr;
      }
      .mw-vs-pill {
        width: 100%;
        height: 30px;
        border-radius: 999px;
      }
    }
  `;
  document.head.appendChild(style);
}

function getFeedType() {
  const hash = window.location.hash || '';
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return new URLSearchParams(query).get('type') || '';
}

function patchFeedPage() {
  const page = document.querySelector('.feed-page-list-only');
  if (!page || page.querySelector('.soso-feed-modern-head')) return;
  const type = getFeedType();
  const head = document.createElement('section');
  head.className = 'soso-feed-modern-head';
  head.innerHTML = `
    <div>
      <div class="soso-feed-modern-head__eyebrow">SOSOKING COMMUNITY</div>
      <div class="soso-feed-modern-head__title">토론소와 드립소</div>
      <div class="soso-feed-modern-head__desc">웃긴 주제로 가볍게 갈라지고, 사소한 말을 드립으로 바꾸는 소소킹 공간입니다.</div>
    </div>
    <div class="soso-feed-modern-tabs" aria-label="커뮤니티 필터">
      <button type="button" class="soso-feed-modern-tab ${!type ? 'is-active' : ''}" data-feed-modern-type="">전체</button>
      <button type="button" class="soso-feed-modern-tab ${type === 'vote' ? 'is-active' : ''}" data-feed-modern-type="vote">토론소</button>
      <button type="button" class="soso-feed-modern-tab ${type === 'drip' ? 'is-active' : ''}" data-feed-modern-type="drip">드립소</button>
      <button type="button" class="soso-feed-modern-write" data-modern-write>글쓰기</button>
    </div>`;
  page.prepend(head);
  head.querySelectorAll('[data-feed-modern-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.feedModernType;
      navigate(next ? `/feed?type=${next}` : '/feed');
    });
  });
  head.querySelector('[data-modern-write]')?.addEventListener('click', () => navigate('/write?type=multi&preset=drip'));
}

function patchVoteWritePanel() {
  const page = document.querySelector('.multi-write-page');
  if (!page) return;
  const selected = document.getElementById('mw-selected-preset')?.value || page.dataset.presetKey || '';
  const votePanel = document.querySelector('[data-option-panel="vote"]');
  if (!votePanel) return;

  if (!votePanel.querySelector('.mw-vote-guide-card')) {
    votePanel.insertAdjacentHTML('afterbegin', `
      <div class="mw-vote-guide-card">
        <div class="mw-vote-guide-card__badge">웃긴 토론 안내</div>
        <div class="mw-vote-guide-card__title">두 선택지를 직접 적고 VS 투표로 붙여보세요</div>
        <div class="mw-vote-guide-card__desc">예: 찍먹파 vs 부먹파, 월요일 폐지 vs 금요일 연장처럼 사람들이 가볍게 고를 수 있는 주제가 좋습니다.</div>
      </div>`);
  }

  const list = votePanel.querySelector('#mw-vote-options');
  const inputs = [...votePanel.querySelectorAll('.mw-vote-option')];
  if (list && !list.classList.contains('mw-vs-options')) {
    list.classList.add('mw-vs-options');
  }
  if (list && !list.querySelector('.mw-vs-pill') && inputs.length >= 2) {
    inputs[0].insertAdjacentHTML('afterend', '<span class="mw-vs-pill" aria-hidden="true">VS</span>');
  }

  inputs.forEach((input, index) => {
    input.readOnly = false;
    input.removeAttribute('readonly');
    input.placeholder = index === 0 ? '왼쪽 선택지 입력' : '오른쪽 선택지 입력';
    if (!input.dataset.sosoVsReady) {
      if (input.value === '찬성' || input.value === '반대') input.value = '';
      input.dataset.sosoVsReady = '1';
      input.addEventListener('input', () => { input.dataset.userEdited = '1'; });
    }
  });

  if (selected === 'vote') votePanel.style.display = '';
}

let timer = null;
function schedulePatch() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    injectStyle();
    patchFeedPage();
    patchVoteWritePanel();
  }, 60);
}

document.addEventListener('DOMContentLoaded', schedulePatch);
window.addEventListener('hashchange', schedulePatch);
window.addEventListener('sosoking:render-multi-write', schedulePatch);
window.addEventListener('sosoking:extensions-ready', schedulePatch);
document.addEventListener('click', event => {
  if (event.target.closest('[data-multi-preset]')) setTimeout(schedulePatch, 80);
}, true);
new MutationObserver(schedulePatch).observe(document.documentElement, { childList: true, subtree: true });

schedulePatch();
