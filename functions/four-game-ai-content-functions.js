'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';
const PRESETS = ['judgment', 'consult', 'vote', 'drip'];
const HTTPS_ERROR_CODES = new Set([
  'cancelled', 'unknown', 'invalid-argument', 'deadline-exceeded', 'not-found',
  'already-exists', 'permission-denied', 'resource-exhausted', 'failed-precondition',
  'aborted', 'out-of-range', 'unimplemented', 'internal', 'unavailable',
  'data-loss', 'unauthenticated',
]);

function todayKST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function clean(value, max = 500) {
  return String(value || '').replace(/[<>]/g, '').replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);
}

function normalizePreset(value) {
  const key = String(value || 'judgment').trim();
  if (['judgment', 'general', 'collect', 'court', 'solo_room', 'solo'].includes(key)) return 'judgment';
  if (['consult', 'quiz', 'advice', 'invite_room', 'invite'].includes(key)) return 'consult';
  if (['vote', 'debate', 'discussion', 'ox', 'day_room', 'day'].includes(key)) return 'vote';
  if (['drip', 'cbattle', 'ended_room', 'ended'].includes(key)) return 'drip';
  return PRESETS.includes(key) ? key : 'judgment';
}

function rethrowCallableError(error, scope) {
  const code = String(error && error.code || '').replace(/^functions\//, '');
  if (HTTPS_ERROR_CODES.has(code)) {
    throw new HttpsError(code, error.message || '요청을 처리하지 못했습니다.');
  }
  console.error(`[${scope}]`, error);
  throw new HttpsError('internal', error && error.message ? error.message : '커뮤니티 AI 데이터 생성 중 오류가 발생했습니다.');
}

async function assertAdmin(request) {
  const auth = request.auth || {};
  const uid = auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const token = auth.token || {};
  if (token.admin === true || token.owner === true) return uid;
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자 권한을 확인하지 못했습니다. admins 문서 또는 관리자 claim을 확인하세요.');
  return uid;
}

function sample(preset) {
  if (preset === 'consult') return {
    title: '장바구니가 저를 부릅니다',
    desc: '며칠째 장바구니에서 손짓하는 물건이 있습니다. 사도 되는지 말려야 하는지 상담 부탁합니다.',
    tags: ['상담', '고민', '소소킹'],
  };
  if (preset === 'vote') return {
    title: '먼저 연락한다 vs 그냥 둔다',
    desc: '한동안 연락이 뜸한 친구에게 먼저 연락하는 게 좋을까요, 아니면 그냥 자연스럽게 두는 게 좋을까요?',
    tags: ['토론', '찬반', '소소킹'],
  };
  if (preset === 'drip') return {
    title: '오늘의 드립 주제',
    desc: '퇴근 5분 전에 회의 잡힌 사람의 한마디는?',
    tags: ['드립', '한줄드립', '소소킹'],
  };
  return {
    title: '친구가 약속 30분 전에 또 취소함',
    desc: '이번 달에만 세 번째입니다. 사정은 있다는데 제 시간도 소중한 거 아닌가요? 가볍게 판결 부탁합니다.',
    tags: ['판결', '소소재판', '소소킹'],
  };
}

function buildDoc(preset, actorId) {
  const data = sample(preset);
  const isJudgment = preset === 'judgment';
  const isConsult = preset === 'consult';
  const isVote = preset === 'vote';
  const isDrip = preset === 'drip';
  const label = isJudgment ? '판결' : isConsult ? '상담' : isVote ? '토론' : '드립';
  const doc = {
    type: 'multi',
    cat: 'multi',
    subtype: preset,
    feedType: isJudgment || isVote ? 'vote' : isDrip ? 'drip' : 'collect',
    typeLabel: label,
    title: clean(data.title, 100),
    desc: clean(data.desc, 1200),
    tags: Array.isArray(data.tags) ? data.tags.map(tag => clean(tag, 20)).filter(Boolean).slice(0, 8) : [label, '소소킹'],
    images: [],
    modules: { comments: { enabled: true } },
    anonymous: false,
    anonymousMode: '',
    authorId: 'sosoking-ai',
    authorName: '소소킹 운영봇',
    authorPhoto: '',
    authorEmail: '',
    reactions: { total: 0 },
    commentCount: 0,
    viewCount: 0,
    pointsScore: 0,
    isAiGenerated: true,
    aiGeneratedDate: todayKST(),
    aiSource: 'four-game-community',
    aiPreset: preset,
    aiActorId: actorId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (isJudgment) {
    doc.modules.vote = {
      enabled: true,
      voteMode: 'judgment',
      question: doc.desc,
      options: ['글쓴이가 예민함', '상대가 선 넘음', '둘 다 문제 있음'].map(text => ({ text, votes: 0 })),
    };
  } else if (isVote) {
    doc.modules.vote = {
      enabled: true,
      voteMode: 'pros_cons',
      question: doc.desc,
      options: ['찬성', '반대'].map(text => ({ text, votes: 0 })),
    };
  } else if (isConsult) {
    doc.modules.consult = {
      enabled: true,
      topic: 'daily',
      topicLabel: '일상',
      style: 'funny',
      styleLabel: '웃긴해결',
      question: doc.desc,
    };
  } else if (isDrip) {
    doc.modules.drip = {
      enabled: true,
      prompt: doc.desc,
      maxLength: 50,
      responseLabel: '한 줄 드립',
    };
  }
  return doc;
}

async function createOne(preset, actorId) {
  const normalized = normalizePreset(preset);
  const ref = db.collection('feeds').doc();
  const doc = buildDoc(normalized, actorId);
  await ref.set(doc);
  return { ok: true, preset: normalized, typeLabel: doc.typeLabel, docId: ref.id, title: doc.title, path: `/detail/${ref.id}`, source: 'four-game-community' };
}

exports.generateAiContentNow = onCall({ region: REGION, timeoutSeconds: 120 }, async request => {
  try {
    const uid = await assertAdmin(request);
    return await createOne(request.data && (request.data.preset || request.data.type), uid);
  } catch (error) {
    rethrowCallableError(error, 'generateAiContentNow');
  }
});

exports.generateAllAiContentNow = onCall({ region: REGION, timeoutSeconds: 300 }, async request => {
  try {
    const uid = await assertAdmin(request);
    const results = [];
    for (const preset of PRESETS) results.push(await createOne(preset, uid));
    return { ok: true, total: results.length, results };
  } catch (error) {
    rethrowCallableError(error, 'generateAllAiContentNow');
  }
});
