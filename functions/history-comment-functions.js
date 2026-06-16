'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

function requireUid(request) {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  return uid;
}

function cleanText(value, max = 500) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function historyCommentCol(day) {
  const safeDay = Math.max(1, Math.floor(Number(day || 0)) || 1);
  return db.collection(`history_events/${safeDay}/comments`);
}

const getHistoryComments = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const day = Math.max(1, Math.floor(Number(request.data?.day || 0)) || 1);
  const limit = Math.min(50, Math.max(1, Math.floor(Number(request.data?.limit || 30)) || 30));
  const snap = await historyCommentCol(day).orderBy('createdAt', 'desc').limit(limit).get();
  const comments = snap.docs.map(doc => {
    const d = doc.data() || {};
    return {
      id: doc.id,
      uid: d.uid || '',
      nickname: d.nickname || '시민',
      icon: d.icon || null,
      text: d.text || '',
      createdAtMillis: d.createdAt?.toMillis ? d.createdAt.toMillis() : 0,
    };
  });
  return { ok: true, day, comments };
});

const addHistoryComment = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUid(request);
  const day = Math.max(1, Math.floor(Number(request.data?.day || 0)) || 1);
  const text = cleanText(request.data?.text, 500);
  if (text.length < 2) throw new HttpsError('invalid-argument', '댓글을 2자 이상 입력해주세요.');

  const userSnap = await db.doc(`users/${uid}`).get();
  const user = userSnap.exists ? userSnap.data() || {} : {};
  const payload = {
    uid,
    nickname: cleanText(user.nickname || user.displayName || '시민', 30),
    icon: user.nicknameIcon || null,
    text,
    day,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const ref = await historyCommentCol(day).add(payload);
  await db.doc(`history_events/${day}`).set({ commentCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, id: ref.id, comment: { ...payload, id: ref.id, createdAtMillis: Date.now() } };
});

module.exports = { getHistoryComments, addHistoryComment };
