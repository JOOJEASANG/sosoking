'use strict';

// admin-seed-functions.js
// 소소공화국 세계관 역사 데이터 시드
// 관리자가 한 번 실행하면 과거 4주치 선거·배틀·국회·신문·위기 이력이 채워진다

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

const PARTIES = [
  { id: 'national', name: '국민안정당', emoji: '🎙️', color: '#8B7355', leaderName: '김중진' },
  { id: 'youth',    name: '청년혁명당', emoji: '📱', color: '#E84393', leaderName: '갈아엎자' },
  { id: 'center',   name: '중도민주당', emoji: '📊', color: '#00CEC9', leaderName: '김퍼센트' },
];
const PARTY_BY_ID = Object.fromEntries(PARTIES.map(p => [p.id, p]));

// ── 날짜 헬퍼 ──
function iso(ms) { return new Date(ms).toISOString().slice(0, 10); }
function msOf(key) { return Date.parse(key + 'T00:00:00+09:00'); }
function tsOf(key, hour = 20) {
  return Timestamp.fromMillis(Date.parse(key + `T${String(hour).padStart(2,'0')}:00:00+09:00`));
}

function kstMondayKey(offsetWeeks = 0) {
  const kst = new Date(Date.now() + 9 * 3600000);
  const day = kst.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const base = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
  return iso(base + diff * 86400000 + offsetWeeks * 7 * 86400000);
}

// ── 선거 역사 템플릿 ──
const ELECTION_TEMPLATES = [
  {
    winnerPartyId: 'youth',
    decree: '청년들이여, 기득권의 사슬을 끊어라! 이 주부터 소소공화국 모든 청년에게 정치력 +10P 보너스를 선포한다. 기성 질서 타도!',
    votes: { national: 18, youth: 27, center: 14 },
    decreeApprove: 12, decreeDisapprove: 6,
  },
  {
    winnerPartyId: 'national',
    decree: '안정과 경험이 최고다. 검증되지 않은 정치 실험은 끝났다. 소소공화국은 이제 신중한 정치력으로 나아간다.',
    votes: { national: 31, youth: 16, center: 20 },
    decreeApprove: 9, decreeDisapprove: 4,
  },
  {
    winnerPartyId: 'center',
    decree: '데이터는 거짓말을 하지 않는다. 민심 68%가 원하는 실용 정책을 즉각 시행한다. 감성보다 숫자!',
    votes: { national: 22, youth: 19, center: 26 },
    decreeApprove: 14, decreeDisapprove: 5,
  },
  {
    winnerPartyId: 'youth',
    decree: '2연패! 청년혁명당의 기세를 막을 수 없다. 소소공화국 전 국민에게 선언한다 — 우리가 바꾼다!',
    votes: { national: 14, youth: 33, center: 17 },
    decreeApprove: 18, decreeDisapprove: 3,
  },
];

// ── 배틀 역사 템플릿 ──
const BATTLE_TEMPLATES = [
  {
    topic: 'Z세대 경제 박탈감, 진짜인가 핑계인가?',
    winner: 'youth',
    votes: { national: 11, youth: 24, center: 14 },
    stances: {
      national: '기성세대도 힘들었다. 노력이 먼저다.',
      youth: '구조적 불평등을 직시하라! 우리는 태어날 때부터 불리했다.',
      center: '데이터를 보면 소득 격차는 실재한다. 정책으로 해결해야 한다.',
    },
  },
  {
    topic: '소소공화국 포고령, 위헌 논란 어떻게 볼 것인가?',
    winner: 'national',
    votes: { national: 28, youth: 16, center: 19 },
    stances: {
      national: '대통령의 결단이 필요할 때가 있다. 합법적 절차를 따른 것이다.',
      youth: '포고령은 독재의 시작이다! 즉각 철회하라!',
      center: '헌법 전문가 의견을 구해야 한다. 감정보다 법리.',
    },
  },
  {
    topic: '탈세 의혹 의원, 즉각 사퇴해야 하나?',
    winner: 'center',
    votes: { national: 15, youth: 20, center: 23 },
    stances: {
      national: '수사 결과가 나오기 전까지는 무죄 추정 원칙이다.',
      youth: '의혹만으로도 공직 자격 없다! 당장 물러나라!',
      center: '국민의 신뢰가 먼저다. 자진 사퇴 후 소명해야 옳다.',
    },
  },
  {
    topic: 'AI 정치인 도입, 인간보다 나은가?',
    winner: 'youth',
    votes: { national: 10, youth: 29, center: 18 },
    stances: {
      national: '정치는 경험과 인간적 판단이다. AI에게 맡길 수 없다.',
      youth: '기성 정치인들이 엉망이었다. AI가 더 낫다. 데이터로 검증하자!',
      center: '보조 도구로는 훌륭하다. 단 최종 결정은 인간이 해야 한다.',
    },
  },
  {
    topic: '부동산 규제 강화, 내 집 마련 꿈을 짓밟나?',
    winner: 'national',
    votes: { national: 26, youth: 18, center: 20 },
    stances: {
      national: '시장의 자율성이 먼저다. 과도한 규제는 부작용을 낳는다.',
      youth: '투기 세력부터 잡아야 한다! 무주택 청년이 피해자다.',
      center: '공급과 수요 데이터를 분석해야 한다. 맹목적 규제는 위험.',
    },
  },
  {
    topic: '소소공화국 무상 급식 확대, 찬반 논쟁',
    winner: 'center',
    votes: { national: 14, youth: 21, center: 27 },
    stances: {
      national: '선별 복지가 맞다. 세금은 꼭 필요한 곳에만.',
      youth: '모든 시민이 밥 한 끼는 걱정 없어야 한다. 전면 확대!',
      center: '소득 구간별 단계적 확대가 현실적이다.',
    },
  },
  {
    topic: '정치인 SNS 막말, 처벌해야 하나?',
    winner: 'youth',
    votes: { national: 17, youth: 25, center: 15 },
    stances: {
      national: '표현의 자유는 민주주의의 근간. 처벌 기준이 모호하다.',
      youth: '막말 정치인이 판치는 게 문제다. 강력 제재로 막아야 한다.',
      center: '자율 규제 먼저, 법적 제재는 최후 수단.',
    },
  },
  {
    topic: '소소공화국 병역 의무, 여성도 포함해야 하나?',
    winner: 'national',
    votes: { national: 24, youth: 20, center: 16 },
    stances: {
      national: '국방은 전통적 가치를 존중해야 한다. 현행 유지.',
      youth: '진정한 평등이라면 의무도 평등해야 한다.',
      center: '사회적 합의가 선행되어야 한다. 서두르면 갈등만 커진다.',
    },
  },
  {
    topic: '소소공화국 최저임금 30% 인상, 경제 살리나 죽이나?',
    winner: 'center',
    votes: { national: 12, youth: 22, center: 26 },
    stances: {
      national: '소상공인이 무너진다. 급격한 인상은 반대한다.',
      youth: '노동자의 삶부터 챙겨라! 30%도 부족하다!',
      center: '업종별 차등 적용이 답이다. 숫자로 접근해야 한다.',
    },
  },
  {
    topic: '전국민 기본소득 도입, 소소공화국에서 가능한가?',
    winner: 'youth',
    votes: { national: 13, youth: 31, center: 19 },
    stances: {
      national: '재정 파탄을 부른다. 포퓰리즘에 불과하다.',
      youth: '미래는 기본소득으로! AI 시대에 필수 정책이다!',
      center: '조건부·소규모 파일럿 먼저 해보고 데이터로 판단해야 한다.',
    },
  },
  {
    topic: '유명 유튜버 탈세 의혹, 연예인도 같은 기준으로?',
    winner: 'center',
    votes: { national: 18, youth: 17, center: 24 },
    stances: {
      national: '법 앞에 만인은 평등. 엄정 수사가 당연하다.',
      youth: '인플루언서도 시민이다. 마녀사냥은 위험해!',
      center: '세무 시스템 자체가 문제다. 구조 개혁이 먼저.',
    },
  },
  {
    topic: '소소공화국 대통령 연임 허용, 찬반은?',
    winner: 'national',
    votes: { national: 27, youth: 14, center: 18 },
    stances: {
      national: '검증된 리더가 연속성을 가져야 한다. 연임 허용 찬성.',
      youth: '권력 집중 절대 반대! 순환이 민주주의다.',
      center: '4년 단임 유지가 국제 표준이다. 데이터가 말한다.',
    },
  },
  {
    topic: '국회의원 세비 삭감, 국민 여론은?',
    winner: 'youth',
    votes: { national: 16, youth: 26, center: 21 },
    stances: {
      national: '우수 인재 확보를 위해 합리적 보수는 필요하다.',
      youth: '국민이 힘들 때 의원 급여부터 깎아야 한다!',
      center: '성과 연동 방식으로 구조를 바꾸는 게 현실적이다.',
    },
  },
  {
    topic: '소소공화국 언론 통제 논란, 자유냐 책임이냐?',
    winner: 'center',
    votes: { national: 19, youth: 18, center: 23 },
    stances: {
      national: '가짜뉴스는 국가 안보 위협이다. 일정한 규제 필요.',
      youth: '언론 통제는 독재의 전주곡. 절대 반대!',
      center: '자율규제 강화와 미디어 리터러시 교육이 해답이다.',
    },
  },
];

// ── 국회 법안 템플릿 ──
const BILL_TEMPLATES = [
  { type: 'welfare', title: '긴급 민생지원 특별법', desc: '소득 하위 30% 가정에 생활 안정 지원금을 지급합니다.', optionFor: '지원 찬성', optionAgainst: '재정 우려', votesFor: 28, votesAgainst: 12, result: 'passed', consequence: '소소공화국 저소득층 34만 가구에 1인당 20P 상당의 지원이 지급됐다. 여야 모두 민생 챙기기 경쟁에 나섰다.' },
  { type: 'economy', title: '청년 창업 지원 촉진법', desc: '35세 미만 청년 창업자에게 저금리 대출과 세제 혜택을 제공합니다.', optionFor: '적극 지원', optionAgainst: '시장 왜곡 우려', votesFor: 31, votesAgainst: 9, result: 'passed', consequence: '청년 창업 신청이 전월 대비 47% 증가했다. 실리콘밸리를 꿈꾸는 소소공화국 청년들의 도전이 시작됐다.' },
  { type: 'media', title: '가짜뉴스 방지법', desc: '허위 정보 유포에 대한 처벌 기준을 강화합니다.', optionFor: '책임 강화', optionAgainst: '표현의 자유 침해', votesFor: 19, votesAgainst: 21, result: 'rejected', consequence: '근소한 차로 부결됐다. 표현의 자유와 책임 사이의 논쟁은 계속된다. 언론계는 안도했다.' },
  { type: 'education', title: '공교육 강화 및 사교육 규제법', desc: '사교육 시간 제한과 공교육 예산 30% 확충을 담은 법안입니다.', optionFor: '공교육 강화', optionAgainst: '사교육 규제 반대', votesFor: 25, votesAgainst: 17, result: 'passed', consequence: '학원가의 반발이 거셌지만 국회는 법안을 통과시켰다. 소소공화국 학부모들의 반응은 엇갈렸다.' },
  { type: 'security', title: '디지털 치안 강화법', desc: '사이버 범죄와 개인정보 침해에 대한 처벌 기준을 대폭 상향합니다.', optionFor: '치안 강화', optionAgainst: '감시사회 우려', votesFor: 33, votesAgainst: 8, result: 'passed', consequence: '압도적 찬성으로 통과됐다. 소소공화국 사이버 수사대가 대폭 확충되고 처벌이 강화됐다.' },
];

// ── 정치 위기 템플릿 ──
const CRISIS_TEMPLATES = [
  {
    title: '소소공화국 전력 대란, 어떻게 대처할 것인가?',
    optionA: '원전 긴급 재가동',
    optionB: '재생에너지 속도전',
    votesA: 23, votesB: 18,
    consequence: '원전 재가동을 선택했다. 단기 전력난은 해소됐지만 환경 단체의 시위가 이어졌다.',
  },
  {
    title: '외교 갈등! 인접국 소소왕국과 관계를 어떻게 할 것인가?',
    optionA: '강경 외교로 맞대응',
    optionB: '대화와 협상 우선',
    votesA: 15, votesB: 29,
    consequence: '대화 노선을 택했다. 수개월 협상 끝에 양국이 경제 협력 협정을 체결했다.',
  },
  {
    title: '소소공화국 대통령 측근 비리 의혹, 대응은?',
    optionA: '특검 수사 즉각 요구',
    optionB: '당 자체 조사 기다리기',
    votesA: 31, votesB: 12,
    consequence: '특검 압박에 결국 수사가 시작됐다. 2명이 기소되고 정국이 흔들렸다.',
  },
  {
    title: '소소공화국 초고물가, 비상경제 대책은?',
    optionA: '물가상한제 즉시 도입',
    optionB: '금리 인상으로 잡기',
    votesA: 27, votesB: 19,
    consequence: '물가상한제를 선택했다. 단기적 안정은 됐지만 유통업계가 품귀 현상을 보였다.',
  },
];

// ── 과거 뉴스 템플릿 ──
const NEWS_TEMPLATES = [
  { headline: '청년혁명당, 3주 연속 배틀 제패 — 기성 정치권 "위협적"', body: '소소공화국 정치배틀에서 청년혁명당이 3주 연속 압도적 승리를 거뒀다. 국민안정당과 중도민주당은 비상 대책 회의를 소집했지만 뾰족한 수가 없어 보인다.' },
  { headline: '대통령 포고령 지지율 75% — 역대 최고 기록', body: '현 대통령의 경제 안정 포고령이 시민 4명 중 3명의 지지를 받았다. 야당은 "포퓰리즘"이라고 비판했지만 여론은 싸늘했다.' },
  { headline: '국회 법안 10호 부결 — 또 다시 여야 충돌', body: '이번 주 올라온 법안이 단 9표 차이로 부결됐다. 의원들의 당론 이탈 투표가 결정적이었다는 분석이다. 정치권 내부 갈등이 수면 위로 떠올랐다.' },
  { headline: '소소공화국 정치력 1위 등극 — 무명 시민에서 거물 정치인으로', body: '한 달 만에 정치력 1만 포인트를 돌파한 익명의 시민이 소소공화국 역사상 최단 기간 기록을 세웠다. 정치권 기득권층은 긴장하고 있다.' },
  { headline: '중도민주당 당대표 "데이터 없는 정치는 사기다" 발언 파문', body: '중도민주당 대표의 강경 발언이 정치권에 파문을 일으켰다. 일부에서는 "사이다 발언"이라며 환호했고, 상대 정당들은 "오만하다"고 반발했다.' },
  { headline: '탄핵 청원 발동 — 소소공화국 헌정 사상 초유의 사태', body: '청원이 기준 서명을 돌파하면서 헌법재판소가 탄핵 심판을 개시했다. 재판관 6명의 독특한 성격만큼이나 판결 결과를 예측하기 어렵다는 분석이다.' },
  { headline: '주간 정치력 상승 1위 — 신인 시민의 놀라운 질주', body: '이번 주 가장 많은 정치력을 획득한 시민은 가입 3일 만에 1,200P를 쌓았다. 비결은 배틀·투표·유세 삼박자를 하루도 빠지지 않은 것이었다.' },
];

function requireAdmin(request) {
  if (!request.auth || !request.auth.uid) throw new HttpsError('unauthenticated', '로그인 필요');
}

async function checkIsAdmin(uid) {
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자 권한 필요');
}

// 배치 500건 제한 안전 분할
function chunks(arr, size = 400) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

exports.adminSeedWorldHistory = onCall({ region: REGION, timeoutSeconds: 120 }, async request => {
  requireAdmin(request);
  await checkIsAdmin(request.auth.uid);

  const ops = []; // { ref, data, merge }

  const thisWeek = kstMondayKey(0);
  const prevWeeks = [-1, -2, -3, -4].map(i => kstMondayKey(i));

  // ── 1. 과거 선거 이력 ──
  for (let i = 0; i < prevWeeks.length; i++) {
    const wk = prevWeeks[i];
    const nextWk = i === 0 ? thisWeek : prevWeeks[i - 1];
    const tpl = ELECTION_TEMPLATES[i % ELECTION_TEMPLATES.length];
    const winner = PARTY_BY_ID[tpl.winnerPartyId];
    const totalVotes = Object.values(tpl.votes).reduce((s, v) => s + v, 0);
    const candidates = PARTIES.map(p => ({
      partyId: p.id, partyName: p.name, emoji: p.emoji, color: p.color,
      candidateName: p.leaderName, candidateUid: null, isAI: true,
      power: tpl.votes[p.id] * 80,
    }));
    const snap = await db.doc(`elections/${wk}`).get();
    if (!snap.exists) {
      ops.push({
        ref: db.doc(`elections/${wk}`),
        data: {
          periodId: wk, status: 'closed', startKey: wk, endKey: nextWk,
          candidates, votes: tpl.votes, totalVotes,
          winnerPartyId: tpl.winnerPartyId,
          winner: { partyId: winner.id, partyName: winner.name, emoji: winner.emoji, color: winner.color, candidateName: winner.leaderName, isAI: true },
          decree: tpl.decree,
          decreeApprove: tpl.decreeApprove, decreeDisapprove: tpl.decreeDisapprove,
          seeded: true,
          closedAt: tsOf(nextWk, 0),
          createdAt: tsOf(wk, 9),
          updatedAt: tsOf(nextWk, 1),
        },
        merge: false,
      });
    }
  }

  // ── 2. 과거 배틀 이력 (최근 14일) ──
  const today = new Date(Date.now() + 9 * 3600000);
  for (let d = 1; d <= 14; d++) {
    const dateMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - d * 86400000;
    const dateKey = iso(dateMs);
    const tpl = BATTLE_TEMPLATES[(d - 1) % BATTLE_TEMPLATES.length];
    const winner = PARTY_BY_ID[tpl.winner];
    const totalVotes = Object.values(tpl.votes).reduce((s, v) => s + v, 0);

    const partyDebates = {};
    PARTIES.forEach(p => {
      partyDebates[p.id] = {
        stance: tpl.stances[p.id],
        statements: [
          { charId: `npc_${p.id}_1`, text: tpl.stances[p.id] },
          { charId: `npc_${p.id}_2`, text: `${p.name}의 입장은 분명합니다. ${tpl.stances[p.id].split('!')[0]}!` },
        ],
      };
    });

    const snap = await db.doc(`battles/${dateKey}`).get();
    if (!snap.exists) {
      ops.push({
        ref: db.doc(`battles/${dateKey}`),
        data: {
          date: dateKey, status: 'closed', seeded: true,
          topic: tpl.topic, topicDesc: `소소공화국의 오늘 논쟁: ${tpl.topic}`,
          partyDebates, votes: tpl.votes, totalVotes,
          winningPartyId: tpl.winner,
          winningParty: { id: winner.id, name: winner.name, emoji: winner.emoji, color: winner.color },
          createdAt: tsOf(dateKey, 9), closedAt: tsOf(dateKey, 23),
          updatedAt: tsOf(dateKey, 23),
        },
        merge: false,
      });
    }
  }

  // ── 3. 과거 국회 법안 ──
  for (let i = 0; i < prevWeeks.length; i++) {
    const wk = prevWeeks[i];
    const id = `weekly_${wk}`;
    const tpl = BILL_TEMPLATES[i % BILL_TEMPLATES.length];
    const snap = await db.doc(`congress_bills/${id}`).get();
    if (!snap.exists) {
      const partyVotes = {};
      PARTIES.forEach((p, pi) => {
        const base = Math.floor(tpl.votesFor / 3);
        partyVotes[p.id] = {
          for: base + (pi === 0 ? tpl.votesFor % 3 : 0),
          against: Math.floor(tpl.votesAgainst / 3),
        };
      });
      ops.push({
        ref: db.doc(`congress_bills/${id}`),
        data: {
          id, weekKey: wk, status: 'closed', source: 'weekly', seeded: true,
          type: tpl.type, title: tpl.title, desc: tpl.desc,
          optionFor: tpl.optionFor, optionAgainst: tpl.optionAgainst,
          votesFor: tpl.votesFor, votesAgainst: tpl.votesAgainst,
          result: tpl.result, consequence: tpl.consequence,
          partyVotes,
          createdAt: tsOf(wk, 9), closedAt: tsOf(wk, 20),
          createdAtMs: msOf(wk) + 9 * 3600000,
          updatedAt: tsOf(wk, 20),
        },
        merge: false,
      });
    }
  }

  // ── 4. 이번 주 현재 국회 법안 보조 투표 시드 (없을 경우) ──
  const thisWeekBillId = `weekly_${thisWeek}`;
  const thisWeekBillSnap = await db.doc(`congress_bills/${thisWeekBillId}`).get();
  if (thisWeekBillSnap.exists) {
    const bd = thisWeekBillSnap.data() || {};
    if ((bd.votesFor || 0) + (bd.votesAgainst || 0) === 0) {
      const seed = { national: { for: 4, against: 2 }, youth: { for: 2, against: 3 }, center: { for: 3, against: 2 } };
      const totalFor = Object.values(seed).reduce((s, v) => s + v.for, 0);
      const totalAgainst = Object.values(seed).reduce((s, v) => s + v.against, 0);
      ops.push({
        ref: db.doc(`congress_bills/${thisWeekBillId}`),
        data: { votesFor: totalFor, votesAgainst: totalAgainst, partyVotes: seed, aiSeeded: true, updatedAt: FieldValue.serverTimestamp() },
        merge: true,
      });
    }
  }

  // ── 5. 과거 정치 위기 이력 ──
  for (let i = 0; i < 2 && i < prevWeeks.length; i++) {
    const wk = prevWeeks[i];
    const tpl = CRISIS_TEMPLATES[i % CRISIS_TEMPLATES.length];
    const snap = await db.doc(`political_crises/${wk}`).get();
    if (!snap.exists) {
      ops.push({
        ref: db.doc(`political_crises/${wk}`),
        data: {
          weekKey: wk, seeded: true,
          title: tpl.title, optionA: tpl.optionA, optionB: tpl.optionB,
          votesA: tpl.votesA, votesB: tpl.votesB,
          consequence: tpl.consequence,
          createdAt: tsOf(wk, 10), updatedAt: tsOf(wk, 20),
        },
        merge: false,
      });
    }
  }

  // ── 6. 과거 소소신문 ──
  for (let d = 1; d <= NEWS_TEMPLATES.length; d++) {
    const dateMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - d * 86400000;
    const dateKey = iso(dateMs);
    const tpl = NEWS_TEMPLATES[(d - 1) % NEWS_TEMPLATES.length];
    const snap = await db.doc(`daily_news/${dateKey}`).get();
    if (!snap.exists) {
      ops.push({
        ref: db.doc(`daily_news/${dateKey}`),
        data: {
          headline: tpl.headline, body: tpl.body, date: dateKey,
          generating: false, seeded: true,
          generatedAt: tsOf(dateKey, 8), updatedAt: tsOf(dateKey, 8),
        },
        merge: false,
      });
    }
  }

  // ── 배치 커밋 ──
  let written = 0;
  const allChunks = chunks(ops, 400);
  for (const chunk of allChunks) {
    const batch = db.batch();
    for (const op of chunk) {
      if (op.merge) batch.set(op.ref, op.data, { merge: true });
      else batch.set(op.ref, op.data);
    }
    await batch.commit();
    written += chunk.length;
  }

  return { ok: true, written, message: `소소공화국 세계관 역사 ${written}건 생성 완료` };
});
