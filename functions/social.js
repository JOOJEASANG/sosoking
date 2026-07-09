const { onCall } = require('firebase-functions/v2/https');
const { db, REGION, FieldValue, HttpsError, textValue, kstDateKey, requireRealLogin, containsPrivatePattern } = require('./admin-utils');

const REACTIONS = ['plaintiff','defendant','both','tooMuch','funny'];
const COMMENT_DAILY_LIMIT = 30;
const COMMENT_COOLDOWN_SEC = 20;
const BLOCK_COMMENT_RE = /(욕설|시발|씨발|ㅅㅂ|병신|개새끼|실명|전화번호|주민번호|계좌번호|카톡아이디|카카오톡|인스타|instagram|telegram|텔레그램)/i;

async function loadNickname(uid, fallback = '익명 방청객') {
  const snap = await db.doc(`users/${uid}`).get().catch(() => null);
  return snap?.exists ? textValue(snap.data().nickname, 20) || fallback : fallback;
}
async function assertPublicResult(caseId) {
  const resultRef = db.doc(`results/${caseId}`);
  const snap = await resultRef.get();
  if (!snap.exists) throw new HttpsError('not-found', '판결문을 찾을 수 없습니다.');
  const data = snap.data();
  if (!data.isPublic) throw new HttpsError('permission-denied', '공개 판결문만 참여할 수 있습니다.');
  return { resultRef, data };
}

exports.voteResult = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  requireRealLogin(request, '방청객 투표는 구글 또는 이메일 로그인 후 이용할 수 있습니다.');
  const uid = request.auth.uid;
  const caseId = textValue(request.data?.caseId, 180);
  const reaction = textValue(request.data?.reaction, 20);
  if (!caseId || !REACTIONS.includes(reaction)) throw new HttpsError('invalid-argument', '잘못된 반응입니다.');
  const { resultRef } = await assertPublicResult(caseId);
  const summaryRef = db.doc(`result_reactions/${caseId}`);
  const voteRef = db.doc(`result_reactions/${caseId}/votes/${uid}`);
  await db.runTransaction(async tx => {
    const voteSnap = await tx.get(voteRef);
    const prev = voteSnap.exists ? voteSnap.data().reaction : '';
    const totalDelta = prev === reaction ? 0 : (prev ? 0 : 1);
    const updates = { updatedAt: FieldValue.serverTimestamp(), total: FieldValue.increment(totalDelta) };
    if (prev && prev !== reaction) updates[`counts.${prev}`] = FieldValue.increment(-1);
    if (prev !== reaction) updates[`counts.${reaction}`] = FieldValue.increment(1);
    tx.set(summaryRef, updates, { merge: true });
    tx.set(voteRef, { uid, reaction, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (totalDelta) tx.set(resultRef, { reactionTotal: FieldValue.increment(totalDelta), totalVotes: FieldValue.increment(totalDelta), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { success: true };
});

exports.addCourtComment = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  requireRealLogin(request, '방청석 한마디는 구글 또는 이메일 로그인 후 남길 수 있습니다.');
  const uid = request.auth.uid;
  const caseId = textValue(request.data?.caseId, 180);
  const text = textValue(request.data?.text, 120);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');
  if (text.length < 2) throw new HttpsError('invalid-argument', '방청석 한마디는 2자 이상 입력해주세요.');
  if (BLOCK_COMMENT_RE.test(text) || containsPrivatePattern(text)) throw new HttpsError('failed-precondition', '개인정보 또는 부적절한 표현이 포함되어 있습니다.');
  const { resultRef } = await assertPublicResult(caseId);
  const nickname = await loadNickname(uid);
  const today = kstDateKey();
  const limitRef = db.doc(`comment_limits/${uid}`);
  const commentRef = db.collection(`court_comments/${caseId}/items`).doc();
  await db.runTransaction(async tx => {
    const limitSnap = await tx.get(limitRef);
    const current = limitSnap.exists ? limitSnap.data() : {};
    const count = current.date === today ? Number(current.count || 0) : 0;
    if (count >= COMMENT_DAILY_LIMIT) throw new HttpsError('resource-exhausted', `오늘 방청석 한마디 한도 ${COMMENT_DAILY_LIMIT}개를 모두 사용했습니다.`);
    if (current.lastCommentedAt && current.date === today) {
      const lastMs = current.lastCommentedAt.toMillis ? current.lastCommentedAt.toMillis() : new Date(current.lastCommentedAt).getTime();
      const diffSec = Math.floor((Date.now() - lastMs) / 1000);
      if (diffSec < COMMENT_COOLDOWN_SEC) throw new HttpsError('resource-exhausted', `${COMMENT_COOLDOWN_SEC - diffSec}초 후에 다시 남길 수 있습니다.`);
    }
    tx.set(commentRef, { uid, nickname, text, status: 'visible', createdAt: FieldValue.serverTimestamp() });
    tx.set(db.doc(`court_comment_stats/${caseId}`), { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(resultRef, { commentCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(limitRef, { date: today, count: count + 1, lastCommentedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { success: true };
});

exports.reportCourtPost = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  requireRealLogin(request, '신고는 로그인 후 이용할 수 있습니다.');
  const uid = request.auth.uid;
  const caseId = textValue(request.data?.caseId, 180);
  const reason = textValue(request.data?.reason, 300);
  if (!caseId || reason.length < 2) throw new HttpsError('invalid-argument', '신고 사유를 입력해주세요.');
  await assertPublicResult(caseId);
  const reportId = `${caseId}_${uid}`;
  await db.doc(`reports/${reportId}`).set({ caseId, reason, status: 'pending', userId: uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await db.doc(`results/${caseId}`).set({ reportCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await db.doc(`cases/${caseId}`).set({ reportCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => null);
  return { success: true };
});
