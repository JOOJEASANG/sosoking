/* home.js — 소소킹 자료 중심 홈 */
import { auth, functions } from '../firebase.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';

function call(name, payload = {}) {
  return httpsCallable(functions, name)(payload).then(res => res.data || {}).catch(() => null);
}

function renderHero() {
  const loggedIn = !!auth.currentUser;
  return `<section class="home-core-hero">
    <div class="home-core-hero__eyebrow">SOSO ARCHIVE</div>
    <h1 class="home-core-hero__title">오늘의 실제 사건을<br>짧게 읽고 생각을 남기세요</h1>
    <p class="home-core-hero__desc">소소킹은 역사·정치·사회 이슈를 쉽게 정리해 보여주는 자료 사이트입니다. 포인트 없이 자료 읽기와 댓글 참여 중심으로 운영합니다.</p>
    <div class="home-core-hero__status">
      <span>하루 3개 자료</span>
      <span>${loggedIn ? '댓글 참여 가능' : '로그인하면 댓글 참여'}</span>
      <span>실제 사건 기반</span>
    </div>
    <div class="home-core-hero__actions">
      <button class="btn btn--primary" data-go="/battle">📰 오늘자료 보기</button>
      <button class="btn btn--ghost" data-go="/history">📚 역사자료</button>
    </div>
  </section>`;
}

function renderTodayCard(battle) {
  if (!battle?.exists) {
    return `<section class="home-core-card"><div class="home-core-card__title">📰 오늘자료</div><div class="home-core-card__text">오늘의 자료를 준비 중입니다.</div><button class="btn btn--primary btn--sm" data-go="/battle">확인하기</button></section>`;
  }
  return `<section class="home-core-card home-core-card--main">
    <div class="home-core-card__label">오늘의 메인 자료</div>
    <div class="home-core-card__title">📰 ${escHtml(battle.topic || '오늘의 역사·사회 사건')}</div>
    <div class="home-core-card__text">${escHtml(battle.historyQuestion || battle.topicDesc || '사건의 배경과 쟁점을 읽고 의견을 남겨보세요.')}</div>
    <div class="home-core-chiprow">
      ${battle.historyEra ? `<span>${escHtml(battle.historyEra)}</span>` : ''}
      ${battle.motifYear ? `<span>${escHtml(battle.motifYear)}년 관련</span>` : ''}
      <span>댓글 참여</span>
    </div>
    <button class="btn btn--primary btn--sm" data-go="/battle">오늘자료 읽기</button>
  </section>`;
}

function missionState(done) {
  return done ? '<em class="done">완료</em>' : '<em>보기</em>';
}

function renderDailyMissions(history) {
  const todayEvent = history?.events?.[0];
  const missions = [
    { icon: '📰', title: '오늘자료 읽기', desc: '오늘 올라온 실제 사건 자료 확인', tag: '필수', path: '/battle', done: false },
    { icon: '💬', title: '댓글 남기기', desc: '사건에 대한 내 생각 기록', tag: '참여', path: '/battle', done: false },
    { icon: '📚', title: '역사자료 보기', desc: todayEvent ? todayEvent.title : '사건 배경과 흐름 확인', tag: '자료', path: todayEvent ? `/history?day=${todayEvent.day}` : '/history', done: false },
    { icon: '🏆', title: '랭킹 확인', desc: '많이 읽고 참여한 사용자 보기', tag: '선택', path: '/ranking', done: false },
  ];

  return `<section class="home-core-steps home-core-missions">
    <div class="home-core-section-row">
      <div><div class="home-core-section-title">오늘 보면 좋은 순서</div><div class="home-core-section-sub">자료를 읽고 댓글만 남기면 됩니다. 복잡한 포인트 흐름은 제거했습니다.</div></div>
      <span class="home-core-count">자료 중심</span>
    </div>
    <div class="home-core-missiongrid">
      ${missions.map(m => `<button class="home-core-mission" data-go="${escHtml(m.path)}">
        <span class="home-core-mission__icon">${m.icon}</span>
        <span class="home-core-mission__body"><b>${escHtml(m.title)}</b><small>${escHtml(m.desc)}</small></span>
        <span class="home-core-mission__reward">${escHtml(m.tag)}</span>
        ${missionState(m.done)}
      </button>`).join('')}
    </div>
  </section>`;
}

function renderHistoryList(history) {
  const events = Array.isArray(history?.events) ? history.events.slice(0, 3) : [];
  return `<section class="home-core-card home-core-goals">
    <div class="home-core-card__title">📚 최근 역사자료</div>
    <div class="home-core-goallist">
      ${events.length ? events.map(ev => `<button class="home-core-goal" data-go="/history?day=${escHtml(String(ev.day || ''))}"><b>${escHtml(ev.title || ev.parodyTitle || '역사자료')}</b><span>${escHtml(ev.era || ev.motif || '배경·전개·쟁점 정리')}</span></button>`).join('') : `<button class="home-core-goal" data-go="/history"><b>역사자료실</b><span>사건별 배경, 전개, 쟁점을 확인하세요.</span></button>`}
    </div>
  </section>`;
}

function renderCommunityCard(battle) {
  const totalVotes = Number(battle?.totalVotes || 0);
  const commentCount = Array.isArray(battle?.recentComments) ? battle.recentComments.length : 0;
  return `<section class="home-core-card">
    <div class="home-core-card__title">💬 오늘의 의견</div>
    <div class="home-core-card__text">자료를 읽은 뒤 짧게 의견을 남기는 방식으로 운영합니다.</div>
    <div class="home-core-chiprow"><span>${totalVotes}명 참여</span><span>최근 댓글 ${commentCount}개</span></div>
    <button class="btn btn--ghost btn--sm" data-go="/battle">댓글 보러가기</button>
  </section>`;
}

function renderArchiveCard() {
  return `<section class="home-core-card">
    <div class="home-core-card__title">🔎 자료실 방향</div>
    <div class="home-core-card__text">사건 요약, 배경, 전개, 결과, 핵심 쟁점, 생각해볼 질문을 한 화면에서 볼 수 있게 정리합니다.</div>
    <button class="btn btn--ghost btn--sm" data-go="/history">전체 자료 보기</button>
  </section>`;
}

function ensureHomeStyle() {
  if (document.getElementById('home-core-style')) return;
  const style = document.createElement('style');
  style.id = 'home-core-style';
  style.textContent = `
    .home-core{display:grid;gap:14px;padding-bottom:24px}.home-core-hero{border-radius:28px;padding:26px 20px;background:linear-gradient(135deg,rgba(15,23,42,.98),rgba(47,125,110,.86));color:#fff;box-shadow:0 18px 42px rgba(15,23,42,.20)}
    .home-core-hero__eyebrow{font-size:11px;font-weight:1000;letter-spacing:.1em;color:rgba(255,255,255,.62)}.home-core-hero__title{margin:8px 0 8px;font-size:30px;line-height:1.16;font-weight:1000;color:#fff}.home-core-hero__desc{max-width:760px;margin:0;color:rgba(255,255,255,.76);font-size:14px;line-height:1.6}.home-core-hero__status,.home-core-chiprow{display:flex;gap:7px;flex-wrap:wrap;margin-top:13px}.home-core-hero__status span,.home-core-chiprow span{border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.13);padding:6px 9px;font-size:12px;font-weight:900}.home-core-hero__actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
    .home-core-layout{display:grid;grid-template-columns:1fr 1fr;gap:12px}.home-core-card,.home-core-steps{border-radius:22px;border:1px solid rgba(100,116,139,.16);background:var(--color-surface,#fff);padding:16px;box-shadow:0 10px 26px rgba(15,23,42,.055)}.home-core-card--main{background:linear-gradient(135deg,rgba(47,125,110,.10),rgba(248,250,252,.94))}.home-core-card__label{font-size:11px;font-weight:1000;color:#2f7d6e;margin-bottom:6px}.home-core-card__title,.home-core-section-title{font-size:17px;font-weight:1000;color:var(--color-text-primary);margin-bottom:7px}.home-core-section-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}.home-core-section-sub{font-size:12px;color:var(--color-text-muted);line-height:1.45}.home-core-count{border-radius:999px;padding:6px 9px;background:rgba(47,125,110,.10);color:#2f7d6e;font-size:12px;font-weight:1000;white-space:nowrap}.home-core-card__text{font-size:13px;line-height:1.6;color:var(--color-text-secondary);margin-bottom:12px}.home-core-card .home-core-chiprow span{background:rgba(47,125,110,.10);color:#2f7d6e;border-color:rgba(47,125,110,.14)}
    .home-core-missiongrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.home-core-mission{display:grid;grid-template-columns:34px 1fr auto;gap:9px;align-items:center;border:1px solid rgba(100,116,139,.14);border-radius:18px;background:rgba(248,250,252,.78);padding:11px;text-align:left;font-family:inherit;color:inherit;position:relative}.home-core-mission__icon{width:34px;height:34px;border-radius:13px;display:inline-flex;align-items:center;justify-content:center;background:#fff;font-size:18px;box-shadow:0 4px 12px rgba(15,23,42,.05)}.home-core-mission__body b{display:block;font-size:13px;color:var(--color-text-primary);line-height:1.25}.home-core-mission__body small{display:block;font-size:11px;color:var(--color-text-secondary);line-height:1.35;margin-top:2px}.home-core-mission__reward{font-size:11px;font-weight:1000;color:#2f7d6e;background:rgba(47,125,110,.10);border-radius:999px;padding:5px 7px}.home-core-mission em{position:absolute;right:9px;bottom:7px;font-style:normal;font-size:10px;font-weight:1000;color:#94a3b8}.home-core-mission em.done{color:#16a34a}
    .home-core-goallist{display:grid;gap:8px}.home-core-goal{display:block;width:100%;text-align:left;border:1px solid rgba(100,116,139,.14);border-radius:16px;background:rgba(248,250,252,.78);padding:11px 12px;font-family:inherit;color:inherit}.home-core-goal b{display:block;font-size:13px;color:var(--color-text-primary)}.home-core-goal span{display:block;font-size:12px;color:var(--color-text-secondary);line-height:1.45;margin-top:3px}
    @media(max-width:800px){.home-core-layout,.home-core-missiongrid{grid-template-columns:1fr}.home-core-hero__title{font-size:24px}.home-core-mission{grid-template-columns:34px 1fr auto}}
  `;
  document.head.appendChild(style);
}

export async function renderHome() {
  setMeta('소소킹 — 실제 사건 자료 사이트');
  ensureHomeStyle();
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<div class="home-core"><div class="skeleton" style="height:210px;border-radius:28px"></div><div class="skeleton" style="height:420px;border-radius:22px"></div></div>`;

  const [battle, history] = await Promise.all([
    call('getBattleStatus'),
    call('getHistoryArchive', { limit: 3 }),
  ]);

  el.innerHTML = `<div class="home-core page-enter">
    ${renderHero()}
    ${renderTodayCard(battle)}
    ${renderDailyMissions(history)}
    ${renderHistoryList(history)}
    <div class="home-core-layout">
      ${renderCommunityCard(battle)}
      ${renderArchiveCard()}
    </div>
  </div>`;

  el.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.go)));
}
