// 프로필 사진을 서버로 보내기 전에 브라우저에서 정사각형으로 잘라 축소한다.
//
// Firebase Storage를 새로 붙이지 않고 Firestore 문서에 담기 때문에
// 원본을 그대로 올리면 안 된다. 256x256 JPEG로 줄이면 보통 20~40KB가 되어
// 문서 1MB 한도에 여유가 크다.

const OUTPUT_SIZE = 256;
const OUTPUT_QUALITY = 0.82;
const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const MAX_OUTPUT_CHARS = 200 * 1024;

export const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp';

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 읽지 못했습니다.'));
    };
    image.src = url;
  });
}

// 가운데를 기준으로 정사각형으로 잘라낸다. 세로로 긴 사진에서 얼굴이
// 잘려나가지 않도록 위쪽을 조금 더 남긴다.
function cropRect(width, height) {
  const side = Math.min(width, height);
  const left = Math.round((width - side) / 2);
  const top = Math.round((height - side) * 0.35);
  return { left, top, side };
}

export async function fileToProfilePhoto(file) {
  if (!file) throw new Error('선택된 파일이 없습니다.');
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    throw new Error('PNG, JPG, WEBP 이미지만 올릴 수 있습니다.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('12MB 이하 이미지를 선택해주세요.');
  }

  const image = await loadImage(file);
  const { left, top, side } = cropRect(image.naturalWidth, image.naturalHeight);

  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('이미지를 처리하지 못했습니다.');
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, left, top, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  const dataUrl = canvas.toDataURL('image/jpeg', OUTPUT_QUALITY);
  if (dataUrl.length > MAX_OUTPUT_CHARS) {
    throw new Error('이미지를 충분히 줄이지 못했습니다. 다른 사진을 사용해주세요.');
  }
  return dataUrl;
}
