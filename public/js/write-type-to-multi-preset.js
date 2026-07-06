const TYPE_TO_PRESET = {
  vote: 'vote',
  naming: 'naming',
  initial_game: 'initial_game',
  crazy_court: 'crazy_court',
  relay: 'relay',
  acrostic: 'acrostic',
};

function isWriteTypeSelect() {
  return (window.location.hash || '').startsWith('#/write') && !!document.querySelector('.type-select-grid');
}

function enhanceTypeCards() {
  if (!isWriteTypeSelect()) return;

  document.querySelectorAll('.type-select-card[data-type]').forEach(card => {
    const type = card.dataset.type;
    const preset = TYPE_TO_PRESET[type];
    if (!preset || type === 'multi' || card.dataset.multiPresetLinked === '1') return;

    card.dataset.multiPresetLinked = '1';
    card.classList.add('type-select-card--multi-linked');

    const desc = card.querySelector('.type-select-card__desc');
    if (desc && !desc.dataset.originalDesc) {
      desc.dataset.originalDesc = desc.textContent || '';
      desc.textContent = `${desc.dataset.originalDesc} · 만능형으로 작성`;
    }

    card.addEventListener('click', e => {
      e.preventDefault();
      e.stopImmediatePropagation();
      history.pushState(null, '', `#/write?type=multi&preset=${preset}`);
      window.dispatchEvent(new Event('hashchange'));
    }, true);
  });
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(enhanceTypeCards, 120);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 600);
