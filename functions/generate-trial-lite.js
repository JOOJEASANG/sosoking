const { onCall } = require('firebase-functions/v2/https');
const { db, REGION, FieldValue, HttpsError, textValue, requireRealLogin, isAdminAuth } = require('./admin-utils');

const JUDGES = ['엄벌주의형', '감성형', '현실주의형', '과몰입형', '피곤형', '논리집착형', '드립형'];
const COURTROOMS = ['제404호 황당법정', '제101호 사소분쟁법정', '제777호 과몰입법정', '제3호 억울함전담법정'];
const CLERKS = ['정기록 서기관', '나과장 기록관', '박진지 참여관', '오억울 서기보'];
const ANALYSTS = ['소소경찰 박소소 경위', '황당성 감식반 오억울 조사관', '생활증거추적팀 정침묵 수사관'];
const PROSECUTORS = ['황당검사 강엄숙', '생활질서전담 오진지 검사', '소소공소부 박과몰입 검사'];
const DEFENDERS = ['피고측 변호인 최그정도', '국선변호인 안대수롭', '생활변호센터 조그럴수도 변호사'];
const STYLE = {
  '엄벌주의형': '사소함을 중대 기록처럼 엄중하게 본다.',
  '감성형': '원고의 서운함을 크게 본다.',
  '현실주의형': '현실적인 해결책을 진지하게 제시한다.',
  '과몰입형': '작은 일을 거대한 의식처럼 확장한다.',
  '피곤형': '어이없어하면서도 판결은 한다.',
  '논리집착형': '소소한 쟁점을 과하게 세분화한다.',
  '드립형': '정색한 말투 안에 짧은 웃음을 넣는다.'
};
function pickFrom(arr, seed = '') { let x = 0; const s = String(seed || Date.now()); for (let i = 0; i < s.length; i++) x = (x + s.charCodeAt(i) * (i + 1)) % 9973; return arr[Math.abs(x) % arr.length]; }
function pickJudge(v) { return JUDGES.includes(v) ? v : pickFrom(JUDGES); }
function imageMeta(c) { const img = c?.imageAttachmentMeta || c?.imageAttachment || null; return img && typeof img === 'object' ? { storagePath: textValue(img.storagePath || c.imageStoragePath, 240), mimeType: textValue(img.mimeType, 30), width: Number(img.width || 0), height: Number(img.height || 0), originalName: textValue(img.originalName, 80), originalSize: Number(img.originalSize || 0), resizedSize: Number(img.resizedSize || 0) } : null; }
function makeResult(c, judgeType) {
  const title = textValue(c.caseTitle, 90) || '소소한 황당사건';
  const desc = textValue(c.caseDescription, 1200) || title;
  const g = Number(c.grievanceIndex || 5);
  const wanted = textValue(c.desiredVerdict, 240);
  const style = STYLE[judgeType] || STYLE['현실주의형'];
  return {
    expandedCase: `접수계 기록\n원고는 '${title}'을 접수하였다. 사건 내용은 다음과 같다. ${desc}\n재판부는 본 사안을 실제 법률문제가 아닌 소소킹 오락용 황당재판 기록으로 분류한다.`,
    caseTimeline: `사건일지\n1. 원고의 일상 평온이 유지되던 중 사건이 발생하였다.\n2. 원고는 상황을 가볍게 넘기려 했으나 억울함 지수 ${g}/10에 도달하였다.\n3. 기록관은 사건명을 확인하고 제3황당재판부에 배당하였다.`,
    forensicReport: `소소국과수 감정서\n접수 진술과 억울함 지수를 감정한 결과, 사건 규모는 작지만 마음속 잔상은 평균치를 초과하였다. 황당성 농도는 ${Math.min(99, 40 + g * 6)}점으로 산정한다.`,
    plaintiffArg: `황당검사 공소장\n원고 측은 이 사건이 그냥 넘기기엔 찝찝하고 따지기엔 민망한 전형적 소소사건이라고 주장한다. 특히 사건 직후 남은 어이없음이 핵심 피해라고 본다.`,
    defendantArg: `피고 측 답변서\n피고 측은 상황이 그렇게 커질 줄 몰랐다고 항변한다. 다만 원고가 이 기록철까지 오게 된 점은 피고 측도 엄숙히 받아들일 필요가 있다.`,
    courtOpinion: `재판부 판단\n${judgeType} 재판부는 다음 기준을 적용한다. ${style} 본 사건은 법률적 판단 대상은 아니나, 소소한 억울함을 웃음으로 정리할 필요성은 인정된다.`,
    sentence: `주문\n1. 피고 측은 원고가 왜 억울했는지 1회 이상 인정한다.\n2. 같은 상황이 반복되지 않도록 사소한 주의의무를 부담한다.\n3. ${wanted ? `원고가 신청한 '${wanted}' 처분은 마음속 권고사항으로 일부 반영한다.` : '원고의 마음속 평온 회복을 위하여 가벼운 사과 또는 작은 보상을 권고한다.'}\n4. 본 판결은 웃음 회복 즉시 효력을 다한 것으로 본다.`,
    closingComment: `재판장 한마디: "${title.replace(/ 사건$/,'')}도 마음에 걸리면 기록철에 오른다."`,
    absurdDetails: ['사건 규모보다 큰 억울함', '피고 측과 원고 측의 온도 차이', '일상 평온의 미세한 흔들림', '말하면 커지는 소소한 분쟁'],
    evidenceBits: ['접수 진술', '억울함 지수', '사건 직후 찝찝함', '원고의 기록 보존 의지'],
    defendantExcuses: ['그럴 의도는 아니었다는 주장', '그 정도일 줄 몰랐다는 주장', '상황상 어쩔 수 없었다는 주장'],
    penaltyIdeas: ['상황 인정', '가벼운 사과', '재발 방지 약속', '작은 보상 또는 화해']
  };
}

exports.generateTrial = onCall({ region: REGION, timeoutSeconds: 120, memory: '256MiB' }, async request => {
  requireRealLogin(request, '재판 생성은 로그인 후 이용할 수 있습니다.');
  const uid = request.auth.uid;
  const caseId = textValue(request.data?.caseId, 180);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');
  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  const snap = await caseRef.get();
  if (!snap.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
  const c = snap.data();
  const admin = await isAdminAuth(request.auth).catch(() => false);
  if (c.userId !== uid && !admin) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
  if (c.status === 'completed') return { success: true, skipped: 'completed' };
  if (c.status === 'processing') return { success: true, skipped: 'processing' };
  if (!['pending', 'error'].includes(c.status)) throw new HttpsError('failed-precondition', '처리할 수 없는 사건 상태입니다.');
  const judgeType = pickJudge(c.selectedJudge);
  const people = { courtroom: c.courtroom || pickFrom(COURTROOMS, c.caseTitle), recordClerk: c.recordClerk || pickFrom(CLERKS, c.caseTitle), analystName: c.analystName || pickFrom(ANALYSTS, c.caseTitle), prosecutorName: c.prosecutorName || pickFrom(PROSECUTORS, c.caseTitle), defenderName: c.defenderName || pickFrom(DEFENDERS, c.caseTitle) };
  await caseRef.update({ status: 'processing', courtStage: 'hearing', ...people, judgeType, processingStartedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), errorMessage: FieldValue.delete() });
  const data = makeResult(c, judgeType);
  const caseTitle = textValue(c.caseTitle, 90) || '소소한 황당사건';
  try {
    await resultRef.set({
      userId: c.userId, ownerId: c.userId, isPublic: c.isPublic === true, docketNumber: c.docketNumber || '', courtName: '소소킹 황당재판소', courtroom: people.courtroom, division: '제3황당재판부', recordClerk: people.recordClerk, analystName: people.analystName, prosecutorName: people.prosecutorName, defenderName: people.defenderName,
      caseTitle, originalCaseTitle: caseTitle, refinedCaseTitle: caseTitle, absurdityTitle: caseTitle, imageAnalysis: '', hasImageAttachment: !!(c.imageStoragePath || c.hasImageAttachment), imageAttachmentMeta: imageMeta(c), caseDescription: c.caseDescription || '', expandedCase: data.expandedCase, absurdDetails: data.absurdDetails, evidenceBits: data.evidenceBits, defendantExcuses: data.defendantExcuses, penaltyIdeas: data.penaltyIdeas, grievanceIndex: c.grievanceIndex || 5, nickname: c.nickname || '익명 원고', desiredVerdict: c.desiredVerdict || '', judgeType,
      reception: data.expandedCase, caseTimeline: data.caseTimeline, forensicReport: data.forensicReport, plaintiffArg: data.plaintiffArg, defendantArg: data.defendantArg, courtOpinion: data.courtOpinion, sentence: data.sentence, closingComment: data.closingComment, aiGenerated: false, generationMode: 'safe-local-trial-v1', resultVersion: 'safe-local-trial-v1', analysisDigest: data.absurdDetails.slice(0, 4), absurdityReview: `재판부는 ${caseTitle}을 실제 법률 사안이 아닌 예능형 황당재판으로 판단한다.`, keyIssues: data.absurdDetails.slice(0, 4), evidenceList: data.evidenceBits.slice(0, 7), investigation: data.forensicReport, verdict: data.courtOpinion, executionOrder: '본 기록은 실제 법률문서가 아니며, 당사자 사이의 웃음 회복을 위한 임의적 기록입니다.', appealNotice: '본 사건은 오락용 기록이며 실제 법적 효력은 없습니다.', reactionTotal: 0, totalVotes: 0, commentCount: 0, courtStage: 'sentenced', createdAt: c.createdAt || FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await caseRef.update({ status: 'completed', courtStage: 'sentenced', ...people, judgeType, isPublic: c.isPublic === true, completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), errorMessage: FieldValue.delete() });
  } catch (err) {
    await caseRef.update({ status: 'pending', courtStage: 'filed', errorMessage: err.message || '저장 오류', updatedAt: FieldValue.serverTimestamp() }).catch(() => null);
    throw new HttpsError('internal', '판결문 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
  }
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  await db.doc(`usage_stats/daily_${today}`).set({ date: today, caseCount: FieldValue.increment(1), firestoreReads: FieldValue.increment(2), firestoreWrites: FieldValue.increment(3), functionInvocations: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => null);
  return { success: true, judgeType, isPublic: c.isPublic === true, hasImageAttachment: !!(c.imageStoragePath || c.hasImageAttachment), resultVersion: 'safe-local-trial-v1', generationMode: 'safe-local-trial-v1' };
});
