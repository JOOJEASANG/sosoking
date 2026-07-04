// app-module-registry.js
//
// 앱 부팅 이후 보조 모듈을 한 곳에서 관리합니다.
// 각 모듈은 독립 실행형으로 동작해야 하며, 실패해도 앱 전체 부팅을 막지 않습니다.

export const POST_BOOT_MODULES = [
  './owner-edit-route-override.js',
  './app-stability-suite.js',
];

export const SAFE_OPTIONAL_MODULES = [
  './secure-interactions-actions.js',
  './account-secure-actions.js',
  './admin-session-guard.js',
  './admin-password-actions.js',
  './admin-post-list-normalizer.js',
  './nickname-icon-actions.js',
];

export const EXTENSION_MODULES = [
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
  './tournament-play.js',
  './detail-extras.js',
  './detail-cards.js',
  './multi-write.js',
  './four-game-polish.js',
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
  './ui-final-interactions.js',
  './ux-improvements.js',
  './final-consistency-20260705.js',
];

export async function importModuleWithStamp(path, stamp = Date.now()) {
  return import(`${path}?v=${stamp}`);
}

export async function importModuleGroup(paths, { label = 'module-group', stamp = Date.now() } = {}) {
  const results = await Promise.allSettled(paths.map(async path => {
    try {
      await importModuleWithStamp(path, stamp);
      return { path, ok: true };
    } catch (error) {
      console.warn(`[sosoking ${label}] failed`, path, error);
      return { path, ok: false, error };
    }
  }));

  return results
    .map(result => result.value)
    .filter(item => item && !item.ok)
    .map(item => item.path);
}
