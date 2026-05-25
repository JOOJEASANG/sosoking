import { auth, db } from './firebase.js';
import { doc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';
import { getUploadedImages, hasPendingImages } from './components/image-uploader.js';

const MAX_FEED_IMAGES = 20;

function editId() {
  const hash = location.hash || '';
  if (!hash.startsWith('#/write')) return '';
  const query = hash.includes('?') ? hash.split('?')[1].split('#')[0] : '';
  const params = new URLSearchParams(query);
  return params.get('edit') || params.get('postId') || params.get('id') || '';
}

function splitTags(raw) {
  return String(raw || '')
    .split(',')
    .map(tag => tag.replace(/^#/, '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function currentExistingImages() {
  return [...document.querySelectorAll('#edit-existing-images .edit-existing-image')]
    .map(item => item.dataset.imageUrl || '')
    .map(url => String(url || '').trim())
    .filter(Boolean);
}

async function saveOwnerEdit(event) {
  const btn = event.target.closest?.('#edit-save-force');
  if (!btn) return;

  const id = editId();
  if (!id) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();

  if (!auth.currentUser) {
    toast.error('로그인 후 수정할 수 있어요.');
    navigate('/login');
    return;
  }

  const title = document.getElementById('edit-title-force')?.value.trim() || '';
  const desc = document.getElementById('edit-desc-force')?.value.trim() || '';
  const tags = splitTags(document.getElementById('edit-tags-force')?.value || '');

  if (!title) {
    toast.error('제목을 입력해주세요.');
    return;
  }

  try {
    btn.disabled = true;
    btn.textContent = hasPendingImages() ? '사진 올리는 중...' : '저장 중...';

    const existingImages = currentExistingImages();
    const newImages = await getUploadedImages();
    if (existingImages.length + newImages.length > MAX_FEED_IMAGES) {
      throw new Error(`사진은 최대 ${MAX_FEED_IMAGES}장까지 저장할 수 있어요.`);
    }

    await updateDoc(doc(db, 'feeds', id), {
      title,
      desc,
      tags,
      images: [...existingImages, ...newImages],
      updatedAt: serverTimestamp(),
    });

    toast.success('게시글을 수정했어요.');
    navigate(`/detail/${id}`);
  } catch (error) {
    console.error('[write-edit-save-fix]', error);
    toast.error(error.message || '수정 저장에 실패했어요.');
    btn.disabled = false;
    btn.textContent = '수정 저장';
  }
}

document.addEventListener('click', saveOwnerEdit, true);
