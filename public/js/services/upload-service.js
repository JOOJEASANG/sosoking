/* upload-service.js — Firebase Storage 이미지 업로드 서비스 */
import { storage, auth } from '../firebase.js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const MAX_SIDE = 1600;
const QUALITY  = 0.82;

/** 이미지 파일 압축 */
export function compressImage(file, maxSide = MAX_SIDE, quality = QUALITY) {
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

/** 단일 이미지 업로드 → download URL 반환 */
export async function uploadImage(file, folder = 'feeds') {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요');

  const blob     = await compressImage(file);
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  const path     = `${folder}/${user.uid}/${filename}`;
  const fileRef  = ref(storage, path);

  await uploadBytes(fileRef, blob);
  return getDownloadURL(fileRef);
}

/** 여러 이미지 순차 업로드 */
export async function uploadImages(files, folder = 'feeds') {
  const urls = [];
  for (const file of files) {
    try {
      urls.push(await uploadImage(file, folder));
    } catch (e) {
      console.error('이미지 업로드 실패:', e);
    }
  }
  return urls;
}

/** Storage 파일 삭제 */
export async function deleteImage(url) {
  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
  } catch (e) {
    console.warn('이미지 삭제 실패 (이미 없을 수 있음)', e);
  }
}
