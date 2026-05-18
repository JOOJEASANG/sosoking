'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');

const db = getFirestore();
const REGION = 'asia-northeast3';
const MISSION_TYPES = ['vote', 'naming', 'acrostic', 'relay', 'quiz', 'random_battle', 'crazy_court', 'initial_game', 'drip'];
const CATEGORIES = ['golra', 'usgyo', 'malhe'];

function todayKST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function tomorrowMidnightKST() {
  const [y, m, d] = todayKST().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1, -9, 0, 0));
}

function clean(value, max = 200) {
  return String(value || '').replace(/[<>]/g, '').replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);
}

function parseJson(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(raw); } catch {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
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
    aiMissionEnabled: data.aiMissionEnabled !== false,
    aiDailyLimit: Math.max(0, Number(data.aiDailyLimit ?? 20)),
  };
  _settingsCacheAt = now;
  return _settingsCache;
}

async function reserveUsage(kind) {
  const current = await settings();
  if (!current.aiMissionEnabled && kind === 'mission') return { ok: false, reason: 'disabled' };
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

function fallbackMission(date) {
  const items = [
    { title: '오늘 하루를 한 단어로 작명한다면?', desc: '오늘 기분이나 사건을 딱 맞는 이름으로 표현해보세요! 댓글로 창의적인 작명을 남겨주세요.', cat: 'usgyo', type: 'naming', prompt: '오늘 하루 제목 짓기' },
    { title: '퇴근 후 1시간이 생긴다면 뭐 할래요?', desc: '잠깐의 자유시간을 어떻게 쓰고 싶은지 골라보고 댓글로 이유를 남겨보세요.', cat: 'golra', type: 'vote', prompt: '퇴근 후 1시간 사용법 투표하기' },
    { title: '오늘의 소소한 행복은 뭐였나요?', desc: '오늘 기분 좋아진 순간, 랜덤 대결로 공유해봐요. 가장 공감받은 이야기가 오늘의 왕!', cat: 'golra', type: 'random_battle', prompt: '오늘의 소소한 행복 공유하기' },
  ];
  const idx = date.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % items.length;
  return items[idx];
}

function normalize(raw, date) {
  const base = fallbackMission(date);
  const data = raw && typeof raw === 'object' ? raw : base;
  return {
    title: clean(data.title || base.title, 80) || base.title,
    desc: clean(data.desc || base.desc, 500) || base.desc,
    cat: CATEGORIES.includes(data.cat) ? data.cat : base.cat,
    type: MISSION_TYPES.includes(data.type) ? data.type : base.type,
    prompt: clean(data.prompt || base.prompt, 180) || base.prompt,
  };
}

async function isAdmin(uid) {
  if (!uid) return false;
  const snap = await db.doc(`admins/${uid}`).get();
  return snap.exists;
}

async function closeOldMissions(date) {
  const now = Timestamp.now();
  const [expired, oldAi] = await Promise.all([
    db.collection('missions').where('active', '==', true).where('endDate', '<', now).limit(100).get().catch(() => ({ docs: [] })),
    db.collection('missions').where('aiManaged', '==', true).where('active', '==', true).limit(100).get().catch(() => ({ docs: [] })),
  ]);
  const batch = db.batch();
  let count = 0;
  expired.docs.forEach(doc => { batch.update(doc.ref, { active: false, autoClosedAt: FieldValue.serverTimestamp() }); count += 1; });
  oldAi.docs.forEach(doc => {
    if ((doc.data() || {}).aiGeneratedDate !== date) {
      batch.update(doc.ref, { active: false, replacedAt: FieldValue.serverTimestamp() });
      count += 1;
    }
  });
  if (count) await batch.commit();
}

async function makeAiMission({ force = false, actorId = 'system' } = {}) {
  const date = todayKST();
  const markerRef = db.doc(`system_jobs/ai_mission_${date}`);
  const markerSnap = await markerRef.get();
  if (markerSnap.exists && !force) return { created: false, reason: 'already-exists', missionId: markerSnap.data().missionId || null };

  await closeOldMissions(date);

  let raw = null;
  let source = 'fallback';
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const usage = apiKey ? await reserveUsage('mission') : { ok: false, reason: 'no-key' };

  if (apiKey && usage.ok) {
    try {
      const anthropic = new Anthropic({ apiKey });
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: `오늘(${date})의 한국 커뮤니티 미션을 하나 만들어줘. 아래 형식의 JSON만 출력해 (다른 말 없이):
{"title":"미션 제목","desc":"미션 설명 1~2문장","cat":"golra 또는 usgyo 또는 malhe","type":"vote 또는 naming 또는 acrostic 또는 relay 또는 quiz 또는 random_battle 또는 crazy_court 또는 initial_game 또는 drip","prompt":"참여 유도 한 줄 문구"}
cat과 type은 반드시 위 목록 중 하나여야 해. golra=골라킹/랜덤대결/초성게임, usgyo=미친작명소/억까재판/한줄드립, malhe=미친퀴즈/막장킹/삼행시짓기.` }],
      });
      raw = parseJson(msg.content.filter(b => b.type === 'text').map(b => b.text).join(''));
      source = raw ? 'anthropic' : 'fallback';
    } catch (error) {
      console.error('[ai-mission] fallback', error);
    }
  }

  const mission = normalize(raw, date);
  const missionRef = force ? db.collection('missions').doc() : db.collection('missions').doc(`daily-ai-${date}`);
  await missionRef.set({ ...mission, active: true, aiManaged: true, aiGeneratedDate: date, source, actorId, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), endDate: Timestamp.fromDate(tomorrowMidnightKST()) }, { merge: true });
  await markerRef.set({ missionId: missionRef.id, date, source, title: mission.title, actorId, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  return { created: true, missionId: missionRef.id, source, mission: { id: missionRef.id, ...mission } };
}

const generateAiMissionNow = onCall({ region: REGION, timeoutSeconds: 60 }, async request => {
  const uid = request.auth && request.auth.uid;
  if (!(await isAdmin(uid))) throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
  return makeAiMission({ force: request.data && request.data.force === true, actorId: uid });
});

const dailyAiMission = onSchedule({ schedule: '5 8 * * *', timeZone: 'Asia/Seoul', region: REGION, timeoutSeconds: 90, memory: '256MiB' }, async () => {
  await makeAiMission({ force: false, actorId: 'scheduler' });
});

module.exports = { generateAiMissionNow, dailyAiMission };
