const { onCall } = require('firebase-functions/v2/https');
const { db, REGION, FieldValue, HttpsError, textValue, requireRealLogin, kstDateKey } = require('./admin-utils');

const MAX_DAILY = 20;
function smartTitle(desc) {
  const cleaned = textValue(desc, 320).replace(/^(제가|내가|나는|저는|나|저)\s*/g, '').replace(/[.!?。！？].*$/g, '').trim();
  const base = cleaned.slice(0, 28).trim() || '소소한 일상';
  return base.endsWith('사건') ? base : `${base} 사건`;
}
exports.suggestCaseTitle = onCall({ region: REGION, timeoutSeconds: 20, memory: '256MiB' }, async request => {
  requireRealLogin(request, '사건명 추천은 로그인 후 이용할 수 있습니다.');
  const uid = request.auth.uid;
  const desc = textValue(request.data?.caseDescription || request.data?.description, 320);
  if (desc.length < 5) throw new HttpsError('invalid-argument', '사건 내용을 조금 더 입력해주세요.');
  const today = kstDateKey();
  const limitRef = db.doc(`title_suggestion_limits/${uid}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(limitRef);
    const cur = snap.exists ? snap.data() : {};
    const count = cur.date === today ? Number(cur.count || 0) : 0;
    if (count >= MAX_DAILY) throw new HttpsError('resource-exhausted', '오늘 사건명 추천 한도를 모두 사용했습니다.');
    tx.set(limitRef, { date: today, count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { success: true, caseTitle: smartTitle(desc) };
});
