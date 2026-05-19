import { db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

function getDetailId() {
  const hash = window.location.hash || '';
  const match = hash.match(/^#\/detail\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function safeUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  try {
    const parsed = new URL(url, location.origin);
    if (!['https:', 'http:'].includes(parsed.protocol)) return '';
    return parsed.toString().replace(/"/g, '&quot;');
  } catch {
    return '';
  }
}

function openImageModal(images, index = 0) {
  const list = images.map(safeUrl).filter(Boolean);
  if (!list.length) return;
  let current = Math.max(0, Math.min(index, list.length - 1));
  const existing = document.getElementById('detail-image-inline-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'detail-image-inline-modal';
  overlay.className = 'detail-image-inline-modal';
  overlay.innerHTML = `
    <div class="detail-image-inline-modal__backdrop"></div>
    <div class="detail-image-inline-modal__body">
      <button class="detail-image-inline-modal__close" type="button" aria-label="닫기">✕</button>
      <img src="${list[current]}" alt="게시글 사진 확대">
      ${list.length > 1 ? `
        <button class="detail-image-inline-modal__nav detail-image-inline-modal__nav--prev" type="button" aria-label="이전">‹</button>
        <button class="detail-image-inline-modal__nav detail-image-inline-modal__nav--next" type="button" aria-label="다음">›</button>` : ''}
    </div>`;
  document.body.appendChild(overlay);

  const img = overlay.querySelector('img');
  const render = () => { img.src = list[current]; };
  overlay.querySelector('.detail-image-inline-modal__close')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('.detail-image-inline-modal__backdrop')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('.detail-image-inline-modal__nav--prev')?.addEventListener('click', () => { current = (current - 1 + list.length) % list.length; render(); });
  overlay.querySelector('.detail-image-inline-modal__nav--next')?.addEventListener('click', () => { current = (current + 1) % list.length; render(); });
}

function renderInlineImages(images, postId) {
  const list = images.map(safeUrl).filter(Boolean);
  if (!list.length) return '';
  return `
    <div class="detail-inline-images" data-detail-inline-images="${postId}">
      ${list.map((src, i) => `
        <button class="detail-inline-image" type="button" data-inline-image-idx="${i}" aria-label="사진 ${i + 1} 크게 보기">
          <img src="${src}" alt="게시글 사진 ${i + 1}" loading="eager">
        </button>`).join('')}
    </div>`;
}

async function ensureDetailImages() {
  const postId = getDetailId();
  if (!postId) return;
  const root = document.getElementById('page-content');
  if (!root) return;
  const detailBody = root.querySelector('.detail-body');
  const detailHeader = root.querySelector('.detail-header');
  if (!detailBody || !detailHeader) return;

  const existingInline = root.querySelector(`[data-detail-inline-images="${CSS.escape(postId)}"]`);
  if (existingInline) return;

  try {
    const snap = await getDoc(doc(db, 'feeds', postId));
    if (!snap.exists()) return;
    const images = Array.isArray(snap.data().images) ? snap.data().images : [];
    if (!images.length) return;

    // 기존 상세 갤러리가 CSS 충돌로 안 보이는 경우가 있어, 본문 최상단에 별도 이미지 블록을 확실히 추가합니다.
    const oldGallery = root.querySelector('.detail-gallery');
    if (oldGallery) oldGallery.classList.add('detail-gallery--legacy-hidden');

    detailBody.insertAdjacentHTML('afterbegin', renderInlineImages(images, postId));
    root.querySelectorAll('.detail-inline-image').forEach(btn => {
      btn.addEventListener('click', () => openImageModal(images, Number(btn.dataset.inlineImageIdx || 0)));
    });
  } catch (error) {
    console.warn('[detail-image-visibility-patch] failed', error);
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(ensureDetailImages, 120);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 400);
