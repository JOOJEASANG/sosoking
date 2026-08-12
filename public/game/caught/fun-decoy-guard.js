const app = document.getElementById('game-app');
let observer = null;

function maskDecoyBonus() {
  const flags = app?.querySelector('.round-flags[data-fun-decoy="1"]');
  if (!flags) return;
  const text = flags.querySelector('.flag-card.good strong')?.textContent || '';
  const candidates = text.split('/').map(value => Number(value.trim())).filter(Number.isFinite);
  if (candidates.length !== 2) return;
  app.querySelectorAll('[data-number]').forEach(button => {
    const number = Number(button.dataset.number);
    button.classList.toggle('is-bonus', candidates.includes(number));
    if (candidates.includes(number)) button.setAttribute('aria-label', `${number}번 보너스 후보`);
  });
}

if (app) {
  observer = new MutationObserver(maskDecoyBonus);
  observer.observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-fun-decoy'] });
  maskDecoyBonus();
}
window.addEventListener('pagehide', () => observer?.disconnect(), { once: true });
