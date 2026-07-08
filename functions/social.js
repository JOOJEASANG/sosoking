const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const REACTIONS = ['plaintiff','defendant','both','tooMuch','funny'];

function cleanText(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

async function loadNickname(uid, fallback = '익명 방청객') {
  const snap = await db.doc(`users/${uid}`).get().catch(() => null);
  return snap?.exists ? cleanText(snap.data().nickname, 20) || fallback : fallback;
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
    const totalDelta = prev === reaction ? 0 : (prev ? 0 : 1);
    const updates = { updatedAt: FieldValue.serverTimestamp(), total: FieldValue.increment(totalDelta) };
    if (prev && prev !== reaction) updates[`counts.${prev}`] = FieldValue.increment(-1);
    if (prev !== reaction) updates[`counts.${reaction}`] = FieldValue.increment(1);
    tx.set(summaryRef, updates, { merge: true });
    tx.set(voteRef, { uid, reaction, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (totalDelta) {
      tx.set(resultRef, {
        reactionTotal: FieldValue.increment(totalDelta),
        totalVotes: FieldValue.increment(totalDelta),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  });
  return { success: true };
});

exports.addCourtComment = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  const text = cleanText(request.data?.text, 120);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');
  if (text.length < 2) throw new HttpsError('invalid-argument', '방청석 한마디는 2자 이상 입력해주세요.');
  if (/(욕설|시발|씨발|병신|개새끼|죽어|자살|실명|전화번호)/i.test(text)) throw new HttpsError('failed-precondition', '부적절한 표현이 포함되어 있습니다.');
  const { resultRef } = await assertPublicResult(caseId);
  const nickname = await loadNickname(uid);
  const commentRef = db.collection(`court_comments/${caseId}/items`).doc();
  const batch = db.batch();
  batch.set(commentRef, { uid, nickname, text, status: 'visible', createdAt: FieldValue.serverTimestamp() });
  batch.set(db.doc(`court_comment_stats/${caseId}`), { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.set(resultRef, { commentCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();
  return { success: true };
});

exports.requestAppeal = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 180, memory: '512MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  const reason = cleanText(request.data?.reason, 160) || '1심 판결이 지나치게 엄숙하여 다시 판단을 구합니다.';
  const caseRef = db.doc(`cases/${caseId}`);
  const caseSnap = await caseRef.get();
  if (!caseSnap.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
  const c = caseSnap.data();
  if (c.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 항소할 수 있습니다.');
  const resultRef = db.doc(`results/${caseId}`);
  const resultSnap = await resultRef.get();
  if (!resultSnap.exists) throw new HttpsError('not-found', '판결문을 찾을 수 없습니다.');
  const r = resultSnap.data();
  if (r.appeal?.verdict) return { success: true, alreadyExists: true };

  const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = `소소킹 판결소 항소심 판결문을 작성하세요. 실제 법적 효력은 없고 오락 목적임을 포함하세요.\n\n사건명: ${c.caseTitle || r.caseTitle}\n1심 판사: ${r.judgeType || 'AI'}\n1심 주문: ${r.sentence || ''}\n1심 판결 이유: ${r.verdict || ''}\n항소이유: ${reason}\n\n형식:\n1. 항소심 주문\n2. 항소이유 요지\n3. 항소심 판단\n4. 최종 생활형 처분\n\n진짜 판결문처럼 진지하지만 별것 아닌 생활사건이라 웃기게, 3문단 이내.`;
  const ai = await model.generateContent(prompt);
  const appealVerdict = cleanText(ai.response.text(), 1800);
  await resultRef.set({ appeal: { reason, verdict: appealVerdict, createdAt: FieldValue.serverTimestamp() }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await caseRef.set({ hasAppeal: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { success: true, verdict: appealVerdict };
});
