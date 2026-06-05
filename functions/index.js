const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

if (!getApps().length) initializeApp();
const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');

async function getAiKey() {
  try {
    const snap = await db.doc('config/ai').get();
    if (snap.exists) {
      const key = snap.data()?.apiKey;
      if (key && key.length > 10) return key.trim();
    }
  } catch {}
  try { return geminiKey.value().trim(); } catch { return null; }
}

async function isAiFeatureEnabled(feature) {
  try {
    const snap = await db.doc('config/ai').get();
    if (!snap.exists) return true;
    const data = snap.data();
    if (data.enabled === false) return false;
    return data.features?.[feature] !== false;
  } catch { return true; }
}

async function logAiUsage() {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  await db.doc('config/ai').set(
    { usage: { [today]: { requests: FieldValue.increment(1) } } },
    { merge: true }
  );
}

function safeParseJson(raw, fallback = null) {
  const text = String(raw || '').trim().replace(/```json|```/g, '').trim();
  try { return JSON.parse(text); } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch {} }
  return fallback;
}

const GEMINI_KEY_RE = /^AIza[0-9A-Za-z_-]{35}$/;

// ── 관리자: AI 설정 저장 ──
exports.saveAiConfig = onCall({ region: 'asia-northeast3' }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '인증 필요');
  const adminSnap = await db.doc(`admins/${userId}`).get();
  if (!adminSnap.exists) throw new HttpsError('permission-denied', '관리자 권한 필요');
  const { apiKey, enabled, features } = request.data;
  if (apiKey !== undefined && (typeof apiKey !== 'string' || !GEMINI_KEY_RE.test(apiKey))) {
    throw new HttpsError('invalid-argument', '유효하지 않은 Gemini API 키 형식입니다. (AIza로 시작하는 39자)');
  }
  const update = {
    enabled: enabled !== false,
    features: typeof features === 'object' && features !== null ? features : {},
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (apiKey) update.apiKey = apiKey;
  await db.doc('config/ai').set(update, { merge: true });
  return { ok: true };
});

// ── AI 콘텐츠 자동 모더레이션: 새 게시물 생성 시 ──
exports.onFeedPostCreate = onDocumentCreated(
  { document: 'feeds/{postId}', region: 'asia-northeast3', timeoutSeconds: 60 },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const post = snap.data();
    if (!(await isAiFeatureEnabled('moderation'))) return;
    const apiKey = await getAiKey();
    if (!apiKey) return;
    const textToCheck = [post.title, post.body, post.desc, post.subtitle].filter(Boolean).join('\n');
    if (!textToCheck.trim()) return;
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
      });
      const prompt = `소소킹(한국 유머/게임 커뮤니티) 게시물을 검토하세요. 반드시 JSON만 출력하세요.

게시물:
${textToCheck.slice(0, 800)}

[허용] 가벼운 인터넷 슬랭: 미친, 개웃김, ㅋㅋ, 대박, 헐, 존나웃김, ㅅㅂ, 아 씨, 미쳤다 등 감탄/유머 표현
[허용] 놀이 유형 이름: 미친작명소, 억까재판, 막장킹 등 사이트 고유 명칭
[차단] 특정인 신상 공개·협박·성희롱·혐오, 상업 광고/스팸, 명백한 불법 콘텐츠

{
  "safe": true,
  "reason": null,
  "tags": ["자동태그1", "자동태그2"],
  "summary": "한 줄 요약 (20자 이내)"
}`;
      const result = await model.generateContent(prompt);
      const analysis = safeParseJson(result.response.text());
      if (!analysis) { console.warn('[moderation] AI JSON 파싱 실패, 모더레이션 건너뜀'); return; }
      const updates = { aiModerated: true, aiTags: analysis.tags || [], aiSummary: analysis.summary || '' };
      if (!analysis.safe) {
        updates.hidden = true;
        updates.hideReason = 'AI 자동 검토: ' + (analysis.reason || '정책 위반 의심');
        await db.collection('reports').add({
          postId: snap.id,
          postTitle: post.title || '',
          authorId: post.authorId || '',
          reason: analysis.reason || 'AI 자동 감지',
          reportedBy: 'AI',
          resolved: false,
          aiGenerated: true,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      await snap.ref.update(updates);
      await logAiUsage();
    } catch (e) {
      console.error('AI moderation error:', e.message);
    }
  }
);

// ── AI 신고 자동 처리: 새 신고 접수 시 ──
exports.onReportCreate = onDocumentCreated(
  { document: 'reports/{reportId}', region: 'asia-northeast3', timeoutSeconds: 60 },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const report = snap.data();
    if (report.aiGenerated) return;
    if (!(await isAiFeatureEnabled('autoReport'))) return;
    const apiKey = await getAiKey();
    if (!apiKey) return;
    try {
      const postSnap = await db.doc(`feeds/${report.postId}`).get();
      if (!postSnap.exists) return;
      const post = postSnap.data();
      const textToCheck = [post.title, post.body, post.desc].filter(Boolean).join('\n');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
      });
      const result = await model.generateContent(
        `소소킹(한국 유머/게임 커뮤니티) 신고 게시물을 검토하세요. 반드시 JSON만 출력하세요.

신고 사유: ${report.reason || ''}
게시물 내용:
${textToCheck.slice(0, 600)}

[허용] 미친·개웃김·ㅅㅂ 등 가벼운 인터넷 슬랭, 유머·과장 표현, 사이트 게임 명칭
[차단] 특정인 신상·협박·성희롱·혐오, 광고/스팸, 명백한 불법 콘텐츠

판단: clear_violation(명백한 위반→숨김), review_needed(검토 필요), no_action(정상)

{"action": "no_action", "reason": "판단 근거 한 문장"}`
      );
      const analysis = safeParseJson(result.response.text());
      if (!analysis) { console.warn('[report-handler] AI JSON 파싱 실패'); return; }
      const updateData = { aiReviewed: true, aiAction: analysis.action, aiReason: analysis.reason };
      if (analysis.action === 'clear_violation') {
        await postSnap.ref.update({ hidden: true, hideReason: 'AI 신고 처리: ' + (analysis.reason || '') });
        updateData.resolved = true;
        updateData.aiResolved = true;
      }
      await snap.ref.update(updateData);
      await logAiUsage();
    } catch (e) {
      console.error('AI report handler error:', e.message);
    }
  }
);

// ── SEO 라우트(seoPost·sitemapXml) 등록 ──
require('./seo-functions').register({ exports, db });

// ── AI킹 4소 (판결·번역·궁합·작명·상담) ──
const aiKing = require('./ai-king-functions');
exports.aiJudge = aiKing.aiJudge;
exports.aiTranslate = aiKing.aiTranslate;
exports.aiMatch = aiKing.aiMatch;
exports.aiNaming = aiKing.aiNaming;
exports.aiConsult = aiKing.aiConsult;
exports.getAiKingUsage = aiKing.getAiKingUsage;
exports.saveAiKingConfig = aiKing.saveAiKingConfig;
exports.purchaseAiExtraUse = aiKing.purchaseAiExtraUse;

// ── 이미지 업로드 ──
const uploadFns = require('./upload-image-functions');
exports.uploadFeedImage = uploadFns.uploadFeedImage;

// ── 게시글 삭제 (작성자/관리자) ──
const postOwnerFns = require('./post-owner-functions');
exports.deleteOwnPost = postOwnerFns.deleteOwnPost;

// ── AI 사다리 보너스 ──
const ladderFns = require('./ai-ladder-functions');
exports.playAiLadderBonus = ladderFns.playAiLadderBonus;

// ── 포인트 ──
const pointsFns = require('./points-functions');
exports.awardUserPoints = pointsFns.awardUserPoints;
exports.claimSignupBonus = pointsFns.claimSignupBonus;
exports.claimDailyBonus = pointsFns.claimDailyBonus;