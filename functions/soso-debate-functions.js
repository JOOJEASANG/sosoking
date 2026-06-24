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
const { AI_RUNTIME_SECRETS, callAI, callAndParse } = require('./ai-runtime-provider');

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = 'asia-northeast3';
const COMMENT_DAILY_LIMIT = 40;
const COMMENT_COOLDOWN_MS = 5000;

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

function validDebateIdOrThrow(value) {
  const id = cleanText(value, 80);
  if (!isValidMaterialId(id)) throw new HttpsError('invalid-argument', '토론 ID가 올바르지 않습니다.');
  return id;
}

function dailyDebateId(date) {
  return `debate_${date.replace(/-/g, '')}`;
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
    const snap = await db.collection('debates')
      .where('status', '==', 'published')
      .orderBy('createdAt', 'desc')
      .limit(40)
      .get();
    return snap.docs.map(document => cleanText(document.data()?.title, 100)).filter(Boolean);
  } catch (error) {
    console.warn('[debates recent titles]', error.message);
    return [];
  }
}

function toPublic(id, data = {}) {
  const agreeCount = Math.max(0, Number(data.agreeCount || 0));
  const disagreeCount = Math.max(0, Number(data.disagreeCount || 0));
  return {
    id,
    title: cleanText(data.title, 100),
    summary: cleanText(data.summary, 260),
    context: cleanList(data.context, 6, 700),
    category: cleanText(data.category || '생활토론', 40),
    tags: cleanList(data.tags, 8, 24),
    agreeTitle: cleanText(data.agreeTitle || '찬성', 60),
    agreeText: cleanText(data.agreeText, 400),
    disagreeTitle: cleanText(data.disagreeTitle || '반대', 60),
    disagreeText: cleanText(data.disagreeText, 400),
    questions: cleanList(data.questions, 5, 140),
    sourceType: cleanText(data.sourceType || 'manual', 30),
    sourceName: cleanText(data.sourceName || '소소킹', 80),
    generatedDate: cleanText(data.generatedDate, 10),
    status: data.status === 'draft' ? 'draft' : data.status === 'hidden' ? 'hidden' : 'published',
    aiGenerated: data.aiGenerated === true,
    imported: data.imported === true,
    agreeCount,
    disagreeCount,
    totalVotes: agreeCount + disagreeCount,
    commentCount: Math.max(0, Number(data.commentCount || 0)),
    viewCount: Math.max(0, Number(data.viewCount || 0)),
    createdAtMillis: data.createdAt?.toMillis ? data.createdAt.toMillis() : Number(data.createdAtMillis || 0),
  };
}

function debateSystem(recent) {
  const recentText = recent.length ? recent.map((title, index) => `${index + 1}. ${title}`).join('\n') : '없음';
  return `당신은 소소킹의 생활 토론 기획자다.
매일 누구나 가볍게 참여할 수 있지만 의견이 자연스럽게 갈리는 토론 주제 1건을 만든다.

원칙:
- 친구·연애·가족·직장·학교·모임·소비·주거·디지털생활·생활매너 중 하나를 선택한다.
- 사실 확인이 필요한 뉴스나 특정 실존 인물 사건을 소재로 삼지 않는다.
- 찬성과 반대 어느 한쪽을 정답처럼 몰아가지 않는다.
- 혐오, 차별, 폭력 조장, 정치 선동, 성적·선정적 주제를 제외한다.
- 최근 주제와 겹치거나 표현만 바꾼 주제를 만들지 않는다.
- 상황은 구체적이어야 하고 두 입장 모두 충분히 이해 가능해야 한다.

최근 토론 제목:
${recentText}

반드시 아래 JSON 형식만 출력한다.
{
  "title":"찬반이 분명히 갈리는 질문형 제목",
  "summary":"상황을 2문장 이내로 설명",
  "context":["상황 설명 1","고려할 점 2","갈등 지점 3"],
  "category":"카테고리",
  "tags":["태그1","태그2","태그3"],
  "agreeTitle":"찬성 입장 이름",
  "agreeText":"찬성 논거",
  "disagreeTitle":"반대 입장 이름",
  "disagreeText":"반대 논거",
  "questions":["추가 토론 질문1","질문2","질문3"]
}`;
}

function debateReviewSystem() {
  return `당신은 공개 전 생활 토론을 검수하는 편집 책임자다.
특정 실존 인물·기업·현재 뉴스 사건·정치 선동·혐오·차별·폭력 조장·성적 또는 선정적 내용·개인정보·광고를 제거한다.
찬성과 반대가 모두 합리적으로 설명되는지, 한쪽을 정답처럼 몰아가지 않는지 확인한다.
안전하게 고칠 수 있으면 수정한 전체 토론을 반환하고 approved를 true로 한다. 안전하게 고칠 수 없으면 approved를 false로 한다.
반드시 JSON만 출력한다.
{"approved":true,"reason":"검수 요약","debate":{"title":"","summary":"","context":[],"category":"","tags":[],"agreeTitle":"","agreeText":"","disagreeTitle":"","disagreeText":"","questions":[]}}`;
}

function normalizeGenerated(parsed, date) {
  const title = cleanText(parsed?.title, 100);
  const summary = cleanText(parsed?.summary, 260);
  const context = cleanList(parsed?.context, 6, 700);
  const agreeTitle = cleanText(parsed?.agreeTitle, 60);
  const agreeText = cleanText(parsed?.agreeText, 400);
  const disagreeTitle = cleanText(parsed?.disagreeTitle, 60);
  const disagreeText = cleanText(parsed?.disagreeText, 400);
  if (title.length < 5 || summary.length < 10 || context.length < 2 || agreeTitle.length < 2 || disagreeTitle.length < 2 || agreeText.length < 10 || disagreeText.length < 10) {
    throw new Error('AI 토론 내용이 충분하지 않습니다.');
  }
  return {
    title,
    summary,
    context,
    category: cleanText(parsed?.category || '생활토론', 40),
    tags: cleanList(parsed?.tags, 8, 24),
    agreeTitle,
    agreeText,
    disagreeTitle,
    disagreeText,
    questions: cleanList(parsed?.questions, 5, 140),
    sourceType: 'ai',
    sourceName: '소소킹 AI 토론',
    generatedDate: date,
    status: 'published',
    aiGenerated: true,
    imported: false,
    agreeCount: 0,
    disagreeCount: 0,
    totalVotes: 0,
    commentCount: 0,
    viewCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function reviewGeneratedDebate(debate, date) {
  const reviewInput = {
    title: debate.title,
    summary: debate.summary,
    context: debate.context,
    category: debate.category,
    tags: debate.tags,
    agreeTitle: debate.agreeTitle,
    agreeText: debate.agreeText,
    disagreeTitle: debate.disagreeTitle,
    disagreeText: debate.disagreeText,
    questions: debate.questions,
  };
  const { parsed } = await callAndParse(
    maxTokens => callAI(
      debateReviewSystem(),
      `검수할 생활 토론:\n${JSON.stringify(reviewInput)}`,
      maxTokens,
      0.1,
      true,
    ),
    1900,
  );
  if (parsed?.approved !== true || !parsed?.debate) throw new Error('AI 토론 자동 검수를 통과하지 못했습니다.');
  return {
    ...normalizeGenerated(parsed.debate, date),
    reviewStatus: 'auto-approved',
    reviewReason: cleanText(parsed.reason, 300),
    reviewedAt: FieldValue.serverTimestamp(),
  };
}

async function recordGeneration(date, status, detail = {}) {
  await db.doc(`generation_runs/debate_${date}`).set({
    type: 'debate',
    date,
    status,
    ...detail,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true }).catch(error => console.warn('[debate generation record]', error.message));
}

async function generateDebate(date, options = {}) {
  const id = dailyDebateId(date);
  const ref = db.doc(`debates/${id}`);
  const existing = await ref.get();
  if (existing.exists && !options.force) return { id, date, skipped: true, reason: 'already-exists' };

  await recordGeneration(date, 'running', { requestedBy: cleanText(options.requestedBy || 'scheduler', 128) });
  try {
    const titles = await recentTitles();
    const { parsed } = await callAndParse(
      maxTokens => callAI(
        debateSystem(titles),
        `${date}에 게시할 새로운 생활 토론 주제 1건을 작성하라.`,
        maxTokens,
        0.9,
        true,
      ),
      1900,
    );
    const generated = normalizeGenerated(parsed, date);
    const reviewed = await reviewGeneratedDebate(generated, date);
    await ref.set(reviewed, { merge: false });
    await recordGeneration(date, 'success', { contentId: id, reviewStatus: 'auto-approved' });
    return { id, date, skipped: false };
  } catch (error) {
    await recordGeneration(date, 'failed', { error: cleanText(error?.message || 'unknown', 500) });
    throw error;
  }
}

async function getPublishedDebate(id) {
  const ref = db.doc(`debates/${id}`);
  const snap = await ref.get().catch(() => null);
  if (!snap?.exists || snap.data()?.status !== 'published') return null;
  return { ref, snap, data: snap.data() || {} };
}

async function registerUniqueView(ref, uid) {
  if (!uid) return false;
  const date = todayKst();
  const eventRef = ref.collection('view_events').doc(`${uid}_${date}`);
  return db.runTransaction(async transaction => {
    const eventSnap = await transaction.get(eventRef);
    if (eventSnap.exists) return false;
    transaction.set(eventRef, {
      uid,
      date,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.update(ref, {
      viewCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  }).catch(error => {
    console.warn('[debate view]', error.message);
    return false;
  });
}

exports.generateDailyDebate = onSchedule({
  schedule: '0 8 * * *',
  timeZone: 'Asia/Seoul',
  region: REGION,
  timeoutSeconds: 240,
  memory: '512MiB',
  secrets: AI_RUNTIME_SECRETS,
}, async () => {
  await generateDebate(todayKst(), { requestedBy: 'scheduler' });
});

exports.triggerDailyDebate = onCall({
  region: REGION,
  timeoutSeconds: 240,
  memory: '512MiB',
  secrets: AI_RUNTIME_SECRETS,
}, async request => {
  const uid = await requireAdmin(request);
  const date = validDateOrThrow(request.data?.date, todayKst());
  return { ok: true, ...(await generateDebate(date, { force: request.data?.force === true, requestedBy: uid })) };
});

exports.getTodayDebate = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const date = validDateOrThrow(request.data?.date, todayKst());
  if (!isDateWithinDays(date, todayKst(), 31)) throw new HttpsError('invalid-argument', '조회 가능한 날짜 범위를 벗어났습니다.');
  const id = dailyDebateId(date);
  const snap = await db.doc(`debates/${id}`).get().catch(() => null);
  const debate = snap?.exists && snap.data()?.status === 'published' ? toPublic(id, snap.data()) : null;
  return { ok: true, date, debate, debates: debate ? [debate] : [] };
});

exports.getDebates = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const limit = clampLimit(request.data?.limit, 30, 60);
  const order = cleanText(request.data?.order || 'latest', 20);
  const field = order === 'comments' ? 'commentCount' : order === 'votes' ? 'totalVotes' : 'createdAt';
  let snap = null;
  try {
    if (field === 'totalVotes') {
      const latest = await db.collection('debates').where('status', '==', 'published').orderBy('createdAt', 'desc').limit(Math.min(60, limit * 2)).get();
      const debates = latest.docs.map(item => toPublic(item.id, item.data())).sort((a, b) => b.totalVotes - a.totalVotes).slice(0, limit);
      return { ok: true, debates };
    }
    snap = await db.collection('debates')
      .where('status', '==', 'published')
      .orderBy(field, 'desc')
      .limit(limit)
      .get();
  } catch (error) {
    console.warn('[getDebates]', error.message);
  }
  return { ok: true, debates: snap ? snap.docs.map(item => toPublic(item.id, item.data())) : [] };
});

exports.getDebateSummary = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const limit = clampLimit(request.data?.limit, 10, 30);
  let snap = null;
  try {
    snap = await db.collection('debates')
      .where('status', '==', 'published')
      .orderBy('commentCount', 'desc')
      .limit(limit)
      .get();
  } catch (error) {
    console.warn('[getDebateSummary]', error.message);
  }
  const debates = snap ? snap.docs.map(item => toPublic(item.id, item.data())) : [];
  return { ok: true, debates, materials: debates };
});

exports.getDebate = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const id = validDebateIdOrThrow(request.data?.debateId || request.data?.id);
  const published = await getPublishedDebate(id);
  if (!published) throw new HttpsError('not-found', '토론을 찾을 수 없습니다.');
  const counted = await registerUniqueView(published.ref, request.auth?.uid);
  let myVote = null;
  if (request.auth?.uid) {
    const voteSnap = await published.ref.collection('votes').doc(request.auth.uid).get().catch(() => null);
    if (voteSnap?.exists) myVote = normalizeVoteSide(voteSnap.data()?.side);
  }
  const data = counted
    ? { ...published.data, viewCount: Number(published.data.viewCount || 0) + 1 }
    : published.data;
  return { ok: true, debate: toPublic(id, data), myVote };
});

exports.voteDebate = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const id = validDebateIdOrThrow(request.data?.debateId);
  const side = normalizeVoteSide(request.data?.side);
  if (!side) throw new HttpsError('invalid-argument', '찬성 또는 반대를 선택해주세요.');

  const debateRef = db.doc(`debates/${id}`);
  const voteRef = debateRef.collection('votes').doc(uid);
  await db.runTransaction(async transaction => {
    const [debateSnap, voteSnap] = await Promise.all([transaction.get(debateRef), transaction.get(voteRef)]);
    if (!debateSnap.exists || debateSnap.data()?.status !== 'published') throw new HttpsError('not-found', '투표할 토론을 찾을 수 없습니다.');
    const before = voteSnap.exists ? normalizeVoteSide(voteSnap.data()?.side) : null;
    const counts = nextVoteCounts(debateSnap.data(), before, side);
    transaction.set(voteRef, {
      uid,
      debateId: id,
      side,
      createdAt: voteSnap.exists ? voteSnap.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.update(debateRef, {
      ...counts,
      totalVotes: counts.agreeCount + counts.disagreeCount,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { ok: true, side };
});

exports.getDebateComments = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const id = validDebateIdOrThrow(request.data?.debateId);
  const limit = clampLimit(request.data?.limit, 40, 80);
  if (!(await getPublishedDebate(id))) throw new HttpsError('not-found', '토론을 찾을 수 없습니다.');
  const snap = await db.collection(`debates/${id}/comments`).orderBy('createdAt', 'desc').limit(limit).get().catch(() => null);
  const comments = snap ? snap.docs.map(item => {
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
  }).filter(item => item.status === 'visible') : [];
  return { ok: true, comments };
});

exports.addDebateComment = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const id = validDebateIdOrThrow(request.data?.debateId);
  const text = cleanText(request.data?.text, 700);
  const side = normalizeCommentSide(request.data?.side);
  if (text.length < 2) throw new HttpsError('invalid-argument', '댓글을 2자 이상 입력해주세요.');

  const userSnap = await db.doc(`users/${uid}`).get().catch(() => null);
  const userData = userSnap?.exists ? userSnap.data() || {} : {};
  const nickname = cleanText(userData.nickname || userData.displayName || '익명', 30);
  const debateRef = db.doc(`debates/${id}`);
  const commentRef = debateRef.collection('comments').doc();
  const limitRef = db.doc(`rate_limits/debate-comment-${uid}`);
  const nowMs = Date.now();
  const day = todayKst();

  await db.runTransaction(async transaction => {
    const [debateSnap, limitSnap] = await Promise.all([transaction.get(debateRef), transaction.get(limitRef)]);
    if (!debateSnap.exists || debateSnap.data()?.status !== 'published') throw new HttpsError('not-found', '댓글을 작성할 토론을 찾을 수 없습니다.');
    const limitData = limitSnap.exists ? limitSnap.data() || {} : {};
    const lastAtMs = Number(limitData.lastAtMs || 0);
    const count = limitData.day === day ? Number(limitData.count || 0) : 0;
    if (nowMs - lastAtMs < COMMENT_COOLDOWN_MS) throw new HttpsError('resource-exhausted', '댓글은 잠시 후 다시 작성해주세요.');
    if (count >= COMMENT_DAILY_LIMIT) throw new HttpsError('resource-exhausted', '오늘 작성할 수 있는 댓글 수를 초과했습니다.');

    transaction.set(commentRef, {
      uid,
      debateId: id,
      nickname,
      text,
      side,
      status: 'visible',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(debateRef, {
      commentCount: Math.max(0, Number(debateSnap.data()?.commentCount || 0)) + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(limitRef, {
      uid,
      type: 'debate-comment',
      day,
      count: count + 1,
      lastAtMs: nowMs,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(nowMs + 3 * 86400000),
    }, { merge: true });
  });
  return { ok: true, id: commentRef.id };
});

exports.adminCreateDebate = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const uid = await requireAdmin(request);
  const title = cleanText(request.data?.title, 100);
  const summary = cleanText(request.data?.summary, 260);
  const context = cleanList(request.data?.context, 8, 700);
  const agreeTitle = cleanText(request.data?.agreeTitle, 60);
  const agreeText = cleanText(request.data?.agreeText, 400);
  const disagreeTitle = cleanText(request.data?.disagreeTitle, 60);
  const disagreeText = cleanText(request.data?.disagreeText, 400);
  if (title.length < 2 || summary.length < 5 || context.length < 1 || agreeTitle.length < 2 || disagreeTitle.length < 2) {
    throw new HttpsError('invalid-argument', '제목, 상황, 찬성·반대 입장을 입력해주세요.');
  }
  const ref = db.collection('debates').doc();
  await ref.set({
    title,
    summary,
    context,
    category: cleanText(request.data?.category || '생활토론', 40),
    tags: cleanList(request.data?.tags, 8, 24),
    agreeTitle,
    agreeText,
    disagreeTitle,
    disagreeText,
    questions: cleanList(request.data?.questions, 5, 140),
    sourceType: 'manual',
    sourceName: '관리자 직접 등록',
    generatedDate: '',
    status: request.data?.status === 'draft' ? 'draft' : 'published',
    aiGenerated: false,
    imported: true,
    reviewStatus: 'manual',
    agreeCount: 0,
    disagreeCount: 0,
    totalVotes: 0,
    commentCount: 0,
    viewCount: 0,
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: false });
  return { ok: true, id: ref.id };
});

module.exports._test = { dailyDebateId, normalizeGenerated, toPublic };
