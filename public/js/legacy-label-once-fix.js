const LEGACY_REPLACEMENTS = [
  ['골라킹', '골라봐'],
  ['막장킹', '막장릴레이'],
];

function fixText(text) {
  return LEGACY_REPLACEMENTS.reduce((acc, [from, to]) => acc.replaceAll(from, to), String(text || ''));
}

function runOnce(root = document) {
  const targets = [
    '.admin-type-card__name',
    '.feed-card__type-badge',
    '.detail-type-badge',
    '.badge',
    '.type-select-card__name',
    '.type-select-card__desc',
    '.filter-chip',
  ].join(',');

  root.querySelectorAll(targets).forEach(el => {
    if (el.dataset.legacyLabelFixed === '1') return;
    const before = el.textContent || '';
    const after = fixText(before);
    if (before !== after) el.textContent = after;
    el.dataset.legacyLabelFixed = '1';
  });
}

function scheduleOnce() {
  setTimeout(() => runOnce(), 120);
  setTimeout(() => runOnce(), 600);
  setTimeout(() => runOnce(), 1500);
}

window.addEventListener('hashchange', scheduleOnce);
scheduleOnce();
