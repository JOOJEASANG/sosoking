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
} = require('./lib/material-policy');
const { AI_RUNTIME_SECRETS, callAI, callAndParse } = require('./ai-runtime-provider');

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = 'asia-northeast3';

function todayKst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function cleanList(value, maximum = 10, length = 200) {
  return Array.isArray(value)
    ? value.map(item => cleanText(item, length)).filter(Boolean).slice(0, maximum)
    : [];
}

function validDateOrThrow(value, fallback = todayKst()) {
  try {
    return parseDateKey(value, fallback);
  } catch {
    throw new HttpsError('invalid-argument', '날짜 형식이 올바르지 않습니다.');
  }
}

function validMaterialIdOrThrow(value) {
  const id = cleanText(value, 80);
  if (!isValidMaterialId(id)) throw new HttpsError('invalid-argument', '자료 ID가 올바르지 않습니다.');
  return id;
}

function dailyMaterialId(date) {
  return `material_${date.replace(/-/g, '')}`;
}

async function requireAdmin(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자 전용 기능입니다.');
  return uid;
}

async function recentTitles() {
  try {
    const snap = await db.collection('materials')
      .where('status', '==', 'published')
      .orderBy('createdAt', 'desc')
      .limit(30)
      .get();
    return snap.docs.map(doc => cleanText(doc.data()?.title, 100)).filter(Boolean);
  } catch (error) {
    console.warn('[materials recent titles]', error.message);
    return [];
  }
}

function toPublic(id, data = {}) {
  return {
    id,
    title: cleanText(data.title, 100),
    summary: cleanText(data.summary, 260),
    body: cleanList(data.body, 8, 800),
    category: cleanText(data.category || '생활정보', 40),
    tags: cleanList(data.tags, 8, 24),
    sourceType: cleanText(data.sourceType || 'manual', 30),
    sourceName: cleanText(data.sourceName || '소소킹', 80),
    sourceUrl: cleanText(data.sourceUrl, 500),
    sourceGuide: cleanList(data.sourceGuide, 8, 100),
    disclaimer: cleanText(data.disclaimer || '일반적인 생활정보이며 개별 상황에 대한 전문적인 판단을 대신하지 않습니다.', 300),
    generatedDate: cleanText(data.generatedDate, 10),
    status: data.status === 'draft' ? 'draft' : data.status === 'hidden' ? 'hidden' : 'published',
    aiGenerated: data.aiGenerated === true,
    imported: data.imported === true,
    viewCount: Math.max(0, Number(data.viewCount || 0)),
    createdAtMillis: data.createdAt?.toMillis ? data.createdAt.toMillis() : Number(data.createdAtMillis || 0),
  };
}

function materialSystem(recent) {
  const recentText = recent.length ? recent.map((title, index) => `${index + 1}. ${title}`).join('\n') : '없음';
  return `당신은 한국 생활정보 서비스 소소킹의 자료 편집자다.
매일 읽기 쉬운 생활정보 자료 1건을 만든다.

원칙:
- 독자가 실제 생활에서 바로 활용할 수 있는 주제를 고른다.
- 민원·소비자·계약·직장·학교·주거·디지털생활·인간관계 중 하나를 선택한다.
- 확정적인 법률·의료·세무 자문처럼 쓰지 않는다.
- 존재 여부를 확인할 수 없는 법 조항, 판례번호, 통계, 기관 연락처를 만들지 않는다.
- 최신 정보 확인이 필요한 부분은 '관계 기관의 최신 안내를 확인하세요'라고 표현한다.
- 최근 주제와 겹치거나 제목만 바꾼 내용은 만들지 않는다.
- 광고, 정치 선동, 혐오, 선정적 표현을 제외한다.

최근 자료 제목:
${recentText}

반드시 아래 JSON 형식만 출력한다.
{
  "title":"구체적이고 이해하기 쉬운 제목",
  "summary":"2문장 이내 요약",
  "body":["핵심 설명 1","핵심 설명 2","실행 방법 3","주의점 4"],
  "category":"카테고리",
  "tags":["태그1","태그2","태그3"],
  "sourceGuide":["확인할 기관 또는 검색어1","검색어2","검색어3"],
  "disclaimer":"정보 이용 시 주의 문구"
}`;
}

function normalizeGenerated(parsed, date) {
  const title = cleanText(parsed?.title, 100);
  const summary = cleanText(parsed?.summary, 260);
  const body = cleanList(parsed?.body, 8, 800);
  if (title.length < 5 || summary.length < 10 || body.length < 3) {
    throw new Error('AI 자료 내용이 충분하지 않습니다.');
  }
  return {
    title,
    summary,
    body,
    category: cleanText(parsed?.category || '생활정보', 40),
    tags: cleanList(parsed?.tags, 8, 24),
    sourceType: 'ai',
    sourceName: '소소킹 AI 생활자료',
    sourceUrl: '',
    sourceGuide: cleanList(parsed?.sourceGuide, 8, 100),
    disclaimer: cleanText(parsed?.disclaimer || '일반적인 생활정보이며 개별 상황에 대한 전문적인 판단을 대신하지 않습니다.', 300),
    generatedDate: date,
    status: 'published',
    aiGenerated: true,
    imported: false,
    viewCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function recordGeneration(type, date, status, detail = {}) {
  await db.doc(`generation_runs/${type}_${date}`).set({
    type,
    date,
    status,
    ...detail,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true }).catch(error => console.warn('[generation record]', error.message));
}

async function generateMaterial(date, options = {}) {
  const id = dailyMaterialId(date);
  const ref = db.doc(`materials/${id}`);
  const existing = await ref.get();
  if (existing.exists && !options.force) {
    return { id, date, skipped: true, reason: 'already-exists' };
  }

  await recordGeneration('material', date, 'running', { requestedBy: cleanText(options.requestedBy || 'scheduler', 128) });
  try {
    const titles = await recentTitles();
    const { parsed } = await callAndParse(
      maxTokens => callAI(
        materialSystem(titles),
        `${date}에 게시할 새로운 생활정보 자료 1건을 작성하라.`,
        maxTokens,
        0.75,
        true,
      ),
      1800,
    );
    await ref.set(normalizeGenerated(parsed, date), { merge: false });
    await recordGeneration('material', date, 'success', { contentId: id });
    return { id, date, skipped: false };
  } catch (error) {
    await recordGeneration('material', date, 'failed', { error: cleanText(error?.message || 'unknown', 500) });
    throw error;
  }
}

exports.generateDailyMaterial = onSchedule({
  schedule: '30 7 * * *',
  timeZone: 'Asia/Seoul',
  region: REGION,
  timeoutSeconds: 120,
  memory: '512MiB',
  secrets: AI_RUNTIME_SECRETS,
}, async () => {
  await generateMaterial(todayKst(), { requestedBy: 'scheduler' });
});

exports.triggerDailyMaterial = onCall({
  region: REGION,
  timeoutSeconds: 120,
  memory: '512MiB',
  secrets: AI_RUNTIME_SECRETS,
}, async request => {
  const uid = await requireAdmin(request);
  const date = validDateOrThrow(request.data?.date, todayKst());
  return { ok: true, ...(await generateMaterial(date, { force: request.data?.force === true, requestedBy: uid })) };
});

exports.getTodayMaterials = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const date = validDateOrThrow(request.data?.date, todayKst());
  if (!isDateWithinDays(date, todayKst(), 31)) throw new HttpsError('invalid-argument', '조회 가능한 날짜 범위를 벗어났습니다.');
  const id = dailyMaterialId(date);
  const snap = await db.doc(`materials/${id}`).get().catch(() => null);
  const materials = snap?.exists && snap.data()?.status === 'published' ? [toPublic(id, snap.data())] : [];
  return { ok: true, date, materials };
});

exports.getMaterials = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const limit = clampLimit(request.data?.limit, 30, 60);
  const snap = await db.collection('materials')
    .where('status', '==', 'published')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()
    .catch(error => {
      console.warn('[getMaterials]', error.message);
      return null;
    });
  return { ok: true, materials: snap ? snap.docs.map(item => toPublic(item.id, item.data())) : [] };
});

exports.getMaterial = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const id = validMaterialIdOrThrow(request.data?.materialId || request.data?.id);
  const ref = db.doc(`materials/${id}`);
  const snap = await ref.get().catch(() => null);
  if (!snap?.exists || snap.data()?.status !== 'published') throw new HttpsError('not-found', '자료를 찾을 수 없습니다.');
  await ref.update({ viewCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }).catch(() => null);
  return { ok: true, material: toPublic(id, snap.data()) };
});

exports.adminCreateMaterial = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const uid = await requireAdmin(request);
  const title = cleanText(request.data?.title, 100);
  const summary = cleanText(request.data?.summary, 260);
  const body = cleanList(request.data?.body, 10, 800);
  if (title.length < 2 || summary.length < 5 || body.length < 1) {
    throw new HttpsError('invalid-argument', '제목, 요약, 핵심 내용을 입력해주세요.');
  }
  const ref = db.collection('materials').doc();
  await ref.set({
    title,
    summary,
    body,
    category: cleanText(request.data?.category || '생활정보', 40),
    tags: cleanList(request.data?.tags, 8, 24),
    sourceType: 'manual',
    sourceName: cleanText(request.data?.sourceName || '관리자 직접 등록', 80),
    sourceUrl: cleanText(request.data?.sourceUrl, 500),
    sourceGuide: cleanList(request.data?.sourceGuide, 8, 100),
    disclaimer: cleanText(request.data?.disclaimer || '일반적인 생활정보이며 개별 상황에 대한 전문적인 판단을 대신하지 않습니다.', 300),
    generatedDate: '',
    status: request.data?.status === 'draft' ? 'draft' : 'published',
    aiGenerated: false,
    imported: true,
    viewCount: 0,
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: false });
  return { ok: true, id: ref.id };
});

module.exports._test = { dailyMaterialId, normalizeGenerated, toPublic };
