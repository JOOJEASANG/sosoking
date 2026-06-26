/**
 * ux-improvements.js
 * - 피드 스크롤 복원
 * - 태그 클릭 → 피드 검색
 * - 알림 패널 ESC 닫기
 * - 이미지 라이트박스
 * - 오프라인 감지 배너
 * - 비로그인 댓글 입력 안내
 * - 검색 디바운스 (feed.js 별도 수정)
 * - 반응 로그인 복귀 URL (reaction-bar.js 별도 수정)
 */

import { auth } from './firebase.js';

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
      animation: ux-slide-down .22s ease;
    }
    @keyframes ux-slide-down {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* 이미지 라이트박스 */
    #ux-lightbox {
      position: fixed; inset: 0;
      background: rgba(0,0,0,.92);
      display: flex; align-items: center; justify-content: center;
      z-index: 99998;
      transition: opacity .2s;
    }
    #ux-lightbox img {
      max-width: calc(100vw - 40px);
      max-height: calc(100vh - 80px);
      object-fit: contain;
      border-radius: 8px;
      transition: opacity .18s;
      cursor: default;
      user-select: none;
      -webkit-user-drag: none;
    }
    .ux-lb-btn {
      position: fixed;
      background: rgba(0,0,0,.55);
      border: none;
      color: #fff;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px; height: 44px;
      font-size: 22px;
      transition: background .15s;
      -webkit-tap-highlight-color: transparent;
    }
    .ux-lb-btn:hover { background: rgba(0,0,0,.8); }
    .ux-lb-close { top: 14px; right: 14px; font-size: 18px; }
    .ux-lb-prev  { left: 10px;  top: 50%; transform: translateY(-50%); }
    .ux-lb-next  { right: 10px; top: 50%; transform: translateY(-50%); }
    .ux-lb-counter {
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      color: #fff; font-size: 13px; font-weight: 700;
      background: rgba(0,0,0,.5); padding: 4px 12px; border-radius: 99px;
      pointer-events: none;
    }
    .detail-gallery__thumb { cursor: zoom-in; }

    /* 오프라인 배너 */
    #offline-banner {
      position: fixed; top: 0; left: 0; right: 0;
      z-index: 99990;
      background: #d32f2f; color: #fff;
      text-align: center; padding: 10px 16px;
      font-size: 13px; font-weight: 700;
      animation: ux-slide-down .25s ease;
    }

    /* 비로그인 댓글 안내 */
    .ux-login-hint {
      padding: 12px 14px;
      background: var(--color-surface-2);
      border: 1.5px solid var(--color-border);
      border-radius: 12px;
      font-size: 13px; font-weight: 700;
      color: var(--color-text-secondary);
      margin-bottom: 8px;
      text-align: center;
    }
    .ux-login-hint a {
      color: var(--color-primary); text-decoration: none; font-weight: 800;
    }
  `;
  document.head.appendChild(style);
})();

/* ══════════════════════════════════════════════
   피드 스크롤 복원
══════════════════════════════════════════════ */
const FEED_SCROLL_KEY = 'sosoking:feedScrollY';

function saveFeedScroll() {
  const hash = window.location.hash;
  if (!hash.startsWith('#/feed')) return;
  try {
    sessionStorage.setItem(FEED_SCROLL_KEY, JSON.stringify({ y: window.scrollY, hash, savedAt: Date.now() }));
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

document.addEventListener('click', (e) => {
  if (!window.location.hash.startsWith('#/feed')) return;
  if (e.target.closest('.feed-card')) saveFeedScroll();
}, true);

window.addEventListener('hashchange', () => {
  if (window.location.hash.startsWith('#/feed')) tryRestoreFeedScroll();
});

/* ══════════════════════════════════════════════
   상세 페이지 태그 클릭 → 피드 검색
══════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════
   알림 패널 ESC 닫기
══════════════════════════════════════════════ */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const panel = document.getElementById('notification-panel');
  if (panel && !panel.hidden) { panel.hidden = true; e.stopPropagation(); }
});

/* ══════════════════════════════════════════════
   이미지 라이트박스 (상세 페이지)
══════════════════════════════════════════════ */
function openLightbox(images, startIdx = 0) {
  if (document.getElementById('ux-lightbox')) return;

  let cur = Math.max(0, Math.min(images.length - 1, startIdx));

  const overlay = document.createElement('div');
  overlay.id = 'ux-lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', '이미지 크게 보기');
  overlay.style.opacity = '0';

  const img = document.createElement('img');
  img.alt = '';

  const counter = document.createElement('div');
  counter.className = 'ux-lb-counter';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'ux-lb-btn ux-lb-close';
  closeBtn.setAttribute('aria-label', '닫기');
  closeBtn.innerHTML = '✕';

  overlay.append(img, counter, closeBtn);

  let prevBtn, nextBtn;
  if (images.length > 1) {
    prevBtn = document.createElement('button');
    prevBtn.className = 'ux-lb-btn ux-lb-prev';
    prevBtn.setAttribute('aria-label', '이전 이미지');
    prevBtn.innerHTML = '‹';

    nextBtn = document.createElement('button');
    nextBtn.className = 'ux-lb-btn ux-lb-next';
    nextBtn.setAttribute('aria-label', '다음 이미지');
    nextBtn.innerHTML = '›';

    overlay.append(prevBtn, nextBtn);
  }

  function show(idx) {
    cur = ((idx % images.length) + images.length) % images.length;
    img.style.opacity = '0';
    img.src = images[cur];
    img.onload = () => { img.style.opacity = '1'; };
    counter.textContent = images.length > 1 ? `${cur + 1} / ${images.length}` : '';
  }

  function close() {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 200);
    document.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft')  show(cur - 1);
    if (e.key === 'ArrowRight') show(cur + 1);
  }

  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  closeBtn.addEventListener('click', close);
  prevBtn?.addEventListener('click', e => { e.stopPropagation(); show(cur - 1); });
  nextBtn?.addEventListener('click', e => { e.stopPropagation(); show(cur + 1); });
  document.addEventListener('keydown', onKey);

  // 스와이프
  let tx = 0;
  overlay.addEventListener('touchstart', e => { tx = e.touches[0]?.clientX || 0; }, { passive: true });
  overlay.addEventListener('touchend', e => {
    const dx = (e.changedTouches[0]?.clientX || 0) - tx;
    if (Math.abs(dx) > 50) dx < 0 ? show(cur + 1) : show(cur - 1);
  }, { passive: true });

  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });
  show(startIdx);
}

document.addEventListener('click', e => {
  const thumb = e.target.closest('.detail-gallery__thumb');
  if (!thumb) return;
  const gallery = thumb.closest('[data-images]');
  if (!gallery) return;
  try {
    const images = JSON.parse(decodeURIComponent(gallery.dataset.images || '[]'));
    if (!images.length) return;
    openLightbox(images, Number(thumb.dataset.galleryIdx || 0));
  } catch {}
});

/* ══════════════════════════════════════════════
   오프라인 감지 배너
══════════════════════════════════════════════ */
function showOfflineBanner() {
  if (document.getElementById('offline-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.textContent = '📡 인터넷 연결이 끊겼어요. 연결이 복구되면 자동으로 업데이트됩니다.';
  document.body.insertAdjacentElement('afterbegin', banner);
}

function hideOfflineBanner() {
  document.getElementById('offline-banner')?.remove();
}

window.addEventListener('offline', showOfflineBanner);
window.addEventListener('online', () => {
  hideOfflineBanner();
  const toastFn = window.showToast || window.__sosoToast;
  if (typeof toastFn === 'function') toastFn('인터넷 연결이 복구됐어요 ✓', 'success');
});

if (!navigator.onLine) showOfflineBanner();

/* ══════════════════════════════════════════════
   비로그인 상태 댓글 입력란 → 로그인 안내로 교체
══════════════════════════════════════════════ */
function injectLoginHint() {
  if (auth.currentUser) return;
  const box = document.getElementById('comment-write');
  if (!box || box.dataset.uxLoginHint === '1') return;
  box.dataset.uxLoginHint = '1';

  const textarea = box.querySelector('textarea, #comment-input');
  if (!textarea) return;

  const returnTo = window.location.hash.slice(1) || '/';
  const hint = document.createElement('div');
  hint.className = 'ux-login-hint';
  hint.innerHTML = `💬 <a href="#/login?return=${encodeURIComponent(returnTo)}">로그인</a> 후 댓글을 작성할 수 있어요.`;

  textarea.replaceWith(hint);

  const guestInput = box.querySelector('#comment-guest-name');
  if (guestInput) guestInput.style.display = 'none';
  const submitBtn = box.querySelector('#btn-comment');
  if (submitBtn) submitBtn.style.display = 'none';
}

new MutationObserver(() => {
  if (window.location.hash.includes('/detail/') && !auth.currentUser) {
    setTimeout(injectLoginHint, 200);
  }
}).observe(document.body, { childList: true, subtree: true });
