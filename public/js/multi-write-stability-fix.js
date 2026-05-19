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
    if (card.dataset.stableCheckReady === '1') return;
    card.dataset.stableCheckReady = '1';

    const input = card.querySelector('[data-module-toggle]');
    if (!input) return;
    syncModuleCard(input);

    input.addEventListener('click', e => {
      e.stopPropagation();
      setTimeout(() => syncModuleCard(input), 0);
    });
    input.addEventListener('change', () => syncModuleCard(input));

    const head = card.querySelector('.multi-module__head');
    head?.addEventListener('click', e => {
      if (e.target === input) return;
      e.preventDefault();
      input.checked = !input.checked;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
}

function normalizeRelayText() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    const text = node.nodeValue || '';
    if (text.includes('막장킹')) node.nodeValue = text.replaceAll('막장킹', '막장릴레이');
  });

  document.querySelectorAll('[data-type="relay"], [data-type-filter="relay"], [data-type-quick="relay"], .feed-card__type-badge').forEach(el => {
    const text = el.textContent || '';
    if (text.includes('막장킹') || text.includes('막장릴레이')) {
      el.textContent = text.replaceAll('막장킹', '막장릴레이');
      el.dataset.relayNameLocked = '1';
    }
  });
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    stabilizeMultiChecks();
    normalizeRelayText();
  }, 80);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
setTimeout(schedule, 500);
