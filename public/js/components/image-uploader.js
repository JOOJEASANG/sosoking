import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from './toast.js';

const MAX_IMAGES_PER_POST = 30;
const UPLOAD_MAX_WIDTH = 1280;
const UPLOAD_MAX_HEIGHT = 1920;
const UPLOAD_JPEG_QUALITY = 0.82;

let uploadedFiles = []; // { file, dataUrl, storageUrl }
let maxFiles = MAX_IMAGES_PER_POST;
let uploaderContainer = null;

function normalizeMaxFiles(max) {
  const n = Number(max);
  if (!Number.isFinite(n) || n <= 0) return MAX_IMAGES_PER_POST;
  return Math.min(Math.floor(n), MAX_IMAGES_PER_POST);
}

export function initImageUploader(container, max = MAX_IMAGES_PER_POST) {
  maxFiles = normalizeMaxFiles(max);
  uploadedFiles = [];
  uploaderContainer = container;
  renderUploader(container);
}

export function hasPendingImages() {
  return uploadedFiles.length > 0;
}

export async function getUploadedImages() {
  if (!auth.currentUser || uploadedFiles.length === 0) return [];
  const urls = [];
  const failed = [];

  for (const item of uploadedFiles) {
    if (item.storageUrl) { urls.push(item.storageUrl); continue; }
    try {
      const url = await uploadOneImage(item);
      item.storageUrl = url;
      urls.push(url);
    } catch (e) {
      console.error('이미지 업로드 최종 실패', e);
      failed.push(e);
    }
  }

  if (failed.length > 0) {
    throw new Error(`사진 ${failed.length}장 업로드에 실패했어요. 다시 시도해주세요.`);
  }
  return urls;
}

function getImageKind(file) {
  const type = String(file?.type || '').toLowerCase();
  const name = String(file?.name || '').toLowerCase();
  if (type === 'image/gif' || name.endsWith('.gif')) return { ext: 'gif', contentType: 'image/gif', animated: true };
  if (type === 'image/png' || name.endsWith('.png')) return { ext: 'png', contentType: 'image/png', animated: false };
  if (type === 'image/webp' || name.endsWith('.webp')) return { ext: 'webp', contentType: 'image/webp', animated: false };
  return { ext: 'jpg', contentType: 'image/jpeg', animated: false };
}

export async function uploadSingleImage(file) {
  const kind = getImageKind(file);
  const blob = kind.animated ? file : await resizeImageForUpload(file);
  if (!blob) throw new Error('이미지 압축 실패');
  return uploadViaFunction(blob, kind.animated ? kind : { ext: 'jpg', contentType: 'image/jpeg', animated: false });
}

async function uploadOneImage(item) {
  const kind = getImageKind(item.file);
  const blob = kind.animated ? item.file : await resizeImageForUpload(item.file);
  if (!blob) throw new Error('이미지 압축 실패');
  return uploadViaFunction(blob, kind.animated ? kind : { ext: 'jpg', contentType: 'image/jpeg', animated: false });
}

async function uploadViaFunction(blob, kind = { contentType: 'image/jpeg' }) {
  const dataUrl = await readAsDataUrl(blob, kind.contentType || 'image/jpeg');
  const fn = httpsCallable(functions, 'uploadFeedImage');
  const result = await fn({ dataUrl });
  const url = result.data && result.data.url;
  if (!url) throw new Error('서버 이미지 업로드 응답이 올바르지 않습니다.');
  return url;
}

function renderUploader(container) {
  container.innerHTML = `
    <div class="img-upload-area" id="img-drop-zone">
      <div class="img-upload-area__icon">📷</div>
      <div class="img-upload-area__text">클릭하거나 사진을 끌어다 놓으세요</div>
      <div class="img-upload-area__hint">사진은 최대 ${MAX_IMAGES_PER_POST}장까지, PC 본문 폭에 맞게 자동 조절돼요</div>
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
  const incoming = [...files];
  const remaining = Math.max(0, maxFiles - uploadedFiles.length);
  const toProcess = incoming.slice(0, remaining);

  if (remaining <= 0) {
    toast.warn(`게시글당 사진은 최대 ${maxFiles}장까지 올릴 수 있어요`);
    return;
  }
  if (incoming.length > toProcess.length) {
    toast.warn(`사진은 최대 ${maxFiles}장까지 가능해서 ${toProcess.length}장만 추가했어요`);
  }

  let skipped = 0;
  for (const file of toProcess) {
    const looksLikeImage = file.type ? file.type.startsWith('image/') : /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name || '');
    if (!looksLikeImage) { skipped += 1; continue; }
    const dataUrl = await readAsDataUrl(file);
    uploadedFiles.push({ file, dataUrl, storageUrl: null });
  }
  renderPreviews(container);
  if (skipped > 0) toast.warn(`이미지가 아닌 파일 ${skipped}개는 제외했어요`);
}

function renderPreviews(container) {
  const grid = container.querySelector('#img-preview-grid');
  if (!grid) return;

  grid.innerHTML = uploadedFiles.map((item, i) => {
    const isGif = getImageKind(item.file).animated;
    return `
    <div class="img-preview-item" data-idx="${i}">
      <img src="${item.dataUrl}" alt="미리보기 ${i+1}">
      ${i === 0
        ? '<div class="img-preview-star">대표</div>'
        : `<button class="img-preview-thumb-btn" data-set-thumb="${i}" title="대표 사진으로 설정">★</button>`
      }
      ${isGif ? '<div class="img-preview-star" style="left:auto;right:6px;background:#111827">GIF</div>' : ''}
      <div class="img-preview-toolbar">
        ${i > 0 ? `<button class="img-tool-btn" data-move-up="${i}" title="앞으로">↑</button>` : ''}
        ${i < uploadedFiles.length - 1 ? `<button class="img-tool-btn" data-move-down="${i}" title="뒤로">↓</button>` : ''}
        ${isGif ? '' : `<button class="img-tool-btn" data-crop="${i}" title="자르기">✂</button>`}
        <button class="img-tool-btn img-tool-btn--remove" data-remove="${i}" title="삭제">✕</button>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      uploadedFiles.splice(parseInt(btn.dataset.remove), 1);
      renderPreviews(container);
    });
  });

  grid.querySelectorAll('[data-move-up]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const i = parseInt(btn.dataset.moveUp);
      [uploadedFiles[i - 1], uploadedFiles[i]] = [uploadedFiles[i], uploadedFiles[i - 1]];
      renderPreviews(container);
    });
  });

  grid.querySelectorAll('[data-move-down]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const i = parseInt(btn.dataset.moveDown);
      [uploadedFiles[i], uploadedFiles[i + 1]] = [uploadedFiles[i + 1], uploadedFiles[i]];
      renderPreviews(container);
    });
  });

  grid.querySelectorAll('[data-set-thumb]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const i = parseInt(btn.dataset.setThumb);
      const [item] = uploadedFiles.splice(i, 1);
      uploadedFiles.unshift(item);
      renderPreviews(container);
      toast.success('대표 사진이 변경됐어요');
    });
  });

  grid.querySelectorAll('[data-crop]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openCropModal(parseInt(btn.dataset.crop), container);
    });
  });
}

function openCropModal(idx, container) {
  const item = uploadedFiles[idx];
  if (getImageKind(item.file).animated) {
    toast.warn('움직이는 GIF는 애니메이션 유지를 위해 자르기를 지원하지 않아요');
    return;
  }
  const overlay = document.createElement('div');
  overlay.className = 'crop-modal-overlay';
  overlay.innerHTML = `
    <div class="crop-modal">
      <div class="crop-modal__header">
        <span style="font-weight:700">이미지 자르기</span>
        <button class="crop-modal__close" id="crop-close">✕</button>
      </div>
      <div class="crop-modal__body">
        <canvas id="crop-canvas" style="cursor:crosshair;max-width:100%;display:block;margin:0 auto"></canvas>
        <p style="font-size:12px;color:var(--color-text-muted);text-align:center;margin-top:8px">드래그로 자를 영역을 선택하세요</p>
      </div>
      <div class="crop-modal__footer">
        <button class="btn btn--ghost" id="crop-cancel">취소</button>
        <button class="btn btn--primary" id="crop-confirm">자르기 완료</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const canvas = overlay.querySelector('#crop-canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.src = item.dataUrl;

  let cropRect = null;
  let isDragging = false;
  let startX = 0, startY = 0;

  img.onload = () => {
    const maxW = Math.min(img.width, Math.min(window.innerWidth - 64, 560));
    const scale = maxW / img.width;
    canvas.width  = Math.round(img.width  * scale);
    canvas.height = Math.round(img.height * scale);

    function draw() {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (cropRect && cropRect.w > 0 && cropRect.h > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
          img,
          cropRect.x / scale, cropRect.y / scale,
          cropRect.w / scale, cropRect.h / scale,
          cropRect.x, cropRect.y, cropRect.w, cropRect.h
        );
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(cropRect.x + 1, cropRect.y + 1, cropRect.w - 2, cropRect.h - 2);
      }
    }
    draw();

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const src  = e.touches ? e.touches[0] : e;
      return {
        x: Math.max(0, Math.min(canvas.width,  src.clientX - rect.left)),
        y: Math.max(0, Math.min(canvas.height, src.clientY - rect.top)),
      };
    }

    function onStart(e) {
      e.preventDefault();
      const p = getPos(e);
      startX = p.x; startY = p.y;
      cropRect = null;
      isDragging = true;
    }
    function onMove(e) {
      if (!isDragging) return;
      e.preventDefault();
      const p = getPos(e);
      cropRect = {
        x: Math.min(startX, p.x),
        y: Math.min(startY, p.y),
        w: Math.abs(p.x - startX),
        h: Math.abs(p.y - startY),
      };
      draw();
    }
    function onEnd() { isDragging = false; }

    canvas.addEventListener('mousedown', onStart);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup',   onEnd);
    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove',  onMove,  { passive: false });
    canvas.addEventListener('touchend',   onEnd);
  };

  const confirmCrop = () => {
    if (!cropRect || cropRect.w < 10 || cropRect.h < 10) {
      toast.warn('자를 영역을 드래그해서 선택해주세요');
      return;
    }
    const scale = canvas.width / img.width;
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width  = Math.round(cropRect.w / scale);
    cropCanvas.height = Math.round(cropRect.h / scale);
    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.fillStyle = '#ffffff';
    cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
    cropCtx.drawImage(
      img,
      Math.round(cropRect.x / scale), Math.round(cropRect.y / scale),
      cropCanvas.width, cropCanvas.height,
      0, 0, cropCanvas.width, cropCanvas.height
    );
    cropCanvas.toBlob(async (blob) => {
      const dataUrl = await readAsDataUrl(blob, 'image/jpeg');
      uploadedFiles[idx] = { file: blob, dataUrl, storageUrl: null };
      overlay.remove();
      renderPreviews(container);
    }, 'image/jpeg', UPLOAD_JPEG_QUALITY);
  };

  overlay.querySelector('#crop-confirm').addEventListener('click', confirmCrop);
  overlay.querySelector('#crop-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#crop-close').addEventListener('click',  () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

function readAsDataUrl(file, preferredType = '') {
  if (file instanceof Blob && !file.type && preferredType) {
    file = new Blob([file], { type: preferredType });
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resizeImageForUpload(file, maxWidth = UPLOAD_MAX_WIDTH, maxHeight = UPLOAD_MAX_HEIGHT, quality = UPLOAD_JPEG_QUALITY) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const ratio = Math.min(1, maxWidth / width, maxHeight / height);
      width  = Math.max(1, Math.round(width  * ratio));
      height = Math.max(1, Math.round(height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(resolve, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
