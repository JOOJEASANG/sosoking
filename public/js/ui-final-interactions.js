/**
 * ui-final-interactions.js
 * 최종 UI 마무리 상호작용:
 * - 스크롤 최상단 버튼
 * - 헤더 스크롤 감지
 * - 모바일 swipe dismiss
 * - 이미지 lazy load 개선
 */

/* ── 스크롤 최상단 버튼 ── */
function initScrollTopBtn() {
  // PC 전용 (1024px 이상)
  if (window.innerWidth < 1024) return;

  let btn = document.getElementById('scroll-top-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'scroll-top-btn';
    btn.className = 'scroll-top-btn';
    btn.setAttribute('aria-label', '맨 위로');
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" stroke-width="2.2" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18"/>
    </svg>`;
    document.body.appendChild(btn);
  }

  // 클릭 핸들러 (중복 방지)
  if (!btn.dataset.initialized) {
    btn.dataset.initialized = '1';
    btn.addEventListener('click', () => {
      const adminEl = document.getElementById('admin-content');
      if (adminEl) {
        adminEl.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // 스크롤 감지
  function onScroll() {
    const adminEl = document.getElementById('admin-content');
    const scrollY = adminEl ? adminEl.scrollTop : window.scrollY;
    btn.classList.toggle('visible', scrollY > 280);
  }

  const adminEl = document.getElementById('admin-content');
  if (adminEl) {
    adminEl.addEventListener('scroll', onScroll, { passive: true });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ── 헤더 스크롤 감지 (모바일 그림자) ── */
function initHeaderScrollShadow() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  function onScroll() {
    header.classList.toggle('scrolled', window.scrollY > 4);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ── 반응 이모지 팝 애니메이션 ── */
function initReactionPop() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.reaction-btn');
    if (!btn) return;
    const emoji = btn.querySelector('.reaction-emoji');
    if (!emoji) return;
    emoji.classList.remove('just-reacted');
    void emoji.offsetWidth; // reflow
    btn.classList.add('just-reacted');
    setTimeout(() => btn.classList.remove('just-reacted'), 300);
  });
}

/* ── 카드 눌림 효과 (모바일 터치) ── */
function initCardTouchFeedback() {
  if (!('ontouchstart' in window)) return;

  document.addEventListener('touchstart', (e) => {
    const card = e.target.closest('.card--hover, .feed-card');
    if (card) {
      card.style.transition = 'transform 80ms ease';
      card.style.transform = 'scale(0.99)';
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const card = e.target.closest('.card--hover, .feed-card');
    if (card) {
      card.style.transform = '';
      setTimeout(() => { card.style.transition = ''; }, 200);
    }
  }, { passive: true });
}

/* ── 모달 외부 클릭 시 닫기 (이미 있는 경우 패스) ── */
function initModalOutsideClick() {
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      const modal = e.target.querySelector('.modal, .modal-content');
      if (modal) {
        // 기존 닫기 버튼이 있으면 클릭
        const closeBtn = modal.querySelector('.modal__close, [data-modal-close]');
        if (closeBtn) closeBtn.click();
      }
    }
  });
}

/* ── 피드 페이지 — 결과 요약에 현재 필터 표시 ── */
function initFeedChipCount() {
  // 카운트 표시는 feed.js에서 처리하므로 여기서는 스타일만
  document.querySelectorAll('.soso-feed-chip').forEach(chip => {
    if (!chip.dataset.initialized) {
      chip.dataset.initialized = 'true';
    }
  });
}

/* ── 이미지 — 로딩 오류 처리 ── */
function initImgErrorHandler() {
  document.addEventListener('error', (e) => {
    if (e.target.tagName !== 'IMG') return;
    const img = e.target;
    if (img.dataset.errHandled) return;
    img.dataset.errHandled = '1';
    img.style.opacity = '0.3';
    img.alt = '이미지 로드 실패';
  }, true);
}

/* ── 다크 모드 전환 시 아이콘 버튼 갱신 ── */
function initThemeTransition() {
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.attributeName === 'data-theme') {
        document.documentElement.style.setProperty(
          '--transition-theme', '200ms ease'
        );
        setTimeout(() => {
          document.documentElement.style.removeProperty('--transition-theme');
        }, 400);
      }
    }
  });
  observer.observe(document.documentElement, { attributes: true });
}

/* ── 초기화 ── */
function init() {
  initScrollTopBtn();
  initHeaderScrollShadow();
  initReactionPop();
  initCardTouchFeedback();
  initModalOutsideClick();
  initImgErrorHandler();
  initThemeTransition();
}

// DOM 준비 후 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// 라우팅 변경 시 스크롤 탑 버튼 재초기화
window.addEventListener('hashchange', () => {
  setTimeout(() => {
    initScrollTopBtn();
    initFeedChipCount();
  }, 200);
});
