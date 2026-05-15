/* toast.js — 토스트 알림 */

let container = null;

export function initToast() {
  container = document.getElementById('toast-container');
}

export function showToast(message, type = 'default', duration = 3000) {
  if (!container) container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast${type !== 'default' ? ` toast--${type}` : ''}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.2s';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

export const toast = {
  success: (msg) => showToast(msg, 'success'),
  error:   (msg) => showToast(msg, 'error'),
  warn:    (msg) => showToast(msg, 'warning'),
  info:    (msg) => showToast(msg),
};
