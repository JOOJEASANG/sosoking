'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getStorage } = require('firebase-admin/storage');
const { getApps, initializeApp } = require('firebase-admin/app');

if (!getApps().length) initializeApp();

const REGION = 'asia-northeast3';
const MAX_BASE64_BYTES = 5 * 1024 * 1024;

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

function parseDataUrl(value) {
  const raw = String(value || '');
  const match = raw.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) throw new HttpsError('invalid-argument', '지원하지 않는 이미지 형식입니다. JPG, PNG, WEBP만 올릴 수 있어요.');
  const contentType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw new HttpsError('invalid-argument', '이미지 데이터가 비어 있습니다.');
  if (buffer.length > MAX_BASE64_BYTES) throw new HttpsError('invalid-argument', '이미지 용량이 너무 큽니다.');
  return { buffer, contentType };
}

const uploadFeedImage = onCall({ region: REGION, timeoutSeconds: 60, memory: '256MiB' }, async request => {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const { dataUrl } = request.data || {};
  const { buffer, contentType } = parseDataUrl(dataUrl);
  const safeUid = cleanUid(uid);
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const path = `feeds/${safeUid}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const bucket = getStorage().bucket(getBucketName());
  const file = bucket.file(path);
  await file.save(buffer, {
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: { owner: safeUid, source: 'callable-upload' },
    },
    resumable: false,
    validation: 'md5',
  });

  await file.makePublic().catch(() => null);
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(path).replace(/%2F/g, '/')}`;
  return { ok: true, url: publicUrl, path };
});

module.exports = { uploadFeedImage };
