'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { HISTORY_EVENTS, eventByDay } = require('./republic-history-events');

const REGION = 'asia-northeast3';

const RESULT_NOTES = Object.freeze({
  1: '실제 한국 현대사에서는 1987년 민주화 요구와 직선제 개헌 흐름이 이어지며 대통령 직선제 중심의 새 헌정 질서가 열렸습니다.',
  2: '1987년 개헌으로 대통령 5년 단임제와 헌정 질서의 기본 틀이 마련됐고, 이후 권력구조 개편 논의의 기준점이 됐습니다.',
  3: '첫 직선 대선 국면에서는 민주화 열망과 정당·후보 간 분열이 함께 나타났고, 선거정치의 현실적 계산이 본격화됐습니다.',
  4: '1988년 국제 행사는 한국 사회가 세계 무대에 본격적으로 자신을 드러내는 계기가 됐고, 국가 이미지와 내부 민주화 과제가 동시에 부각됐습니다.',
  5: '1990년 대형 정계개편은 안정적 국정 운영이라는 평가와 정치적 명분 훼손이라는 비판을 동시에 남겼습니다.',
  6: '문민정부 출범 이후 군 권력 약화와 과거 권력 구조 정비가 추진되며 민간 정치 중심의 제도 변화가 강화됐습니다.',
  7: '금융실명제는 부패와 음성 자금 관행을 줄이는 제도 개혁으로 평가받지만, 시행 당시 경제 충격과 시장 반응도 함께 논의됐습니다.',
  8: '1995년 지방자치 본격화는 중앙집권적 정치 운영에서 지역 자치와 책임 정치로 무게가 이동하는 전환점이 됐습니다.',
  9: '1997년 외환위기 전조는 고성장 구조의 취약성을 드러냈고, 금융·기업 구조와 국가 위기 대응 능력이 핵심 쟁점이 됐습니다.',
  10: '외환위기와 구제금융 국면은 구조조정, 실업, 사회안전망 논쟁을 낳으며 경제정책과 복지정책의 균형 문제를 남겼습니다.',
  11: '1998년 평화적 정권교체는 선거를 통한 권력 교체가 제도적으로 가능하다는 사실을 확인시킨 중요한 사건으로 평가됩니다.',
  12: '2000년 남북 화해 분위기와 정상회담은 평화 기대를 키웠지만, 안보 검증과 지속 가능성에 대한 논쟁도 함께 불러왔습니다.',
  13: '인터넷 정치와 온라인 여론은 시민 참여를 넓히는 동시에 여론 왜곡, 진영화, 속도 경쟁이라는 새 문제를 만들었습니다.',
  14: '대통령 탄핵과 헌재 판단은 권력 견제 장치가 실제로 작동할 수 있음을 보여줬고, 이후 광장과 제도정치의 관계를 다시 묻게 했습니다.',
  15: '정권 재편과 선거 연합은 정책 노선, 지역 구도, 정치개혁의 현실적 한계를 동시에 보여준 국면으로 볼 수 있습니다.',
  16: '세계 금융위기 이후 경제정책은 성장, 재정, 복지, 고용 안정 사이의 균형을 어떻게 잡을지에 집중됐습니다.',
  17: '복지 확대 논쟁은 보편복지와 선별복지, 재정 지속 가능성, 세대별 부담 문제를 한국 정치의 주요 의제로 올렸습니다.',
  18: '안보 위기 국면에서는 초당적 대응과 정부 책임 검증, 표현의 자유와 국가안보 사이의 균형 문제가 함께 제기됐습니다.',
  19: 'SNS 선거와 온라인 프레임 전쟁은 선거운동의 방식을 바꾸고, 시민 참여와 여론 양극화를 동시에 키웠습니다.',
  20: '대형 참사 이후에는 국가 책임, 안전 시스템, 진상 규명, 공동체 회복이 정치와 제도 개혁의 핵심 쟁점이 됐습니다.',
  21: '2016년 촛불집회와 탄핵 국면은 시민 행동, 국회 표결, 헌법재판 절차가 연결된 대표적 헌정 사건으로 평가됩니다.',
  22: '탄핵 이후 조기 대선은 개혁 기대를 크게 높였지만, 이후 국정 운영에서는 속도와 우선순위가 중요한 문제가 됐습니다.',
  23: '2018년 남북 대화 국면은 평화의 상징성을 키웠지만, 실질적 합의 이행과 검증 문제는 계속 남았습니다.',
  24: '권력기관 개혁 논쟁은 수사 독립성, 민주적 통제, 진영 갈등이 겹치며 한국 정치의 장기 쟁점이 됐습니다.',
  25: '감염병 위기 대응은 국가 통제, 기본권 제한, 방역 효과, 투명성 사이의 균형을 묻는 중요한 사례가 됐습니다.',
  26: '부동산 가격 급등은 자산 격차, 청년 불안, 공급과 규제, 금융 정책을 둘러싼 큰 정치 쟁점으로 이어졌습니다.',
  27: '근소한 대선 승부는 승자의 정당성과 통합 정치, 패자의 대표성, 양극화 완화 문제를 동시에 남겼습니다.',
  28: '여소야대 국면은 강한 의회 견제와 국정 교착 사이의 긴장을 보여주며 협상 제도와 권한 배분 문제를 부각시켰습니다.',
  29: '대통령 권한과 헌정 안정성 논쟁은 비상권한, 사후 통제, 국회와 헌재의 역할을 다시 점검하게 만든 주제입니다.',
  30: '개헌과 권력구조 개편 논의는 대통령제의 장단점, 분권, 결선투표, 중임제 등 제도 설계 문제를 종합적으로 다룹니다.',
});

const METRIC_LABELS = Object.freeze({
  stability: '안정성', reform: '개혁성', conflict: '갈등도', constitutional: '헌정성', diplomacy: '외교력', trust: '신뢰도', coalition: '연합력', security: '안보', economy: '경제', welfare: '복지', democracy: '민주성', localPower: '분권성', budget: '재정', media: '미디어', youth: '청년성', safety: '안전', liberty: '자유', expectation: '기대감', legitimacy: '정당성', parliament: '의회성',
});

const PARTY_META = Object.freeze({
  national: { name: '국민질서당', emoji: '🛡️', color: '#263B66', role: '질서·안보·안정 중심의 보수 성향 가상 정당' },
  youth: { name: '시민개혁당', emoji: '🕯️', color: '#B8323B', role: '개혁·복지·시민권 중심의 진보 성향 가상 정당' },
  center: { name: '국민통합당', emoji: '⚖️', color: '#2F7D6E', role: '협치·균형·실용 중심의 중도 성향 가상 정당' },
});

function cleanText(value, max = 500) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function scoreFromEffects(effects, bias = {}) {
  const entries = Object.entries(effects || {});
  return entries.map(([key, value]) => {
    const raw = Number(value || 0) + Number(bias[key] || 0);
    return { key, label: METRIC_LABELS[key] || key, value: Math.max(-5, Math.min(5, raw)) };
  });
}

function buildChoices(event) {
  const base = event.effects || {};
  return [
    {
      id: 'national',
      partyId: 'national',
      title: PARTY_META.national.name + '식 선택',
      emoji: PARTY_META.national.emoji,
      stance: event.stances.national,
      result: '질서와 행정 안정은 높아지지만, 개혁 요구가 늦춰졌다는 비판을 받을 수 있습니다.',
      scores: scoreFromEffects(base, { stability: 2, security: 1, reform: -1, conflict: -1 }),
    },
    {
      id: 'youth',
      partyId: 'youth',
      title: PARTY_META.youth.name + '식 선택',
      emoji: PARTY_META.youth.emoji,
      stance: event.stances.youth,
      result: '개혁성과 시민 참여는 강해지지만, 사회 갈등과 재정·행정 부담이 커질 수 있습니다.',
      scores: scoreFromEffects(base, { reform: 2, democracy: 1, welfare: 1, conflict: 1, stability: -1 }),
    },
    {
      id: 'center',
      partyId: 'center',
      title: PARTY_META.center.name + '식 선택',
      emoji: PARTY_META.center.emoji,
      stance: event.stances.center,
      result: '갈등을 줄이고 실행 가능성을 높이지만, 선명성이 약하다는 공격을 받을 수 있습니다.',
      scores: scoreFromEffects(base, { coalition: 2, stability: 1, conflict: -1, reform: 0 }),
    },
  ];
}

function toPublicEvent(event, detail = false) {
  const base = {
    day: event.day,
    era: cleanText(event.era, 80),
    motifYear: event.motifYear,
    motif: cleanText(event.motif, 160),
    title: cleanText(event.parodyTitle, 80),
    summary: cleanText(event.issueSummary, 220),
    question: cleanText(event.question, 120),
    actualResult: cleanText(RESULT_NOTES[event.day] || '실제 역사 결과 요약은 준비 중입니다.', 600),
    tags: [event.era, `${event.motifYear}년`, '역사정치', '가상정당'].filter(Boolean),
  };
  if (!detail) return base;
  return {
    ...base,
    stances: {
      national: cleanText(event.stances.national, 220),
      youth: cleanText(event.stances.youth, 220),
      center: cleanText(event.stances.center, 220),
    },
    choices: buildChoices(event),
    partyMeta: PARTY_META,
    effects: scoreFromEffects(event.effects || {}),
    notice: '사건·제도·시대 배경은 실제 한국 현대사를 모티브로 하지만, 게임 속 인물과 정당은 모두 가상입니다.',
    sourceGuide: [
      `${event.motifYear}년 ${event.motif}`,
      `${event.era} 한국 현대사`,
      `${event.motif} 배경 결과`,
    ],
  };
}

const getHistoryArchive = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const limit = Math.min(100, Math.max(1, Number(request.data?.limit || 60)));
  const events = HISTORY_EVENTS.slice(0, limit).map(event => toPublicEvent(event, false));
  const eras = [...new Set(events.map(e => e.era))];
  return { ok: true, count: events.length, eras, events };
});

const getHistoryEvent = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const day = Number(request.data?.day || 1);
  if (!Number.isFinite(day) || day < 1 || day > HISTORY_EVENTS.length) {
    throw new HttpsError('invalid-argument', '존재하지 않는 역사 사건입니다.');
  }
  return { ok: true, event: toPublicEvent(eventByDay(day), true) };
});

module.exports = { getHistoryArchive, getHistoryEvent };
