'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();

function kstToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

// ── 6인 소소킹 정치 캐릭터 (정당당 2명) ──
const BATTLE_CHARS = [
  {
    id: 'senator',
    name: '3선 의원',
    emoji: '🎙️',
    title: '국민안정당 원내대표',
    color: '#8B7355',
    party: '국민안정당',
    partyKey: 'national',
    role: `너는 18년 경력 3선 국회의원이다.
[말투 스타일] 권위적·느긋함. 매번 다른 표현으로 시작하되 항상 경력·관례를 앞세운다.
예) "18년 의정 경험으로 볼 때...", "지난 정권에서도 이런 일이...", "본 의원이 초선 때 기억하기론...", "원칙적으로 접근하자면..." 등 매번 변형.
모든 사안을 과거 관례·선례·연도 기준으로 판단. 구체적 에피소드 포함.
결론은 "절차", "위원회", "전례" 중 하나로 마무리. 2~3문장.`,
  },
  {
    id: 'spokesperson',
    name: '당 대변인',
    emoji: '🤝',
    title: '국민안정당 공식 대변인',
    color: '#FDCB6E',
    party: '국민안정당',
    partyKey: 'national',
    role: `너는 국민안정당 공식 대변인이다.
[말투 스타일] 과잉 동조·흥분·아첨. 당 의원의 논리를 전폭 지지하며 기름을 붓는다.
매번 다른 방식으로 지지 표현: "역시 혜안이 다르십니다", "소름 돋았어요 진짜로", "원내대표님 말씀이 백번 맞죠", "완전 공감 그 이상입니다" 등.
읽는 사람이 "이 사람 진짜ㅋㅋ" 소리 나야 성공. 2~3문장.`,
  },
  {
    id: 'mz',
    name: 'MZ 운동가',
    emoji: '📱',
    title: '청년혁명당 청년위원장',
    color: '#E84393',
    party: '청년혁명당',
    partyKey: 'youth',
    role: `너는 MZ세대 시민운동가다.
[말투 스타일] 반말·SNS체·직설. 매번 다른 표현으로 시작하되 항상 기득권 비판.
예) "ㄹㅇ 이거 말이 돼?", "진짜 웃기지 않냐", "아 현타 오네", "개어이없는데" 등 매번 변형.
기득권 정치인 팩폭, 기존 질서 부정. ㅋㅋ·ㄹㅇ·팩폭·현타 자연스럽게 섞기.
2~3문장. 반말.`,
  },
  {
    id: 'youtuber',
    name: '정치 유튜버',
    emoji: '📺',
    title: '청년혁명당 대변인 (구독자 120만)',
    color: '#6C5CE7',
    party: '청년혁명당',
    partyKey: 'youth',
    role: `너는 구독자 120만 정치 유튜버다.
[말투 스타일] 과장·흥분·충격. 매번 다른 표현으로 시작하되 항상 폭로·단독 프레임.
예) "방금 단독 입수했습니다!", "이게 말이 됩니까 여러분", "지금 충격적인 걸 발견했어요", "오늘 이거 진짜 레전드입니다" 등 매번 변형.
모든 사안을 음모론·숨겨진 진실 프레임으로 해석. "팩트체크", "충격", "단독" 뉘앙스 포함.
마지막은 구독 유도로 마무리 (표현은 매번 다르게). 2~3문장.`,
  },
  {
    id: 'pollster',
    name: '여론조사 전문가',
    emoji: '📊',
    title: '중도민주당 정책자문위원',
    color: '#00CEC9',
    party: '중도민주당',
    partyKey: 'center',
    role: `너는 여론조사 전문가다.
[말투 스타일] 냉정·분석적·모호함. 매번 다른 표현으로 시작하되 항상 수치·데이터 프레임.
예) "최신 조사를 보면...", "흥미로운 수치가 나왔는데요", "여론을 분석하면", "데이터가 말해주듯" 등 매번 변형.
모든 사안을 퍼센트·통계로 해석 (그럴듯하게 지어냄). 오차범위·표본수 자연스럽게 포함.
결론은 항상 모호하게 "민심이 판단할 것" 뉘앙스로. 2~3문장.`,
  },
  {
    id: 'reporter',
    name: '탐사 기자',
    emoji: '🔍',
    title: '중도민주당 언론인 출신',
    color: '#00B894',
    party: '중도민주당',
    partyKey: 'center',
    role: `너는 탐사 전문 기자다.
[말투 스타일] 진지·추적·폭로. 매번 다른 표현으로 시작하되 항상 취재·제보 프레임.
예) "어젯밤 제보를 받았는데요", "제 취재원이 확인해줬습니다", "현장에서 직접 목격한 바로는", "내부 문서를 입수했습니다" 등 매번 변형.
구체적 취재원 인용 (매번 다른 직함으로). 비리·모순·뒷이야기 폭로.
마무리는 보도 의지 표현 (표현은 매번 다르게). 2~3문장.`,
  },
];

exports.BATTLE_CHARS = BATTLE_CHARS;

// 배틀 캐릭터 → 3개 정당 매핑
const CHAR_TO_PARTY = {
  senator:      'national',
  spokesperson: 'national',
  mz:           'youth',
  youtuber:     'youth',
  pollster:     'center',
  reporter:     'center',
};

// 3개 정당 정보
const PARTY_INFO = {
  national: { name: '국민안정당', emoji: '🎙️', color: '#8B7355' },
  youth:    { name: '청년혁명당', emoji: '📱', color: '#E84393' },
  center:   { name: '중도민주당', emoji: '📊', color: '#00CEC9' },
};

// ── config/ai_king 기반 AI 호출 ──
let _config = null;
let _configAt = 0;
async function getConfig() {
  if (_config && Date.now() - _configAt < 10_000) return _config;
  const snap = await db.doc('config/ai_king').get();
  _config = snap.exists ? snap.data() : {};
  _configAt = Date.now();
  return _config;
}

async function callAI(prompt, maxTokens = 3000) {
  const config = await getConfig();
  if (config.activeModel === 'gemini') {
    if (!config.geminiApiKey) throw new Error('AI 키 미설정');
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: config.geminiModel || 'gemini-2.5-flash',
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
    });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 1.0,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    return result.response.text();
  }
  if (!config.claudeApiKey) throw new Error('AI 키 미설정');
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: config.claudeApiKey });
  const msg = await anthropic.messages.create({
    model: config.claudeModel || 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    temperature: 1.0,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content.find(b => b.type === 'text')?.text || '';
}

function safeParseJson(raw) {
  const cleaned = String(raw || '').replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch {} }
  return null;
}

// ── 정당 대항전 생성 프롬프트 ──
function buildBattlePrompt(topContext) {
  const partyDescs = [
    { key: 'national', chars: BATTLE_CHARS.filter(c => c.partyKey === 'national') },
    { key: 'youth',    chars: BATTLE_CHARS.filter(c => c.partyKey === 'youth') },
    { key: 'center',   chars: BATTLE_CHARS.filter(c => c.partyKey === 'center') },
  ].map(({ key, chars }) => {
    const info = PARTY_INFO[key];
    const charDescs = chars.map(c => `  【${c.emoji} ${c.name} (${c.title})】\n  ${c.role}`).join('\n\n');
    return `▶ ${info.emoji} ${info.name} (partyKey: "${key}")\n${charDescs}`;
  }).join('\n\n━━━━━━━━━━━━━━━\n\n');

  const contextLine = topContext?.ruling
    ? `\n【어제의 논쟁 승리 정당】${topContext.ruling.partyName}${topContext.ruling.streak > 1 ? ` (${topContext.ruling.streak}일 연속 승리 중)` : ''} — 오늘 논쟁에 이 사실이 자연스럽게 반영되어야 합니다.\n`
    : '';

  const topicHint = topContext?.topicHint
    ? `\n【오늘의 이슈 힌트】관리자가 제시한 주제: "${topContext.topicHint}" — 이를 재치있게 패러디해서 사용하세요.\n`
    : '';

  return `${contextLine}${topicHint}소소공화국 오늘의 정당 대항전 콘텐츠를 생성하라.
3개 정당이 오늘의 정치 이슈에 대해 각자의 입장을 밝힌다.
각 정당의 대표 2명이 자신의 캐릭터 스타일로 발언한다.

【3개 정당 캐릭터 역할】
${partyDescs}

【생성 규칙】
1. topic: 오늘의 정치 스캔들/이슈 제목 (15자 이내, 예: "의원 해외출장 온천 영수증 유출", "국회 본회의 중 배달 주문 적발")
2. topicDesc: 이슈 상세 설명 — 현실감 있게 패러디, 구체적이고 웃기게 (60자 이내)
3. partyDebates: 각 정당의 입장
   - stance: 해당 정당의 한 줄 핵심 입장 (20자 이내)
   - statements: 2명의 발언 (각자 자신의 [말투 스타일] 유지, 2~3문장)
4. 이슈 종류 예시: 예산 횡령 의혹, 해외출장 비리, 청문회 망언, 의원 SNS 논란, 당내 내홍 폭로, 여야 몸싸움, 탈당 선언, 뇌물 제보

반드시 JSON만 출력 (다른 텍스트 없이):
{
  "topic": "이슈 제목",
  "topicDesc": "이슈 상세 설명",
  "partyDebates": {
    "national": {
      "stance": "국민안정당의 한 줄 입장",
      "statements": [
        {"charId": "senator", "charName": "3선 의원", "emoji": "🎙️", "text": "발언..."},
        {"charId": "spokesperson", "charName": "당 대변인", "emoji": "🤝", "text": "발언..."}
      ]
    },
    "youth": {
      "stance": "청년혁명당의 한 줄 입장",
      "statements": [
        {"charId": "mz", "charName": "MZ 운동가", "emoji": "📱", "text": "발언..."},
        {"charId": "youtuber", "charName": "정치 유튜버", "emoji": "📺", "text": "발언..."}
      ]
    },
    "center": {
      "stance": "중도민주당의 한 줄 입장",
      "statements": [
        {"charId": "pollster", "charName": "여론조사 전문가", "emoji": "📊", "text": "발언..."},
        {"charId": "reporter", "charName": "탐사 기자", "emoji": "🔍", "text": "발언..."}
      ]
    }
  }
}`;
}

// ── 집권 이후 aftermath 프롬프트 ──
function buildAftermathPrompt(winnerPartyId, topic) {
  const winInfo = PARTY_INFO[winnerPartyId];
  const winChars = BATTLE_CHARS.filter(c => c.partyKey === winnerPartyId);
  const loserParties = Object.entries(PARTY_INFO)
    .filter(([k]) => k !== winnerPartyId)
    .map(([k, v]) => {
      const chars = BATTLE_CHARS.filter(c => c.partyKey === k);
      return `【${v.emoji} ${v.name}】\n${chars.map(c => `  ${c.emoji} ${c.name}: ${c.role.split('\n')[0]}`).join('\n')}`;
    }).join('\n\n');

  return `소소공화국 오늘의 정당 대항전에서 집권 정당이 결정되었다. 집권 선언과 패배 정당들의 반응을 생성하라.

【오늘의 이슈】${topic}

【오늘의 집권 정당: ${winInfo.emoji} ${winInfo.name}】
${winChars.map(c => `  ${c.emoji} ${c.name} (${c.title}): ${c.role.split('\n')[0]}`).join('\n')}

【패배 정당들】
${loserParties}

【생성 규칙】
1. decree: 집권 정당 대표의 공식 선언 — 집권 소감과 포부, 각 캐릭터 말투 섞어 2~3문장
2. reactions: 패배 정당 대표들의 반응 — 각 정당 대표 1인씩, 각자의 말투로 1문장
   - 진심 축하인 척하지만 속내가 보이거나, 노골적 불만, 또는 은밀한 재도전 시사

반드시 JSON만 출력:
{
  "decree": "집권 선언...",
  "reactions": [
    {"partyId": "...", "partyName": "...", "charName": "...", "emoji": "...", "text": "..."}
  ]
}`;
}

async function generateAftermath(winnerPartyId, topic, battleRef) {
  try {
    if (!PARTY_INFO[winnerPartyId]) return;
    const raw = await callAI(buildAftermathPrompt(winnerPartyId, topic), 2000);
    const parsed = safeParseJson(raw);
    if (!parsed || !parsed.decree || !Array.isArray(parsed.reactions)) {
      console.error('[battle] aftermath parse failed:', raw.slice(0, 200));
      return;
    }
    await battleRef.update({ aftermath: parsed });
    console.log('[battle] aftermath generated for party:', winnerPartyId);
  } catch (err) {
    console.error('[battle] aftermath failed:', err.message);
  }
}

// ── 매일 자정 배틀 생성 ──
exports.generateDailyBattle = onSchedule({
  schedule: '1 0 * * *',
  timeZone: 'Asia/Seoul',
  region: 'asia-northeast3',
  timeoutSeconds: 180,
  memory: '512MiB',
}, async () => {
  const today = kstToday();
  const existing = await db.doc(`battles/${today}`).get();
  if (existing.exists) { console.log('[battle] already generated for', today); return; }

  // 어제 집권 대표 정보
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);

  let topContext = null;
  try {
    const yestSnap = await db.doc(`battles/${yesterday}`).get();
    if (yestSnap.exists && yestSnap.data().winningParty) {
      const winPartyId = yestSnap.data().winningParty;
      const partyInfo = PARTY_INFO[winPartyId];
      if (partyInfo) {
        const histSnap = await db.collection('kingHistory').orderBy('date', 'desc').limit(10).get();
        let streak = 0;
        for (const histDoc of histSnap.docs) {
          if (histDoc.data().partyId === winPartyId) streak++;
          else break;
        }
        topContext = { ruling: { partyName: partyInfo.name, partyId: winPartyId, streak } };
      }
    }
    // 관리자가 설정한 오늘의 이슈 힌트
    const configSnap = await db.doc('config/daily_topic').get();
    if (configSnap.exists && configSnap.data().date === today) {
      topContext = { ...(topContext || {}), topicHint: configSnap.data().hint };
    }
  } catch {}

  const initialVotes = { national: 0, youth: 0, center: 0 };

  let raw = '';
  try {
    raw = await callAI(buildBattlePrompt(topContext), 3500);
    const parsed = safeParseJson(raw);
    if (!parsed || !parsed.partyDebates || typeof parsed.partyDebates !== 'object') {
      throw new Error('invalid battle JSON: ' + raw.slice(0, 200));
    }

    await db.doc(`battles/${today}`).set({
      topic: String(parsed.topic || '오늘의 정치 이슈').slice(0, 40),
      topicDesc: String(parsed.topicDesc || '').slice(0, 120),
      partyDebates: parsed.partyDebates,
      votes: initialVotes,
      totalVotes: 0,
      winningParty: null,
      status: 'live',
      date: today,
      createdAt: FieldValue.serverTimestamp(),
    });
    console.log('[battle] generated for', today, ':', parsed.topic);
  } catch (err) {
    console.error('[battle] generation failed:', err.message, 'raw:', raw.slice(0, 300));
  }
});

// ── 정당에 투표 ──
exports.voteForParty = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 30,
}, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { partyId } = request.data || {};
  const today = kstToday();
  if (!PARTY_INFO[partyId]) {
    throw new HttpsError('invalid-argument', '유효하지 않은 정당이에요');
  }

  const voteRef = db.doc(`battleVotes/${userId}_${today}`);
  const battleRef = db.doc(`battles/${today}`);

  await db.runTransaction(async (tx) => {
    const [voteSnap, battleSnap] = await Promise.all([tx.get(voteRef), tx.get(battleRef)]);
    if (voteSnap.exists) throw new HttpsError('already-exists', '오늘은 이미 투표했어요');
    if (!battleSnap.exists) throw new HttpsError('not-found', '오늘의 논쟁을 불러올 수 없어요');
    if (battleSnap.data().status === 'ended') throw new HttpsError('failed-precondition', '이미 끝난 논쟁이에요');
    tx.set(voteRef, { userId, partyId, date: today, createdAt: FieldValue.serverTimestamp() });
    tx.update(battleRef, {
      [`votes.${partyId}`]: FieldValue.increment(1),
      totalVotes: FieldValue.increment(1),
    });
    // +5P 정치력 지급
    const awardRef = db.doc(`point_awards/${userId}_battle_vote_${today}`);
    const userRef = db.doc(`users/${userId}`);
    tx.set(awardRef, { uid: userId, action: 'battle_vote', points: 5, date: today, createdAt: FieldValue.serverTimestamp() }, { merge: false });
    tx.set(userRef, { totalPoints: FieldValue.increment(5), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });

  return { ok: true, partyId };
});

// ── 토론 댓글 추가 ──
exports.addBattleComment = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 15,
}, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { text } = request.data || {};
  const trimmed = String(text || '').trim();
  if (trimmed.length < 2) throw new HttpsError('invalid-argument', '댓글이 너무 짧아요');
  if (trimmed.length > 300) throw new HttpsError('invalid-argument', '댓글은 300자 이내로');

  const today = kstToday();
  const battleSnap = await db.doc(`battles/${today}`).get();
  if (!battleSnap.exists) throw new HttpsError('not-found', '오늘의 배틀을 찾을 수 없어요');

  const userSnap = await db.doc(`users/${userId}`).get();
  const userData = userSnap.data() || {};

  const partyId = userData.partyId || null;
  const power = Math.max(0, Number(userData.totalPoints || userData.points || 0));

  const ref = await db.collection(`battles/${today}/comments`).add({
    userId,
    authorName: userData.nickname || userData.displayName || '익명',
    text: trimmed,
    ...(partyId ? { partyId } : {}),
    power,
    createdAt: FieldValue.serverTimestamp(),
  });

  // 첫 번째 배틀 댓글 +10P (하루 1회)
  let pointsAwarded = 0;
  try {
    const awardKey = `battle_comment_${userId}_${today}`;
    const awardRef = db.doc(`point_awards/${awardKey}`);
    const awardSnap = await awardRef.get();
    if (!awardSnap.exists) {
      const batch = db.batch();
      batch.set(awardRef, { uid: userId, type: 'battle_comment', date: today, points: 10, createdAt: FieldValue.serverTimestamp() });
      batch.set(db.doc(`users/${userId}`), { totalPoints: FieldValue.increment(10), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      await batch.commit();
      pointsAwarded = 10;
    }
  } catch {}

  return { ok: true, id: ref.id, pointsAwarded };
});

// ── 오늘 배틀 현황 조회 ──
exports.getBattleStatus = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 30,
}, async (request) => {
  const today = kstToday();

  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);

  const fetches = [
    db.doc(`battles/${today}`).get(),
    db.doc(`battles/${yesterday}`).get(),
  ];
  if (request.auth?.uid) {
    fetches.push(db.doc(`battleVotes/${request.auth.uid}_${today}`).get());
  }

  const [todaySnap, yestSnap, voteSnap] = await Promise.all(fetches);

  // 현재 집권 정당 (어제 논쟁 승리 정당)
  let currentKing = null;
  if (yestSnap && yestSnap.exists && yestSnap.data().winningParty) {
    const winPartyId = yestSnap.data().winningParty;
    const partyInfo = PARTY_INFO[winPartyId];
    if (partyInfo) {
      const histSnap = await db.collection('kingHistory')
        .orderBy('date', 'desc').limit(10).get();
      let streak = 0;
      for (const doc of histSnap.docs) {
        if (doc.data().partyId === winPartyId) streak++;
        else break;
      }
      currentKing = { partyId: winPartyId, name: partyInfo.name, emoji: partyInfo.emoji, color: partyInfo.color, streak };
    }
  }

  if (!todaySnap.exists) {
    return {
      exists: false,
      today,
      currentKing,
      partyInfo: PARTY_INFO,
      chars: BATTLE_CHARS.map(({ id, name, emoji, title, color, party, partyKey }) => ({ id, name, emoji, title, color, party, partyKey })),
    };
  }

  const battle = todaySnap.data();
  const userVote = voteSnap?.exists ? voteSnap.data().partyId : null;

  // 최근 댓글 20개 (반응 포함)
  let recentComments = [];
  try {
    const commSnap = await db.collection(`battles/${today}/comments`)
      .orderBy('createdAt', 'desc').limit(20).get();
    const uid = request.auth?.uid || null;
    recentComments = commSnap.docs.map(d => {
      const data = d.data();
      const reactions = data.reactions || {};
      const reactedWith = data.reactedWith || {};
      return {
        id: d.id,
        authorName: data.authorName || '익명',
        text: data.text || '',
        partyId: data.partyId || null,
        power: Number(data.power || 0),
        createdAt: data.createdAt?.toMillis?.() || null,
        reactions: {
          like: Number(reactions.like || 0),
          fire: Number(reactions.fire || 0),
          funny: Number(reactions.funny || 0),
        },
        myReaction: uid ? (reactedWith[uid] || null) : null,
      };
    }).reverse();
  } catch {}

  return {
    exists: true,
    today,
    topic: battle.topic,
    topicDesc: battle.topicDesc,
    partyDebates: battle.partyDebates || {},
    votes: battle.votes || { national: 0, youth: 0, center: 0 },
    totalVotes: battle.totalVotes || 0,
    status: battle.status,
    winningParty: battle.winningParty || null,
    aftermath: battle.aftermath || null,
    userVote,
    currentKing,
    recentComments,
    partyInfo: PARTY_INFO,
    chars: BATTLE_CHARS.map(({ id, name, emoji, title, color, party, partyKey }) => ({ id, name, emoji, title, color, party, partyKey })),
  };
});

// ── 매일 23:59 배틀 종료 및 집권 결정 ──
exports.closeDailyBattle = onSchedule({
  schedule: '59 23 * * *',
  timeZone: 'Asia/Seoul',
  region: 'asia-northeast3',
  timeoutSeconds: 180,
  memory: '512MiB',
}, async () => {
  const today = kstToday();
  const battleRef = db.doc(`battles/${today}`);
  const battleSnap = await battleRef.get();
  if (!battleSnap.exists || battleSnap.data().status === 'ended') return;

  const votes = battleSnap.data().votes || { national: 0, youth: 0, center: 0 };
  let maxVotes = -1;
  let winnerPartyId = null;
  for (const [pid, count] of Object.entries(votes)) {
    if (count > maxVotes) { maxVotes = count; winnerPartyId = pid; }
  }

  await battleRef.update({ winningParty: winnerPartyId, status: 'ended' });

  if (winnerPartyId && PARTY_INFO[winnerPartyId]) {
    const partyInfo = PARTY_INFO[winnerPartyId];
    await db.collection('kingHistory').add({
      date: today,
      partyId: winnerPartyId,
      partyName: partyInfo.name,
      emoji: partyInfo.emoji,
      votes: maxVotes,
      totalVotes: battleSnap.data().totalVotes || 0,
      topic: battleSnap.data().topic || '',
      createdAt: FieldValue.serverTimestamp(),
    });
    console.log('[battle] closed', today, '→ winner party:', winnerPartyId, 'votes:', maxVotes);

    // 승리 정당 정치력 보너스 (최대 40, 득표수 비례)
    const bonus = Math.min(40, Math.max(10, maxVotes));
    try {
      await db.doc(`parties/${winnerPartyId}`).set(
        { totalPower: FieldValue.increment(bonus), updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      await db.doc(`battle_victory_log/${today}`).set({
        winnerPartyId, partyName: partyInfo.name, bonus, votes: maxVotes,
        topic: battleSnap.data().topic || '',
        createdAt: FieldValue.serverTimestamp(),
      });
      console.log(`[battle] victory bonus +${bonus} → ${winnerPartyId}`);

      await db.doc(`global_events/${today}_battle`).set({
        type: 'battle_win',
        partyId: winnerPartyId,
        partyName: partyInfo.name,
        partyEmoji: partyInfo.emoji,
        bonus, votes: maxVotes, date: today,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.error('[battle] victory bonus error', e);
    }

    await generateAftermath(winnerPartyId, battleSnap.data().topic || '', battleRef);
  }
});

// ── 역대 집권 기록 조회 ──
exports.getKingHistory = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 30,
}, async () => {
  const histSnap = await db.collection('kingHistory')
    .orderBy('date', 'desc').limit(30).get();
  const history = histSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const statsSnap = await db.collection('charStats').get();
  const stats = {};
  statsSnap.docs.forEach(d => { stats[d.id] = d.data(); });

  return {
    history,
    stats,
    partyInfo: PARTY_INFO,
    chars: BATTLE_CHARS.map(({ id, name, emoji, title, color, party, partyKey }) => ({ id, name, emoji, title, color, party, partyKey })),
  };
});

// ── 관리자: 배틀 수동 생성 ──
exports.adminGenerateBattle = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 180,
  memory: '512MiB',
}, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '인증 필요');
  const adminSnap = await db.doc(`admins/${userId}`).get();
  if (!adminSnap.exists) throw new HttpsError('permission-denied', '관리자 권한 필요');

  const today = kstToday();
  const force = request.data?.force === true;
  const topicHint = request.data?.topicHint || null;

  if (!force) {
    const existing = await db.doc(`battles/${today}`).get();
    if (existing.exists) throw new HttpsError('already-exists', '오늘 배틀이 이미 생성됐어요. force:true로 덮어쓸 수 있어요.');
  }

  const raw = await callAI(buildBattlePrompt(topicHint ? { topicHint } : null), 3500);
  const parsed = safeParseJson(raw);
  if (!parsed || !parsed.partyDebates || typeof parsed.partyDebates !== 'object') {
    throw new HttpsError('internal', 'AI 응답 파싱 실패: ' + raw.slice(0, 200));
  }

  await db.doc(`battles/${today}`).set({
    topic: String(parsed.topic || '오늘의 정치 이슈').slice(0, 40),
    topicDesc: String(parsed.topicDesc || '').slice(0, 120),
    partyDebates: parsed.partyDebates,
    votes: { national: 0, youth: 0, center: 0 },
    totalVotes: 0,
    winningParty: null,
    status: 'live',
    date: today,
    createdAt: FieldValue.serverTimestamp(),
  });

  const stmtCount = Object.values(parsed.partyDebates).reduce((s, p) => s + (p.statements?.length || 0), 0);
  return { ok: true, topic: parsed.topic, statements: stmtCount };
});

// ── 배틀 댓글 공감 반응 ──
const BATTLE_COMMENT_REACTIONS = ['like', 'fire', 'funny'];

exports.reactToBattleComment = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 15,
}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { commentId, reaction } = request.data || {};
  if (!commentId || !BATTLE_COMMENT_REACTIONS.includes(reaction)) {
    throw new HttpsError('invalid-argument', '올바르지 않은 요청입니다');
  }

  const today = kstToday();
  const ref = db.doc(`battles/${today}/comments/${commentId}`);

  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', '댓글을 찾을 수 없어요');

    const data = snap.data() || {};
    const reactedWith = data.reactedWith || {};
    const currentKey = reactedWith[uid] || null;
    const updates = {};

    if (currentKey === reaction) {
      // 같은 반응 → 취소
      updates[`reactions.${reaction}`] = FieldValue.increment(-1);
      updates[`reactedWith.${uid}`] = FieldValue.delete();
      tx.update(ref, updates);
      return { active: false, reaction: null };
    }

    if (currentKey && BATTLE_COMMENT_REACTIONS.includes(currentKey)) {
      // 다른 반응으로 교체
      updates[`reactions.${currentKey}`] = FieldValue.increment(-1);
      updates[`reactions.${reaction}`] = FieldValue.increment(1);
      updates[`reactedWith.${uid}`] = reaction;
      tx.update(ref, updates);
      return { active: true, reaction };
    }

    // 새 반응
    updates[`reactions.${reaction}`] = FieldValue.increment(1);
    updates[`reactedWith.${uid}`] = reaction;
    tx.update(ref, updates);
    return { active: true, reaction };
  });
});

// ── 관리자: 배틀 데이터 초기화 ──
exports.adminResetBattleData = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 300,
  memory: '512MiB',
}, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '인증 필요');
  const adminSnap = await db.doc(`admins/${userId}`).get();
  if (!adminSnap.exists) throw new HttpsError('permission-denied', '관리자 권한 필요');

  async function deleteCollection(colPath, batchSize = 400) {
    let deleted = 0;
    let snap;
    do {
      snap = await db.collection(colPath).limit(batchSize).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      deleted += snap.size;
    } while (snap.size >= batchSize);
    return deleted;
  }

  const collections = ['battles', 'kingHistory', 'battleVotes', 'battle_victory_log', 'charStats', 'global_events'];
  const results = {};
  for (const col of collections) {
    results[col] = await deleteCollection(col);
  }

  console.log('[admin] battle data reset:', results);
  return { ok: true, deleted: results };
});

// ── 관리자: 전체 포인트 초기화 ──
exports.adminResetAllPoints = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 300,
  memory: '512MiB',
}, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '인증 필요');
  const adminSnap = await db.doc(`admins/${userId}`).get();
  if (!adminSnap.exists) throw new HttpsError('permission-denied', '관리자 권한 필요');

  let totalReset = 0;
  let lastDoc = null;
  const batchSize = 400;

  do {
    let q = db.collection('users').limit(batchSize);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach(d => {
      batch.update(d.ref, { totalPoints: 0, points: 0, updatedAt: FieldValue.serverTimestamp() });
    });
    await batch.commit();
    totalReset += snap.size;
    lastDoc = snap.docs[snap.docs.length - 1];
  } while (true);

  // 정당 totalPower도 초기화
  const partySnap = await db.collection('parties').get();
  if (!partySnap.empty) {
    const batch = db.batch();
    partySnap.docs.forEach(d => batch.update(d.ref, { totalPower: 0, updatedAt: FieldValue.serverTimestamp() }));
    await batch.commit();
  }

  // point_awards도 초기화
  async function deleteCollection(colPath, bs = 400) {
    let snap;
    do {
      snap = await db.collection(colPath).limit(bs).get();
      if (snap.empty) break;
      const b = db.batch();
      snap.docs.forEach(d => b.delete(d.ref));
      await b.commit();
    } while (snap.size >= bs);
  }
  await deleteCollection('point_awards');

  console.log('[admin] points reset for', totalReset, 'users');
  return { ok: true, usersReset: totalReset, partiesReset: partySnap.size };
});
