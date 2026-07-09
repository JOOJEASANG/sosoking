const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { db, FieldValue, REGION, clean, pick, titleFromDescription } = require('./fresh-utils');

const JUDGES = ['엄벌주의형','감성형','현실주의형','과몰입형','피곤형','논리집착형','드립형'];
const COURTS = ['제404호 황당법정','제101호 소소분쟁법정','제777호 과몰입법정'];
const CLERKS = ['정기록 참여관','나과장 기록관','박진지 서기관'];
const PROSECUTORS = ['황당검사 강엄숙','한입권 담당 나과장 검사','소소공소부 박과몰입 검사'];
const DEFENDERS = ['피고측 변호인 최그정도','국선변호인 안대수롭','생활변호센터 조그럴수도 변호사'];

function infer(desc, title = '') {
  const t = `${title} ${desc}`;
  const dogBread = /개|강아지|리트리버|반려견|견주/.test(t) && /빵|샌드위치|베이글|크루아상|소금빵|간식/.test(t);
  const coffee = /카누|커피|탕비실|믹스커피/.test(t);
  const room = /방|문|동생|집|방문/.test(t);
  const remote = /리모컨|채널|티비|TV/.test(t);
  if (dogBread) return { kind:'dogBread', place:'공원 벤치', actor:'리트리버', item:'빵', action:'한입 점령' };
  if (coffee) return { kind:'coffee', place:'회사 탕비실', actor:'마지막 커피 사용자', item:'카누 봉지', action:'봉지 방치' };
  if (room) return { kind:'room', place:'방 문 앞', actor:'동생', item:'방문', action:'닫힘 의무 방치' };
  if (remote) return { kind:'remote', place:'거실 소파', actor:'채널 점유자', item:'리모컨', action:'장기 점유' };
  return { kind:'general', place:'사건 현장', actor:'피고', item:'문제의 물건', action:'평온 흔들기' };
}
function sceneParts(k) {
  if (k.kind === 'dogBread') return {
    details: ['벤치 위에서 반쯤 열린 빵 봉투','원고가 물병 뚜껑을 돌리던 3초의 공백','산책줄이 허용한 42cm의 자유','빵 봉투를 향해 낮아진 리트리버의 코끝','원고의 손바닥에 남은 빵 기름기','봉투 바닥의 반달 모양 부스러기','견주의 어머와 얘가 왜 이러지 사이의 침묵','피고견의 지나치게 맑은 눈망울','벤치 아래로 떨어진 깨알 같은 빵가루 4점','사라진 마지막 한입권','입가에 잠깐 번진 빵 냄새의 잔향','원고가 들고 있던 음료의 의미 없는 차가움'],
    evidence: ['봉투 바닥의 반달형 부스러기 집중도','빵 냄새가 남은 손바닥 표면','벤치 전방 42cm 지점의 접근 가능 범위','산책줄 장력의 순간적 완화','리트리버 입가 주변의 빵가루 추정 흔적','원고의 시선이 물병 쪽으로 이동한 시간대','견주의 당황 표정 지속 시간','피고견의 침묵과 꼬리 흔들림의 불일치'],
    penalties: ['견주는 동일 규격의 빵 1개와 예비빵 1개를 제공한다.','피고견은 빵 봉투와 30cm 안전거리를 유지한다.','견주는 산책줄 42cm 자유구역을 사건 장소에서 1회 재측정한다.','원고에게 마지막 한입권 회복용 간식을 제공한다.','피고견은 빵 앞에서 앉아 5초간 대기 훈련을 실시한다.','견주는 별일 아니죠라는 말을 하기 전 봉투 바닥을 확인한다.']
  };
  if (k.kind === 'coffee') return {
    details: ['탕비실 선반 위 혼자 누운 빈 카누 봉지','새 커피를 뜯지 않고 떠난 자의 뒷모습','원고가 컵을 들고 멈춘 2초','쓰레기통까지 불과 세 걸음의 거리','봉지 절취선에 남은 무책임한 각도','마지막 한 봉지라는 사실을 외면한 공기','뜨거운 물만 받아놓은 원고의 컵','아무도 보충하지 않은 박스의 공허함','카누 향은 있는데 카누는 없는 모순','탕비실 문 앞에서 작아진 기대','봉지 끝에 남은 커피 가루 한 점','사무실 전체를 감싼 무언의 책임 회피'],
    evidence: ['빈 봉지의 접힘 방향','쓰레기통과 선반 사이의 짧은 거리','컵 안의 뜨거운 물 온도','봉지 절취선의 방치 상태','커피 박스 내부의 공백','원고의 정지된 손 위치','탕비실 문고리 접촉 가능성','마지막 사용자 추정 동선'],
    penalties: ['피고는 카누 1박스를 보충한다.','마지막 봉지를 쓴 사람은 빈 봉지를 즉시 처리한다.','탕비실에 마지막 사용자 고백 메모를 1회 부착한다.','원고에게 대체 커피 1잔을 제공한다.','피고는 쓰레기통까지 세 걸음을 직접 왕복한다.','카누 박스 잔량 확인 의무를 3일간 수행한다.']
  };
  if (k.kind === 'room') return {
    details: ['문틈으로 새어 나온 복도 불빛','손잡이 끝에 걸린 닫다 만 의지','원고가 다시 일어나야 했던 이불의 굴곡','동생의 괜찮잖아 표정','문이 닫힌 척 버틴 7cm의 틈','방 안으로 들어온 쓸데없는 바람','두 번째로 불러야 했던 원고의 목소리','닫힘과 열림 사이의 회색지대','문 앞에서 멈춘 발소리','원고의 집중력을 자른 복도 소음','방문이 남긴 얇은 배신감','가족이라는 이유로 흐려진 책임선'],
    evidence: ['문틈 7cm 추정 간격','복도 불빛 유입 각도','문고리 접촉 흔적','원고의 이불 재정렬 흔적','방 안 바람 유입 방향','동생의 이동 동선','두 번째 호출 시각','문짝의 반쯤 닫힌 위치'],
    penalties: ['피고는 방문 완전닫힘 시범을 3회 실시한다.','피고는 문틈 0cm 확인 후 퇴장한다.','원고에게 방해받은 집중시간 5분을 보전한다.','피고는 손잡이를 끝까지 당기는 훈련을 수행한다.','같은 상황에서 괜찮잖아 발언을 보류한다.','방문 앞에서 닫힘 여부를 소리 없이 확인한다.']
  };
  const details = [`${k.place}에 남은 묘하게 긴 정적`,`${k.item}을 향해 열린 운명의 각도`,`${k.actor}의 지나치게 평온한 표정`,`원고가 믿고 있던 ${k.item}의 안전지대`,`${k.action} 직후 멈춘 원고의 손`,`현장을 지배한 3초의 공백`,`${k.item} 주변에 남은 생활 흔적`,`피고 측의 너무 자연스러운 태도`,`원고의 표정에 남은 납득 불가`,`사라진 마지막 선택권`,`사건 뒤 더 크게 들린 주변 소리`,`누구도 먼저 설명하지 않은 침묵`];
  const evidence = [`${k.item} 주변의 미세 흔적`,`${k.place} 전방의 접근 가능 거리`,`원고의 시선이 잠시 벗어난 시간대`,`${k.actor}의 모호한 반응`,`사건 직후 원고의 손동작`,`현장에 남은 생활감`,`${k.item}이 원래 있어야 할 자리`,`피고 측 설명과 현장 분위기의 차이`];
  const penalties = [`${k.item}에 준하는 평화조치를 제공한다.`,`피고는 유사 상황에서 3초간 멈춰 확인한다.`,`원고에게 작은 간식 또는 음료를 제안한다.`,`${k.place} 주변을 사건 전 상태로 정리한다.`,`피고는 그럴 수도 있지라는 말의 사용을 1회 보류한다.`,`재발 방지를 위해 ${k.item}의 상태를 먼저 확인한다.`];
  return { details, evidence, penalties };
}
function makeResult(c, people, judgeType) {
  const desc = clean(c.caseDescription, 1000);
  const k = infer(desc, c.caseTitle);
  const parts = sceneParts(k);
  const d = parts.details;
  const e = parts.evidence;
  const p = parts.penalties;
  const baseTitle = clean(c.caseTitle, 80) || titleFromDescription(desc);
  const finalTitle = baseTitle.endsWith('사건') ? baseTitle : `${baseTitle} 사건`;
  return {
    refinedCaseTitle: finalTitle,
    absurdityTitle: `${finalTitle} 기록철`,
    absurdDetails: d,
    evidenceBits: e,
    expandedCase: `문서명: 사건 배경 및 발단 기록\n원고의 접수 내용은 짧았다. ${desc}\n그러나 ${k.place}에는 그냥 지나치기 어려운 정적이 남아 있었다. 원고에게 ${k.item}은 단순한 물건이 아니었다. 그것은 잠깐의 휴식, 오늘 하루의 작은 질서, 그리고 스스로 선택할 권리의 증표였다. 그 순간 ${k.actor}이 사건의 중심으로 들어왔다. 누구도 시작을 알리지 않았지만, ${d[1]}와 ${d[5]}은 이미 현장을 움직이고 있었다. ${k.action}이 벌어진 뒤 원고의 손은 잠시 갈 곳을 잃었다. 현장에는 ${e[0]}와 ${e[2]}가 남았다. 원고가 잃은 것은 ${k.item} 하나가 아니라 마지막 선택권과 납득 가능한 설명이었다.`,
    caseTimeline: `문서명: 분초 단위 사건일지\n00분 00초, 원고는 ${k.place}에서 ${k.item}의 안전을 믿고 있었다.\n00분 03초, ${d[5]}이 발생하였다.\n00분 07초, ${k.actor}이 사건 중심부로 접근하였다.\n00분 09초, ${k.action}의 순간이 지나갔다.\n00분 12초, ${e[0]}가 현장에 남았다.\n00분 20초, 원고는 ${d[9]}이 사라졌음을 인식하였다.`,
    forensicReport: `문서명: 소소국과수 감정서\n감정기관: 소소국과수 생활증거분석실\n감정대상 1. ${e[0]}\n감정대상 2. ${e[1]}\n감정대상 3. ${e[2]}\n감정대상 4. ${e[3]}\n감정의견: ${k.item} 주변의 흔적과 원고 진술을 종합하면, 현장의 작은 평온이 실제로 흔들렸다고 볼 여지가 있다.`,
    plaintiffArg: `문서명: ${people.prosecutorName} 공소장\n검사는 ${k.action}을 단순한 해프닝으로 볼 수 없다고 주장한다. ${d[0]}과 ${d[4]}는 원고가 누리던 작은 질서가 멈춘 순간을 보여준다. 원고가 잃은 것은 ${k.item}만이 아니라 ${d[9]}이었다.`,
    defendantArg: `문서명: ${people.defenderName} 답변서\n피고 측은 당시 상황이 지나치게 엄숙하게 해석되었다고 항변한다. ${k.actor}에게 명확한 악의가 있었다고 단정하기 어렵고, ${k.place}의 분위기도 평범했다는 주장이다. 다만 ${e[0]}과 ${d[8]}까지 완전히 지우기는 어렵다.`,
    courtOpinion: `문서명: 재판부 판단\n${judgeType} 재판부는 사건 배경, 사건일지, 감정서, 양측 주장을 종합하였다. ${k.item}을 둘러싼 원고의 기대가 흔들린 사실은 인정된다. 피고에게 거창한 책임을 묻지는 않지만, ${d[9]} 앞에서 멈춘 원고의 표정을 없는 일로 만들 수는 없다.`,
    sentence: `문서명: 주문 및 집행권고\n1. ${p[0]}\n2. ${p[1]}\n3. ${p[2]}\n4. ${p[3]}\n5. ${p[4]}\n6. ${p[5]}`,
    closingComment: `${k.item} 앞에서 멈춘 원고의 표정은 짧았으나, 그 정적은 충분히 길었다.`
  };
}

exports.generateTrial = onCall({ region: REGION, timeoutSeconds: 120, memory: '256MiB' }, async request => {
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
  const data = makeResult(c, people, judgeType);
  await resultRef.set({
    isPublic: c.isPublic !== false, docketNumber: c.docketNumber || '', courtName: '소소킹 황당재판소', courtroom: people.courtroom, division: '제3황당재판부', recordClerk: people.recordClerk, prosecutorName: people.prosecutorName, defenderName: people.defenderName,
    caseTitle: data.refinedCaseTitle, originalCaseTitle: c.caseTitle || '', refinedCaseTitle: data.refinedCaseTitle, absurdityTitle: data.absurdityTitle, caseDescription: c.caseDescription || '', expandedCase: data.expandedCase,
    absurdDetails: data.absurdDetails, evidenceBits: data.evidenceBits, grievanceIndex: c.grievanceIndex || 5, nickname: c.nickname || '익명 원고', desiredVerdict: c.desiredVerdict || '', judgeType,
    caseTimeline: data.caseTimeline, forensicReport: data.forensicReport, plaintiffArg: data.plaintiffArg, defendantArg: data.defendantArg, courtOpinion: data.courtOpinion, sentence: data.sentence, closingComment: data.closingComment,
    aiGenerated: false, resultVersion: 'fresh-safe-v2', executionOrder: '본 기록은 실제 법률문서가 아니며, 당사자 사이의 웃음 회복을 위한 임의적 기록입니다.', courtStage: 'sentenced', createdAt: c.createdAt || FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await caseRef.update({ status: 'completed', courtStage: 'sentenced', completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), errorMessage: FieldValue.delete() });
  return { success: true, caseId, resultVersion: 'fresh-safe-v2' };
});
