'use strict';

const { randomInt } = require('crypto');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');

const db = getFirestore();
const REGION = 'asia-northeast3';
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const POST_PRESETS = [
  { preset: 'vote', label: '토론' },
  { preset: 'drip', label: '드립' },
];
const PRESET_META = Object.fromEntries(POST_PRESETS.map(item => [item.preset, item]));
const SCHEDULED_PRESETS = POST_PRESETS.map(item => item.preset);

function todayKST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function kstHour() {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', hour: '2-digit', hour12: false,
  }).format(new Date())) || 0;
}

function scheduledSlot() {
  const hour = kstHour();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function makeRunSeed() {
  return `${Date.now()}-${randomInt(100000, 999999)}`;
}

function pickRandom(list) {
  return list[randomInt(0, list.length)];
}

function clean(value, max = 500) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanMultiline(value, max = 1200) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, max);
}

function parseJson(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(raw); } catch {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function normalizePreset(value) {
  const key = String(value || 'drip').trim();
  if (key === 'vote' || key === 'ox' || key === 'debate' || key === 'discussion' || key === 'court' || key === 'judgment') return 'vote';
  if (key === 'drip' || key === 'naming' || key === 'translation' || key === 'translate' || key === 'quiz' || key === 'advice') return 'drip';
  return PRESET_META[key] ? key : 'drip';
}

function toTags(value, fallback = []) {
  const arr = Array.isArray(value) ? value : [];
  return [...arr, ...fallback]
    .map(tag => clean(tag, 20).replace(/^#/, ''))
    .filter(Boolean)
    .filter((tag, index, self) => self.indexOf(tag) === index)
    .slice(0, 8);
}

function optionTexts(value, fallback = []) {
  const raw = Array.isArray(value) ? value : fallback;
  return raw.map(item => clean(typeof item === 'object' ? item.text : item, 80)).filter(Boolean).slice(0, 4);
}

let _settingsCache = null;
let _settingsCacheAt = 0;
const SETTINGS_TTL = 5 * 60 * 1000;

async function settings() {
  const now = Date.now();
  if (_settingsCache && now - _settingsCacheAt < SETTINGS_TTL) return _settingsCache;
  const snap = await db.doc('site_settings/config').get().catch(() => null);
  const data = snap?.exists ? snap.data() || {} : {};
  _settingsCache = {
    aiAutoContentEnabled: data.aiAutoContentEnabled !== false,
    aiDailyLimit: Math.max(0, Number(data.aiDailyLimit ?? 20)),
  };
  _settingsCacheAt = now;
  return _settingsCache;
}

async function reserveUsage(kind) {
  const current = await settings();
  if (!current.aiAutoContentEnabled) return { ok: false, reason: 'disabled' };
  if (current.aiDailyLimit <= 0) return { ok: false, reason: 'limit-zero' };
  const date = todayKST();
  const ref = db.doc(`ai_usage/${date}`);
  let ok = false;
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const used = Number(snap.exists ? snap.data().total || 0 : 0);
    if (used >= current.aiDailyLimit) return;
    ok = true;
    tx.set(ref, {
      date,
      total: FieldValue.increment(1),
      [kind]: FieldValue.increment(1),
      limit: current.aiDailyLimit,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  return { ok, reason: ok ? 'reserved' : 'daily-limit-reached' };
}

async function assertAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
}

async function loadRecentTitles(limit = 20) {
  try {
    const snap = await db.collection('feeds').orderBy('createdAt', 'desc').limit(limit).get();
    return snap.docs.map(doc => clean(doc.data().title, 80)).filter(Boolean);
  } catch {
    return [];
  }
}

const TYPE_PROMPTS = {
  vote: '소소킹 토론에 올릴 웃긴 VS 게시글 1개를 JSON만 출력해. 필드: title, desc, options, tags. options는 2개만. 가볍고 댓글 달고 싶게.',
  drip: '소소킹 드립에 올릴 드립 주제 1개를 JSON만 출력해. 필드: topic, tags. 작명, 이상한 번역, 핑계, 근황, 한 줄 반응 중 하나로 답하기 좋은 짧은 상황.',
};

function fallbackContent(preset) {
  const map = {
    vote: [
      { title: '배달비 4천원이면 시킨다 VS 참는다', desc: '메뉴보다 배달비가 더 크게 느껴지는 순간입니다. 이건 행복 비용일까요, 지갑 배신일까요?', options: ['시킨다', '참는다'], tags: ['토론', '배달비'] },
      { title: '카톡 답장 빠른 사람 VS 천천히 하는 사람', desc: '여러분은 어느 쪽이 더 편한가요?', options: ['빠른 답장', '천천히 답장'], tags: ['토론', '관계'] },
      { title: '쉬는 날 외출 VS 집콕', desc: '완전히 자유로운 하루가 생기면 어느 쪽인가요?', options: ['외출', '집콕'], tags: ['토론', '휴식'] },
      { title: '아침형 인간 VS 밤형 인간', desc: '하루 효율은 어느 쪽이 더 낫다고 보나요?', options: ['아침형', '밤형'], tags: ['토론', '생활'] },
    ],
    drip: [
      { topic: '퇴근 5분 전에 회의 잡힌 사람의 한마디는?', tags: ['드립', '직장인'] },
      { topic: '배달 예상시간이 계속 늘어날 때 떠오르는 한 줄은?', tags: ['드립', '배달'] },
      { topic: '월요일 아침 알람을 본 내 영혼에게 이름을 붙인다면?', tags: ['드립', '월요일'] },
      { topic: '냉장고를 열었는데 먹을 게 없을 때 나오는 한마디는?', tags: ['드립', '일상'] },
      { topic: '카드값 알림을 본 사람의 첫 반응은?', tags: ['드립', '월급'] },
    ],
  };
  return pickRandom(map[preset] || map.drip);
}

function buildDoc(preset, content, date, source, runSeed) {
  const normalized = normalizePreset(preset);
  const meta = PRESET_META[normalized] || PRESET_META.drip;
  const doc = {
    type: 'multi',
    cat: 'multi',
    subtype: normalized,
    feedType: normalized,
    typeLabel: meta.label,
    title: clean(content.title || `${meta.label} AI 글`, 100),
    desc: cleanMultiline(content.desc || content.topic || '', 1200),
    tags: toTags(content.tags, [meta.label, '소소킹']),
    images: [],
    modules: { comments: { enabled: true } },
    deadline: { enabled: false, mode: 'none', status: 'open' },
    anonymous: false,
    anonymousMode: '',
    authorId: 'sosoking-ai',
    authorName: source === 'ai' ? '소소킹AI 🤖' : '소소킹 운영봇',
    authorPhoto: '',
    authorEmail: '',
    reactions: { total: 0 },
    commentCount: 0,
    viewCount: 0,
    pointsScore: 0,
    isAiGenerated: true,
    aiGeneratedDate: date,
    aiSource: source,
    aiPreset: normalized,
    aiRunSeed: runSeed,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (normalized === 'vote') {
    const options = optionTexts(content.options, ['왼쪽', '오른쪽']).slice(0, 2);
    doc.modules.vote = { enabled: true, question: doc.desc, options: options.map(text => ({ text, votes: 0 })) };
  } else {
    const topic = clean(content.topic || content.prompt || doc.desc || doc.title, 80) || '오늘의 한 줄 드립은?';
    doc.title = clean(content.title || '오늘의 드립 주제', 100);
    doc.desc = topic;
    doc.modules.drip = { enabled: true, prompt: topic, maxLength: 50, responseLabel: '한 줄 드립' };
  }
  return { mainDoc: doc, secretDoc: null };
}

async function generateOnePreset({ preset = 'drip', force = true, actorId = 'admin', usageKind = 'manual_content' }) {
  const normalizedPreset = normalizePreset(preset);
  const date = todayKST();
  const runSeed = makeRunSeed();

  if (!force) {
    const markerRef = db.doc(`system_jobs/ai_content_${date}_${normalizedPreset}`);
    const markerSnap = await markerRef.get();
    if (markerSnap.exists) return { skipped: true, preset: normalizedPreset, reason: 'already-generated' };
  }

  let content = fallbackContent(normalizedPreset);
  let source = 'fallback';
  const apiKey = ANTHROPIC_API_KEY.value();
  const usage = apiKey ? await reserveUsage(usageKind) : { ok: false, reason: 'no-key' };

  if (apiKey && usage.ok) {
    try {
      const recentTitles = await loadRecentTitles(20);
      const prompt = `${TYPE_PROMPTS[normalizedPreset] || TYPE_PROMPTS.drip}\n\n중복 방지 규칙:\n- 아래 최근 제목과 같은 소재, 같은 제목, 같은 상황을 쓰지 마.\n- 매번 새로운 생활 상황, 새로운 질문, 새로운 표현을 써.\n- 랜덤 시드: ${runSeed}\n- 오늘 날짜: ${date}\n최근 제목: ${recentTitles.length ? recentTitles.join(' / ') : '없음'}`;
      const anthropic = new Anthropic({ apiKey });
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 900,
        temperature: 0.9,
        messages: [{ role: 'user', content: prompt }],
      });
      const parsed = parseJson(msg.content.filter(block => block.type === 'text').map(block => block.text).join(''));
      if (parsed) { content = parsed; source = 'ai'; }
    } catch (error) {
      console.error(`[ai-content] fallback for ${normalizedPreset}`, error);
    }
  }

  const { mainDoc, secretDoc } = buildDoc(normalizedPreset, content, date, source, runSeed);
  const feedRef = db.collection('feeds').doc();
  await Promise.all([
    feedRef.set(mainDoc),
    secretDoc ? feedRef.collection('secret').doc('answer').set(secretDoc) : null,
  ].filter(Boolean));

  await db.doc(`system_jobs/ai_content_manual_${date}_${feedRef.id}`).set({
    date, preset: normalizedPreset, docId: feedRef.id, source, actorId, usageKind, runSeed, usageReason: usage.reason || '',
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true, preset: normalizedPreset, typeLabel: mainDoc.typeLabel, docId: feedRef.id, title: mainDoc.title, source, runSeed };
}

async function generateAllAiContent({ force = true, actorId = 'admin' } = {}) {
  const results = [];
  for (const { preset } of POST_PRESETS) {
    try { results.push(await generateOnePreset({ preset, force, actorId })); }
    catch (error) { results.push({ error: true, preset, message: error.message }); }
  }
  return { results, total: results.length, ok: results.filter(result => result.ok).length, skipped: results.filter(result => result.skipped).length };
}

exports.dailyAiContent = onSchedule({
  schedule: '0 9,14,20 * * *', timeZone: 'Asia/Seoul', region: REGION, memory: '256MiB', timeoutSeconds: 120,
  secrets: [ANTHROPIC_API_KEY],
}, async () => {
  const date = todayKST();
  const slot = scheduledSlot();
  const markerRef = db.doc(`system_jobs/ai_content_auto_${date}_${slot}`);
  const markerSnap = await markerRef.get();
  if (markerSnap.exists) return null;

  const seed = Number(String(date || '').replace(/-/g, '')) || 0;
  const slotIndex = { morning: 0, afternoon: 1, evening: 2 }[slot] || 0;
  const preset = SCHEDULED_PRESETS[(seed + slotIndex) % SCHEDULED_PRESETS.length];
  const result = await generateOnePreset({ preset, force: true, actorId: `scheduler-${slot}`, usageKind: 'auto_content' });
  await markerRef.set({ date, slot, preset, result, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  return result;
});

exports.generateAiContentNow = onCall({ region: REGION, timeoutSeconds: 120, secrets: [ANTHROPIC_API_KEY] }, async request => {
  await assertAdmin(request.auth && request.auth.uid);
  const preset = normalizePreset(request.data && (request.data.preset || request.data.type));
  return generateOnePreset({ preset, force: true, actorId: request.auth.uid });
});

exports.generateAllAiContentNow = onCall({ region: REGION, timeoutSeconds: 540, memory: '512MiB', secrets: [ANTHROPIC_API_KEY] }, async request => {
  await assertAdmin(request.auth && request.auth.uid);
  return generateAllAiContent({ force: true, actorId: request.auth.uid });
});
