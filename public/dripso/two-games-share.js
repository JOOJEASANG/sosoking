const ACTIVE_MODES = Object.freeze({
  naming: {
    label: '미친작명소',
    icon: '🤪',
    short: '무엇이든 제일 미친 이름을 붙여주세요.',
    example: '퇴근 직전 업무 투척 기술의 이름은?'
  },
  wrong: {
    label: '오답제작소',
    icon: '💥',
    short: '정답 말고 제일 웃긴 오답으로 붙습니다.',
    example: '회사에서 가장 중요한 자원은? 정답 금지.'
  }
});

const RETIRED_MODES = new Set(['blank', 'comeback', 'headline', 'excuse', 'manual']);
const ACTIVE_KEYS = new Set(Object.keys(ACTIVE_MODES));
let queued = false;
let toastTimer = 0;

function currentTopicId() {
  const match = (location.hash || '').match(/^#\/topic\/([^?]+)/);
  if (!match) return '';
  try { return decodeURIComponent(match[1]); }
  catch { return ''; }
}

function currentModeFromElement(element) {
  if (!element) return '';
  for (const key of Object.keys(ACTIVE_MODES)) {
    if (element.matches?.(`.mode-${key}, .battle-${key}`) || element.querySelector?.(`.battle-${key}`)) return key;
  }
  return '';
}

function showNotice(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2600);
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  return ok;
}

async function shareLink({ title, text, url }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
      console.warn('native share failed:', error);
    }
  }
  await copyText(`${text}\n${url}`.trim());
  showNotice('초대 링크를 복사했습니다. 카카오톡에 붙여넣어 보내주세요.');
  return 'copied';
}

function normalizeSelect() {
  const select = document.getElementById('battle-mode');
  if (!select) return;
  Array.from(select.options).forEach(option => {
    if (!ACTIVE_KEYS.has(option.value)) option.remove();
  });
  for (const [key, meta] of Object.entries(ACTIVE_MODES)) {
    const option = Array.from(select.options).find(item => item.value === key);
    if (option && option.textContent !== `${meta.icon} ${meta.label}`) option.textContent = `${meta.icon} ${meta.label}`;
  }
  if (!ACTIVE_KEYS.has(select.value)) {
    select.value = 'naming';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function normalizeModeTiles() {
  const grid = document.querySelector('.battle-mode-grid');
  if (!grid) return;
  grid.querySelectorAll('.battle-mode-tile').forEach(tile => {
    const href = tile.getAttribute('href') || '';
    const mode = href.match(/#\/mode\/([^?]+)/)?.[1] || '';
    if (!ACTIVE_KEYS.has(mode)) {
      tile.remove();
      return;
    }
    const meta = ACTIVE_MODES[mode];
    const icon = tile.querySelector('.battle-mode-icon');
    const strong = tile.querySelector('strong');
    const small = tile.querySelector('small');
    const em = tile.querySelector('em');
    if (icon && icon.textContent !== meta.icon) icon.textContent = meta.icon;
    if (strong && strong.textContent !== meta.label) strong.textContent = meta.label;
    if (small && small.textContent !== meta.short) small.textContent = meta.short;
    if (em && em.textContent !== meta.example) em.textContent = meta.example;
  });
  const section = grid.closest('.section-block');
  if (section) {
    const kicker = section.querySelector('.section-kicker');
    const heading = section.querySelector('.v4-section-heading h2');
    if (kicker && kicker.textContent !== '2 SIGNATURE GAMES') kicker.textContent = '2 SIGNATURE GAMES';
    if (heading && heading.textContent !== '둘 중 하나만 골라 바로 붙어보세요') heading.textContent = '둘 중 하나만 골라 바로 붙어보세요';
  }
}

function normalizeModeFilters() {
  document.querySelectorAll('.mode-filter-bar a').forEach(link => {
    const href = link.getAttribute('href') || '';
    const mode = href.match(/#\/mode\/([^?]+)/)?.[1] || '';
    if (mode && !ACTIVE_KEYS.has(mode)) {
      link.remove();
      return;
    }
    if (ACTIVE_KEYS.has(mode)) {
      const meta = ACTIVE_MODES[mode];
      const text = `${meta.icon} ${meta.label}`;
      if (link.textContent !== text) link.textContent = text;
    }
  });
}

function normalizeModeBadges(root = document) {
  for (const [mode, meta] of Object.entries(ACTIVE_MODES)) {
    root.querySelectorAll?.(`.type-badge.battle-${mode}`).forEach(badge => {
      const text = `${meta.icon} ${meta.label}`;
      if (badge.textContent !== text) badge.textContent = text;
    });
  }
  for (const retired of RETIRED_MODES) {
    root.querySelectorAll?.(`.type-badge.battle-${retired}`).forEach(badge => {
      const card = badge.closest('.v4-topic-card');
      if (card) card.remove();
    });
  }
}

function normalizeBrowseHeading() {
  const heading = document.querySelector('.battle-page-heading');
  if (!heading) return;
  const active = Object.keys(ACTIVE_MODES).find(mode => (location.hash || '').includes(`#/mode/${mode}`));
  const h1 = heading.querySelector('h1');
  const description = heading.querySelector('.page-heading-copy > p:last-child');
  const kicker = heading.querySelector('.section-kicker');
  if (active) {
    const meta = ACTIVE_MODES[active];
    if (h1 && h1.textContent !== meta.label) h1.textContent = meta.label;
    if (description && description.textContent !== meta.short) description.textContent = meta.short;
    const kickerText = `${meta.icon} SIGNATURE GAME`;
    if (kicker && kicker.textContent !== kickerText) kicker.textContent = kickerText;
  } else if (description) {
    const text = '미친작명소와 오답제작소, 두 종목의 출전·심사·종료 배틀을 모아봅니다.';
    if (description.textContent !== text) description.textContent = text;
  }
}

function redirectRetiredModeRoute() {
  const match = (location.hash || '').match(/^#\/mode\/([^?]+)/);
  const mode = match?.[1] || '';
  if (mode && !ACTIVE_KEYS.has(mode)) location.replace('/dripso/#/');
}

function renameTopicDetail() {
  const detail = document.querySelector('.v4-topic-detail');
  if (!detail) return;
  const mode = currentModeFromElement(detail);
  if (!mode) return;
  const meta = ACTIVE_MODES[mode];
  const badge = detail.querySelector(`.type-badge.battle-${mode}`);
  const text = `${meta.icon} ${meta.label}`;
  if (badge && badge.textContent !== text) badge.textContent = text;
}

function ensureInviteButton() {
  const topicId = currentTopicId();
  const detail = document.querySelector('.v4-topic-detail');
  if (!topicId || !detail || detail.querySelector('[data-dripso-invite]')) return;
  const mode = currentModeFromElement(detail);
  if (!mode || !ACTIVE_MODES[mode]) return;
  const meta = ACTIVE_MODES[mode];
  const prompt = detail.querySelector('.topic-prompt')?.textContent?.trim() || '';
  const title = detail.querySelector('h1')?.textContent?.trim() || meta.label;
  const recruiting = Boolean(detail.querySelector('.battle-status-chip.recruiting'));

  const bar = document.createElement('div');
  bar.className = 'dripso-invite-bar';
  bar.dataset.dripsoInvite = 'true';
  const copy = document.createElement('div');
  copy.className = 'dripso-invite-copy';
  const strong = document.createElement('strong');
  const small = document.createElement('small');
  strong.textContent = recruiting ? '친구랑 붙어볼까요?' : '이 배틀이 웃겼다면 공유하세요';
  small.textContent = recruiting
    ? '링크를 보내면 친구가 바로 이 배틀에 출전할 수 있습니다.'
    : '친구에게 결과와 주제를 링크로 보낼 수 있습니다.';
  copy.append(strong, small);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dripso-invite-button';
  button.textContent = recruiting ? '💬 카톡·친구 초대' : '🔗 배틀 공유';
  button.addEventListener('click', async () => {
    const url = `${location.origin}/dripso/#/topic/${encodeURIComponent(topicId)}`;
    const challenge = mode === 'naming'
      ? `🤪 미친작명소 도전! “${prompt || title}” 나랑 이름 한 판 붙자.`
      : `💥 오답제작소 도전! “${prompt || title}” 정답 쓰면 지는 게임. 오답으로 붙자.`;
    await shareLink({ title: `${meta.label} · 드립소`, text: challenge, url });
  });
  bar.append(copy, button);
  const phasePanel = detail.querySelector('.battle-phase-panel, .phase-panel');
  if (phasePanel) phasePanel.insertAdjacentElement('afterend', bar);
  else detail.append(bar);
}

function normalize() {
  redirectRetiredModeRoute();
  normalizeSelect();
  normalizeModeTiles();
  normalizeModeFilters();
  normalizeModeBadges(document);
  normalizeBrowseHeading();
  renameTopicDetail();
  ensureInviteButton();
}

function schedule() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    normalize();
  });
}

window.addEventListener('hashchange', schedule);
window.addEventListener('dripso:rendered', schedule);
window.addEventListener('pageshow', schedule);
normalize();
