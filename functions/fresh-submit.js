const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { db, FieldValue, REGION, clean, docketNumber, titleFromDescription } = require('./fresh-utils');

exports.submitCase = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const caseDescription = clean(request.data?.caseDescription, 1200);
  if (caseDescription.length < 5) throw new HttpsError('invalid-argument', '사건 내용을 5자 이상 입력해주세요.');

  const caseTitle = clean(request.data?.caseTitle, 80) || titleFromDescription(caseDescription);
  const ref = db.collection('cases').doc();
  const payload = {
    userId: request.auth.uid,
    nickname: clean(request.data?.nickname, 30) || '익명 원고',
    caseTitle,
    caseDescription,
    desiredVerdict: clean(request.data?.desiredVerdict, 200),
    grievanceIndex: Math.max(1, Math.min(10, Number(request.data?.grievanceIndex || 5))),
    docketNumber: docketNumber(),
    isPublic: request.data?.isPublic !== false,
    status: 'pending',
    courtStage: 'filed',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  await ref.set(payload);
  return { success: true, caseId: ref.id, docketNumber: payload.docketNumber, caseTitle };
});
