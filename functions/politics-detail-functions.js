'use strict';

const { onCall } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = 'asia-northeast3';

const PARTIES = Object.freeze([
  { id: 'national', name: '국민질서당', emoji: '🛡️', color: '#263B66', ideology: '보수파', leaderName: '강도윤', slogan: '흔들림 없는 안보, 질서 있는 개혁' },
  { id: 'youth', name: '시민개혁당', emoji: '🕯️', color: '#B8323B', ideology: '진보파', leaderName: '한서윤', slogan: '시민이 만든 권력, 시민에게 돌아가는 개혁' },
  { id: 'center', name: '국민통합당', emoji: '⚖️', color: '#2F7D6E', ideology: '중도파', leaderName: '윤태건', slogan: '갈라진 광장을 하나로 묶는 실용 정치' },
]);

const PARTY_BY_ID = Object.freeze(Object.fromEntries(PARTIES.map(p => [p.id, p])));
const PARTY_IDS = PARTIES.map(p => p.id);
const CAMPAIGN_DAILY_LIMIT = 3;

const PARTY_STORIES = Object.freeze({
  national: {
    agenda: '안보·치안·시장 안정',
    promise: '위기 때 국가 운영을 흔들리지 않게 만들겠다고 호소합니다.',
    action: '질서 안정 유세',
    rivalFrame: '성급한 개혁은 혼란을 부른다',
  },
  youth: {
    agenda: '개혁·복지·시민권 확대',
    promise: '시민이 만든 권력을 시민에게 돌려주겠다고 호소합니다.',
    action: '개혁 촛불 유세',
    rivalFrame: '낡은 권력과 타협하면 개혁은 멈춘다',
  },
  center: {
    agenda: '협치·균형·실용 개혁',
    promise: '갈라진 광장을 합의 가능한 제도로 묶겠다고 호소합니다.',
    action: '통합 중재 유세',
    rivalFrame: '양극단 정치는 공화국을 지치게 한다',
  },
});

function partyRef(id) { return db.doc(`parties/${id}`); }

function kstToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function weekPeriod() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(new Date());
  const o = {};
  parts.forEach(p => { o[p.type] = p.value; });
  const wmap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const off = (wmap[o.weekday] + 6) % 7;
  const base = Date.UTC(Number(o.year), Number(o.month) - 1, Number(o.day));
  const monMs = base - off * 86400000;
  const iso = ms => new Date(ms).toISOString().slice(0, 10);
  return { key: iso(monMs), endKey: iso(monMs + 7 * 86400000), prevKey: iso(monMs - 7 * 86400000) };
}

async function ensureParties() {
  const snaps = await db.getAll(...PARTY_IDS.map(partyRef));
  const batch = db.batch();
  let dirty = false;

  PARTIES.forEach((p, i) => {
    const snap = snaps[i];
    const data = snap.exists ? snap.data() || {} : {};
    if (!snap.exists || data.name !== p.name || data.leaderName !== p.leaderName || data.slogan !== p.slogan) {
      batch.set(partyRef(p.id), {
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        color: p.color,
        ideology: p.ideology,
        leaderName: p.leaderName,
        slogan: p.slogan,
        updatedAt: FieldValue.serverTimestamp(),
        ...(snap.exists ? {} : { memberCount: 0, totalPower: 0, createdAt: FieldValue.serverTimestamp() }),
      }, { merge: true });
      dirty = true;
    }
  });

  if (dirty) await batch.commit();
}

function partyCountSkeleton() {
  return Object.fromEntries(PARTY_IDS.map(pid => [pid, 0]));
}

function numberMapValue(map, partyId) {
  if (!map || typeof map !== 'object') return 0;
  return Number(map[partyId] || 0);
}

function topScore(values) {
  return Math.max(0, ...values.map(v => Number(v || 0)));
}

async function buildMomentumSnapshot() {
  await ensureParties();
  const today = kstToday();
  const { key } = weekPeriod();

  const [partySnaps, campaignSnap, crisisSnap, electionSnap, billsSnap] = await Promise.all([
    db.getAll(...PARTY_IDS.map(partyRef)),
    db.collection('campaign_records').where('date', '==', today).limit(300).get().catch(() => ({ docs: [] })),
    db.doc(`political_crises/${key}`).get().catch(() => null),
    db.doc(`elections/${key}`).get().catch(() => null),
    db.collection('congress_bills').where('status', '==', 'open').limit(20).get().catch(() => ({ docs: [] })),
  ]);

  const campaignCounts = partyCountSkeleton();
  const crisisVotes = partyCountSkeleton();
  const electionVotes = partyCountSkeleton();
  const congressVotes = partyCountSkeleton();

  (campaignSnap.docs || []).forEach(docSnap => {
    const d = docSnap.data() || {};
    const pid = PARTY_BY_ID[d.partyId] ? d.partyId : null;
    if (pid) campaignCounts[pid] += Math.max(1, Number(d.count || 1));
  });

  const crisis = crisisSnap?.exists ? crisisSnap.data() || {} : null;
  PARTY_IDS.forEach(pid => { crisisVotes[pid] = numberMapValue(crisis?.votes, pid); });

  const election = electionSnap?.exists ? electionSnap.data() || {} : null;
  PARTY_IDS.forEach(pid => { electionVotes[pid] = numberMapValue(election?.votes, pid); });

  (billsSnap.docs || []).forEach(docSnap => {
    const d = docSnap.data() || {};
    const pv = d.partyVotes || {};
    PARTY_IDS.forEach(pid => {
      const pvote = pv[pid] || {};
      congressVotes[pid] += Number(pvote.for || 0) + Number(pvote.against || 0);
    });
  });

  const totalPower = partySnaps.reduce((sum, snap) => sum + Number(snap.exists ? (snap.data()?.totalPower || 0) : 0), 0);
  const totalCampaigns = Object.values(campaignCounts).reduce((s, n) => s + n, 0);
  const totalElectionVotes = Object.values(electionVotes).reduce((s, n) => s + n, 0);
  const totalCrisisVotes = Object.values(crisisVotes).reduce((s, n) => s + n, 0);
  const totalCongressVotes = Object.values(congressVotes).reduce((s, n) => s + n, 0);
  const maxElectionVotes = topScore(Object.values(electionVotes));

  const momentum = PARTIES.map((meta, i) => {
    const partyData = partySnaps[i].exists ? partySnaps[i].data() || {} : {};
    const power = Number(partyData.totalPower || 0);
    const powerShareRaw = totalPower > 0 ? power / totalPower : 0;
    const campaignCount = campaignCounts[meta.id] || 0;
    const electionCount = electionVotes[meta.id] || 0;
    const crisisCount = crisisVotes[meta.id] || 0;
    const congressCount = congressVotes[meta.id] || 0;
    const score = Math.round(powerShareRaw * 50 + campaignCount * 12 + electionCount * 3 + crisisCount * 5 + congressCount * 4);

    let trend = '관망';
    if (campaignCount >= 3) trend = '유세 열기';
    else if (electionCount > 0 && electionCount >= maxElectionVotes) trend = '대선 강세';
    else if (powerShareRaw >= 0.38) trend = '조직 우세';
    else if (crisisCount > 0) trend = '현안 부상';

    return {
      partyId: meta.id,
      partyName: meta.name,
      emoji: meta.emoji,
      color: meta.color,
      ideology: meta.ideology,
      slogan: meta.slogan,
      agenda: PARTY_STORIES[meta.id]?.agenda || meta.slogan,
      score,
      power,
      powerShare: Math.round(powerShareRaw * 100),
      campaignCount,
      electionVotes: electionCount,
      crisisVotes: crisisCount,
      congressVotes: congressCount,
      memberCount: Number(partyData.memberCount || 0),
      trend,
    };
  }).sort((a, b) => b.score - a.score || b.power - a.power);

  momentum.forEach((m, i) => { m.rank = i + 1; });
  const leader = momentum[0] || null;
  const runnerUp = momentum[1] || null;
  const gap = leader && runnerUp ? leader.score - runnerUp.score : 0;

  return {
    date: today,
    weekKey: key,
    crisis: crisis ? { title: crisis.title || '주간 정치 위기', desc: crisis.desc || '', totalVotes: Number(crisis.totalVotes || totalCrisisVotes), votes: crisis.votes || {} } : null,
    election: election ? { totalVotes: Number(election.totalVotes || totalElectionVotes), endKey: election.endKey || null, status: election.status || 'open' } : null,
    totals: { power: totalPower, campaigns: totalCampaigns, electionVotes: totalElectionVotes, crisisVotes: totalCrisisVotes, congressVotes: totalCongressVotes },
    leader,
    gap,
    momentum,
  };
}

function buildHeadlines(snapshot) {
  const leader = snapshot.leader;
  const runnerUp = snapshot.momentum[1] || null;
  const headlines = [];

  if (leader) {
    headlines.push({
      icon: leader.emoji,
      title: `${leader.partyName}, 오늘 판세 ${leader.rank}위`,
      body: `${leader.trend} 흐름으로 모멘텀 ${leader.score}점을 기록했습니다. ${PARTY_STORIES[leader.partyId]?.promise || leader.slogan}`,
    });
  }
  if (leader && runnerUp) {
    headlines.push({
      icon: snapshot.gap <= 8 ? '⚡' : '📊',
      title: snapshot.gap <= 8 ? '초접전 구도' : `${leader.partyName} 우세`,
      body: snapshot.gap <= 8
        ? `${leader.partyName}과 ${runnerUp.partyName}의 격차가 ${snapshot.gap}점입니다. 오늘 유세와 표결 참여가 순위를 바꿀 수 있습니다.`
        : `${leader.partyName}이 ${runnerUp.partyName}보다 ${snapshot.gap}점 앞서 있습니다.`,
    });
  }
  if (snapshot.crisis) {
    headlines.push({ icon: '🔥', title: snapshot.crisis.title, body: snapshot.crisis.desc || '이번 주 위기 이슈에 대한 시민 선택이 정당 판세에 반영됩니다.' });
  }
  if (!headlines.length) {
    headlines.push({ icon: '🏛️', title: '공화국 준비 중', body: '입당, 유세, 선거, 국회 표결이 쌓이면 오늘의 판세가 더 정교하게 표시됩니다.' });
  }
  return headlines;
}

function buildPartyActivities(snapshot) {
  return snapshot.momentum.map(p => {
    const parts = [];
    if (p.campaignCount) parts.push(`유세 ${p.campaignCount}회`);
    if (p.electionVotes) parts.push(`대선 ${p.electionVotes}표`);
    if (p.crisisVotes) parts.push(`위기투표 ${p.crisisVotes}표`);
    if (p.congressVotes) parts.push(`국회 ${p.congressVotes}표`);
    if (!parts.length) parts.push('조직 정비 중');
    return {
      id: `activity_${snapshot.date}_${p.partyId}`,
      partyId: p.partyId,
      partyName: p.partyName,
      emoji: p.emoji,
      color: p.color,
      title: `${p.emoji} ${p.partyName} · ${p.trend}`,
      desc: `${parts.join(' · ')} · 모멘텀 ${p.score}점`,
      agenda: p.agenda,
      frame: PARTY_STORIES[p.partyId]?.rivalFrame || p.slogan,
      score: p.score,
    };
  });
}

function buildDailyAgenda(snapshot) {
  const campaignLabel = snapshot.leader ? `${snapshot.leader.emoji} ${snapshot.leader.partyName} 견제/추격 유세` : '정당 유세 참여';
  return [
    { id: 'campaign', emoji: '📣', title: campaignLabel, desc: '소속 정당으로 유세하면 정치력 +3P와 정당 모멘텀이 오릅니다.', path: '/republic', reward: '+3P' },
    { id: 'election', emoji: '🗳️', title: '이번 주 대통령 선거', desc: '당대표 후보에게 투표하고 선거 판세를 바꿉니다.', path: '/election', reward: '+5P' },
    { id: 'crisis', emoji: '🔥', title: snapshot.crisis?.title || '주간 정치 위기', desc: snapshot.crisis?.desc || '위기 이슈에 참여하면 정당 의제가 살아납니다.', path: '/election', reward: '판세 반영' },
    { id: 'congress', emoji: '🏛️', title: '소소국회 표결', desc: '진행 중 법안 표결이 정당의 국정 운영 서사를 만듭니다.', path: '/congress', reward: '국정 영향' },
  ];
}

const getCampaignMomentum = onCall({ region: REGION, timeoutSeconds: 20 }, async () => {
  const snapshot = await buildMomentumSnapshot();
  return { ok: true, date: snapshot.date, weekKey: snapshot.weekKey, totals: snapshot.totals, leader: snapshot.leader, gap: snapshot.gap, momentum: snapshot.momentum, headlines: buildHeadlines(snapshot) };
});

const getPartyActivities = onCall({ region: REGION, timeoutSeconds: 20 }, async () => {
  const snapshot = await buildMomentumSnapshot();
  return { ok: true, date: snapshot.date, weekKey: snapshot.weekKey, headlines: buildHeadlines(snapshot), activities: buildPartyActivities(snapshot), dailyAgenda: buildDailyAgenda(snapshot), totals: snapshot.totals, crisis: snapshot.crisis };
});

const getMyStatus = onCall({ region: REGION, timeoutSeconds: 15 }, async request => {
  const uid = request.auth?.uid;
  if (!uid) return { loggedIn: false };

  const userSnap = await db.doc(`users/${uid}`).get();
  const user = userSnap.exists ? userSnap.data() || {} : {};
  const partyId = PARTY_BY_ID[user.partyId] ? user.partyId : null;
  const { key, endKey } = weekPeriod();

  const [ballotSnap, campaignSnap, leaderSnap] = await Promise.all([
    db.doc(`elections/${key}/ballots/${uid}`).get().catch(() => null),
    db.doc(`campaign_records/${uid}_${kstToday()}`).get().catch(() => null),
    partyId ? partyRef(partyId).collection('members').orderBy('power', 'desc').limit(1).get().catch(() => null) : Promise.resolve(null),
  ]);

  const power = Number(user.totalPoints || user.points || 0);
  const leaderDoc = leaderSnap && !leaderSnap.empty ? leaderSnap.docs[0] : null;
  const leaderPower = leaderDoc ? Number(leaderDoc.data().power || 0) : 0;
  const isLeader = !!(partyId && leaderDoc && leaderDoc.id === uid);
  const campaignsToday = campaignSnap?.exists ? Number(campaignSnap.data().count || 0) : 0;

  return {
    loggedIn: true,
    uid,
    partyId,
    partyName: partyId ? PARTY_BY_ID[partyId].name : null,
    partyEmoji: partyId ? PARTY_BY_ID[partyId].emoji : null,
    power,
    isLeader,
    leaderPower,
    pointsToLeader: partyId && !isLeader ? Math.max(0, leaderPower - power + 1) : 0,
    votedElection: !!ballotSnap?.exists,
    electionEndKey: endKey,
    campaignsToday,
    campaignDailyLimit: CAMPAIGN_DAILY_LIMIT,
  };
});

const getDailyNews = onCall({ region: REGION, timeoutSeconds: 20 }, async () => {
  const snapshot = await buildMomentumSnapshot();
  const headlines = buildHeadlines(snapshot);
  return {
    ok: true,
    columns: headlines.map((h, i) => ({
      id: `brief_${snapshot.date}_${i}`,
      title: h.title,
      summary: h.body,
      tags: ['소소공화국', snapshot.leader?.partyName || '정당정치', snapshot.crisis ? '정치위기' : '판세'],
    })),
  };
});

const generateNewsColumn = onCall({ region: REGION, timeoutSeconds: 30 }, async () => {
  const snapshot = await buildMomentumSnapshot();
  const leader = snapshot.leader;
  return {
    ok: true,
    column: {
      title: leader ? `${leader.emoji} ${leader.partyName}, 오늘의 정치 주도권 확보` : '새공화국 브리핑',
      summary: leader ? `${leader.partyName}은 ${leader.trend} 흐름을 앞세워 모멘텀 ${leader.score}점을 기록했습니다. ${leader.agenda} 의제가 오늘의 핵심 쟁점입니다.` : '정당 활동 데이터가 쌓이면 오늘의 브리핑이 더 구체화됩니다.',
    },
  };
});

module.exports = { getCampaignMomentum, getPartyActivities, getMyStatus, getDailyNews, generateNewsColumn };
