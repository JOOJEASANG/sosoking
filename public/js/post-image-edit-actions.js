import { auth, db } from './firebase.js';
import { doc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { toast } from './components/toast.js';
import { initImageUploader, getUploadedImages, hasPendingImages } from './components/image-uploader.js';

function getDetailId() {
  const match = (window.location.hash || '').match(/^#\/detail\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[m]));
}

async function getCurrentPost() {
  const postId = getDetailId();
  if (!postId) return null;
  const snap = await getDoc(doc(db, 'feeds', postId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

function renderExistingImages(images) {
  if (!images.length) {
    return `<div class="owner-image-edit__empty">현재 등록된 사진이 없습니다.</div>`;
  }
  return images.map((src, i) => `
    <div class="owner-image-edit__item" data-owner-img-idx="${i}">
      <img src="${esc(src)}" alt="사진 ${i + 1}">
      <div class="owner-image-edit__badge">${i === 0 ? '대표' : `${i + 1}`}</div>
      <div class="owner-image-edit__tools">
        ${i > 0 ? `<button type="button" data-img-move-up="${i}">↑</button>` : ''}
        ${i < images.length - 1 ? `<button type="button" data-img-move-down="${i}">↓</button>` : ''}
        ${i > 0 ? `<button type="button" data-img-thumb="${i}">대표</button>` : ''}
        <button type="button" data-img-remove="${i}" class="danger">삭제</button>
      </div>
    </div>`).join('');
}

function openImageEditModal(post) {
  document.getElementById('owner-image-edit-modal')?.remove();
  const images = Array.isArray(post.images) ? [...post.images] : [];
  const overlay = document.createElement('div');
  overlay.id = 'owner-image-edit-modal';
  overlay.className = 'owner-edit-modal owner-image-edit-modal';
  overlay.innerHTML = `
    <div class="owner-edit-modal__backdrop"></div>
    <div class="owner-edit-modal__panel">
      <div class="owner-edit-modal__header">
        <div>
          <div class="owner-edit-modal__eyebrow">사진 수정</div>
          <div class="owner-edit-modal__title">게시글 사진 관리</div>
        </div>
        <button type="button" class="owner-edit-modal__close" id="owner-image-edit-close">✕</button>
      </div>
      <div class="owner-edit-modal__body">
        <div class="form-group">
          <label class="form-label">현재 사진</label>
          <div class="owner-image-edit__grid" id="owner-current-images"></div>
          <div class="form-hint">대표 사진은 첫 번째 사진입니다. 순서를 바꾸거나 삭제할 수 있습니다.</div>
        </div>
        <div class="form-group">
          <label class="form-label">새 사진 추가</label>
          <div id="owner-image-uploader"></div>
          <div class="form-hint">사진 개수 제한 없이 추가할 수 있어요.</div>
        </div>
      </div>
      <div class="owner-edit-modal__footer">
        <button type="button" class="btn btn--ghost" id="owner-image-edit-cancel">취소</button>
        <button type="button" class="btn btn--primary" id="owner-image-edit-save">저장</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const current = overlay.querySelector('#owner-current-images');
  const uploader = overlay.querySelector('#owner-image-uploader');
  let currentImages = images;

  const redraw = () => {
    current.innerHTML = renderExistingImages(currentImages);
    current.querySelectorAll('[data-img-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentImages.splice(Number(btn.dataset.imgRemove), 1);
        redraw();
      });
    });
    current.querySelectorAll('[data-img-move-up]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.imgMoveUp);
        [currentImages[i - 1], currentImages[i]] = [currentImages[i], currentImages[i - 1]];
        redraw();
      });
    });
    current.querySelectorAll('[data-img-move-down]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.imgMoveDown);
        [currentImages[i], currentImages[i + 1]] = [currentImages[i + 1], currentImages[i]];
        redraw();
      });
    });
    current.querySelectorAll('[data-img-thumb]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.imgThumb);
        const [item] = currentImages.splice(i, 1);
        currentImages.unshift(item);
        redraw();
      });
    });
  };

  redraw();
  initImageUploader(uploader, Infinity);

  const close = () => overlay.remove();
  overlay.querySelector('#owner-image-edit-close')?.addEventListener('click', close);
  overlay.querySelector('#owner-image-edit-cancel')?.addEventListener('click', close);
  overlay.querySelector('.owner-edit-modal__backdrop')?.addEventListener('click', close);
  overlay.querySelector('#owner-image-edit-save')?.addEventListener('click', async () => {
    const btn = overlay.querySelector('#owner-image-edit-save');
    try {
      btn.disabled = true;
      btn.textContent = hasPendingImages() ? '사진 올리는 중...' : '저장 중...';
      const added = await getUploadedImages();
      const nextImages = [...currentImages, ...added];
      await updateDoc(doc(db, 'feeds', post.id), {
        images: nextImages,
        updatedAt: serverTimestamp(),
      });
      toast.success('사진을 수정했어요.');
      close();
      setTimeout(() => location.reload(), 250);
    } catch (error) {
      console.error(error);
      toast.error(error.message || '사진 수정에 실패했어요.');
      btn.disabled = false;
      btn.textContent = '저장';
    }
  });
}

async function ensureImageButton() {
  const root = document.getElementById('page-content');
  const toolbar = root?.querySelector('[data-owner-toolbar="true"]');
  if (!toolbar || toolbar.querySelector('#btn-owner-image-edit')) return;
  const post = await getCurrentPost();
  if (!post || post.authorId !== auth.currentUser?.uid) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn--ghost btn--sm';
  btn.id = 'btn-owner-image-edit';
  btn.textContent = '🖼️ 사진';
  btn.addEventListener('click', () => openImageEditModal(post));
  const deleteBtn = toolbar.querySelector('#btn-owner-delete');
  toolbar.insertBefore(btn, deleteBtn || null);
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(ensureImageButton, 220);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 800);
