import { storage, auth } from '../firebase.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { toast } from './toast.js';

let uploadedFiles = []; // { file, dataUrl, storageUrl }
let maxFiles = 5;
let uploaderContainer = null;

export function initImageUploader(container, max = 5) {
  maxFiles = max;
  uploadedFiles = [];
  uploaderContainer = container;
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
      ${i === 0
        ? '<div class="img-preview-star">대표</div>'
        : `<button class="img-preview-thumb-btn" data-set-thumb="${i}" title="대표 사진으로 설정">★</button>`
      }
      <div class="img-preview-toolbar">
        ${i > 0 ? `<button class="img-tool-btn" data-move-up="${i}" title="앞으로">↑</button>` : ''}
        ${i < uploadedFiles.length - 1 ? `<button class="img-tool-btn" data-move-down="${i}" title="뒤로">↓</button>` : ''}
        <button class="img-tool-btn" data-crop="${i}" title="자르기">✂</button>
        <button class="img-tool-btn img-tool-btn--remove" data-remove="${i}" title="삭제">✕</button>
      </div>
    </div>`).join('');

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
    cropCanvas.getContext('2d').drawImage(
      img,
      Math.round(cropRect.x / scale), Math.round(cropRect.y / scale),
      cropCanvas.width, cropCanvas.height,
      0, 0, cropCanvas.width, cropCanvas.height
    );
    cropCanvas.toBlob(async (blob) => {
      const dataUrl = await readAsDataUrl(blob);
      uploadedFiles[idx] = { file: blob, dataUrl, storageUrl: null };
      overlay.remove();
      renderPreviews(container);
    }, 'image/jpeg', 0.92);
  };

  overlay.querySelector('#crop-confirm').addEventListener('click', confirmCrop);
  overlay.querySelector('#crop-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#crop-close').addEventListener('click',  () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
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
