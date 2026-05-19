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
      // input 자체를 누르면 브라우저 기본 체크 동작만 사용합니다.
      if (e.target === input) {
        setTimeout(() => syncModuleCard(input), 0);
        return;
      }

      // label 안의 아이콘/텍스트를 눌렀을 때만 수동 토글합니다.
      e.preventDefault();
      input.checked = !input.checked;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
}

function setTextIfChanged(el, next) {
  if (!el || el.textContent === next) return;
  el.textContent = next;
}

function normalizeRelayText() {
  // 전역 텍스트 노드 전체를 계속 훑으면 MutationObserver와 충돌해서 글자가 깜빡일 수 있으므로,
  // 실제 유형 표시 요소만 대상으로 고정합니다.
  document.querySelectorAll('[data-type="relay"], [data-type-filter="relay"], [data-type-quick="relay"]').forEach(el => {
    if (el.matches('button, a, .type-select-card, .type-chip, .filter-chip')) {
      const current = el.textContent || '';
      if (current.includes('막장킹')) setTextIfChanged(el, current.replaceAll('막장킹', '막장릴레이'));
      return;
    }
    if (el.textContent?.includes('막장킹')) {
      setTextIfChanged(el, el.textContent.replaceAll('막장킹', '막장릴레이'));
    }
  });

  document.querySelectorAll('.feed-card__type-badge, .detail-type-badge, .badge').forEach(el => {
    const text = el.textContent || '';
    if (text.includes('막장킹')) {
      setTextIfChanged(el, text.replaceAll('막장킹', '막장릴레이'));
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
  }, 120);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 500);
