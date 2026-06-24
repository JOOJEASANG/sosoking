// crazy-consult-random.js — 미친 상담소 브랜딩과 판결·상담 랜덤 캐릭터 배정

const MULTI_MODES = new Set(['judge', 'consult']);
const RANDOM_COUNT = 3;

function currentMode() {
  const match = String(location.hash || '').match(/^#\/playground\/([^?]+)/);
  return match?.[1] || '';
}

function selectedButtons(container) {
  return [...container.querySelectorAll('.king-char-option.selected')];
}

function setSelected(button, selected) {
  button.classList.toggle('selected', selected);
  button.setAttribute('aria-pressed', selected ? 'true' : 'false');
}

function updateCount(container, randomAssigned = false) {
  const count = selectedButtons(container).length;
  const label = document.getElementById('king-char-count');
  if (!label) return;
  if (randomAssigned) {
    label.textContent = `랜덤 ${RANDOM_COUNT}명 배정 완료`;
  } else if (count === 0) {
    label.textContent = `선택 안 함 · 랜덤 ${RANDOM_COUNT}명`;
  } else {
    label.textContent = `캐릭터 ${count}명 선택`;
  }
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const random = new Uint32Array(1);
    globalThis.crypto?.getRandomValues?.(random);
    const value = globalThis.crypto?.getRandomValues ? random[0] / 0x100000000 : Math.random();
    const target = Math.floor(value * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function assignRandomCharacters(container) {
  const buttons = [...container.querySelectorAll('.king-char-option[data-multiple="true"]')];
  buttons.forEach(button => setSelected(button, false));
  shuffled(buttons).slice(0, RANDOM_COUNT).forEach(button => setSelected(button, true));
  container.dataset.randomAssigned = 'true';
  updateCount(container, true);
}

function prepareRandomChoice(root = document) {
  const mode = currentMode();
  if (!MULTI_MODES.has(mode)) return;
  const container = root.querySelector?.('#king-char-select') || document.querySelector('#king-char-select');
  if (!container || container.dataset.randomChoiceReady === 'true') return;

  container.dataset.randomChoiceReady = 'true';
  container.dataset.randomAssigned = 'false';
  container.querySelectorAll('.king-char-option').forEach(button => setSelected(button, false));
  updateCount(container);
}

function replaceVisibleText(root = document.body) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest('script, style, textarea, input')) continue;
    node.nodeValue = node.nodeValue
      .replace(/성향별 상담소/g, '미친 상담소')
      .replace(/캐릭터 상담소/g, '미친 상담소')
      .replace(/세 가지 관점의 현실 조언/g, '유머·재치·실행 조언');
  }
}

function patchConsultPage(root = document) {
  replaceVisibleText(root.body || root);
  if (currentMode() !== 'consult') return;

  const page = document.querySelector('.king-playground');
  if (!page) return;
  const kicker = page.querySelector('.king-playground__hero .king-kicker');
  const title = page.querySelector('.king-playground__hero h1');
  const description = page.querySelector('.king-playground__hero p');
  const formTitle = page.querySelector('.king-tool-card h2');
  const formDescription = page.querySelector('.king-tool-card__desc');
  const badge = page.querySelector('.king-tool-card__badge');
  const fieldLabel = page.querySelector('#king-char-select')?.closest('.king-field')?.querySelector('.king-field__label');
  const note = page.querySelector('.king-tool-note');
  const submit = page.querySelector('#king-submit');
  const resultTitle = page.querySelector('#king-result h2');

  if (kicker) kicker.textContent = '🤪 미친 상담소';
  if (title) title.textContent = '고민은 진지해도 상담은 미치게 재밌게';
  if (description) description.textContent = '뻔한 위로는 퇴근했습니다. 캐릭터 상담단이 재치 있는 한 줄 진단, 웃긴 비유, 바로 해볼 행동까지 챙겨드립니다.';
  if (formTitle) formTitle.textContent = '🤪 미친 상담 접수증';
  if (formDescription) formDescription.textContent = '고민을 편하게 적어주세요. 캐릭터를 고르지 않으면 그날의 미친 상담사 3명이 무작위로 출근합니다.';
  if (badge) badge.textContent = '선택 안 하면 랜덤';
  if (fieldLabel) fieldLabel.textContent = '상담사 3명 선택 · 선택하지 않으면 랜덤';
  if (note) note.textContent = '평소 고민은 유쾌하게 풀고, 위험하거나 긴급한 상황은 웃음보다 안전과 전문 도움을 먼저 안내합니다.';
  if (submit) submit.textContent = '미친 상담 시작하기';
  if (resultTitle?.textContent.includes('상담')) resultTitle.textContent = '🤪 미친 상담 결과';
}

function refresh() {
  prepareRandomChoice(document);
  patchConsultPage(document);
}

document.addEventListener('click', event => {
  const mode = currentMode();
  if (!MULTI_MODES.has(mode)) return;

  const option = event.target.closest?.('.king-char-option[data-multiple="true"]');
  if (option) {
    const container = option.closest('#king-char-select');
    if (!container) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    container.dataset.randomAssigned = 'false';

    const selected = selectedButtons(container);
    if (option.classList.contains('selected')) {
      setSelected(option, false);
    } else if (selected.length < RANDOM_COUNT) {
      setSelected(option, true);
    }
    updateCount(container);
    return;
  }

  const submit = event.target.closest?.('#king-submit');
  if (!submit) return;
  const container = document.querySelector('#king-char-select');
  if (container && selectedButtons(container).length === 0) assignRandomCharacters(container);
}, true);

const observer = new MutationObserver(() => queueMicrotask(refresh));
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', () => queueMicrotask(refresh));
refresh();
