const MULTI_MODES = new Set(['judge', 'consult']);
const CHARACTER_COUNT = 3;

function currentMode() {
  return String(location.hash || '').match(/^#\/playground\/([^?]+)/)?.[1] || '';
}

function selected(container) {
  return [...container.querySelectorAll('.king-char-option.selected')];
}

function setSelected(button, value) {
  button.classList.toggle('selected', value);
  button.setAttribute('aria-pressed', value ? 'true' : 'false');
}

function updateCount(container, random = false) {
  const label = document.getElementById('king-char-count');
  if (!label) return;
  const count = selected(container).length;
  label.textContent = random ? '랜덤 3명 배정 완료' : count ? `캐릭터 ${count}명 선택` : '선택 안 함 · 제출 시 랜덤 3명';
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function selectRandom(container) {
  const buttons = [...container.querySelectorAll('.king-char-option')];
  buttons.forEach(button => setSelected(button, false));
  shuffle(buttons).slice(0, CHARACTER_COUNT).forEach(button => setSelected(button, true));
  updateCount(container, true);
}

function brandConsult(root) {
  const hero = root.querySelector('.king-playground__hero');
  if (!hero) return;
  hero.querySelector('.king-kicker').textContent = '🤪 미친 상담소';
  hero.querySelector('h1').textContent = '고민은 진지해도 상담은 재미있게';
  hero.querySelector('p').textContent = '뻔한 위로 대신 재치 있는 진단, 웃긴 비유, 바로 해볼 행동까지 챙겨드립니다.';
  const card = root.querySelector('.king-tool-card');
  if (card) {
    card.querySelector('h2').textContent = '🤪 미친 상담 접수증';
    card.querySelector('.king-tool-card__desc').textContent = '캐릭터를 고르지 않으면 상담사 3명이 무작위로 출근합니다.';
    card.querySelector('.king-tool-card__badge').textContent = '선택 안 하면 랜덤';
  }
}

function enhance() {
  const mode = currentMode();
  if (!MULTI_MODES.has(mode)) return;
  const root = document.querySelector('.king-playground');
  const container = root?.querySelector('#king-char-select');
  if (!root || !container || root.dataset.randomReady === 'true') return;
  root.dataset.randomReady = 'true';
  container.querySelectorAll('.king-char-option').forEach(button => setSelected(button, false));
  updateCount(container);

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'king-ghost';
  clear.textContent = '선택 초기화';
  clear.addEventListener('click', () => {
    container.querySelectorAll('.king-char-option').forEach(button => setSelected(button, false));
    updateCount(container);
  });
  container.closest('.king-field')?.querySelector('.king-field__label')?.append(' · 선택하지 않으면 랜덤 ', clear);

  root.querySelector('#king-submit')?.addEventListener('click', () => {
    if (selected(container).length === 0) selectRandom(container);
  }, { capture: true });

  if (mode === 'consult') brandConsult(root);
}

new MutationObserver(enhance).observe(document.getElementById('page-content') || document.body, { childList: true, subtree: true });
window.addEventListener('hashchange', enhance);
enhance();
