'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');

const db = getFirestore();
const REGION = 'asia-northeast3';
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const POST_PRESETS = [
  { preset: 'general', label: '모음방' },
  { preset: 'vote', label: '토론방' },
  { preset: 'drip', label: '드립방' },
  { preset: 'consult', label: '병맛상담' },
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
  const key = String(value || 'general').trim();
  if (['collect', 'collection', 'random_battle', 'relay', 'acrostic', 'naming'].includes(key)) return 'general';
  if (['ox', 'crazy_court'].includes(key)) return 'vote';
  if (['quiz', 'initial_game', 'advice'].includes(key)) return 'consult';
  return PRESET_META[key] ? key : 'general';
}

function feedTypeFromPreset(preset) {
  if (preset === 'vote' || preset === 'drip') return preset;
  return 'collect';
}

function subtypeFromPreset(preset) {
  return preset === 'general' ? 'collect' : preset;
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
  return raw.map(item => clean(typeof item === 'object' ? item.text : item, 80)).filter(Boolean).slice(0, 8);
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

const TYPE_PROMPTS = {
  general: '소소킹 모음방에 올릴 가벼운 생활형 게시글 1개를 JSON만 출력해. 필드: title, desc, tags. 댓글을 유도하는 자연스러운 문장 포함.',
  vote: '소소킹 토론방에 올릴 찬반/선택형 게시글 1개를 JSON만 출력해. 필드: title, desc, options, tags. options는 2~4개.',
  drip: '소소킹 드립방에 올릴 드립 주제 1개를 JSON만 출력해. 필드: topic, tags. 사람들이 한 줄 드립으로 답할 수 있는 짧은 상황.',
  consult: '소소킹 병맛상담에 올릴 작은 고민 1개를 JSON만 출력해. 필드: title, desc, topic, style, tags. 웃기지만 선을 지켜.',
};

function fallbackContent(preset, date) {
  const seed = Number(date.replace(/-/g, '')) || Date.now();
  const pick = list => list[seed % list.length];
  const map = {
    general: pick([
      { title: '오늘 하루 중 제일 소소하게 웃겼던 순간은?', desc: '거창한 일 아니어도 괜찮아요. 오늘 나를 피식 웃게 만든 장면 하나만 댓글로 남겨주세요.', tags: ['모음', '소소킹'] },
      { title: '요즘 나만 은근히 빠진 작은 취미 있어?', desc: '남들은 별거 아니라고 해도 계속 하게 되는 소소한 취미를 공유해봐요.', tags: ['취미', '소소킹'] },
    ]),
    vote: pick([
      { title: '지금 당장 먹고 싶은 야식은?', desc: '딱 하나만 고를 수 있다면 오늘 밤 메뉴는 무엇인가요?', options: ['치킨', '라면', '피자', '만두'], tags: ['투표', '야식'] },
      { title: '주말 아침, 몇 시 기상이 제일 행복할까?', desc: '쉬는 날 아침 기준으로 가장 마음 편한 기상 시간을 골라주세요.', options: ['7시 이전', '9~10시', '11시쯤', '점심 이후'], tags: ['투표', '주말'] },
    ]),
    drip: pick([
      { topic: '퇴근 5분 전에 회의 잡힌 사람의 한마디는?', tags: ['드립', '직장인'] },
      { topic: '배달 예상시간이 계속 늘어날 때 떠오르는 한 줄은?', tags: ['드립', '배달'] },
    ]),
    consult: pick([
      { title: '이거 제가 예민한 건가요?', desc: '분명 별일 아닌 것 같은데 괜히 신경 쓰입니다. 공감, 현실조언, 웃긴 해결책 아무거나 던져주세요.', topic: 'daily', style: 'funny', tags: ['병맛상담', '고민'] },
      { title: '살까 말까 장바구니가 저를 부릅니다', desc: '며칠째 장바구니에서 손짓하는 물건이 있습니다. 사도 되는지 말려야 하는지 소소판정 부탁합니다.', topic: 'money', style: 'choice', tags: ['병맛상담', '선택'] },
    ]),
  };
  return map[preset] || map.general;
}

function buildDoc(preset, content, date, source) {
  const meta = PRESET_META[preset] || PRESET_META.general;
  const doc = {
    type: 'multi',
    cat: 'multi',
    subtype: subtypeFromPreset(preset),
    feedType: feedTypeFromPreset(preset),
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
    aiPreset: preset,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (preset === 'vote') {
    const options = optionTexts(content.options, ['찬성', '반대']);
    doc.modules.vote = { enabled: true, question: doc.desc, options: options.map(text => ({ text, votes: 0 })) };
  }
  if (preset === 'drip') {
    const topic = clean(content.topic || content.prompt || doc.desc || doc.title, 80) || '오늘의 한 줄 드립은?';
    doc.title = '오늘의 드립 주제';
    doc.desc = topic;
    doc.modules.drip = { enabled: true, prompt: topic, maxLength: 50, responseLabel: '한 줄 드립' };
  }
  if (preset === 'consult') {
    const topic = clean(content.topic || 'daily', 40);
    const style = clean(content.style || 'funny', 40);
    doc.modules.consult = {
      enabled: true,
      topic,
      topicLabel: ({ daily: '일상', people: '관계', work: '직장/학교', money: '소비/선택', vent: '하소연' })[topic] || '일상',
      style,
      styleLabel: ({ empathy: '공감', realistic: '현실조언', choice: '선택도움', soft: '순한맛', funny: '웃긴해결' })[style] || '웃긴해결',
      question: doc.desc,
    };
  }
  return { mainDoc: doc, secretDoc: null };
}

async function generateOnePreset({ preset = 'general', force = true, actorId = 'admin', usageKind = 'manual_content' }) {
  const normalizedPreset = normalizePreset(preset);
  const date = todayKST();
  if (!force) {
    const markerRef = db.doc(`system_jobs/ai_content_${date}_${normalizedPreset}`);
    const markerSnap = await markerRef.get();
    if (markerSnap.exists) return { skipped: true, preset: normalizedPreset, reason: 'already-generated' };
  }

  let content = fallbackContent(normalizedPreset, date);
  let source = 'fallback';
  const apiKey = ANTHROPIC_API_KEY.value();
  const usage = apiKey ? await reserveUsage(usageKind) : { ok: false, reason: 'no-key' };

  if (apiKey && usage.ok) {
    try {
      const anthropic = new Anthropic({ apiKey });
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 900,
        messages: [{ role: 'user', content: TYPE_PROMPTS[normalizedPreset] || TYPE_PROMPTS.general }],
      });
      const parsed = parseJson(msg.content.filter(block => block.type === 'text').map(block => block.text).join(''));
      if (parsed) { content = parsed; source = 'ai'; }
    } catch (error) {
      console.error(`[ai-content] fallback for ${normalizedPreset}`, error);
    }
  }

  const { mainDoc, secretDoc } = buildDoc(normalizedPreset, content, date, source);
  const feedRef = db.collection('feeds').doc();
  await Promise.all([
    feedRef.set(mainDoc),
    secretDoc ? feedRef.collection('secret').doc('answer').set(secretDoc) : null,
  ].filter(Boolean));

  await db.doc(`system_jobs/ai_content_manual_${date}_${feedRef.id}`).set({
    date, preset: normalizedPreset, docId: feedRef.id, source, actorId, usageKind,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true, preset: normalizedPreset, typeLabel: mainDoc.typeLabel, docId: feedRef.id, title: mainDoc.title, source };
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
