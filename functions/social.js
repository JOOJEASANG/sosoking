const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const REACTIONS = ['king','plaintiff','defendant','both','tooMuch','funny'];

function cleanText(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

async function loadNickname(uid, fallback = '익명 시청자') {
  const snap = await db.doc(`users/${uid}`).get().catch(() => null);
  return snap?.exists ? cleanText(snap.data().nickname, 20) || fallback : fallback;
}

async function assertPublicResult(caseId) {
  const resultRef = db.doc(`results/${caseId}`);
  const snap = await resultRef.get();
  if (!snap.exists) throw new HttpsError('not-found', '결정문을 찾을 수 없습니다.');
  const data = snap.data();
  if (!data.isPublic) throw new HttpsError('permission-denied', '공개 기록만 참여할 수 있습니다.');
  return { resultRef, data };
}

exports.voteResult = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  const reaction = cleanText(request.data?.reaction, 20);
  if (!caseId || !REACTIONS.includes(reaction)) throw new HttpsError('invalid-argument', '잘못된 반응입니다.');
  const { resultRef } = await assertPublicResult(caseId);

  const summaryRef = db.doc(`result_reactions/${caseId}`);
  const voteRef = db.doc(`result_reactions/${caseId}/votes/${uid}`);
  await db.runTransaction(async tx => {
    const voteSnap = await tx.get(voteRef);
    const prev = voteSnap.exists ? voteSnap.data().reaction : '';
    const isNewVote = !prev;
    const changed = prev !== reaction;
    const summaryUpdates = {
      updatedAt: FieldValue.serverTimestamp(),
      total: FieldValue.increment(isNewVote ? 1 : 0)
    };
    if (prev && changed) summaryUpdates[`counts.${prev}`] = FieldValue.increment(-1);
    if (changed) summaryUpdates[`counts.${reaction}`] = FieldValue.increment(1);
    tx.set(summaryRef, summaryUpdates, { merge: true });

    const resultUpdates = {
      updatedAt: FieldValue.serverTimestamp(),
      reactionTotal: FieldValue.increment(isNewVote ? 1 : 0)
    };
    if (prev === 'king' && changed) resultUpdates.kingCount = FieldValue.increment(-1);
    if (reaction === 'king' && changed) resultUpdates.kingCount = FieldValue.increment(1);
    tx.set(resultRef, resultUpdates, { merge: true });

    tx.set(voteRef, { uid, reaction, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { success: true };
});

exports.addCourtComment = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  const text = cleanText(request.data?.text, 120);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');
  if (text.length < 2) throw new HttpsError('invalid-argument', '댓글은 2자 이상 입력해주세요.');
  if (/(욕설|시발|씨발|병신|개새끼|죽어|자살|실명|전화번호)/i.test(text)) throw new HttpsError('failed-precondition', '부적절한 표현이 포함되어 있습니다.');
  await assertPublicResult(caseId);
  const nickname = await loadNickname(uid);
  const commentRef = db.collection(`court_comments/${caseId}/items`).doc();
  await commentRef.set({ uid, nickname, text, status: 'visible', createdAt: FieldValue.serverTimestamp() });
  await db.doc(`court_comment_stats/${caseId}`).set({ count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await db.doc(`results/${caseId}`).set({ commentCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { success: true };
});

exports.requestAppeal = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 180, memory: '512MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  const reason = cleanText(request.data?.reason, 160) || '소소긴급위원회의 결정이 지나치게 엄숙하여 다시 판단을 구합니다.';
  const caseRef = db.doc(`cases/${caseId}`);
  const caseSnap = await caseRef.get();
  if (!caseSnap.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
  const c = caseSnap.data();
  if (c.userId !== uid) throw new HttpsError('permission-denied', '본인 접수만 재검토할 수 있습니다.');
  const resultRef = db.doc(`results/${caseId}`);
  const resultSnap = await resultRef.get();
  if (!resultSnap.exists) throw new HttpsError('not-found', '결정문을 찾을 수 없습니다.');
  const r = resultSnap.data();
  if (r.appeal?.verdict) return { success: true, alreadyExists: true };

  const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = `소소킹 소소긴급위원회의 재검토 결정문을 작성하세요. 실제 법적 효력은 없고 오락 목적임을 포함하세요.\n\n제목: ${c.caseTitle || r.caseTitle}\n위원 성향: ${r.judgeType || 'AI'}\n처분: ${r.sentence || ''}\n기존 판단: ${r.committeeJudgment || r.verdict || ''}\n재검토 사유: ${reason}\n\n형식:\n1. 재검토 주문\n2. 재검토 사유 요지\n3. 위원회 판단\n4. 최종 소소 처분\n\n진지한 기관 문서처럼 보이지만 내용은 별것 아닌 한 줄 소소사건이라 웃기게, 3문단 이내.`;
  const ai = await model.generateContent(prompt);
  const appealVerdict = cleanText(ai.response.text(), 1800);
  await resultRef.set({ appeal: { reason, verdict: appealVerdict, createdAt: FieldValue.serverTimestamp() }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await caseRef.set({ hasAppeal: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { success: true, verdict: appealVerdict };
});
