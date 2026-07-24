'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getStorage } = require('firebase-admin/storage');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getApps, initializeApp } = require('firebase-admin/app');
const { randomUUID } = require('crypto');

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = 'asia-northeast3';
const MAX_BYTES = 8 * 1024 * 1024;
const DAILY_UPLOAD_LIMIT = 80;

function requireRegisteredUser(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  if (request.auth?.token?.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('permission-denied', '정식 회원 로그인 후 이미지를 올릴 수 있습니다.');
  }
  return String(uid).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
}

function todayKST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function bucketName() {
  try {
    const config = JSON.parse(process.env.FIREBASE_CONFIG || '{}');
    if (config.storageBucket) return config.storageBucket;
  } catch {}
  return `${process.env.GCLOUD_PROJECT || 'sosoking-481e6'}.firebasestorage.app`;
}

function sniffType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return '';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) return 'image/gif';
  return '';
}

function parseDataUrl(value) {
  const match = String(value || '').match(/^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) throw new HttpsError('invalid-argument', 'JPG, PNG, WEBP, GIF 이미지만 올릴 수 있습니다.');
  const declared = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_BYTES) throw new HttpsError('invalid-argument', '이미지는 최대 8MB까지 올릴 수 있습니다.');
  const detected = sniffType(buffer);
  if (!detected || detected !== declared) throw new HttpsError('invalid-argument', '이미지 파일 형식이 올바르지 않습니다.');
  return { buffer, contentType: detected };
}

async function reserveQuota(uid) {
  const day = todayKST();
  const ref = db.doc(`upload_usage/${day}_${uid}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const count = Number(snap.exists ? snap.data()?.count || 0 : 0);
    if (count >= DAILY_UPLOAD_LIMIT) throw new HttpsError('resource-exhausted', '오늘 이미지 업로드 한도를 초과했습니다.');
    tx.set(ref, {
      uid, day, count: FieldValue.increment(1), limit: DAILY_UPLOAD_LIMIT,
      updatedAt: FieldValue.serverTimestamp(), updatedAtMs: Date.now(),
    }, { merge: true });
  });
}

const uploadFeedImage = onCall({ region: REGION, timeoutSeconds: 60, memory: '256MiB' }, async request => {
  const uid = requireRegisteredUser(request);
  await reserveQuota(uid);
  const { buffer, contentType } = parseDataUrl(request.data?.dataUrl);
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : contentType === 'image/gif' ? 'gif' : 'jpg';
  const path = `feeds/${uid}/${Date.now()}_${randomUUID()}.${ext}`;
  const token = randomUUID();
  const bucket = getStorage().bucket(bucketName());
  await bucket.file(path).save(buffer, {
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: { owner: uid, source: 'callable-upload', firebaseStorageDownloadTokens: token },
    },
    resumable: false,
    validation: 'md5',
  });
  const encoded = encodeURIComponent(path);
  return {
    ok: true,
    path,
    url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encoded}?alt=media&token=${token}`,
  };
});

const deleteUploadedFeedImages = onCall({ region: REGION, timeoutSeconds: 60 }, async request => {
  const uid = requireRegisteredUser(request);
  const paths = (Array.isArray(request.data?.paths) ? request.data.paths : [])
    .map(value => String(value || '').trim())
    .filter(path => path.startsWith(`feeds/${uid}/`) && !path.includes('..'))
    .slice(0, 20);
  const bucket = getStorage().bucket(bucketName());
  let deleted = 0;
  await Promise.all(paths.map(async path => {
    try {
      await bucket.file(path).delete({ ignoreNotFound: true });
      deleted += 1;
    } catch (error) {
      console.warn('[deleteUploadedFeedImages]', path, error);
    }
  }));
  return { ok: true, deleted };
});

module.exports = { uploadFeedImage, deleteUploadedFeedImages };
