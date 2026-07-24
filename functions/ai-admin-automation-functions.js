'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

function dayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

async function assertAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자 권한이 필요합니다.');
}

async function enabled() {
  const snap = await db.doc('site_settings/config').get().catch(() => null);
  return snap?.exists && snap.data()?.aiAdminAutomationEnabled === true;
}

async function reportSummary() {
  const snap = await db.collection('reports')
    .where('resolved', '==', false)
    .limit(500)
    .get()
    .catch(() => ({ docs: [] }));
  const byPost = new Map();
  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    if (!data.postId) continue;
    const item = byPost.get(data.postId) || { postId: data.postId, count: 0, reasons: [], reportIds: [] };
    item.count += 1;
    if (data.reason) item.reasons.push(String(data.reason).slice(0, 100));
    item.reportIds.push(docSnap.id);
    byPost.set(data.postId, item);
  }
  return {
    unresolvedReports: snap.docs.length,
    posts: [...byPost.values()].sort((a, b) => b.count - a.count).slice(0, 50),
  };
}

async function dailyStats() {
  const date = dayKey();
  const start = Timestamp.fromDate(new Date(`${date}T00:00:00+09:00`));
  const [posts, aiPosts, reports, usage] = await Promise.all([
    db.collection('feeds').where('createdAt', '>=', start).limit(1000).get().catch(() => ({ size: 0 })),
    db.collection('feeds').where('isAiGenerated', '==', true).where('aiGeneratedDate', '==', date).limit(100).get().catch(() => ({ size: 0 })),
    db.collection('reports').where('resolved', '==', false).limit(1000).get().catch(() => ({ size: 0 })),
    db.doc(`ai_usage/${date}`).get().catch(() => null),
  ]);
  return {
    date,
    todayPosts: posts.size || 0,
    todayAiPosts: aiPosts.size || 0,
    unresolvedReports: reports.size || 0,
    aiUsage: usage?.exists ? usage.data() : {},
  };
}

async function runAutomation(actorId = 'scheduler') {
  if (!(await enabled())) return { skipped: true, reason: 'disabled' };
  const [stats, reports] = await Promise.all([dailyStats(), reportSummary()]);
  const summary = {
    ...stats,
    unresolvedReports: reports.unresolvedReports,
    reportPosts: reports.posts,
    requiresAdminReview: reports.posts.filter(item => item.count >= 2).map(item => item.postId),
    actorId,
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
  };
  await db.doc(`admin_summaries/${stats.date}`).set(summary, { merge: true });
  await db.doc(`system_jobs/admin_automation_${stats.date}`).set({
    status: 'done', actorId, reportPostCount: reports.posts.length,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { ok: true, summary };
}

const dailyAdminAutomation = onSchedule({
  region: REGION, schedule: '20 8 * * *', timeZone: 'Asia/Seoul', timeoutSeconds: 120,
}, async () => runAutomation());

const runAdminAutomationNow = onCall({ region: REGION, timeoutSeconds: 120 }, async request => {
  await assertAdmin(request.auth?.uid);
  return runAutomation(request.auth.uid);
});

const getAdminAutomationStatus = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  await assertAdmin(request.auth?.uid);
  const today = dayKey();
  const [summary, settings, usage] = await Promise.all([
    db.doc(`admin_summaries/${today}`).get(),
    db.doc('site_settings/config').get(),
    db.doc(`ai_usage/${today}`).get(),
  ]);
  return {
    today,
    summary: summary.exists ? summary.data() : null,
    settings: settings.exists ? settings.data() : {},
    aiUsage: usage.exists ? usage.data() : {},
  };
});

module.exports = { dailyAdminAutomation, runAdminAutomationNow, getAdminAutomationStatus };
