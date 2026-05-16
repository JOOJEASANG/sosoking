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
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
}

async function getSettings() {
  const snap = await db.doc('site_settings/config').get();
  const data = snap.exists ? snap.data() || {} : {};
  return {
    aiAdminAutomationEnabled: data.aiAdminAutomationEnabled !== false,
    autoHideReportedPosts: data.autoHideReportedPosts === true,
    reportHideThreshold: Math.max(2, Number(data.reportHideThreshold ?? 3)),
    notificationRetentionDays: Math.max(7, Number(data.notificationRetentionDays ?? 45)),
  };
}

async function closeExpiredMissions() {
  const now = Timestamp.now();
  const snap = await db.collection('missions')
    .where('active', '==', true)
    .where('endDate', '<', now)
    .limit(200)
    .get()
    .catch(() => ({ docs: [] }));
  if (!snap.docs.length) return 0;
  const batch = db.batch();
  snap.docs.forEach(doc => batch.update(doc.ref, {
    active: false,
    autoClosedAt: FieldValue.serverTimestamp(),
    autoClosedBy: 'ai-admin-automation',
  }));
  await batch.commit();
  return snap.docs.length;
}

async function cleanupOldNotifications(retentionDays) {
  const cutoff = Timestamp.fromDate(new Date(Date.now() - retentionDays * 86400000));
  const snap = await db.collection('notifications')
    .where('read', '==', true)
    .where('createdAt', '<', cutoff)
    .limit(300)
    .get()
    .catch(() => ({ docs: [] }));
  if (!snap.docs.length) return 0;
  const batch = db.batch();
  snap.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  return snap.docs.length;
}

async function summarizeReports({ autoHideReportedPosts, reportHideThreshold }) {
  const snap = await db.collection('reports')
    .where('resolved', '==', false)
    .limit(200)
    .get()
    .catch(() => ({ docs: [] }));

  const byPost = new Map();
  snap.docs.forEach(doc => {
    const data = doc.data() || {};
    if (!data.postId) return;
    const item = byPost.get(data.postId) || { postId: data.postId, count: 0, reasons: [], reportIds: [] };
    item.count += 1;
    if (data.reason) item.reasons.push(String(data.reason).slice(0, 80));
    item.reportIds.push(doc.id);
    byPost.set(data.postId, item);
  });

  let hiddenCount = 0;
  const riskyPosts = [...byPost.values()].filter(item => item.count >= reportHideThreshold);
  if (autoHideReportedPosts && riskyPosts.length) {
    const batch = db.batch();
    riskyPosts.slice(0, 50).forEach(item => {
      batch.set(db.doc(`feeds/${item.postId}`), {
        hidden: true,
        autoHiddenAt: FieldValue.serverTimestamp(),
        autoHiddenBy: 'ai-admin-automation',
        autoHiddenReason: `unresolved reports >= ${reportHideThreshold}`,
      }, { merge: true });
      hiddenCount += 1;
    });
    await batch.commit();
  }

  return { unresolvedReports: snap.docs.length, riskyPosts: riskyPosts.slice(0, 20), autoHiddenPosts: hiddenCount };
}

async function collectDailyStats() {
  const today = dayKey();
  const todayStart = new Date(`${today}T00:00:00+09:00`);
  const todayTs = Timestamp.fromDate(todayStart);
  const [postsSnap, aiPostsSnap, missionsSnap, reportsSnap, usageSnap] = await Promise.all([
    db.collection('feeds').where('createdAt', '>=', todayTs).limit(500).get().catch(() => ({ size: 0 })),
    db.collection('feeds').where('isAiGenerated', '==', true).where('aiGeneratedDate', '==', today).limit(100).get().catch(() => ({ size: 0 })),
    db.collection('missions').where('active', '==', true).limit(50).get().catch(() => ({ size: 0 })),
    db.collection('reports').where('resolved', '==', false).limit(500).get().catch(() => ({ size: 0 })),
    db.doc(`ai_usage/${today}`).get().catch(() => null),
  ]);
  return {
    date: today,
    todayPosts: postsSnap.size || 0,
    todayAiPosts: aiPostsSnap.size || 0,
    activeMissions: missionsSnap.size || 0,
    unresolvedReports: reportsSnap.size || 0,
    aiUsage: usageSnap && usageSnap.exists ? usageSnap.data() : { total: 0 },
  };
}

async function runAdminAutomation({ actorId = 'scheduler' } = {}) {
  const settings = await getSettings();
  if (!settings.aiAdminAutomationEnabled) return { skipped: true, reason: 'disabled-by-admin' };

  const [closedMissions, removedNotifications, reportSummary, stats] = await Promise.all([
    closeExpiredMissions(),
    cleanupOldNotifications(settings.notificationRetentionDays),
    summarizeReports(settings),
    collectDailyStats(),
  ]);

  const summary = {
    ...stats,
    closedMissions,
    removedNotifications,
    unresolvedReports: reportSummary.unresolvedReports,
    riskyPosts: reportSummary.riskyPosts.map(item => ({ postId: item.postId, count: item.count, reasons: item.reasons.slice(0, 3) })),
    autoHiddenPosts: reportSummary.autoHiddenPosts,
    settings,
    actorId,
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
  };

  await db.doc(`admin_summaries/${stats.date}`).set(summary, { merge: true });
  await db.doc(`system_jobs/admin_automation_${stats.date}`).set({
    status: 'done',
    actorId,
    closedMissions,
    removedNotifications,
    autoHiddenPosts: reportSummary.autoHiddenPosts,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true, summary };
}

const dailyAdminAutomation = onSchedule(
  { region: REGION, schedule: '20 8 * * *', timeZone: 'Asia/Seoul', timeoutSeconds: 120, memory: '256MiB' },
  async () => { await runAdminAutomation({ actorId: 'scheduler' }); }
);

const runAdminAutomationNow = onCall({ region: REGION, timeoutSeconds: 120 }, async (request) => {
  await assertAdmin(request.auth && request.auth.uid);
  return runAdminAutomation({ actorId: request.auth.uid });
});

const getAdminAutomationStatus = onCall({ region: REGION, timeoutSeconds: 30 }, async (request) => {
  await assertAdmin(request.auth && request.auth.uid);
  const today = dayKey();
  const [summarySnap, settingsSnap, usageSnap] = await Promise.all([
    db.doc(`admin_summaries/${today}`).get(),
    db.doc('site_settings/config').get(),
    db.doc(`ai_usage/${today}`).get(),
  ]);
  return {
    today,
    summary: summarySnap.exists ? summarySnap.data() : null,
    settings: settingsSnap.exists ? settingsSnap.data() : {},
    aiUsage: usageSnap.exists ? usageSnap.data() : { total: 0 },
  };
});

module.exports = { dailyAdminAutomation, runAdminAutomationNow, getAdminAutomationStatus };
