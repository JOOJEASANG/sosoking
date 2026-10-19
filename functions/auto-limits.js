'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

// Thresholds: scale down if avg utilization > HIGH, scale up if < LOW.
const UTIL_HIGH = 0.80;
const UTIL_LOW = 0.30;
const SCALE_FACTOR = 0.20; // 20% step

function clampInt(value, fallback, min, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

// Returns dates for the last N days (not including today) in KST.
function lastNDays(n) {
  const days = [];
  const now = new Date();
  for (let i = 1; i <= n; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    days.push(kstDateKey(d));
  }
  return days;
}

exports.autoAdjustLimits = onSchedule({
  schedule: 'every 24 hours',
  region: REGION,
  timeoutSeconds: 60,
  memory: '256MiB'
}, async () => {
  const days = lastNDays(7);

  // Read usage stats for last 7 days.
  const statSnaps = await Promise.all(
    days.map(date => db.doc(`usage_stats/daily_${date}`).get())
  );

  let totalAiUsed = 0;
  let totalAiLimit = 0;
  let daysWithData = 0;

  for (const snap of statSnaps) {
    if (!snap.exists) continue;
    const d = snap.data();
    const used = Number(d.aiRequestCount || 0);
    const limit = Number(d.globalAiDailyLimit || 0);
    if (limit > 0) {
      totalAiUsed += used;
      totalAiLimit += limit;
      daysWithData++;
    }
  }

  if (daysWithData < 3) {
    // Not enough data — skip adjustment.
    console.log('auto-limits: not enough days with data, skipping');
    return;
  }

  const utilization = totalAiUsed / totalAiLimit;
  console.log(`auto-limits: 7-day AI utilization ${(utilization * 100).toFixed(1)}% (${totalAiUsed}/${totalAiLimit} over ${daysWithData} days)`);

  const configRef = db.doc('site_settings/config');
  const configSnap = await configRef.get();
  const config = configSnap.exists ? configSnap.data() : {};

  const currentGlobal = clampInt(config.globalAiDailyLimit, 100, 10, 10000);
  const currentUser = clampInt(config.userAiDailyLimit, 12, 1, 1000);
  const currentAdviceAnon = clampInt(config.adviceAnonDailyLimit, 3, 1, 100);
  const currentAdviceMember = clampInt(config.adviceUserDailyLimit, 10, 1, 1000);
  const currentTranslateAnon = clampInt(config.translateAnonDailyLimit, 5, 1, 100);
  const currentTranslateMember = clampInt(config.translateUserDailyLimit, 20, 1, 1000);

  let factor = 1;
  let reason = 'no change';

  if (utilization > UTIL_HIGH) {
    factor = 1 - SCALE_FACTOR;
    reason = `high utilization (${(utilization * 100).toFixed(1)}%) → scaling down ${SCALE_FACTOR * 100}%`;
  } else if (utilization < UTIL_LOW) {
    factor = 1 + SCALE_FACTOR;
    reason = `low utilization (${(utilization * 100).toFixed(1)}%) → scaling up ${SCALE_FACTOR * 100}%`;
  }

  if (factor === 1) {
    console.log('auto-limits: utilization in normal range, no adjustment needed');
    return;
  }

  const newGlobal = clampInt(currentGlobal * factor, 100, 20, 10000);
  const newUser = clampInt(currentUser * factor, 12, 1, 500);
  const newAdviceAnon = clampInt(currentAdviceAnon * factor, 3, 1, 50);
  const newAdviceMember = clampInt(currentAdviceMember * factor, 10, 1, 500);
  const newTranslateAnon = clampInt(currentTranslateAnon * factor, 5, 1, 50);
  const newTranslateMember = clampInt(currentTranslateMember * factor, 20, 1, 500);

  await configRef.set({
    globalAiDailyLimit: newGlobal,
    userAiDailyLimit: newUser,
    adviceAnonDailyLimit: newAdviceAnon,
    adviceUserDailyLimit: newAdviceMember,
    translateAnonDailyLimit: newTranslateAnon,
    translateUserDailyLimit: newTranslateMember,
    autoLimitsLastRun: FieldValue.serverTimestamp(),
    autoLimitsLastReason: reason
  }, { merge: true });

  console.log(`auto-limits: ${reason} → global ${currentGlobal}→${newGlobal}, user ${currentUser}→${newUser}`);
});
