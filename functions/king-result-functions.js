'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();

const db = getFirestore();
const REGION = 'asia-northeast3';
const ALLOWED_MODES = new Set(['judge', 'create', 'consult']);
const ALLOWED_SUBMODES = new Set(['', 'translate', 'name']);
const MAX_HISTORY_ITEMS = 50;
const MAX_DAILY_SAVES = 100;

function requireUser(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요해요.');
  return uid;
}

function cleanText(value, maxLength) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, maxLength);
}

function normalizeCards(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).map(item => ({
    name: cleanText(item?.name, 100),
    text: cleanText(item?.text, 1800),
  })).filter(item => item.name && item.text);
}

function normalizeCharacterIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => cleanText(item, 40)).filter(Boolean))].slice(0, 3);
}

function seoulDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

async function enforceSaveLimit(uid) {
  const ref = db.doc(`rate_limits/king-result-${uid}-${seoulDateKey()}`);
  await db.runTransaction(async transaction => {
    const snap = await transaction.get(ref);
    const count = Number(snap.data()?.count || 0);
    if (count >= MAX_DAILY_SAVES) {
      throw new HttpsError('resource-exhausted', '오늘 저장할 수 있는 AI 결과 수를 초과했어요.');
    }
    transaction.set(ref, {
      uid,
      type: 'king-result-save',
      count: count + 1,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    }, { merge: true });
  });
}

async function trimHistory(uid) {
  const snap = await db.collection(`users/${uid}/ai_results`)
    .orderBy('createdAt', 'desc')
    .limit(MAX_HISTORY_ITEMS + 10)
    .get();
  if (snap.size <= MAX_HISTORY_ITEMS) return;
  const batch = db.batch();
  snap.docs.slice(MAX_HISTORY_ITEMS).forEach(docSnap => batch.delete(docSnap.ref));
  await batch.commit();
}

const saveKingPlaygroundResult = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUser(request);
  const mode = cleanText(request.data?.mode, 20);
  const submode = cleanText(request.data?.submode, 20);
  const title = cleanText(request.data?.title, 120);
  const input = cleanText(request.data?.input, 1600);
  const cards = normalizeCards(request.data?.cards);
  const characterIds = normalizeCharacterIds(request.data?.characterIds);

  if (!ALLOWED_MODES.has(mode)) throw new HttpsError('invalid-argument', '저장할 결과 종류가 올바르지 않아요.');
  if (!ALLOWED_SUBMODES.has(submode)) throw new HttpsError('invalid-argument', '저장할 세부 종류가 올바르지 않아요.');
  if (!title || !input || !cards.length) throw new HttpsError('invalid-argument', '저장할 결과가 비어 있어요.');

  await enforceSaveLimit(uid);

  const resultRef = db.collection(`users/${uid}/ai_results`).doc();
  await resultRef.set({
    ownerId: uid,
    mode,
    submode,
    title,
    input,
    cards,
    characterIds,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await trimHistory(uid);

  return { ok: true, resultId: resultRef.id };
});

const getKingPlaygroundHistory = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUser(request);
  const requestedLimit = Number(request.data?.limit || 12);
  const limit = Math.max(1, Math.min(30, Number.isFinite(requestedLimit) ? requestedLimit : 12));
  const snap = await db.collection(`users/${uid}/ai_results`)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  const results = snap.docs.map(docSnap => {
    const data = docSnap.data() || {};
    return {
      id: docSnap.id,
      mode: cleanText(data.mode, 20),
      submode: cleanText(data.submode, 20),
      title: cleanText(data.title, 120),
      input: cleanText(data.input, 1600),
      cards: normalizeCards(data.cards),
      characterIds: normalizeCharacterIds(data.characterIds),
      createdAt: data.createdAt?.toMillis?.() || 0,
    };
  });

  return { ok: true, results };
});

const deleteKingPlaygroundResult = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUser(request);
  const resultId = cleanText(request.data?.resultId, 120);
  if (!resultId || !/^[A-Za-z0-9_-]+$/.test(resultId)) {
    throw new HttpsError('invalid-argument', '삭제할 결과 정보가 올바르지 않아요.');
  }
  await db.doc(`users/${uid}/ai_results/${resultId}`).delete();
  return { ok: true };
});

module.exports = {
  saveKingPlaygroundResult,
  getKingPlaygroundHistory,
  deleteKingPlaygroundResult,
};
