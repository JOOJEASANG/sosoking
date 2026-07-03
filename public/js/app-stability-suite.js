import { navigate } from './router.js';

function isWriteEditPath() {
  return /^#\/write\?/.test(location.hash || '') && new URLSearchParams((location.hash.split('?')[1] || '')).has('edit');
}

function normalizeThemeMeta() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  meta.setAttribute('content', dark ? '#30364F' : '#FF6B4A');
}

function ensureMobileThemeButtonVisible() {
  const btn = document.getElementById('hdr-theme-btn');
  if (!btn) return;
  btn.style.setProperty('display', 'inline-flex', 'important');
  btn.style.setProperty('visibility', 'visible', 'important');
  btn.style.setProperty('opacity', '1', 'important');
}

function cleanupFloatingFeedback() {
  document.getElementById('feedback-open-btn')?.remove();
}

function cleanupLegacyEditModals() {
  if (!isWriteEditPath()) return;
  document.getElementById('owner-edit-modal')?.remove();
}

function bindSafeAccountScraps() {
  if (document.body.dataset.safeAccountScraps === '1') return;
  document.body.dataset.safeAccountScraps = '1';
  document.addEventListener('click', event => {
    const btn = event.target.closest?.('.scrap-delete-btn');
    if (!btn) return;
    const wrap = btn.closest?.('.scrap-item');
    const id = wrap?.id?.replace(/^acct-scrap-/, '') || '';
    if (!id || typeof window.__acctScrapDelete !== 'function') return;
    event.preventDefault();
    event.stopPropagation();
    window.__acctScrapDelete(id);
  }, true);
}

function bindSafeGlobalNavigation() {
  if (document.body.dataset.safeGlobalNav === '1') return;
  document.body.dataset.safeGlobalNav = '1';
  document.addEventListener('click', event => {
    const go = event.target.closest?.('[data-safe-nav]');
    if (!go) return;
    const path = go.getAttribute('data-safe-nav');
    if (!path) return;
    event.preventDefault();
    event.stopPropagation();
    navigate(path);
  }, true);
}

function runStabilityPass() {
  normalizeThemeMeta();
  ensureMobileThemeButtonVisible();
  cleanupFloatingFeedback();
  cleanupLegacyEditModals();
}

bindSafeAccountScraps();
bindSafeGlobalNavigation();
window.addEventListener('themechange', runStabilityPass);
window.addEventListener('hashchange', () => setTimeout(runStabilityPass, 80));
new MutationObserver(() => {
  clearTimeout(runStabilityPass.timer);
  runStabilityPass.timer = setTimeout(runStabilityPass, 120);
}).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(runStabilityPass, 300);
