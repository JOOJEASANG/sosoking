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

async function loadRecentTitles(limit = 20) {
  try {
    const snap = await db.collection('feeds').orderBy('createdAt', 'desc').limit(limit).get();
    return snap.docs.map(doc => clean(doc.data().title, 80)).filter(Boolean);
  } catch {
    return [];
  }
}

const TYPE_PROMPTS = {
  general: '소소킹 모음방에 올릴 가벼운 생활형 게시글 1개를 JSON만 출력해. 필드: title, desc, tags. 댓글을 유도하는 자연스러운 문장 포함.',
  vote: '소소킹 토론방에 올릴 찬반/선택형 게시글 1개를 JSON만 출력해. 필드: title, desc, options, tags. options는 2~4개.',
  drip: '소소킹 드립방에 올릴 드립 주제 1개를 JSON만 출력해. 필드: topic, tags. 사람들이 한 줄 드립으로 답할 수 있는 짧은 상황.',
  consult: '소소킹 병맛상담에 올릴 작은 고민 1개를 JSON만 출력해. 필드: title, desc, topic, style, tags. 웃기지만 선을 지켜.',
};

function fallbackContent(preset) {
  const map = {
    general: [
      { title: '오늘 하루 중 제일 소소하게 웃겼던 순간은?', desc: '거창한 일 아니어도 괜찮아요. 오늘 나를 피식 웃게 만든 장면 하나만 댓글로 남겨주세요.', tags: ['모음', '소소킹'] },
      { title: '요즘 나만 은근히 빠진 작은 취미 있어?', desc: '남들은 별거 아니라고 해도 계속 하게 되는 소소한 취미를 공유해봐요.', tags: ['취미', '소소킹'] },
      { title: '생각보다 오래 쓰고 있는 물건 있어?', desc: '별 기대 없이 샀는데 은근히 오래 쓰는 물건을 공유해봐요.', tags: ['생활', '공유'] },
      { title: '오늘 나를 살짝 당황시킨 순간은?', desc: '크게 문제는 아닌데 순간 멈칫했던 소소한 일을 댓글로 남겨주세요.', tags: ['일상', '공감'] },
      { title: '남들은 모르는데 나만 편한 습관 있어?', desc: '이상해 보여도 나한테는 편한 작은 습관이 있다면 알려주세요.', tags: ['습관', '일상'] },
    ],
    vote: [
      { title: '지금 당장 먹고 싶은 야식은?', desc: '딱 하나만 고를 수 있다면 오늘 밤 메뉴는 무엇인가요?', options: ['치킨', '라면', '피자', '만두'], tags: ['투표', '야식'] },
      { title: '주말 아침, 몇 시 기상이 제일 행복할까?', desc: '쉬는 날 아침 기준으로 가장 마음 편한 기상 시간을 골라주세요.', options: ['7시 이전', '9~10시', '11시쯤', '점심 이후'], tags: ['투표', '주말'] },
      { title: '카톡 답장 빠른 사람 vs 천천히 하는 사람', desc: '여러분은 어느 쪽이 더 편한가요?', options: ['빠른 답장', '천천히 답장'], tags: ['투표', '관계'] },
      { title: '점심 메뉴 고를 때 제일 중요한 기준은?', desc: '가격, 맛, 속도, 양 중 하나만 고른다면?', options: ['가격', '맛', '속도', '양'], tags: ['투표', '점심'] },
      { title: '쉬는 날 밖에 나가기 vs 집에서 쉬기', desc: '완전히 자유로운 하루가 생기면 어느 쪽인가요?', options: ['밖에 나가기', '집에서 쉬기'], tags: ['투표', '휴식'] },
    ],
    drip: [
      { topic: '퇴근 5분 전에 회의 잡힌 사람의 한마디는?', tags: ['드립', '직장인'] },
      { topic: '배달 예상시간이 계속 늘어날 때 떠오르는 한 줄은?', tags: ['드립', '배달'] },
      { topic: '월요일 아침 알람을 본 내 영혼에게 이름을 붙인다면?', tags: ['드립', '월요일'] },
      { topic: '냉장고를 열었는데 먹을 게 없을 때 나오는 한마디는?', tags: ['드립', '일상'] },
      { topic: '카드값 알림을 본 사람의 첫 반응은?', tags: ['드립', '월급'] },
    ],
    consult: [
      { title: '이거 제가 예민한 건가요?', desc: '분명 별일 아닌 것 같은데 괜히 신경 쓰입니다. 공감, 현실조언, 웃긴 해결책 아무거나 던져주세요.', topic: 'daily', style: 'funny', tags: ['병맛상담', '고민'] },
      { title: '살까 말까 장바구니가 저를 부릅니다', desc: '며칠째 장바구니에서 손짓하는 물건이 있습니다. 사도 되는지 말려야 하는지 소소판정 부탁합니다.', topic: 'money', style: 'choice', tags: ['병맛상담', '선택'] },
      { title: '친구 답장을 기다리는 제가 너무 진지한가요?', desc: '별말 아닌 대화였는데 답장이 없으니 괜히 신경 쓰입니다. 어떻게 넘기면 좋을까요?', topic: 'people', style: 'empathy', tags: ['상담', '관계'] },
      { title: '하기 싫은 일을 미루는 저를 설득해주세요', desc: '해야 하는 건 아는데 몸이 안 움직입니다. 현실조언도 좋고 웃긴 처방도 좋습니다.', topic: 'work', style: 'funny', tags: ['상담', '미루기'] },
      { title: '소소한 소비를 합리화하고 싶습니다', desc: '큰돈은 아닌데 자꾸 고민됩니다. 사도 되는 이유와 말려야 하는 이유를 같이 듣고 싶어요.', topic: 'money', style: 'choice', tags: ['상담', '소비'] },
    ],
  };
  return pickRandom(map[preset] || map.general);
}

function buildDoc(preset, content, date, source, runSeed) {
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
    aiRunSeed: runSeed,
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
      const prompt = `${TYPE_PROMPTS[normalizedPreset] || TYPE_PROMPTS.general}\n\n중복 방지 규칙:\n- 아래 최근 제목과 같은 소재, 같은 제목, 같은 상황을 절대 쓰지 마.\n- 매번 새로운 생활 상황, 새로운 질문, 새로운 표현을 써.\n- 랜덤 시드: ${runSeed}\n- 오늘 날짜: ${date}\n최근 제목: ${recentTitles.length ? recentTitles.join(' / ') : '없음'}`;
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
