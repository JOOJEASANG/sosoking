'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';
const MIGRATION_ID = 'community_cleanup_v1';

async function assertAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자 권한이 필요합니다.');
}

function normalizeSubtype(post = {}) {
  const raw = String(post.subtype || post.feedType || post.type || '').toLowerCase();
  if (post.modules?.consult?.enabled === true || ['consult', 'advice', 'worry'].includes(raw)) return 'consult';
  if (post.modules?.drip?.enabled === true || ['drip', 'cbattle', 'funny'].includes(raw)) return 'drip';
  if (post.modules?.vote?.enabled === true) return post.modules.vote.voteMode === 'judgment' ? 'judgment' : 'vote';
  if (['judgment', 'verdict', 'court', 'crazy_court'].includes(raw)) return 'judgment';
  if (['vote', 'debate', 'discussion', 'ox', 'balance', 'battle'].includes(raw)) return 'vote';
  return '';
}

function label(subtype) {
  return ({ judgment: '판결', consult: '상담', vote: '토론', drip: '드립' })[subtype] || '';
}

function feedType(subtype) {
  return subtype === 'drip' ? 'drip' : subtype === 'consult' ? 'consult' : 'vote';
}

async function migrateAll({ force = false } = {}) {
  const markerRef = db.doc(`system_jobs/${MIGRATION_ID}`);
  const marker = await markerRef.get();
  if (!force && marker.exists && marker.data()?.status === 'completed') {
    return { skipped: true, reason: 'already-completed', ...(marker.data()?.result || {}) };
  }

  await markerRef.set({ status: 'running', startedAt: FieldValue.serverTimestamp(), startedAtMs: Date.now() }, { merge: true });
  let cursor = null;
  let scanned = 0;
  let normalized = 0;
  let hiddenLegacy = 0;

  while (true) {
    let query = db.collection('feeds').orderBy('__name__').limit(300);
    if (cursor) query = query.startAfter(cursor);
    const snap = await query.get();
    if (snap.empty) break;
    const batch = db.batch();

    for (const docSnap of snap.docs) {
      scanned += 1;
      const post = docSnap.data() || {};
      const subtype = normalizeSubtype(post);
      if (!subtype) {
        const patch = {
          hidden: true,
          hideReason: post.hideReason || '지원 종료된 게임형 콘텐츠',
          legacyGameContent: true,
          migratedAt: FieldValue.serverTimestamp(),
        };
        batch.set(docSnap.ref, patch, { merge: true });
        hiddenLegacy += 1;
        continue;
      }

      const patch = {
        type: 'multi',
        cat: 'community',
        subtype,
        feedType: feedType(subtype),
        typeLabel: label(subtype),
        hidden: post.hidden === true,
        migratedAt: FieldValue.serverTimestamp(),
      };
      if (!post.reactions || typeof post.reactions !== 'object') patch.reactions = { total: 0, like: 0, funny: 0, fire: 0, skull: 0 };
      if (!Number.isFinite(Number(post.commentCount))) patch.commentCount = 0;
      if (!Number.isFinite(Number(post.viewCount))) patch.viewCount = 0;
      batch.set(docSnap.ref, patch, { merge: true });
      normalized += 1;
    }

    await batch.commit();
    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < 300) break;
  }

  const result = { scanned, normalized, hiddenLegacy };
  await markerRef.set({
    status: 'completed', result,
    completedAt: FieldValue.serverTimestamp(), completedAtMs: Date.now(),
  }, { merge: true });
  return { ok: true, ...result };
}

const migrateCommunityData = onCall({ region: REGION, timeoutSeconds: 540, memory: '512MiB' }, async request => {
  await assertAdmin(request.auth?.uid);
  return migrateAll({ force: request.data?.force === true });
});

const migrateCommunityDataOnce = onSchedule({
  region: REGION,
  schedule: 'every 1 hours',
  timeZone: 'Asia/Seoul',
  timeoutSeconds: 540,
  memory: '512MiB',
}, async () => migrateAll());

module.exports = { migrateCommunityData, migrateCommunityDataOnce };
