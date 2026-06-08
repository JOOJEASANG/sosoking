'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = 'asia-northeast3';

// ── 관리자: 핫포테이토 생성 ──
exports.createHotPotato = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요해요');
  const adminSnap = await db.doc(`admins/${uid}`).get();
  if (!adminSnap.exists) throw new HttpsError('permission-denied', '관리자만 생성할 수 있어요');

  const title = String(request.data?.title || '').trim().slice(0, 100);
  const hours = Math.min(Math.max(Number(request.data?.hours) || 2, 1), 24);
  if (!title) throw new HttpsError('invalid-argument', '제목을 입력해주세요');

  const expiresAt = new Date(Date.now() + hours * 3600 * 1000);
  await db.collection('hot_potatoes').add({
    title,
    expiresAt,
    hours,
    lastCommentUid: null,
    lastCommentName: null,
    exploded: false,
    explodedUid: null,
    explodedName: null,
    commentCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: uid,
  });
  return { success: true };
});

// ── 댓글 던지기 (폭탄 이전) ──
exports.throwHotPotato = onCall({ region: REGION, timeoutSeconds: 30 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인 후 참여할 수 있어요');

  const postId = String(request.data?.postId || '').trim();
  const text = String(request.data?.text || '').trim().slice(0, 150);
  if (!postId || !text) throw new HttpsError('invalid-argument', '내용을 입력해주세요');

  const ref = db.doc(`hot_potatoes/${postId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', '핫포테이토를 찾을 수 없어요');

  const data = snap.data();
  if (data.exploded) throw new HttpsError('failed-precondition', '이미 폭발한 핫포테이토예요 💥');
  if (data.expiresAt?.toDate?.() < new Date()) throw new HttpsError('failed-precondition', '시간이 종료됐어요');

  const userSnap = await db.doc(`users/${uid}`).get();
  const displayName = userSnap.data()?.displayName || userSnap.data()?.nickname || '익명';

  await db.runTransaction(async (tx) => {
    tx.set(ref, {
      lastCommentUid: uid,
      lastCommentName: displayName,
      commentCount: FieldValue.increment(1),
    }, { merge: true });
    tx.set(ref.collection('comments').doc(), {
      uid,
      name: displayName,
      text,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { success: true };
});

// ── 10분마다 만료된 핫포테이토 폭발 처리 ──
exports.scheduledHotPotatoExploder = onSchedule({
  schedule: '*/10 * * * *',
  timeZone: 'Asia/Seoul',
  region: REGION,
}, async () => {
  const now = new Date();
  const snap = await db.collection('hot_potatoes')
    .where('exploded', '==', false)
    .where('expiresAt', '<=', now)
    .limit(20)
    .get();

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const explodedUid = data.lastCommentUid;
    const explodedName = data.lastCommentName;

    await docSnap.ref.update({
      exploded: true,
      explodedUid: explodedUid || null,
      explodedName: explodedName || null,
    });

    // 폭탄 보유자 배지 기록
    if (explodedUid) {
      await db.doc(`users/${explodedUid}`).set({
        hotPotatoExplodeCount: FieldValue.increment(1),
        lastExplodedAt: FieldValue.serverTimestamp(),
      }, { merge: true }).catch(() => {});
    }

    console.log('[hotPotato] exploded:', docSnap.id, '→', explodedName || '(nobody)');
  }
});
