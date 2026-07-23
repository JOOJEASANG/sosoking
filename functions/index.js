'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

if (!getApps().length) initializeApp();
const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';

function getAiKey() {
  try {
    const value = String(geminiKey.value() || '').trim();
    return value || null;
  } catch {
    return null;
  }
}

async function isAiFeatureEnabled(feature) {
  try {
    const snap = await db.doc('config/ai').get();
    if (!snap.exists) return true;
    const data = snap.data() || {};
    if (data.enabled === false) return false;
    return data.features?.[feature] !== false;
  } catch {
    return true;
  }
}

async function logAiUsage() {
  const today = new Date().toISOString().slice(0, 10);
  await db.doc('config/ai').set({
    usage: { [today]: { requests: FieldValue.increment(1) } },
  }, { merge: true });
}

function parseAiJson(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(raw); } catch {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function modelFor(apiKey) {
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
}

// 새 게시물 AI 모더레이션
exports.onFeedPostCreate = onDocumentCreated({
  document: 'feeds/{postId}',
  region: REGION,
  secrets: [geminiKey],
  timeoutSeconds: 60,
}, async event => {
  const snap = event.data;
  if (!snap || !(await isAiFeatureEnabled('moderation'))) return;

  const post = snap.data() || {};
  const apiKey = getAiKey();
  if (!apiKey) return;

  const text = [post.title, post.body, post.desc, post.subtitle]
    .filter(Boolean)
    .join('\n')
    .slice(0, 1000);
  if (!text.trim()) return;

  try {
    const prompt = `소소킹 커뮤니티 게시물을 검토하세요.

게시물 유형: ${post.typeLabel || post.subtype || post.feedType || '일반'}
게시물 내용:
${text}

허용:
- 판결, 상담, 토론, 드립 등 일상 커뮤니티 표현
- 가벼운 인터넷 슬랭과 과장된 유머

차단:
- 특정인 신상 공개, 협박, 성희롱, 혐오
- 상업 광고와 반복 스팸
- 명백한 불법 콘텐츠

JSON만 출력하세요.
{"safe":true,"reason":null,"tags":["자동태그"],"summary":"20자 이내 요약"}`;
    const result = await modelFor(apiKey).generateContent(prompt);
    const analysis = parseAiJson(result.response.text());
    if (!analysis) return;

    const updates = {
      aiModerated: true,
      aiTags: Array.isArray(analysis.tags) ? analysis.tags.slice(0, 5).map(String) : [],
      aiSummary: String(analysis.summary || '').slice(0, 80),
    };

    if (analysis.safe === false) {
      updates.hidden = true;
      updates.hideReason = `AI 자동 검토: ${String(analysis.reason || '정책 위반 의심').slice(0, 200)}`;
      await db.collection('reports').add({
        postId: snap.id,
        postTitle: String(post.title || '').slice(0, 100),
        authorId: post.authorId || '',
        reason: String(analysis.reason || 'AI 자동 감지').slice(0, 500),
        reportedBy: 'AI',
        resolved: false,
        aiGenerated: true,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await snap.ref.update(updates);
    await logAiUsage();
  } catch (error) {
    console.error('[onFeedPostCreate] AI moderation failed', error);
  }
});

// 새 신고 AI 1차 검토
exports.onReportCreate = onDocumentCreated({
  document: 'reports/{reportId}',
  region: REGION,
  secrets: [geminiKey],
  timeoutSeconds: 60,
}, async event => {
  const snap = event.data;
  if (!snap || !(await isAiFeatureEnabled('autoReport'))) return;

  const report = snap.data() || {};
  if (report.aiGenerated === true) return;
  const apiKey = getAiKey();
  if (!apiKey || !report.postId) return;

  try {
    const postSnap = await db.doc(`feeds/${report.postId}`).get();
    if (!postSnap.exists) return;
    const post = postSnap.data() || {};
    const text = [post.title, post.body, post.desc].filter(Boolean).join('\n').slice(0, 800);
    const prompt = `소소킹 신고 게시물을 1차 검토하세요.

신고 사유: ${String(report.reason || '').slice(0, 300)}
게시물:
${text}

판단값:
- clear_violation: 명백한 신상 공개, 협박, 성희롱, 혐오, 광고, 불법 콘텐츠
- review_needed: 운영자 판단 필요
- no_action: 정상적인 일상 의견이나 유머

JSON만 출력하세요.
{"action":"no_action","reason":"한 문장 근거"}`;
    const result = await modelFor(apiKey).generateContent(prompt);
    const analysis = parseAiJson(result.response.text());
    if (!analysis) return;

    const action = ['clear_violation', 'review_needed', 'no_action'].includes(analysis.action)
      ? analysis.action
      : 'review_needed';
    const update = {
      aiReviewed: true,
      aiAction: action,
      aiReason: String(analysis.reason || '').slice(0, 300),
    };

    if (action === 'clear_violation') {
      await postSnap.ref.update({
        hidden: true,
        hideReason: `AI 신고 처리: ${String(analysis.reason || '').slice(0, 200)}`,
      });
      update.resolved = true;
      update.aiResolved = true;
    }

    await snap.ref.update(update);
    await logAiUsage();
  } catch (error) {
    console.error('[onReportCreate] AI review failed', error);
  }
});

// 기존 토너먼트 게시물 결과 호환
exports.recordTournamentResult = onCall({ region: REGION }, async request => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인 필요');

  const { postId, winnerIdx } = request.data || {};
  if (!postId || !Number.isInteger(winnerIdx)) {
    throw new HttpsError('invalid-argument', '잘못된 데이터');
  }

  const postRef = db.doc(`feeds/${postId}`);
  const snap = await postRef.get();
  if (!snap.exists) throw new HttpsError('not-found', '게시물 없음');

  const tournament = snap.data()?.modules?.tournament;
  if (!tournament?.enabled || !Array.isArray(tournament.items) || winnerIdx < 0 || winnerIdx >= tournament.items.length) {
    throw new HttpsError('invalid-argument', '유효하지 않은 항목');
  }

  await postRef.update({
    [`modules.tournament.wins.${winnerIdx}`]: FieldValue.increment(1),
    'modules.tournament.plays': FieldValue.increment(1),
  });

  return { ok: true };
});
