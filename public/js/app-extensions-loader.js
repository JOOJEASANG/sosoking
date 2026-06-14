// app-extensions-loader.js
//
// index.html에 흩어져 있던 기능 보정/확장 모듈을 한 곳에서 관리합니다.
// 각 모듈은 독립 실행형으로 만들어져 있으므로 실패해도 앱 전체 부팅을 막지 않습니다.

const EXTENSION_MODULES = [
  './layout-id-repair.js',
  './admin-visibility-guard.js',
  './admin-shortcuts-pwa.js',
  './account-ui.js',
  './account-notifications-uid-fix.js',
  './pc-sidebar-spacing.js',
  './detail-actions-bootstrap.js',
  './post-owner-actions.js',
  './detail-post-nav.js',
  './points-actions.js',
  './party-war-ui.js',
  './three-party-ui.js',
  './congress-route.js',
  './constitutional-court-route.js',
  './republic-polish.js',
  './republic-game-flow.js',
  './battle-opponent-reaction.js',
  './battle-comment-result-card.js',
  './president-decree-helper.js',
  './election-consistency-fix.js',
  './court-consistency-fix.js',
  './political-extra-cleanup.js',
  './admin-dashboard-polish.js',
  './admin-feed-safety-fix.js',
  './admin-reports-panel.js',
  './feedback-actions.js',
  './admin-ui-cleanup.js',
  './notifications-ui.js',
  './account-request-cleanup.js',
  './ui-final-interactions.js',
  './ux-improvements.js',
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
  const states = results.map(result => result.value).filter(Boolean);
  const failed = states.filter(item => !item.ok).map(item => item.path);
  const loaded = states.filter(item => item.ok).map(item => item.path);
  const status = {
    total: EXTENSION_MODULES.length,
    loaded,
    failed,
    ok: failed.length === 0,
    updatedAt: Date.now(),
  };

  window.__sosokingExtensionStatus = status;
  if (failed.length) console.warn('[sosoking extensions] failed modules:', failed);
  window.dispatchEvent(new CustomEvent('sosoking:extensions-ready', { detail: status }));
});
