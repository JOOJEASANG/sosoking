'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');

const db = getFirestore();
const REGION = 'asia-northeast3';
const WEEKLY_TYPES = [
  { type: 'vote', cat: 'golra' },
  { type: 'initial_game', cat: 'golra' },
  { type: 'naming', cat: 'usgyo' },
  { type: 'crazy_court', cat: 'usgyo' },
  { type: 'relay', cat: 'malhe' },
  { type: 'acrostic', cat: 'malhe' },
];

function todayKST(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function weekKey(date = new Date()) {
  const [y, m, d] = todayKST(date).split('-').map(Number);
  const kstDate = new Date(Date.UTC(y, m - 1, d));
  const day = kstDate.getUTCDay() || 7;
  kstDate.setUTCDate(kstDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(kstDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((kstDate - yearStart) / 86400000) + 1) / 7);
  return `${kstDate.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function dayOfYear() {
  const [y, m, d] = todayKST().split('-').map(Number);
  return Math.floor((new Date(y, m - 1, d) - new Date(y, 0, 1)) / 86400000) + 1;
}

function clean(value, max = 500) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
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

function normalizeCopy(value) {
  return String(value || '')
    .replace(/골라킹/g, '골라봐')
    .replace(/막장킹/g, '막장릴레이');
}

function fallbackContent(type) {
  const baseTags = ['소소킹'];
  const map = {
    vote: {
      title: '이번 주 가장 끌리는 소소한 선택은?',
      desc: '이번 주 기분에 가장 가까운 선택지를 골라보고 이유도 댓글로 남겨보세요.',
      options: [{ text: '🍗 맛있는 거 먹기', votes: 0 }, { text: '🛌 푹 쉬기', votes: 0 }, { text: '🚶 산책하기', votes: 0 }],
      tags: ['골라봐', ...baseTags],
    },
    initial_game: {
      title: '초성게임: ㅅㅅㅋ', initials: 'ㅅㅅㅋ', hint: '가볍게 즐기는 놀이 커뮤니티 이름', answer: '소소킹', tags: ['초성게임', ...baseTags],
    },
    naming: {
      title: '이번 주 기분에 이름을 붙여주세요', desc: '이번 주 나의 기분이나 사건을 짧고 찰진 이름으로 작명해보세요.', tags: ['미친작명소', ...baseTags],
    },
    crazy_court: {
      title: '억까재판: 월요일은 유죄냐 무죄냐?', desc: '한 주의 시작인 월요일, 과연 유죄일까요 무죄일까요? 여러분의 판결을 남겨주세요.', evidence: '주말이 너무 짧았다는 증언 있음', tags: ['억까재판', ...baseTags],
    },
    relay: {
      title: '막장릴레이 시작 🎬 — 수상한 메시지가 왔다', desc: '댓글로 한 문장씩 이어서 이야기를 완성해보세요.', startSentence: '휴대폰을 켜자 저장되지 않은 번호로 단 한 문장이 도착해 있었다. "오늘 밤, 절대 문을 열지 마."', characters: '주인공, 수상한 발신자, 옆집 사람', tags: ['막장릴레이', ...baseTags],
    },
    acrostic: {
      keyword: '소소킹', desc: "'소소킹'으로 삼행시를 지어보세요! 가장 웃기거나 공감되는 삼행시를 댓글로 남겨주세요.", tags: ['삼행시짓기', ...baseTags],
    },
  };
  return map[type] || map.vote;
}

function buildDoc(type, cat, raw, date, source) {
  const content = JSON.parse(normalizeCopy(JSON.stringify(raw || fallbackContent(type))));
  const base = {
    type, cat,
    authorId: 'sosoking-ai',
    authorName: source === 'ai' ? '소소킹AI 🤖' : '소소킹 운영봇',
    authorPhoto: '',
    images: [],
    tags: Array.isArray(content.tags) ? content.tags.slice(0, 6).map(String) : ['소소킹'],
    reactions: { total: 0 },
    commentCount: 0,
    viewCount: 0,
    hidden: false,
    isAiGenerated: true,
    aiGeneratedDate: date,
    aiGeneratedWeek: weekKey(),
    aiSource: source,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (type === 'vote') {
    const options = Array.isArray(content.options) ? content.options.slice(0, 6).map(o => ({ text: String(o.text || o || '').slice(0, 80), votes: Number(o.votes || 0) })) : [];
    return { mainDoc: { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000), options, votedBy: [] }, secretDoc: null };
  }
  if (type === 'initial_game') {
    const initials = clean(content.initials || 'ㅅㅅㅋ', 10);
    return { mainDoc: { ...base, title: `초성게임: ${initials}`, initials, hint: clean(content.hint, 100), desc: '' }, secretDoc: { answer: clean(content.answer, 30), quizMode: 'short' } };
  }
  if (type === 'naming') return { mainDoc: { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000), charCount: 0 }, secretDoc: null };
  if (type === 'crazy_court') return { mainDoc: { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000), evidence: clean(content.evidence, 100), options: [{ text: '유죄', votes: 0 }, { text: '무죄', votes: 0 }], votedBy: [] }, secretDoc: null };
  if (type === 'relay') return { mainDoc: { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000), startSentence: clean(content.startSentence || content.start, 200), characters: clean(content.characters, 200) }, secretDoc: null };
  if (type === 'acrostic') {
    const keyword = clean(content.keyword || '소소킹', 12);
    return { mainDoc: { ...base, title: `'${keyword}' 삼행시 도전!`, keyword, desc: clean(content.desc, 1000) }, secretDoc: null };
  }
  return { mainDoc: { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000) }, secretDoc: null };
}

async function weeklyAiContentJob({ actorId = 'weekly-scheduler' } = {}) {
  const date = todayKST();
  const wk = weekKey();
  const { type, cat } = WEEKLY_TYPES[dayOfYear() % WEEKLY_TYPES.length];
  const markerRef = db.doc(`system_jobs/ai_content_${wk}`);
  const markerSnap = await markerRef.get();
  if (markerSnap.exists) return { skipped: true, reason: 'already-generated', week: wk };

  let content = fallbackContent(type);
  let source = 'fallback';
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const anthropic = new Anthropic({ apiKey });
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: `소소킹 커뮤니티에 올릴 이번 주 놀이판 1개를 JSON만 출력해줘. type은 ${type}.
명칭 규칙: vote 타입 이름은 반드시 "골라봐", relay 타입 이름은 반드시 "막장릴레이"로 써. "골라킹", "막장킹"은 쓰지 마.
JSON 필드는 title, desc, tags를 기본으로 하고 type별 필요한 필드를 포함해.` }],
      });
      const parsed = parseJson(msg.content.filter(b => b.type === 'text').map(b => b.text).join(''));
      if (parsed) { content = parsed; source = 'ai'; }
    } catch (error) {
      console.error('[weekly-ai-content] fallback', error);
    }
  }

  const { mainDoc, secretDoc } = buildDoc(type, cat, content, date, source);
  const feedRef = db.collection('feeds').doc();
  await Promise.all([
    feedRef.set(mainDoc),
    secretDoc ? feedRef.collection('secret').doc('answer').set(secretDoc) : null,
  ].filter(Boolean));
  await markerRef.set({ week: wk, date, type, cat, docId: feedRef.id, source, actorId, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, week: wk, type, cat, docId: feedRef.id, source };
}

function nextWeekMidnightKST() {
  const [y, m, d] = todayKST().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 7, -9, 0, 0));
}

async function weeklyAiMissionJob({ actorId = 'weekly-scheduler' } = {}) {
  const date = todayKST();
  const wk = weekKey();
  const markerRef = db.doc(`system_jobs/ai_mission_${wk}`);
  const markerSnap = await markerRef.get();
  if (markerSnap.exists) return { created: false, reason: 'already-exists', week: wk, missionId: markerSnap.data().missionId || null };

  const mission = {
    title: '이번 주 소소 미션',
    desc: '이번 주에 가장 공감되는 놀이판에 참여하고 댓글로 이유를 남겨보세요.',
    cat: 'golra',
    type: 'vote',
    prompt: '이번 주 소소 미션 참여하기',
  };

  const oldAi = await db.collection('missions').where('aiManaged', '==', true).where('active', '==', true).limit(100).get().catch(() => ({ docs: [] }));
  const batch = db.batch();
  oldAi.docs.forEach(doc => batch.update(doc.ref, { active: false, replacedAt: FieldValue.serverTimestamp() }));
  if (oldAi.docs.length) await batch.commit();

  const missionRef = db.collection('missions').doc(`weekly-ai-${wk}`);
  await missionRef.set({
    ...mission,
    active: true,
    aiManaged: true,
    aiGeneratedDate: date,
    aiGeneratedWeek: wk,
    source: 'weekly-fallback',
    actorId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    endDate: Timestamp.fromDate(nextWeekMidnightKST()),
  }, { merge: true });
  await markerRef.set({ missionId: missionRef.id, week: wk, date, source: 'weekly-fallback', title: mission.title, actorId, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  return { created: true, week: wk, missionId: missionRef.id, mission: { id: missionRef.id, ...mission } };
}

const weeklySchedule = { schedule: '0 9 * * 1', timeZone: 'Asia/Seoul', region: REGION, memory: '256MiB', timeoutSeconds: 120 };
const weeklyMissionSchedule = { schedule: '5 8 * * 1', timeZone: 'Asia/Seoul', region: REGION, memory: '256MiB', timeoutSeconds: 90 };

module.exports = {
  dailyAiContent: onSchedule(weeklySchedule, async () => { await weeklyAiContentJob(); }),
  dailyAiMission: onSchedule(weeklyMissionSchedule, async () => { await weeklyAiMissionJob(); }),
  scheduledDailyMission: onSchedule(weeklyMissionSchedule, async () => { await weeklyAiMissionJob({ actorId: 'legacy-weekly-scheduler' }); }),
};
