'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';
const TYPES = [
  { type: 'vote', cat: 'golra' },
  { type: 'initial_game', cat: 'golra' },
  { type: 'naming', cat: 'usgyo' },
  { type: 'crazy_court', cat: 'usgyo' },
  { type: 'relay', cat: 'malhe' },
  { type: 'acrostic', cat: 'malhe' },
];

function todayKST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
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

function pick(list, seed) {
  return list[Math.abs(seed) % list.length];
}

function fallbackContent(type, date) {
  const seed = Number(date.replace(/-/g, '')) || Date.now();
  const baseTags = ['소소킹'];
  const map = {
    vote: pick([
      { title: '지금 당장 먹고 싶은 야식은?', desc: '가장 끌리는 야식 하나만 골라주세요!', options: [{ text: '🍗 치킨', votes: 0 }, { text: '🍜 라면', votes: 0 }, { text: '🍕 피자', votes: 0 }], tags: ['골라킹', ...baseTags] },
      { title: '스트레스받을 때 제일 먼저 하고 싶은 건?', desc: '나만의 스트레스 해소법을 투표로 알아봐요!', options: [{ text: '🍔 폭식하기', votes: 0 }, { text: '🛌 그냥 자기', votes: 0 }, { text: '🚶 산책하기', votes: 0 }], tags: ['골라킹', ...baseTags] },
    ], seed),
    initial_game: pick([
      { initials: 'ㅅㅅㅋ', hint: '가볍게 즐기는 놀이 커뮤니티 이름', tags: ['초성게임', ...baseTags] },
      { initials: 'ㅌㄱㄱ', hint: '하루 중 가장 기다려지는 순간', tags: ['초성게임', ...baseTags] },
    ], seed),
    naming: pick([
      { title: '퇴근 5분 전 날아온 업무 지시에 이름을 붙여줘!', desc: '이 상황을 단어 하나나 짧은 문장으로 표현한다면? 가장 찰진 이름을 댓글로 남겨주세요.', charCount: 5, tags: ['미친작명소', ...baseTags] },
      { title: '배달 시간이 계속 밀리는 그 상황, 뭐라고 부를까?', desc: '초조하게 기다리는 이 순간에 딱 맞는 이름을 지어주세요.', charCount: 5, tags: ['미친작명소', ...baseTags] },
    ], seed),
    crazy_court: pick([
      { title: '억까재판: 카톡 읽고 3시간 뒤 답장한 사람, 유죄냐 무죄냐?', desc: '친구가 카톡을 읽고 3시간 동안 답장을 안 했어요. 바빠서였다고 합니다. 판결해주세요.', evidence: '급한 회의가 있었다고 주장함', tags: ['억까재판', ...baseTags] },
      { title: '억까재판: 마지막 한 조각을 말없이 먹은 친구, 유죄냐 무죄냐?', desc: '같이 먹자고 시킨 음식인데 마지막 한 조각을 아무 말 없이 먹었습니다. 여러분의 판결은?', evidence: '본인은 눈치게임이었다고 주장함', tags: ['억까재판', ...baseTags] },
    ], seed),
    relay: pick([
      { title: '막장 릴레이 시작 🎬 — 수상한 택배가 왔다', desc: '댓글로 한 문장씩 이어서 이야기를 완성해보세요.', startSentence: '현관문을 열자 이름도 주소도 없는 작은 상자가 놓여 있었고, 안에서는 희미하게 음악 소리가 들렸다.', characters: '주인공, 수상한 발신자, 옆집 할머니', tags: ['막장킹', ...baseTags] },
      { title: '막장 릴레이 시작 🎬 — 카페에서 생긴 일', desc: '한 문장씩 댓글로 이어가는 막장 릴레이 소설입니다.', startSentence: '조용한 카페에서 노트북을 열었는데, 맞은편 사람이 갑자기 내 이름을 불렀다.', characters: '주인공, 낯선 사람, 바리스타', tags: ['막장킹', ...baseTags] },
    ], seed),
    acrostic: pick([
      { keyword: '월요일', desc: "'월요일'로 삼행시를 지어보세요! 가장 웃기거나 공감되는 삼행시를 댓글로 남겨주세요.", tags: ['삼행시짓기', ...baseTags] },
      { keyword: '퇴근길', desc: "'퇴근길'로 삼행시 도전! 퇴근하는 기분을 담아 완성해보세요.", tags: ['삼행시짓기', ...baseTags] },
    ], seed),
  };
  return map[type] || map.vote;
}

function normalizeDoc(type, cat, content, date, source = 'six-game-fallback') {
  const base = {
    type, cat,
    authorId: 'sosoking-ai',
    authorName: '소소킹 운영봇',
    authorPhoto: '',
    images: [],
    tags: Array.isArray(content.tags) ? content.tags.slice(0, 6).map(String) : ['소소킹'],
    reactions: { total: 0 },
    commentCount: 0,
    viewCount: 0,
    hidden: false,
    isAiGenerated: true,
    aiGeneratedDate: date,
    aiSource: source,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (type === 'vote') {
    return { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000), options: content.options || [], votedBy: [] };
  }
  if (type === 'initial_game') {
    const initials = clean(content.initials || 'ㅅㅅㅋ', 10);
    return { ...base, title: `초성게임: ${initials}`, initials, hint: clean(content.hint, 100), desc: '초성을 보고 떠오르는 단어를 댓글로 남겨보세요.', answerLength: [...initials].length };
  }
  if (type === 'naming') {
    return { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000), charCount: Math.max(2, Math.min(10, Number(content.charCount || 5))) };
  }
  if (type === 'crazy_court') {
    return { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000), evidence: clean(content.evidence, 100), options: [{ text: '유죄', votes: 0 }, { text: '무죄', votes: 0 }], votedBy: [] };
  }
  if (type === 'relay') {
    return { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000), startSentence: clean(content.startSentence, 200), characters: clean(content.characters, 200) };
  }
  if (type === 'acrostic') {
    const keyword = clean(content.keyword || '월요일', 12);
    return { ...base, title: `'${keyword}' 삼행시 도전!`, keyword, desc: clean(content.desc, 1000) };
  }
  return { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000) };
}

async function assertAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
}

async function generateOneType({ type, cat, force = false, actorId = 'scheduler' }) {
  const date = todayKST();
  const markerRef = db.doc(`system_jobs/ai_content_${date}_${type}`);
  const markerSnap = await markerRef.get();
  if (markerSnap.exists && !force) return { skipped: true, type, reason: 'already-generated' };
  const docData = normalizeDoc(type, cat, fallbackContent(type, date), date);
  const feedRef = db.collection('feeds').doc();
  await feedRef.set(docData);
  await markerRef.set({ date, type, cat, docId: feedRef.id, source: docData.aiSource, actorId, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, type, cat, docId: feedRef.id, source: docData.aiSource };
}

async function generateDailyAiContent({ force = false, actorId = 'scheduler' } = {}) {
  const { type, cat } = TYPES[dayOfYear() % TYPES.length];
  return generateOneType({ type, cat, force, actorId });
}

async function generateAllAiContent({ force = false, actorId = 'admin' } = {}) {
  const results = [];
  for (const { type, cat } of TYPES) {
    try { results.push(await generateOneType({ type, cat, force, actorId })); }
    catch (e) { results.push({ error: true, type, message: e.message }); }
  }
  return { results, total: results.length, ok: results.filter(r => r.ok).length, skipped: results.filter(r => r.skipped).length };
}

const dailyAiContent = onSchedule({ schedule: '0 9 * * *', timeZone: 'Asia/Seoul', region: REGION, memory: '256MiB', timeoutSeconds: 120 }, async () => {
  await generateDailyAiContent();
});

const generateAiContentNow = onCall({ region: REGION, timeoutSeconds: 120 }, async request => {
  await assertAdmin(request.auth && request.auth.uid);
  return generateDailyAiContent({ force: request.data && request.data.force === true, actorId: request.auth.uid });
});

const generateAllAiContentNow = onCall({ region: REGION, timeoutSeconds: 540, memory: '512MiB' }, async request => {
  await assertAdmin(request.auth && request.auth.uid);
  return generateAllAiContent({ force: request.data && request.data.force === true, actorId: request.auth.uid });
});

const checkQuizAnswer = onCall({ region: REGION, timeoutSeconds: 10 }, async () => {
  throw new HttpsError('failed-precondition', '제거된 놀이 타입입니다.');
});

module.exports = {
  dailyAiContent,
  generateAiContentNow,
  generateAllAiContentNow,
  checkQuizAnswer,
};
