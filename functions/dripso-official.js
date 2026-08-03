'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { MODE_ORDER, BY_MODE } = require('./dripso-official-pool');

const REGION = 'asia-northeast3';
const TIME_ZONE = 'Asia/Seoul';
const GAME_VERSION = 3;
const ENTRY_MINUTES = 1440;
const PRELIM_MINUTES = 720;
const FINALS_MINUTES = 60;
const SYSTEM_UID = 'system-dripso-official';

function koreaDateParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(value);
  const result = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { year: Number(result.year), month: Number(result.month), day: Number(result.day) };
}

function officialSelection(value = new Date()) {
  const { year, month, day } = koreaDateParts(value);
  const dateKey = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  const mode = MODE_ORDER[((dayNumber % MODE_ORDER.length) + MODE_ORDER.length) % MODE_ORDER.length];
  const modePool = BY_MODE[mode];
  const item = modePool[Math.floor(dayNumber / MODE_ORDER.length) % modePool.length];
  return { dateKey, dayNumber, mode, item };
}

async function ensureOfficialBattle(options = {}) {
  const db = getFirestore();
  const now = options.now instanceof Date ? options.now : new Date();
  const startMs = Number(options.startMs) || now.getTime();
  const { dateKey, mode, item } = officialSelection(now);
  const topicId = `official-${dateKey}`;
  const topicRef = db.doc(`dripso_topics/${topicId}`);
  const authorRef = db.doc(`dripso_topic_authors/${topicId}`);
  const runRef = db.doc(`dripso_official_runs/${dateKey}`);
  const usageRef = db.doc(`dripso_official_usage/${item.id}`);
  const entryDeadlineMs = startMs + ENTRY_MINUTES * 60000;
  const prelimDeadlineMs = entryDeadlineMs + PRELIM_MINUTES * 60000;
  const semifinalDeadlineMs = prelimDeadlineMs + FINALS_MINUTES * 60000;
  const finalDeadlineMs = semifinalDeadlineMs + FINALS_MINUTES * 60000;
  let created = false;

  await db.runTransaction(async tx => {
    const [topicSnap, runSnap] = await Promise.all([tx.get(topicRef), tx.get(runRef)]);
    if (topicSnap.exists) {
      if (!runSnap.exists) {
        tx.set(runRef, {
          topicId,
          sourceId: item.id,
          dateKey,
          status: 'published',
          repairedAt: FieldValue.serverTimestamp()
        });
      }
      return;
    }

    const topicData = {
      type: mode === 'naming' ? 'naming' : 'situation',
      mode,
      gameVersion: GAME_VERSION,
      tournamentVersion: 1,
      title: item.title,
      prompt: `[[dripso-mode:${mode}]] ${item.prompt}`,
      nickname: '드립소 공식',
      status: 'visible',
      official: true,
      officialKind: 'daily',
      officialDate: dateKey,
      officialSourceId: item.id,
      officialCategory: item.category,
      officialDifficulty: item.difficulty,
      commentCount: 0,
      prelimVoteCount: 0,
      tournamentVoteCount: 0,
      pairVoteCount: 0,
      maxEntries: 64,
      entryMinutes: ENTRY_MINUTES,
      prelimMinutes: PRELIM_MINUTES,
      finalsMinutes: FINALS_MINUTES,
      entryDeadline: Timestamp.fromMillis(entryDeadlineMs),
      prelimDeadline: Timestamp.fromMillis(prelimDeadlineMs),
      semifinalDeadline: Timestamp.fromMillis(semifinalDeadlineMs),
      finalDeadline: Timestamp.fromMillis(finalDeadlineMs),
      votingDeadline: Timestamp.fromMillis(finalDeadlineMs),
      tournamentRound: 'prelim',
      createdAt: Timestamp.fromMillis(startMs),
      updatedAt: FieldValue.serverTimestamp()
    };

    tx.set(topicRef, topicData);
    tx.set(authorRef, {
      uid: SYSTEM_UID,
      topicId,
      system: true,
      official: true,
      createdAt: FieldValue.serverTimestamp()
    });
    tx.set(runRef, {
      topicId,
      sourceId: item.id,
      dateKey,
      mode,
      status: 'published',
      publishedAt: FieldValue.serverTimestamp()
    });
    tx.set(usageRef, {
      sourceId: item.id,
      mode,
      category: item.category,
      lastTopicId: topicId,
      lastDateKey: dateKey,
      publishCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    created = true;
  });

  return {
    created,
    topicId,
    dateKey,
    sourceId: item.id,
    mode,
    title: item.title,
    entryDeadlineMs,
    prelimDeadlineMs,
    semifinalDeadlineMs,
    finalDeadlineMs
  };
}

exports.publishDailyOfficialDripsoBattle = onSchedule({
  region: REGION,
  schedule: '0 9 * * *',
  timeZone: TIME_ZONE,
  timeoutSeconds: 120,
  memory: '256MiB',
  retryCount: 2
}, async () => {
  const result = await ensureOfficialBattle();
  console.log('Official Dripso battle ensured:', result);
});

// CLI와 회귀검사에서만 사용하며 Firebase 배포 표면에는 노출하지 않는다.
module.exports.ensureOfficialBattle = ensureOfficialBattle;
module.exports.officialSelection = officialSelection;
