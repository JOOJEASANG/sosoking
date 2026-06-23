'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const {
  cleanText,
  parseDateKey,
  isDateWithinDays,
  isValidMaterialId,
  clampLimit,
  normalizeVoteSide,
  normalizeCommentSide,
  nextVoteCounts,
} = require('./lib/material-policy');

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = 'asia-northeast3';
const DAILY_COUNT = 3;
const COMMENT_DAILY_LIMIT = 40;
const COMMENT_COOLDOWN_MS = 5000;

const TOPICS = Object.freeze([
  {
    category: '민원·신고',
    title: '번호판 가림 주차, 신고할 수 있을까?',
    summary: '번호판을 일부러 가리거나 알아보기 어렵게 만든 경우 신고 대상이 될 수 있습니다.',
    body: [
      '신고 가능 여부는 사진, 시간, 장소, 번호판 식별 가능성 같은 객관 자료가 중요합니다.',
      '핵심은 고의성, 단속 회피 목적, 주변 통행·안전에 미친 영향입니다.',
      '차량 전체, 번호판 상태, 주변 위치, 촬영 시각을 함께 남기는 방식이 안전합니다.',
    ],
    sourceGuide: ['자동차관리법 번호판', '안전신문고 불법주정차 신고', '지자체 주정차 단속 안내'],
    agreeTitle: '신고해야 한다',
    agreeText: '단속 회피나 책임 회피로 이어질 수 있어 공공질서 차원에서 엄격히 봐야 합니다.',
    disagreeTitle: '상황 확인이 먼저다',
    disagreeText: '눈·비·짐 적재 등 일시적 사정일 수 있으므로 고의성 판단은 조심해야 합니다.',
    questions: ['고의성을 어떻게 판단해야 할까?', '사진 한 장만으로 충분할까?', '신고 남용을 막으려면 어떤 기준이 필요할까?'],
    tags: ['번호판', '신고', '주차'],
  },
  {
    category: '생활분쟁',
    title: '이중주차 때문에 손해가 생기면 배상받을 수 있을까?',
    summary: '실제 손해, 과실, 연락 가능성, 관리규약 여부가 핵심 쟁점입니다.',
    body: [
      '이중주차 문제는 단순 불편과 손해배상 문제를 나눠서 봐야 합니다.',
      '차량 이동 불가로 경제적 손실이나 파손이 생겼다면 손해와 인과관계를 정리해야 합니다.',
      '관리사무소 안내, CCTV, 통화 기록, 문자, 사진은 분쟁 정리에 도움이 됩니다.',
    ],
    sourceGuide: ['공동주택 주차 관리규약', '손해배상 불법행위 요건', '주차장 분쟁 사례'],
    agreeTitle: '피해가 있으면 배상해야 한다',
    agreeText: '타인의 차량 이용을 막아 실제 손해가 발생했다면 책임을 검토해야 합니다.',
    disagreeTitle: '모든 불편이 배상은 아니다',
    disagreeText: '손해액과 과실이 명확하지 않으면 단순 불편만으로 배상을 인정하기 어렵습니다.',
    questions: ['불편과 손해의 기준은 어디까지일까?', '연락처를 남겼다면 책임이 줄어들까?', '아파트 규약이 얼마나 중요할까?'],
    tags: ['이중주차', '손해배상', '아파트'],
  },
  {
    category: '소송·법률',
    title: '전자소송 소취하 후 완료사건 처리는 왜 늦어질까?',
    summary: '소취하서 제출 뒤에도 송달, 동의 여부, 법원 내부 처리에 따라 완료 표시가 늦어질 수 있습니다.',
    body: [
      '전자소송에서 서류를 제출했다고 즉시 사건이 완료 표시로 바뀌는 것은 아닙니다.',
      '상대방 송달이나 동의가 필요한 단계인지에 따라 처리 시간이 달라집니다.',
      '사건 진행 화면의 송달 상태, 제출서류, 법원 안내 메시지를 함께 확인하는 것이 좋습니다.',
    ],
    sourceGuide: ['전자소송 소취하', '민사소송 소취하 동의', '나의 사건검색 종국 처리'],
    agreeTitle: '절차상 지연은 자연스럽다',
    agreeText: '소취하 효력 확인에는 송달과 내부 절차가 필요할 수 있습니다.',
    disagreeTitle: '진행상태 안내가 부족하다',
    disagreeText: '사용자 입장에서는 완료 여부가 불명확하므로 더 구체적인 상태 안내가 필요합니다.',
    questions: ['완료사건 표시는 언제 바뀌어야 적절할까?', '전자소송 화면 안내는 충분한가?', '당사자는 어디까지 확인해야 할까?'],
    tags: ['전자소송', '소취하', '법원'],
  },
  {
    category: '소비자',
    title: '중고거래 환불 거부, 어디까지 받아들여야 할까?',
    summary: '단순 변심인지 설명과 다른 하자인지에 따라 환불 가능성은 달라집니다.',
    body: [
      '중고거래는 개인 간 거래가 많아 환불 기준을 둘러싼 다툼이 자주 발생합니다.',
      '판매자가 하자를 숨겼거나 설명과 다른 물건을 보냈다면 단순 변심과 다르게 볼 수 있습니다.',
      '거래 전 대화, 상품 사진, 하자 고지 여부, 송장과 결제 기록을 보관하는 것이 중요합니다.',
    ],
    sourceGuide: ['전자상거래 소비자분쟁', '중고거래 사기 신고', '소비자분쟁해결기준'],
    agreeTitle: '하자가 있으면 환불해야 한다',
    agreeText: '설명과 다른 물건을 보냈다면 신뢰를 깨뜨린 것이므로 환불이나 보상이 필요합니다.',
    disagreeTitle: '단순 변심 환불은 어렵다',
    disagreeText: '개인 간 거래에서 구매자의 변심까지 모두 판매자가 부담하기는 어렵습니다.',
    questions: ['하자 고지는 어디까지 해야 할까?', '개인 간 거래에도 소비자 기준을 적용해야 할까?', '채팅 기록은 얼마나 중요할까?'],
    tags: ['중고거래', '환불', '소비자'],
  },
]);

function todayKst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function cleanList(value, maximum = 10, length = 100) {
  return Array.isArray(value)
    ? value.map(item => cleanText(item, length)).filter(Boolean).slice(0, maximum)
    : [];
}

function daySeed(date) {
  const milliseconds = Date.parse(`${date}T00:00:00+09:00`);
  return Number.isFinite(milliseconds) ? Math.floor(milliseconds / 86400000) : 0;
}

function topicFor(date, slot) {
  return TOPICS[(daySeed(date) + slot - 1) % TOPICS.length];
}

function materialId(date, slot) {
  return `${date.replace(/-/g, '')}_${String(slot).padStart(2, '0')}`;
}

function fallbackFromId(id) {
  const match = String(id || '').match(/^(\d{4})(\d{2})(\d{2})_(\d{2})$/);
  if (!match) return null;
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  const slot = Number(match[4]);
  if (!isDateWithinDays(date, todayKst(), 31) || slot < 1 || slot > DAILY_COUNT) return null;
  return topicPublic(id, topicFor(date, slot), date, slot);
}

function topicPublic(id, topic, date, slot) {
  return {
    id,
    title: topic.title,
    summary: topic.summary,
    body: topic.body,
    category: topic.category,
    tags: topic.tags,
    sourceType: 'fallback',
    sourceName: '소소킹 기본자료',
    sourceUrl: '',
    sourceGuide: topic.sourceGuide,
    agreeTitle: topic.agreeTitle,
    agreeText: topic.agreeText,
    disagreeTitle: topic.disagreeTitle,
    disagreeText: topic.disagreeText,
    questions: topic.questions,
    generatedDate: date,
    slot,
    agreeCount: 0,
    disagreeCount: 0,
    totalVotes: 0,
    commentCount: 0,
    viewCount: 0,
    status: 'published',
    createdAtMillis: 0,
  };
}

function fallbackMaterials(date = todayKst(), count = DAILY_COUNT) {
  return Array.from({ length: count }, (_, index) => {
    const slot = index + 1;
    return topicPublic(materialId(date, slot), topicFor(date, slot), date, slot);
  });
}

function toPublic(id, data = {}) {
  const agreeCount = Math.max(0, Number(data.agreeCount || 0));
  const disagreeCount = Math.max(0, Number(data.disagreeCount || 0));
  return {
    id,
    title: cleanText(data.title, 100),
    summary: cleanText(data.summary, 240),
    body: cleanList(data.body, 8, 700),
    category: cleanText(data.category || '생활논쟁', 40),
    tags: cleanList(data.tags, 8, 24),
    sourceType: cleanText(data.sourceType || 'auto', 30),
    sourceName: cleanText(data.sourceName, 80),
    sourceUrl: cleanText(data.sourceUrl, 500),
    sourceGuide: cleanList(data.sourceGuide, 8, 90),
    agreeTitle: cleanText(data.agreeTitle || '찬성', 60),
    agreeText: cleanText(data.agreeText, 300),
    disagreeTitle: cleanText(data.disagreeTitle || '반대', 60),
    disagreeText: cleanText(data.disagreeText, 300),
    questions: cleanList(data.questions, 5, 120),
    generatedDate: cleanText(data.generatedDate, 10),
    slot: Number(data.slot || 0),
    agreeCount,
    disagreeCount,
    totalVotes: agreeCount + disagreeCount,
    commentCount: Math.max(0, Number(data.commentCount || 0)),
    viewCount: Math.max(0, Number(data.viewCount || 0)),
    status: data.status === 'draft' ? 'draft' : data.status === 'hidden' ? 'hidden' : 'published',
    createdAtMillis: data.createdAt?.toMillis ? data.createdAt.toMillis() : Number(data.createdAtMillis || 0),
  };
}

function materialPayload(topic, date, slot) {
  const now = FieldValue.serverTimestamp();
  return {
    title: cleanText(topic.title, 100),
    summary: cleanText(topic.summary, 240),
    body: cleanList(topic.body, 8, 700),
    category: cleanText(topic.category || '생활논쟁', 40),
    tags: cleanList(topic.tags, 8, 24),
    sourceType: 'auto',
    sourceName: '소소킹 자동자료',
    sourceUrl: '',
    sourceGuide: cleanList(topic.sourceGuide, 8, 90),
    agreeTitle: cleanText(topic.agreeTitle, 60),
    agreeText: cleanText(topic.agreeText, 300),
    disagreeTitle: cleanText(topic.disagreeTitle, 60),
    disagreeText: cleanText(topic.disagreeText, 300),
    questions: cleanList(topic.questions, 5, 120),
    generatedDate: date,
    slot: Number(slot),
    status: 'published',
    aiGenerated: true,
    imported: false,
    agreeCount: 0,
    disagreeCount: 0,
    commentCount: 0,
    viewCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

async function requireAdmin(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자 전용 기능입니다.');
}

function validDateOrThrow(value, fallback = todayKst()) {
  try { return parseDateKey(value, fallback); }
  catch { throw new HttpsError('invalid-argument', '날짜 형식이 올바르지 않습니다.'); }
}

function validMaterialIdOrThrow(value) {
  const id = cleanText(value, 80);
  if (!isValidMaterialId(id)) throw new HttpsError('invalid-argument', '자료 ID가 올바르지 않습니다.');
  return id;
}

async function ensureDaily(date = todayKst(), options = {}) {
  const count = clampLimit(options.count, DAILY_COUNT, DAILY_COUNT);
  const ids = [];
  for (let slot = 1; slot <= count; slot += 1) {
    const id = materialId(date, slot);
    const ref = db.doc(`materials/${id}`);
    const snap = await ref.get();
    if (!snap.exists || options.force) {
      await ref.set(materialPayload(topicFor(date, slot), date, slot), { merge: false });
    }
    ids.push(id);
  }
  await db.doc(`daily_materials/${date}`).set({
    date,
    materialIds: ids,
    count: ids.length,
    done: true,
    generatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { date, materialIds: ids, skipped: false };
}

async function loadByIds(ids, date) {
  const materials = [];
  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index];
    if (!isValidMaterialId(id)) continue;
    const snap = await db.doc(`materials/${id}`).get().catch(() => null);
    if (snap?.exists && snap.data()?.status === 'published') {
      materials.push(toPublic(snap.id, snap.data()));
    } else {
      const fallback = fallbackFromId(id) || topicPublic(id, topicFor(date, index + 1), date, index + 1);
      materials.push(fallback);
    }
  }
  return materials;
}

async function getPublishedMaterial(id) {
  const ref = db.doc(`materials/${id}`);
  const snap = await ref.get().catch(() => null);
  if (!snap?.exists || snap.data()?.status !== 'published') return null;
  return { ref, snap, data: snap.data() || {} };
}

exports.generateDailyMaterials = onSchedule({
  schedule: '0 8 * * *',
  timeZone: 'Asia/Seoul',
  region: REGION,
  timeoutSeconds: 120,
  memory: '256MiB',
}, async () => {
  await ensureDaily(todayKst());
});

exports.triggerDailyMaterials = onCall({ region: REGION, timeoutSeconds: 120, memory: '256MiB' }, async request => {
  await requireAdmin(request);
  const date = validDateOrThrow(request.data?.date, todayKst());
  return { ok: true, ...(await ensureDaily(date, { force: !!request.data?.force, count: request.data?.count })) };
});

exports.getTodayMaterials = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const date = validDateOrThrow(request.data?.date, todayKst());
  if (!isDateWithinDays(date, todayKst(), 31)) {
    throw new HttpsError('invalid-argument', '조회 가능한 날짜 범위를 벗어났습니다.');
  }
  const dailySnap = await db.doc(`daily_materials/${date}`).get().catch(() => null);
  const ids = dailySnap?.exists && Array.isArray(dailySnap.data()?.materialIds)
    ? dailySnap.data().materialIds.filter(isValidMaterialId).slice(0, DAILY_COUNT)
    : fallbackMaterials(date).map(item => item.id);
  return { ok: true, date, materials: await loadByIds(ids, date) };
});

exports.getMaterials = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const limit = clampLimit(request.data?.limit, 30, 60);
  let materials = [];
  try {
    const snap = await db.collection('materials')
      .where('status', '==', 'published')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    materials = snap.docs.map(item => toPublic(item.id, item.data()));
  } catch (error) {
    console.warn('[getMaterials]', error.message);
  }
  if (!materials.length) materials = fallbackMaterials(todayKst(), Math.min(limit, DAILY_COUNT));
  return { ok: true, materials: materials.slice(0, limit) };
});

exports.getMaterial = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const id = validMaterialIdOrThrow(request.data?.materialId || request.data?.id);
  const published = await getPublishedMaterial(id);
  let material;
  let materialRef = null;
  if (published) {
    material = toPublic(published.snap.id, published.data);
    materialRef = published.ref;
  } else {
    material = fallbackFromId(id);
    if (!material) throw new HttpsError('not-found', '자료를 찾을 수 없습니다.');
  }

  if (materialRef) {
    await materialRef.update({
      viewCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }).catch(() => null);
  }

  let myVote = null;
  if (request.auth?.uid && materialRef) {
    const voteSnap = await materialRef.collection('votes').doc(request.auth.uid).get().catch(() => null);
    if (voteSnap?.exists) myVote = normalizeVoteSide(voteSnap.data()?.side);
  }
  return { ok: true, material, myVote };
});

exports.voteMaterial = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const id = validMaterialIdOrThrow(request.data?.materialId);
  const side = normalizeVoteSide(request.data?.side);
  if (!side) throw new HttpsError('invalid-argument', '찬성 또는 반대를 선택해주세요.');

  const materialRef = db.doc(`materials/${id}`);
  const voteRef = materialRef.collection('votes').doc(uid);
  await db.runTransaction(async transaction => {
    const [materialSnap, voteSnap] = await Promise.all([
      transaction.get(materialRef),
      transaction.get(voteRef),
    ]);
    if (!materialSnap.exists || materialSnap.data()?.status !== 'published') {
      throw new HttpsError('not-found', '투표할 자료를 찾을 수 없습니다.');
    }
    const before = voteSnap.exists ? normalizeVoteSide(voteSnap.data()?.side) : null;
    const counts = nextVoteCounts(materialSnap.data(), before, side);
    transaction.set(voteRef, {
      uid,
      materialId: id,
      side,
      createdAt: voteSnap.exists ? voteSnap.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.update(materialRef, {
      ...counts,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { ok: true, side };
});

exports.getMaterialComments = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const id = validMaterialIdOrThrow(request.data?.materialId);
  const limit = clampLimit(request.data?.limit, 40, 80);
  const published = await getPublishedMaterial(id);
  if (!published && !fallbackFromId(id)) throw new HttpsError('not-found', '자료를 찾을 수 없습니다.');

  const snap = await db.collection(`materials/${id}/comments`)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()
    .catch(() => null);
  const comments = snap
    ? snap.docs.map(item => {
      const data = item.data() || {};
      return {
        id: item.id,
        uid: cleanText(data.uid, 128),
        nickname: cleanText(data.nickname || '익명', 30),
        text: cleanText(data.text, 700),
        side: normalizeCommentSide(data.side),
        createdAtMillis: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0,
        status: data.status || 'visible',
      };
    }).filter(item => item.status === 'visible')
    : [];
  return { ok: true, comments };
});

exports.addMaterialComment = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const id = validMaterialIdOrThrow(request.data?.materialId);
  const text = cleanText(request.data?.text, 700);
  const side = normalizeCommentSide(request.data?.side);
  if (text.length < 2) throw new HttpsError('invalid-argument', '댓글을 2자 이상 입력해주세요.');

  const userSnap = await db.doc(`users/${uid}`).get().catch(() => null);
  const userData = userSnap?.exists ? userSnap.data() || {} : {};
  const nickname = cleanText(userData.nickname || userData.displayName || '익명', 30);
  const materialRef = db.doc(`materials/${id}`);
  const commentRef = materialRef.collection('comments').doc();
  const limitRef = db.doc(`rate_limits/material-comment-${uid}`);
  const nowMs = Date.now();
  const day = todayKst();

  await db.runTransaction(async transaction => {
    const [materialSnap, limitSnap] = await Promise.all([
      transaction.get(materialRef),
      transaction.get(limitRef),
    ]);
    if (!materialSnap.exists || materialSnap.data()?.status !== 'published') {
      throw new HttpsError('not-found', '댓글을 작성할 자료를 찾을 수 없습니다.');
    }
    const limitData = limitSnap.exists ? limitSnap.data() || {} : {};
    const lastAtMs = Number(limitData.lastAtMs || 0);
    const count = limitData.day === day ? Number(limitData.count || 0) : 0;
    if (nowMs - lastAtMs < COMMENT_COOLDOWN_MS) {
      throw new HttpsError('resource-exhausted', '댓글은 잠시 후 다시 작성해주세요.');
    }
    if (count >= COMMENT_DAILY_LIMIT) {
      throw new HttpsError('resource-exhausted', '오늘 작성할 수 있는 댓글 수를 초과했습니다.');
    }

    transaction.set(commentRef, {
      uid,
      materialId: id,
      nickname,
      text,
      side,
      status: 'visible',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(materialRef, {
      commentCount: Math.max(0, Number(materialSnap.data()?.commentCount || 0)) + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(limitRef, {
      uid,
      type: 'material-comment',
      day,
      count: count + 1,
      lastAtMs: nowMs,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(nowMs + 3 * 86400000),
    }, { merge: true });
  });
  return { ok: true, id: commentRef.id };
});

exports.getDebateSummary = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const limit = clampLimit(request.data?.limit, 10, 30);
  let materials = [];
  try {
    const snap = await db.collection('materials')
      .where('status', '==', 'published')
      .orderBy('commentCount', 'desc')
      .limit(limit)
      .get();
    materials = snap.docs.map(item => toPublic(item.id, item.data()));
  } catch (error) {
    console.warn('[getDebateSummary]', error.message);
  }
  if (!materials.length) materials = fallbackMaterials(todayKst(), Math.min(limit, DAILY_COUNT));
  return { ok: true, materials: materials.slice(0, limit) };
});

exports.adminCreateMaterial = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  await requireAdmin(request);
  const title = cleanText(request.data?.title, 100);
  const summary = cleanText(request.data?.summary, 240);
  if (title.length < 2 || summary.length < 5) {
    throw new HttpsError('invalid-argument', '제목과 요약을 입력해주세요.');
  }
  const ref = db.collection('materials').doc();
  await ref.set({
    title,
    summary,
    body: cleanList(request.data?.body, 10, 700),
    category: cleanText(request.data?.category || '생활논쟁', 40),
    tags: cleanList(request.data?.tags, 8, 24),
    sourceType: 'imported',
    sourceName: cleanText(request.data?.sourceName || '직접 입력 자료', 80),
    sourceUrl: cleanText(request.data?.sourceUrl, 500),
    sourceGuide: cleanList(request.data?.sourceGuide, 8, 90),
    agreeTitle: cleanText(request.data?.agreeTitle || '찬성', 60),
    agreeText: cleanText(request.data?.agreeText, 300),
    disagreeTitle: cleanText(request.data?.disagreeTitle || '반대', 60),
    disagreeText: cleanText(request.data?.disagreeText, 300),
    questions: cleanList(request.data?.questions, 5, 120),
    status: request.data?.status === 'draft' ? 'draft' : 'published',
    aiGenerated: false,
    imported: true,
    agreeCount: 0,
    disagreeCount: 0,
    commentCount: 0,
    viewCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: false });
  return { ok: true, id: ref.id };
});
