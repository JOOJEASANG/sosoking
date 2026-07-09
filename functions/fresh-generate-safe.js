const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { db, FieldValue, REGION, clean, cleanBlock, pick, safeJson, buildModel, loadSettings, keywordTokens, titleFromDescription } = require('./fresh-utils');

const geminiKey = defineSecret('GEMINI_API_KEY');
const JUDGES = ['엄벌주의형','감성형','현실주의형','과몰입형','피곤형','논리집착형','드립형'];
const COURTS = ['제404호 황당법정','제101호 소소분쟁법정','제777호 과몰입법정'];
const CLERKS = ['정기록 참여관','나과장 기록관','박진지 서기관'];
const PROSECUTORS = ['황당검사 강엄숙','한입권 담당 나과장 검사','소소공소부 박과몰입 검사'];
const DEFENDERS = ['피고측 변호인 최그정도','국선변호인 안대수롭','생활변호센터 조그럴수도 변호사'];

function fallbackAnalysis(c) {
  const desc = clean(c.caseDescription, 1000);
  const words = keywordTokens(`${c.caseTitle || ''} ${desc}`, 8);
  const object = words[0] || '문제의 대상';
  const actor = words[1] || '피고';
  const place = words[2] || '사건 현장';
  const action = words[3] || '평온 침범';
  const title = clean(c.caseTitle, 80) || titleFromDescription(desc);
  return {
    title: title.endsWith('사건') ? title : `${title} 사건`,
    place,
    actor,
    object,
    action,
    loss: `${object}에 대해 원고가 기대하던 평온과 선택권`,
    decisiveMoment: `${actor}의 ${action}이 원고의 기대를 끊어낸 순간`,
    absurdDetails: [
      `${place}에 남은 묘하게 긴 정적`, `${object}을 향해 열린 운명의 각도`, `${actor}의 지나치게 자연스러운 태도`, `원고가 믿고 있던 ${object}의 안전지대`,
      `${action} 직후 멈춘 원고의 손`, `현장을 지배한 3초의 공백`, `${object} 주변에 남은 생활 흔적`, `피고 측의 아무 일 없다는 듯한 표정`,
      `원고의 표정에 남은 납득 불가`, `사라진 마지막 선택권`, `사건 뒤 더 크게 들린 주변 소리`, `누구도 먼저 설명하지 않은 침묵`
    ],
    evidenceBits: [
      `${object} 주변의 미세 흔적`, `${place} 안쪽의 접근 가능 거리`, `원고의 시선이 잠시 벗어난 시간대`, `${actor}의 모호한 반응`,
      `사건 직후 원고의 손동작`, `현장에 남은 생활감`, `${object}이 원래 있어야 할 자리`, `피고 측 설명과 현장 분위기의 차이`
    ],
    defendantExcuses: [
      '피고 측은 당시 상황이 지나치게 엄숙하게 해석되었다고 항변한다.',
      '피고 측은 고의가 아니라 일상적 우연에 가까웠다고 주장한다.',
      '피고 측은 원고의 기대가 너무 정교했다고 말한다.',
      '피고 측은 현장이 평범했으므로 특별한 사건성이 없다고 주장한다.'
    ],
    penaltyIdeas: [
      `${object}에 준하는 평화조치를 제공한다.`,
      `피고는 유사 상황에서 3초간 멈춰 확인한다.`,
      `원고에게 작은 간식 또는 음료를 제안한다.`,
      `${place} 주변을 사건 전 상태로 정리한다.`,
      `피고는 그럴 수도 있지라는 말을 1회 보류한다.`,
      `재발 방지를 위해 ${object}의 상태를 먼저 확인한다.`
    ]
  };
}
function normalizeAnalysis(raw, c) {
  const base = fallbackAnalysis(c);
  const arr = (v, fallback, max) => Array.isArray(v) ? v.map(x => clean(x, 160)).filter(Boolean).slice(0, max) : fallback;
  return {
    title: clean(raw.title, 80) || base.title,
    place: clean(raw.place, 80) || base.place,
    actor: clean(raw.actor, 80) || base.actor,
    object: clean(raw.object, 80) || base.object,
    action: clean(raw.action, 80) || base.action,
    loss: clean(raw.loss, 160) || base.loss,
    decisiveMoment: clean(raw.decisiveMoment, 180) || base.decisiveMoment,
    absurdDetails: arr(raw.absurdDetails, base.absurdDetails, 12),
    evidenceBits: arr(raw.evidenceBits, base.evidenceBits, 8),
    defendantExcuses: arr(raw.defendantExcuses, base.defendantExcuses, 6),
    penaltyIdeas: arr(raw.penaltyIdeas, base.penaltyIdeas, 6)
  };
}
async function analyzeCase(c) {
  const fallback = fallbackAnalysis(c);
  try {
    const settings = await loadSettings();
    const modelName = clean(settings.geminiModel, 60) || 'gemini-2.5-flash';
    const model = buildModel(geminiKey.value(), modelName, 0.86);
    const prompt = `사용자가 접수한 생활 사건을 분석한다. 예시 유형에 끼워 맞추지 말고 입력문 안의 인물, 물건, 장소, 행동, 상실감, 웃긴 디테일을 직접 찾아라. JSON만 출력한다.

접수 제목: ${clean(c.caseTitle, 100)}
접수 내용: ${clean(c.caseDescription, 1000)}
원하는 처분: ${clean(c.desiredVerdict, 240) || '없음'}

출력 형식:
{"title":"사건명","place":"장소","actor":"행위자 또는 피고","object":"피해 대상 또는 핵심 물건","action":"문제 행동","loss":"원고가 잃은 것","decisiveMoment":"결정적 장면","absurdDetails":["구체 디테일 12개"],"evidenceBits":["현장 증거 8개"],"defendantExcuses":["피고 측 변명 4개"],"penaltyIdeas":["사건 맞춤 처분 6개"]}`;
    const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return normalizeAnalysis(safeJson(result.response.text()), c);
  } catch (err) {
    console.error('dynamic case analysis failed, using text fallback:', err);
    return fallback;
  }
}
function buildDocuments(c, people, judgeType, a) {
  const title = a.title.endsWith('사건') ? a.title : `${a.title} 사건`;
  const d = a.absurdDetails;
  const e = a.evidenceBits;
  const x = a.defendantExcuses;
  const p = a.penaltyIdeas;
  return {
    refinedCaseTitle: title,
    absurdityTitle: `${title} 기록철`,
    absurdDetails: d,
    evidenceBits: e,
    expandedCase: cleanBlock(`문서명: 사건 배경 및 발단 기록\n원고의 접수 내용은 짧았다. ${clean(c.caseDescription, 1000)}\n그러나 ${a.place}에는 그냥 넘기기 어려운 장면이 남아 있었다. 이 사건의 중심에는 ${a.object}이 있었고, 원고는 그것을 단순한 물건이 아니라 ${a.loss}의 상징으로 받아들이고 있었다. 그때 ${a.actor}이 사건의 중심으로 들어왔고, ${a.action}이 벌어졌다. 결정적 장면은 ${a.decisiveMoment}이었다. 현장에는 ${d[0]}와 ${d[1]}이 남았고, ${e[0]}와 ${e[1]}은 원고의 허탈함이 단순한 기분 탓만은 아니었음을 보여준다. 재판부는 이 사소한 장면을 지나치게 진지하게 기록하기로 한다.`, 4500),
    caseTimeline: cleanBlock(`문서명: 분초 단위 사건일지\n00분 00초, 원고는 ${a.place}에서 ${a.object}의 평온을 믿고 있었다.\n00분 03초, ${d[0]}이 관측되었다.\n00분 07초, ${a.actor}이 사건 중심부로 접근하였다.\n00분 09초, ${a.action}의 순간이 지나갔다.\n00분 12초, ${e[0]}가 현장에 남았다.\n00분 20초, 원고는 ${a.loss}이 흔들렸음을 인식하였다.`, 3200),
    forensicReport: cleanBlock(`문서명: 소소국과수 감정서\n감정기관: 소소국과수 생활증거분석실\n감정대상 1. ${e[0]}\n감정대상 2. ${e[1]}\n감정대상 3. ${e[2]}\n감정대상 4. ${e[3]}\n감정의견: ${a.object} 주변의 흔적, ${d[0]}, ${d[1]}을 종합하면 원고가 주장하는 생활평온의 흔들림은 현장에서 설명 가능한 수준으로 보인다.`, 3600),
    plaintiffArg: cleanBlock(`문서명: ${people.prosecutorName} 공소장\n검사는 본 사건을 단순한 해프닝으로 축소할 수 없다고 본다. ${a.actor}의 ${a.action}은 ${a.object}을 둘러싼 원고의 기대를 정면으로 흔들었다. 특히 ${d[2]}와 ${d[3]}은 이 사건이 왜 굳이 기록철에 편철되어야 하는지를 보여준다. 원고가 잃은 것은 ${a.object} 하나가 아니라 ${a.loss}이었다.`, 3000),
    defendantArg: cleanBlock(`문서명: ${people.defenderName} 답변서\n피고 측은 다음과 같이 항변한다. ${x[0] || '고의가 없었다는 주장이다.'} ${x[1] || '상황이 일상적이었다는 주장이다.'} 다만 변호인 역시 ${e[0]}과 ${d[4]}까지 완전히 없는 일로 만들기는 어렵다는 점을 인정한다.`, 2800),
    courtOpinion: cleanBlock(`문서명: 재판부 판단\n${judgeType} 재판부는 사건 배경, 분초 단위 사건일지, 소소국과수 감정서, 공소장 및 답변서를 종합한다. ${a.place}에서 발생한 ${a.action}은 거창한 피해라고 하기는 어렵다. 그러나 ${a.decisiveMoment} 앞에서 멈춘 원고의 감정은 충분히 기록할 만하다. 피고의 항변은 일부 참작하되, 원고가 주장하는 ${a.loss}의 흔들림은 인정한다.`, 3200),
    sentence: cleanBlock(`문서명: 주문 및 집행권고\n1. ${p[0]}\n2. ${p[1]}\n3. ${p[2]}\n4. ${p[3]}\n5. ${p[4]}\n6. ${p[5]}`, 2600),
    closingComment: clean(`${a.object} 앞에서 멈춘 원고의 표정은 짧았으나, 그 정적은 충분히 길었다.`, 260)
  };
}

exports.generateTrial = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 180, memory: '512MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const caseId = clean(request.data?.caseId, 180);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');
  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  const snap = await caseRef.get();
  if (!snap.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
  const c = snap.data();
  if (c.userId !== request.auth.uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
  if (c.status === 'completed') {
    const resultSnap = await resultRef.get().catch(() => null);
    if (resultSnap && resultSnap.exists) return { success: true, skipped: 'completed' };
  }
  const judgeType = pick(JUDGES, c.caseTitle);
  const people = { courtroom: pick(COURTS, c.caseTitle), recordClerk: pick(CLERKS, c.caseTitle), prosecutorName: pick(PROSECUTORS, c.caseTitle), defenderName: pick(DEFENDERS, c.caseTitle) };
  await caseRef.update({ status: 'processing', courtStage: 'hearing', updatedAt: FieldValue.serverTimestamp(), errorMessage: FieldValue.delete() });
  const analysis = await analyzeCase(c);
  const data = buildDocuments(c, people, judgeType, analysis);
  await resultRef.set({
    isPublic: c.isPublic !== false, docketNumber: c.docketNumber || '', courtName: '소소킹 황당재판소', courtroom: people.courtroom, division: '제3황당재판부', recordClerk: people.recordClerk, prosecutorName: people.prosecutorName, defenderName: people.defenderName,
    caseTitle: data.refinedCaseTitle, originalCaseTitle: c.caseTitle || '', refinedCaseTitle: data.refinedCaseTitle, absurdityTitle: data.absurdityTitle, caseDescription: c.caseDescription || '', expandedCase: data.expandedCase,
    analysis, absurdDetails: data.absurdDetails, evidenceBits: data.evidenceBits, grievanceIndex: c.grievanceIndex || 5, nickname: c.nickname || '익명 원고', desiredVerdict: c.desiredVerdict || '', judgeType,
    caseTimeline: data.caseTimeline, forensicReport: data.forensicReport, plaintiffArg: data.plaintiffArg, defendantArg: data.defendantArg, courtOpinion: data.courtOpinion, sentence: data.sentence, closingComment: data.closingComment,
    aiGenerated: true, resultVersion: 'dynamic-analysis-v1', executionOrder: '본 기록은 실제 법률문서가 아니며, 당사자 사이의 웃음 회복을 위한 임의적 기록입니다.', courtStage: 'sentenced', createdAt: c.createdAt || FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await caseRef.update({ status: 'completed', courtStage: 'sentenced', completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), errorMessage: FieldValue.delete() });
  return { success: true, caseId, resultVersion: 'dynamic-analysis-v1' };
});
