'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();

const { eventForDate, eventByDay, buildHistoryPromptBlock } = require('./republic-history-events');

function kstToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function kstDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

function clean(value, max = 200) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

// 새공화국 3당 정보
const PARTY_INFO = Object.freeze({
  national: { name: '국민질서당', emoji: '🛡️', color: '#263B66', ideology: '보수파' },
  youth:    { name: '시민개혁당', emoji: '🕯️', color: '#B8323B', ideology: '진보파' },
  center:   { name: '국민통합당', emoji: '⚖️', color: '#2F7D6E', ideology: '중도파' },
});

// 정당당 2명, 총 6명. 실존 인물과 무관한 가상 정치 캐릭터.
const BATTLE_CHARS = Object.freeze([
  {
    id: 'kang_doyoon', name: '강도윤', emoji: '🛡️', title: '국민질서당 대표',
    color: '#263B66', party: '국민질서당', partyKey: 'national',
    role: `안보·질서·성장 중심의 보수 대표. 위기 대응에는 강하지만 권위주의 논란을 의식한다. 짧고 단호한 문장으로 말하되, 반드시 헌정 질서와 사회 안정의 필요성을 함께 언급한다. 2~3문장.`,
  },
  {
    id: 'seo_moonha', name: '서문하', emoji: '📈', title: '국민질서당 전략가',
    color: '#3D527F', party: '국민질서당', partyKey: 'national',
    role: `경제·언론전·프레임 설계에 능한 보수 전략가. 개혁 요구를 부정하지 않지만 시장 충격, 행정 혼란, 안보 공백을 따진다. 수치와 메시지 전략을 섞어 현실적으로 말한다. 2~3문장.`,
  },
  {
    id: 'han_seoyoon', name: '한서윤', emoji: '🕯️', title: '시민개혁당 대표',
    color: '#B8323B', party: '시민개혁당', partyKey: 'youth',
    role: `개혁·복지·시민권 중심의 진보 대표. 광장과 시민 참여를 중시하지만 재정 부담 비판을 의식한다. 뜨겁지만 품격 있게, 권력기관 견제와 시민 권리를 강조한다. 2~3문장.`,
  },
  {
    id: 'baek_jinwoo', name: '백진우', emoji: '🔎', title: '시민개혁당 개혁참모',
    color: '#D94B56', party: '시민개혁당', partyKey: 'youth',
    role: `검찰·재벌·노동·불평등 이슈에 강한 개혁 참모. 구조적 문제를 파고들며 책임 소재를 따진다. 과격한 구호보다 제도 개편 논리를 앞세운다. 2~3문장.`,
  },
  {
    id: 'yoon_taegun', name: '윤태건', emoji: '⚖️', title: '국민통합당 대표',
    color: '#2F7D6E', party: '국민통합당', partyKey: 'center',
    role: `협치·연정·실용을 앞세우는 중도 대표. 갈등 조정에는 강하지만 우유부단하다는 비판을 의식한다. 양쪽의 명분을 인정한 뒤 실행 가능한 절충안을 제시한다. 2~3문장.`,
  },
  {
    id: 'oh_harin', name: '오하린', emoji: '📊', title: '국민통합당 여론분석가',
    color: '#45A08F', party: '국민통합당', partyKey: 'center',
    role: `세대·지역·온라인 여론을 읽는 분석가. 감정적 진영 싸움보다 데이터와 중간층 반응을 본다. 여론 흐름과 정책 리스크를 차분히 짚는다. 2~3문장.`,
  },
]);

exports.BATTLE_CHARS = BATTLE_CHARS;

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
    const model = genAI.getGenerativeModel({ model: config.geminiModel || 'gemini-2.5-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.82, responseMimeType: 'application/json' },
    });
    return result.response.text();
  }
  if (!config.claudeApiKey) throw new Error('AI 키 미설정');
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: config.claudeApiKey });
  const msg = await anthropic.messages.create({
    model: config.claudeModel || 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    temperature: 0.82,
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

function partyBlock() {
  return Object.entries(PARTY_INFO).map(([pid, info]) => {
    const chars = BATTLE_CHARS.filter(c => c.partyKey === pid)
      .map(c => `  - ${c.emoji} ${c.name}(${c.title}): ${c.role}`).join('\n');
    return `▶ ${info.emoji} ${info.name} / ${info.ideology} / partyKey: ${pid}\n${chars}`;
  }).join('\n\n');
}

async function getRulingContext(today) {
  const yesterday = kstDateOffset(-1);
  let ruling = null;
  try {
    const yestSnap = await db.doc(`battles/${yesterday}`).get();
    const winPartyId = yestSnap.exists ? yestSnap.data().winningParty : null;
    if (PARTY_INFO[winPartyId]) {
      const histSnap = await db.collection('kingHistory').orderBy('date', 'desc').limit(10).get();
      let streak = 0;
      for (const histDoc of histSnap.docs) {
        if (histDoc.data().partyId === winPartyId) streak++;
        else break;
      }
      ruling = { partyId: winPartyId, partyName: PARTY_INFO[winPartyId].name, streak };
    }
  } catch {}

  let topicHint = '';
  try {
    const configSnap = await db.doc('config/daily_topic').get();
    if (configSnap.exists && configSnap.data().date === today) topicHint = String(configSnap.data().hint || '');
  } catch {}

  return { ruling, topicHint };
}

function buildBattlePrompt(historyEvent, context, today) {
  const rulingText = context?.ruling
    ? `\n【어제의 논쟁 승리 정당】${context.ruling.partyName}${context.ruling.streak > 1 ? ` · ${context.ruling.streak}일 연속 승리` : ''}\n`
    : '';
  const hintText = context?.topicHint
    ? `\n【관리자 추가 힌트】${context.topicHint}\n`
    : '';

  return `당신은 소소킹의 역사 기반 풍자 정치 시뮬레이션 작가입니다.
오늘 날짜는 ${today}입니다.
실제 인물명·실제 정당명은 절대 쓰지 말고, 실제 현대정치 흐름은 모두 가상 국가 "소소공화국"의 사건처럼 변형하세요.
피해자·참사·사회적 고통을 조롱하지 말고, 제도·권력·여론·정당 전략을 풍자하세요.
너무 가볍게만 가지 말고 역사와 게임성이 같이 느껴져야 합니다.

${buildHistoryPromptBlock(historyEvent)}
${rulingText}${hintText}
【정당과 캐릭터】
${partyBlock()}

아래 JSON으로만 응답하세요.
{
  "topic": "오늘의 정당 대항전 제목, 24자 이내",
  "topicDesc": "역사 모티브를 가상 사건으로 바꾼 설명, 90자 이내",
  "historyQuestion": "오늘 유저가 판단할 핵심 질문, 50자 이내",
  "historyDay": ${historyEvent.day},
  "historyEra": "${historyEvent.era}",
  "motifYear": ${historyEvent.motifYear},
  "motif": "${historyEvent.motif}",
  "partyDebates": {
    "national": {
      "stance": "국민질서당 핵심 입장, 24자 이내",
      "statements": [
        {"charId":"kang_doyoon","charName":"강도윤","emoji":"🛡️","text":"발언"},
        {"charId":"seo_moonha","charName":"서문하","emoji":"📈","text":"발언"}
      ]
    },
    "youth": {
      "stance": "시민개혁당 핵심 입장, 24자 이내",
      "statements": [
        {"charId":"han_seoyoon","charName":"한서윤","emoji":"🕯️","text":"발언"},
        {"charId":"baek_jinwoo","charName":"백진우","emoji":"🔎","text":"발언"}
      ]
    },
    "center": {
      "stance": "국민통합당 핵심 입장, 24자 이내",
      "statements": [
        {"charId":"yoon_taegun","charName":"윤태건","emoji":"⚖️","text":"발언"},
        {"charId":"oh_harin","charName":"오하린","emoji":"📊","text":"발언"}
      ]
    }
  }
}`;
}

function fallbackBattle(historyEvent) {
  return {
    topic: clean(historyEvent.parodyTitle, 40),
    topicDesc: clean(historyEvent.issueSummary, 120),
    historyQuestion: historyEvent.question,
    historyDay: historyEvent.day,
    historyEra: historyEvent.era,
    motifYear: historyEvent.motifYear,
    motif: historyEvent.motif,
    partyDebates: {
      national: {
        stance: '질서 있는 전환',
        statements: [
          { charId: 'kang_doyoon', charName: '강도윤', emoji: '🛡️', text: historyEvent.stances.national },
          { charId: 'seo_moonha', charName: '서문하', emoji: '📈', text: '개혁의 방향은 인정하지만 시장과 행정이 흔들리면 시민이 먼저 피해를 봅니다. 절차와 속도를 함께 관리해야 합니다.' },
        ],
      },
      youth: {
        stance: '시민 개혁 우선',
        statements: [
          { charId: 'han_seoyoon', charName: '한서윤', emoji: '🕯️', text: historyEvent.stances.youth },
          { charId: 'baek_jinwoo', charName: '백진우', emoji: '🔎', text: '문제는 늘 구조 안에 숨어 있습니다. 오늘의 쟁점도 책임 소재와 제도 개편을 분리해서 볼 수 없습니다.' },
        ],
      },
      center: {
        stance: '합의와 실행',
        statements: [
          { charId: 'yoon_taegun', charName: '윤태건', emoji: '⚖️', text: historyEvent.stances.center },
          { charId: 'oh_harin', charName: '오하린', emoji: '📊', text: '중간층은 명분보다 실행 가능성을 봅니다. 갈등을 낮추면서도 결과가 보이는 합의안이 필요합니다.' },
        ],
      },
    },
  };
}

function normalizeBattle(parsed, historyEvent) {
  const base = fallbackBattle(historyEvent);
  const out = parsed && typeof parsed === 'object' ? parsed : base;
  const debates = out.partyDebates && typeof out.partyDebates === 'object' ? out.partyDebates : base.partyDebates;
  for (const pid of Object.keys(PARTY_INFO)) {
    if (!debates[pid]) debates[pid] = base.partyDebates[pid];
    debates[pid].stance = clean(debates[pid].stance || base.partyDebates[pid].stance, 40);
    debates[pid].statements = Array.isArray(debates[pid].statements) && debates[pid].statements.length
      ? debates[pid].statements.slice(0, 2).map((s, idx) => {
          const fallback = base.partyDebates[pid].statements[idx] || base.partyDebates[pid].statements[0];
          return {
            charId: clean(s.charId || fallback.charId, 40),
            charName: clean(s.charName || fallback.charName, 20),
            emoji: clean(s.emoji || fallback.emoji, 4),
            text: clean(s.text || fallback.text, 320),
          };
        })
      : base.partyDebates[pid].statements;
  }
  return {
    topic: clean(out.topic || base.topic, 40),
    topicDesc: clean(out.topicDesc || base.topicDesc, 120),
    historyQuestion: clean(out.historyQuestion || historyEvent.question, 80),
    historyDay: Number(out.historyDay || historyEvent.day),
    historyEra: clean(out.historyEra || historyEvent.era, 40),
    motifYear: Number(out.motifYear || historyEvent.motifYear),
    motif: clean(out.motif || historyEvent.motif, 100),
    partyDebates: debates,
  };
}

function fallbackCitizenComments(partyDebates) {
  const out = [];
  for (const [pid, d] of Object.entries(partyDebates || {})) {
    const stance = clean(d?.stance || '', 60);
    if (!stance) continue;
    out.push({ side: pid, text: `${PARTY_INFO[pid]?.name || pid} 쪽 ${stance}, 오늘 쟁점엔 이게 더 현실적임.` });
    out.push({ side: pid, text: `난 ${stance}에 한 표. 역사에서 배운 게 있다면 반복하지 말자는 거지.` });
  }
  return out;
}

async function seedCitizenActivity(date, battleData, context) {
  const battleRef = db.doc(`battles/${date}`);
  const pids = Object.keys(PARTY_INFO);
  const batch = db.batch();
  const votes = { national: 0, youth: 0, center: 0 };
  const lean = context?.ruling?.partyId || pids[Math.floor(Math.random() * pids.length)];
  const total = 30 + Math.floor(Math.random() * 36);
  for (let i = 0; i < total; i++) {
    const pool = [...pids, lean];
    const pid = pool[Math.floor(Math.random() * pool.length)];
    votes[pid] += 1;
  }
  batch.set(battleRef, { votes, totalVotes: votes.national + votes.youth + votes.center }, { merge: true });

  const comments = fallbackCitizenComments(battleData.partyDebates).slice(0, 9);
  const now = Date.now();
  const names = ['광장단골', '중립기어', '헌법읽는밤', '정치구경꾼', '뉴스중독자', '직장인시민', '동네이장님', '팩트체커', '소소시민A'];
  comments.forEach((c, i) => {
    const pid = PARTY_INFO[c.side] ? c.side : pids[i % pids.length];
    const ref = db.collection(`battles/${date}/comments`).doc();
    batch.set(ref, {
      userId: 'npc', isCitizen: true, authorName: names[i % names.length],
      text: clean(c.text, 200), partyId: pid, power: 30 + Math.floor(Math.random() * 500),
      reactions: { like: Math.floor(Math.random() * 8), fire: Math.floor(Math.random() * 4), funny: Math.floor(Math.random() * 3) },
      createdAt: Timestamp.fromMillis(now - (comments.length - i) * 65000),
      createdAtMs: now - (comments.length - i) * 65000,
    });
  });
  await batch.commit();
}

async function createBattleForDate(date, options = {}) {
  const battleRef = db.doc(`battles/${date}`);
  const existing = await battleRef.get();
  if (existing.exists && !options.force) return { skipped: true, date, topic: existing.data().topic || '', postId: battleRef.id };

  const historyEvent = options.day ? eventByDay(options.day) : eventForDate(date);
  const context = await getRulingContext(date);
  let parsed = null;
  try {
    const raw = await callAI(buildBattlePrompt(historyEvent, context, date), 3600);
    parsed = safeParseJson(raw);
  } catch (err) {
    console.warn('[battle] AI generation fallback:', err.message);
  }
  const battle = normalizeBattle(parsed, historyEvent);

  await battleRef.set({
    ...battle,
    historyLinked: true,
    historySource: 'republic-history-events',
    votes: { national: 0, youth: 0, center: 0 },
    totalVotes: 0,
    winningParty: null,
    status: 'live',
    date,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: false });

  await seedCitizenActivity(date, battle, context);
  return { skipped: false, date, topic: battle.topic, eventDay: battle.historyDay };
}

async function requireAdmin(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', '로그인이 필요해요');
  const adminSnap = await db.doc(`admins/${request.auth.uid}`).get();
  if (!adminSnap.exists) throw new HttpsError('permission-denied', '관리자 전용');
}

exports.generateDailyBattle = onSchedule({
  schedule: '1 0 * * *', timeZone: 'Asia/Seoul', region: 'asia-northeast3', timeoutSeconds: 180, memory: '512MiB',
}, async () => {
  await createBattleForDate(kstToday());
});

exports.adminGenerateBattle = onCall({ region: 'asia-northeast3', timeoutSeconds: 180, memory: '512MiB' }, async request => {
  await requireAdmin(request);
  const date = request.data?.date || kstToday();
  const result = await createBattleForDate(date, { force: !!request.data?.force, day: request.data?.day });
  return { ok: true, ...result };
});

exports.voteForParty = onCall({ region: 'asia-northeast3', timeoutSeconds: 30 }, async request => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인이 필요해요');
  const { partyId } = request.data || {};
  if (!PARTY_INFO[partyId]) throw new HttpsError('invalid-argument', '유효하지 않은 정당이에요');
  const today = kstToday();
  const voteRef = db.doc(`battleVotes/${userId}_${today}`);
  const battleRef = db.doc(`battles/${today}`);
  let outcome = null;

  await db.runTransaction(async tx => {
    const [voteSnap, battleSnap] = await Promise.all([tx.get(voteRef), tx.get(battleRef)]);
    if (voteSnap.exists) throw new HttpsError('already-exists', '오늘은 이미 투표했어요');
    if (!battleSnap.exists) throw new HttpsError('not-found', '오늘의 논쟁을 불러올 수 없어요');
    if (battleSnap.data().status === 'ended') throw new HttpsError('failed-precondition', '이미 끝난 논쟁이에요');
    const before = battleSnap.data().votes || { national: 0, youth: 0, center: 0 };
    const beforeVotes = { national: Number(before.national || 0), youth: Number(before.youth || 0), center: Number(before.center || 0) };
    const afterVotes = { ...beforeVotes, [partyId]: beforeVotes[partyId] + 1 };
    const leaderOf = v => Object.keys(v).reduce((a, b) => (v[b] > v[a] ? b : a), 'national');
    const prevLeader = (beforeVotes.national + beforeVotes.youth + beforeVotes.center) > 0 ? leaderOf(beforeVotes) : null;
    const newLeader = leaderOf(afterVotes);
    const sorted = Object.entries(afterVotes).sort((a, b) => b[1] - a[1]);
    const gapToLead = afterVotes[newLeader] - afterVotes[partyId];
    let kind = 'joined';
    if (newLeader === partyId && prevLeader && prevLeader !== partyId) kind = 'takeLead';
    else if (newLeader === partyId) kind = 'lead';
    else if (gapToLead <= 2) kind = 'closing';
    outcome = { votes: afterVotes, totalVotes: afterVotes.national + afterVotes.youth + afterVotes.center, myRank: sorted.findIndex(([p]) => p === partyId) + 1, leader: newLeader, gapToLead, kind };
    tx.set(voteRef, { userId, partyId, date: today, createdAt: FieldValue.serverTimestamp() });
    tx.update(battleRef, { [`votes.${partyId}`]: FieldValue.increment(1), totalVotes: FieldValue.increment(1) });
    const awardRef = db.doc(`point_awards/${userId}_battle_vote_${today}`);
    tx.set(awardRef, { uid: userId, action: 'battle_vote', points: 5, date: today, createdAt: FieldValue.serverTimestamp() }, { merge: false });
    tx.set(db.doc(`users/${userId}`), { totalPoints: FieldValue.increment(5), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });

  return { ok: true, partyId, ...(outcome || {}) };
});

exports.addBattleComment = onCall({ region: 'asia-northeast3', timeoutSeconds: 15 }, async request => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인이 필요해요');
  const trimmed = clean(request.data?.text, 300);
  if (trimmed.length < 2) throw new HttpsError('invalid-argument', '댓글이 너무 짧아요');
  const today = kstToday();
  const battleSnap = await db.doc(`battles/${today}`).get();
  if (!battleSnap.exists) throw new HttpsError('not-found', '오늘의 배틀을 찾을 수 없어요');
  const userSnap = await db.doc(`users/${userId}`).get();
  const userData = userSnap.data() || {};
  const ref = await db.collection(`battles/${today}/comments`).add({
    userId, authorName: userData.nickname || userData.displayName || '익명', text: trimmed,
    ...(userData.partyId ? { partyId: userData.partyId } : {}),
    power: Math.max(0, Number(userData.totalPoints || userData.points || 0)),
    createdAt: FieldValue.serverTimestamp(),
  });
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

async function buildYesterdayResult(request, yesterday, yestSnap) {
  if (!request.auth?.uid || !yestSnap?.exists || !yestSnap.data().winningParty) return null;
  const yestVoteSnap = await db.doc(`battleVotes/${request.auth.uid}_${yesterday}`).get();
  if (!yestVoteSnap.exists) return null;
  const myPartyId = yestVoteSnap.data().partyId;
  const winnerPartyId = yestSnap.data().winningParty;
  if (!PARTY_INFO[myPartyId] || !PARTY_INFO[winnerPartyId]) return null;
  return { date: yesterday, topic: yestSnap.data().topic || '', won: myPartyId === winnerPartyId, myParty: { partyId: myPartyId, ...PARTY_INFO[myPartyId] }, winner: { partyId: winnerPartyId, ...PARTY_INFO[winnerPartyId] } };
}

async function recentBattleComments(today, uid) {
  try {
    const commSnap = await db.collection(`battles/${today}/comments`).orderBy('createdAt', 'desc').limit(20).get();
    return commSnap.docs.map(d => {
      const data = d.data();
      const reactions = data.reactions || {};
      const reactedWith = data.reactedWith || {};
      return {
        id: d.id, authorName: data.authorName || '익명', text: data.text || '', partyId: data.partyId || null,
        power: Number(data.power || 0), createdAt: data.createdAt?.toMillis?.() || data.createdAtMs || null,
        reactions: { like: Number(reactions.like || 0), fire: Number(reactions.fire || 0), funny: Number(reactions.funny || 0) },
        myReaction: uid ? (reactedWith[uid] || null) : null,
      };
    }).reverse();
  } catch { return []; }
}

exports.getBattleStatus = onCall({ region: 'asia-northeast3', timeoutSeconds: 30 }, async request => {
  const today = kstToday();
  const yesterday = kstDateOffset(-1);
  const [todaySnap, yestSnap, voteSnap] = await Promise.all([
    db.doc(`battles/${today}`).get(),
    db.doc(`battles/${yesterday}`).get(),
    request.auth?.uid ? db.doc(`battleVotes/${request.auth.uid}_${today}`).get() : Promise.resolve(null),
  ]);
  const currentKing = yestSnap.exists && PARTY_INFO[yestSnap.data().winningParty]
    ? { partyId: yestSnap.data().winningParty, name: PARTY_INFO[yestSnap.data().winningParty].name, emoji: PARTY_INFO[yestSnap.data().winningParty].emoji, color: PARTY_INFO[yestSnap.data().winningParty].color, streak: 1 }
    : null;
  const yesterdayResult = await buildYesterdayResult(request, yesterday, yestSnap);
  if (!todaySnap.exists) {
    return { exists: false, today, currentKing, yesterdayResult, partyInfo: PARTY_INFO, chars: BATTLE_CHARS.map(({ id, name, emoji, title, color, party, partyKey }) => ({ id, name, emoji, title, color, party, partyKey })) };
  }
  const battle = todaySnap.data();
  return {
    exists: true, today, topic: battle.topic, topicDesc: battle.topicDesc, historyQuestion: battle.historyQuestion || '',
    historyDay: battle.historyDay || null, historyEra: battle.historyEra || '', motifYear: battle.motifYear || null, motif: battle.motif || '',
    partyDebates: battle.partyDebates || {}, votes: battle.votes || { national: 0, youth: 0, center: 0 }, totalVotes: battle.totalVotes || 0,
    status: battle.status, winningParty: battle.winningParty || null, aftermath: battle.aftermath || null,
    userVote: voteSnap?.exists ? voteSnap.data().partyId : null, currentKing, yesterdayResult,
    recentComments: await recentBattleComments(today, request.auth?.uid || null), partyInfo: PARTY_INFO,
    chars: BATTLE_CHARS.map(({ id, name, emoji, title, color, party, partyKey }) => ({ id, name, emoji, title, color, party, partyKey })),
  };
});

function buildAftermath(winnerPartyId, battle) {
  const w = PARTY_INFO[winnerPartyId];
  if (!w) return null;
  const losers = Object.entries(PARTY_INFO).filter(([pid]) => pid !== winnerPartyId);
  return {
    decree: `${w.emoji} ${w.name}이(가) 오늘의 역사 쟁점 "${clean(battle.topic, 30)}"에서 가장 설득력 있는 해석을 얻었습니다. 새공화국의 다음 논쟁도 시민의 표로 결정됩니다.`,
    reactions: losers.map(([pid, info]) => ({ partyId: pid, partyName: info.name, emoji: info.emoji, text: `${info.name}은 결과를 존중하지만, 다음 쟁점에서 다시 시민의 판단을 받겠습니다.` })),
  };
}

exports.closeDailyBattle = onSchedule({ schedule: '59 23 * * *', timeZone: 'Asia/Seoul', region: 'asia-northeast3', timeoutSeconds: 180, memory: '512MiB' }, async () => {
  const today = kstToday();
  const battleRef = db.doc(`battles/${today}`);
  const battleSnap = await battleRef.get();
  if (!battleSnap.exists || battleSnap.data().status === 'ended') return;
  const battle = battleSnap.data();
  const votes = battle.votes || { national: 0, youth: 0, center: 0 };
  let maxVotes = 0;
  let winnerPartyId = null;
  for (const [pid, count] of Object.entries(votes)) {
    if (Number(count) > maxVotes) { maxVotes = Number(count); winnerPartyId = pid; }
  }
  await battleRef.update({ winningParty: winnerPartyId, status: 'ended', aftermath: buildAftermath(winnerPartyId, battle), updatedAt: FieldValue.serverTimestamp() });
  if (winnerPartyId && PARTY_INFO[winnerPartyId]) {
    await db.collection('kingHistory').add({ date: today, partyId: winnerPartyId, partyName: PARTY_INFO[winnerPartyId].name, emoji: PARTY_INFO[winnerPartyId].emoji, topic: battle.topic || '', totalVotes: Number(battle.totalVotes || 0), createdAt: FieldValue.serverTimestamp() });
  }
});

exports.getKingHistory = onCall({ region: 'asia-northeast3', timeoutSeconds: 30 }, async () => {
  const snap = await db.collection('kingHistory').orderBy('date', 'desc').limit(30).get();
  return { history: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
});

exports.reactToBattleComment = onCall({ region: 'asia-northeast3', timeoutSeconds: 15 }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요해요');
  const { commentId, reaction } = request.data || {};
  if (!['like', 'fire', 'funny'].includes(reaction)) throw new HttpsError('invalid-argument', '유효하지 않은 반응');
  const today = kstToday();
  const ref = db.doc(`battles/${today}/comments/${commentId}`);
  let active = false;
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', '댓글을 찾을 수 없어요');
    const prev = snap.data().reactedWith?.[uid] || null;
    const updates = {};
    if (prev === reaction) {
      updates[`reactions.${reaction}`] = FieldValue.increment(-1);
      updates[`reactedWith.${uid}`] = FieldValue.delete();
      active = false;
    } else {
      if (prev) updates[`reactions.${prev}`] = FieldValue.increment(-1);
      updates[`reactions.${reaction}`] = FieldValue.increment(1);
      updates[`reactedWith.${uid}`] = reaction;
      active = true;
    }
    tx.update(ref, updates);
  });
  return { ok: true, active, reaction };
});

exports.adminResetBattleData = onCall({ region: 'asia-northeast3', timeoutSeconds: 120 }, async request => {
  await requireAdmin(request);
  const date = request.data?.date || kstToday();
  const battleRef = db.doc(`battles/${date}`);
  const commSnap = await db.collection(`battles/${date}/comments`).limit(300).get();
  const batch = db.batch();
  commSnap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(battleRef);
  await batch.commit();
  return { ok: true, date, deletedComments: commSnap.size };
});

exports.adminResetAllPoints = onCall({ region: 'asia-northeast3', timeoutSeconds: 300 }, async request => {
  await requireAdmin(request);
  const usersSnap = await db.collection('users').limit(500).get();
  const batch = db.batch();
  usersSnap.docs.forEach(d => batch.set(d.ref, { totalPoints: 0, points: 0, updatedAt: FieldValue.serverTimestamp() }, { merge: true }));
  await batch.commit();
  return { ok: true, count: usersSnap.size };
});
