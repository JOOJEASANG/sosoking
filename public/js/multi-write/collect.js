export function splitTags(raw) {
  return String(raw || '')
    .split(',')
    .map(t => t.replace('#', '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function htmlToPlainText(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/div>/gi, '\n').replace(/<\/p>/gi, '\n');
  return (tmp.textContent || '').replace(/\n{4,}/g, '\n\n\n').trim();
}

function isGhost(el) {
  return el?.dataset?.templateGhost === '1';
}

function realValue(el) {
  if (!el || isGhost(el)) return '';
  return el.value?.trim?.() || '';
}

export function getBodyText() {
  const desc = document.getElementById('mw-desc');
  if (isGhost(desc) || document.getElementById('mw-rich-editor')?.dataset.templateGhost === '1') return '';
  return desc?.dataset.plainText || htmlToPlainText(desc?.value || '') || desc?.value.trim() || '';
}

export function getBodyHtml() {
  const desc = document.getElementById('mw-desc');
  if (isGhost(desc) || document.getElementById('mw-rich-editor')?.dataset.templateGhost === '1') return '';
  return desc?.value.trim() || '';
}

export function isAnonymousWriteChecked() {
  return !!document.getElementById('mw-anonymous-toggle')?.checked;
}

function enabled(key) {
  return !!document.querySelector(`[data-module-toggle="${key}"]`);
}

function getTitleText() {
  return realValue(document.getElementById('mw-title'));
}

function getVoteOptions() {
  return [...document.querySelectorAll('.mw-vote-option')]
    .map(input => realValue(input))
    .filter(Boolean);
}

export function collectMultiModules() {
  const modules = { comments: { enabled: true } };
  const bodyText = getBodyText();

  if (isAnonymousWriteChecked()) {
    modules.anonymous = { enabled: true, mode: 'general-option' };
  }

  if (enabled('collect')) {
    const caption = realValue(document.getElementById('mw-collect-caption')) || bodyText;
    modules.collect = { enabled: true, kind: 'image', label: '웃긴그림', caption };
  }

  if (enabled('vote')) {
    const options = getVoteOptions();
    const voteMode = document.getElementById('mw-vote-mode')?.value || 'general';
    const question = bodyText || getTitleText();
    if (!question) throw new Error('토론 주제를 입력해주세요.');
    if (options.length < 2) throw new Error('선택지를 2개 이상 입력해주세요.');
    const voteData = { enabled: true, question, options: options.map(text => ({ text, votes: 0 })) };
    if (voteMode !== 'general') voteData.voteMode = voteMode;
    modules.vote = voteData;
  }

  if (enabled('drip')) {
    modules.drip = { enabled: true, prompt: bodyText.slice(0, 80), maxLength: 50, responseLabel: '한 줄 드립' };
  }

  return modules;
}
