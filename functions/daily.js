const { onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { db, REGION, FieldValue, HttpsError, textValue, assertAdmin, loadSettings } = require('./admin-utils');

const SAMPLE_CASES = [
  ['라면 한 입 청구 후 반 냄비를 집행한 사건', '피고가 한 입만 먹겠다고 접근한 뒤 면발과 국물의 경계를 흐린 사건입니다.', '라면 1봉 재구매와 계란 1개 추가'],
  ['공용 충전기 장기 점유 사건', '피고가 충전이 완료된 뒤에도 충전기를 계속 점유하여 원고의 배터리 평온을 흔든 사건입니다.', '충전 완료 즉시 회수 의무'],
  ['아무거나라더니 메뉴 반박 사건', '피고가 아무거나 괜찮다고 말한 뒤 모든 메뉴 후보에 이의를 제기한 사건입니다.', '다음 식사 메뉴 후보 3개 선제 제시'],
  ['냉장고 음료 무단 시음 사건', '원고가 아껴둔 음료가 냉장고에서 조용히 감소한 사건입니다.', '같은 음료 1개 보충']
];
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function kstToday() { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function makeResult(caseId, c) {
  const title = c.caseTitle;
  return {
    userId: 'daily_ai', ownerId: 'daily_ai', isPublic: true, source: 'daily_ai', docketNumber: c.docketNumber,
    courtName: '소소킹 황당재판소', courtroom: c.courtroom, division: c.division, recordClerk: c.recordClerk, analystName: c.analystName, prosecutorName: '황당검사 강엄숙', defenderName: '피고측 변호인 최그정도',
    caseTitle: title, originalCaseTitle: title, refinedCaseTitle: title, absurdityTitle: title, caseDescription: c.caseDescription,
    expandedCase: `오늘의 AI 황당사건으로 ${title}이 접수되었다. 사건은 사소하지만 원고의 마음속 기록철에는 선명하게 남았다.`,
    caseTimeline: '1. 평온한 일상 진행\n2. 사소한 균열 발생\n3. 억울함이 누적되어 황당재판소 접수\n4. 제3황당재판부 배당',
    forensicReport: '접수 진술을 기준으로 황당성 농도를 감정한 결과, 사소함과 억울함의 비율이 공개 기록 가치 기준을 충족하였다.',
    plaintiffArg: '원고 측은 이 사건이 그냥 웃어넘기기엔 너무 찝찝하다고 주장한다.',
    defendantArg: '피고 측은 고의가 아니었다고 항변하지만, 원고의 표정이 이미 증거로 남았다고 본다.',
    courtOpinion: '재판부는 실제 법률문제가 아닌 오락용 황당재판으로서 원고의 억울함을 일부 인정한다.',
    sentence: `주문\n1. 피고 측은 원고의 억울함을 1회 인정한다.\n2. ${c.desiredVerdict || '작은 보상 또는 가벼운 사과를 권고한다.'}\n3. 본 판결은 웃음 회복 즉시 효력을 다한다.`,
    closingComment: '재판장 한마디: 사소한 일도 오늘의 기록이 될 수 있다.',
    absurdDetails: ['오늘의 공개 사건', '사소하지만 말하면 커지는 상황', '원고와 피고의 온도 차이', '웃음 회복 목적'],
    evidenceBits: ['접수 진술', '억울함 지수', '사건 후 찝찝함'], defendantExcuses: ['그럴 의도는 아니었다는 주장'], penaltyIdeas: ['상황 인정', '가벼운 사과', '재발 방지 약속'],
    judgeType: c.judgeType, grievanceIndex: c.grievanceIndex, nickname: 'AI 기록관', desiredVerdict: c.desiredVerdict,
    reception: '', investigation: '', verdict: '', keyIssues: ['사소함의 정도', '억울함의 잔존성'], evidenceList: ['접수 진술'],
    reactionTotal: 0, totalVotes: 0, commentCount: 0, courtStage: 'sentenced', resultVersion: 'daily-safe-v1', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
  };
}
async function createDailyCase(force = false) {
  const settings = await loadSettings();
  if (settings.dailyAiEnabled === false && !force) return { skipped: true, reason: 'disabled' };
  const today = kstToday();
  const id = `daily_${today}`;
  const exists = await db.doc(`results/${id}`).get();
  if (exists.exists && !force) return { skipped: true, reason: 'already-exists', caseId: id };
  const [title, desc, desired] = pick(SAMPLE_CASES);
  const c = { userId: 'daily_ai', source: 'daily_ai', docketNumber: `${today.slice(0,4)}황당-AI-${today.slice(5).replace('-','')}`, courtName: '소소킹 황당재판소', courtroom: '제404호 황당법정', division: '제3황당재판부', recordClerk: 'AI 기록관', analystName: 'AI 황당성 감정관', caseTitle: title, caseDescription: desc, desiredVerdict: desired, grievanceIndex: 7, judgeType: '과몰입형', status: 'completed', courtStage: 'sentenced', isPublic: true, nickname: 'AI 기록관', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
  await db.doc(`cases/${id}`).set(c, { merge: true });
  await db.doc(`results/${id}`).set(makeResult(id, c), { merge: true });
  return { success: true, caseId: id };
}
exports.generateDailyAiNow = onCall({ region: REGION, timeoutSeconds: 60, memory: '256MiB' }, async request => { await assertAdmin(request); return createDailyCase(request.data?.force === true); });
exports.generateDailyAiScheduled = onSchedule({ region: REGION, schedule: '0 9 * * *', timeZone: 'Asia/Seoul', memory: '256MiB', timeoutSeconds: 60 }, async () => createDailyCase(false));
