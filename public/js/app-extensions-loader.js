// app-extensions-loader.js — 계정·프로필·AI 놀이터에 필요한 최소 보조 모듈만 로드합니다.

const EXTENSION_VERSION = '2026-06-26-debate-comment-v1';
const EXTENSION_MODULES = [
  './debate-route-redirect.js',
  './debate-comment-choice-sync.js',
  './pc-sidebar-spacing.js',
  './account-ui.js',
  './nickname-icon-actions.js',
  './playground-enhance.js',
];

async function loadExtension(path) {
  try {
    await import(`${path}?v=${encodeURIComponent(EXTENSION_VERSION)}`);
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
