const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const REGION = 'asia-northeast3';
const REACTION_TYPES = new Set(['funny', 'agree']);
const COMMENT_COOLDOWN_MS = 10 * 1000;

function requireUser(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', '로그인 후 이용해 주세요.');
  return request.auth;
}
function cleanId(value) {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(id)) throw new HttpsError('invalid-argument', '올바른 사건 번호가 아닙니다.');
  return id;
}
function cleanText(value, maxLength) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}
function publicResultOrThrow(snapshot) {
  if (!snapshot.exists) throw new HttpsError('not-found', '판결을 찾을 수 없습니다.');
  if (snapshot.data().isPublic !== true) throw new HttpsError('permission-denied', '공개 판결에서만 이용할 수 있습니다.');
  return snapshot.data();
}

exports.toggleReaction = onCall({ region: REGION, cors: true }, async request => {
  const auth = requireUser(request);
  const caseId = cleanId(request.data?.caseId);
  const type = cleanText(request.data?.type, 20);
  if (!REACTION_TYPES.has(type)) throw new HttpsError('invalid-argument', '지원하지 않는 반응입니다.');
  const resultRef = db.collection('results').doc(caseId);
  const statsRef = db.collection('result_reactions').doc(caseId);
  const voteRef = statsRef.collection('votes').doc(auth.uid);
  const now = admin.firestore.Timestamp.now();

  const response = await db.runTransaction(async transaction => {
    const [resultSnap, statsSnap, voteSnap] = await Promise.all([
      transaction.get(resultRef), transaction.get(statsRef), transaction.get(voteRef),
    ]);
    publicResultOrThrow(resultSnap);
    const stats = statsSnap.exists ? statsSnap.data() : {};
    let funny = Math.max(0, Number(stats.funny || 0));
    let agree = Math.max(0, Number(stats.agree || 0));
    const previous = voteSnap.exists ? voteSnap.data().type : null;
    let selected = type;

    if (previous === type) {
      if (type === 'funny') funny = Math.max(0, funny - 1);
      if (type === 'agree') agree = Math.max(0, agree - 1);
      transaction.delete(voteRef);
      selected = null;
    } else {
      if (previous === 'funny') funny = Math.max(0, funny - 1);
      if (previous === 'agree') agree = Math.max(0, agree - 1);
      if (type === 'funny') funny += 1;
      if (type === 'agree') agree += 1;
      transaction.set(voteRef, { userId: auth.uid, type, updatedAt: now });
    }

    const total = funny + agree;
    transaction.set(statsRef, { caseId, funny, agree, total, updatedAt: now }, { merge: true });
    transaction.update(resultRef, { reactionCount: total, updatedAt: now });
    return { funny, agree, total, selected };
  });
  return { caseId, ...response };
});

exports.addCourtComment = onCall({ region: REGION, cors: true }, async request => {
  const auth = requireUser(request);
  const caseId = cleanId(request.data?.caseId);
  const body = cleanText(request.data?.body, 300);
  if (body.length < 2) throw new HttpsError('invalid-argument', '댓글은 2자 이상 입력해 주세요.');
  const resultRef = db.collection('results').doc(caseId);
  const commentRef = db.collection('court_comments').doc(caseId).collection('items').doc();
  const limitRef = db.collection('comment_limits').doc(auth.uid);
  const now = admin.firestore.Timestamp.now();

  await db.runTransaction(async transaction => {
    const [resultSnap, limitSnap] = await Promise.all([transaction.get(resultRef), transaction.get(limitRef)]);
    const result = publicResultOrThrow(resultSnap);
    const lastAt = limitSnap.exists ? limitSnap.data().lastCommentAt?.toMillis?.() || 0 : 0;
    if (Date.now() - lastAt < COMMENT_COOLDOWN_MS) throw new HttpsError('resource-exhausted', '댓글은 잠시 후 다시 작성해 주세요.');
    const nextCount = Math.max(0, Number(result.commentCount || 0)) + 1;
    transaction.set(commentRef, {
      caseId,
      userId: auth.uid,
      displayName: cleanText(auth.token?.name || auth.token?.email?.split('@')[0] || '익명 배심원', 40),
      body,
      createdAt: now,
      updatedAt: now,
    });
    transaction.set(limitRef, { userId: auth.uid, lastCommentAt: now, updatedAt: now }, { merge: true });
    transaction.update(resultRef, { commentCount: nextCount, updatedAt: now });
  });
  return { caseId, commentId: commentRef.id };
});

exports.deleteCourtComment = onCall({ region: REGION, cors: true }, async request => {
  const auth = requireUser(request);
  const caseId = cleanId(request.data?.caseId);
  const commentId = cleanId(request.data?.commentId);
  const resultRef = db.collection('results').doc(caseId);
  const commentRef = db.collection('court_comments').doc(caseId).collection('items').doc(commentId);
  const now = admin.firestore.Timestamp.now();

  await db.runTransaction(async transaction => {
    const [resultSnap, commentSnap] = await Promise.all([transaction.get(resultRef), transaction.get(commentRef)]);
    if (!commentSnap.exists) throw new HttpsError('not-found', '댓글을 찾을 수 없습니다.');
    const result = resultSnap.exists ? resultSnap.data() : {};
    if (commentSnap.data().userId !== auth.uid && result.userId !== auth.uid) throw new HttpsError('permission-denied', '본인 댓글만 삭제할 수 있습니다.');
    transaction.delete(commentRef);
    if (resultSnap.exists) transaction.update(resultRef, { commentCount: Math.max(0, Number(result.commentCount || 0) - 1), updatedAt: now });
  });
  return { caseId, commentId, deleted: true };
});

exports.reportPublicCase = onCall({ region: REGION, cors: true }, async request => {
  const auth = requireUser(request);
  const caseId = cleanId(request.data?.caseId);
  const reason = cleanText(request.data?.reason, 200);
  if (reason.length < 3) throw new HttpsError('invalid-argument', '신고 사유를 입력해 주세요.');
  const resultSnap = await db.collection('results').doc(caseId).get();
  publicResultOrThrow(resultSnap);
  const reportRef = db.collection('reports').doc(`${caseId}_${auth.uid}`);
  await reportRef.set({
    caseId,
    userId: auth.uid,
    reason,
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  logger.info('Public case reported', { caseId, userId: auth.uid });
  return { caseId, reported: true };
});
