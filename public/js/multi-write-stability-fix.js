function isMultiWritePage() {
  return !!document.querySelector('.multi-write-page');
}

function syncModuleCard(input) {
  const card = input.closest('.multi-module');
  if (card) card.classList.toggle('is-enabled', input.checked);
}

function stabilizeMultiChecks() {
  if (!isMultiWritePage()) return;

  document.querySelectorAll('.multi-module').forEach(card => {
    const input = card.querySelector('[data-module-toggle]');
    if (!input) return;

    syncModuleCard(input);

    if (card.dataset.stableCheckReady === '1') return;
    card.dataset.stableCheckReady = '1';

    input.addEventListener('change', () => syncModuleCard(input));

    const head = card.querySelector('.multi-module__head');
    head?.addEventListener('click', e => {
      if (e.target === input) {
        setTimeout(() => syncModuleCard(input), 0);
        return;
      }
      e.preventDefault();
      input.checked = !input.checked;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(stabilizeMultiChecks, 120);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 500);
