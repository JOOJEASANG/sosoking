import { functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 1.8 * 1024 * 1024;
const MAX_EDGE = 1920;

export function formatImageBytes(bytes) {
  const value = Math.max(0, Number(bytes || 0));
  if (value < 1024) return `${value}B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)}KB`;
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {}
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('이미지 해상도를 확인하지 못했습니다.'));
      element.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('이미지 압축에 실패했습니다.')), type, quality);
  });
}

function targetSize(width, height, maxEdge = MAX_EDGE) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function compressBitmap(bitmap, initialWidth, initialHeight) {
  let { width, height } = targetSize(initialWidth, initialHeight);
  let quality = 0.86;
  let blob = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('이미지 처리 기능을 사용할 수 없습니다.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    try {
      blob = await canvasToBlob(canvas, 'image/webp', quality);
      if (!blob.type || blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    } finally {
      canvas.width = 1;
      canvas.height = 1;
    }

    if (blob.size <= MAX_OUTPUT_BYTES) break;
    if (quality > 0.58) quality -= 0.08;
    else {
      width = Math.max(640, Math.round(width * 0.82));
      height = Math.max(480, Math.round(height * 0.82));
    }
  }

  if (!blob || blob.size > 3 * 1024 * 1024) throw new Error('이미지를 충분히 줄이지 못했습니다. 다른 이미지를 선택해주세요.');
  return { blob, width, height };
}

export async function prepareImageFile(file) {
  if (!(file instanceof File)) throw new Error('이미지 파일을 선택해주세요.');
  if (!ALLOWED_TYPES.has(file.type)) throw new Error('JPG, PNG, WEBP, GIF 이미지만 첨부할 수 있습니다.');
  if (!file.size || file.size > MAX_SOURCE_BYTES) throw new Error('원본 이미지는 최대 25MB까지 선택할 수 있습니다.');

  const bitmap = await loadBitmap(file);
  const width = Number(bitmap.width || bitmap.naturalWidth || 0);
  const height = Number(bitmap.height || bitmap.naturalHeight || 0);
  if (!width || !height) throw new Error('이미지 해상도를 확인하지 못했습니다.');

  try {
    if (file.size <= MAX_OUTPUT_BYTES && Math.max(width, height) <= MAX_EDGE) {
      return {
        dataUrl: await fileToDataUrl(file),
        previewUrl: URL.createObjectURL(file),
        width,
        height,
        originalBytes: file.size,
        outputBytes: file.size,
        resized: false,
      };
    }

    const compressed = await compressBitmap(bitmap, width, height);
    const outputFile = new File([compressed.blob], `optimized.${compressed.blob.type === 'image/webp' ? 'webp' : 'jpg'}`, { type: compressed.blob.type });
    return {
      dataUrl: await fileToDataUrl(outputFile),
      previewUrl: URL.createObjectURL(compressed.blob),
      width: compressed.width,
      height: compressed.height,
      originalBytes: file.size,
      outputBytes: compressed.blob.size,
      resized: true,
    };
  } finally {
    if (typeof bitmap.close === 'function') bitmap.close();
  }
}

export function releasePreparedImage(prepared) {
  if (prepared?.previewUrl) URL.revokeObjectURL(prepared.previewUrl);
}

export async function uploadPreparedImage(prepared, scope) {
  if (!prepared?.dataUrl) return null;
  const callable = httpsCallable(functions, 'uploadSiteImage');
  const response = await callable({
    dataUrl: prepared.dataUrl,
    scope,
    width: prepared.width,
    height: prepared.height,
    originalBytes: prepared.originalBytes,
    resized: prepared.resized,
  });
  const result = response.data || {};
  if (!result.ok || !result.url || !result.path) throw new Error('이미지 업로드 결과를 확인하지 못했습니다.');
  return result;
}
