/**
 * ux-improvements.js
 * - 피드 스크롤 복원 (상세→뒤로가기 시 위치 유지)
 * - 태그 클릭 → 피드 검색 이동
 * - 알림 패널 ESC 닫기
 */

/* ── 스타일 주입 ── */
(function injectStyles() {
  if (document.getElementById('ux-improvements-style')) return;
  const style = document.createElement('style');
  style.id = 'ux-improvements-style';
  style.textContent = `
    [data-detail-root] .tag {
      cursor: pointer;
      transition: background .15s, color .15s;
    }
    [data-detail-root] .tag:hover {
      background: var(--color-primary) !important;
      color: #fff !important;
      opacity: 1 !important;
    }
    #draft-restore-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--color-surface-2);
      border: 1.5px solid var(--color-primary);
      border-radius: 12px;
      padding: 11px 14px;
      margin-bottom: 14px;
      font-size: 13px;
      font-weight: 700;
      animation: slideDown .22s ease;
    }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
})();

/* ── 피드 스크롤 복원 ── */
const FEED_SCROLL_KEY = 'sosoking:feedScrollY';

function saveFeedScroll() {
  const hash = window.location.hash;
  if (!hash.startsWith('#/feed')) return;
  try {
    sessionStorage.setItem(FEED_SCROLL_KEY, JSON.stringify({
      y: window.scrollY,
      hash,
      savedAt: Date.now(),
    }));
  } catch {}
}

function tryRestoreFeedScroll(attempts = 0) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(FEED_SCROLL_KEY) || 'null');
    if (!saved || !saved.y || Date.now() - saved.savedAt > 300_000) return;
    const feedList = document.getElementById('feed-list');
    if (feedList && feedList.children.length > 0) {
      window.scrollTo({ top: saved.y, behavior: 'instant' });
      sessionStorage.removeItem(FEED_SCROLL_KEY);
    } else if (attempts < 30) {
      setTimeout(() => tryRestoreFeedScroll(attempts + 1), 120);
    }
  } catch {}
}

// 피드 카드 클릭 시 스크롤 위치 저장
document.addEventListener('click', (e) => {
  if (!window.location.hash.startsWith('#/feed')) return;
  if (e.target.closest('.feed-card')) saveFeedScroll();
}, true);

// 피드 페이지 진입 시 스크롤 복원 (뒤로가기 등)
window.addEventListener('hashchange', () => {
  if (window.location.hash.startsWith('#/feed')) {
    tryRestoreFeedScroll();
  }
});

/* ── 상세 페이지 태그 클릭 → 피드 검색 ── */
document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-detail-root]')) return;
  const tag = e.target.closest('.tag');
  if (!tag) return;
  e.preventDefault();
  e.stopPropagation();
  const tagText = tag.textContent.replace(/^#/, '').trim();
  if (!tagText) return;
  window.location.hash = `#/feed?q=${encodeURIComponent(tagText)}`;
});

/* ── 알림 패널 ESC 닫기 ── */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const panel = document.getElementById('notification-panel');
  if (panel && !panel.hidden) {
    panel.hidden = true;
    e.stopPropagation();
  }
});
