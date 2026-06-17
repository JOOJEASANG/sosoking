'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { HISTORY_EVENTS, eventByDay } = require('./republic-history-events');

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = 'asia-northeast3';

const RESULT_NOTES = Object.freeze({
  1: '실제 한국 현대사에서는 1987년 민주화 요구와 직선제 개헌 흐름이 이어지며 대통령 직선제 중심의 새 헌정 질서가 열렸습니다.',
  2: '1987년 개헌으로 대통령 5년 단임제와 헌정 질서의 기본 틀이 마련됐고, 이후 권력구조 개편 논의의 기준점이 됐습니다.',
  3: '첫 직선 대선 국면에서는 민주화 열망과 정당·후보 간 분열이 함께 나타났고, 선거정치의 현실적 계산이 본격화됐습니다.',
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
  return Object.entries(effects || {}).map(([key, value]) => {
    const raw = Number(value || 0) + Number(bias[key] || 0);
    return { key, label: METRIC_LABELS[key] || key, value: Math.max(-5, Math.min(5, raw)) };
  });
}

function metricNames(effects) {
  return Object.keys(effects || {}).map(k => METRIC_LABELS[k] || k).slice(0, 5);
}

function normalizeTimeline(items) {
  return (items || []).map((item, i) => {
    if (item && typeof item === 'object') return { label: cleanText(item.label || `단계 ${i + 1}`, 20), text: cleanText(item.text || '', 260) };
    const raw = cleanText(item, 260);
    const parts = raw.split(':');
    return parts.length > 1 ? { label: cleanText(parts.shift(), 20), text: cleanText(parts.join(':').trim(), 260) } : { label: `단계 ${i + 1}`, text: raw };
  }).filter(item => item.text);
}

function buildDetailedContext(event) {
  const metrics = metricNames(event.effects || {});
  const mainMetrics = metrics.length ? metrics.join('·') : '제도·여론·정당 전략';
  const motif = cleanText(event.motif, 160);
  const era = cleanText(event.era, 80);
  const year = Number(event.motifYear || 0);
  return {
    background: [
      `${era}의 핵심 배경은 ${motif}입니다. 이 국면에서는 권력 운영 방식과 시민 요구를 어떻게 제도화할지가 중요했습니다.`,
      `정치 쟁점은 ${mainMetrics} 문제로 번졌고, 정당·언론·시민사회는 같은 사건을 서로 다른 언어로 해석했습니다.`,
    ],
    timeline: [
      { label: '배경', text: `${year ? `${year}년 전후` : '당시'} 누적된 사회 변화와 제도 불신이 사건의 바탕이 됐습니다.` },
      { label: '전개', text: `${motif}를 둘러싸고 안정, 개혁, 타협 중 어느 방향을 택할지 정치적 선택이 요구됐습니다.` },
      { label: '결과', text: RESULT_NOTES[event.sourceDay || event.day] || event.actualResult || '실제 결과는 이후 정치 제도와 시민 여론에 장기적 영향을 남겼습니다.' },
    ],
    keyIssues: [
      `정치권은 ${event.question}`,
      `시민 입장에서는 ${mainMetrics} 중 어느 가치를 우선할지가 핵심 판단 기준이 됩니다.`,
      '제도 변화가 필요한지, 기존 질서를 유지하며 조정해야 하는지에 따라 선택 결과가 달라집니다.',
    ],
    whyImportant: `${motif}는 단순한 과거 사건이 아니라, 현재의 선거·국회·헌법·시민권 논쟁을 이해하는 기준점으로 활용할 수 있습니다.`,
    terms: metrics.map(label => ({ term: label, desc: `${label} 지표는 이 사건을 게임 선택으로 바꿀 때 결과 변화를 보여주는 기준입니다.` })),
    discussionQuestions: [event.question, '당시 시민이었다면 안정과 개혁 중 무엇을 우선했을까요?', '오늘날 같은 사건이 반복된다면 정부와 시민은 어떤 역할을 해야 할까요?'],
  };
}

function buildChoices(event) {
  const base = event.effects || {};
  const stances = event.stances || {};
  return [
    { id: 'national', partyId: 'national', title: PARTY_META.national.name + '식 선택', emoji: PARTY_META.national.emoji, stance: stances.national || '', result: '질서와 행정 안정은 높아지지만, 개혁 요구가 늦춰졌다는 비판을 받을 수 있습니다.', scores: scoreFromEffects(base, { stability: 2, security: 1, reform: -1, conflict: -1 }) },
    { id: 'youth', partyId: 'youth', title: PARTY_META.youth.name + '식 선택', emoji: PARTY_META.youth.emoji, stance: stances.youth || '', result: '개혁성과 시민 참여는 강해지지만, 사회 갈등과 재정·행정 부담이 커질 수 있습니다.', scores: scoreFromEffects(base, { reform: 2, democracy: 1, welfare: 1, conflict: 1, stability: -1 }) },
    { id: 'center', partyId: 'center', title: PARTY_META.center.name + '식 선택', emoji: PARTY_META.center.emoji, stance: stances.center || '', result: '갈등을 줄이고 실행 가능성을 높이지만, 선명성이 약하다는 공격을 받을 수 있습니다.', scores: scoreFromEffects(base, { coalition: 2, stability: 1, conflict: -1, reform: 0 }) },
  ];
}

function staticPublicEvent(event, detail = false) {
  const base = {
    day: event.day,
    sourceDay: event.day,
    era: cleanText(event.era, 80),
    motifYear: event.motifYear,
    motif: cleanText(event.motif, 160),
    title: cleanText(event.parodyTitle, 80),
    summary: cleanText(event.issueSummary, 220),
    question: cleanText(event.question, 120),
    actualResult: cleanText(RESULT_NOTES[event.day] || '실제 역사 결과 요약은 준비 중입니다.', 600),
    tags: [event.era, `${event.motifYear}년`, '역사정치', '가상정당'].filter(Boolean),
    cumulative: false,
  };
  if (!detail) return base;
  return {
    ...base,
    stances: { national: cleanText(event.stances.national, 220), youth: cleanText(event.stances.youth, 220), center: cleanText(event.stances.center, 220) },
    detail: buildDetailedContext(event),
    choices: buildChoices(event),
    partyMeta: PARTY_META,
    effects: scoreFromEffects(event.effects || {}),
    notice: '사건·제도·시대 배경은 실제 한국 현대사를 모티브로 하지만, 게임 속 인물과 정당은 모두 가상입니다.',
    sourceGuide: [`${event.motifYear}년 ${event.motif}`, `${event.era} 한국 현대사`, `${event.motif} 배경 결과`],
  };
}

function generatedPublicEvent(data, detail = false) {
  const event = {
    day: Number(data.day || 1),
    sourceDay: Number(data.sourceDay || data.day || 1),
    era: cleanText(data.era, 80),
    motifYear: data.motifYear,
    motif: cleanText(data.motif, 160),
    title: cleanText(data.title || data.parodyTitle, 100),
    summary: cleanText(data.summary || data.issueSummary, 240),
    question: cleanText(data.question, 140),
    actualResult: cleanText(data.actualResult, 700),
    tags: Array.isArray(data.tags) ? data.tags.map(t => cleanText(t, 24)).filter(Boolean).slice(0, 8) : [],
    cumulative: true,
    createdDate: data.createdDate || '',
  };
  if (!detail) return event;
  const stances = data.stances || data.partyStances || {};
  const detailData = data.detail || data.historyDetails || {};
  const detailedEvent = {
    ...event,
    stances: { national: cleanText(stances.national, 220), youth: cleanText(stances.youth, 220), center: cleanText(stances.center, 220) },
    effects: data.effects || {},
  };
  return {
    ...event,
    stances: detailedEvent.stances,
    detail: {
      ...buildDetailedContext(detailedEvent),
      background: Array.isArray(detailData.background) && detailData.background.length ? detailData.background : buildDetailedContext(detailedEvent).background,
      timeline: normalizeTimeline(detailData.timeline).length ? normalizeTimeline(detailData.timeline) : buildDetailedContext(detailedEvent).timeline,
      keyIssues: Array.isArray(detailData.keyIssues) && detailData.keyIssues.length ? detailData.keyIssues : buildDetailedContext(detailedEvent).keyIssues,
      whyImportant: cleanText(detailData.whyImportant || detailData.actualResult || event.actualResult, 700),
      discussionQuestions: Array.isArray(detailData.discussionQuestions) && detailData.discussionQuestions.length ? detailData.discussionQuestions : buildDetailedContext(detailedEvent).discussionQuestions,
    },
    choices: buildChoices(detailedEvent),
    partyMeta: PARTY_META,
    effects: scoreFromEffects(data.effects || {}),
    actualResult: event.actualResult,
    notice: '이 자료는 날짜별로 누적 생성되는 역사정치 기록입니다. 실제 한국 현대사 흐름을 모티브로 하지만 게임 속 인물과 정당은 모두 가상입니다.',
    sourceGuide: [`${event.motifYear}년 ${event.motif}`, `${event.era} 한국 현대사`, `${event.motif} 배경 결과`],
  };
}

async function readGeneratedArchive(limit) {
  const snap = await db.collection('history_archive_items').orderBy('day', 'asc').limit(limit).get();
  return snap.docs.map(doc => generatedPublicEvent(doc.data() || {}, false));
}

const getHistoryArchive = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const limit = Math.min(200, Math.max(1, Number(request.data?.limit || 80)));
  const generated = await readGeneratedArchive(limit).catch(() => []);
  if (generated.length) {
    const meta = await db.doc('history_sequence/meta').get().catch(() => null);
    const count = Number(meta?.data()?.lastDay || generated.length);
    const eras = [...new Set(generated.map(e => e.era))];
    return { ok: true, count, eras, events: generated, cumulative: true };
  }
  const events = HISTORY_EVENTS.slice(0, limit).map(event => staticPublicEvent(event, false));
  const eras = [...new Set(events.map(e => e.era))];
  return { ok: true, count: events.length, eras, events, cumulative: false };
});

const getHistoryEvent = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const day = Number(request.data?.day || 1);
  if (!Number.isFinite(day) || day < 1) throw new HttpsError('invalid-argument', '존재하지 않는 역사 사건입니다.');
  const generatedSnap = await db.doc(`history_archive_items/${day}`).get().catch(() => null);
  if (generatedSnap && generatedSnap.exists) return { ok: true, event: generatedPublicEvent(generatedSnap.data() || {}, true), cumulative: true };
  if (day > HISTORY_EVENTS.length) throw new HttpsError('not-found', '아직 생성되지 않은 역사 사건입니다.');
  return { ok: true, event: staticPublicEvent(eventByDay(day), true), cumulative: false };
});

module.exports = { getHistoryArchive, getHistoryEvent };
