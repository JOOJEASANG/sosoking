'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getStorage } = require('firebase-admin/storage');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getApps, initializeApp } = require('firebase-admin/app');
const { randomUUID } = require('crypto');

if (!getApps().length) initializeApp();

const db = getFirestore();
const REGION = 'asia-northeast3';
const MAX_BASE64_BYTES = 8 * 1024 * 1024;
const DAILY_UPLOAD_LIMIT = 80;
const ALLOWED_SCOPES = new Set(['feed', 'material', 'debate']);

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function getBucketName() {
  try {
    const config = JSON.parse(process.env.FIREBASE_CONFIG || '{}');
    if (config.storageBucket) return config.storageBucket;
  } catch {}
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'sosoking-481e6';
  return `${projectId}.firebasestorage.app`;
}

function cleanUid(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
}

function cleanScope(value) {
  const scope = String(value || 'feed').trim().toLowerCase();
  return ALLOWED_SCOPES.has(scope) ? scope : 'feed';
}

function boundedNumber(value, maximum) {
  const number = Math.floor(Number(value || 0));
  return Number.isFinite(number) ? Math.max(0, Math.min(maximum, number)) : 0;
}

function sniffImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return '';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a') return 'image/gif';
  return '';
}

function parseDataUrl(value) {
  const raw = String(value || '');
  const match = raw.match(/^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) throw new HttpsError('invalid-argument', '지원하지 않는 이미지 형식입니다. JPG, PNG, WEBP, GIF만 올릴 수 있어요.');
  const declaredType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw new HttpsError('invalid-argument', '이미지 데이터가 비어 있습니다.');
  if (buffer.length > MAX_BASE64_BYTES) throw new HttpsError('invalid-argument', '최적화된 이미지 용량이 너무 큽니다. 이미지를 다시 선택해주세요.');
  const detectedType = sniffImageType(buffer);
  if (!detectedType || detectedType !== declaredType) throw new HttpsError('invalid-argument', '이미지 파일 형식이 올바르지 않습니다.');
  return { buffer, contentType: detectedType };
}

async function reserveUploadQuota(uid) {
  const day = todayKey();
  const ref = db.doc(`upload_usage/${day}_${uid}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const count = Number(snap.exists ? snap.data().count || 0 : 0);
    if (count >= DAILY_UPLOAD_LIMIT) throw new HttpsError('resource-exhausted', '오늘 이미지 업로드 한도를 초과했습니다. 내일 다시 시도해주세요.');
    tx.set(ref, {
      uid,
      day,
      count: FieldValue.increment(1),
      limit: DAILY_UPLOAD_LIMIT,
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtMs: Date.now(),
    }, { merge: true });
  });
}

function uploadPath(scope, uid, extension) {
  const name = `${Date.now()}_${randomUUID()}.${extension}`;
  if (scope === 'material') return `community/materials/${uid}/${name}`;
  if (scope === 'debate') return `community/debates/${uid}/${name}`;
  return `feeds/${uid}/${name}`;
}

async function handleUpload(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const safeUid = cleanUid(uid);
  if (!safeUid) throw new HttpsError('unauthenticated', '사용자 정보를 확인할 수 없습니다.');

  const scope = cleanScope(request.data?.scope);
  const { buffer, contentType } = parseDataUrl(request.data?.dataUrl);
  await reserveUploadQuota(safeUid);

  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : contentType === 'image/gif' ? 'gif' : 'jpg';
  const path = uploadPath(scope, safeUid, extension);
  const token = randomUUID();
  const width = boundedNumber(request.data?.width, 12000);
  const height = boundedNumber(request.data?.height, 12000);
  const originalBytes = boundedNumber(request.data?.originalBytes, 25 * 1024 * 1024);
  const resized = request.data?.resized === true;

  const bucket = getStorage().bucket(getBucketName());
  const file = bucket.file(path);
  await file.save(buffer, {
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        owner: safeUid,
        scope,
        source: 'callable-upload',
        optimized: resized ? 'true' : 'false',
        width: String(width),
        height: String(height),
        originalBytes: String(originalBytes),
        uploadedBytes: String(buffer.length),
        firebaseStorageDownloadTokens: token,
      },
    },
    resumable: false,
    validation: 'md5',
  });

  const encodedPath = encodeURIComponent(path);
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
  return { ok: true, url, path, width, height, bytes: buffer.length, resized, scope };
}

const uploadFeedImage = onCall({ region: REGION, timeoutSeconds: 60, memory: '256MiB' }, handleUpload);
const uploadSiteImage = onCall({ region: REGION, timeoutSeconds: 60, memory: '256MiB' }, handleUpload);

module.exports = {
  uploadFeedImage,
  uploadSiteImage,
  _test: { cleanScope, sniffImageType, parseDataUrl, uploadPath },
};
