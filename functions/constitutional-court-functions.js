'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

function requireUid(request) {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  return uid;
}

function kstToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function reviewIdForPresident(presidentId) {
  return `impeachment_${String(presidentId || 'current').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function reviewRef(id) { return db.doc(`constitutional_reviews/${id}`); }

function judgeVotesFromPresident(president) {
  const impeachCount = Number(president.impeachCount || 0);
  const threshold = Math.max(1, Number(president.impeachThreshold || 5));
  const decreeDisapprove = Number(president.decreeDisapprove || 0);
  const decreeApprove = Number(president.decreeApprove || 0);
  const publicPressure = Math.min(4, Math.floor((impeachCount / threshold) * 4));
  const decreePressure = decreeDisapprove > decreeApprove ? 2 : decreeDisapprove > 0 ? 1 : 0;
  const votesForRemoval = Math.max(0, Math.min(9, 3 + publicPressure + decreePressure));
  return {
    votesForRemoval,
    votesForDismissal: 9 - votesForRemoval,
    result: votesForRemoval >= 6 ? 'accepted' : 'rejected',
  };
}

function publicReview(id, data) {
  return {
    id,
    status: data.status || 'pending',
    presidentId: data.presidentId || null,
    presidentName: data.presidentName || '대통령',
    partyId: data.partyId || null,
    partyName: data.partyName || null,
    charge: data.charge || '국회 탄핵소추안 심판',
    impeachCount: Number(data.impeachCount || 0),
    threshold: Number(data.threshold || 0),
    votesForRemoval: Number(data.votesForRemoval || 0),
    votesForDismissal: Number(data.votesForDismissal || 0),
    result: data.result || null,
    createdAtMs: Number(data.createdAtMs || 0),
    decidedAtMs: Number(data.decidedAtMs || 0),
  };
}

async function getCurrentPresident() {
  const snap = await db.doc('politics/currentPresident').get();
  return snap.exists ? (snap.data() || {}) : null;
}

async function ensureReviewFromPresident() {
  const president = await getCurrentPresident();
  if (!president || !president.candidateName) return null;
  const impeachCount = Number(president.impeachCount || 0);
  const threshold = Number(president.impeachThreshold || 5);
  const triggered = !!president.impeachTriggered || impeachCount >= threshold;
  if (!triggered) return null;

  const presidentId = president.weekKey || president.electionId || president.candidateUid || 'current';
  const id = reviewIdForPresident(presidentId);
  const ref = reviewRef(id);
  const snap = await ref.get();
  if (snap.exists) return { id, ...snap.data() };

  const votes = judgeVotesFromPresident(president);
  const review = {
    id,
    status: 'pending',
    presidentId,
    presidentName: president.candidateName || '대통령',
    partyId: president.partyId || null,
    partyName: president.partyName || null,
    charge: '국회 탄핵소추안 심판',
    impeachCount,
    threshold,
    votesForRemoval: votes.votesForRemoval,
    votesForDismissal: votes.votesForDismissal,
    result: votes.result,
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(review);
  return review;
}

const getConstitutionalCourtStatus = onCall({ region: REGION, timeoutSeconds: 20 }, async () => {
  const pending = await ensureReviewFromPresident();
  const query = await db.collection('constitutional_reviews').orderBy('createdAtMs', 'desc').limit(5).get();
  const reviews = query.docs.map(d => publicReview(d.id, d.data() || {}));
  return {
    ok: true,
    active: !!pending,
    current: pending ? publicReview(pending.id, pending) : null,
    reviews,
  };
});

const decideConstitutionalReview = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUid(request);
  const reviewId = String((request.data && request.data.reviewId) || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
  if (!reviewId) throw new HttpsError('invalid-argument', '심판 정보가 올바르지 않습니다.');

  const userSnap = await db.doc(`users/${uid}`).get();
  const user = userSnap.exists ? userSnap.data() || {} : {};
  if (!user.isAdmin) throw new HttpsError('permission-denied', '관리자만 결정할 수 있습니다.');

  const ref = reviewRef(reviewId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', '헌법재판소 심판을 찾을 수 없습니다.');
  const data = snap.data() || {};
  if (data.status === 'decided') return { ok: true, review: publicReview(reviewId, data) };

  const result = data.result || (Number(data.votesForRemoval || 0) >= 6 ? 'accepted' : 'rejected');
  await db.runTransaction(async tx => {
    tx.set(ref, {
      status: 'decided',
      result,
      decidedAt: FieldValue.serverTimestamp(),
      decidedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    const presidentRef = db.doc('politics/currentPresident');
    const presidentSnap = await tx.get(presidentRef);
    if (presidentSnap.exists && result === 'accepted') {
      tx.set(presidentRef, {
        status: 'removed',
        removedByCourt: true,
        removedAt: FieldValue.serverTimestamp(),
        earlyElectionRequired: true,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      tx.set(db.doc(`election_flags/early_${kstToday()}`), {
        type: 'early_election',
        reason: 'constitutional_court_impeachment_accepted',
        reviewId,
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    } else if (presidentSnap.exists) {
      tx.set(presidentRef, {
        impeachmentRejectedAt: FieldValue.serverTimestamp(),
        impeachTriggered: false,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });

  const after = await ref.get();
  return { ok: true, review: publicReview(reviewId, after.data() || {}) };
});

module.exports = { getConstitutionalCourtStatus, decideConstitutionalReview };
