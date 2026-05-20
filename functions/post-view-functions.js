'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

function cleanId(value, max = 180) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, max);
}

function dayKey(value) {
  const raw = String(value || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : new Date().toISOString().slice(0, 10);
}

async function isAdmin(uid) {
  if (!uid) return false;
  const snap = await db.doc(`admins/${uid}`).get().catch(() => null);
  return !!snap?.exists;
}

const normalizePostView = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const postId = cleanId(request.data?.postId);
  if (!postId) throw new HttpsError('invalid-argument', '게시글 정보가 없습니다.');

  const uid = request.auth?.uid || '';
  const visitor = uid ? `uid_${cleanId(uid, 128)}` : `anon_${cleanId(request.data?.visitorId, 80) || 'unknown'}`;
  const day = dayKey(request.data?.dayKey);
  const visitId = cleanId(request.data?.visitId, 120);
  if (!visitId) throw new HttpsError('invalid-argument', '조회 방문 정보가 없습니다.');

  const postRef = db.doc(`feeds/${postId}`);
  const visitRef = postRef.collection('view_events').doc(visitId);
  const viewerRef = postRef.collection('viewers').doc(`${day}_${visitor}`);

  // BUG-006: isAdmin은 트랜잭션 외부에서 먼저 조회합니다.
  // 트랜잭션 콜백 내부에서 외부 Firestore 조회를 호출하면 재시도 시 중복 읽기 및
  // 일관성 문제가 생길 수 있으므로 트랜잭션 시작 전에 처리합니다.
  const admin = await isAdmin(uid);

  return db.runTransaction(async tx => {
    const [postSnap, visitSnap, viewerSnap] = await Promise.all([
      tx.get(postRef),
      tx.get(visitRef),
      tx.get(viewerRef),
    ]);

    if (!postSnap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
    if (visitSnap.exists) return visitSnap.data();

    const duplicate = viewerSnap.exists;
    const shouldRollback = admin || duplicate;

    if (shouldRollback) {
      const current = Number(postSnap.data()?.viewCount || 0);
      if (current > 0) tx.update(postRef, { viewCount: FieldValue.increment(-1) });
    } else {
      tx.set(viewerRef, {
        visitor,
        uid: uid || null,
        day,
        createdAt: FieldValue.serverTimestamp(),
        createdAtMs: Date.now(),
      }, { merge: true });
    }

    const result = {
      ok: true,
      counted: !shouldRollback,
      reason: admin ? 'admin' : duplicate ? 'duplicate' : 'unique',
      postId,
      day,
    };
    tx.set(visitRef, {
      ...result,
      visitor,
      uid: uid || null,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    }, { merge: true });
    return result;
  });
});

module.exports = { normalizePostView };
