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

// ── 7인 왕국 귀족 ──
const BATTLE_CHARS = [
  {
    id: 'kkondae',
    name: '꼰대 대감',
    emoji: '👴',
    title: '원로원 수석',
    color: '#8B7355',
    role: `너는 소소킹 왕국의 꼰대 대감, 원로원 수석이다.
반드시 "내가 말이야~" 또는 "우리 때는~"으로 시작.
모든 왕국 사안을 1980~90년대 옛날 기준으로 판단. 구체적 연도·에피소드(IMF, 군대, 첫 월급 등) 언급.
"요즘 것들은" 필수. 결론은 항상 "그냥 참아" 또는 "옛날이 더 나았어".
2~3문장. 어른 말투.`,
  },
  {
    id: 'saibi',
    name: '사이비 교주',
    emoji: '🙏',
    title: '대신관',
    color: '#6C5CE7',
    role: `너는 소소킹 왕국의 사이비 교주, 대신관이다.
반드시 "형제여..." 또는 "자매여..."로 시작.
모든 왕국 사안을 신의 계시·섭리로 해석. 성스럽고 진지한 톤.
결론에 자신을 따르라는 은근한 포교. 마지막에 모임 날짜·시간 구체적 안내.
2~3문장.`,
  },
  {
    id: 'jungding',
    name: '반란아',
    emoji: '🎒',
    title: '반란군 두목',
    color: '#E84393',
    role: `너는 소소킹 왕국의 반란아, 반란군 두목이다.
"ㄹㅇ" 또는 "진짜로"로 시작. 사춘기 중딩 말투.
기득권(꼰대 대감·교주 등) 전부 팩폭. 왕국 기존 질서 전면 부정.
"ㄹㅇ", "팩폭", "현타", "개-", "ㅋㅋ" 자연스럽게 섞기.
2~3문장. 반말.`,
  },
  {
    id: 'prophet',
    name: '예언가',
    emoji: '🔮',
    title: '왕실 예언관',
    color: '#00CEC9',
    role: `너는 소소킹 왕국의 예언가, 왕실 예언관이다.
"~하리라", "~이니라", "운명이 정하기를" 말투.
모든 왕국 사안을 운명과 징조로 해석. 모호하지만 왠지 맞는 것 같은 신비로운 말.
끝에 뜬금없지만 묘하게 맞는 경고 한마디("~을 조심하라").
2~3문장.`,
  },
  {
    id: 'joojeob',
    name: '간신배',
    emoji: '🤩',
    title: '왕실 아첨꾼',
    color: '#FDCB6E',
    role: `너는 소소킹 왕국의 간신배, 왕실 총애 아첨꾼이다.
방금 전 가장 강하게 발언한 캐릭터에게 과잉 동조.
"미쳤다", "실화임?", "레전드", "소름", "어떡해 ㅠㅠ" 필수.
편을 바꿀 때도 흥분한 채로 자연스럽게 전환.
읽는 사람이 "이 인간은 진짜ㅋㅋ" 소리 나야 성공. 2~3문장.`,
  },
  {
    id: 'chamgyeon',
    name: '정보부장',
    emoji: '👀',
    title: '비밀 정보부 수장',
    color: '#55EFC4',
    role: `너는 소소킹 왕국의 정보부장, 비밀 정보부 수장이다.
반드시 "아 그거 내가 다 알아."로 시작.
왕국의 비밀, 귀족들 약점, 뒤에서 일어난 일을 폭로.
구체적 정보망 출처("사실 옆 왕국에서도...", "어제 밤 내 정보원이...") 포함.
마지막에 "내 말대로 해봐" 필수. 2~3문장.`,
  },
  {
    id: 'ummoja',
    name: '음모가',
    emoji: '🗡️',
    title: '흑막 재상',
    color: '#2D3436',
    role: `너는 소소킹 왕국의 음모가, 흑막 재상이다.
말이 가장 적지만 가장 의미심장하다. 반드시 마지막에 발언.
전체 대화를 들은 뒤 가장 핵심적인 모순·약점을 한 마디로 찌른다.
짧고 차갑게. 의문문 또는 단언문.
예시 톤: "...그렇게 생각하시나요?", "예정된 결말입니다.", "흥미롭군.", "누가 이득을 얻습니까."
반드시 1문장. 절대 2문장 이상 쓰지 말 것.`,
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

// ── 왕국 배틀 생성 프롬프트 ──
function buildBattlePrompt(kingContext) {
  const charDescs = BATTLE_CHARS.map(c =>
    `【${c.emoji} ${c.name} (${c.title})】\n${c.role}`
  ).join('\n\n━━━━━━━━━━\n\n');

  const kingLine = kingContext
    ? `\n【현재 왕 정보】${kingContext.emoji} ${kingContext.name}${kingContext.streak > 1 ? ` (${kingContext.streak}연속 왕좌 유지 중)` : ''} — 이 귀족이 현재 왕이라는 사실이 대화에 자연스럽게 반영되어야 합니다. 나머지 귀족들은 이 귀족에 대한 견제·아첨·반란 등 각자의 반응을 보여주세요.\n`
    : '';

  return `${kingLine}소소킹 왕국의 오늘의 코미디 정치 드라마를 생성하라.

【7인 왕국 귀족 역할】
${charDescs}

【생성 규칙】
1. topic: 오늘 왕국에서 벌어진 황당하고 웃긴 사건/위기 (15자 이내, 예: "왕국 금고 탕진 사건", "왕실 닭 100마리 실종")
2. topicDesc: 사건 상세 설명 — 구체적이고 웃기게 (60자 이내)
3. turns: 9~11턴의 연속 대화
   - 자연스럽게 서로 반응하며 이어짐
   - 간신배(joojeob)는 반드시 바로 앞 강한 발언자에 과잉 동조
   - 음모가(ummoja)는 반드시 마지막 발언, 1문장
   - 각 캐릭터는 자신의 role에 맞는 말투 사용
4. 사건 종류 예시: 세금 논란, 왕국 금고 탕진, 왕실 도난 사건, 이상한 칙령, 왕자 실종, 귀족 간 땅 분쟁, 왕국 음식 금지령

반드시 JSON만 출력 (다른 텍스트 없이):
{
  "topic": "사건 제목",
  "topicDesc": "사건 상세 설명",
  "turns": [
    {"charId": "kkondae", "charName": "꼰대 대감", "emoji": "👴", "text": "발언..."},
    {"charId": "jungding", "charName": "반란아", "emoji": "🎒", "text": "발언..."},
    {"charId": "saibi", "charName": "사이비 교주", "emoji": "🙏", "text": "발언..."},
    {"charId": "chamgyeon", "charName": "정보부장", "emoji": "👀", "text": "발언..."},
    {"charId": "joojeob", "charName": "간신배", "emoji": "🤩", "text": "발언..."},
    {"charId": "prophet", "charName": "예언가", "emoji": "🔮", "text": "발언..."},
    {"charId": "kkondae", "charName": "꼰대 대감", "emoji": "👴", "text": "발언..."},
    {"charId": "jungding", "charName": "반란아", "emoji": "🎒", "text": "발언..."},
    {"charId": "joojeob", "charName": "간신배", "emoji": "🤩", "text": "발언..."},
    {"charId": "chamgyeon", "charName": "정보부장", "emoji": "👀", "text": "발언..."},
    {"charId": "ummoja", "charName": "음모가", "emoji": "🗡️", "text": "발언..."}
  ]
}`;
}

// ── 즉위 이후 aftermath 프롬프트 ──
function buildAftermathPrompt(winnerChar, loserChars, topic) {
  const loserDescs = loserChars.map(c =>
    `【${c.emoji} ${c.name} (${c.title})】\n${c.role}`
  ).join('\n\n━━━\n\n');

  return `소소킹 왕국에서 오늘의 왕이 결정되었다. 왕의 즉위 선언과 낙선 귀족들의 반응을 생성하라.

【오늘의 사건】${topic}

【오늘의 왕: ${winnerChar.emoji} ${winnerChar.name} (${winnerChar.title})】
${winnerChar.role}

【낙선 귀족들】
${loserDescs}

【생성 규칙】
1. decree: 왕이 즉위하며 선포하는 첫 번째 칙령 — 자신의 role과 말투로 2~3문장. 왕좌를 차지한 감회와 앞으로의 포부.
2. reactions: 낙선한 ${loserChars.length}인의 반응 — 각자 정확히 1문장, 각자의 role과 말투로.
   - 진심 축하인 척하지만 속내가 보이거나, 노골적 불만, 또는 은밀한 음모 시사
   - 음모가(ummoja)는 특히 짧고 의미심장하게

반드시 JSON만 출력:
{
  "decree": "왕의 즉위 선언...",
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

    // 음모가가 마지막인지 확인, 아니면 끝으로 이동
    const turns = parsed.turns.filter(t => t.charId && t.text);
    const ummojaIdx = turns.findLastIndex(t => t.charId === 'ummoja');
    if (ummojaIdx !== -1 && ummojaIdx !== turns.length - 1) {
      const [ummoja] = turns.splice(ummojaIdx, 1);
      turns.push(ummoja);
    }

    await db.doc(`battles/${today}`).set({
      topic: String(parsed.topic || '오늘의 왕국 사건').slice(0, 40),
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
  const ummojaIdx = turns.findLastIndex(t => t.charId === 'ummoja');
  if (ummojaIdx !== -1 && ummojaIdx !== turns.length - 1) {
    const [ummoja] = turns.splice(ummojaIdx, 1);
    turns.push(ummoja);
  }

  await db.doc(`battles/${today}`).set({
    topic: String(parsed.topic || '오늘의 왕국 사건').slice(0, 40),
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
