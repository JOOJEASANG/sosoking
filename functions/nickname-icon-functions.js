'use strict';

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

function cleanIcon(icon) {
  if (!icon || typeof icon !== 'object') return null;
  if (icon.type === 'emoji') {
    const value = String(icon.value || '').trim().slice(0, 12);
    return value ? { type: 'emoji', value } : null;
  }
  if (icon.type === 'image') {
    const url = String(icon.url || '').trim();
    if (!/^https?:\/\//i.test(url)) return null;
    return { type: 'image', url: url.slice(0, 1000) };
  }
  return null;
}

async function readAuthorIcon(authorId) {
  if (!authorId) return null;
  const snap = await db.doc(`users/${authorId}`).get().catch(() => null);
  if (!snap || !snap.exists) return null;
  return cleanIcon(snap.data()?.nicknameIcon);
}

async function attachAuthorIcon(snapshot) {
  const data = snapshot.data() || {};
  if (data.authorIcon) return;
  const icon = await readAuthorIcon(data.authorId);
  if (!icon) return;
  await snapshot.ref.set({
    authorIcon: icon,
    authorIconUpdatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

// 기존 배포 함수명과 트리거 타입이 충돌하지 않도록 고유한 신규 함수명으로 export합니다.
const syncFeedAuthorIconOnCreate = onDocumentCreated({ region: REGION, document: 'feeds/{postId}' }, event => {
  if (!event.data) return null;
  return attachAuthorIcon(event.data);
});

const syncCommentAuthorIconOnCreate = onDocumentCreated({ region: REGION, document: 'feeds/{postId}/comments/{commentId}' }, event => {
  if (!event.data) return null;
  return attachAuthorIcon(event.data);
});

const syncAcrosticAuthorIconOnCreate = onDocumentCreated({ region: REGION, document: 'feeds/{postId}/acrostics/{acrosticId}' }, event => {
  if (!event.data) return null;
  return attachAuthorIcon(event.data);
});

module.exports = {
  syncFeedAuthorIconOnCreate,
  syncCommentAuthorIconOnCreate,
  syncAcrosticAuthorIconOnCreate,
};
