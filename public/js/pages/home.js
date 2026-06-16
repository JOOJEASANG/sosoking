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
    <h1 class="home-core-hero__title">오늘의 역사 사건을 선택하고<br>내 정당을 키우세요</h1>
    <p class="home-core-hero__desc">소소킹은 실제 역사 모티브를 가상 정당 게임으로 풀어보는 역사정치 시뮬레이션입니다.</p>
    <div class="home-core-hero__status">
      <span>${loggedIn ? `내 정당 · ${escHtml(party)}` : '로그인 후 정치력 저장'}</span>
      <span>정치력 · ${loggedIn ? power + 'P' : '0P'}</span>
    </div>
    <div class="home-core-hero__actions">
      <button class="btn btn--primary" data-go="/battle">⚔️ 오늘게임 시작</button>
      <button class="btn btn--ghost" data-go="/republic">🏛️ 정당 선택</button>
    </div>
  </section>`;
}

function renderTodayCard(battle) {
  if (!battle?.exists) {
    return `<section class="home-core-card"><div class="home-core-card__title">⚔️ 오늘게임</div><div class="home-core-card__text">오늘의 역사정치 사건을 준비 중입니다.</div><button class="btn btn--primary btn--sm" data-go="/battle">확인하기</button></section>`;
  }
  return `<section class="home-core-card home-core-card--main">
    <div class="home-core-card__label">오늘 해야 할 일 1</div>
    <div class="home-core-card__title">⚔️ ${escHtml(battle.topic || '오늘의 역사정치 사건')}</div>
    <div class="home-core-card__text">${escHtml(battle.historyQuestion || battle.topicDesc || '가상 정당 중 어느 해석을 지지할지 선택하세요.')}</div>
    <div class="home-core-chiprow">
      ${battle.historyEra ? `<span>${escHtml(battle.historyEra)}</span>` : ''}
      ${battle.motifYear ? `<span>${escHtml(battle.motifYear)}년 모티브</span>` : ''}
      <span>투표하면 정치력 +5P</span>
    </div>
    <button class="btn btn--primary btn--sm" data-go="/battle">오늘게임 참여</button>
  </section>`;
}

function renderSteps(myStatus, election, history) {
  const joined = !!myStatus?.partyId;
  const voted = election?.election?.myVote != null;
  const todayEvent = history?.events?.[0];
  return `<section class="home-core-steps">
    <div class="home-core-section-title">오늘 순서</div>
    <div class="home-core-stepgrid">
      <button class="home-core-step" data-go="/battle">
        <b>1. 오늘게임</b><span>역사 사건에 투표하고 정치력 얻기</span><em>바로가기</em>
      </button>
      <button class="home-core-step" data-go="/republic">
        <b>2. 정당 활동</b><span>${joined ? `${escHtml(myStatus.partyName || partyName(myStatus.partyId))} 소속 · 유세 가능` : '정당에 가입해야 유세 가능'}</span><em>${joined ? '유세하기' : '입당하기'}</em>
      </button>
      <button class="home-core-step" data-go="/election">
        <b>3. 대통령 선거</b><span>${voted ? '이번 주 투표 완료' : `${fmtNum(election?.election?.totalVotes || 0)}표 집계 중`}</span><em>선거 보기</em>
      </button>
      <button class="home-core-step" data-go="${todayEvent ? `/history?day=${todayEvent.day}` : '/history'}">
        <b>4. 역사자료</b><span>${todayEvent ? escHtml(todayEvent.title) : '사건 자료 읽기'}</span><em>자료 보기</em>
      </button>
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
    .home-core-layout{display:grid;grid-template-columns:1.15fr .85fr;gap:12px}.home-core-card,.home-core-steps{border-radius:22px;border:1px solid rgba(100,116,139,.16);background:var(--color-surface,#fff);padding:16px;box-shadow:0 10px 26px rgba(15,23,42,.055)}.home-core-card--main{background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(248,250,252,.92))}.home-core-card__label{font-size:11px;font-weight:1000;color:#6366f1;margin-bottom:6px}.home-core-card__title,.home-core-section-title{font-size:17px;font-weight:1000;color:var(--color-text-primary);margin-bottom:7px}.home-core-card__text{font-size:13px;line-height:1.6;color:var(--color-text-secondary);margin-bottom:12px}.home-core-card .home-core-chiprow span{background:rgba(99,102,241,.09);color:#4f46e5;border-color:rgba(99,102,241,.12)}
    .home-core-stepgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.home-core-step{border:1px solid rgba(100,116,139,.14);border-radius:18px;background:rgba(248,250,252,.78);padding:13px;text-align:left;font-family:inherit;cursor:pointer;color:inherit}.home-core-step b{display:block;font-size:14px;color:var(--color-text-primary);margin-bottom:4px}.home-core-step span{display:block;font-size:12px;line-height:1.45;color:var(--color-text-secondary);min-height:34px}.home-core-step em{display:inline-block;margin-top:8px;font-style:normal;font-size:11px;font-weight:1000;color:#4f46e5}.home-core-partylist{display:grid;gap:8px;margin:10px 0}.home-core-party{display:flex;align-items:center;justify-content:space-between;border-radius:14px;background:rgba(248,250,252,.9);padding:10px 11px;font-size:13px}.home-core-party span{font-weight:900}.home-core-party b{color:#4f46e5}
    @media(max-width:800px){.home-core-layout,.home-core-stepgrid{grid-template-columns:1fr}.home-core-hero__title{font-size:24px}}
  `;
  document.head.appendChild(style);
}

export async function renderHome() {
  setMeta('소소킹 — 역사정치 게임');
  ensureHomeStyle();
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<div class="home-core"><div class="skeleton" style="height:210px;border-radius:28px"></div><div class="skeleton" style="height:320px;border-radius:22px"></div></div>`;

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
    ${renderSteps(myStatus, election, history)}
    <div class="home-core-layout">
      ${renderParties(overview)}
      ${renderElection(election)}
    </div>
  </div>`;

  el.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.go)));
}
