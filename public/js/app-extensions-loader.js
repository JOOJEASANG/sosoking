// app-extensions-loader.js

const EXTENSION_MODULES = [
  './layout-id-repair.js',
  './pc-sidebar-spacing.js',
  './account-ui.js',
  './nickname-icon-actions.js',
  './forces-route-extension.js',
  './forces-sidebar-link.js',
  './core-nav-visibility-fix.js',
  './home-card-layout-fix.js',
  './points-removal-ui.js',
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
  const status = { total: EXTENSION_MODULES.length, loaded, failed, ok: failed.length === 0, updatedAt: Date.now() };
  window.__sosokingExtensionStatus = status;
  if (failed.length) console.warn('[sosoking extensions] failed modules:', failed);
  window.dispatchEvent(new CustomEvent('sosoking:extensions-ready', { detail: status }));
});
