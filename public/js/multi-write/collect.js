export function splitTags(raw) {
  return String(raw || '')
    .split(',')
    .map(tag => tag.replace(/^#/, '').trim())
    .filter(Boolean)
    .filter((tag, index, list) => list.indexOf(tag) === index)
    .slice(0, 8);
}

function htmlToPlainText(html) {
  const element = document.createElement('div');
  element.innerHTML = String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:div|p)>/gi, '\n');
  return (element.textContent || '').replace(/\n{4,}/g, '\n\n\n').trim();
}

function isGhost(element) {
  return element?.dataset?.templateGhost === '1';
}

export function getBodyText() {
  const desc = document.getElementById('mw-desc');
  if (isGhost(desc) || document.getElementById('mw-rich-editor')?.dataset.templateGhost === '1') return '';
  return desc?.dataset.plainText || htmlToPlainText(desc?.value || '') || desc?.value?.trim?.() || '';
}

export function getBodyHtml() {
  const desc = document.getElementById('mw-desc');
  if (isGhost(desc) || document.getElementById('mw-rich-editor')?.dataset.templateGhost === '1') return '';
  return desc?.value?.trim?.() || '';
}
