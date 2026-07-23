import { escHtml } from './helpers.js';

const EMOJI_RE = /^[\p{Emoji}\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D\s]{1,12}$/u;

export function normalizeNicknameIcon(icon) {
  if (!icon || typeof icon !== 'object') return null;
  if (icon.type === 'emoji') {
    const value = String(icon.value || '').trim().slice(0, 12);
    if (!value || !EMOJI_RE.test(value)) return null;
    return { type: 'emoji', value };
  }
  if (icon.type === 'image') {
    const url = String(icon.url || '').trim();
    try {
      const parsed = new URL(url, location.origin);
      if (!['https:', 'http:'].includes(parsed.protocol)) return null;
      return { type: 'image', url: parsed.toString() };
    } catch {
      return null;
    }
  }
  return null;
}

export function renderNicknameIcon(icon, className = '') {
  const normalized = normalizeNicknameIcon(icon);
  if (!normalized) return '';
  const cls = `nickname-icon ${className}`.trim();
  if (normalized.type === 'image') {
    return `<span class="${cls} nickname-icon--image" aria-hidden="true"><img src="${escHtml(normalized.url)}" alt=""></span>`;
  }
  return `<span class="${cls} nickname-icon--emoji" aria-hidden="true">${escHtml(normalized.value)}</span>`;
}

export function renderDisplayName(name, icon, className = '') {
  return `${renderNicknameIcon(icon, className)}<span class="nickname-text">${escHtml(name || '익명')}</span>`;
}
