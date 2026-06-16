/* home.js — 소소킹 핵심 게임 대시보드 */
import { auth, functions } from '../firebase.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';

function call(name, payload = {}) {
  return httpsCallable(functions, name)(payload).then(res => res.data || {}).catch(() => null);
}

function fmtNum(n) {
  n = Number(n || 0);
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function partyName(id) {
  return ({ national: '국민질서당', youth: '시민개혁당', center: '국민통합당' })[id] || '무소속';
}

function renderHero(myStatus) {
  const loggedIn = !!auth.currentUser;
  const party = myStatus?.partyName || partyName(myStatus?.partyId);
  const power = fmtNum(myStatus?.power || 0);
  return `<section class="home-core-hero">
    <div class="home-core-hero__eyebrow">HISTORY POLITICS GAME</div>
    <h1 class="home-core-hero__title">오늘의 미션을 끝내고<br>정당을 키우세요</h1>
    <p class="home-core-hero__desc">소소킹은 실제 역사 모티브를 선택형 정치게임으로 풀어가는 역사정치 시뮬레이션입니다.</p>
    <div class="home-core-hero__status">
      <span>${loggedIn ? `내 정당 · ${escHtml(party)}` : '로그인 후 정치력 저장'}</span>
      <span>정치력 · ${loggedIn ? power + 'P' : '0P'}</span>
    </div>
    <div class="home-core-hero__actions">
      <button class="btn btn--primary" data-go="/battle">⚔️ 오늘게임 시작</button>
      <button class="btn btn--ghost" data-go="/republic">🏛️ 정당 활동</button>
    </div>
  </section>`;
}

function renderTodayCard(battle) {
  if (!battle?.exists) {
    return `<section class="home-core-card"><div class="home-core-card__title">⚔️ 오늘게임</div><div class="home-core-card__text">오늘의 역사정치 사건을 준비 중입니다.</div><button class="btn btn--primary btn--sm" data-go="/battle">확인하기</button></section>`;
  }
  return `<section class="home-core-card home-core-card--main">
    <div class="home-core-card__label">오늘의 메인 사건</div>
    <div class="home-core-card__title">⚔️ ${escHtml(battle.topic || '오늘의 역사정치 사건')}</div>
    <div class="home-core-card__text">${escHtml(battle.historyQuestion || battle.topicDesc || '가상 정당 중 어느 해석을 지지할지 선택하세요.')}</div>
    <div class="home-core-chiprow">
      ${battle.historyEra ? `<span>${escHtml(battle.historyEra)}</span>` : ''}
      ${battle.motifYear ? `<span>${escHtml(battle.motifYear)}년 모티브</span>` : ''}
      <span>투표 보상 +5P</span>
    </div>
    <button class="btn btn--primary btn--sm" data-go="/battle">오늘게임 참여</button>
  </section>`;
}

function missionState(done) {
  return done ? '<em class="done">완료</em>' : '<em>진행</em>';
}

function renderDailyMissions(myStatus, election, history, overview) {
  const loggedIn = !!auth.currentUser;
  const joined = !!myStatus?.partyId;
  const votedElection = !!election?.election?.myVote;
  const campaignDone = Number(myStatus?.campaignsToday || 0);
  const campaignLimit = Number(myStatus?.campaignDailyLimit || 3);
  const todayEvent = history?.events?.[0];
  const partyRank = overview?.me?.partyId
    ? (overview.parties || []).find(p => p.id === overview.me.partyId)?.rank
    : null;

  const missions = [
    { icon: '⚔️', title: '오늘게임 투표', desc: '역사 사건에 한 표 행사', reward: '+5P', path: '/battle', done: false },
    { icon: '🏛️', title: joined ? '정당 유세' : '정당 입당', desc: joined ? `오늘 ${campaignDone}/${campaignLimit}회 유세` : '정당을 골라 소속 만들기', reward: joined ? '+3P' : '소속 생성', path: '/republic', done: joined && campaignDone >= campaignLimit },
    { icon: '👑', title: '대통령 선거', desc: votedElection ? '이번 주 투표 완료' : `${fmtNum(election?.election?.totalVotes || 0)}표 집계 중`, reward: votedElection ? '완료' : '+5P', path: '/election', done: votedElection },
    { icon: '📚', title: '역사자료 읽기', desc: todayEvent ? todayEvent.title : '오늘 사건 배경 확인', reward: '이해도', path: todayEvent ? `/history?day=${todayEvent.day}` : '/history', done: false },
    { icon: '📈', title: '정당 순위 확인', desc: partyRank ? `내 정당 현재 ${partyRank}위` : '정당 판세 확인', reward: '전략', path: '/republic', done: false },
    { icon: '🏆', title: '랭킹 확인', desc: '내 정치력 위치 확인', reward: '목표', path: '/ranking', done: false },
  ];

  return `<section class="home-core-steps home-core-missions">
    <div class="home-core-section-row">
      <div><div class="home-core-section-title">오늘 미션</div><div class="home-core-section-sub">하루에 이 정도만 해도 성장 흐름이 생깁니다.</div></div>
      <span class="home-core-count">${missions.filter(m => m.done).length}/${missions.length}</span>
    </div>
    <div class="home-core-missiongrid">
      ${missions.map(m => `<button class="home-core-mission" data-go="${escHtml(loggedIn || m.path === '/history' || m.path.startsWith('/history') ? m.path : '/login')}">
        <span class="home-core-mission__icon">${m.icon}</span>
        <span class="home-core-mission__body"><b>${escHtml(m.title)}</b><small>${escHtml(m.desc)}</small></span>
        <span class="home-core-mission__reward">${escHtml(m.reward)}</span>
        ${missionState(m.done)}
      </button>`).join('')}
    </div>
  </section>`;
}

function renderWeeklyGoals(myStatus, election, overview) {
  const joined = !!myStatus?.partyId;
  const leaderText = myStatus?.isLeader
    ? '현재 내가 당대표입니다.'
    : joined && myStatus?.pointsToLeader
      ? `당대표까지 ${fmtNum(myStatus.pointsToLeader)}P 남았습니다.`
      : '정당에 입당하면 당대표에 도전할 수 있습니다.';
  const topParty = (overview?.parties || [])[0];
  const candidates = election?.election?.candidates || [];
  const leader = [...candidates].sort((a, b) => Number(b.votes || 0) - Number(a.votes || 0))[0];

  return `<section class="home-core-card home-core-goals">
    <div class="home-core-card__title">이번 주 목표</div>
    <div class="home-core-goallist">
      <button class="home-core-goal" data-go="/republic"><b>당대표 도전</b><span>${escHtml(leaderText)}</span></button>
      <button class="home-core-goal" data-go="/election"><b>대통령 만들기</b><span>${leader ? `현재 선두 ${escHtml(leader.candidateName || '후보')}` : '대통령 후보 판세 확인'}</span></button>
      <button class="home-core-goal" data-go="/republic"><b>정당 1위 경쟁</b><span>${topParty ? `현재 1위 ${escHtml(topParty.name)} · ${fmtNum(topParty.totalPower)}P` : '정당 판세 준비 중'}</span></button>
    </div>
  </section>`;
}

function renderParties(overview) {
  const parties = Array.isArray(overview?.parties) ? overview.parties.slice(0, 3) : [];
  return `<section class="home-core-card">
    <div class="home-core-card__title">🏛️ 정당 판세</div>
    <div class="home-core-partylist">
      ${parties.length ? parties.map(p => `<div class="home-core-party"><span>${escHtml(p.emoji || '🏛️')} ${escHtml(p.name)}</span><b>${fmtNum(p.totalPower || 0)}P</b></div>`).join('') : '<div class="home-core-card__text">정당 정보를 준비 중입니다.</div>'}
    </div>
    <button class="btn btn--ghost btn--sm" data-go="/republic">정당 관리</button>
  </section>`;
}

function renderElection(election) {
  const cands = election?.election?.candidates || [];
  const leader = [...cands].sort((a, b) => Number(b.votes || 0) - Number(a.votes || 0))[0];
  return `<section class="home-core-card">
    <div class="home-core-card__title">👑 대통령 선거</div>
    <div class="home-core-card__text">${leader ? `현재 선두 · ${escHtml(leader.candidateName || '후보')} (${escHtml(leader.partyName || '')})` : '이번 주 대통령 선거가 진행 중입니다.'}</div>
    <div class="home-core-chiprow"><span>${fmtNum(election?.election?.totalVotes || 0)}표</span><span>${election?.election?.myVote ? '투표 완료' : '투표 가능'}</span></div>
    <button class="btn btn--ghost btn--sm" data-go="/election">선거 보기</button>
  </section>`;
}

function ensureHomeStyle() {
  if (document.getElementById('home-core-style')) return;
  const style = document.createElement('style');
  style.id = 'home-core-style';
  style.textContent = `
    .home-core{display:grid;gap:14px;padding-bottom:24px}.home-core-hero{border-radius:28px;padding:26px 20px;background:linear-gradient(135deg,rgba(15,23,42,.98),rgba(67,56,202,.82));color:#fff;box-shadow:0 18px 42px rgba(15,23,42,.20)}
    .home-core-hero__eyebrow{font-size:11px;font-weight:1000;letter-spacing:.1em;color:rgba(255,255,255,.62)}.home-core-hero__title{margin:8px 0 8px;font-size:30px;line-height:1.16;font-weight:1000;color:#fff}.home-core-hero__desc{max-width:720px;margin:0;color:rgba(255,255,255,.74);font-size:14px;line-height:1.6}.home-core-hero__status,.home-core-chiprow{display:flex;gap:7px;flex-wrap:wrap;margin-top:13px}.home-core-hero__status span,.home-core-chiprow span{border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.13);padding:6px 9px;font-size:12px;font-weight:900}.home-core-hero__actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
    .home-core-layout{display:grid;grid-template-columns:1.15fr .85fr;gap:12px}.home-core-card,.home-core-steps{border-radius:22px;border:1px solid rgba(100,116,139,.16);background:var(--color-surface,#fff);padding:16px;box-shadow:0 10px 26px rgba(15,23,42,.055)}.home-core-card--main{background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(248,250,252,.92))}.home-core-card__label{font-size:11px;font-weight:1000;color:#6366f1;margin-bottom:6px}.home-core-card__title,.home-core-section-title{font-size:17px;font-weight:1000;color:var(--color-text-primary);margin-bottom:7px}.home-core-section-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}.home-core-section-sub{font-size:12px;color:var(--color-text-muted);line-height:1.45}.home-core-count{border-radius:999px;padding:6px 9px;background:rgba(99,102,241,.09);color:#4f46e5;font-size:12px;font-weight:1000;white-space:nowrap}.home-core-card__text{font-size:13px;line-height:1.6;color:var(--color-text-secondary);margin-bottom:12px}.home-core-card .home-core-chiprow span{background:rgba(99,102,241,.09);color:#4f46e5;border-color:rgba(99,102,241,.12)}
    .home-core-missiongrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.home-core-mission{display:grid;grid-template-columns:34px 1fr auto;gap:9px;align-items:center;border:1px solid rgba(100,116,139,.14);border-radius:18px;background:rgba(248,250,252,.78);padding:11px;text-align:left;font-family:inherit;color:inherit;position:relative}.home-core-mission__icon{width:34px;height:34px;border-radius:13px;display:inline-flex;align-items:center;justify-content:center;background:#fff;font-size:18px;box-shadow:0 4px 12px rgba(15,23,42,.05)}.home-core-mission__body b{display:block;font-size:13px;color:var(--color-text-primary);line-height:1.25}.home-core-mission__body small{display:block;font-size:11px;color:var(--color-text-secondary);line-height:1.35;margin-top:2px}.home-core-mission__reward{font-size:11px;font-weight:1000;color:#4f46e5;background:rgba(99,102,241,.09);border-radius:999px;padding:5px 7px}.home-core-mission em{position:absolute;right:9px;bottom:7px;font-style:normal;font-size:10px;font-weight:1000;color:#94a3b8}.home-core-mission em.done{color:#16a34a}
    .home-core-goallist{display:grid;gap:8px}.home-core-goal{display:block;width:100%;text-align:left;border:1px solid rgba(100,116,139,.14);border-radius:16px;background:rgba(248,250,252,.78);padding:11px 12px;font-family:inherit;color:inherit}.home-core-goal b{display:block;font-size:13px;color:var(--color-text-primary)}.home-core-goal span{display:block;font-size:12px;color:var(--color-text-secondary);line-height:1.45;margin-top:3px}.home-core-partylist{display:grid;gap:8px;margin:10px 0}.home-core-party{display:flex;align-items:center;justify-content:space-between;border-radius:14px;background:rgba(248,250,252,.9);padding:10px 11px;font-size:13px}.home-core-party span{font-weight:900}.home-core-party b{color:#4f46e5}
    @media(max-width:800px){.home-core-layout,.home-core-missiongrid{grid-template-columns:1fr}.home-core-hero__title{font-size:24px}.home-core-mission{grid-template-columns:34px 1fr auto}}
  `;
  document.head.appendChild(style);
}

export async function renderHome() {
  setMeta('소소킹 — 역사정치 게임');
  ensureHomeStyle();
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<div class="home-core"><div class="skeleton" style="height:210px;border-radius:28px"></div><div class="skeleton" style="height:420px;border-radius:22px"></div></div>`;

  const [battle, myStatus, election, overview, history] = await Promise.all([
    call('getBattleStatus'),
    call('getMyStatus'),
    call('getElection'),
    call('getPoliticsOverview'),
    call('getHistoryArchive', { limit: 1 }),
  ]);

  el.innerHTML = `<div class="home-core page-enter">
    ${renderHero(myStatus)}
    ${renderTodayCard(battle)}
    ${renderDailyMissions(myStatus, election, history, overview)}
    ${renderWeeklyGoals(myStatus, election, overview)}
    <div class="home-core-layout">
      ${renderParties(overview)}
      ${renderElection(election)}
    </div>
  </div>`;

  el.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.go)));
}
