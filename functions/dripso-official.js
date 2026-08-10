'use strict';

const { randomUUID } = require('node:crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { isAdminAuth } = require('./admin-utils');
const { requireVerifiedUser } = require('./security');
const { OFFICIAL_BATTLES } = require('./dripso-official-pool');

const REGION = 'asia-northeast3';
const GAME_VERSION = 3;
const ENTRY_MINUTES = 1440;
const PRELIM_MINUTES = 720;
const FINALS_MINUTES = 60;
const SYSTEM_UID = 'system-dripso-official';
const MANUAL_STATE_REF = 'dripso_official_state/manual';
const ACTIVE_MODES = new Set(['naming', 'wrong']);
const ACTIVE_OFFICIAL_BATTLES = OFFICIAL_BATTLES.filter(item => ACTIVE_MODES.has(item.mode));

function cleanText(value, maxLen = 200) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function manualTopicId(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `official-manual-${stamp}-${randomUUID().slice(0, 8)}`;
}

async function createOfficialBattle(options = {}) {
  const db = getFirestore();
  const now = options.now instanceof Date ? options.now : new Date();
  const startMs = Number(options.startMs) || now.getTime();
  const stateRef = db.doc(MANUAL_STATE_REF);
  const topicId = manualTopicId(now);
  const topicRef = db.doc(`dripso_topics/${topicId}`);
  const authorRef = db.doc(`dripso_topic_authors/${topicId}`);
  const entryDeadlineMs = startMs + ENTRY_MINUTES * 60000;
  const prelimDeadlineMs = entryDeadlineMs + PRELIM_MINUTES * 60000;
  const semifinalDeadlineMs = prelimDeadlineMs + FINALS_MINUTES * 60000;
  const finalDeadlineMs = semifinalDeadlineMs + FINALS_MINUTES * 60000;
  let selected = null;
  let selectedIndex = 0;

  if (!ACTIVE_OFFICIAL_BATTLES.length) throw new Error('활성 공식 드립 주제 풀을 찾을 수 없습니다.');

  await db.runTransaction(async tx => {
    const stateSnap = await tx.get(stateRef);
    const currentIndex = stateSnap.exists
      ? Math.max(0, Number(stateSnap.data()?.nextIndex) || 0)
      : 0;
    selectedIndex = currentIndex % ACTIVE_OFFICIAL_BATTLES.length;
    selected = ACTIVE_OFFICIAL_BATTLES[selectedIndex];
    if (!selected) throw new Error('공식 드립 주제 풀을 찾을 수 없습니다.');

    const topicData = {
      type: selected.mode === 'naming' ? 'naming' : 'situation',
      mode: selected.mode,
      gameVersion: GAME_VERSION,
      tournamentVersion: 1,
      title: selected.title,
      prompt: `[[dripso-mode:${selected.mode}]] ${selected.prompt}`,
      nickname: '드립소 공식',
      status: 'visible',
      official: true,
      officialKind: 'admin-manual',
      officialSourceId: selected.id,
      officialCategory: selected.category,
      officialDifficulty: selected.difficulty,
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
    tx.set(stateRef, {
      nextIndex: currentIndex + 1,
      lastTopicId: topicId,
      lastSourceId: selected.id,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    tx.set(db.doc(`dripso_official_usage/${selected.id}`), {
      sourceId: selected.id,
      mode: selected.mode,
      category: selected.category,
      lastTopicId: topicId,
      publishCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  return {
    created: true,
    topicId,
    sourceId: selected.id,
    sourceIndex: selectedIndex,
    mode: selected.mode,
    title: selected.title,
    entryDeadlineMs,
    prelimDeadlineMs,
    semifinalDeadlineMs,
    finalDeadlineMs
  };
}

exports.createOfficialDripsoBattleNow = onCall({
  region: REGION,
  timeoutSeconds: 120,
  memory: '256MiB'
}, async request => {
  requireVerifiedUser(request);
  if (!(await isAdminAuth(request.auth))) {
    throw new HttpsError('permission-denied', '관리자만 공식 드립소 주제를 생성할 수 있습니다.');
  }

  const result = await createOfficialBattle();
  await getFirestore().collection('admin_logs').add({
    uid: cleanText(request.auth.uid, 128),
    action: 'createOfficialDripsoBattleNow',
    subjectId: result.topicId,
    detail: {
      sourceId: result.sourceId,
      mode: result.mode,
      title: cleanText(result.title, 80)
    },
    createdAt: FieldValue.serverTimestamp()
  });
  return result;
});

Object.defineProperties(module.exports, {
  createOfficialBattle: { value: createOfficialBattle }
});
