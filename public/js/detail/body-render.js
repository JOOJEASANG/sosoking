import { escHtml } from '../utils/helpers.js';

function safeImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || /[\s"'<>]/.test(raw)) return '';
  try {
    const url = new URL(raw, location.origin);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', location.hostname].includes(url.hostname))) return '';
    return url.toString();
  } catch {
    return '';
  }
}

export function renderImageSection(images) {
  const safeImages = (Array.isArray(images) ? images : []).map(safeImageUrl).filter(Boolean).slice(0, 20);
  if (!safeImages.length) return '';
  const encoded = encodeURIComponent(JSON.stringify(safeImages));
  const visible = safeImages.slice(0, 4);
  const extra = Math.max(0, safeImages.length - 4);
  return `
    <div class="detail-gallery detail-gallery--${Math.min(visible.length, 4)}" data-images="${escHtml(encoded)}">
      ${visible.map((src, index) => `
        <button type="button" class="detail-gallery__thumb" data-gallery-idx="${index}">
          <img src="${escHtml(src)}" alt="게시글 이미지 ${index + 1}" loading="lazy" referrerpolicy="no-referrer">
          ${index === 3 && extra ? `<span class="detail-gallery__more">+${extra}</span>` : ''}
        </button>`).join('')}
    </div>`;
}

export function renderTypeBody() {
  return '';
}

export function renderLegacyInteractive() {
  return '';
}
