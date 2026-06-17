'use strict';

// 소소한 논쟁커뮤니티: 자료 자동생성, 자료 목록/상세, 찬반투표, 댓글
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = 'asia-northeast3';
const DAILY_COUNT = 3;

const TOPICS = Object.freeze([
  {
    category: '민원·신고', title: '번호판 가림 주차, 신고할 수 있을까?',
    summary: '번호판을 일부러 가리거나 알아보기 어렵게 만든 경우 신고 대상이 될 수 있습니다.',
    body: ['신고 가능 여부는 사진, 시간, 장소, 번호판 식별 가능성 같은 객관 자료가 중요합니다.', '핵심은 고의성, 단속 회피 목적, 주변 통행·안전에 미친 영향입니다.', '차량 전체, 번호판 상태, 주변 위치, 촬영 시각을 함께 남기는 방식이 안전합니다.'],
    sourceGuide: ['자동차관리법 번호판', '안전신문고 불법주정차 신고', '지자체 주정차 단속 안내'],
    agreeTitle: '강하게 신고해야 한다', agreeText: '단속 회피나 책임 회피로 이어질 수 있어 공공질서 차원에서 엄격히 봐야 합니다.',
    disagreeTitle: '상황 확인이 먼저다', disagreeText: '눈·비·짐 적재 등 일시적 사정일 수 있으므로 고의성 판단은 조심해야 합니다.',
    questions: ['고의성을 어떻게 판단해야 할까?', '사진 한 장만으로 충분할까?', '신고 남용을 막으려면 어떤 기준이 필요할까?'],
    tags: ['번호판', '신고', '주차', '생활분쟁'],
  },
  {
    category: '생활분쟁', title: '이중주차 때문에 손해가 생기면 배상받을 수 있을까?',
    summary: '실제 손해, 과실, 연락 가능성, 관리규약 여부가 핵심 쟁점입니다.',
    body: ['이중주차 문제는 단순 불편과 손해배상 문제를 나눠서 봐야 합니다.', '차량 이동 불가로 경제적 손실이나 파손이 생겼다면 손해와 인과관계를 정리해야 합니다.', '관리사무소 안내, CCTV, 통화 기록, 문자, 사진은 분쟁 정리에 도움이 됩니다.'],
    sourceGuide: ['공동주택 주차 관리규약', '손해배상 불법행위 요건', '주차장 분쟁 사례'],
    agreeTitle: '피해가 있으면 배상해야 한다', agreeText: '타인의 차량 이용을 막아 실제 손해가 발생했다면 책임을 검토해야 합니다.',
    disagreeTitle: '모든 불편이 배상은 아니다', disagreeText: '손해액과 과실이 명확하지 않으면 단순 불편만으로 배상을 인정하기 어렵습니다.',
    questions: ['불편과 손해의 기준은 어디까지일까?', '연락처를 남겼다면 책임이 줄어들까?', '아파트 규약이 얼마나 중요할까?'],
    tags: ['이중주차', '손해배상', '아파트', '생활분쟁'],
  },
  {
    category: '소송·법률', title: '전자소송 소취하 후 완료사건 처리는 왜 늦어질까?',
    summary: '소취하서 제출 뒤에도 송달, 동의 여부, 법원 내부 처리에 따라 완료 표시가 늦어질 수 있습니다.',
    body: ['전자소송에서 서류를 제출했다고 즉시 사건이 완료 표시로 바뀌는 것은 아닙니다.', '상대방 송달이나 동의가 필요한 단계인지에 따라 처리 시간이 달라집니다.', '사건 진행 화면의 송달 상태, 제출서류, 법원 안내 메시지를 함께 확인하는 것이 좋습니다.'],
    sourceGuide: ['전자소송 소취하', '민사소송 소취하 동의', '나의 사건검색 종국 처리'],
    agreeTitle: '절차상 지연은 자연스럽다', agreeText: '소취하 효력 확인에는 송달과 내부 절차가 필요할 수 있습니다.',
    disagreeTitle: '진행상태 안내가 부족하다', disagreeText: '사용자 입장에서는 완료 여부가 불명확하므로 더 구체적인 상태 안내가 필요합니다.',
    questions: ['완료사건 표시는 언제 바뀌어야 적절할까?', '전자소송 화면 안내는 충분한가?', '당사자는 어디까지 확인해야 할까?'],
    tags: ['전자소송', '소취하', '민사소송', '법원'],
  },
  {
    category: '소비자', title: '중고거래 환불 거부, 어디까지 받아들여야 할까?',
    summary: '단순 변심인지 설명과 다른 하자인지에 따라 환불 가능성은 달라집니다.',
    body: ['중고거래는 개인 간 거래가 많아 환불 기준을 둘러싼 다툼이 자주 발생합니다.', '판매자가 하자를 숨겼거나 설명과 다른 물건을 보냈다면 단순 변심과 다르게 볼 수 있습니다.', '거래 전 대화, 상품 사진, 하자 고지 여부, 송장과 결제 기록을 보관하는 것이 중요합니다.'],
    sourceGuide: ['전자상거래 소비자분쟁', '중고거래 사기 신고', '소비자분쟁해결기준'],
    agreeTitle: '하자가 있으면 환불해야 한다', agreeText: '설명과 다른 물건을 보냈다면 신뢰를 깨뜨린 것이므로 환불이나 보상이 필요합니다.',
    disagreeTitle: '단순 변심 환불은 어렵다', disagreeText: '개인 간 거래에서 구매자의 변심까지 모두 판매자가 부담하기는 어렵습니다.',
    questions: ['하자 고지는 어디까지 해야 할까?', '개인 간 거래에도 소비자 기준을 적용해야 할까?', '채팅 기록은 얼마나 중요할까?'],
    tags: ['중고거래', '환불', '소비자', '분쟁'],
  },
]);

function todayKst() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function clean(v, max = 500) { return String(v || '').replace(/[<>]/g, '').trim().slice(0, max); }
function cleanList(v, max = 10, len = 100) { return Array.isArray(v) ? v.map(x => clean(x, len)).filter(Boolean).slice(0, max) : []; }
function daySeed(date) { const ms = Date.parse(`${date}T00:00:00+09:00`); return Number.isFinite(ms) ? Math.floor(ms / 86400000) : 0; }
function topicFor(date, slot) { return TOPICS[(daySeed(date) + slot - 1) % TOPICS.length]; }
function matId(date, slot) { return `${date.replace(/-/g, '')}_${String(slot).padStart(2, '0')}`; }

function toPublic(id, d = {}) {
  const agreeCount = Number(d.agreeCount || 0);
  const disagreeCount = Number(d.disagreeCount || 0);
  return {
    id, title: d.title || '', summary: d.summary || '', body: Array.isArray(d.body) ? d.body : [],
    category: d.category || '생활논쟁', tags: Array.isArray(d.tags) ? d.tags : [],
    sourceType: d.sourceType || 'auto', sourceName: d.sourceName || '', sourceUrl: d.sourceUrl || '', sourceGuide: Array.isArray(d.sourceGuide) ? d.sourceGuide : [],
    agreeTitle: d.agreeTitle || '찬성', agreeText: d.agreeText || '', disagreeTitle: d.disagreeTitle || '반대', disagreeText: d.disagreeText || '', questions: Array.isArray(d.questions) ? d.questions : [],
    generatedDate: d.generatedDate || '', slot: Number(d.slot || 0), agreeCount, disagreeCount, totalVotes: agreeCount + disagreeCount,
    commentCount: Number(d.commentCount || 0), viewCount: Number(d.viewCount || 0), status: d.status || 'published',
    createdAtMillis: d.createdAt?.toMillis ? d.createdAt.toMillis() : Number(d.createdAtMillis || 0),
  };
}

function payload(topic, date, slot) {
  const now = FieldValue.serverTimestamp();
  return {
    title: clean(topic.title, 100), summary: clean(topic.summary, 240), body: cleanList(topic.body, 8, 700), category: clean(topic.category || '생활논쟁', 40), tags: cleanList(topic.tags, 8, 24),
    sourceType: 'auto', sourceName: '소소킹 자동자료', sourceUrl: '', sourceGuide: cleanList(topic.sourceGuide, 8, 90),
    agreeTitle: clean(topic.agreeTitle, 60), agreeText: clean(topic.agreeText, 300), disagreeTitle: clean(topic.disagreeTitle, 60), disagreeText: clean(topic.disagreeText, 300), questions: cleanList(topic.questions, 5, 120),
    generatedDate: date, slot: Number(slot), status: 'published', aiGenerated: true, imported: false,
    agreeCount: 0, disagreeCount: 0, commentCount: 0, viewCount: 0, createdAt: now, updatedAt: now,
  };
}

async function requireAdmin(req) {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자 전용 기능입니다.');
}

async function ensureDaily(date = todayKst(), options = {}) {
  const count = Math.max(1, Math.min(DAILY_COUNT, Number(options.count || DAILY_COUNT)));
  const dailyRef = db.doc(`daily_materials/${date}`);
  const dailySnap = await dailyRef.get();
  const existingIds = Array.isArray(dailySnap.data()?.materialIds) ? dailySnap.data().materialIds : [];
  if (dailySnap.exists && dailySnap.data()?.done && existingIds.length >= count && !options.force) return { date, materialIds: existingIds.slice(0, count), skipped: true };
  const ids = [];
  for (let slot = 1; slot <= count; slot += 1) {
    const id = matId(date, slot);
    const ref = db.doc(`materials/${id}`);
    const snap = await ref.get();
    if (!snap.exists || options.force) await ref.set(payload(topicFor(date, slot), date, slot), { merge: false });
    ids.push(id);
  }
  await dailyRef.set({ date, materialIds: ids, count: ids.length, done: true, generatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await db.doc('material_sequence/meta').set({ lastGeneratedDate: date, dailyCount: count, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { date, materialIds: ids, skipped: false };
}

async function loadByIds(ids) {
  const out = [];
  for (const id of ids) {
    const snap = await db.doc(`materials/${id}`).get();
    if (snap.exists && snap.data()?.status !== 'hidden') out.push(toPublic(snap.id, snap.data()));
  }
  return out;
}

exports.generateDailyMaterials = onSchedule({ schedule: '0 8 * * *', timeZone: 'Asia/Seoul', region: REGION, timeoutSeconds: 120, memory: '256MiB' }, async () => { await ensureDaily(todayKst()); });

exports.triggerDailyMaterials = onCall({ region: REGION, timeoutSeconds: 120, memory: '256MiB' }, async req => {
  await requireAdmin(req);
  const date = clean(req.data?.date || todayKst(), 20) || todayKst();
  return { ok: true, ...(await ensureDaily(date, { force: !!req.data?.force, count: req.data?.count || DAILY_COUNT })) };
});

exports.getTodayMaterials = onCall({ region: REGION, timeoutSeconds: 30 }, async req => {
  const date = clean(req.data?.date || todayKst(), 20) || todayKst();
  const daily = await ensureDaily(date);
  return { ok: true, date, materials: await loadByIds(daily.materialIds) };
});

exports.getMaterials = onCall({ region: REGION, timeoutSeconds: 30 }, async req => {
  const limit = Math.max(1, Math.min(60, Number(req.data?.limit || 30)));
  const category = clean(req.data?.category || '', 40);
  let q = db.collection('materials').where('status', '==', 'published');
  if (category) q = q.where('category', '==', category);
  const snap = await q.orderBy('createdAt', 'desc').limit(limit).get();
  return { ok: true, materials: snap.docs.map(doc => toPublic(doc.id, doc.data())) };
});

exports.getMaterial = onCall({ region: REGION, timeoutSeconds: 30 }, async req => {
  const id = clean(req.data?.materialId || req.data?.id || '', 80);
  if (!id) throw new HttpsError('invalid-argument', '자료 ID가 필요합니다.');
  const ref = db.doc(`materials/${id}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.status === 'hidden') throw new HttpsError('not-found', '자료를 찾을 수 없습니다.');
  await ref.set({ viewCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
  let myVote = null;
  if (req.auth?.uid) {
    const voteSnap = await ref.collection('votes').doc(req.auth.uid).get().catch(() => null);
    if (voteSnap?.exists) myVote = voteSnap.data()?.side || null;
  }
  return { ok: true, material: toPublic(snap.id, snap.data()), myVote };
});

exports.voteMaterial = onCall({ region: REGION, timeoutSeconds: 30 }, async req => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const materialId = clean(req.data?.materialId || '', 80);
  const side = clean(req.data?.side || '', 20);
  if (!materialId) throw new HttpsError('invalid-argument', '자료 ID가 필요합니다.');
  if (!['agree', 'disagree'].includes(side)) throw new HttpsError('invalid-argument', '찬성 또는 반대를 선택해주세요.');
  const materialRef = db.doc(`materials/${materialId}`);
  const voteRef = materialRef.collection('votes').doc(uid);
  let result = null;
  await db.runTransaction(async tx => {
    const materialSnap = await tx.get(materialRef);
    const voteSnap = await tx.get(voteRef);
    if (!materialSnap.exists || materialSnap.data()?.status === 'hidden') throw new HttpsError('not-found', '자료를 찾을 수 없습니다.');
    const before = voteSnap.exists ? voteSnap.data()?.side : null;
    if (before === side) { result = { changed: false, side }; return; }
    const update = { updatedAt: FieldValue.serverTimestamp() };
    if (before === 'agree') update.agreeCount = FieldValue.increment(-1);
    if (before === 'disagree') update.disagreeCount = FieldValue.increment(-1);
    if (side === 'agree') update.agreeCount = FieldValue.increment(1);
    if (side === 'disagree') update.disagreeCount = FieldValue.increment(1);
    tx.set(voteRef, { uid, materialId, side, updatedAt: FieldValue.serverTimestamp(), createdAt: voteSnap.exists ? voteSnap.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp() }, { merge: true });
    tx.set(materialRef, update, { merge: true });
    result = { changed: true, side, previousSide: before || null };
  });
  return { ok: true, ...(result || { changed: false, side }) };
});

exports.getMaterialComments = onCall({ region: REGION, timeoutSeconds: 30 }, async req => {
  const materialId = clean(req.data?.materialId || '', 80);
  const limit = Math.max(1, Math.min(80, Number(req.data?.limit || 40)));
  if (!materialId) throw new HttpsError('invalid-argument', '자료 ID가 필요합니다.');
  const snap = await db.collection(`materials/${materialId}/comments`).orderBy('createdAt', 'desc').limit(limit).get();
  const comments = snap.docs.map(doc => {
    const d = doc.data() || {};
    return { id: doc.id, uid: d.uid || '', nickname: d.nickname || '익명', text: d.text || '', side: d.side || 'neutral', createdAtMillis: d.createdAt?.toMillis ? d.createdAt.toMillis() : Number(d.createdAtMillis || 0) };
  });
  return { ok: true, comments };
});

exports.addMaterialComment = onCall({ region: REGION, timeoutSeconds: 30 }, async req => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const materialId = clean(req.data?.materialId || '', 80);
  const text = clean(req.data?.text || '', 700);
  const sideRaw = clean(req.data?.side || 'neutral', 20);
  const side = ['agree', 'disagree', 'neutral'].includes(sideRaw) ? sideRaw : 'neutral';
  if (!materialId) throw new HttpsError('invalid-argument', '자료 ID가 필요합니다.');
  if (text.length < 2) throw new HttpsError('invalid-argument', '댓글을 2자 이상 입력해주세요.');
  const materialRef = db.doc(`materials/${materialId}`);
  const materialSnap = await materialRef.get();
  if (!materialSnap.exists || materialSnap.data()?.status === 'hidden') throw new HttpsError('not-found', '자료를 찾을 수 없습니다.');
  const userSnap = await db.doc(`users/${uid}`).get().catch(() => null);
  const user = userSnap?.exists ? userSnap.data() || {} : {};
  const ref = await materialRef.collection('comments').add({ uid, materialId, nickname: clean(user.nickname || user.displayName || '익명', 30), text, side, status: 'visible', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  await materialRef.set({ commentCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, id: ref.id };
});

exports.getDebateSummary = onCall({ region: REGION, timeoutSeconds: 30 }, async req => {
  const limit = Math.max(1, Math.min(30, Number(req.data?.limit || 10)));
  let snap;
  try { snap = await db.collection('materials').where('status', '==', 'published').orderBy('commentCount', 'desc').orderBy('createdAt', 'desc').limit(limit).get(); }
  catch { snap = await db.collection('materials').where('status', '==', 'published').orderBy('createdAt', 'desc').limit(limit).get(); }
  return { ok: true, materials: snap.docs.map(doc => toPublic(doc.id, doc.data())) };
});

exports.adminCreateMaterial = onCall({ region: REGION, timeoutSeconds: 30 }, async req => {
  await requireAdmin(req);
  const title = clean(req.data?.title, 100);
  const summary = clean(req.data?.summary, 240);
  if (title.length < 2 || summary.length < 5) throw new HttpsError('invalid-argument', '제목과 요약을 입력해주세요.');
  const ref = db.collection('materials').doc();
  await ref.set({
    title, summary, body: cleanList(req.data?.body, 10, 700), category: clean(req.data?.category || '생활논쟁', 40), tags: cleanList(req.data?.tags, 8, 24),
    sourceType: 'imported', sourceName: clean(req.data?.sourceName || '직접 입력 자료', 80), sourceUrl: clean(req.data?.sourceUrl || '', 500), sourceGuide: cleanList(req.data?.sourceGuide, 8, 90),
    agreeTitle: clean(req.data?.agreeTitle || '찬성', 60), agreeText: clean(req.data?.agreeText || '', 300), disagreeTitle: clean(req.data?.disagreeTitle || '반대', 60), disagreeText: clean(req.data?.disagreeText || '', 300), questions: cleanList(req.data?.questions, 5, 120),
    status: clean(req.data?.status || 'published', 20) === 'draft' ? 'draft' : 'published', aiGenerated: false, imported: true, agreeCount: 0, disagreeCount: 0, commentCount: 0, viewCount: 0, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  }, { merge: false });
  return { ok: true, id: ref.id };
});
