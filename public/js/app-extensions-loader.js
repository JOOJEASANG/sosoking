// app-extensions-loader.js
//
// index.html에 흩어져 있던 기능 보정/확장 모듈을 한 곳에서 관리합니다.
// 각 모듈은 독립 실행형으로 만들어져 있으므로 실패해도 앱 전체 부팅을 막지 않습니다.

const EXTENSION_MODULES = [
  './game-guest-access.js',
  './six-game-guard.js',
  './admin-shortcuts-pwa.js',
  './account-install-actions.js',
  './account-points-view.js',
  './detail-actions-bootstrap.js',
  './detail-image-visibility-patch.js',
  './post-owner-actions.js',
  './post-image-edit-actions.js',
  './feedback-actions.js',
  './admin-feedback-actions.js',
  './post-view-normalizer.js',
  './participant-replies.js',
  './acrostic-flow-fix.js',
  './multi-write.js',
  './multi-detail.js',
  './multi-detail-cleanup.js',
  './multi-write-stability-fix.js',
  './fill-box-input-fix.js',
  './write-edit-fix.js',
  './write-edit-router-fix.js',
  './points-actions.js',
  './unlimited-image-uploader.js',
  './admin-multi-post-fix.js',
  './admin-clean-dashboard.js',
  './admin-ai-secret-notice.js',
  './admin-ai-minimal-actions.js',
  './admin-member-list-fix.js',
  './detail-comment-fix.js',
  './home-feed-compact-fix.js',
  './admin-data-manager.js',
  './admin-ui-cleanup.js',
  './relay-mission-cards.js',
  './write-template-suggestions.js',
  './detail-game-status-card.js',
  './best-reward-rule-card.js',
  './notifications-panel.js',
  './account-notifications-section.js',
  './deadline-gate-render.js',
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
