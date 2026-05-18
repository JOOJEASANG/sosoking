const { onCall } = require('firebase-functions/v2/https');
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

async function generateMissionWithAi(apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
  });
  const types = ['밸런스게임', '삼행시', '한줄드립', '나만의노하우', '고민/질문', '경험담', '웃참챌린지', '실패담'];
  const type = types[Math.floor(Math.random() * types.length)];
  const result = await model.generateContent(
    `소소킹 커뮤니티 오늘의 미션을 만드세요. 재미있고 참여하기 쉬운 미션이어야 합니다.\n유형: ${type}\n\n반드시 JSON만 출력하세요:\n{\n  "title": "미션 제목 (40자 이내, 구체적이고 재미있게)",\n  "desc": "미션 설명 (80자 이내, 참여 방법 안내 포함)",\n  "cat": "golra 또는 usgyo 또는 malhe"\n}`
  );
  const raw = result.response.text().trim().replace(/```json|```/g, '').trim();
  return JSON.parse(raw);
}

// ── 관리자: AI 설정 저장 ──
exports.saveAiConfig = onCall({ region: 'asia-northeast3', secrets: [geminiKey] }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new Error('인증 필요');
  const adminSnap = await db.doc(`admins/${userId}`).get();
  if (!adminSnap.exists) throw new Error('관리자 권한 필요');
  const { apiKey, enabled, features } = request.data;
  const update = {
    enabled: enabled !== false,
    features: features || {},
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (apiKey && apiKey.length > 10) update.apiKey = apiKey;
  await db.doc('config/ai').set(update, { merge: true });
  return { ok: true };
});

// ── 관리자: 미션 즉시 생성 ──
exports.adminTriggerMission = onCall({ region: 'asia-northeast3', secrets: [geminiKey], timeoutSeconds: 60 }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new Error('인증 필요');
  const adminSnap = await db.doc(`admins/${userId}`).get();
  if (!adminSnap.exists) throw new Error('관리자 권한 필요');
  const apiKey = await getAiKey();
  if (!apiKey) throw new Error('AI API 키가 설정되지 않았어요');
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
exports.adminTriggerReport = onCall({ region: 'asia-northeast3', secrets: [geminiKey], timeoutSeconds: 120, memory: '256MiB' }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new Error('인증 필요');
  const adminSnap = await db.doc(`admins/${userId}`).get();
  if (!adminSnap.exists) throw new Error('관리자 권한 필요');
  const apiKey = await getAiKey();
  if (!apiKey) throw new Error('AI API 키가 설정되지 않았어요');
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
  const raw = result.response.text().trim().replace(/```json|```/g, '').trim();
  const report = JSON.parse(raw);
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
  { document: 'feeds/{postId}', region: 'asia-northeast3', secrets: [geminiKey], timeoutSeconds: 60 },
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
      const prompt = `다음 커뮤니티 게시물을 검토하세요. 반드시 JSON만 출력하세요.\n\n게시물:\n${textToCheck.slice(0, 800)}\n\n검토 기준: 타인 비방/욕설/혐오, 개인정보 노출, 스팸/광고, 불법 콘텐츠\n\n{\n  "safe": true,\n  "reason": null,\n  "tags": ["자동태그1", "자동태그2"],\n  "summary": "한 줄 요약 (20자 이내)"\n}`;
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim().replace(/```json|```/g, '').trim();
      const analysis = JSON.parse(raw);
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
  { document: 'reports/{reportId}', region: 'asia-northeast3', secrets: [geminiKey], timeoutSeconds: 60 },
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
        `신고된 게시물을 검토하세요. 반드시 JSON만 출력하세요.\n\n신고 사유: ${report.reason || ''}\n게시물 내용:\n${textToCheck.slice(0, 600)}\n\n판단: clear_violation(명백한 위반→숨김), review_needed(검토 필요), no_action(정상)\n\n{"action": "clear_violation", "reason": "판단 근거 한 문장"}`
      );
      const raw = result.response.text().trim().replace(/```json|```/g, '').trim();
      const analysis = JSON.parse(raw);
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
  { schedule: '0 22 * * *', timeZone: 'UTC', region: 'asia-northeast3', secrets: [geminiKey], timeoutSeconds: 60 },
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

// ── 스케줄: 매주 월요일 오전 9시 KST 주간 보고서 ──
exports.scheduledWeeklyReport = onSchedule(
  { schedule: '0 0 * * 1', timeZone: 'UTC', region: 'asia-northeast3', secrets: [geminiKey], timeoutSeconds: 120, memory: '256MiB' },
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
      const raw = result.response.text().trim().replace(/```json|```/g, '').trim();
      const report = JSON.parse(raw);
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
