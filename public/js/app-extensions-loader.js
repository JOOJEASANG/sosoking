// app-extensions-loader.js
//
// index.html에 흩어져 있던 기능 보정/확장 모듈을 한 곳에서 관리합니다.
// 각 모듈은 독립 실행형으로 만들어져 있으므로 실패해도 앱 전체 부팅을 막지 않습니다.
// 레거시 DOM 패치 파일은 최신 전담 파일과 충돌하지 않도록 로딩 목록에서 제외합니다.

const EXTENSION_MODULES = [
  './game-guest-access.js',
  './six-game-guard.js',
  './admin-visibility-guard.js',
  './admin-shortcuts-pwa.js',
  './account-ui.js',
  './pc-sidebar-spacing.js',
  './game-ui.js',
  './weekly-fill-challenge.js',

  // 상세 페이지 기본 액션/참여 기능
  './detail-actions-bootstrap.js',
  './post-owner-actions.js',
  './participant-replies.js',
  './multi-detail.js',
  './detail-extras.js',
  './detail-cards.js',

  // 피드/글쓰기/수정
  './acrostic-ui.js',
  './multi-write.js',
  './fill-box-input-fix.js',
  './write-edit-router-fix.js',
  './edit-screen-polish.js',
  './points-actions.js',
  './unlimited-image-uploader.js',
  './write-template-suggestions.js',

  // 관리자/알림/운영 보조
  './feedback-actions.js',
  './admin-feedback-actions.js',
  './admin-ai-minimal-actions.js',
  './admin-member-list-fix.js',
  './admin-data-manager.js',
  './admin-ui-cleanup.js',
  './notifications-panel.js',
  './account-notifications-section.js',

  // 추가 표시 보강
  './relay-mission-cards.js',
  './deadline-gate.js',
];

async function loadExtension(path) {
  try {
    await import(`${path}?v=${Date.now()}`);
    return { path, ok: true };
  } catch (error) {
    console.warn('[sosoking extensions] failed', path, error);
    return { path, ok: false, error };
  }
}

Promise.allSettled(EXTENSION_MODULES.map(loadExtension)).then(results => {
  const failed = results
    .map(result => result.value)
    .filter(item => item && !item.ok)
    .map(item => item.path);
  if (failed.length) console.warn('[sosoking extensions] failed modules:', failed);
  window.dispatchEvent(new CustomEvent('sosoking:extensions-ready', { detail: { failed } }));
});