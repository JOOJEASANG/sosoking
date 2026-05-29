// account-request-cleanup.js
// 내정보 화면 요청사항 보정: 팔로우 탭 제거, 작명소 통계 숨김, 알림 탭 깜박임 완화

function isAccountPage() {
  return (window.location.hash || '').startsWith('#/account');
}

function normalizeAccountHash() {
  if (!isAccountPage()) return;
  const hash = window.location.hash || '';
  if (/tab=follows\b/.test(hash)) {
    history.replaceState(null, '', '#/account?tab=stats');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}

function cleanupAccountUi() {
  if (!isAccountPage()) return;

  document.querySelectorAll('.account-tab[data-tab="follows"]').forEach(el => el.remove());

  document.querySelectorAll('.stats-page .card .card__body > div').forEach(row => {
    if ((row.textContent || '').includes('작명소')) row.remove();
  });

  const notifTab = document.querySelector('.account-tab[data-tab="notifications"]');
  if (notifTab && !notifTab.dataset.cleanupBound) {
    notifTab.dataset.cleanupBound = '1';
    notifTab.addEventListener('click', () => {
      const wrap = document.querySelector('.account-page-wrap');
      if (wrap) wrap.classList.add('account-page-wrap--stable');
      setTimeout(() => wrap?.classList.remove('account-page-wrap--stable'), 900);
    }, { capture: true });
  }
}

normalizeAccountHash();
window.addEventListener('hashchange', () => {
  normalizeAccountHash();
  setTimeout(cleanupAccountUi, 80);
  setTimeout(cleanupAccountUi, 400);
});
window.addEventListener('sosoking:extensions-ready', () => setTimeout(cleanupAccountUi, 100));
new MutationObserver(() => cleanupAccountUi()).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(cleanupAccountUi, 300);
