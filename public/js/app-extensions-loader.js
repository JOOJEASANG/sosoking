// app-extensions-loader.js
//
// index.html에 흩어져 있던 기능 보정/확장 모듈을 한 곳에서 관리합니다.
// 각 모듈은 독립 실행형으로 만들어져 있으므로 실패해도 앱 전체 부팅을 막지 않습니다.

const EXTENSION_MODULES = [
  './layout-id-repair.js',
  './six-game-guard.js',
  './admin-visibility-guard.js',
  './admin-shortcuts-pwa.js',
  './admin-write-sidebar.js',
  './account-ui.js',
  './account-notifications-uid-fix.js',
  './pc-sidebar-spacing.js',
  './detail-actions-bootstrap.js',
  './post-owner-actions.js',
  './participant-replies.js',
  './multi-detail.js',
  './detail-extras.js',
  './detail-cards.js',
  './multi-write.js',
  './write-edit-router-fix.js',
  './write-edit-save-fix.js',
  './edit-screen-polish.js',
  './points-actions.js',
  './unlimited-image-uploader.js',
  './feedback-actions.js',
  './admin-ai-minimal-actions.js',
  './admin-ai-type-patch.js',
  './admin-ai-write-type-force.js',
  './admin-member-list-fix.js',
  './admin-data-manager.js',
  './admin-ui-cleanup.js',
  './notifications-ui.js',
  './account-request-cleanup.js',
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