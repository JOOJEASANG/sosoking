const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { isAdminAuth } = require('./admin-utils');
const { requireVerifiedUser } = require('./security');

const db = getFirestore();
const REGION = 'asia-northeast3';

async function aggregateCount(query) {
  const snapshot = await query.count().get();
  return Number(snapshot.data().count || 0);
}

function safePublicResultsQuery() {
  return db.collection('results')
    .where('isPublic', '==', true)
    .where('publicDataVersion', '==', 1);
}

async function refreshPublicStats() {
  const [completedCases, publicResults] = await Promise.all([
    aggregateCount(db.collection('cases').where('status', '==', 'completed')),
    aggregateCount(safePublicResultsQuery())
  ]);

  const recentResults = await safePublicResultsQuery()
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const judgeCounts = {};
  for (const document of recentResults.docs) {
    const data = document.data();
    const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : 0;
    if (!createdAt || createdAt < oneWeekAgo || !data.judgeType) continue;
    const judgeType = String(data.judgeType).slice(0, 30);
    judgeCounts[judgeType] = (judgeCounts[judgeType] || 0) + 1;
  }

  const popularJudge = Object.entries(judgeCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko-KR'))[0]?.[0] || '';

  await db.doc('site_public/statistics').set({
    completedCases,
    publicResults,
    popularJudge,
    generatedAt: FieldValue.serverTimestamp(),
    schemaVersion: 2
  }, { merge: true });

  return { completedCases, publicResults, popularJudge };
}

exports.syncPublicStats = onSchedule({
  region: REGION,
  schedule: 'every 30 minutes',
  timeZone: 'Asia/Seoul',
  timeoutSeconds: 120,
  memory: '256MiB'
}, async () => {
  console.log('public statistics:', await refreshPublicStats());
});

exports.syncPublicStatsNow = onCall({
  region: REGION,
  timeoutSeconds: 120,
  memory: '256MiB'
}, async request => {
  requireVerifiedUser(request);
  if (!(await isAdminAuth(request.auth))) {
    throw new HttpsError('permission-denied', '관리자만 통계를 갱신할 수 있습니다.');
  }
  return await refreshPublicStats();
});

// 배포 엔트리의 Object.assign에는 포함되지 않지만 배포 시 CLI에서 사용할 수 있다.
Object.defineProperty(module.exports, 'refreshPublicStats', {
  value: refreshPublicStats,
  enumerable: false
});
