'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';
const MISSIONS = [
  { title: '지금 당장 하나만 고른다면?', desc: '오늘 가장 끌리는 선택지를 골라보고 이유도 댓글로 남겨보세요.', cat: 'golra', type: 'vote', prompt: '골라킹 참여하기' },
  { title: '오늘 하루에 딱 맞는 이름을 지어주세요', desc: '오늘의 기분이나 사건에 찰떡같은 이름을 붙여보세요.', cat: 'usgyo', type: 'naming', prompt: '미친작명소 참여하기' },
  { title: '초성만 보고 떠오르는 단어는?', desc: '제시된 초성을 보고 가장 먼저 떠오르는 단어를 댓글로 남겨보세요.', cat: 'golra', type: 'initial_game', prompt: '초성게임 참여하기' },
  { title: '억까재판: 이 상황 유죄냐 무죄냐?', desc: '애매한 상황을 보고 유죄/무죄를 골라 판결해보세요.', cat: 'usgyo', type: 'crazy_court', prompt: '억까재판 판결하기' },
  { title: '막장 릴레이 한 문장 이어가기', desc: '첫 문장에 이어 댓글로 한 문장씩 막장 스토리를 완성해보세요.', cat: 'malhe', type: 'relay', prompt: '막장킹 이어쓰기' },
  { title: '오늘의 삼행시 제시어', desc: '제시어로 가장 센스 있는 삼행시를 남겨보세요.', cat: 'malhe', type: 'acrostic', prompt: '삼행시짓기 참여하기' },
];

function todayKST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function tomorrowMidnightKST() {
  const [y, m, d] = todayKST().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1, -9, 0, 0));
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

async function makeSixGameMission({ force = false, actorId = 'system' } = {}) {
  const date = todayKST();
  const markerRef = db.doc(`system_jobs/ai_mission_${date}`);
  const markerSnap = await markerRef.get();
  if (markerSnap.exists && !force) return { created: false, reason: 'already-exists', missionId: markerSnap.data().missionId || null };

  await closeOldMissions(date);
  const seed = date.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const mission = MISSIONS[seed % MISSIONS.length];
  const missionRef = force ? db.collection('missions').doc() : db.collection('missions').doc(`daily-ai-${date}`);
  await missionRef.set({
    ...mission,
    active: true,
    aiManaged: true,
    aiGeneratedDate: date,
    source: 'six-game-fallback',
    actorId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    endDate: Timestamp.fromDate(tomorrowMidnightKST()),
  }, { merge: true });
  await markerRef.set({ missionId: missionRef.id, date, source: 'six-game-fallback', title: mission.title, actorId, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  return { created: true, missionId: missionRef.id, source: 'six-game-fallback', mission: { id: missionRef.id, ...mission } };
}

const generateAiMissionNow = onCall({ region: REGION, timeoutSeconds: 60 }, async request => {
  const uid = request.auth && request.auth.uid;
  if (!(await isAdmin(uid))) throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
  return makeSixGameMission({ force: request.data && request.data.force === true, actorId: uid });
});

const dailyAiMission = onSchedule({ schedule: '5 8 * * *', timeZone: 'Asia/Seoul', region: REGION, timeoutSeconds: 90, memory: '256MiB' }, async () => {
  await makeSixGameMission({ force: false, actorId: 'scheduler' });
});

module.exports = { generateAiMissionNow, dailyAiMission };
