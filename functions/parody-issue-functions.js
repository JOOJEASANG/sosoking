'use strict';

// parody-issue-functions.js — 매일 오전 8시 역사정치 자료 3건 누적 생성

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = 'asia-northeast3';
const DAILY_HISTORY_ISSUE_COUNT = 3;
const MAX_HISTORY_ISSUE_COUNT = 5;
const HISTORY_SEQUENCE_ANCHOR = '2026-06-17';

const { HISTORY_EVENTS, eventByDay } = require('./republic-history-events');

const BOT_AUTHOR = Object.freeze({ authorId: 'system_new_republic', authorName: '🏛️ 새공화국 기록관', authorPhoto: '', rankEmoji: '🏛️' });

function kstToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function clean(value, max) { return String(value || '').replace(/[<>]/g, '').trim().slice(0, max); }
function clampIssueCount(value) {
  const n = Number(value || DAILY_HISTORY_ISSUE_COUNT);
  if (!Number.isFinite(n)) return DAILY_HISTORY_ISSUE_COUNT;
  return Math.max(1, Math.min(MAX_HISTORY_ISSUE_COUNT, Math.floor(n)));
}
function slotId(slot) { return String(Number(slot || 0) + 1).padStart(2, '0'); }
function seedDayForArchiveDay(archiveDay) {
  const total = HISTORY_EVENTS.length || 30;
  return (((Number(archiveDay || 1) - 1) % total) + 1);
}
function eventForArchiveDay(archiveDay) { return eventByDay(seedDayForArchiveDay(archiveDay)); }

function issueFromEvent(event, archiveDay) {
  const round = Math.floor((Number(archiveDay || event.day) - 1) / (HISTORY_EVENTS.length || 30));
  const isExtension = round > 0;
  const extensionLabel = isExtension ? ` · 확장기록 ${archiveDay}` : '';
  return {
    title: `${event.parodyTitle}${extensionLabel}`,
    desc: event.issueSummary,
    brief: `${event.era} · ${event.motifYear}년 모티브`,
    question: event.question,
    background: [
      `${event.motifYear}년 전후의 핵심 흐름은 ${event.motif}입니다. 이 사건은 새 공화국의 제도와 권력 운영 방식을 이해하는 출발점입니다.`,
      isExtension
        ? `이 기록은 기존 모티브를 반복 노출하지 않기 위해 다른 질문·댓글·선택 흐름으로 다시 확장 저장되는 누적 자료입니다.`
        : `게임에서는 실제 인물과 정당을 쓰지 않고, 안정·개혁·통합이라는 세 관점으로 사건을 다시 선택하게 만듭니다.`,
    ],
    timeline: [
      `배경: ${event.motifYear}년 전후 사회 변화와 시민 요구가 커졌습니다.`,
      `전개: ${event.question}`,
      `결과: 이후 정치 제도와 정당 경쟁, 시민 여론의 방향에 영향을 남겼습니다.`,
    ],
    keyIssues: [event.question, '안정과 개혁 중 무엇을 우선해야 하는가?', '정치 세력은 시민 요구를 어떻게 제도화해야 하는가?'],
    actualResult: `${event.motif}는 한국 현대정치의 제도 변화와 권력 균형을 이해하는 중요한 모티브입니다. 이 자료는 실제 흐름을 요약하되, 게임 속 인물과 정당은 모두 가상으로 처리합니다.`,
    gamePoint: '유저는 세 가상 정당 중 하나의 해석을 선택해 정치력과 정당 판세에 영향을 주는 방식으로 참여합니다.',
    conservative: event.stances.national,
    progressive: event.stances.youth,
    centrist: event.stances.center,
    discussionQuestions: [event.question, '내가 그 시대의 시민이었다면 어떤 선택을 했을까?'],
    tags: ['새공화국', '현대사', '정치게임', String(event.motifYear)],
  };
}

async function requireAdmin(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', '로그인 필요');
  const adminSnap = await db.doc(`admins/${req.auth.uid}`).get();
  if (!adminSnap.exists) throw new HttpsError('permission-denied', '관리자 전용');
  return req.auth.uid;
}
function publicEvent(event, archiveDay = event.day) {
  return { day: archiveDay, sourceDay: event.day, era: event.era, motifYear: event.motifYear, motif: event.motif, parodyTitle: event.parodyTitle, issueSummary: event.issueSummary, question: event.question, stances: event.stances, effects: event.effects || {} };
}
function renderSection(title, lines) {
  const body = (lines || []).map(line => `- ${clean(line, 260)}`).join('\n');
  return body ? `${title}\n${body}\n` : '';
}
function renderDesc(issue, event) {
  const lines = [
    `📜 ${clean(issue.brief, 90)}`, '', clean(issue.desc, 260), '',
    `🔎 실제 모티브: ${event.motifYear}년 · ${clean(event.motif, 160)}`, '',
    renderSection('🧭 시대 배경', issue.background), renderSection('🕰️ 전개 흐름', issue.timeline), renderSection('⚖️ 핵심 쟁점', issue.keyIssues),
    `📌 실제 역사에서 남긴 의미\n${clean(issue.actualResult, 700)}`, '',
    `🎮 게임화 포인트\n${clean(issue.gamePoint, 260)}`, '',
    `질문: ${clean(issue.question || event.question, 100)}`, '',
    `🛡️ 국민질서당: ${clean(issue.conservative || event.stances.national, 180)}`,
    `🕯️ 시민개혁당: ${clean(issue.progressive || event.stances.youth, 180)}`,
    `⚖️ 국민통합당: ${clean(issue.centrist || event.stances.center, 180)}`, '',
    renderSection('💬 토론 질문', issue.discussionQuestions),
    '※ 사건·제도·시대 흐름은 실제 한국 현대사를 모티브로 하지만, 게임 속 인물과 정당은 모두 가상입니다.',
  ];
  return lines.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n');
}

function archivePayload(issue, event, archiveDay, today, slot) {
  return {
    day: Number(archiveDay),
    sourceDay: event.day,
    generatedDate: today,
    slot: Number(slot || 0) + 1,
    era: event.era,
    motifYear: event.motifYear,
    motif: event.motif,
    title: clean(issue.title || event.parodyTitle, 100),
    parodyTitle: clean(issue.title || event.parodyTitle, 100),
    summary: clean(issue.desc || event.issueSummary, 260),
    issueSummary: clean(issue.desc || event.issueSummary, 260),
    question: clean(issue.question || event.question, 140),
    actualResult: clean(issue.actualResult, 700),
    tags: issue.tags || ['새공화국', '현대사', '정치게임'],
    stances: { national: clean(issue.conservative || event.stances.national, 220), youth: clean(issue.progressive || event.stances.youth, 220), center: clean(issue.centrist || event.stances.center, 220) },
    historyDetails: { background: issue.background || [], timeline: issue.timeline || [], keyIssues: issue.keyIssues || [], actualResult: clean(issue.actualResult, 700), gamePoint: clean(issue.gamePoint, 260), discussionQuestions: issue.discussionQuestions || [] },
    effects: event.effects || {},
    cumulative: true,
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  };
}

async function createHistoricalArchiveItem(issue, event, archiveDay, today, slot) {
  const ref = db.doc(`history_archive_items/${archiveDay}`);
  await ref.set(archivePayload(issue, event, archiveDay, today, slot), { merge: false });
  return ref.id;
}

async function createHistoricalFeedPost(issue, event, today, slot = 0, archiveDay = event.day) {
  const id = `history_${today}_${slotId(slot)}`;
  const ref = db.collection('feeds').doc(id);
  const now = FieldValue.serverTimestamp();
  const payload = {
    ...BOT_AUTHOR,
    type: 'citizen_speech', feedType: 'citizen_speech', subtype: 'history_parody', cat: 'multi',
    title: clean(issue.title || event.parodyTitle, 100), desc: renderDesc(issue, event), tags: issue.tags || ['새공화국', '현대사', '정치게임'], images: [], partyId: '',
    commentCount: 0, viewCount: 0, reactions: { total: 0 }, isParody: true, isAiGenerated: false, isHistoryIssue: true,
    historyDate: today, historySlot: Number(slot || 0) + 1, historyDay: Number(archiveDay), sourceHistoryDay: event.day, historyEra: event.era, motifYear: event.motifYear, motif: event.motif,
    eventQuestion: clean(issue.question || event.question, 100),
    historyDetails: { background: issue.background || [], timeline: issue.timeline || [], keyIssues: issue.keyIssues || [], actualResult: clean(issue.actualResult, 700), gamePoint: clean(issue.gamePoint, 260), discussionQuestions: issue.discussionQuestions || [] },
    partyStances: { national: clean(issue.conservative || event.stances.national, 180), youth: clean(issue.progressive || event.stances.youth, 180), center: clean(issue.centrist || event.stances.center, 180) },
    effects: event.effects || {}, createdAt: now, updatedAt: now,
  };
  await ref.set(payload, { merge: false });
  return ref.id;
}

async function nextArchiveStartDay(options) {
  if (options.day) return Math.max(1, Number(options.day));
  const metaRef = db.doc('history_sequence/meta');
  const metaSnap = await metaRef.get().catch(() => null);
  const lastDay = Number(metaSnap?.data()?.lastDay || 0);
  if (lastDay > 0) return lastDay + 1;
  const latest = await db.collection('history_archive_items').orderBy('day', 'desc').limit(1).get().catch(() => null);
  if (latest && !latest.empty) return Number(latest.docs[0].data().day || 0) + 1;
  return 1;
}

async function runGenerateDailyParodyIssues(options = {}) {
  const today = options.date || kstToday();
  const count = clampIssueCount(options.count);
  const startDay = await nextArchiveStartDay(options);
  const cacheRef = db.doc(`daily_history_issues/${today}`);
  const cacheSnap = await cacheRef.get();
  const cachedItems = Array.isArray(cacheSnap.data()?.items) ? cacheSnap.data().items : [];
  if (cacheSnap.exists && cacheSnap.data()?.done && cachedItems.length >= count && !options.force && !options.day) {
    return { skipped: true, date: today, count: cachedItems.length, items: cachedItems, cumulative: true };
  }
  const items = options.force || options.day ? [] : [...cachedItems];
  const existingSlots = new Set(items.map(item => Number(item.slot || 0)).filter(Boolean));
  for (let slot = 0; slot < count; slot += 1) {
    const publicSlot = slot + 1;
    if (!options.force && !options.day && existingSlots.has(publicSlot)) continue;
    const archiveDay = startDay + slot;
    const event = eventForArchiveDay(archiveDay);
    const issue = issueFromEvent(event, archiveDay);
    await createHistoricalArchiveItem(issue, event, archiveDay, today, slot);
    const postId = await createHistoricalFeedPost(issue, event, today, slot, archiveDay);
    items.push({ slot: publicSlot, postId, historyDay: archiveDay, sourceDay: event.day, motifYear: event.motifYear, motif: event.motif, title: clean(issue.title || event.parodyTitle, 100) });
  }
  items.sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0));
  const lastGeneratedDay = Math.max(...items.map(item => Number(item.historyDay || 0)), startDay + count - 1);
  await cacheRef.set({ done: items.length >= count, postId: items[0]?.postId || null, postIds: items.map(item => item.postId).filter(Boolean), items, count: items.length, targetCount: count, date: today, historyDay: items[0]?.historyDay || null, motifYear: items[0]?.motifYear || null, motif: items[0]?.motif || null, title: items[0]?.title || null, cumulative: true, anchor: HISTORY_SEQUENCE_ANCHOR, detailed: true, generatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await db.doc('history_sequence/meta').set({ lastDay: lastGeneratedDay, lastGeneratedDate: today, dailyCount: count, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { skipped: false, date: today, count: items.length, items, cumulative: true, detailed: true, startDay, lastDay: lastGeneratedDay };
}

exports.generateDailyParodyIssues = onSchedule(
  { schedule: '0 8 * * *', timeZone: 'Asia/Seoul', region: REGION, timeoutSeconds: 240, memory: '512MiB' },
  async () => { await runGenerateDailyParodyIssues({ count: DAILY_HISTORY_ISSUE_COUNT }); },
);

exports.previewHistoryIssue = onCall({ region: REGION, timeoutSeconds: 30 }, async req => {
  await requireAdmin(req);
  const date = req.data?.date || kstToday();
  const count = clampIssueCount(req.data?.count || DAILY_HISTORY_ISSUE_COUNT);
  const startDay = await nextArchiveStartDay({ day: req.data?.day });
  const events = Array.from({ length: count }, (_, slot) => publicEvent(eventForArchiveDay(startDay + slot), startDay + slot));
  const cacheSnap = await db.doc(`daily_history_issues/${date}`).get().catch(() => null);
  return { ok: true, date, count, startDay, event: events[0], events, cached: cacheSnap && cacheSnap.exists ? cacheSnap.data() : null, cumulative: true };
});

exports.triggerParodyIssues = onCall({ region: REGION, timeoutSeconds: 240, memory: '512MiB' }, async req => {
  await requireAdmin(req);
  const result = await runGenerateDailyParodyIssues({ force: !!req.data?.force, day: req.data?.day, date: req.data?.date, count: req.data?.count || DAILY_HISTORY_ISSUE_COUNT });
  return { ok: true, ...result };
});
