'use strict';

// parody-issue-functions.js — 매일 오전 8시 새공화국 역사 풍자 이슈 1건 생성

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = 'asia-northeast3';

const { eventForDate, eventByDay, buildHistoryPromptBlock } = require('./republic-history-events');

const BOT_AUTHOR = Object.freeze({
  authorId: 'system_new_republic',
  authorName: '🏛️ 새공화국 기록관',
  authorPhoto: '',
  rankEmoji: '🏛️',
});

let _aiConfig = null;
let _aiConfigAt = 0;
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
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.85, responseMimeType: 'application/json' },
    });
    return result.response.text();
  }
  if (!config.claudeApiKey) throw new Error('AI 키 미설정');
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: config.claudeApiKey });
  const msg = await anthropic.messages.create({
    model: config.claudeModel || 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    temperature: 0.8,
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

function clean(value, max) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function fallbackIssue(event) {
  return {
    title: event.parodyTitle,
    desc: event.issueSummary,
    brief: `${event.era} · ${event.motifYear}년 모티브`,
    question: event.question,
    conservative: event.stances.national,
    progressive: event.stances.youth,
    centrist: event.stances.center,
    tags: ['새공화국', '현대사', '정치풍자'],
  };
}

async function requireAdmin(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', '로그인 필요');
  const adminSnap = await db.doc(`admins/${req.auth.uid}`).get();
  if (!adminSnap.exists) throw new HttpsError('permission-denied', '관리자 전용');
  return req.auth.uid;
}

function publicEvent(event) {
  return {
    day: event.day,
    era: event.era,
    motifYear: event.motifYear,
    motif: event.motif,
    parodyTitle: event.parodyTitle,
    issueSummary: event.issueSummary,
    question: event.question,
    stances: event.stances,
    effects: event.effects || {},
  };
}

async function generateHistoricalIssue(event) {
  const prompt = `당신은 소소킹의 역사 풍자 정치게임 작가입니다.
군사독재가 끝나고 새 공화국이 시작된 뒤의 한국 현대정치 흐름을 모티브로 하되, 실제 인물명·실제 정당명은 쓰지 말고 모두 가상 국가 "소소공화국"의 사건처럼 변형하세요.
피해 사건을 조롱하지 말고, 제도·권력·여론·정당 전략을 풍자하세요.

${buildHistoryPromptBlock(event)}

아래 JSON으로만 응답하세요.
{
  "title": "오늘의 역사 풍자 카드 제목, 35자 이내",
  "desc": "사건 배경 설명, 120자 이내",
  "brief": "한 줄 시대 해설, 60자 이내",
  "question": "유저에게 던질 정치적 질문, 45자 이내",
  "conservative": "국민질서당 입장, 80자 이내",
  "progressive": "시민개혁당 입장, 80자 이내",
  "centrist": "국민통합당 입장, 80자 이내",
  "tags": ["태그1", "태그2", "태그3"]
}`;

  try {
    const raw = await callAI(prompt, 1100);
    const parsed = safeParseJson(raw);
    if (!parsed || !parsed.title || !parsed.desc) return fallbackIssue(event);
    return parsed;
  } catch (error) {
    console.warn('[history-parody] AI generation failed, fallback used:', error.message);
    return fallbackIssue(event);
  }
}

function renderDesc(issue, event) {
  const lines = [
    `📜 ${clean(issue.brief, 80) || `${event.era} · ${event.motifYear}년 모티브`}`,
    '',
    clean(issue.desc, 180),
    '',
    `쟁점: ${clean(issue.question || event.question, 80)}`,
    '',
    `🛡️ 국민질서당: ${clean(issue.conservative || event.stances.national, 120)}`,
    `🕯️ 시민개혁당: ${clean(issue.progressive || event.stances.youth, 120)}`,
    `⚖️ 국민통합당: ${clean(issue.centrist || event.stances.center, 120)}`,
    '',
    '댓글로 어느 정당의 해석이 더 설득력 있는지 남겨보세요.',
  ];
  return lines.filter(line => line !== null && line !== undefined).join('\n');
}

async function createHistoricalFeedPost(issue, event, today) {
  const ref = db.collection('feeds').doc(`history_${today}`);
  const now = FieldValue.serverTimestamp();
  const tags = Array.isArray(issue.tags) && issue.tags.length
    ? issue.tags.map(t => clean(t, 18)).filter(Boolean).slice(0, 5)
    : ['새공화국', '현대사', '정치풍자'];

  const payload = {
    ...BOT_AUTHOR,
    type: 'citizen_speech',
    feedType: 'citizen_speech',
    subtype: 'history_parody',
    cat: 'multi',
    title: clean(issue.title || event.parodyTitle, 70),
    desc: renderDesc(issue, event),
    tags,
    images: [],
    partyId: '',
    commentCount: 0,
    viewCount: 0,
    reactions: { total: 0 },
    isParody: true,
    isAiGenerated: true,
    isHistoryIssue: true,
    historyDate: today,
    historyDay: event.day,
    historyEra: event.era,
    motifYear: event.motifYear,
    motif: event.motif,
    eventQuestion: clean(issue.question || event.question, 100),
    partyStances: {
      national: clean(issue.conservative || event.stances.national, 160),
      youth: clean(issue.progressive || event.stances.youth, 160),
      center: clean(issue.centrist || event.stances.center, 160),
    },
    effects: event.effects || {},
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(payload, { merge: false });
  return ref.id;
}

async function runGenerateDailyParodyIssues(options = {}) {
  const today = options.date || kstToday();
  const event = options.day ? eventByDay(options.day) : eventForDate(today);
  const cacheRef = db.doc(`daily_history_issues/${today}`);
  const cacheSnap = await cacheRef.get();

  if (cacheSnap.exists && cacheSnap.data()?.done && !options.force) {
    console.log('[history-parody] already generated for', today);
    return { skipped: true, date: today, postId: cacheSnap.data()?.postId || null };
  }

  const issue = await generateHistoricalIssue(event);
  const postId = await createHistoricalFeedPost(issue, event, today);
  await cacheRef.set({
    done: true,
    postId,
    date: today,
    historyDay: event.day,
    motifYear: event.motifYear,
    motif: event.motif,
    title: clean(issue.title || event.parodyTitle, 70),
    generatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log('[history-parody] generated daily issue', today, postId);
  return { skipped: false, date: today, postId, eventDay: event.day };
}

exports.generateDailyParodyIssues = onSchedule(
  { schedule: '0 8 * * *', timeZone: 'Asia/Seoul', region: REGION },
  async () => { await runGenerateDailyParodyIssues(); },
);

exports.previewHistoryIssue = onCall({ region: REGION, timeoutSeconds: 30 }, async req => {
  await requireAdmin(req);
  const date = req.data?.date || kstToday();
  const event = req.data?.day ? eventByDay(req.data.day) : eventForDate(date);
  const cacheSnap = await db.doc(`daily_history_issues/${date}`).get().catch(() => null);
  return {
    ok: true,
    date,
    event: publicEvent(event),
    cached: cacheSnap && cacheSnap.exists ? cacheSnap.data() : null,
  };
});

exports.triggerParodyIssues = onCall({ region: REGION, timeoutSeconds: 60 }, async req => {
  await requireAdmin(req);
  const result = await runGenerateDailyParodyIssues({
    force: !!req.data?.force,
    day: req.data?.day,
    date: req.data?.date,
  });
  return { ok: true, ...result };
});
