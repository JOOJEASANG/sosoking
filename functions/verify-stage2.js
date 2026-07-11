const assert = require('node:assert/strict');
const {
  ROLE_TRIAL_VERSION,
  makeDocketNumber,
  assignCourt,
  normalizeTrial,
  validateTrial,
  buildPrompt,
  buildCompatibilityJudgment,
  isCompleteRoleTrial,
} = require('./role-based-trial');

const input = {
  title: '공원 빵 리트리버 무단취식 사건',
  caseDescription: '공원 벤치에서 빵을 먹던 원고가 잠시 휴대폰을 보는 사이 산책 중인 리트리버가 남은 빵을 전부 먹어버렸다. 원고는 간식을 잃었고 보호자에게 같은 빵과 사과를 원한다.',
  desiredVerdict: '보호자가 같은 빵을 배상하고 다음 산책부터 음식과 거리를 두게 해달라.',
  grievanceIndex: 7,
  defendantName: '리트리버와 보호자',
  judgeType: '과몰입형',
  category: 'food',
};

const caseId = 'abc123def456';
const docketNumber = makeDocketNumber(caseId, new Date('2026-07-11T00:00:00Z'));
const court = assignCourt(input, caseId);
const prompt = buildPrompt(input, court, docketNumber);

assert.equal(ROLE_TRIAL_VERSION, 'role-based-trial-v10');
assert.match(docketNumber, /^2026황당[A-Z0-9]{6}$/);
assert.ok(court.courtroom.includes('법정'));
assert.ok(court.analystName);
assert.ok(court.prosecutorName);
assert.ok(court.defenderName);
assert.ok(prompt.includes('역할 분리형 예능 재판'));
assert.ok(prompt.includes('가상 CCTV'));
assert.ok(prompt.includes('사소한 사건'));
assert.ok(prompt.includes('지나치게 진지한 관료적 형식'));
assert.ok(prompt.includes('원고 측은 억울함을 최대치'));
assert.ok(prompt.includes('주문 1→2→3'));

const trial = normalizeTrial({
  refinedCaseTitle: input.title,
  expandedCase: '접수담당자는 공원 벤치에서 빵을 먹던 원고가 휴대폰 화면을 확인하는 사이 리트리버가 남은 빵을 전부 먹었다는 진술을 확인했다. 원고가 고개를 돌린 순간 간식의 점유 상태가 바뀌었고, 원고에게 남은 것은 빈 포장지와 보호자를 바라보는 시간뿐이었다. 이 사건의 핵심은 리트리버의 식욕 자체보다 보호자가 타인의 음식과 산책 동선을 분리하지 못한 데 있다. 원고는 같은 빵과 분명한 사과를 요구하고 있다.',
  caseTimeline: '수사 진행기록\n1. 15시 02분경 원고가 공원 벤치에 앉아 빵을 먹기 시작했다.\n2. 15시 04분경 원고가 휴대폰을 확인하며 시선을 아래로 옮겼다.\n3. 황당재판용 가상 동선 재구성 결과 리트리버가 벤치 방향으로 접근한 것으로 표시됐다.\n4. 원고가 다시 고개를 들었을 때 남은 빵은 확인되지 않았고 리트리버의 씹는 동작만 관찰 대상으로 남았다.\n5. 보호자는 상황을 뒤늦게 확인했고 원고는 같은 빵의 배상과 사과를 요청했다.',
  forensicReport: '예능용 가상 감식보고서\n본 보고서는 실제 CCTV를 열람한 결과가 아니라 접수진술을 바탕으로 만든 황당재판용 재구성이다. 가상 CCTV 프레임 184번에서 원고의 시선이 휴대폰으로 이동한 것으로 설정했고, 프레임 191번에서 리트리버의 코가 빵 방향으로 12도 회전한 것으로 분석했다. 빵 접근 속도는 재판부 임의 단위인 초당 3.7간식으로 측정됐으며, 목줄 통제력은 42점, 식욕 추진력은 96점으로 산출됐다. 증거물은 실제 수집물이 아니라 사건 장면을 과장해 설명하기 위한 오락용 감식 항목이다.',
  plaintiffArg: '황당검사 강엄숙은 원고가 공원에서 정당하게 소유하고 있던 빵을 단 몇 초의 시선 이동 때문에 전부 잃었다고 주장한다. 원고는 식사를 포기할 의사도, 리트리버에게 간식을 기부할 의사도 표시하지 않았으며, 보호자가 같은 빵을 배상하고 타인의 음식에 접근하지 않게 관리해야 한다고 요청한다.',
  defendantArg: '국선변호인 안대수롭은 리트리버가 공원에서 가까이 놓인 음식 냄새를 산책 보상으로 오인했을 가능성을 제기한다. 피고는 소유권을 이전받았다고 주장하는 것이 아니라 냄새와 거리의 조합이 너무 설득력 있었다고 항변하며, 보호자의 반응이 식욕보다 늦었던 점만 일부 인정한다.',
  courtOpinion: '과몰입형 재판부는 원고가 휴대폰을 확인한 몇 초가 빵 소유권 포기 시간으로 해석될 수 없다고 판단한다. 리트리버의 본능은 형사처벌 대상이 아니지만 보호자가 목줄과 음식 사이의 안전거리를 확보하지 못한 책임은 남는다. 재판부는 식욕 추진력 96점에 비해 통제력 42점이 현저히 낮았다는 가상 감식 결과를 참고하되, 이는 오락용 판단 기준임을 명시한다. 따라서 원고의 배상 요구는 이유 있고 피고 측 변론은 귀엽지만 받아들이기 어렵다.',
  sentence: '주문 1. 보호자는 원고에게 빵 무단취식 경위를 빠뜨리지 않고 사과하라.\n주문 2. 보호자는 원고가 잃은 것과 같은 빵 또는 원고가 직접 고른 동급 빵을 배상하라.\n주문 3. 다음 산책부터 리트리버가 타인의 간식 반경 2미터 안으로 접근할 경우 보호자는 즉시 “이 빵은 네 사건이 아니다”라고 고지하고 동선을 변경하라.',
  closingComment: '재판장 한마디: “목줄은 잡고 있었지만 사건의 주도권은 빵이 쥐고 있었습니다.”',
  absurdDetails: ['원고의 시선 이동 시간보다 짧았던 빵 소멸 시간', '목줄 통제력과 식욕 추진력의 점수 차이', '공원 벤치가 임시 증거보전 장소로 지정됨', '빈 포장지가 원고 측 최후 진술을 대신함', '리트리버의 씹는 동작이 사건 종료 신호가 됨', '보호자의 상황 파악이 피고의 식사 완료보다 늦음'],
  evidenceBits: ['증 제1호 빈 빵 포장지: 원고의 간식이 존재했다는 정황을 보여준다.', '증 제2호 가상 CCTV 프레임 184번: 원고의 시선 이동 시점을 재구성한다.', '증 제3호 식욕 추진력 측정표: 리트리버의 접근 의지를 예능용 수치로 표현한다.', '증 제4호 목줄 동선도: 보호자와 벤치 사이의 통제 공백을 가상으로 표시한다.'],
  defendantExcuses: ['빵 냄새가 산책 보상처럼 느껴졌다는 항변', '원고가 잠시 보지 않아 배식 완료 신호로 오인했다는 항변', '리트리버는 포장지의 소유권 표시를 읽을 수 없다는 항변'],
  penaltyIdeas: ['같은 빵 배상', '간식 반경 접근 금지', '산책 전 소유권 교육', '재발 시 보호자의 공개 간식 경계 선언'],
}, {}, input.title, court, docketNumber);

const quality = validateTrial(trial, input);
assert.equal(quality.passed, true, JSON.stringify(quality));
assert.equal(isCompleteRoleTrial(trial), true);
assert.equal(trial.evidenceBits.length, 4);
assert.ok(trial.forensicReport.includes('가상'));
assert.ok(trial.caseTimeline.includes('5.'));

const judgment = buildCompatibilityJudgment(trial, input);
assert.equal(judgment.engineVersion, 4);
assert.equal(judgment.orders.length, 3);
assert.ok(judgment.investigation.includes('가상 감식보고서'));
assert.ok(judgment.legalNotice.includes('가상 재구성'));

console.log('Verified role-based trial docket, personnel, investigation timeline, fictional CCTV notice, courtroom arguments and escalating orders.');
