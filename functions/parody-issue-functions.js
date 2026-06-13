'use strict';

// parody-issue-functions.js — 매일 오전 8시 AI 풍자 정치 이슈 3건 자동 생성

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = 'asia-northeast3';

const BOT_AUTHOR = Object.freeze({
  authorId: 'system_parody',
  authorName: '🎭 소소공화국 시사통신',
  authorPhoto: '',
  rankEmoji: '🎭',
});

let _aiConfig = null, _aiConfigAt = 0;
async function getAiConfig() {
  if (_aiConfig && Date.now() - _aiConfigAt < 30_000) return _aiConfig;
  const snap = await db.doc('config/ai_king').get();
  _aiConfig = snap.exists ? snap.data() : {};
  _aiConfigAt = Date.now();
  return _aiConfig;
}

async function callAI(prompt, maxTokens = 1200) {
  const config = await getAiConfig();
  if (config.activeModel === 'gemini') {
    if (!config.geminiApiKey) throw new Error('AI 키 미설정');
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const model = genAI.getGenerativeModel({ model: config.geminiModel || 'gemini-2.5-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 1.1, responseMimeType: 'application/json' },
    });
    return result.response.text();
  }
  if (!config.claudeApiKey) throw new Error('AI 키 미설정');
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: config.claudeApiKey });
  const msg = await anthropic.messages.create({
    model: config.claudeModel || 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    temperature: 1.0,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content.find(b => b.type === 'text')?.text || '';
}

function safeParseJson(raw) {
  const cleaned = String(raw || '').replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const m = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

function kstToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

async function loadGameContext() {
  const today = kstToday();
  const [presidentSnap, newsSnap, battleSnap] = await Promise.all([
    db.doc('president/current').get(),
    db.doc(`daily_news/${today}`).get(),
    db.doc(`daily_battle/${today}`).get(),
  ]);

  const presidentData = presidentSnap.exists ? presidentSnap.data() : null;
  const newsData = newsSnap.exists ? newsSnap.data() : null;
  const battleData = battleSnap.exists ? battleSnap.data() : null;

  return {
    presidentName: presidentData?.presidentName || '미선출',
    presidentParty: presidentData?.partyName || '',
    newsHeadline: newsData?.headline || newsData?.title || '',
    battleTopic: battleData?.title || '',
  };
}

async function generateParodyIssues(ctx) {
  const prompt = `당신은 소소공화국의 시사 풍자 작가입니다.
소소공화국 현황:
- 현 대통령: ${ctx.presidentName}${ctx.presidentParty ? ` (${ctx.presidentParty})` : ''}
- 오늘의 뉴스 헤드라인: ${ctx.newsHeadline || '특이사항 없음'}
- 오늘의 정당 배틀 주제: ${ctx.battleTopic || '미지정'}

위 상황을 참고해 오늘의 풍자 시사 이슈 3개를 JSON으로 생성하세요.
실제 한국 정치를 직접 언급하지 말고 소소공화국 내의 가상 상황으로만 패러디하세요.

JSON 형식 (반드시 아래 형식 그대로):
{
  "vote": {
    "title": "찬반 투표 제목 (30자 이내, 소소공화국 내 상황)",
    "desc": "투표 배경 설명 (80자 이내, 풍자적)",
    "optionA": "선택지 A (10자 이내)",
    "optionB": "선택지 B (10자 이내)"
  },
  "tournament": {
    "title": "양자 대결 제목 (30자 이내)",
    "desc": "대결 배경 설명 (80자 이내, 풍자적)",
    "optionA": "후보 A (10자 이내)",
    "optionB": "후보 B (10자 이내)"
  },
  "court": {
    "title": "헌법재판 안건 제목 (30자 이내)",
    "situation": "탄핵·위헌 심판 상황 설명 (120자 이내, 풍자적)"
  }
}`;

  const raw = await callAI(prompt, 1000);
  return safeParseJson(raw);
}

async function createParodyFeedPosts(issues, today) {
  const batch = db.batch();
  const now = FieldValue.serverTimestamp();
  const base = { ...BOT_AUTHOR, isParody: true, isAiGenerated: true, createdAt: now, viewCount: 0, commentCount: 0, likeCount: 0, cat: 'debate' };

  if (issues.vote) {
    const { title, desc, optionA, optionB } = issues.vote;
    const ref = db.collection('feeds').doc();
    batch.set(ref, {
      ...base,
      type: 'vote',
      title: String(title || '').slice(0, 60),
      desc: String(desc || '').slice(0, 200),
      options: [
        { text: String(optionA || 'A').slice(0, 20), votes: 0 },
        { text: String(optionB || 'B').slice(0, 20), votes: 0 },
      ],
      votedBy: [],
      parodyDate: today,
    });
  }

  if (issues.tournament) {
    const { title, desc, optionA, optionB } = issues.tournament;
    const ref = db.collection('feeds').doc();
    batch.set(ref, {
      ...base,
      type: 'vote',
      feedType: 'tournament',
      title: String(title || '').slice(0, 60),
      desc: String(desc || '').slice(0, 200),
      options: [
        { text: String(optionA || 'A').slice(0, 20), votes: 0 },
        { text: String(optionB || 'B').slice(0, 20), votes: 0 },
      ],
      votedBy: [],
      parodyDate: today,
    });
  }

  if (issues.court) {
    const { title, situation } = issues.court;
    const ref = db.collection('feeds').doc();
    batch.set(ref, {
      ...base,
      type: 'ai_judge',
      title: String(title || '').slice(0, 60),
      situation: String(situation || '').slice(0, 300),
      verdicts: [],
      parodyDate: today,
    });
  }

  await batch.commit();
}

async function runGenerateDailyParodyIssues() {
  const today = kstToday();
  const cacheRef = db.doc(`daily_parody/${today}`);
  const cacheSnap = await cacheRef.get();
  if (cacheSnap.exists && cacheSnap.data()?.done) {
    console.log('[parody] already generated for', today);
    return;
  }

  const ctx = await loadGameContext();
  const issues = await generateParodyIssues(ctx);
  if (!issues) throw new Error('AI 이슈 파싱 실패');

  await createParodyFeedPosts(issues, today);
  await cacheRef.set({ done: true, generatedAt: FieldValue.serverTimestamp(), ctx });
  console.log('[parody] generated 3 issues for', today);
}

exports.generateDailyParodyIssues = onSchedule(
  { schedule: '0 8 * * *', timeZone: 'Asia/Seoul', region: REGION },
  async () => { await runGenerateDailyParodyIssues(); },
);

exports.triggerParodyIssues = onCall({ region: REGION }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', '로그인 필요');
  const adminSnap = await db.doc(`admins/${req.auth.uid}`).get();
  if (!adminSnap.exists) throw new HttpsError('permission-denied', '관리자 전용');
  await runGenerateDailyParodyIssues();
  return { ok: true };
});
