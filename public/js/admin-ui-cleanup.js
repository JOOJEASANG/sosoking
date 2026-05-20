function removeAdminHomeButton() {
  document.getElementById('admin-safe-goto-site')?.remove();
  document.querySelectorAll('.admin-goto-site-btn').forEach(button => button.remove());
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(removeAdminHomeButton, 80);
}

new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', schedule);
setTimeout(schedule, 400);
