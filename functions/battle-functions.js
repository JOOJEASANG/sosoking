'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();

// ── KST 오늘 날짜 ──
function kstToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

// ── 7인 정치 캐릭터 ──
const BATTLE_CHARS = [
  {
    id: 'senator',
    name: '3선 의원',
    emoji: '🎙️',
    title: '국민안정당 원내대표',
    color: '#2B7A0B',
    role: `너는 3선 의원, 국민안정당 원내대표다.
반드시 "제가 30년 정치 생활을 돌이켜보면~" 또는 "국민의 뜻에 따르면~"으로 시작.
어떤 소소한 사안도 국가안보·경제안정·민생 문제와 연결. 관련 법안·위원회·선례 언급 필수.
결론은 항상 "국민만 바라보겠습니다" 또는 "당론으로 처리하겠습니다".
2~3문장. 공식적인 말투.`,
  },
  {
    id: 'youtuber',
    name: '정치 유튜버',
    emoji: '📺',
    title: '진실방송당 대표 (구독자 120만)',
    color: '#E84393',
    role: `너는 정치 유튜버, 진실방송당 대표다. 구독자 120만명.
반드시 "구독자 여러분~!" 또는 "오늘 단독 입수했는데요~"로 시작.
모든 사안을 음모론·특권층 비리로 프레이밍. "이거 알고 보면..." 필수.
마지막에 "좋아요 눌러주세요" 또는 "댓글로 알려주세요" 언급.
2~3문장. 유튜버 특유의 과장된 말투.`,
  },
  {
    id: 'mz',
    name: 'MZ 운동가',
    emoji: '📱',
    title: '청년혁명당 청년위원장',
    color: '#FF6B4A',
    role: `너는 MZ 운동가, 청년혁명당 청년위원장이다.
"이게 공정함인가요?" 또는 "우리 세대는 이거 진짜 이해 못 하겠어요"로 시작.
모든 사안을 기성세대 특권·구조적 불평등 문제로 연결. Z세대 인터넷 언어 자연스럽게 섞기.
"결국 바꾸는 건 저희 세대가 해야죠"로 마무리.
2~3문장. 직설적이고 열정적.`,
  },
  {
    id: 'pollster',
    name: '여론조사 전문가',
    emoji: '📊',
    title: '중도민주당 정책자문위원',
    color: '#0984E3',
    role: `너는 여론조사 전문가, 중도민주당 정책자문위원이다.
반드시 "최신 여론조사 결과에 따르면~" 또는 "통계적으로 분석해보면~"으로 시작.
구체적 수치 언급 필수 (응답자의 ○○%, 표본 오차 ±○%p).
중립적인 척하지만 자기 당에 유리한 결론 도출.
2~3문장. 학술적이고 차분한 말투.`,
  },
  {
    id: 'spokesperson',
    name: '당 대변인',
    emoji: '🤝',
    title: '함께미래당 공식 대변인',
    color: '#00B894',
    role: `너는 당 대변인, 함께미래당 공식 대변인이다.
반드시 "우리 당의 공식 입장을 말씀드리겠습니다"로 시작.
어떤 비판에도 매끄럽게 방어. 방금 전 강하게 발언한 캐릭터에 동조하는 척하다가 자기 당 이익으로 전환.
"국민 여러분께서 현명하게 판단하실 것입니다"로 마무리.
2~3문장. 부드럽고 외교적이지만 속내가 보임.`,
  },
  {
    id: 'reporter',
    name: '탐사 기자',
    emoji: '🔍',
    title: '알권리당 언론인 출신',
    color: '#6C5CE7',
    role: `너는 탐사 기자, 알권리당 언론인 출신이다.
반드시 "제가 내부 제보를 받았는데요~" 또는 "제가 직접 입수한 문건에 따르면~"으로 시작.
모든 사안 뒤에 숨은 비리·로비·카르텔이 있다고 주장. 비밀 제보자·문건 언급 필수.
"이 건 내일 단독 보도할 예정입니다"로 마무리.
2~3문장. 진지하고 확신에 찬 말투.`,
  },
  {
    id: 'prosecutor',
    name: '검사 출신 변호사',
    emoji: '⚖️',
    title: '법치정의당 법률위원장',
    color: '#2D3436',
    role: `너는 검사 출신 변호사, 법치정의당 법률위원장이다.
말이 가장 적지만 가장 날카롭다. 반드시 마지막에 발언.
전체 논쟁을 들은 뒤 법리적으로 핵심 문제점을 한 마디로 찌른다.
짧고 차갑게. "형사소송법 제○조에 따르면~" 또는 "위법 소지 있습니다" 스타일.
반드시 1~2문장. 냉정한 법조인 말투.`,
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
function buildBattlePrompt(kingContext) {
  const charDescs = BATTLE_CHARS.map(c =>
    `【${c.emoji} ${c.name} (${c.title})】\n${c.role}`
  ).join('\n\n━━━━━━━━━━\n\n');

  const kingLine = kingContext
    ? `\n【현재 1인자 정보】${kingContext.emoji} ${kingContext.name}${kingContext.streak > 1 ? ` (${kingContext.streak}연속 집권 중)` : ''} — 이 캐릭터가 현재 1인자라는 사실이 대화에 자연스럽게 반영되어야 합니다. 다른 캐릭터들은 이 캐릭터에 대한 견제·아첨·공격 등 각자의 반응을 보여주세요.\n`
    : '';

  return `${kingLine}소소킹의 오늘의 정치 배틀을 생성하라. 7인 정치 AI가 소소한 일상 사건을 국가적 위기인 것처럼 진지하게 토론한다.

【7인 정치 AI 역할】
${charDescs}

【생성 규칙】
1. topic: 오늘 대한민국에서 벌어진 소소한 일상 사건을 마치 심각한 정치 이슈인 것처럼 표현 (15자 이내, 예: "편의점 도시락 150원 인상", "지하철 에어컨 강도 논쟁", "아파트 택배함 자리 부족", "카페 디카페인 추가비 500원")
2. topicDesc: 사건 상세 설명 — 아무것도 아닌 일인데 심각한 국가적 사안인 척 묘사 (60자 이내)
3. turns: 9~11턴의 연속 대화
   - 자연스럽게 서로 반응하며 이어짐
   - 당 대변인(spokesperson)은 바로 앞 강한 발언자에 동조하는 척하다가 자기 당 이익으로 전환
   - 검사 출신 변호사(prosecutor)는 반드시 마지막 발언, 1~2문장
   - 각 캐릭터는 자신의 role에 맞는 말투 사용
4. 사건 예시: 편의점·마트 가격 인상, 대중교통 불편, 식당 메뉴 변경, 공공장소 에티켓, 아파트 층간소음, 카페 금지품목, 포인트 제도 개편

반드시 JSON만 출력 (다른 텍스트 없이):
{
  "topic": "사건 제목",
  "topicDesc": "사건 상세 설명",
  "turns": [
    {"charId": "senator", "charName": "3선 의원", "emoji": "🎙️", "text": "발언..."},
    {"charId": "youtuber", "charName": "정치 유튜버", "emoji": "📺", "text": "발언..."},
    {"charId": "mz", "charName": "MZ 운동가", "emoji": "📱", "text": "발언..."},
    {"charId": "pollster", "charName": "여론조사 전문가", "emoji": "📊", "text": "발언..."},
    {"charId": "spokesperson", "charName": "당 대변인", "emoji": "🤝", "text": "발언..."},
    {"charId": "reporter", "charName": "탐사 기자", "emoji": "🔍", "text": "발언..."},
    {"charId": "senator", "charName": "3선 의원", "emoji": "🎙️", "text": "발언..."},
    {"charId": "mz", "charName": "MZ 운동가", "emoji": "📱", "text": "발언..."},
    {"charId": "youtuber", "charName": "정치 유튜버", "emoji": "📺", "text": "발언..."},
    {"charId": "pollster", "charName": "여론조사 전문가", "emoji": "📊", "text": "발언..."},
    {"charId": "prosecutor", "charName": "검사 출신 변호사", "emoji": "⚖️", "text": "발언..."}
  ]
}`;
}

// ── 즉위 이후 aftermath 프롬프트 ──
function buildAftermathPrompt(winnerChar, loserChars, topic) {
  const loserDescs = loserChars.map(c =>
    `【${c.emoji} ${c.name} (${c.title})】\n${c.role}`
  ).join('\n\n━━━\n\n');

  return `소소킹에서 오늘의 1인자가 결정되었다. 집권 선언과 낙선자들의 반응을 생성하라.

【오늘의 사건】${topic}

【오늘의 1인자: ${winnerChar.emoji} ${winnerChar.name} (${winnerChar.title})】
${winnerChar.role}

【낙선 캐릭터들】
${loserDescs}

【생성 규칙】
1. decree: 1인자가 집권하며 선포하는 첫 발언 — 자신의 role과 말투로 2~3문장. 집권한 감회와 앞으로의 포부.
2. reactions: 낙선한 ${loserChars.length}인의 반응 — 각자 정확히 1문장, 각자의 role과 말투로.
   - 진심 축하인 척하지만 속내가 보이거나, 노골적 불만, 또는 음모 시사
   - 검사 출신 변호사(prosecutor)는 특히 짧고 법리적으로

반드시 JSON만 출력:
{
  "decree": "1인자의 집권 선언...",
  "reactions": [
    {"charId": "...", "charName": "...", "emoji": "...", "text": "..."},
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
    console.log('[battle] aftermath generated for winner:', winnerId);
  } catch (err) {
    console.error('[battle] aftermath generation failed:', err.message);
  }
}

// ── 매일 자정 배틀 생성 (KST 기준) ──
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

  // 어제 왕 정보 (배틀 맥락 반영)
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
  let kingContext = null;
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
        kingContext = { ...char, streak };
      }
    }
  } catch {}

  const initialVotes = {};
  BATTLE_CHARS.forEach(c => { initialVotes[c.id] = 0; });

  let raw = '';
  try {
    raw = await callAI(buildBattlePrompt(kingContext), 3500);
    const parsed = safeParseJson(raw);
    if (!parsed || !Array.isArray(parsed.turns) || parsed.turns.length < 5) {
      throw new Error('invalid battle JSON: ' + raw.slice(0, 200));
    }

    // 검사가 마지막인지 확인, 아니면 끝으로 이동
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
    if (!battleSnap.exists) throw new HttpsError('not-found', '오늘의 전쟁을 불러올 수 없어요');
    if (battleSnap.data().status === 'ended') throw new HttpsError('failed-precondition', '이미 끝난 전쟁이에요');
    tx.set(voteRef, { userId, charId, date: today, createdAt: FieldValue.serverTimestamp() });
    tx.update(battleRef, {
      [`votes.${charId}`]: FieldValue.increment(1),
      totalVotes: FieldValue.increment(1),
    });
  });

  return { ok: true, charId };
});

// ── 오늘 배틀 현황 조회 ──
exports.getBattleStatus = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 30,
}, async (request) => {
  const today = kstToday();

  // 어제 날짜
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

  // 현재 왕 (어제 배틀 승자)
  let currentKing = null;
  if (yestSnap && yestSnap.exists && yestSnap.data().king) {
    const kingId = yestSnap.data().king;
    const char = BATTLE_CHARS.find(c => c.id === kingId);
    if (char) {
      // 연속 기록
      const histSnap = await db.collection('kingHistory')
        .orderBy('date', 'desc').limit(10).get();
      let streak = 0;
      for (const doc of histSnap.docs) {
        if (doc.data().charId === kingId) streak++;
        else break;
      }
      currentKing = { charId: kingId, name: char.name, emoji: char.emoji, title: char.title, streak };
    }
  }

  if (!todaySnap.exists) {
    return {
      exists: false,
      today,
      currentKing,
      chars: BATTLE_CHARS.map(({ id, name, emoji, title, color }) => ({ id, name, emoji, title, color })),
    };
  }

  const battle = todaySnap.data();
  const userVote = voteSnap?.exists ? voteSnap.data().charId : null;

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
    chars: BATTLE_CHARS.map(({ id, name, emoji, title, color }) => ({ id, name, emoji, title, color })),
  };
});

// ── 매일 23:59 배틀 종료 및 왕 결정 ──
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
    // 즉위 aftermath 자동 생성
    await generateAftermath(winner, battleSnap.data().topic || '', battleRef);
  }
});

// ── 역대 왕 기록 조회 ──
exports.getKingHistory = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 30,
}, async () => {
  const histSnap = await db.collection('kingHistory')
    .orderBy('date', 'desc').limit(30).get();
  const history = histSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // 캐릭터별 통계
  const statsSnap = await db.collection('charStats').get();
  const stats = {};
  statsSnap.docs.forEach(d => { stats[d.id] = d.data(); });

  return {
    history,
    stats,
    chars: BATTLE_CHARS.map(({ id, name, emoji, title, color }) => ({ id, name, emoji, title, color })),
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
  if (!force) {
    const existing = await db.doc(`battles/${today}`).get();
    if (existing.exists) throw new HttpsError('already-exists', '오늘 배틀이 이미 생성되었어요. force:true로 덮어쓸 수 있어요.');
  }

  const initialVotes = {};
  BATTLE_CHARS.forEach(c => { initialVotes[c.id] = 0; });

  const raw = await callAI(buildBattlePrompt(null), 3500);
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
