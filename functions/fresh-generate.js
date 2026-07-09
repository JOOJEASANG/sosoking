const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { db, FieldValue, REGION, clean, cleanBlock, pick, safeJson, buildModel, loadSettings, kstDateKey, titleFromDescription } = require('./fresh-utils');

const geminiKey = defineSecret('GEMINI_API_KEY');
const JUDGES = ['엄벌주의형','감성형','현실주의형','과몰입형','피곤형','논리집착형','드립형'];
const COURTS = ['제404호 황당법정','제101호 사소분쟁법정','제777호 과몰입법정'];
const NAMES = {
  clerk: ['정기록 참여관','나과장 기록관','박진지 서기관'],
  prosecutor: ['황당검사 강엄숙','한입권 담당 나과장 검사','소소공소부 박과몰입 검사'],
  defender: ['피고측 변호인 최그정도','국선변호인 안대수롭','생활변호센터 조그럴수도 변호사']
};

function infer(desc, title = '') {
  const t = `${title} ${desc}`;
  const dogBread = /개|강아지|리트리버|반려견|견주/.test(t) && /빵|샌드위치|베이글|크루아상|소금빵|간식/.test(t);
  const coffee = /카누|커피|탕비실/.test(t);
  const room = /방|문|동생|집/.test(t);
  if (dogBread) return { place:'공원 벤치', actor:'리트리버', item:'빵', action:'한입 점령' };
  if (coffee) return { place:'회사 탕비실', actor:'마지막 커피 사용자', item:'카누 봉지', action:'봉지 방치' };
  if (room) return { place:'방 문 앞', actor:'동생', item:'방문', action:'닫힘 의무 방치' };
  return { place:'사건 현장', actor:'피고', item:'문제의 물건', action:'평온 흔들기' };
}
function localResult(c, people, judgeType) {
  const desc = clean(c.caseDescription, 1000);
  const k = infer(desc, c.caseTitle);
  const title = clean(c.caseTitle, 80) || titleFromDescription(desc);
  const finalTitle = title.endsWith('사건') ? title : `${title} 사건`;
  const details = [
    `${k.place}에 남은 묘하게 긴 정적`, `${k.item}을 향해 열린 운명의 각도`, `${k.actor}의 지나치게 평온한 표정`, `원고가 믿고 있던 ${k.item}의 안전지대`,
    `${k.action} 직후 멈춘 원고의 손`, `현장을 지배한 3초의 공백`, `${k.item} 주변에 남은 생활 흔적`, `피고 측의 너무 자연스러운 태도`,
    `원고의 표정에 남은 납득 불가`, `사라진 마지막 선택권`, `사건 뒤 더 크게 들린 주변 소리`, `누구도 먼저 설명하지 않은 침묵`
  ];
  const evidence = [
    `${k.item} 주변의 미세 흔적`, `${k.place} 전방의 접근 가능 거리`, `원고의 시선이 잠시 벗어난 시간대`, `${k.actor}의 모호한 반응`,
    `사건 직후 원고의 손동작`, `현장에 남은 생활감`, `${k.item}이 원래 있어야 할 자리`, `피고 측 설명과 현장 분위기의 차이`
  ];
  const penalties = [
    `${k.item}에 준하는 평화조치를 제공한다.`, `피고는 유사 상황에서 3초간 멈춰 확인한다.`, `원고에게 작은 간식 또는 음료를 제안한다.`, `${k.place} 주변을 사건 전 상태로 정리한다.`, `피고는 그럴 수도 있지라는 말을 1회 보류한다.`, `재발 방지를 위해 ${k.item}의 상태를 먼저 확인한다.`
  ];
  return {
    refinedCaseTitle: finalTitle,
    absurdityTitle: `${finalTitle} 기록철`,
    absurdDetails: details,
    evidenceBits: evidence,
    expandedCase: `문서명: 사건 배경 및 발단 기록\n원고의 접수 내용은 짧았다. ${desc}\n그러나 ${k.place}에는 그냥 지나치기 어려운 정적이 남아 있었다. 원고에게 ${k.item}은 단순한 물건이 아니었다. 그것은 잠깐의 휴식, 오늘 하루의 작은 질서, 그리고 스스로 선택할 권리의 증표였다. 그 순간 ${k.actor}이 사건의 중심으로 들어왔다. 누구도 시작을 알리지 않았지만, ${details[1]}와 ${details[5]}은 이미 현장을 움직이고 있었다. ${k.action}이 벌어진 뒤 원고의 손은 잠시 갈 곳을 잃었다. 현장에는 ${evidence[0]}와 ${evidence[2]}가 남았다. 원고가 잃은 것은 ${k.item} 하나가 아니라 마지막 선택권과 납득 가능한 설명이었다.`,
    caseTimeline: `문서명: 분초 단위 사건일지\n00분 00초, 원고는 ${k.place}에서 ${k.item}의 안전을 믿고 있었다.\n00분 03초, ${details[5]}이 발생하였다.\n00분 07초, ${k.actor}이 사건 중심부로 접근하였다.\n00분 09초, ${k.action}의 순간이 지나갔다.\n00분 12초, ${evidence[0]}가 현장에 남았다.\n00분 20초, 원고는 ${details[9]}이 사라졌음을 인식하였다.`,
    forensicReport: `문서명: 소소국과수 감정서\n감정기관: 소소국과수 생활증거분석실\n감정대상 1. ${evidence[0]}\n감정대상 2. ${evidence[1]}\n감정대상 3. ${evidence[2]}\n감정대상 4. ${evidence[3]}\n감정의견: ${k.item} 주변의 흔적과 원고 진술을 종합하면, 현장의 작은 평온이 실제로 흔들렸다고 볼 여지가 있다.`,
    plaintiffArg: `문서명: ${people.prosecutorName} 공소장\n검사는 ${k.action}을 단순한 해프닝으로 볼 수 없다고 주장한다. ${details[0]}과 ${details[4]}는 원고가 누리던 작은 질서가 멈춘 순간을 보여준다. 원고가 잃은 것은 ${k.item}만이 아니라 ${details[9]}이었다.`,
    defendantArg: `문서명: ${people.defenderName} 답변서\n피고 측은 당시 상황이 지나치게 엄숙하게 해석되었다고 항변한다. ${k.actor}에게 명확한 악의가 있었다고 단정하기 어렵고, ${k.place}의 분위기도 평범했다는 주장이다. 다만 ${evidence[0]}과 ${details[8]}까지 완전히 지우기는 어렵다.`,
    courtOpinion: `문서명: 재판부 판단\n${judgeType} 재판부는 사건 배경, 사건일지, 감정서, 양측 주장을 종합하였다. ${k.item}을 둘러싼 원고의 기대가 흔들린 사실은 인정된다. 피고에게 거창한 책임을 묻지는 않지만, ${details[9]} 앞에서 멈춘 원고의 표정을 없는 일로 만들 수는 없다.`,
    sentence: `문서명: 주문 및 집행권고\n1. ${penalties[0]}\n2. ${penalties[1]}\n3. ${penalties[2]}\n4. ${penalties[3]}\n5. ${penalties[4]}\n6. ${penalties[5]}`,
    closingComment: `${k.item} 앞에서 멈춘 원고의 표정은 짧았으나, 그 정적은 충분히 길었다.`
  };
}
async function makeAi(c, people, judgeType, modelName) {
  const model = buildModel(modelName, 0.95);
  const prompt = `짧은 생활 사건을 아주 진지하고 웃긴 황당재판 기록으로 작성한다. 장면을 키우고 구체물을 많이 넣는다. JSON만 출력한다.
사건명: ${clean(c.caseTitle, 80)}
접수내용: ${clean(c.caseDescription, 900)}
{"refinedCaseTitle":"사건명","absurdityTitle":"기록철 제목","expandedCase":"문서명: 사건 배경 및 발단 기록\\n...","absurdDetails":["황당 포인트"],"evidenceBits":["현장 증거"],"caseTimeline":"문서명: 분초 단위 사건일지\\n...","forensicReport":"문서명: 소소국과수 감정서\\n...","plaintiffArg":"문서명: 공소장\\n...","defendantArg":"문서명: 답변서\\n...","courtOpinion":"문서명: 재판부 판단\\n...","sentence":"문서명: 주문 및 집행권고\\n1. ...","closingComment":"마지막 한 줄"}`;
  const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
  const meta = result.response.usageMetadata || {};
  const p = safeJson(result.response.text());
  return {
    data: {
      refinedCaseTitle: clean(p.refinedCaseTitle, 80), absurdityTitle: clean(p.absurdityTitle, 120), expandedCase: cleanBlock(p.expandedCase, 4500),
      absurdDetails: Array.isArray(p.absurdDetails) ? p.absurdDetails.map(x => clean(x, 140)).filter(Boolean).slice(0, 12) : [],
      evidenceBits: Array.isArray(p.evidenceBits) ? p.evidenceBits.map(x => clean(x, 140)).filter(Boolean).slice(0, 8) : [],
      caseTimeline: cleanBlock(p.caseTimeline, 3200), forensicReport: cleanBlock(p.forensicReport, 3600), plaintiffArg: cleanBlock(p.plaintiffArg, 3000), defendantArg: cleanBlock(p.defendantArg, 2800), courtOpinion: cleanBlock(p.courtOpinion, 3200), sentence: cleanBlock(p.sentence, 2600), closingComment: clean(p.closingComment, 260)
    },
    usage: { requests: 1, inputTokens: meta.promptTokenCount || 0, outputTokens: meta.candidatesTokenCount || 0 }
  };
}

exports.generateTrial = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 300, memory: '512MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const caseId = clean(request.data?.caseId, 180);
  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  const snap = await caseRef.get();
  if (!snap.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
  const c = snap.data();
  if (c.userId !== request.auth.uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
  if (c.status === 'completed') return { success: true, skipped: 'completed' };

  const judgeType = pick(JUDGES, c.caseTitle);
  const people = { courtroom: pick(COURTS, c.caseTitle), recordClerk: pick(CLERKS, c.caseTitle), prosecutorName: pick(NAMES.prosecutor, c.caseTitle), defenderName: pick(NAMES.defender, c.caseTitle) };
  await caseRef.update({ status: 'processing', courtStage: 'hearing', updatedAt: FieldValue.serverTimestamp(), errorMessage: FieldValue.delete() });

  let data = localResult(c, people, judgeType);
  let aiGenerated = false;
  let usage = { requests: 0, inputTokens: 0, outputTokens: 0 };
  try {
    const settings = await loadSettings();
    const ai = await makeAi(c, people, judgeType, clean(settings.geminiModel, 60) || 'gemini-2.5-flash');
    usage = ai.usage;
    data = { ...data, ...ai.data };
    if (!data.absurdDetails?.length) data.absurdDetails = localResult(c, people, judgeType).absurdDetails;
    if (!data.evidenceBits?.length) data.evidenceBits = localResult(c, people, judgeType).evidenceBits;
    aiGenerated = true;
  } catch (err) {
    console.error('AI skipped, local result saved:', err);
  }

  await resultRef.set({
    isPublic: c.isPublic !== false, docketNumber: c.docketNumber || '', courtName: '소소킹 황당재판소', courtroom: people.courtroom, division: '제3황당재판부', recordClerk: people.recordClerk, prosecutorName: people.prosecutorName, defenderName: people.defenderName,
    caseTitle: data.refinedCaseTitle || c.caseTitle, originalCaseTitle: c.caseTitle || '', refinedCaseTitle: data.refinedCaseTitle || c.caseTitle, absurdityTitle: data.absurdityTitle || `${c.caseTitle} 기록철`, caseDescription: c.caseDescription || '', expandedCase: data.expandedCase,
    absurdDetails: data.absurdDetails || [], evidenceBits: data.evidenceBits || [], grievanceIndex: c.grievanceIndex || 5, nickname: c.nickname || '익명 원고', desiredVerdict: c.desiredVerdict || '', judgeType,
    caseTimeline: data.caseTimeline, forensicReport: data.forensicReport, plaintiffArg: data.plaintiffArg, defendantArg: data.defendantArg, courtOpinion: data.courtOpinion, sentence: data.sentence, closingComment: data.closingComment,
    aiGenerated, resultVersion: 'fresh-v1', executionOrder: '본 기록은 실제 법률문서가 아니며, 당사자 사이의 웃음 회복을 위한 임의적 기록입니다.', courtStage: 'sentenced', createdAt: c.createdAt || FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await caseRef.update({ status: 'completed', courtStage: 'sentenced', completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), errorMessage: FieldValue.delete() });

  try {
    const day = kstDateKey();
    await db.doc(`usage_stats/daily_${day}`).set({ date: day, geminiRequests: FieldValue.increment(usage.requests), geminiInputTokens: FieldValue.increment(usage.inputTokens), geminiOutputTokens: FieldValue.increment(usage.outputTokens), caseCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  } catch {}
  return { success: true, caseId, resultVersion: 'fresh-v1', aiGenerated };
});
