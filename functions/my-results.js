'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';
const PAGE_SIZE = 12;

const COUNSELOR_NAMES = {
  gold: '황금 곰돌이 선생', profiler: '프로파일러 탐정', latte: '라떼 부장님',
  salon: '미용실 원장님', taxi: '택시 기사님', hani: '하니 언니', guru: '무당 guru',
  bungeo: '붕어빵 할머니',
};

exports.getMyResults = onCall({ region: REGION, memory: '256MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const uid = request.auth.uid;
  const type = request.data?.type;
  const startAfterId = request.data?.startAfterId || null;

  if (type !== 'advice' && type !== 'translation') {
    throw new HttpsError('invalid-argument', '잘못된 타입입니다.');
  }

  const authorsCol = type === 'advice' ? 'advice_result_authors' : 'translation_result_authors';
  const resultsCol = type === 'advice' ? 'advice_results' : 'translation_results';

  let q = db.collection(authorsCol)
    .where('uid', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(PAGE_SIZE);

  if (startAfterId) {
    const pivot = await db.doc(`${authorsCol}/${startAfterId}`).get();
    if (pivot.exists) q = q.startAfter(pivot);
  }

  const authorSnap = await q.get();
  if (authorSnap.empty) return { results: [], hasMore: false, lastId: null };

  const resultIds = authorSnap.docs.map(d => d.data().resultId).filter(Boolean);
  const resultRefs = resultIds.map(id => db.doc(`${resultsCol}/${id}`));
  const resultSnaps = await db.getAll(...resultRefs);

  const results = resultSnaps
    .filter(s => s.exists)
    .map(s => {
      const d = s.data();
      return {
        id: s.id,
        createdAt: d.createdAt?.toMillis?.() || null,
        likeCount: d.likeCount || 0,
        commentCount: d.commentCount || 0,
        // advice fields
        counselorId: d.counselorId || null,
        counselorName: d.counselorName || COUNSELOR_NAMES[d.counselorId] || '상담사',
        worry: d.worry || null,
        prescription: d.prescription || d.diagnosis || null,
        // translation fields
        modeLabel: d.modeLabel || null,
        modeEmoji: d.modeEmoji || null,
        originalText: d.originalText || null,
        translated: d.translated || null,
      };
    });

  const lastDoc = authorSnap.docs[authorSnap.docs.length - 1];
  return { results, hasMore: authorSnap.docs.length === PAGE_SIZE, lastId: lastDoc?.id || null };
});
