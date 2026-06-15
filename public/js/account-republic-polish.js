// account-republic-polish.js
// 내정보 페이지를 소소공화국 정치게임 구조에 맞게 보강합니다.

import { auth, functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from './router.js';
import { getPoliticalRank } from './utils/political-rank.js';

function currentPath() {
  const hashPath = (window.location.hash.slice(1) || '').split('?')[0];
  if (hashPath && hashPath !== '/') return hashPath;
  return window.location.pathname || '/';
}

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function fmtNum(value) {
  const n = Number(value || 0);
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

function ensureStyle() {
  if (document.getElementById('account-republic-polish-style')) return;
  const style = document.createElement('style');
  style.id = 'account-republic-polish-style';
  style.textContent = `
    .account-republic-card{position:relative;overflow:hidden;border-radius:26px;background:linear-gradient(135deg,#111827,#4338ca 58%,#ff6b4a);color:#fff;padding:18px;margin:12px 0 14px;box-shadow:0 18px 38px rgba(15,23,42,.18)}
    .account-republic-card:before{content:"";position:absolute;right:-90px;top:-90px;width:240px;height:240px;border-radius:999px;background:rgba(255,255,255,.11)}
    .account-republic-card:after{content:"";position:absolute;left:35%;bottom:-150px;width:300px;height:300px;border-radius:999px;background:rgba(255,107,74,.22)}
    .account-republic-inner{position:relative;z-index:1}
    .account-republic-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:13px}
    .account-republic-eyebrow{font-size:11px;font-weight:1000;letter-spacing:.1em;color:rgba(255,255,255,.62);margin-bottom:5px}
    .account-republic-title{font-size:23px;font-weight:1000;letter-spacing:-.04em;line-height:1.15}
    .account-republic-desc{font-size:12px;line-height:1.55;color:rgba(255,255,255,.72);margin-top:6px;max-width:600px}
    .account-republic-status{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.1);border-radius:18px;padding:10px 12px;min-width:118px;text-align:center;backdrop-filter:blur(10px)}
    .account-republic-status span{display:block;font-size:10px;font-weight:900;color:rgba(255,255,255,.65);margin-bottom:2px}
    .account-republic-status b{display:block;font-size:17px;font-weight:1000;color:#fff}
    .account-republic-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px}
    .account-republic-stat{border-radius:17px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.16);padding:10px;min-height:74px}
    .account-republic-stat span{display:block;font-size:10px;font-weight:900;color:rgba(255,255,255,.66);margin-bottom:4px}
    .account-republic-stat b{display:block;font-size:15px;font-weight:1000;color:#fff;line-height:1.25}
    .account-republic-stat em{display:block;font-style:normal;font-size:10px;color:rgba(255,255,255,.66);margin-top:4px;line-height:1.35}
    .account-republic-routine{border-radius:18px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);padding:11px;margin-top:10px}
    .account-republic-routine__title{font-size:12px;font-weight:1000;margin-bottom:8px;color:#fff}
    .account-republic-routine__list{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
    .account-republic-task{border-radius:14px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.13);padding:8px;font-size:11px;font-weight:900;color:rgba(255,255,255,.72)}
    .account-republic-task b{display:block;font-size:12px;color:#fff;margin-bottom:2px}
    .account-republic-task--done{background:rgba(34,197,94,.2);border-color:rgba(134,239,172,.35);color:#dcfce7}
    .account-republic-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}
    .account-republic-action{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.12);color:#fff;border-radius:999px;padding:9px 11px;font-size:12px;font-weight:1000;font-family:inherit;cursor:pointer}
    .account-republic-action--primary{background:#fff;color:#111827;border-color:#fff}
    .account-republic-note{font-size:11px;line-height:1.45;color:rgba(255,255,255,.68);margin-top:9px}
    .account-tab[data-tab="stats"] .account-tab__label{font-size:0}
    .account-tab[data-tab="stats"] .account-tab__label:after{content:"정치기록";font-size:12px}
    .account-tab[data-tab="party"] .account-tab__label{font-size:0}
    .account-tab[data-tab="party"] .account-tab__label:after{content:"내 정당";font-size:12px}
    @media(max-width:760px){.account-republic-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.account-republic-routine__list{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:440px){.account-republic-card{border-radius:22px;padding:15px;margin-top:10px}.account-republic-title{font-size:20px}.account-republic-status{width:100%;text-align:left}.account-republic-grid{grid-template-columns:1fr}.account-republic-routine__list{grid-template-columns:1fr}.account-republic-action{flex:1;text-align:center}.account-republic-action--primary{flex-basis:100%}}
  `;
  document.head.appendChild(style);
}

async function loadStatus() {
  const callMyStatus = httpsCallable(functions, 'getMyStatus');
  const callPresident = httpsCallable(functions, 'getPresident');
  const callElection = httpsCallable(functions, 'getElection');
  const [statusRes, presidentRes, electionRes] = await Promise.all([
    auth.currentUser ? callMyStatus().catch(() => null) : Promise.resolve(null),
    callPresident().catch(() => null),
    callElection().catch(() => null),
  ]);
  return {
    status: statusRes?.data || null,
    president: presidentRes?.data?.president || null,
    election: electionRes?.data?.election || null,
  };
}

function task(done, title, sub) {
  return `<div class="account-republic-task${done ? ' account-republic-task--done' : ''}"><b>${done ? '✅' : '⬜'} ${title}</b>${sub}</div>`;
}

function renderCard(data) {
  const s = data.status || {};
  const power = Number(s.power || 0);
  const rank = getPoliticalRank(power);
  const partyName = s.partyName || '무소속';
  const partyEmoji = s.partyId ? (s.partyEmoji || '🏛️') : '🚶';
  const partyRank = s.partyRank ? `당내 ${s.partyRank}위` : (s.partyId ? '집계중' : '입당 전');
  const leaderGap = s.isLeader ? '현재 당대표' : (s.pointsToLeader > 0 ? `${fmtNum(s.pointsToLeader)}P 필요` : (s.partyId ? '당대표권 근접' : '입당 필요'));
  const isPresident = !!(data.president?.candidateUid && auth.currentUser && data.president.candidateUid === auth.currentUser.uid);
  const presidentText = isPresident ? '현직 대통령' : (data.president?.candidateName ? `대통령: ${data.president.candidateName}` : '선출 전');
  const votedElection = !!s.votedElection;
  const votedBattle = !!s.votedBattleToday;
  const campaigns = Number(s.campaignsToday || 0);
  const readNews = !!s.readNewsToday;

  return `
    <section class="account-republic-card" id="account-republic-card">
      <div class="account-republic-inner">
        <div class="account-republic-head">
          <div>
            <div class="account-republic-eyebrow">SOSO REPUBLIC ID</div>
            <div class="account-republic-title">🏛️ 내 소소공화국 신분증</div>
            <div class="account-republic-desc">내 정치력, 정당, 당내 순위, 당대표·대선 도전 상태를 한눈에 확인합니다.</div>
          </div>
          <div class="account-republic-status">
            <span>현재 신분</span>
            <b>${s.partyId ? (s.isLeader ? '당대표' : '정당 당원') : '무소속 시민'}</b>
          </div>
        </div>

        <div class="account-republic-grid">
          <div class="account-republic-stat"><span>정치력</span><b>${rank.emoji} ${fmtNum(power)}P</b><em>${esc(rank.title || rank.label || '정치 등급')}</em></div>
          <div class="account-republic-stat"><span>내 정당</span><b>${esc(partyEmoji)} ${esc(partyName)}</b><em>${s.partyId ? '정당 활동 중' : '입당하면 당대표 도전 가능'}</em></div>
          <div class="account-republic-stat"><span>당내 위치</span><b>${esc(partyRank)}</b><em>AI 당원 포함 순위</em></div>
          <div class="account-republic-stat"><span>당대표까지</span><b>${esc(leaderGap)}</b><em>${s.weeklyGain ? `이번 주 +${fmtNum(s.weeklyGain)}P` : '활동으로 상승'}</em></div>
          <div class="account-republic-stat"><span>대선 상태</span><b>${esc(presidentText)}</b><em>${s.isLeader ? '대선 후보 자격' : '당대표가 후보가 됩니다'}</em></div>
          <div class="account-republic-stat"><span>포고령 지지율</span><b>${s.approvalRating != null ? `${s.approvalRating}%` : '집계 전'}</b><em>대통령 활동 지표</em></div>
          <div class="account-republic-stat"><span>오늘 유세</span><b>${campaigns}/3회</b><em>정당 세력 밀어주기</em></div>
          <div class="account-republic-stat"><span>이번 주 성장</span><b>+${fmtNum(s.weeklyGain || 0)}P</b><em>정치력 상승량</em></div>
        </div>

        <div class="account-republic-routine">
          <div class="account-republic-routine__title">오늘의 핵심 활동</div>
          <div class="account-republic-routine__list">
            ${task(votedBattle, '정치배틀', votedBattle ? '오늘 참여 완료' : '투표/토론으로 정치력 획득')}
            ${task(campaigns >= 3, '유세하기', `${campaigns}/3회 · 내 정당 세력 상승`)}
            ${task(votedElection, '대선 투표', votedElection ? '이번 선거 투표 완료' : '후보 지지 선언 가능')}
            ${task(readNews, '소소신문', readNews ? '오늘 확인 완료' : '정세 확인하기')}
          </div>
        </div>

        <div class="account-republic-actions">
          <button type="button" class="account-republic-action account-republic-action--primary" data-account-go="/battle">⚔️ 정치배틀</button>
          <button type="button" class="account-republic-action" data-account-go="/parties">🏛️ 정당 보기</button>
          <button type="button" class="account-republic-action" data-account-go="/election">👑 대선 보기</button>
          <button type="button" class="account-republic-action" data-account-go="/write">🗣️ 시민발언</button>
        </div>
        <div class="account-republic-note">이 페이지의 정치력은 개인 점수, 유세는 정당 세력 상승입니다. 당내 1위가 되면 당대표가 되고, 당대표가 대선 후보가 됩니다.</div>
      </div>
    </section>`;
}

let polishing = false;
async function polishAccount() {
  if (currentPath() !== '/account') return;
  if (!auth.currentUser) return;
  if (polishing) return; // 비동기 로딩 중 MutationObserver 재진입으로 인한 신분증 중복 삽입 방지
  const wrap = document.querySelector('.account-page-wrap');
  const profile = document.querySelector('.account-profile-card');
  if (!wrap || !profile || document.getElementById('account-republic-card')) return;
  polishing = true;
  ensureStyle();

  try {
    const data = await loadStatus();
    // await 사이에 DOM이 바뀌었을 수 있으니 삽입 직전 다시 확인한다
    const liveProfile = document.querySelector('.account-profile-card');
    if (!liveProfile || document.getElementById('account-republic-card')) return;
    liveProfile.insertAdjacentHTML('afterend', renderCard(data));
    document.querySelectorAll('[data-account-go]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.accountGo));
    });
  } catch (error) {
    console.warn('[account-republic-polish] failed', error);
  } finally {
    polishing = false;
  }
}

function cleanupOldPoliticalBadges() {
  if (currentPath() !== '/account') return;
  document.querySelectorAll('.stat-badge').forEach(el => {
    const txt = el.textContent || '';
    if (txt.includes('위기 대응') || txt.includes('위기 관리자') || txt.includes('대정부 질문')) {
      el.style.display = 'none';
    }
  });
  document.querySelectorAll('.empty-state__desc').forEach(el => {
    if (el.textContent.includes('피드에 첫 글')) el.textContent = '시민광장에 첫 시민발언을 남겨보세요.';
  });
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    polishAccount();
    cleanupOldPoliticalBadges();
  }, 140);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('popstate', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);

function observe() {
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', observe, { once: true });
    return;
  }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
}

observe();
