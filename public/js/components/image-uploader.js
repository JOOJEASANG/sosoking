import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from './toast.js';

const callUpload = httpsCallable(functions, 'uploadFeedImage');
const callDelete = httpsCallable(functions, 'deleteUploadedFeedImages');
let items = [];
let maxFiles = 20;
let containerRef = null;

function imageKind(file) {
  const type = String(file?.type || '').toLowerCase();
  if (type === 'image/gif') return { type: 'image/gif', ext: 'gif', animated: true };
  if (type === 'image/png') return { type: 'image/png', ext: 'png', animated: false };
  if (type === 'image/webp') return { type: 'image/webp', ext: 'webp', animated: false };
  return { type: 'image/jpeg', ext: 'jpg', animated: false };
}

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
    reader.readAsDataURL(blob);
  });
}

async function compressImage(file) {
  const kind = imageKind(file);
  if (kind.animated || file.size <= 1_500_000) return file;
  const dataUrl = await readAsDataUrl(file);
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('이미지를 열지 못했습니다.'));
    image.src = dataUrl;
  });
  const scale = Math.min(1, 1920 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  const outputType = kind.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('이미지 압축에 실패했습니다.')), outputType, 0.86);
  });
}

async function uploadItem(item) {
  if (item.url) return item.url;
  if (!auth.currentUser || auth.currentUser.isAnonymous) throw new Error('정식 회원 로그인 후 이미지를 올릴 수 있어요.');
  const blob = await compressImage(item.file);
  const dataUrl = await readAsDataUrl(blob);
  const result = await callUpload({ dataUrl });
  const url = result.data?.url;
  const path = result.data?.path;
  if (!url || !path) throw new Error('이미지 업로드 응답이 올바르지 않습니다.');
  item.url = url;
  item.path = path;
  return url;
}

export function initImageUploader(container, max = 20) {
  containerRef = container;
  maxFiles = Math.max(1, Math.min(20, Number(max) || 20));
  items = [];
  if (!container) return;
  container.innerHTML = `
    <div class="img-upload-area" data-image-drop>
      <div class="img-upload-area__icon">📷</div>
      <div class="img-upload-area__text">클릭하거나 사진을 끌어다 놓으세요</div>
      <div class="img-upload-area__hint">JPG, PNG, WEBP, GIF · 최대 ${maxFiles}장</div>
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden data-image-input>
    </div>
    <div class="img-preview-grid" data-image-previews></div>`;
  const drop = container.querySelector('[data-image-drop]');
  const input = container.querySelector('[data-image-input]');
  drop?.addEventListener('click', () => input?.click());
  input?.addEventListener('change', event => addFiles(event.target.files));
  drop?.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('drag-over'); });
  drop?.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
  drop?.addEventListener('drop', event => {
    event.preventDefault();
    drop.classList.remove('drag-over');
    addFiles(event.dataTransfer?.files);
  });
}

async function addFiles(fileList) {
  const available = maxFiles - items.length;
  const files = [...(fileList || [])].slice(0, Math.max(0, available));
  if (!files.length) {
    toast.warn(`사진은 최대 ${maxFiles}장까지 올릴 수 있어요.`);
    return;
  }
  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      toast.warn(`${file.name} 파일은 지원하지 않는 형식이에요.`);
      continue;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.warn(`${file.name} 파일이 너무 큽니다.`);
      continue;
    }
    items.push({ file, preview: await readAsDataUrl(file), url: '', path: '' });
  }
  renderPreviews();
}

function renderPreviews() {
  const grid = containerRef?.querySelector('[data-image-previews]');
  if (!grid) return;
  grid.innerHTML = items.map((item, index) => `
    <div class="img-preview-item" data-image-index="${index}">
      <img src="${item.preview}" alt="미리보기 ${index + 1}">
      ${index === 0 ? '<div class="img-preview-star">대표</div>' : ''}
      <div class="img-preview-toolbar">
        ${index > 0 ? `<button type="button" class="img-tool-btn" data-image-up="${index}" title="앞으로">↑</button>` : ''}
        ${index < items.length - 1 ? `<button type="button" class="img-tool-btn" data-image-down="${index}" title="뒤로">↓</button>` : ''}
        <button type="button" class="img-tool-btn img-tool-btn--remove" data-image-remove="${index}" title="삭제">✕</button>
      </div>
    </div>`).join('');
  grid.querySelectorAll('[data-image-remove]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.imageRemove);
    const [removed] = items.splice(index, 1);
    if (removed?.path) callDelete({ paths: [removed.path] }).catch(() => {});
    renderPreviews();
  }));
  grid.querySelectorAll('[data-image-up]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.imageUp);
    [items[index - 1], items[index]] = [items[index], items[index - 1]];
    renderPreviews();
  }));
  grid.querySelectorAll('[data-image-down]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.imageDown);
    [items[index], items[index + 1]] = [items[index + 1], items[index]];
    renderPreviews();
  }));
}

export function hasPendingImages() {
  return items.some(item => !item.url);
}

export async function getUploadedImages() {
  const urls = [];
  for (const item of items) urls.push(await uploadItem(item));
  return urls;
}

export function getUploadedImagePaths() {
  return items.map(item => item.path).filter(Boolean);
}

export async function cleanupUploadedImages() {
  const paths = getUploadedImagePaths();
  if (!paths.length) return;
  await callDelete({ paths }).catch(() => {});
  items = [];
}

export async function uploadSingleImage(file) {
  const item = { file, preview: await readAsDataUrl(file), url: '', path: '' };
  return uploadItem(item);
}
