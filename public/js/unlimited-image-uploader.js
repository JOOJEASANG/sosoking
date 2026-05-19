import { initImageUploader } from './components/image-uploader.js';

const READY_ATTR = 'data-unlimited-uploader-ready';

function isWritablePage() {
  const hash = window.location.hash || '';
  return hash.startsWith('#/write') || !!document.querySelector('.multi-write-page');
}

function rewriteHints(root = document) {
  root.querySelectorAll('.form-hint').forEach(hint => {
    const text = hint.textContent || '';
    if (/최대\s*\d+장/.test(text)) {
      hint.textContent = text.replace(/최대\s*\d+장\s*·?\s*/g, '사진 개수 제한 없음 · ');
    }
  });
}

function makeUnlimited(container) {
  if (!container || container.getAttribute(READY_ATTR) === '1') return;
  container.setAttribute(READY_ATTR, '1');

  // 기존 글쓰기 코드가 1장/2장/3장 제한으로 초기화한 뒤에도 여기서 한 번 더 무제한으로 초기화합니다.
  initImageUploader(container, Infinity);

  const hint = container.querySelector('.img-upload-area__hint');
  if (hint) hint.textContent = '사진 개수 제한 없이 추가할 수 있어요';
}

function applyUnlimitedUploaders() {
  if (!isWritablePage()) return;
  rewriteHints();
  document.querySelectorAll('#img-uploader, #mw-img-uploader').forEach(makeUnlimited);
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(applyUnlimitedUploaders, 180);
}

window.addEventListener('hashchange', () => setTimeout(schedule, 250));
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 700);
