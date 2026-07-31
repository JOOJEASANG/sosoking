import { JOKES } from './jokes.js?v=20260731-dripso-1';

const STORAGE_KEYS = {
  saved: 'dripso.saved.v1',
  laughs: 'dripso.laughs.v1'
};

const state = {
  category: '전체',
  savedOnly: false,
  order: [...JOKES],
  spotlightId: '',
  saved: readSet(STORAGE_KEYS.saved),
  laughs: readObject(STORAGE_KEYS.laughs)
};

const elements = {
  grid: document.getElementById('joke-grid'),
  empty: document.getElementById('empty-state'),
  count: document.getElementById('result-count'),
  kicker: document.getElementById('feed-kicker'),
  categoryRow: document.getElementById('category-row'),
  savedToggle: document.getElementById('saved-toggle'),
  savedCount: document.getElementById('saved-count'),
  spotlightText: document.getElementById('spotlight-text'),
  spotlightCategory: document.getElementById('spotlight-category'),
  randomJoke: document.getElementById('random-joke'),
  shareSpotlight: document.getElementById('share-spotlight'),
  shuffleFeed: document.getElementById('shuffle-feed'),
  toast: document.getElementById('toast')
};

let toastTimer = 0;

function readSet(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(value) ? value.map(String) : []);
  } catch {
    return new Set();
  }
}

function readObject(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    showToast('이 브라우저에서는 저장 기능을 사용할 수 없습니다.');
  }
}

function showToast(message) {
  if (!elements.toast) return;
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 1900);
}

function jokeById(id) {
  return JOKES.find(joke => joke.id === id) || JOKES[0];
}

function dailyJoke() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date()).split('-').map(Number);
  const seed = parts.reduce((total, value, index) => total + value * (index + 11), 0);
  return JOKES[seed % JOKES.length];
}

function randomJoke(excludeId = '') {
  const candidates = JOKES.filter(joke => joke.id !== excludeId);
  return candidates[Math.floor(Math.random() * candidates.length)] || JOKES[0];
}

function renderSpotlight(joke) {
  state.spotlightId = joke.id;
  elements.spotlightText.textContent = joke.text;
  elements.spotlightCategory.textContent = joke.category;
}

function filteredJokes() {
  return state.order.filter(joke => {
    const categoryMatches = state.category === '전체' || joke.category === state.category;
    const savedMatches = !state.savedOnly || state.saved.has(joke.id);
    return categoryMatches && savedMatches;
  });
}

function button(label, className, action, id, pressed = false) {
  const control = document.createElement('button');
  control.type = 'button';
  control.className = `card-button ${className}${pressed ? ' active' : ''}`;
  control.dataset.action = action;
  control.dataset.id = id;
  control.setAttribute('aria-pressed', String(pressed));
  control.textContent = label;
  return control;
}

function renderCard(joke, index) {
  const article = document.createElement('article');
  article.className = 'joke-card';
  article.dataset.id = joke.id;

  const meta = document.createElement('div');
  meta.className = 'card-meta';

  const category = document.createElement('span');
  category.className = 'card-category';
  category.textContent = joke.category;

  const number = document.createElement('span');
  number.className = 'card-number';
  number.textContent = String(index + 1).padStart(2, '0');

  const text = document.createElement('p');
  text.className = 'joke-text';
  text.textContent = joke.text;

  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const laughCount = Math.max(0, Number(state.laughs[joke.id]) || 0);
  actions.append(
    button(`피식 ${laughCount || ''}`.trim(), 'laugh', 'laugh', joke.id, laughCount > 0),
    button(state.saved.has(joke.id) ? '저장됨' : '저장', 'save', 'save', joke.id, state.saved.has(joke.id)),
    button('복사', 'copy', 'copy', joke.id)
  );

  meta.append(category, number);
  article.append(meta, text, actions);
  return article;
}

function renderFeed() {
  const jokes = filteredJokes();
  elements.grid.replaceChildren(...jokes.map(renderCard));
  elements.empty.hidden = jokes.length > 0;
  elements.count.textContent = `${jokes.length}개`;
  elements.kicker.textContent = state.savedOnly
    ? (state.category === '전체' ? '저장한 드립' : `저장한 ${state.category} 드립`)
    : `${state.category} 드립`;
  elements.savedCount.textContent = String(state.saved.size);
  elements.savedToggle.setAttribute('aria-pressed', String(state.savedOnly));
}

function selectCategory(category) {
  state.category = category;
  elements.categoryRow.querySelectorAll('[data-category]').forEach(chip => {
    const active = chip.dataset.category === category;
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-pressed', String(active));
  });
  renderFeed();
}

function toggleSave(id) {
  if (state.saved.has(id)) {
    state.saved.delete(id);
    showToast('저장함에서 뺐습니다.');
  } else {
    state.saved.add(id);
    showToast('저장함에 넣었습니다.');
  }
  writeStorage(STORAGE_KEYS.saved, [...state.saved]);
  renderFeed();
}

function laugh(id) {
  state.laughs[id] = Math.min(999, Math.max(0, Number(state.laughs[id]) || 0) + 1);
  writeStorage(STORAGE_KEYS.laughs, state.laughs);
  showToast('피식이 기록됐습니다.');
  renderFeed();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('드립을 복사했습니다.');
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    showToast(copied ? '드립을 복사했습니다.' : '복사하지 못했습니다.');
    return copied;
  }
}

async function shareJoke(joke) {
  const text = `${joke.text}\n\n드립소에서 보냄`;
  if (navigator.share) {
    try {
      await navigator.share({ title: '드립소', text, url: `${location.origin}/dripso` });
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  await copyText(text);
}

function shuffle(items) {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [output[index], output[other]] = [output[other], output[index]];
  }
  return output;
}

elements.categoryRow.addEventListener('click', event => {
  const chip = event.target.closest('[data-category]');
  if (chip) selectCategory(chip.dataset.category || '전체');
});

elements.savedToggle.addEventListener('click', () => {
  state.savedOnly = !state.savedOnly;
  renderFeed();
});

elements.randomJoke.addEventListener('click', () => {
  renderSpotlight(randomJoke(state.spotlightId));
});

elements.shareSpotlight.addEventListener('click', () => {
  void shareJoke(jokeById(state.spotlightId));
});

elements.shuffleFeed.addEventListener('click', () => {
  state.order = shuffle(state.order);
  renderFeed();
  showToast('드립 순서를 섞었습니다.');
});

elements.grid.addEventListener('click', event => {
  const control = event.target.closest('[data-action][data-id]');
  if (!control) return;
  const id = control.dataset.id || '';
  const action = control.dataset.action || '';
  if (action === 'laugh') laugh(id);
  if (action === 'save') toggleSave(id);
  if (action === 'copy') void copyText(jokeById(id).text);
});

renderSpotlight(dailyJoke());
renderFeed();
