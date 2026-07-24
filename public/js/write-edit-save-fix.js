import { auth, functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';
import { getUploadedImages, hasPendingImages, cleanupUploadedImages } from './components/image-uploader.js';

const updateCommunityPost = httpsCallable(functions, 'updateCommunityPost');
const MAX_IMAGES = 20;

function editId() {
  const hash = location.hash || '';
  if (!hash.startsWith('#/write')) return '';
  const query = hash.includes('?') ? hash.split('?')[1].split('#')[0] : '';
  const params = new URLSearchParams(query);
  return params.get('edit') || params.get('postId') || params.get('id') || '';
}

function splitTags(raw) {
  return String(raw || '').split(',').map(tag => tag.replace(/^#/, '').trim()).filter(Boolean).slice(0, 8);
}

function existingImages() {
  return [...document.querySelectorAll('#edit-existing-images .edit-existing-image')]
    .map(item => String(item.dataset.imageUrl || '').trim())
    .filter(Boolean);
}

async function saveOwnerEdit(event) {
  const button = event.target.closest?.('#edit-save-force');
  if (!button) return;
  const postId = editId();
  if (!postId) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();

  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    toast.error('회원 로그인 후 수정할 수 있어요.');
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
    button.disabled = true;
    button.textContent = hasPendingImages() ? '사진 올리는 중...' : '저장 중...';
    const currentImages = existingImages();
    const newImages = await getUploadedImages();
    const images = [...currentImages, ...newImages];
    if (images.length > MAX_IMAGES) throw new Error(`사진은 최대 ${MAX_IMAGES}장까지 저장할 수 있어요.`);
    await updateCommunityPost({ postId, title, desc, tags, images });
    toast.success('게시글을 수정했어요.');
    navigate(`/detail/${postId}`);
  } catch (error) {
    console.error('[community edit]', error);
    await cleanupUploadedImages();
    toast.error(error.message || '수정 저장에 실패했어요.');
  } finally {
    button.disabled = false;
    button.textContent = '수정 저장';
  }
}

document.addEventListener('click', saveOwnerEdit, true);
