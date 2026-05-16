'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');

const db = getFirestore();
const REGION = 'asia-northeast3';
const MISSION_TYPES = ['balance', 'vote', 'naming', 'acrostic', 'howto', 'story'];
const CATEGORIES = ['golra', 'usgyo', 'malhe'];

function getTodayKST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function getTomorrowMidnightKST() {
  const [year, month, day] = getTodayKST().split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1, -9, 0, 0));
}

function cleanText(value, max = 200) {
  return String(value || '').replace(/[<>]/g, '').replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);
}

function parseJson(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(raw); } catch {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

async function getAiSettings() {
  const snap = await db.doc('site_settings/config').get();
  const data = snap.exists ? snap.data() || {} : {};
  return {
    aiMissionEnabled: data.aiMissionEnabled !== false,
    aiDailyLimit: Math.max(0, Number(data.aiDailyLimit ?? 20)),
  };
}

async function reserveAiUsage(kind) {
  const today = getTodayKST();
  const settings = await getAiSettings();
  if (!settings.aiMissionEnabled && kind === 'mission') return { ok: false, reason: 'disabled-by-admin', settings };
  if (settings.aiDailyLimit <= 0) return { ok: false, reason: 'limit-zero', settings };
  const ref = db.doc(`ai_usage/${today}`);
  let reserved = false;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    const used = Number(data.total || 0);
    if (used >= settings.aiDailyLimit) return;
    reserved = true;
    tx.set(ref, {
      date: today,
      total: FieldValue.increment(1),
      [kind]: FieldValue.increment(1),
      limit: settings.aiDailyLimit,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  return { ok: reserved, reason: reserved ? 'reserved' : 'daily-limit-reached', settings };
}

function missionFallback(today) {
  const pool = [
    { title: '오늘 먹은 것 중 제일 소소하게 행복했던 메뉴는?', desc: '사진이 없어도 좋아요. 오늘 먹은 음식 중 의외로 기분 좋아졌던 메뉴를 공유해보세요.', cat: 'malhe', type: 'story', prompt: '오늘의 소소한 음식 행복 공유하기' },
    { title: '퇴근 후 1시간이 생긴다면 뭐 할래요?', desc: '잠깐의 자유시간을 어떻게 쓰고 싶은지 골라보고 댓글로 이유를 남겨보세요.', cat: 'golra', type: 'vote', prompt: '퇴근 후 1시간 사용법 투표하기' },
    { title: '오늘 하루를 한 단어로 작명한다면?', desc: '오늘 기분, 사건, 실수, 웃긴 순간을 담아 하루 제목을 붙여보세요.', cat: 'usgyo', type: 'naming', prompt: '오늘 하루 제목 짓기' },
  ];
  const idx = Math.abs(today.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % pool.length;
  return pool[idx];
}

function normalizeMission(raw, today) {
  const fallback = missionFallback(today);
  const data = raw && typeof raw === 'object' ? raw : fallback;
  const cat = CATEGORIES.includes(data.cat) ? data.cat : fallback.cat;
  const type = MISSION_TYPES.includes(data.type) ? data.type : fallback.type;
  return {
    title: cleanText(data.title || fallback.title, 80) || fallback.title,
    desc: cleanText(data.desc || fallback.desc, 500) || fallback.desc,
    cat,
    type,
    prompt: cleanText(data.prompt || data.participationPrompt || fallback.prompt, 180) || fallback.prompt,
  };
}

async function isAdminUid(uid) {
  if (!uid) return false;
  const snap = await db.doc(`admins/${uid}`).get();
  return snap.exists;
}

async function deactivateExpiredAndOldAiMissions(today) {
  const now = Timestamp.now();
  const [expiredSnap, oldAiSnap] = await Promise.all([
    db.collection('missions').where('active', '==', true).where('endDate', '<', now).limit(100).get().catch(() => ({ docs: [] })),
    db.collection('missions').where('aiManaged', '==', true).where('active', '==', true).limit(100).get().catch(() => ({ docs: [] })),
  ]);
  const batch = db.batch();
  let count = 0;
  expiredSnap.docs.forEach(doc => { batch.update(doc.ref, { active: false, autoClosedAt: FieldValue.serverTimestamp() }); count += 1; });
  oldAiSnap.docs.forEach(doc => {
    const data = doc.data() || {};
    if (data.aiGeneratedDate !== today) { batch.update(doc.ref, { active: false, replacedAt: FieldValue.serverTimestamp() }); count += 1; }
  });
  if (count > 0) await batch.commit();
  return count;
}

function buildPrompt(today) {
  return `당신은 한국 놀이형 커뮤니티 "소소킹"의 미션 운영 AI입니다. 오늘 날짜는 ${today}입니다. 사용자가 바로 글을 쓰거나 댓글을 달고 싶어지는 가벼운 오늘의 미션 1개를 만드세요. 반드시 JSON 객체만 반환하세요. 형식: {"title":"80자 이내 제목","desc":"2문장 이내 설명","cat":"golra|usgyo|malhe","type":"balance|vote|naming|acrostic|howto|story","prompt":"참여 유도 문장"}. 금지: 정치, 종교, 혐오, 성적 내용, 실명 비방, 위험한 행동, 현금/상품 요구.`;
}

async function createAiMission({ force = false, actorId = 'system' } = {}) {
  const today = getTodayKST();
  const markerRef = db.doc(`system_jobs/ai_mission_${today}`);
  const markerSnap = await markerRef.get();
  if (markerSnap.exists && !force) return { created: false, reason: 'already-exists', missionId: markerSnap.data().missionId || null };

  await deactivateExpiredAndOldAiMissions(today);

  let content = null;
  let source = 'fallback';
  const usage = await reserveAiUsage('mission');
  if (usage.ok && process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 700,
        messages: [{ role: 'user', content: buildPrompt(today) }],
      });
      const rawText = message.content.filter(b => b.type === 'text').map(b => b.text).join('');
      content = parseJson(rawText);
      source = 'anthropic';
    } catch (error) {
      console.error('[ai-mission] AI generation failed, fallback used:', error);
    }
  } else {
    console.log('[ai-mission] fallback used:', usage.reason || 'no-key');
  }

  const mission = normalizeMission(content, today);
  const missionRef = force ? db.collection('missions').doc() : db.collection('missions').doc(`daily-ai-${today}`);
  const missionData = {
    ...mission,
    active: true,
    aiManaged: true,
    aiGeneratedDate: today,
    source,
    actorId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    endDate: Timestamp.fromDate(getTomorrowMidnightKST()),
  };

  await missionRef.set(missionData, { merge: true });
  await markerRef.set({ missionId: missionRef.id, date: today, source, title: mission.title, actorId, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  return { created: true, missionId: missionRef.id, source, mission: { id: missionRef.id, ...missionData } };
}

const generateAiMissionNow = onCall({ region: REGION, timeoutSeconds: 60, secrets: ['ANTHROPIC_API_KEY'] }, async (request) => {
  const uid = request.auth?.uid;
  if (!(await isAdminUid(uid))) throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
  return createAiMission({ force: request.data?.force === true, actorId: uid });
});

const dailyAiMission = onSchedule({ schedule: '5 8 * * *', timeZone: 'Asia/Seoul', region: REGION, timeoutSeconds: 90, memory: '256MiB', secrets: ['ANTHROPIC_API_KEY'] }, async () => {
  await createAiMission({ force: false, actorId: 'scheduler' });
});

module.exports = { generateAiMissionNow, dailyAiMission };
