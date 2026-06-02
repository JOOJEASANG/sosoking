'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();

function kstDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function normalizeFeature(value) {
  const v = String(value || '').trim();
  return ['judge', 'translate', 'match', 'naming'].includes(v) ? v : 'ai';
}

exports.playAiLadderBonus = onCall({ region: 'asia-northeast3' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const date = kstDate();
  const feature = normalizeFeature(request.data?.feature);
  const lane = String(request.data?.lane || 'A').replace(/[^A-D]/g, '') || 'A';
  const playRef = db.doc(`ai_ladder_bonus/${uid}_${date}`);
  const userRef = db.doc(`users/${uid}`);

  let result;
  await db.runTransaction(async tx => {
    const playSnap = await tx.get(playRef);
    if (playSnap.exists) {
      throw new HttpsError('failed-precondition', '오늘 사다리게임은 이미 사용했습니다.');
    }

    const seed = `${uid}_${date}_${feature}_${lane}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    const winningLane = ['A', 'B', 'C', 'D'][hash % 4];

    result = {
      success: true,
      prize: 'extra_use',
      quantity: 1,
      lane,
      winningLane,
      feature,
      date,
    };

    tx.set(playRef, {
      uid,
      date,
      feature,
      lane,
      winningLane,
      prize: 'extra_use',
      quantity: 1,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(userRef, {
      extraAiUses: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  return result;
});
