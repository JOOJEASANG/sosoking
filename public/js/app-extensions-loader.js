// app-extensions-loader.js — 계정과 프로필에 필요한 최소 보조 모듈만 로드합니다.

const EXTENSION_MODULES = [
  './pc-sidebar-spacing.js',
  './account-ui.js',
  './nickname-icon-actions.js',
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
