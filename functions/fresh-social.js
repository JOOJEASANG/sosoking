const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { db, FieldValue, REGION, clean } = require('./fresh-utils');

exports.voteResult = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const caseId = clean(request.data?.caseId, 180);
  const reaction = clean(request.data?.reaction, 30);
  if (!caseId || !reaction) throw new HttpsError('invalid-argument', 'invalid vote');
  const uid = request.auth.uid;
  const voteRef = db.doc(`result_reactions/${caseId}/votes/${uid}`);
  const totalRef = db.doc(`result_reactions/${caseId}`);
  await db.runTransaction(async tx => {
    const old = await tx.get(voteRef);
    const oldReaction = old.exists ? old.data().reaction : '';
    const updates = { updatedAt: FieldValue.serverTimestamp() };
    if (oldReaction) updates[`counts.${oldReaction}`] = FieldValue.increment(-1);
    updates[`counts.${reaction}`] = FieldValue.increment(1);
    if (!oldReaction) updates.total = FieldValue.increment(1);
    tx.set(totalRef, updates, { merge: true });
    tx.set(voteRef, { reaction, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { success: true };
});

exports.addCourtComment = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const caseId = clean(request.data?.caseId, 180);
  const text = clean(request.data?.text, 140);
  if (!caseId || text.length < 2) throw new HttpsError('invalid-argument', '댓글을 2자 이상 입력해주세요.');
  await db.collection(`court_comments/${caseId}/items`).add({ userId: request.auth.uid, nickname: '익명 방청객', text, createdAt: FieldValue.serverTimestamp() });
  await db.doc(`results/${caseId}`).set({ commentCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { success: true };
});

exports.deleteMyCase = onCall({ region: REGION, timeoutSeconds: 60, memory: '256MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const caseId = clean(request.data?.caseId, 180);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');
  const caseRef = db.doc(`cases/${caseId}`);
  const snap = await caseRef.get();
  if (!snap.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
  if (snap.data().userId !== request.auth.uid) throw new HttpsError('permission-denied', '본인 사건만 삭제할 수 있습니다.');
  await db.doc(`results/${caseId}`).delete().catch(() => null);
  await caseRef.delete();
  return { success: true };
});
