const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
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
  const today = new Date().toISOString().slice(0, 10);
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

async function generateMissionWithAi(apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
  });
  const types = ['밸런스게임', '삼행시', '나만의노하우', '고민/질문', '경험담', '웃참챌린지', '실패담'];
  const type = types[Math.floor(Math.random() * types.length)];
  const result = await model.generateContent(
    `소소킹 커뮤니티 오늘의 미션을 만드세요. 재미있고 참여하기 쉬운 미션이어야 합니다.\n유형: ${type}\n\n반드시 JSON만 출력하세요:\n{\n  "title": "미션 제목 (40자 이내, 구체적이고 재미있게)",\n  "desc": "미션 설명 (80자 이내, 참여 방법 안내 포함)",\n  "cat": "golra 또는 usgyo 또는 malhe"\n}`
  );
  const parsed = safeParseJson(result.response.text());
  if (!parsed) throw new Error('AI 미션 JSON 파싱 실패');
  return parsed;
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

// ── 관리자: 미션 즉시 생성 ──
exports.adminTriggerMission = onCall({ region: 'asia-northeast3', timeoutSeconds: 60 }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '인증 필요');
  const adminSnap = await db.doc(`admins/${userId}`).get();
  if (!adminSnap.exists) throw new HttpsError('permission-denied', '관리자 권한 필요');
  const apiKey = await getAiKey();
  if (!apiKey) throw new HttpsError('failed-precondition', 'AI API 키가 설정되지 않았어요');
  const existing = await db.collection('missions').where('active', '==', true).get();
  const batch = db.batch();
  existing.docs.forEach(d => batch.update(d.ref, { active: false }));
  await batch.commit();
  const mission = await generateMissionWithAi(apiKey);
  const ref = await db.collection('missions').add({
    title: (mission.title || '소소 미션').slice(0, 60),
    desc: (mission.desc || '').slice(0, 120),
    cat: mission.cat || 'golra',
    active: true,
    aiGenerated: true,
    createdAt: FieldValue.serverTimestamp(),
  });
  await logAiUsage();
  return { ok: true, id: ref.id, title: mission.title };
});

// ── 관리자: 주간 보고서 즉시 생성 ──
exports.adminTriggerReport = onCall({ region: 'asia-northeast3', timeoutSeconds: 120, memory: '256MiB' }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '인증 필요');
  const adminSnap = await db.doc(`admins/${userId}`).get();
  if (!adminSnap.exists) throw new HttpsError('permission-denied', '관리자 권한 필요');
  const apiKey = await getAiKey();
  if (!apiKey) throw new HttpsError('failed-precondition', 'AI API 키가 설정되지 않았어요');
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const postsSnap = await db.collection('feeds').where('createdAt', '>=', weekAgo).orderBy('createdAt', 'desc').limit(100).get();
  const posts = postsSnap.docs.map(d => d.data());
  const catCounts = posts.reduce((acc, p) => { acc[p.cat || 'unknown'] = (acc[p.cat || 'unknown'] || 0) + 1; return acc; }, {});
  const topPosts = posts
    .sort((a, b) => ((b.reactions?.total || 0) + (b.commentCount || 0)) - ((a.reactions?.total || 0) + (a.commentCount || 0)))
    .slice(0, 5)
    .map(p => `- ${p.title || '제목 없음'} (반응 ${p.reactions?.total || 0}개, 댓글 ${p.commentCount || 0}개)`);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
  });
  const prompt = `소소킹 커뮤니티 주간 활동 보고서를 작성하세요.\n\n데이터:\n- 이번 주 게시물 수: ${posts.length}개\n- 카테고리별: 골라봐 ${catCounts.golra || 0}개, 웃겨봐 ${catCounts.usgyo || 0}개, 말해봐 ${catCounts.malhe || 0}개\n- 인기 게시물 TOP 5:\n${topPosts.join('\n') || '없음'}\n\n반드시 JSON만 출력하세요:\n{\n  "title": "이번 주 소소킹 리포트",\n  "summary": "이번 주 커뮤니티 활동 총평 (150자 이내, 따뜻하고 유쾌하게)",\n  "highlights": ["주요 하이라이트 3가지"],\n  "nextWeekSuggestion": "다음 주 운영 제안 (80자 이내)"\n}`;
  const result = await model.generateContent(prompt);
  const report = safeParseJson(result.response.text());
  if (!report) throw new HttpsError('internal', 'AI 보고서 생성에 실패했어요. 잠시 후 다시 시도해주세요.');
  await db.collection('ai_reports').add({
    ...report,
    type: 'weekly',
    postCount: posts.length,
    catCounts,
    createdAt: FieldValue.serverTimestamp(),
  });
  await logAiUsage();
  return { ok: true, title: report.title };
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

// ── 스케줄: 매일 오전 7시 KST 미션 자동 생성 ──
exports.scheduledDailyMission = onSchedule(
  { schedule: '0 22 * * *', timeZone: 'UTC', region: 'asia-northeast3', timeoutSeconds: 60 },
  async () => {
    if (!(await isAiFeatureEnabled('autoMission'))) return;
    const apiKey = await getAiKey();
    if (!apiKey) return;
    try {
      const existing = await db.collection('missions').where('active', '==', true).get();
      const batch = db.batch();
      existing.docs.forEach(d => batch.update(d.ref, { active: false }));
      await batch.commit();
      const mission = await generateMissionWithAi(apiKey);
      await db.collection('missions').add({
        title: (mission.title || '오늘의 소소 미션').slice(0, 60),
        desc: (mission.desc || '').slice(0, 120),
        cat: mission.cat || 'golra',
        active: true,
        aiGenerated: true,
        createdAt: FieldValue.serverTimestamp(),
      });
      await logAiUsage();
    } catch (e) {
      console.error('Daily mission error:', e.message);
    }
  }
);

// ── AI 폼 데이터 생성 (일일 질문 카드 자동 입력) ──
exports.generateFormContent = onCall({ region: 'asia-northeast3', timeoutSeconds: 30 }, async (request) => {
  const { type, question } = request.data || {};
  if (!type || !question) throw new HttpsError('invalid-argument', 'type과 question이 필요해요');

  const apiKey = await getAiKey();
  if (!apiKey) throw new HttpsError('failed-precondition', 'AI API 키가 없어요');

  const promptMap = {
    vote: `소소킹 커뮤니티에 올릴 투표(골라킹) 게시글을 만들어줘.\n주제 힌트: "${question}"\n재미있고 공감 가는 투표여야 해. 반드시 JSON만 출력:\n{"title":"제목(50자이내)","desc":"투표 상황 설명(70자이내)","options":["선택지1","선택지2","선택지3","선택지4"]}`,
    acrostic: `소소킹 커뮤니티에 올릴 삼행시짓기 게시글을 만들어줘.\n주제 힌트: "${question}"\n참여하기 재미있는 3~5글자 제시어여야 해. 반드시 JSON만 출력:\n{"keyword":"3~5글자 한국어 제시어(예:소소킹)","desc":"삼행시 분위기 설명(60자이내)"}`,
    naming: `소소킹 커뮤니티에 올릴 미친작명소 게시글을 만들어줘.\n주제 힌트: "${question}"\n이름 붙이기 재미있는 황당하거나 공감 가는 상황이어야 해. 반드시 JSON만 출력:\n{"title":"게시글 제목(50자이내)","desc":"이름 붙일 상황 설명(100자이내)"}`,
    relay: `소소킹 커뮤니티에 올릴 막장킹(이어쓰기) 게시글을 만들어줘.\n주제 힌트: "${question}"\n계속 이어쓰고 싶은 흥미로운 막장 시작 문장이어야 해. 반드시 JSON만 출력:\n{"title":"게시글 제목(50자이내)","start":"첫 문장(80자이내,막장스럽게)","desc":"배경 상황 설명(70자이내)","characters":"주요 등장인물(예:나,팀장,친구)"}`,
  };

  const prompt = promptMap[type];
  if (!prompt) throw new HttpsError('invalid-argument', `지원하지 않는 유형: ${type}`);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
  });
  const result = await model.generateContent(prompt);
  const data = safeParseJson(result.response.text());
  if (!data) throw new HttpsError('internal', 'AI 콘텐츠 생성에 실패했어요. 잠시 후 다시 시도해주세요.');
  await logAiUsage();
  return { ok: true, data };
});

// ── 스케줄: 매주 월요일 오전 9시 KST 주간 보고서 ──
exports.scheduledWeeklyReport = onSchedule(
  { schedule: '0 0 * * 1', timeZone: 'UTC', region: 'asia-northeast3', timeoutSeconds: 120, memory: '256MiB' },
  async () => {
    if (!(await isAiFeatureEnabled('weeklyReport'))) return;
    const apiKey = await getAiKey();
    if (!apiKey) return;
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const [postsSnap, reportsSnap] = await Promise.all([
        db.collection('feeds').where('createdAt', '>=', weekAgo).orderBy('createdAt', 'desc').limit(100).get(),
        db.collection('reports').where('createdAt', '>=', weekAgo).get(),
      ]);
      const posts = postsSnap.docs.map(d => d.data());
      const catCounts = posts.reduce((acc, p) => { acc[p.cat || 'unknown'] = (acc[p.cat || 'unknown'] || 0) + 1; return acc; }, {});
      const topPosts = posts
        .sort((a, b) => ((b.reactions?.total || 0) + (b.commentCount || 0)) - ((a.reactions?.total || 0) + (a.commentCount || 0)))
        .slice(0, 5)
        .map(p => `- ${p.title || '제목 없음'} (반응 ${p.reactions?.total || 0}개)`);
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
      });
      const result = await model.generateContent(
        `소소킹 커뮤니티 주간 활동 보고서를 작성하세요.\n\n데이터:\n- 게시물: ${posts.length}개\n- 카테고리별: 골라봐 ${catCounts.golra||0}개, 웃겨봐 ${catCounts.usgyo||0}개, 도전봐 ${catCounts.malhe||0}개\n- 신고: ${reportsSnap.size}건\n- 인기글:\n${topPosts.join('\n') || '없음'}\n\n반드시 JSON만 출력하세요:\n{\n  "title": "이번 주 소소킹 리포트",\n  "summary": "이번 주 커뮤니티 활동 총평 (150자 이내, 따뜻하고 유쾌하게)",\n  "highlights": ["주요 하이라이트 3가지"],\n  "nextWeekSuggestion": "다음 주 운영 제안 (80자 이내)"\n}`
      );
      const report = safeParseJson(result.response.text());
      if (!report) { console.warn('[weekly-report] AI JSON 파싱 실패'); return; }
      await db.collection('ai_reports').add({
        ...report,
        type: 'weekly',
        postCount: posts.length,
        reportCount: reportsSnap.size,
        catCounts,
        createdAt: FieldValue.serverTimestamp(),
      });
      await logAiUsage();
    } catch (e) {
      console.error('Weekly report error:', e.message);
    }
  }
);

require('./ai-content-now').register({ exports, onCall, db, FieldValue, GoogleGenerativeAI, geminiKey, getAiKey, logAiUsage });

// ── AI킹 (판사·번역사·궁합) ──
const aiKing = require('./ai-king-functions');
exports.aiJudge = aiKing.aiJudge;
exports.aiTranslate = aiKing.aiTranslate;
exports.aiMatch = aiKing.aiMatch;
exports.aiNaming = aiKing.aiNaming;
exports.getAiKingUsage = aiKing.getAiKingUsage;
exports.saveAiKingConfig = aiKing.saveAiKingConfig;
exports.purchaseAiExtraUse = aiKing.purchaseAiExtraUse;

// ── 게시글 삭제 (작성자/관리자) ──
const postOwnerFns = require('./post-owner-functions');
exports.deleteOwnPost = postOwnerFns.deleteOwnPost;

// ── 포인트 ──
const pointsFns = require('./points-functions');
exports.awardUserPoints = pointsFns.awardUserPoints;
exports.claimSignupBonus = pointsFns.claimSignupBonus;
exports.claimDailyBonus = pointsFns.claimDailyBonus;

// ── 토너먼트 결과 기록 ──
exports.recordTournamentResult = onCall({ region: 'asia-northeast3' }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인 필요');

  const { postId, winnerIdx } = request.data || {};
  if (!postId || typeof winnerIdx !== 'number') throw new HttpsError('invalid-argument', '잘못된 데이터');

  const postRef = db.doc(`feeds/${postId}`);
  const snap = await postRef.get();
  if (!snap.exists) throw new HttpsError('not-found', '게시물 없음');

  const t = snap.data()?.modules?.tournament;
  if (!t?.enabled || !Array.isArray(t.items) || winnerIdx < 0 || winnerIdx >= t.items.length) {
    throw new HttpsError('invalid-argument', '유효하지 않은 항목');
  }

  await postRef.update({
    [`modules.tournament.wins.${winnerIdx}`]: FieldValue.increment(1),
    'modules.tournament.plays': FieldValue.increment(1),
  });

  return { ok: true };
});