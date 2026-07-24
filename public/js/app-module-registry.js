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
  './feedback-actions.js',
  './admin-ai-minimal-actions.js',
  './admin-ai-type-patch.js',
  './admin-member-list-fix.js',
  './admin-data-manager.js',
  './admin-ui-cleanup.js',
  './notifications-ui.js',
  './account-request-cleanup.js',
  './ui-final-interactions.js',
  './ux-improvements.js',
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
  return results.map(result => result.value).filter(item => item && !item.ok).map(item => item.path);
}
