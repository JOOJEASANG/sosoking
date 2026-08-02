const DAILY_MAX_LENGTH = 120;

function replaceNamingLabels(root = document) {
  const selectors = [
    '.dripso-bottom-nav [data-nav="naming"] small',
    '.menu-tile[href="#/naming"] strong',
    '.type-badge.naming',
    '.page-heading h1',
    '.back-button',
    '#topic-type option[value="naming"]'
  ];

  selectors.forEach(selector => {
    root.querySelectorAll?.(selector).forEach(element => {
      const text = String(element.textContent || '');
      if (text.includes('이름짓기')) {
        element.textContent = text.replaceAll('이름짓기', '미친작명소');
      }
    });
  });

  document.title = document.title.replaceAll('이름짓기', '미친작명소');
  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription?.content.includes('이름짓기')) {
    ogDescription.content = ogDescription.content.replaceAll('이름짓기', '미친작명소');
  }
}

function applyDailyOneLineInput(root = document) {
  const dailyTopic = root.querySelector?.('.topic-detail .type-badge.daily')
    || document.querySelector('.topic-detail .type-badge.daily');
  if (!dailyTopic) return;

  const form = document.querySelector('.comment-form[data-comment-form]');
  const area = form?.querySelector('textarea[name="text"]');
  if (!area || area.dataset.dailyOneLine === 'true') return;

  area.dataset.dailyOneLine = 'true';
  area.classList.add('daily-one-line-input');
  area.rows = 1;
  area.maxLength = DAILY_MAX_LENGTH;
  area.setAttribute('wrap', 'off');
  area.setAttribute('aria-label', '오늘의 한줄 입력');
  area.placeholder = `한 줄로 입력해 주세요. 최대 ${DAILY_MAX_LENGTH}자`;

  const help = document.createElement('small');
  help.className = 'daily-one-line-help';
  help.textContent = `오늘의 한줄은 줄바꿈 없이 최대 ${DAILY_MAX_LENGTH}자까지 등록됩니다.`;
  area.insertAdjacentElement('afterend', help);

  area.addEventListener('input', () => {
    const normalized = area.value.replace(/[\r\n]+/g, ' ');
    if (normalized !== area.value) area.value = normalized;
  });

  area.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    form.requestSubmit();
  });
}

function normalizeDripsoUi(root = document) {
  replaceNamingLabels(root);
  applyDailyOneLineInput(root);
}

function start() {
  const host = document.getElementById('dripso-app') || document.body;
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      normalizeDripsoUi(host);
    });
  };

  normalizeDripsoUi(document);
  new MutationObserver(schedule).observe(host, { childList: true, subtree: true });
  window.addEventListener('hashchange', schedule);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}

export { normalizeDripsoUi };
