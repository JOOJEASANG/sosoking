'use strict';

// parody-issue-functions.js — 매일 오전 8시 새공화국 역사정치 이슈 3건 생성

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = 'asia-northeast3';
const DAILY_HISTORY_ISSUE_COUNT = 3;
const MAX_HISTORY_ISSUE_COUNT = 5;

const { HISTORY_EVENTS, eventForDate, eventByDay, buildHistoryPromptBlock } = require('./republic-history-events');

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

async function callAI(prompt, maxTokens = 2200) {
  const config = await getAiConfig();
  if (config.activeModel === 'gemini') {
    if (!config.geminiApiKey) throw new Error('AI 키 미설정');
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const model = genAI.getGenerativeModel({ model: config.geminiModel || 'gemini-2.5-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.72, responseMimeType: 'application/json' },
    });
    return result.response.text();
  }
  if (!config.claudeApiKey) throw new Error('AI 키 미설정');
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: config.claudeApiKey });
  const msg = await anthropic.messages.create({
    model: config.claudeModel || 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    temperature: 0.72,
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

function cleanArray(value, maxLen = 160, limit = 5) {
  return Array.isArray(value) ? value.map(v => clean(v, maxLen)).filter(Boolean).slice(0, limit) : [];
}

function clampIssueCount(value) {
  const n = Number(value || DAILY_HISTORY_ISSUE_COUNT);
  if (!Number.isFinite(n)) return DAILY_HISTORY_ISSUE_COUNT;
  return Math.max(1, Math.min(MAX_HISTORY_ISSUE_COUNT, Math.floor(n)));
}

function slotId(slot) {
  return String(Number(slot || 0) + 1).padStart(2, '0');
}

function pickEventForSlot(date, slot, startDay = null) {
  const total = HISTORY_EVENTS.length || 30;
  const baseDay = startDay ? Number(startDay) : Number(eventForDate(`${date}_base`)?.day || 1);
  const day = (((baseDay - 1 + Number(slot || 0)) % total) + 1);
  return eventByDay(day);
}

function fallbackIssue(event) {
  const background = [
    `${event.era}의 핵심 모티브는 ${event.motif}입니다. 이 사건은 권력 운영 방식과 시민 요구가 충돌한 국면으로 볼 수 있습니다.`,
    `정당들은 같은 사건을 안정, 개혁, 타협이라는 서로 다른 기준으로 해석합니다.`,
  ];
  const timeline = [
    `배경: ${event.motifYear}년 전후 누적된 제도 불신과 사회 변화가 쟁점의 바탕이 됐습니다.`,
    `전개: ${event.question}`,
    `결과: 이후 정치 제도와 시민 여론의 방향에 영향을 남겼습니다.`,
  ];
  return {
    title: event.parodyTitle,
    desc: event.issueSummary,
    brief: `${event.era} · ${event.motifYear}년 모티브`,
    question: event.question,
    background,
    timeline,
    keyIssues: [event.question, '안정과 개혁 중 무엇을 우선해야 하는가?', '가상 정당의 선택이 현재 정치에 어떤 의미를 갖는가?'],
    actualResult: `${event.motif}는 한국 현대정치에서 제도 변화와 시민 여론을 이해하는 중요한 사례로 볼 수 있습니다.`,
    gamePoint: '유저는 세 가상 정당 중 하나의 해석을 선택해 정치력과 정당 모멘텀을 쌓습니다.',
    conservative: event.stances.national,
    progressive: event.stances.youth,
    centrist: event.stances.center,
    discussionQuestions: [event.question, '내가 그 시대의 시민이었다면 어떤 선택을 했을까?'],
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

function normalizeIssue(parsed, event) {
  const fb = fallbackIssue(event);
  const issue = parsed && typeof parsed === 'object' ? parsed : fb;
  return {
    title: clean(issue.title || fb.title, 70),
    desc: clean(issue.desc || fb.desc, 260),
    brief: clean(issue.brief || fb.brief, 90),
    question: clean(issue.question || fb.question, 100),
    background: cleanArray(issue.background, 260, 3),
    timeline: cleanArray(issue.timeline, 220, 5),
    keyIssues: cleanArray(issue.keyIssues, 180, 5),
    actualResult: clean(issue.actualResult || fb.actualResult, 700),
    gamePoint: clean(issue.gamePoint || fb.gamePoint, 260),
    conservative: clean(issue.conservative || fb.conservative, 180),
    progressive: clean(issue.progressive || fb.progressive, 180),
    centrist: clean(issue.centrist || fb.centrist, 180),
    discussionQuestions: cleanArray(issue.discussionQuestions, 150, 4),
    tags: cleanArray(issue.tags, 18, 6).length ? cleanArray(issue.tags, 18, 6) : fb.tags,
  };
}

async function generateHistoricalIssue(event) {
  const prompt = `당신은 소소킹의 역사정치 자료실 작가입니다.
군사독재가 끝나고 새 공화국이 시작된 뒤의 한국 현대정치 흐름을 모티브로 하되, 실제 인물명·실제 정당명은 쓰지 말고 모두 가상 국가 "소소공화국"의 사건처럼 변형하세요.
피해 사건을 조롱하지 말고, 제도·권력·여론·정당 전략을 설명하세요.
자료실에 쌓일 글이므로 짧은 카드가 아니라 배경·전개·결과·토론질문이 있는 교육형 요약으로 작성하세요.
단, 정확한 출처를 직접 인용하지 말고 "실제 모티브"와 "가상 해석"을 구분하세요.

${buildHistoryPromptBlock(event)}

아래 JSON으로만 응답하세요.
{
  "title": "오늘의 역사정치 제목, 35자 이내",
  "desc": "사건 핵심 요약, 180자 이내",
  "brief": "한 줄 시대 해설, 70자 이내",
  "question": "유저에게 던질 정치적 질문, 60자 이내",
  "background": ["시대 배경 1문단, 180자 이내", "사건이 중요해진 이유 1문단, 180자 이내"],
  "timeline": ["배경: ...", "전개: ...", "결과: ..."],
  "keyIssues": ["핵심 쟁점 1", "핵심 쟁점 2", "핵심 쟁점 3"],
  "actualResult": "실제 역사 흐름에서 남긴 결과와 의미, 450자 이내",
  "gamePoint": "게임에서는 이 사건을 어떻게 선택형 판단으로 바꾸는지, 180자 이내",
  "conservative": "국민질서당 입장, 120자 이내",
  "progressive": "시민개혁당 입장, 120자 이내",
  "centrist": "국민통합당 입장, 120자 이내",
  "discussionQuestions": ["토론질문1", "토론질문2"],
  "tags": ["태그1", "태그2", "태그3", "태그4"]
}`;

  try {
    const raw = await callAI(prompt, 2400);
    const parsed = safeParseJson(raw);
    if (!parsed || !parsed.title || !parsed.desc) return fallbackIssue(event);
    return normalizeIssue(parsed, event);
  } catch (error) {
    console.warn('[history-parody] AI generation failed, fallback used:', error.message);
    return fallbackIssue(event);
  }
}

function renderSection(title, lines) {
  const body = cleanArray(lines, 260, 6).map(line => `- ${line}`).join('\n');
  return body ? `${title}\n${body}\n` : '';
}

function renderDesc(issue, event) {
  const lines = [
    `📜 ${clean(issue.brief, 90) || `${event.era} · ${event.motifYear}년 모티브`}`,
    '',
    clean(issue.desc, 260),
    '',
    `🔎 실제 모티브: ${event.motifYear}년 · ${clean(event.motif, 160)}`,
    '',
    renderSection('🧭 시대 배경', issue.background),
    renderSection('🕰️ 전개 흐름', issue.timeline),
    renderSection('⚖️ 핵심 쟁점', issue.keyIssues),
    `📌 실제 역사에서 남긴 의미\n${clean(issue.actualResult, 700)}`,
    '',
    `🎮 게임화 포인트\n${clean(issue.gamePoint, 260)}`,
    '',
    `질문: ${clean(issue.question || event.question, 100)}`,
    '',
    `🛡️ 국민질서당: ${clean(issue.conservative || event.stances.national, 180)}`,
    `🕯️ 시민개혁당: ${clean(issue.progressive || event.stances.youth, 180)}`,
    `⚖️ 국민통합당: ${clean(issue.centrist || event.stances.center, 180)}`,
    '',
    renderSection('💬 토론 질문', issue.discussionQuestions),
    '※ 사건·제도·시대 흐름은 실제 한국 현대사를 모티브로 하지만, 게임 속 인물과 정당은 모두 가상입니다.',
  ];
  return lines.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n');
}

async function createHistoricalFeedPost(issue, event, today, slot = 0) {
  const id = `history_${today}_${slotId(slot)}`;
  const ref = db.collection('feeds').doc(id);
  const now = FieldValue.serverTimestamp();
  const tags = Array.isArray(issue.tags) && issue.tags.length
    ? issue.tags.map(t => clean(t, 18)).filter(Boolean).slice(0, 6)
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
    historySlot: Number(slot || 0) + 1,
    historyDay: event.day,
    historyEra: event.era,
    motifYear: event.motifYear,
    motif: event.motif,
    eventQuestion: clean(issue.question || event.question, 100),
    historyDetails: {
      background: issue.background || [],
      timeline: issue.timeline || [],
      keyIssues: issue.keyIssues || [],
      actualResult: clean(issue.actualResult, 700),
      gamePoint: clean(issue.gamePoint, 260),
      discussionQuestions: issue.discussionQuestions || [],
    },
    partyStances: {
      national: clean(issue.conservative || event.stances.national, 180),
      youth: clean(issue.progressive || event.stances.youth, 180),
      center: clean(issue.centrist || event.stances.center, 180),
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
  const count = clampIssueCount(options.count);
  const startDay = options.day ? Number(options.day) : null;
  const cacheRef = db.doc(`daily_history_issues/${today}`);
  const cacheSnap = await cacheRef.get();
  const cachedItems = Array.isArray(cacheSnap.data()?.items) ? cacheSnap.data().items : [];

  if (cacheSnap.exists && cacheSnap.data()?.done && cachedItems.length >= count && !options.force) {
    console.log('[history-parody] already generated for', today, cachedItems.length);
    return { skipped: true, date: today, count: cachedItems.length, items: cachedItems };
  }

  const items = options.force ? [] : [...cachedItems];
  const existingSlots = new Set(items.map(item => Number(item.slot || 0)).filter(Boolean));

  for (let slot = 0; slot < count; slot += 1) {
    const publicSlot = slot + 1;
    if (!options.force && existingSlots.has(publicSlot)) continue;
    const event = pickEventForSlot(today, slot, startDay);
    const issue = await generateHistoricalIssue(event);
    const postId = await createHistoricalFeedPost(issue, event, today, slot);
    items.push({
      slot: publicSlot,
      postId,
      historyDay: event.day,
      motifYear: event.motifYear,
      motif: event.motif,
      title: clean(issue.title || event.parodyTitle, 70),
    });
  }

  items.sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0));
  await cacheRef.set({
    done: items.length >= count,
    postId: items[0]?.postId || null,
    postIds: items.map(item => item.postId).filter(Boolean),
    items,
    count: items.length,
    targetCount: count,
    date: today,
    historyDay: items[0]?.historyDay || null,
    motifYear: items[0]?.motifYear || null,
    motif: items[0]?.motif || null,
    title: items[0]?.title || null,
    detailed: true,
    generatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log('[history-parody] generated daily issues', today, items.length);
  return { skipped: false, date: today, count: items.length, items, detailed: true };
}

exports.generateDailyParodyIssues = onSchedule(
  { schedule: '0 8 * * *', timeZone: 'Asia/Seoul', region: REGION, timeoutSeconds: 240, memory: '512MiB' },
  async () => { await runGenerateDailyParodyIssues({ count: DAILY_HISTORY_ISSUE_COUNT }); },
);

exports.previewHistoryIssue = onCall({ region: REGION, timeoutSeconds: 30 }, async req => {
  await requireAdmin(req);
  const date = req.data?.date || kstToday();
  const count = clampIssueCount(req.data?.count || DAILY_HISTORY_ISSUE_COUNT);
  const startDay = req.data?.day ? Number(req.data.day) : null;
  const events = Array.from({ length: count }, (_, slot) => publicEvent(pickEventForSlot(date, slot, startDay)));
  const cacheSnap = await db.doc(`daily_history_issues/${date}`).get().catch(() => null);
  return {
    ok: true,
    date,
    count,
    event: events[0],
    events,
    cached: cacheSnap && cacheSnap.exists ? cacheSnap.data() : null,
  };
});

exports.triggerParodyIssues = onCall({ region: REGION, timeoutSeconds: 240, memory: '512MiB' }, async req => {
  await requireAdmin(req);
  const result = await runGenerateDailyParodyIssues({
    force: !!req.data?.force,
    day: req.data?.day,
    date: req.data?.date,
    count: req.data?.count || DAILY_HISTORY_ISSUE_COUNT,
  });
  return { ok: true, ...result };
});
