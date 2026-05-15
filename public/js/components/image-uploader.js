import { storage, auth } from '../firebase.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { toast } from './toast.js';

let uploadedFiles = []; // { file, dataUrl, storageUrl }
let maxFiles = 5;

export function initImageUploader(container, max = 5) {
  maxFiles = max;
  uploadedFiles = [];
  renderUploader(container);
}

export async function getUploadedImages() {
  if (!auth.currentUser || uploadedFiles.length === 0) return [];
  const urls = [];
  for (const item of uploadedFiles) {
    if (item.storageUrl) { urls.push(item.storageUrl); continue; }
    try {
      const path = `feeds/${auth.currentUser.uid}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
      const storageRef = ref(storage, path);
      const blob = await compressImage(item.file);
      await uploadBytes(storageRef, blob);
      item.storageUrl = await getDownloadURL(storageRef);
      urls.push(item.storageUrl);
    } catch (e) {
      console.error('이미지 업로드 실패', e);
    }
  }
  return urls;
}

function renderUploader(container) {
  container.innerHTML = `
    <div class="img-upload-area" id="img-drop-zone">
      <div class="img-upload-area__icon">📷</div>
      <div class="img-upload-area__text">클릭하거나 사진을 끌어다 놓으세요</div>
      <input type="file" id="img-file-input" accept="image/*" multiple style="display:none">
    </div>
    <div class="img-preview-grid" id="img-preview-grid"></div>
  `;

  const dropZone  = container.querySelector('#img-drop-zone');
  const fileInput = container.querySelector('#img-file-input');

  dropZone.addEventListener('click',   () => fileInput.click());
  fileInput.addEventListener('change', (e) => handleFiles(e.target.files, container));

  dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop',      (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files, container);
  });
}

async function handleFiles(files, container) {
  const remaining = maxFiles - uploadedFiles.length;
  if (remaining <= 0) { toast.warn(`최대 ${maxFiles}장까지 올릴 수 있어요`); return; }
  const toProcess = [...files].slice(0, remaining);

  for (const file of toProcess) {
    if (!file.type.startsWith('image/')) continue;
    const dataUrl = await readAsDataUrl(file);
    uploadedFiles.push({ file, dataUrl, storageUrl: null });
  }
  renderPreviews(container);
}

function renderPreviews(container) {
  const grid = container.querySelector('#img-preview-grid');
  if (!grid) return;
  grid.innerHTML = uploadedFiles.map((item, i) => `
    <div class="img-preview-item" data-idx="${i}">
      <img src="${item.dataUrl}" alt="미리보기 ${i+1}">
      ${i === 0 ? '<div class="img-preview-star">대표</div>' : ''}
      <button class="img-preview-remove" data-remove="${i}" title="삭제">✕</button>
    </div>`).join('');

  grid.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.remove);
      uploadedFiles.splice(idx, 1);
      renderPreviews(container);
    });
  });
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function compressImage(file, maxSide = 1600, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxSide || height > maxSide) {
        const ratio = Math.min(maxSide / width, maxSide / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(resolve, 'image/jpeg', quality);
    };
    img.src = url;
  });
}
