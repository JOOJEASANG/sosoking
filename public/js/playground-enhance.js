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
    const random = new Uint32Array(1);
    const hasCrypto = typeof globalThis.crypto?.getRandomValues === 'function';
    if (hasCrypto) globalThis.crypto.getRandomValues(random);
    const value = hasCrypto ? random[0] / 0x100000000 : Math.random();
    const target = Math.floor(value * (index + 1));
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

function setText(element, text) {
  if (element && element.textContent !== text) element.textContent = text;
}

function brandConsult(root) {
  setText(root.querySelector('[data-mode="consult"]'), '🤪 미친 상담소');
  root.querySelectorAll('[data-go="/playground/consult"] strong').forEach(element => setText(element, '미친 상담소'));
  root.querySelectorAll('[data-go="/playground/consult"] small').forEach(element => setText(element, '유머·재치·실행 조언'));
  const hero = root.querySelector('.king-playground__hero');
  if (hero) {
    setText(hero.querySelector('.king-kicker'), '🤪 미친 상담소');
    setText(hero.querySelector('h1'), '고민은 진지해도 상담은 미치게 재밌게');
    setText(hero.querySelector('p'), '뻔한 위로는 퇴근했습니다. 재치 있는 한 줄 진단, 웃긴 비유, 바로 해볼 행동까지 챙겨드립니다.');
  }
  const card = root.querySelector('.king-tool-card');
  if (card) {
    setText(card.querySelector('h2'), '🤪 미친 상담 접수증');
    setText(card.querySelector('.king-tool-card__desc'), '캐릭터를 고르지 않으면 상담사 3명이 무작위로 출근합니다.');
    setText(card.querySelector('.king-tool-card__badge'), '선택 안 하면 랜덤');
    setText(card.querySelector('.king-tool-note'), '평소 고민은 유쾌하게 풀고, 위험하거나 긴급한 상황은 안전과 전문 도움을 먼저 안내합니다.');
    setText(card.querySelector('#king-submit'), '미친 상담 시작하기');
  }
  const resultTitle = root.querySelector('#king-result h2');
  if (resultTitle?.textContent.includes('상담')) setText(resultTitle, '🤪 미친 상담 결과');
}

function addClearButton(container) {
  const label = container.closest('.king-field')?.querySelector('.king-field__label');
  if (!label || label.querySelector('[data-clear-characters]')) return;
  label.append(document.createTextNode(' · 선택하지 않으면 랜덤 '));
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'king-ghost';
  clear.dataset.clearCharacters = 'true';
  clear.textContent = '선택 초기화';
  clear.addEventListener('click', () => {
    container.querySelectorAll('.king-char-option').forEach(button => setSelected(button, false));
    updateCount(container);
  });
  label.append(clear);
}

function enhance() {
  const mode = currentMode();
  if (!MULTI_MODES.has(mode)) return;
  const root = document.querySelector('.king-playground');
  const container = root?.querySelector('#king-char-select');
  if (!root || !container) return;
  if (mode === 'consult') brandConsult(root);
  if (root.dataset.randomReady === 'true') return;
  root.dataset.randomReady = 'true';
  container.querySelectorAll('.king-char-option').forEach(button => setSelected(button, false));
  updateCount(container);
  addClearButton(container);
  root.querySelector('#king-submit')?.addEventListener('click', () => {
    if (selected(container).length === 0) selectRandom(container);
  }, { capture: true });
}

const pageContent = document.getElementById('page-content') || document.body;
new MutationObserver(enhance).observe(pageContent, { childList: true, subtree: true });
window.addEventListener('hashchange', enhance);
enhance();
