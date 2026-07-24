'use strict';

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
    if (!snap.exists) return false;
    const data = snap.data() || {};
    if (data.enabled !== true) return false;
    return data.features?.[feature] === true;
  } catch {
    return false;
  }
}

function todayKST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

async function logAiUsage(feature) {
  const today = todayKST();
  await db.doc(`ai_usage/${today}`).set({
    day: today,
    requests: FieldValue.increment(1),
    [`features.${feature}`]: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
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

exports.onFeedPostCreate = onDocumentCreated({
  document: 'feeds/{postId}',
  region: REGION,
  secrets: [geminiKey],
  timeoutSeconds: 60,
}, async event => {
  const snap = event.data;
  if (!snap || !(await isAiFeatureEnabled('moderation'))) return;

  const post = snap.data() || {};
  if (post.hidden === true) return;
  const apiKey = getAiKey();
  if (!apiKey) return;
  const text = [post.title, post.desc].filter(Boolean).join('\n').slice(0, 1200);
  if (!text.trim()) return;

  try {
    const prompt = `소소킹 커뮤니티 게시물을 검토하세요.

게시물 유형: ${post.typeLabel || post.subtype || '일반'}
게시물 내용:
${text}

허용:
- 판결, 상담, 토론, 드립 등 일상 커뮤니티 표현
- 가벼운 인터넷 슬랭과 과장된 유머

검토 필요:
- 특정인 신상 공개, 협박, 성희롱, 혐오
- 상업 광고와 반복 스팸
- 명백한 불법 콘텐츠

자동으로 게시글을 숨기지 않습니다. 운영자 검토용 JSON만 출력하세요.
{"safe":true,"reason":null,"tags":["자동태그"],"summary":"20자 이내 요약","severity":"none"}`;
    const result = await modelFor(apiKey).generateContent(prompt);
    const analysis = parseAiJson(result.response.text());
    if (!analysis) return;

    const safe = analysis.safe !== false;
    await snap.ref.update({
      aiModerated: true,
      aiSafe: safe,
      aiSeverity: ['none', 'low', 'medium', 'high'].includes(analysis.severity) ? analysis.severity : (safe ? 'none' : 'medium'),
      aiTags: Array.isArray(analysis.tags) ? analysis.tags.slice(0, 5).map(String) : [],
      aiSummary: String(analysis.summary || '').slice(0, 80),
      aiModerationReason: String(analysis.reason || '').slice(0, 300),
      aiModeratedAt: FieldValue.serverTimestamp(),
    });

    if (!safe) {
      await db.collection('reports').add({
        postId: snap.id,
        postTitle: String(post.title || '').slice(0, 100),
        authorId: post.authorId || '',
        reason: String(analysis.reason || 'AI 자동 검토 필요').slice(0, 500),
        reportedBy: 'AI',
        resolved: false,
        aiGenerated: true,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await logAiUsage('moderation');
  } catch (error) {
    console.error('[onFeedPostCreate] AI moderation failed', error);
  }
});

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
    const text = [post.title, post.desc].filter(Boolean).join('\n').slice(0, 1000);
    const prompt = `소소킹 신고 게시물을 운영자 참고용으로 검토하세요.

신고 사유: ${String(report.reason || '').slice(0, 300)}
게시물:
${text}

판단값:
- clear_violation: 명백한 정책 위반
- review_needed: 운영자 판단 필요
- no_action: 정상적인 일상 의견이나 유머

게시글 숨김 또는 신고 종결을 직접 결정하지 말고 JSON만 출력하세요.
{"action":"review_needed","reason":"한 문장 근거"}`;
    const result = await modelFor(apiKey).generateContent(prompt);
    const analysis = parseAiJson(result.response.text());
    if (!analysis) return;
    const action = ['clear_violation', 'review_needed', 'no_action'].includes(analysis.action)
      ? analysis.action
      : 'review_needed';
    await snap.ref.update({
      aiReviewed: true,
      aiAction: action,
      aiReason: String(analysis.reason || '').slice(0, 300),
      aiReviewedAt: FieldValue.serverTimestamp(),
    });
    await logAiUsage('autoReport');
  } catch (error) {
    console.error('[onReportCreate] AI review failed', error);
  }
});
