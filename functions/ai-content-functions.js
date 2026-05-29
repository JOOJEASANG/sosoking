'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');

const db = getFirestore();
const REGION = 'asia-northeast3';

// 현재 실제 글쓰기 화면(multi-write)의 공개 프리셋만 사용합니다.
const POST_PRESETS = [
  { preset: 'general', label: '모음방' },
  { preset: 'vote', label: '토론방' },
  { preset: 'drip', label: '드립방' },
  { preset: 'quiz', label: '퀴즈방' },
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
  if (key === 'collect' || key === 'collection') return 'general';
  if (key === 'ox' || key === 'crazy_court') return 'vote';
  if (key === 'initial_game') return 'quiz';
  if (key === 'random_battle' || key === 'relay' || key === 'acrostic' || key === 'naming') return 'general';
  return PRESET_META[key] ? key : 'general';
}

function feedTypeFromPreset(preset) {
  if (preset === 'general') return 'collect';
  return ['vote', 'drip', 'quiz'].includes(preset) ? preset : 'collect';
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
  general: `너는 소소킹 커뮤니티 운영자야. 모음방에 올릴 가벼운 유튜브/이미지 소개형 게시글 1개를 만들어줘.
주제는 일상, 직장, 음식, 관계, 취미 중 하나로 하고 너무 광고처럼 보이면 안 돼.
반드시 JSON만 출력해:
{"title":"제목 50자 이내","desc":"본문 2~4문장. 댓글을 유도하는 자연스러운 문장 포함","tags":["모음","소소킹"]}`,

  vote: `너는 소소킹 커뮤니티 운영자야. 현재 글쓰기 유형 '토론방'에 맞는 게시글 1개를 만들어줘.
상황을 제시하고 선택지에 투표하도록 만들어. 선택지는 2~4개.
반드시 JSON만 출력해:
{"title":"투표 제목 50자 이내","desc":"투표할 상황 설명 1~3문장","options":["선택지1","선택지2","선택지3"],"tags":["투표","판정","소소킹"]}`,

  drip: `너는 소소킹 커뮤니티 운영자야. 현재 글쓰기 유형 '드립방'에 올라갈 웃긴 한 줄 드립 1개만 만들어줘.
중요: 상황 설명, 질문, 참여 유도 문장, 제목형 문장을 만들지 마. 게시글 본문에 그대로 들어갈 완성된 드립 한 줄만 만들어.
길이는 50자 이내. 직장, 학교, 친구, 배달, 연애, 가족, 일상 중 하나를 소재로 피식 웃기는 문장이어야 해.
반드시 JSON만 출력해:
{"line":"50자 이내 웃긴 한 줄 드립","tags":["드립","한줄드립","소소킹"]}`,

  quiz: `너는 소소킹 커뮤니티 운영자야. 현재 글쓰기 유형 '퀴즈방'에 맞는 게시글 1개를 만들어줘.
주관식, 객관식, 정답 없는 생각 퀴즈 중 하나를 골라 만들어.
- 주관식이면 mode는 "subjective", answer를 포함해.
- 객관식이면 mode는 "multiple", options 2~4개와 answerIdx를 포함해.
- 정답 없는 퀴즈이면 noAnswer를 true로 하고 answer, answerIdx는 비워. 사용자가 댓글/반응으로 이야기할 수 있는 질문이어야 해.
반드시 JSON만 출력해:
{"title":"퀴즈 제목 50자 이내","desc":"문제 본문","mode":"subjective 또는 multiple","noAnswer":false,"options":["선택지1","선택지2"],"answer":"주관식 정답","answerIdx":0,"hint":"힌트 50자 이내","explanation":"정답 해설 또는 정답 없는 퀴즈 안내 1~2문장","tags":["퀴즈","소소킹"]}`,
};

function fallbackContent(preset, date) {
  const seed = Number(date.replace(/-/g, '')) || Date.now();
  const pick = list => list[seed % list.length];

  return {
    general: pick([
      { title: '오늘 하루 중 제일 소소하게 웃겼던 순간은?', desc: '거창한 일 아니어도 괜찮아요. 오늘 나를 피식 웃게 만든 장면 하나만 댓글로 남겨주세요.', tags: ['모음', '소소킹'] },
      { title: '요즘 나만 은근히 빠진 작은 취미 있어?', desc: '남들은 별거 아니라고 해도 계속 하게 되는 소소한 취미를 공유해봐요.', tags: ['취미', '소소킹'] },
    ]),
    vote: pick([
      { title: '지금 당장 먹고 싶은 야식은?', desc: '딱 하나만 고를 수 있다면 오늘 밤 메뉴는 무엇인가요? 댓글로 이유도 남겨주세요.', options: ['🍗 치킨', '🍜 라면', '🍕 피자', '🥟 만두'], tags: ['투표', '야식', '소소킹'] },
      { title: '주말 아침, 몇 시 기상이 제일 행복할까?', desc: '쉬는 날 아침 기준으로 가장 마음 편한 기상 시간을 골라주세요.', options: ['7시 이전', '9~10시', '11시쯤', '점심 이후'], tags: ['투표', '주말', '소소킹'] },
    ]),
    drip: pick([
      { line: '퇴근 5분 전 회의는 업무가 아니라 급습이다.', tags: ['드립', '직장인', '한줄드립'] },
      { line: '배달 예상시간은 내 인내심의 유통기한이다.', tags: ['드립', '배달', '한줄드립'] },
    ]),
    quiz: pick([
      { title: '오늘의 퀴즈 🧠', desc: '다음 중 일반적으로 냉장 보관하지 않는 것이 더 좋은 식재료는?', mode: 'multiple', noAnswer: false, options: ['토마토', '우유', '생선', '두부'], answerIdx: 0, hint: '맛과 식감이 중요해요.', explanation: '토마토는 냉장 보관 시 향과 식감이 떨어질 수 있어 상온 보관이 권장되는 경우가 많습니다.', tags: ['퀴즈', '생활상식', '소소킹'] },
      { title: '정답 없는 상상 퀴즈', desc: '만약 하루 동안 모든 사람이 말끝에 “ㅋㅋ”를 붙여야 한다면 제일 난감한 순간은 언제일까요?', mode: 'subjective', noAnswer: true, hint: '정답보다 센스가 중요해요.', explanation: '정답이 없는 생각 퀴즈입니다. 댓글로 가장 웃긴 답을 남겨보세요.', tags: ['퀴즈', '상상퀴즈', '정답없음'] },
    ]),
  }[preset] || { title: '오늘의 소소 이야기', desc: '가볍게 댓글로 이야기해봐요.', tags: ['소소킹'] };
}

function baseDoc({ preset, content, date, source }) {
  const meta = PRESET_META[preset] || PRESET_META.general;
  return {
    type: 'multi',
    cat: 'multi',
    subtype: subtypeFromPreset(preset),
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

  if (preset === 'drip') {
    const line = clean(content.line || content.drip || content.desc || content.title || '', 50) || '오늘도 웃긴 척하다가 진짜 웃겨버렸다.';
    doc.title = '오늘의 한줄';
    doc.desc = line;
    doc.typeLabel = '드립방';
    doc.subtype = 'drip';
    doc.feedType = 'drip';
    doc.tags = toTags(content.tags, ['드립', '한줄드립', '소소킹']);
    doc.modules.drip = { enabled: true, prompt: line, maxLength: 50 };
  }

  if (preset === 'quiz') {
    const mode = content.mode === 'subjective' ? 'subjective' : 'multiple';
    const noAnswer = content.noAnswer === true;
    const options = optionTexts(content.options, ['정답 후보 1', '정답 후보 2', '정답 후보 3', '정답 후보 4']).slice(0, 6);
    const safeOptions = options.length >= 2 ? options : ['맞다', '아니다'];
    const answerIdx = Math.max(0, Math.min(Number(content.answerIdx || content.correctIndex || 0), safeOptions.length - 1));
    const answer = clean(content.answer || safeOptions[answerIdx], 120);
    doc.modules.quiz = {
      enabled: true,
      mode,
      noAnswer,
      question: doc.desc,
      hint: clean(content.hint, 100),
      explanation: noAnswer ? clean(content.explanation || '정답이 없는 퀴즈입니다. 댓글로 자유롭게 이야기해보세요.', 500) : clean(content.explanation, 500),
    };
    if (mode === 'multiple') doc.modules.quiz.options = safeOptions.map(text => ({ text }));
    if (!noAnswer) {
      if (mode === 'multiple') doc.modules.quiz.correctIndex = answerIdx;
      else doc.modules.quiz.answer = answer;
      secretDoc = {
        quizMode: mode,
        mode,
        answer: mode === 'subjective' ? answer : safeOptions[answerIdx],
        answerIdx: mode === 'multiple' ? answerIdx : null,
        correctIndex: mode === 'multiple' ? answerIdx : null,
        explanation: clean(content.explanation, 500),
        correctCount: 0,
        firstCorrect: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
    }
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
