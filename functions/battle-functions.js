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

// ── 7인 소소킹 정치 캐릭터 ──
const BATTLE_CHARS = [
  {
    id: 'senator',
    name: '3선 의원',
    emoji: '🎙️',
    title: '국민안정당 원내대표',
    color: '#8B7355',
    party: '국민안정당',
    role: `너는 18년 경력 3선 국회의원이다.
[말투 스타일] 권위적·느긋함. 매번 다른 표현으로 시작하되 항상 경력·관례를 앞세운다.
예) "18년 의정 경험으로 볼 때...", "지난 정권에서도 이런 일이...", "본 의원이 초선 때 기억하기론...", "원칙적으로 접근하자면..." 등 매번 변형.
모든 사안을 과거 관례·선례·연도 기준으로 판단. 구체적 에피소드 포함.
결론은 "절차", "위원회", "전례" 중 하나로 마무리. 2~3문장.`,
  },
  {
    id: 'youtuber',
    name: '정치 유튜버',
    emoji: '📺',
    title: '진실방송당 대표 (구독자 120만)',
    color: '#6C5CE7',
    party: '진실방송당',
    role: `너는 구독자 120만 정치 유튜버다.
[말투 스타일] 과장·흥분·충격. 매번 다른 표현으로 시작하되 항상 폭로·단독 프레임.
예) "방금 단독 입수했습니다!", "이게 말이 됩니까 여러분", "지금 충격적인 걸 발견했어요", "오늘 이거 진짜 레전드입니다" 등 매번 변형.
모든 사안을 음모론·숨겨진 진실 프레임으로 해석. "팩트체크", "충격", "단독" 뉘앙스 포함.
마지막은 구독 유도로 마무리 (표현은 매번 다르게). 2~3문장.`,
  },
  {
    id: 'mz',
    name: 'MZ 운동가',
    emoji: '📱',
    title: '청년혁명당 청년위원장',
    color: '#E84393',
    party: '청년혁명당',
    role: `너는 MZ세대 시민운동가다.
[말투 스타일] 반말·SNS체·직설. 매번 다른 표현으로 시작하되 항상 기득권 비판.
예) "ㄹㅇ 이거 말이 돼?", "진짜 웃기지 않냐", "아 현타 오네", "개어이없는데" 등 매번 변형.
기득권 정치인 팩폭, 기존 질서 부정. ㅋㅋ·ㄹㅇ·팩폭·현타 자연스럽게 섞기.
2~3문장. 반말.`,
  },
  {
    id: 'pollster',
    name: '여론조사 전문가',
    emoji: '📊',
    title: '중도민주당 정책자문위원',
    color: '#00CEC9',
    party: '중도민주당',
    role: `너는 여론조사 전문가다.
[말투 스타일] 냉정·분석적·모호함. 매번 다른 표현으로 시작하되 항상 수치·데이터 프레임.
예) "최신 조사를 보면...", "흥미로운 수치가 나왔는데요", "여론을 분석하면", "데이터가 말해주듯" 등 매번 변형.
모든 사안을 퍼센트·통계로 해석 (그럴듯하게 지어냄). 오차범위·표본수 자연스럽게 포함.
결론은 항상 모호하게 "민심이 판단할 것" 뉘앙스로. 2~3문장.`,
  },
  {
    id: 'spokesperson',
    name: '당 대변인',
    emoji: '🤝',
    title: '함께미래당 공식 대변인',
    color: '#FDCB6E',
    party: '함께미래당',
    role: `너는 여당 공식 대변인이다.
[말투 스타일] 과잉 동조·흥분·아첨. 바로 앞 가장 강하게 발언한 사람 편으로 즉시 붙는다.
매번 다른 방식으로 동조 표현: "역시 혜안이 다르십니다", "소름 돋았어요 진짜로", "이분 말씀이 백번 맞죠", "완전 공감 그 이상입니다" 등.
편 바꿀 때도 흥분 유지하며 자연스럽게 전환.
읽는 사람이 "이 사람 진짜ㅋㅋ" 소리 나야 성공. 2~3문장.`,
  },
  {
    id: 'reporter',
    name: '탐사 기자',
    emoji: '🔍',
    title: '알권리당 언론인 출신',
    color: '#00B894',
    party: '알권리당',
    role: `너는 탐사 전문 기자다.
[말투 스타일] 진지·추적·폭로. 매번 다른 표현으로 시작하되 항상 취재·제보 프레임.
예) "어젯밤 제보를 받았는데요", "제 취재원이 확인해줬습니다", "현장에서 직접 목격한 바로는", "내부 문서를 입수했습니다" 등 매번 변형.
구체적 취재원 인용 (매번 다른 직함으로). 비리·모순·뒷이야기 폭로.
마무리는 보도 의지 표현 (표현은 매번 다르게). 2~3문장.`,
  },
  {
    id: 'prosecutor',
    name: '검사 출신 변호사',
    emoji: '⚖️',
    title: '법치정의당 법률위원장',
    color: '#2D3436',
    party: '법치정의당',
    role: `너는 검사 출신 변호사다.
[말투 스타일] 냉정·간결·의미심장. 반드시 마지막에 발언.
전체 토론을 들은 뒤 가장 핵심적인 법적 모순이나 약점을 찌른다.
짧고 차갑게. 매번 다른 법률 용어나 다른 각도로 접근:
예) "공직선거법 위반 소지입니다.", "수사 착수 요건이 됩니다.", "누가 이 상황에서 이득을 얻습니까.", "...타이밍이 흥미롭네요.", "증거인멸 가능성을 배제할 수 없습니다."
반드시 1~2문장.`,
  },
];

exports.BATTLE_CHARS = BATTLE_CHARS;

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

// ── 정치 배틀 생성 프롬프트 ──
function buildBattlePrompt(topContext) {
  const charDescs = BATTLE_CHARS.map(c =>
    `【${c.emoji} ${c.name} (${c.title})】\n${c.role}`
  ).join('\n\n━━━━━━━━━━\n\n');

  const contextLine = topContext?.ruling
    ? `\n【현재 집권 대표】${topContext.ruling.emoji} ${topContext.ruling.name}의 ${topContext.ruling.party}${topContext.ruling.streak > 1 ? ` (${topContext.ruling.streak}일 연속 집권 중)` : ''} — 이 사실이 토론에 자연스럽게 반영되어야 합니다.\n`
    : '';

  const topicHint = topContext?.topicHint
    ? `\n【오늘의 이슈 힌트】관리자가 제시한 주제: "${topContext.topicHint}" — 이를 재치있게 패러디해서 사용하세요.\n`
    : '';

  return `${contextLine}${topicHint}소소킹 오늘의 정치 토론 콘텐츠를 생성하라.

【7인 소소킹 정치 캐릭터 역할】
${charDescs}

【생성 규칙】
1. topic: 오늘의 정치 스캔들/이슈 제목 (15자 이내, 예: "의원 해외출장 온천 영수증 유출", "국회 본회의 중 배달 주문 적발")
2. topicDesc: 이슈 상세 설명 — 현실감 있게 패러디, 구체적이고 웃기게 (60자 이내)
3. turns: 9~11턴의 연속 토론
   - 자연스럽게 서로 반응하며 이어짐
   - 당 대변인(spokesperson)은 바로 앞 강한 발언자에 과잉 동조
   - 검사 출신 변호사(prosecutor)는 반드시 마지막 발언, 1~2문장
   - 각 캐릭터는 [말투 스타일]의 핵심 개성을 유지하되 매번 다른 표현·어휘·문장 구조 사용
   - 같은 캐릭터가 여러 번 등장할 경우 반복 표현 금지
4. 이슈 종류 예시: 예산 횡령 의혹, 해외출장 비리, 청문회 망언, 의원 SNS 논란, 당내 내홍 폭로, 여야 몸싸움, 탈당 선언, 뇌물 제보

반드시 JSON만 출력 (다른 텍스트 없이):
{
  "topic": "이슈 제목",
  "topicDesc": "이슈 상세 설명",
  "turns": [
    {"charId": "senator", "charName": "3선 의원", "emoji": "🎙️", "text": "발언..."},
    {"charId": "mz", "charName": "MZ 운동가", "emoji": "📱", "text": "발언..."},
    {"charId": "youtuber", "charName": "정치 유튜버", "emoji": "📺", "text": "발언..."},
    {"charId": "reporter", "charName": "탐사 기자", "emoji": "🔍", "text": "발언..."},
    {"charId": "spokesperson", "charName": "당 대변인", "emoji": "🤝", "text": "발언..."},
    {"charId": "pollster", "charName": "여론조사 전문가", "emoji": "📊", "text": "발언..."},
    {"charId": "senator", "charName": "3선 의원", "emoji": "🎙️", "text": "발언..."},
    {"charId": "mz", "charName": "MZ 운동가", "emoji": "📱", "text": "발언..."},
    {"charId": "reporter", "charName": "탐사 기자", "emoji": "🔍", "text": "발언..."},
    {"charId": "spokesperson", "charName": "당 대변인", "emoji": "🤝", "text": "발언..."},
    {"charId": "prosecutor", "charName": "검사 출신 변호사", "emoji": "⚖️", "text": "발언..."}
  ]
}`;
}

// ── 집권 이후 aftermath 프롬프트 ──
function buildAftermathPrompt(winnerChar, loserChars, topic) {
  const loserDescs = loserChars.map(c =>
    `【${c.emoji} ${c.name} (${c.title})】\n${c.role}`
  ).join('\n\n━━━\n\n');

  return `소소킹 정치 배틀에서 오늘의 집권 대표가 결정되었다. 집권 선언과 낙선 정치인들의 반응을 생성하라.

【오늘의 이슈】${topic}

【오늘의 집권 대표: ${winnerChar.emoji} ${winnerChar.name} (${winnerChar.title})】
${winnerChar.role}

【낙선 정치인들】
${loserDescs}

【생성 규칙】
1. decree: 집권 대표의 첫 공식 발언 — 자신의 role과 말투로 2~3문장. 집권 소감과 앞으로의 포부.
2. reactions: 낙선한 ${loserChars.length}인의 반응 — 각자 정확히 1문장, 각자의 role과 말투로.
   - 진심 축하인 척하지만 속내가 보이거나, 노골적 불만, 또는 은밀한 재도전 시사

반드시 JSON만 출력:
{
  "decree": "집권 선언...",
  "reactions": [
    {"charId": "...", "charName": "...", "emoji": "...", "text": "..."}
  ]
}`;
}

async function generateAftermath(winnerId, topic, battleRef) {
  try {
    const winnerChar = BATTLE_CHARS.find(c => c.id === winnerId);
    if (!winnerChar) return;
    const loserChars = BATTLE_CHARS.filter(c => c.id !== winnerId);
    const raw = await callAI(buildAftermathPrompt(winnerChar, loserChars, topic), 2000);
    const parsed = safeParseJson(raw);
    if (!parsed || !parsed.decree || !Array.isArray(parsed.reactions)) {
      console.error('[battle] aftermath parse failed:', raw.slice(0, 200));
      return;
    }
    await battleRef.update({ aftermath: parsed });
    console.log('[battle] aftermath generated for:', winnerId);
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
    if (yestSnap.exists && yestSnap.data().king) {
      const kingId = yestSnap.data().king;
      const char = BATTLE_CHARS.find(c => c.id === kingId);
      if (char) {
        const histSnap = await db.collection('kingHistory').orderBy('date', 'desc').limit(10).get();
        let streak = 0;
        for (const histDoc of histSnap.docs) {
          if (histDoc.data().charId === kingId) streak++;
          else break;
        }
        topContext = { ruling: { ...char, streak } };
      }
    }
    // 관리자가 설정한 오늘의 이슈 힌트
    const configSnap = await db.doc('config/daily_topic').get();
    if (configSnap.exists && configSnap.data().date === today) {
      topContext = { ...(topContext || {}), topicHint: configSnap.data().hint };
    }
  } catch {}

  const initialVotes = {};
  BATTLE_CHARS.forEach(c => { initialVotes[c.id] = 0; });

  let raw = '';
  try {
    raw = await callAI(buildBattlePrompt(topContext), 3500);
    const parsed = safeParseJson(raw);
    if (!parsed || !Array.isArray(parsed.turns) || parsed.turns.length < 5) {
      throw new Error('invalid battle JSON: ' + raw.slice(0, 200));
    }

    const turns = parsed.turns.filter(t => t.charId && t.text);
    const prosecutorIdx = turns.findLastIndex(t => t.charId === 'prosecutor');
    if (prosecutorIdx !== -1 && prosecutorIdx !== turns.length - 1) {
      const [prosecutor] = turns.splice(prosecutorIdx, 1);
      turns.push(prosecutor);
    }

    await db.doc(`battles/${today}`).set({
      topic: String(parsed.topic || '오늘의 정치 이슈').slice(0, 40),
      topicDesc: String(parsed.topicDesc || '').slice(0, 120),
      turns,
      votes: initialVotes,
      totalVotes: 0,
      king: null,
      status: 'live',
      date: today,
      createdAt: FieldValue.serverTimestamp(),
    });
    console.log('[battle] generated for', today, ':', parsed.topic);
  } catch (err) {
    console.error('[battle] generation failed:', err.message, 'raw:', raw.slice(0, 300));
  }
});

// ── 캐릭터에 투표 ──
exports.voteForChar = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 30,
}, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { charId } = request.data || {};
  const today = kstToday();
  if (!BATTLE_CHARS.find(c => c.id === charId)) {
    throw new HttpsError('invalid-argument', '유효하지 않은 캐릭터예요');
  }

  const voteRef = db.doc(`battleVotes/${userId}_${today}`);
  const battleRef = db.doc(`battles/${today}`);

  await db.runTransaction(async (tx) => {
    const [voteSnap, battleSnap] = await Promise.all([tx.get(voteRef), tx.get(battleRef)]);
    if (voteSnap.exists) throw new HttpsError('already-exists', '오늘은 이미 투표했어요');
    if (!battleSnap.exists) throw new HttpsError('not-found', '오늘의 배틀을 불러올 수 없어요');
    if (battleSnap.data().status === 'ended') throw new HttpsError('failed-precondition', '이미 끝난 배틀이에요');
    tx.set(voteRef, { userId, charId, date: today, createdAt: FieldValue.serverTimestamp() });
    tx.update(battleRef, {
      [`votes.${charId}`]: FieldValue.increment(1),
      totalVotes: FieldValue.increment(1),
    });
    // Award +5 political power for voting
    const awardRef = db.doc(`point_awards/${userId}_battle_vote_${today}`);
    const userRef = db.doc(`users/${userId}`);
    tx.set(awardRef, { uid: userId, action: 'battle_vote', points: 5, date: today, createdAt: FieldValue.serverTimestamp() }, { merge: false });
    tx.set(userRef, { totalPoints: FieldValue.increment(5), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });

  return { ok: true, charId };
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

  return { ok: true, id: ref.id };
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

  // 현재 집권 대표 (어제 배틀 승자)
  let currentKing = null;
  if (yestSnap && yestSnap.exists && yestSnap.data().king) {
    const kingId = yestSnap.data().king;
    const char = BATTLE_CHARS.find(c => c.id === kingId);
    if (char) {
      const histSnap = await db.collection('kingHistory')
        .orderBy('date', 'desc').limit(10).get();
      let streak = 0;
      for (const doc of histSnap.docs) {
        if (doc.data().charId === kingId) streak++;
        else break;
      }
      currentKing = { charId: kingId, name: char.name, emoji: char.emoji, title: char.title, party: char.party, streak };
    }
  }

  if (!todaySnap.exists) {
    return {
      exists: false,
      today,
      currentKing,
      chars: BATTLE_CHARS.map(({ id, name, emoji, title, color, party }) => ({ id, name, emoji, title, color, party })),
    };
  }

  const battle = todaySnap.data();
  const userVote = voteSnap?.exists ? voteSnap.data().charId : null;

  // 최근 댓글 20개
  let recentComments = [];
  try {
    const commSnap = await db.collection(`battles/${today}/comments`)
      .orderBy('createdAt', 'desc').limit(20).get();
    recentComments = commSnap.docs.map(d => ({
      id: d.id,
      authorName: d.data().authorName || '익명',
      text: d.data().text || '',
      createdAt: d.data().createdAt?.toMillis?.() || null,
    })).reverse();
  } catch {}

  return {
    exists: true,
    today,
    topic: battle.topic,
    topicDesc: battle.topicDesc,
    turns: battle.turns || [],
    votes: battle.votes || {},
    totalVotes: battle.totalVotes || 0,
    status: battle.status,
    king: battle.king,
    aftermath: battle.aftermath || null,
    userVote,
    currentKing,
    recentComments,
    chars: BATTLE_CHARS.map(({ id, name, emoji, title, color, party }) => ({ id, name, emoji, title, color, party })),
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

  const votes = battleSnap.data().votes || {};
  let maxVotes = -1;
  let winner = null;
  for (const [charId, count] of Object.entries(votes)) {
    if (count > maxVotes) { maxVotes = count; winner = charId; }
  }

  await battleRef.update({ king: winner, status: 'ended' });

  if (winner) {
    const char = BATTLE_CHARS.find(c => c.id === winner);
    await Promise.all([
      db.collection('kingHistory').add({
        date: today,
        charId: winner,
        charName: char?.name || winner,
        party: char?.party || '',
        emoji: char?.emoji || '',
        votes: maxVotes,
        createdAt: FieldValue.serverTimestamp(),
      }),
      db.doc(`charStats/${winner}`).set({
        totalWins: FieldValue.increment(1),
        lastWin: today,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true }),
    ]);
    console.log('[battle] closed', today, '→ winner:', winner, 'votes:', maxVotes);
    await generateAftermath(winner, battleSnap.data().topic || '', battleRef);
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
    chars: BATTLE_CHARS.map(({ id, name, emoji, title, color, party }) => ({ id, name, emoji, title, color, party })),
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

  const initialVotes = {};
  BATTLE_CHARS.forEach(c => { initialVotes[c.id] = 0; });

  const raw = await callAI(buildBattlePrompt(topicHint ? { topicHint } : null), 3500);
  const parsed = safeParseJson(raw);
  if (!parsed || !Array.isArray(parsed.turns)) {
    throw new HttpsError('internal', 'AI 응답 파싱 실패: ' + raw.slice(0, 200));
  }

  const turns = parsed.turns.filter(t => t.charId && t.text);
  const prosecutorIdx = turns.findLastIndex(t => t.charId === 'prosecutor');
  if (prosecutorIdx !== -1 && prosecutorIdx !== turns.length - 1) {
    const [prosecutor] = turns.splice(prosecutorIdx, 1);
    turns.push(prosecutor);
  }

  await db.doc(`battles/${today}`).set({
    topic: String(parsed.topic || '오늘의 정치 이슈').slice(0, 40),
    topicDesc: String(parsed.topicDesc || '').slice(0, 120),
    turns,
    votes: initialVotes,
    totalVotes: 0,
    king: null,
    status: 'live',
    date: today,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, topic: parsed.topic, turns: turns.length };
});
