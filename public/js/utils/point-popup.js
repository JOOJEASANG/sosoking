/* point-popup.js — 정치력 획득 시 화면에 +NP 팝업 표시 */

export function showPointPopup(amount, anchorEl = null) {
  const el = document.createElement('div');
  el.className = 'point-popup';
  if (amount >= 20) el.classList.add('point-popup--big');

  const label = amount >= 20 ? `+${amount}P 🎉` : `+${amount}P`;
  el.textContent = label;

  if (anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    el.style.top = `${rect.top + window.scrollY - 10}px`;
    el.style.left = `${rect.left + rect.width / 2}px`;
    el.style.transform = 'translate(-50%, 0)';
  } else {
    el.style.bottom = '100px';
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
  }

  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('point-popup--fly'));
  setTimeout(() => el.remove(), 1400);
}
