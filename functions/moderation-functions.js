'use strict';

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { AI_RUNTIME_SECRETS, callAI, callAndParse } = require('./ai-runtime-provider');

const db = getFirestore();
const REGION = 'asia-northeast3';

async function featureEnabled(name) {
  const snap = await db.doc('config/ai').get().catch(() => null);
  if (!snap?.exists) return true;
  const data = snap.data() || {};
  if (data.enabled === false) return false;
  return data.features?.[name] !== false;
}

function cleanText(value, maximum) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, maximum);
}

async function logUsage(type) {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  await db.doc(`ai_usage/${day}_${type}`).set({
    type,
    day,
    count: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true }).catch(() => null);
}

const onFeedPostCreate = onDocumentCreated({
  document: 'feeds/{postId}',
  region: REGION,
  timeoutSeconds: 60,
  memory: '256MiB',
  secrets: AI_RUNTIME_SECRETS,
}, async event => {
  const snapshot = event.data;
  if (!snapshot || !(await featureEnabled('moderation'))) return;
  const post = snapshot.data() || {};
  const content = [post.title, post.body, post.desc, post.subtitle]
    .map(value => cleanText(value, 800))
    .filter(Boolean)
    .join('\n');
  if (!content) return;

  try {
    const { parsed } = await callAndParse(
      maxTokens => callAI(
        '당신은 한국어 커뮤니티 게시물의 안전 검토 보조 도구다. 가벼운 유머와 인터넷 표현은 허용하고, 개인정보 노출·협박·성희롱·혐오·광고·명백한 불법 정보만 위험 신호로 분류한다. 자동으로 게시물을 삭제하거나 사실을 단정하지 않는다. JSON만 출력한다.',
        `게시물:\n${content}\n\n형식: {"risk":"none|review","reason":"검토 이유","tags":["태그"],"summary":"20자 이내 요약"}`,
        maxTokens,
        0.2,
        true,
      ),
      700,
    );
    await snapshot.ref.set({
      aiModerated: true,
      aiReviewNeeded: parsed.risk === 'review',
      aiReviewReason: cleanText(parsed.reason, 300),
      aiTags: Array.isArray(parsed.tags) ? parsed.tags.map(item => cleanText(item, 30)).filter(Boolean).slice(0, 5) : [],
      aiSummary: cleanText(parsed.summary, 80),
      aiModeratedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await logUsage('moderation');
  } catch (error) {
    console.error('[onFeedPostCreate]', error.message);
  }
});

const onReportCreate = onDocumentCreated({
  document: 'reports/{reportId}',
  region: REGION,
  timeoutSeconds: 60,
  memory: '256MiB',
  secrets: AI_RUNTIME_SECRETS,
}, async event => {
  const snapshot = event.data;
  if (!snapshot || !(await featureEnabled('autoReport'))) return;
  const report = snapshot.data() || {};
  if (report.aiGenerated) return;

  const postSnapshot = await db.doc(`feeds/${cleanText(report.postId, 128)}`).get().catch(() => null);
  if (!postSnapshot?.exists) return;
  const post = postSnapshot.data() || {};
  const content = [post.title, post.body, post.desc]
    .map(value => cleanText(value, 700))
    .filter(Boolean)
    .join('\n');

  try {
    const { parsed } = await callAndParse(
      maxTokens => callAI(
        '당신은 신고 검토를 돕는 보조 도구다. 신고 사유와 게시물을 비교해 관리자 검토 우선순위만 제안한다. 게시물을 자동 삭제하거나 위반을 확정하지 않는다. JSON만 출력한다.',
        `신고 사유: ${cleanText(report.reason, 500)}\n게시물:\n${content}\n\n형식: {"priority":"low|normal|high","reason":"관리자가 확인할 핵심"}`,
        maxTokens,
        0.2,
        true,
      ),
      600,
    );
    await snapshot.ref.set({
      aiReviewed: true,
      aiPriority: ['low', 'normal', 'high'].includes(parsed.priority) ? parsed.priority : 'normal',
      aiReason: cleanText(parsed.reason, 400),
      aiReviewedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await logUsage('report-review');
  } catch (error) {
    console.error('[onReportCreate]', error.message);
  }
});

module.exports = { onFeedPostCreate, onReportCreate };
