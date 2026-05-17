'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');

const db = getFirestore();
const REGION = 'asia-northeast3';

const POST_TYPES = [
  { type: 'balance',       cat: 'golra' },
  { type: 'vote',          cat: 'golra' },
  { type: 'battle',        cat: 'golra' },
  { type: 'naming',        cat: 'usgyo' },
  { type: 'acrostic',      cat: 'usgyo' },
  { type: 'drip',          cat: 'usgyo' },
  { type: 'ox',            cat: 'malhe' },
  { type: 'relay',         cat: 'malhe' },
  { type: 'random_battle', cat: 'malhe' },
];

function todayKST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function dayOfYear() {
  const [y, m, d] = todayKST().split('-').map(Number);
  return Math.floor((new Date(y, m - 1, d) - new Date(y, 0, 1)) / 86400000) + 1;
}

function clean(value, max = 500) {
  return String(value || '').replace(/[<>]/g, '').replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);
}

function parseJson(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(raw); } catch {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

async function settings() {
  const snap = await db.doc('site_settings/config').get();
  const data = snap.exists ? snap.data() || {} : {};
  return { aiAutoContentEnabled: data.aiAutoContentEnabled !== false, aiDailyLimit: Math.max(0, Number(data.aiDailyLimit ?? 20)) };
}

async function reserveUsage(kind) {
  const current = await settings();
  if (!current.aiAutoContentEnabled && kind === 'daily_content') return { ok: false, reason: 'disabled' };
  if (current.aiDailyLimit <= 0) return { ok: false, reason: 'limit-zero' };
  const date = todayKST();
  const ref = db.doc(`ai_usage/${date}`);
  let ok = false;
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const used = Number(snap.exists ? snap.data().total || 0 : 0);
    if (used >= current.aiDailyLimit) return;
    ok = true;
    tx.set(ref, { date, total: FieldValue.increment(1), [kind]: FieldValue.increment(1), limit: current.aiDailyLimit, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { ok, reason: ok ? 'reserved' : 'daily-limit-reached' };
}

async function assertAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
}

function fallbackContent(type, date) {
  const seed = Number(date.replace(/-/g, '')) || Date.now();
  const pick = arr => arr[seed % arr.length];
  const tags = ['오늘의주제', '소소킹'];
  const map = {
    balance:       { title: pick(['평생 하나만 가능하다면?', '오늘의 소소 밸런스']), desc: '가볍게 고르고 댓글로 이유를 남겨보세요.', options: [{ text: 'A 선택', votes: 0 }, { text: 'B 선택', votes: 0 }], tags },
    vote:          { title: pick(['오늘 점심 메뉴 고르기', '주말에 제일 하고 싶은 일은?']), desc: '가장 끌리는 선택지를 골라주세요.', options: [{ text: '맛있는 음식', votes: 0 }, { text: '완전 휴식', votes: 0 }, { text: '가벼운 외출', votes: 0 }], tags },
    battle:        { title: pick(['이 선택지 중 하나만 고른다면?', '오늘의 선택지 배틀!']), desc: '당신의 선택은? 댓글로 이유도 달아주세요.', options: [{ text: '선택지 A', votes: 0 }, { text: '선택지 B', votes: 0 }, { text: '선택지 C', votes: 0 }], tags },
    naming:        { title: '오늘 하루를 한 단어로 작명한다면?', desc: '오늘 기분이나 사건을 한 줄 제목으로 붙여보세요.', tags },
    acrostic:      { keyword: pick(['소소킹', '커피향기', '퇴근길', '라면왕']), desc: '제시어로 센스 있는 삼행시를 만들어보세요.', tags },
    drip:          { title: '이 상황에 제일 어울리는 드립은?', desc: '일상에서 갑자기 분위기가 싸해진 순간을 드립으로 살려보세요.', tags },
    ox:            { title: '오늘의 OX 퀴즈', desc: '아침에 물 한 잔을 마시면 하루 시작에 도움이 된다.', answer: 'O', explanation: '수분 보충은 컨디션 관리에 도움이 됩니다.', tags },
    relay:         { title: '댓글로 이어 쓰는 오늘의 이야기', desc: '한 문장씩 이어서 이야기를 완성해보세요.', startSentence: '문을 열자 생각지도 못한 쪽지가 놓여 있었다.', characters: '나, 수상한 쪽지를 남긴 사람', tags },
    random_battle: { title: pick(['같은 주제 다른 시각 — 누가 더 재밌어?', '랜덤 대결! 센스 대전']), desc: '같은 주제로 각자 답을 달아보세요. 반응이 많은 쪽이 승리!', battleTopic: pick(['최애 야식은?', '스트레스 해소법은?', '주말 아침을 여는 루틴은?']), tags },
  };
  return map[type] || map.concern;
}

function arr(value, max = 8) {
  return Array.isArray(value) ? value.slice(0, max).map(v => typeof v === 'object' ? v : String(v || '').slice(0, 80)) : [];
}

function buildDoc(type, cat, content, date, source) {
  const base = { type, cat, authorId: 'sosoking-ai', authorName: source === 'ai' ? '소소킹AI 🤖' : '소소킹 운영봇', authorPhoto: '', images: [], tags: arr(content.tags, 6).map(String), reactions: { total: 0 }, commentCount: 0, viewCount: 0, isAiGenerated: true, aiGeneratedDate: date, aiSource: source, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
  const optionList = value => arr(value, 6).map(o => ({ text: String(o.text || o || '').slice(0, 80), votes: Number(o.votes || 0) }));
  if (['balance', 'vote', 'battle'].includes(type)) return { mainDoc: { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000), options: optionList(content.options) }, secretDoc: null };
  if (type === 'ox') return { mainDoc: { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000) }, secretDoc: { answer: String(content.answer || 'O').toUpperCase() === 'X' ? 'X' : 'O', explanation: clean(content.explanation, 500) } };
  if (type === 'acrostic') { const keyword = clean(content.keyword, 12) || '소소킹'; return { mainDoc: { ...base, title: `'${keyword}' 삼행시 도전!`, keyword, desc: clean(content.desc, 1000) }, secretDoc: null }; }
  if (type === 'relay') return { mainDoc: { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000), startSentence: clean(content.startSentence, 200), characters: clean(content.characters, 200) }, secretDoc: null };
  if (type === 'random_battle') return { mainDoc: { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000), battleTopic: clean(content.battleTopic, 100) }, secretDoc: null };
  return { mainDoc: { ...base, title: clean(content.title, 100), desc: clean(content.desc, 1000) }, secretDoc: null };
}

async function generateDailyAiContent({ force = false, actorId = 'scheduler' } = {}) {
  const date = todayKST();
  const { type, cat } = POST_TYPES[dayOfYear() % POST_TYPES.length];
  const markerRef = db.doc(`system_jobs/ai_content_${date}_${type}`);
  const markerSnap = await markerRef.get();
  if (markerSnap.exists && !force) return { skipped: true, reason: 'already-generated', docId: markerSnap.data().docId };

  let content = fallbackContent(type, date);
  let source = 'fallback';
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const usage = apiKey ? await reserveUsage('daily_content') : { ok: false, reason: 'no-key' };

  if (apiKey && usage.ok) {
    try {
      const anthropic = new Anthropic({ apiKey });
      const msg = await anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 700, messages: [{ role: 'user', content: `Create one short Korean community post. Type: ${type}. Return JSON only.` }] });
      content = parseJson(msg.content.filter(b => b.type === 'text').map(b => b.text).join('')) || content;
      source = 'ai';
    } catch (error) {
      console.error('[ai-content] fallback', error);
    }
  }

  const { mainDoc, secretDoc } = buildDoc(type, cat, content, date, source);
  const feedRef = db.collection('feeds').doc();
  await Promise.all([feedRef.set(mainDoc), secretDoc ? feedRef.collection('secret').doc('answer').set(secretDoc) : null].filter(Boolean));
  await markerRef.set({ date, type, cat, docId: feedRef.id, source, actorId, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, docId: feedRef.id, type, cat, source };
}

exports.dailyAiContent = onSchedule({ schedule: '0 9 * * *', timeZone: 'Asia/Seoul', region: REGION, memory: '256MiB', timeoutSeconds: 120 }, async () => {
  await generateDailyAiContent();
});

exports.generateAiContentNow = onCall({ region: REGION, timeoutSeconds: 120 }, async request => {
  await assertAdmin(request.auth && request.auth.uid);
  return generateDailyAiContent({ force: request.data && request.data.force === true, actorId: request.auth.uid });
});
