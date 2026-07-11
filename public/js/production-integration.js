const BUILD = '2026.07.11-stage8';
const root = document.body;
let offlineBar = null;
let lastErrorAt = 0;

function ensureOfflineBar() {
  if (offlineBar) return offlineBar;
  offlineBar = document.createElement('div');
  offlineBar.className = 'connection-banner';
  offlineBar.setAttribute('role', 'status');
  offlineBar.innerHTML = '<strong>인터넷 연결이 끊겼습니다.</strong><span>작성 중인 내용은 그대로 두고 연결이 복구되면 다시 시도해 주세요.</span>';
  root.prepend(offlineBar);
  return offlineBar;
}

function updateConnectionState() {
  const bar = ensureOfflineBar();
  const offline = !navigator.onLine;
  bar.classList.toggle('visible', offline);
  document.documentElement.classList.toggle('is-offline', offline);
}

function notifyUnexpectedError() {
  const now = Date.now();
  if (now - lastErrorAt < 5000) return;
  lastErrorAt = now;
  const toastRoot = document.getElementById('toast-root');
  if (!toastRoot) return;
  const item = document.createElement('div');
  item.className = 'toast error';
  item.innerHTML = '<strong>화면 처리 중 문제가 발생했습니다.</strong><br><span>입력 내용은 유지한 채 한 번 더 시도하거나 화면을 새로고침해 주세요.</span>';
  toastRoot.appendChild(item);
  window.setTimeout(() => item.remove(), 5000);
}

window.addEventListener('online', updateConnectionState);
window.addEventListener('offline', updateConnectionState);
window.addEventListener('error', event => {
  if (event?.message?.includes('ResizeObserver loop')) return;
  notifyUnexpectedError();
});
window.addEventListener('unhandledrejection', event => {
  const message = String(event?.reason?.message || event?.reason || '');
  if (/popup-closed-by-user|AbortError/.test(message)) return;
  notifyUnexpectedError();
});

document.documentElement.dataset.build = BUILD;
updateConnectionState();
