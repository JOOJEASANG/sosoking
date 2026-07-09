const { onCall } = require('firebase-functions/v2/https');
const { db, REGION, FieldValue, assertAdmin } = require('./admin-utils');

async function repairSocialCounters(limit = 300, onlyPublic = false) {
  let q = db.collection('results').orderBy('createdAt', 'desc').limit(Math.max(1, Math.min(500, Number(limit) || 300)));
  if (onlyPublic) q = db.collection('results').where('isPublic', '==', true).orderBy('createdAt', 'desc').limit(Math.max(1, Math.min(500, Number(limit) || 300)));
  const snap = await q.get();
  let repairedCount = 0;
  let unchangedCount = 0;
  for (const doc of snap.docs) {
    const caseId = doc.id;
    const [reactionSnap, commentsSnap] = await Promise.all([
      db.doc(`result_reactions/${caseId}`).get().catch(() => null),
      db.collection(`court_comments/${caseId}/items`).where('status', '==', 'visible').count().get().catch(() => null),
    ]);
    const totalVotes = Number(reactionSnap?.exists ? reactionSnap.data().total || 0 : 0);
    const commentCount = Number(commentsSnap?.data()?.count || 0);
    const data = doc.data();
    if (Number(data.reactionTotal || data.totalVotes || 0) !== totalVotes || Number(data.commentCount || 0) !== commentCount) {
      await doc.ref.set({ reactionTotal: totalVotes, totalVotes, commentCount, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      repairedCount++;
    } else unchangedCount++;
  }
  return { checked: snap.size, repairedCount, unchangedCount };
}
exports.repairSocialCountersNow = onCall({ region: REGION, timeoutSeconds: 180, memory: '256MiB' }, async request => { await assertAdmin(request); return repairSocialCounters(request.data?.limit, request.data?.onlyPublic === true); });
exports.recoverStaleTrialsNow = onCall({ region: REGION, timeoutSeconds: 120, memory: '256MiB' }, async request => {
  await assertAdmin(request);
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  const snap = await db.collection('cases').where('status', '==', 'processing').limit(100).get();
  let recoveredCount = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    const t = d.processingStartedAt?.toDate ? d.processingStartedAt.toDate() : null;
    if (!t || t < cutoff) {
      await doc.ref.set({ status: 'pending', courtStage: 'filed', errorMessage: '처리 지연으로 관리자 복구됨', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      recoveredCount++;
    }
  }
  return { checked: snap.size, recoveredCount };
});
module.exports._repairSocialCounters = repairSocialCounters;
