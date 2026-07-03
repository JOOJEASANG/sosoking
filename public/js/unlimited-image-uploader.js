import { initImageUploader } from './components/image-uploader.js';

const READY_ATTR = 'data-post-image-uploader-ready';
const MAX_IMAGES_PER_POST = 30;

function isWritablePage() {
  const hash = window.location.hash || '';
  return hash.startsWith('#/write') || !!document.querySelector('.multi-write-page');
}

function rewriteHints(root = document) {
  root.querySelectorAll('.form-hint').forEach(hint => {
    const text = hint.textContent || '';
    if (/최대\s*\d+장/.test(text) || /개수 제한 없음/.test(text)) {
      hint.textContent = `사진은 최대 ${MAX_IMAGES_PER_POST}장까지 · PC 본문 폭에 맞게 자동 조절돼요`;
    }
  });
}

function applyPostImageLimit(container) {
  if (!container || container.getAttribute(READY_ATTR) === '1') return;
  container.setAttribute(READY_ATTR, '1');

  // 기존 글쓰기 코드가 1장/2장/3장/무제한으로 초기화한 뒤에도 여기서 게시글 기준 30장으로 통일합니다.
  initImageUploader(container, MAX_IMAGES_PER_POST);

  const hint = container.querySelector('.img-upload-area__hint');
  if (hint) hint.textContent = `사진은 최대 ${MAX_IMAGES_PER_POST}장까지 · PC 본문 폭에 맞게 자동 조절돼요`;
}

function applyUploaders() {
  if (!isWritablePage()) return;
  rewriteHints();
  document.querySelectorAll('#img-uploader, #mw-img-uploader').forEach(applyPostImageLimit);
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(applyUploaders, 180);
}

window.addEventListener('hashchange', () => setTimeout(schedule, 250));
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 700);
