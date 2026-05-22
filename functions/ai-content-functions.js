'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');

const db = getFirestore();
const REGION = 'asia-northeast3';

// 현재 실제 글쓰기 화면(multi-write)의 공개 프리셋만 사용합니다.
const POST_PRESETS = [
  { preset: 'general', label: '일반글' },
  { preset: 'vote', label: '투표/판정' },
  { preset: 'naming', label: '미친작명소' },
  { preset: 'acrostic', label: '삼행시' },
  { preset: 'relay', label: '막장릴레이' },
  { preset: 'quiz', label: '미친퀴즈' },
];

const PRESET_META = Object.fromEntries(POST_PRESETS.map(item => [item.preset, item]));

function todayKST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
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
  if (key === 'ox' || key === 'crazy_court') return 'vote';
  if (key === 'initial_game') return 'quiz';
  if (key === 'random_battle' || key === 'drip') return 'general';
  return PRESET_META[key] ? key : 'general';
}

function feedTypeFromPreset(preset) {
  return ['vote', 'naming', 'acrostic', 'relay', 'quiz'].includes(preset) ? preset : 'general';
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
  return raw
    .map(item => clean(typeof item === 'object' ? item.text : item, 80))
    .filter(Boolean)
    .slice(0, 8);
}

let _settingsCache = null;
let _settingsCacheAt = 0;
const SETTINGS_TTL = 5 * 60 * 1000;

async function settings() {
  const now = Date.now();
  if (_settingsCache && now - _settingsCacheAt < SETTINGS_TTL) return _settingsCache;
  const snap = await db.doc('site_settings/config').get();
  const data = snap.exists ? snap.data() || {} : {};
  _settingsCache = {
    aiAutoContentEnabled: data.aiAutoContentEnabled !== false,
    aiDailyLimit: Math.max(0, Number(data.aiDailyLimit ?? 20)),
  };
  _settingsCacheAt = now;
  return _settingsCache;
}

async function reserveUsage(kind) {
  const current = await settings();
  if (!current.aiAutoContentEnabled && kind === 'manual_content') return { ok: false, reason: 'disabled' };
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
  general: `너는 소소킹 커뮤니티 운영자야. 사용자가 댓글로 가볍게 반응할 수 있는 일반 피드 글 1개를 만들어줘.
주제는 일상, 직장, 음식, 관계, 취미 중 하나로 하고 너무 광고처럼 보이면 안 돼.
반드시 JSON만 출력해:
{"title":"제목 50자 이내","desc":"본문 2~4문장. 댓글을 유도하는 자연스러운 문장 포함","tags":["일상","소소킹"]}`,

  vote: `너는 소소킹 커뮤니티 운영자야. 현재 글쓰기 유형 '투표/판정'에 맞는 게시글 1개를 만들어줘.
상황을 제시하고 선택지에 투표하도록 만들어. 선택지는 2~4개.
반드시 JSON만 출력해:
{"title":"투표/판정 제목 50자 이내","desc":"투표할 상황 설명 1~3문장","options":["선택지1","선택지2","선택지3"],"tags":["투표","판정","소소킹"]}`,

  naming: `너는 소소킹 커뮤니티 운영자야. 현재 글쓰기 유형 '미친작명소'에 맞는 게시글 1개를 만들어줘.
사람들이 댓글로 웃긴 이름을 붙이고 싶어지는 상황이어야 해.
반드시 JSON만 출력해:
{"title":"작명 대상이 명확한 제목 60자 이내","desc":"무엇에 이름을 붙이면 되는지 설명 1~3문장","charCount":0,"tags":["미친작명소","작명","소소킹"]}`,

  acrostic: `너는 소소킹 커뮤니티 운영자야. 현재 글쓰기 유형 '삼행시'에 맞는 게시글 1개를 만들어줘.
2~4글자의 한국어 제시어를 하나 고르고, 사람들이 각 글자로 시작하는 문장을 댓글로 쓰게 유도해.
반드시 JSON만 출력해:
{"title":"삼행시 도전 제목 50자 이내","keyword":"2~4글자 제시어","desc":"참여 유도 설명 1~3문장","tags":["삼행시","제시어","소소킹"]}`,

  relay: `너는 소소킹 커뮤니티 운영자야. 현재 글쓰기 유형 '막장릴레이'에 맞는 게시글 1개를 만들어줘.
댓글로 한 문장씩 이어 쓰고 싶어지는 시작 문장과 상황을 만들어.
반드시 JSON만 출력해:
{"title":"릴레이 제목 50자 이내","desc":"참여 유도 설명 1~2문장","startSentence":"릴레이 첫 문장 120자 이내","tags":["막장릴레이","이어쓰기","소소킹"]}`,

  quiz: `너는 소소킹 커뮤니티 운영자야. 현재 글쓰기 유형 '미친퀴즈'에 맞는 객관식 퀴즈 게시글 1개를 만들어줘.
정답이 너무 논쟁적이지 않은 생활상식, 음식, 역사, 과학, 문화 주제로 만들어. 선택지는 4개.
반드시 JSON만 출력해:
{"title":"퀴즈 제목 50자 이내","desc":"문제 본문","options":["선택지1","선택지2","선택지3","선택지4"],"answerIdx":0,"hint":"힌트 50자 이내","explanation":"정답 해설 1~2문장","tags":["미친퀴즈","퀴즈","소소킹"]}`,
};

function fallbackContent(preset, date) {
  const seed = Number(date.replace(/-/g, '')) || Date.now();
  const pick = list => list[seed % list.length];

  return {
    general: pick([
      { title: '오늘 하루 중 제일 소소하게 웃겼던 순간은?', desc: '거창한 일 아니어도 괜찮아요. 오늘 나를 피식 웃게 만든 장면 하나만 댓글로 남겨주세요.', tags: ['일상', '소소킹'] },
      { title: '요즘 나만 은근히 빠진 작은 취미 있어?', desc: '남들은 별거 아니라고 해도 계속 하게 되는 소소한 취미를 공유해봐요.', tags: ['취미', '소소킹'] },
    ]),
    vote: pick([
      { title: '지금 당장 먹고 싶은 야식은?', desc: '딱 하나만 고를 수 있다면 오늘 밤 메뉴는 무엇인가요? 댓글로 이유도 남겨주세요.', options: ['🍗 치킨', '🍜 라면', '🍕 피자', '🥟 만두'], tags: ['투표', '야식', '소소킹'] },
      { title: '주말 아침, 몇 시 기상이 제일 행복할까?', desc: '쉬는 날 아침 기준으로 가장 마음 편한 기상 시간을 골라주세요.', options: ['7시 이전', '9~10시', '11시쯤', '점심 이후'], tags: ['투표', '주말', '소소킹'] },
    ]),
    naming: pick([
      { title: '퇴근 5분 전에 들어오는 급한 업무 지시 이름 좀 지어줘', desc: '분명 퇴근 준비 중이었는데 갑자기 떨어지는 그 업무. 이 상황에 딱 맞는 이름을 댓글로 지어주세요.', charCount: 0, tags: ['미친작명소', '직장인', '소소킹'] },
      { title: '배달 30분 예정인데 1시간 넘게 기다리는 시간 이름은?', desc: '배는 고프고 지도는 그대로인 그 애매한 기다림. 찰진 이름을 붙여주세요.', charCount: 0, tags: ['미친작명소', '배달', '소소킹'] },
    ]),
    acrostic: pick([
      { title: "'월요일' 삼행시 도전!", keyword: '월요일', desc: "'월요일' 각 글자로 시작하는 삼행시를 댓글로 남겨주세요. 제일 공감되는 삼행시가 오늘의 승자입니다.", tags: ['삼행시', '월요일', '소소킹'] },
      { title: "'퇴근길' 삼행시 도전!", keyword: '퇴근길', desc: "퇴근길의 기분을 담아 각 글자로 시작하는 한 줄씩 완성해보세요.", tags: ['삼행시', '퇴근길', '소소킹'] },
    ]),
    relay: pick([
      { title: '막장릴레이: 수상한 택배가 왔다', desc: '댓글로 한 문장씩 이어서 이야기를 완성해보세요. 어디로 흘러갈지는 아무도 몰라요.', startSentence: '현관문 앞에는 보낸 사람도 받는 사람도 적히지 않은 작은 상자가 놓여 있었다.', tags: ['막장릴레이', '이어쓰기', '소소킹'] },
      { title: '막장릴레이: 엘리베이터에 같이 탄 사람', desc: '다음 이야기를 댓글로 이어주세요. 가장 흥미로운 방향으로 몰고 가는 사람이 주인공입니다.', startSentence: '엘리베이터 문이 닫히자 옆 사람이 작은 봉투를 내밀며 말했다. “이걸 꼭 읽어야 해요.”', tags: ['막장릴레이', '소설', '소소킹'] },
    ]),
    quiz: pick([
      { title: '오늘의 미친퀴즈 🧠', desc: '다음 중 일반적으로 냉장 보관하지 않는 것이 더 좋은 식재료는?', options: ['토마토', '우유', '생선', '두부'], answerIdx: 0, hint: '맛과 식감이 중요해요.', explanation: '토마토는 냉장 보관 시 향과 식감이 떨어질 수 있어 상온 보관이 권장되는 경우가 많습니다.', tags: ['미친퀴즈', '생활상식', '소소킹'] },
      { title: '오늘의 미친퀴즈 🧠', desc: '한국어 맞춤법에서 “며칠”의 올바른 표기는 무엇일까요?', options: ['며칠', '몇일', '몇 일', '며 일'], answerIdx: 0, hint: '소리 나는 대로 굳어진 표준어입니다.', explanation: '표준어는 “며칠”입니다. “몇일”은 표준 표기가 아닙니다.', tags: ['미친퀴즈', '맞춤법', '소소킹'] },
    ]),
  }[preset] || { title: '오늘의 소소 이야기', desc: '가볍게 댓글로 이야기 나눠봐요.', tags: ['소소킹'] };
}

function baseDoc({ preset, content, date, source }) {
  const meta = PRESET_META[preset] || PRESET_META.general;
  return {
    type: 'multi',
    cat: 'multi',
    subtype: preset,
    feedType: feedTypeFromPreset(preset),
    typeLabel: meta.label,
    title: clean(content.title || `${meta.label} AI 글`, 100),
    desc: cleanMultiline(content.desc || '', 1200),
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
}

function buildDoc(preset, content, date, source) {
  const doc = baseDoc({ preset, content, date, source });
  let secretDoc = null;

  if (preset === 'vote') {
    const options = optionTexts(content.options, ['찬성', '반대']).slice(0, 8);
    doc.modules.vote = {
      enabled: true,
      question: doc.desc,
      options: options.map(text => ({ text, votes: 0 })),
    };
  }

  if (preset === 'naming') {
    doc.modules.naming = {
      enabled: true,
      charCount: Math.max(0, Math.min(12, Number(content.charCount || 0))),
    };
  }

  if (preset === 'acrostic') {
    const keyword = clean(content.keyword, 12) || '소소킹';
    doc.title = clean(content.title || `'${keyword}' 삼행시 도전!`, 100);
    doc.modules.acrostic = { enabled: true, keyword };
  }

  if (preset === 'relay') {
    const startSentence = cleanMultiline(content.startSentence || content.start || doc.desc, 300);
    doc.desc = startSentence || doc.desc;
    doc.modules.relay = {
      enabled: true,
      startSentence: doc.desc,
      mission: { enabled: false, key: 'none' },
    };
  }

  if (preset === 'quiz') {
    const options = optionTexts(content.options, ['정답 후보 1', '정답 후보 2', '정답 후보 3', '정답 후보 4']).slice(0, 6);
    const safeOptions = options.length >= 2 ? options : ['맞다', '아니다'];
    const answerIdx = Math.max(0, Math.min(Number(content.answerIdx || content.correctIndex || 0), safeOptions.length - 1));
    const answer = clean(content.answer || safeOptions[answerIdx], 120);
    doc.modules.quiz = {
      enabled: true,
      mode: 'multiple',
      question: doc.desc,
      options: safeOptions.map(text => ({ text })),
      hint: clean(content.hint, 100),
    };
    secretDoc = {
      quizMode: 'multiple',
      mode: 'multiple',
      answer,
      answerIdx,
      correctIndex: answerIdx,
      explanation: clean(content.explanation, 500),
      correctCount: 0,
      firstCorrect: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
  }

  return { mainDoc: doc, secretDoc };
}

async function generateOnePreset({ preset = 'general', force = true, actorId = 'admin' }) {
  const normalizedPreset = normalizePreset(preset);
  const date = todayKST();

  if (!force) {
    const markerRef = db.doc(`system_jobs/ai_content_${date}_${normalizedPreset}`);
    const markerSnap = await markerRef.get();
    if (markerSnap.exists) return { skipped: true, preset: normalizedPreset, reason: 'already-generated' };
  }

  let content = fallbackContent(normalizedPreset, date);
  let source = 'fallback';
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const usage = apiKey ? await reserveUsage('manual_content') : { ok: false, reason: 'no-key' };

  if (apiKey && usage.ok) {
    try {
      const anthropic = new Anthropic({ apiKey });
      const prompt = TYPE_PROMPTS[normalizedPreset];
      if (prompt) {
        const msg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 900,
          messages: [{ role: 'user', content: prompt }],
        });
        const parsed = parseJson(msg.content.filter(block => block.type === 'text').map(block => block.text).join(''));
        if (parsed) {
          content = parsed;
          source = 'ai';
        }
      }
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
    date,
    preset: normalizedPreset,
    docId: feedRef.id,
    source,
    actorId,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    ok: true,
    preset: normalizedPreset,
    typeLabel: mainDoc.typeLabel,
    docId: feedRef.id,
    title: mainDoc.title,
    source,
  };
}

async function generateAllAiContent({ force = true, actorId = 'admin' } = {}) {
  const results = [];
  for (const { preset } of POST_PRESETS) {
    try {
      results.push(await generateOnePreset({ preset, force, actorId }));
    } catch (error) {
      console.error(`[ai-content] error for ${preset}`, error);
      results.push({ error: true, preset, message: error.message });
    }
  }
  return {
    results,
    total: results.length,
    ok: results.filter(result => result.ok).length,
    skipped: results.filter(result => result.skipped).length,
  };
}

// 자동 예약 생성은 중지합니다. 관리자 AI관리 화면에서 유형을 선택해 클릭할 때만 생성합니다.
exports.dailyAiContent = onSchedule({ schedule: '0 9 * * *', timeZone: 'Asia/Seoul', region: REGION, memory: '256MiB', timeoutSeconds: 60 }, async () => {
  console.log('[ai-content] scheduled auto generation disabled; use admin manual generation.');
  return null;
});

exports.generateAiContentNow = onCall({ region: REGION, timeoutSeconds: 120 }, async request => {
  await assertAdmin(request.auth && request.auth.uid);
  const preset = normalizePreset(request.data && (request.data.preset || request.data.type));
  return generateOnePreset({ preset, force: true, actorId: request.auth.uid });
});

exports.generateAllAiContentNow = onCall({ region: REGION, timeoutSeconds: 540, memory: '512MiB' }, async request => {
  await assertAdmin(request.auth && request.auth.uid);
  return generateAllAiContent({ force: true, actorId: request.auth.uid });
});