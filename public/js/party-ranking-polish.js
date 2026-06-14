// party-ranking-polish.js
// 정당 세력 순위와 내 당내 순위 표시를 카드형 UI로 정리합니다.

import { auth, functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

function currentPath() {
  const hashPath = (window.location.hash.slice(1) || '').split('?')[0];
  if (hashPath && hashPath !== '/') return hashPath;
  return window.location.pathname || '/';
}

function fmtNum(value) {
  const n = Number(value || 0);
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
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

function medal(rank) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
}

function ensureStyle() {
  if (document.getElementById('party-ranking-polish-style')) return;
  const style = document.createElement('style');
  style.id = 'party-ranking-polish-style';
  style.textContent = `
    .standings-section.party-rank-polished{position:relative;overflow:hidden;border-radius:26px;background:linear-gradient(180deg,#ffffff,rgba(248,250,252,.96));border:1px solid rgba(100,116,139,.14);box-shadow:0 16px 36px rgba(15,23,42,.08);padding:16px;margin:16px 0}
    .party-rank-polished:before{content:"";position:absolute;right:-80px;top:-90px;width:220px;height:220px;border-radius:999px;background:radial-gradient(circle,rgba(255,107,74,.14),transparent 66%);pointer-events:none}
    .party-rank-head{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:14px;flex-wrap:wrap}
    .party-rank-head__eyebrow{font-size:11px;font-weight:1000;letter-spacing:.1em;color:var(--color-primary);margin-bottom:4px}
    .party-rank-head__title{font-size:22px;font-weight:1000;color:var(--color-text-primary);letter-spacing:-.03em}
    .party-rank-head__desc{font-size:12px;color:var(--color-text-secondary);line-height:1.5;margin-top:5px}
    .party-rank-head__quiz{border:0;border-radius:999px;padding:10px 13px;background:rgba(15,23,42,.06);font-weight:1000;color:var(--color-text-primary);cursor:pointer;font-family:inherit}
    .party-rank-board{position:relative;z-index:1;display:grid;gap:10px}
    .party-rank-card{position:relative;overflow:hidden;border-radius:22px;background:#fff;border:1px solid rgba(100,116,139,.12);box-shadow:0 10px 22px rgba(15,23,42,.055);padding:13px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;--pc:#64748b}
    .party-rank-card--top{box-shadow:0 14px 30px rgba(255,107,74,.12);border-color:rgba(255,107,74,.2)}
    .party-rank-card--mine{outline:2px solid rgba(34,197,94,.18);background:linear-gradient(180deg,#fff,rgba(240,253,244,.78))}
    .party-rank-card:before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--pc)}
    .party-rank-card__rank{width:42px;height:42px;border-radius:16px;background:rgba(15,23,42,.05);display:grid;place-items:center;font-size:20px;font-weight:1000}
    .party-rank-card__main{min-width:0}
    .party-rank-card__name-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap;min-width:0}
    .party-rank-card__emoji{font-size:22px;line-height:1}
    .party-rank-card__name{font-size:16px;font-weight:1000;color:var(--color-text-primary)}
    .party-rank-card__leader{font-size:12px;font-weight:900;color:var(--color-text-secondary)}
    .party-rank-card__badges{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}
    .party-rank-badge{border-radius:999px;padding:4px 7px;font-size:10px;font-weight:1000;background:rgba(15,23,42,.06);color:var(--color-text-secondary)}
    .party-rank-badge--top{background:rgba(255,193,7,.18);color:#8a5b00}
    .party-rank-badge--prez{background:rgba(59,130,246,.14);color:#1d4ed8}
    .party-rank-badge--mine{background:rgba(34,197,94,.14);color:#15803d}
    .party-rank-card__bar{height:9px;border-radius:999px;background:rgba(15,23,42,.06);overflow:hidden;margin-top:10px}
    .party-rank-card__fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--pc),rgba(255,255,255,.18));min-width:5%}
    .party-rank-card__stats{display:grid;gap:4px;text-align:right;min-width:86px}
    .party-rank-card__power{font-size:16px;font-weight:1000;color:var(--color-text-primary)}
    .party-rank-card__sub{font-size:11px;font-weight:900;color:var(--color-text-secondary)}
    .party-rank-help{margin-top:10px;border-radius:18px;background:linear-gradient(135deg,rgba(255,107,74,.09),rgba(59,130,246,.08));border:1px solid rgba(100,116,139,.14);padding:12px;display:grid;gap:8px}
    .party-rank-help__title{font-size:12px;font-weight:1000;color:var(--color-text-primary)}
    .party-rank-help__grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
    .party-rank-help__item{border-radius:14px;background:rgba(255,255,255,.8);padding:8px;text-align:center;border:1px solid rgba(100,116,139,.1)}
    .party-rank-help__item span{display:block;font-size:10px;color:var(--color-text-secondary);font-weight:900;margin-bottom:2px}
    .party-rank-help__item b{display:block;font-size:13px;color:var(--color-text-primary);font-weight:1000}
    .party-rank-help__note{font-size:11px;line-height:1.45;color:var(--color-text-secondary)}
    @media(max-width:560px){.standings-section.party-rank-polished{border-radius:22px;padding:13px}.party-rank-head__title{font-size:19px}.party-rank-head__quiz{width:100%}.party-rank-card{grid-template-columns:auto minmax(0,1fr);gap:9px}.party-rank-card__stats{grid-column:1 / -1;text-align:left;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.party-rank-help__grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

async function loadPoliticsData() {
  const callOverview = httpsCallable(functions, 'getPoliticsOverview');
  const callElection = httpsCallable(functions, 'getElection');
  const callPresident = httpsCallable(functions, 'getPresident');
  const callMyStatus = httpsCallable(functions, 'getMyStatus');
  const [overviewRes, electionRes, presidentRes, myStatusRes] = await Promise.all([
    callOverview().catch(() => null),
    callElection().catch(() => null),
    callPresident().catch(() => null),
    auth.currentUser ? callMyStatus().catch(() => null) : Promise.resolve(null),
  ]);
  return {
    overview: overviewRes?.data || {},
    election: electionRes?.data?.election || null,
    president: presidentRes?.data?.president || null,
    myStatus: myStatusRes?.data || null,
  };
}

function renderRanking(section, data) {
  const parties = Array.isArray(data.overview?.parties) ? data.overview.parties : [];
  if (!parties.length) return;
  const electionVotes = {};
  const electionTotal = Number(data.election?.totalVotes || 0);
  (data.election?.candidates || []).forEach(c => {
    if (c.partyId) electionVotes[c.partyId] = Number(c.votes || 0);
  });

  const maxPower = Math.max(...parties.map(p => Number(p.totalPower || 0)), 1);
  const myPartyId = data.overview?.me?.partyId || data.myStatus?.partyId || '';
  const presidentPartyId = data.president?.partyId || '';

  section.classList.add('party-rank-polished');
  section.innerHTML = `
    <div class="party-rank-head">
      <div>
        <div class="party-rank-head__eyebrow">PARTY POWER RANKING</div>
        <div class="party-rank-head__title">📊 정당 세력 순위</div>
        <div class="party-rank-head__desc">정치력·당원 수·대선 득표 흐름을 한눈에 보는 정당 판세입니다.</div>
      </div>
      <button class="party-rank-head__quiz" id="party-quiz-top-polished" type="button">🧭 내 정당 찾기</button>
    </div>
    <div class="party-rank-board">
      ${parties.map((p, index) => {
        const power = Number(p.totalPower || 0);
        const pct = Math.round((power / maxPower) * 100);
        const elecPct = electionTotal > 0 ? Math.round(((electionVotes[p.id] || 0) / electionTotal) * 100) : null;
        const isTop = index === 0 || p.rank === 1;
        const isMine = myPartyId === p.id;
        const isPrez = presidentPartyId === p.id;
        const badges = [
          isTop ? '<span class="party-rank-badge party-rank-badge--top">👑 제1당</span>' : '',
          isPrez ? '<span class="party-rank-badge party-rank-badge--prez">🏛️ 집권당</span>' : '',
          isMine ? '<span class="party-rank-badge party-rank-badge--mine">✅ 내 정당</span>' : '',
        ].filter(Boolean).join('');
        return `
          <article class="party-rank-card${isTop ? ' party-rank-card--top' : ''}${isMine ? ' party-rank-card--mine' : ''}" style="--pc:${esc(p.color || '#64748b')}">
            <div class="party-rank-card__rank">${medal(index + 1)}</div>
            <div class="party-rank-card__main">
              <div class="party-rank-card__name-row">
                <span class="party-rank-card__emoji">${esc(p.emoji || '🏛️')}</span>
                <span class="party-rank-card__name">${esc(p.name)}</span>
                <span class="party-rank-card__leader">👑 ${esc(p.leader?.nickname || p.leaderName || '당대표 공석')}</span>
              </div>
              ${badges ? `<div class="party-rank-card__badges">${badges}</div>` : ''}
              <div class="party-rank-card__bar"><div class="party-rank-card__fill" style="width:${Math.max(5, pct)}%"></div></div>
            </div>
            <div class="party-rank-card__stats">
              <div class="party-rank-card__power">${fmtNum(power)}P</div>
              <div class="party-rank-card__sub">세력 ${pct}%</div>
              <div class="party-rank-card__sub">🗳 ${elecPct !== null ? `${elecPct}% · ` : ''}${fmtNum(electionVotes[p.id] || 0)}표</div>
              <div class="party-rank-card__sub">👥 ${fmtNum(p.memberCount)}명</div>
            </div>
          </article>`;
      }).join('')}
    </div>`;

  section.querySelector('#party-quiz-top-polished')?.addEventListener('click', () => {
    document.getElementById('party-quiz-top')?.click();
  });
}

function renderMyRankHelp(data) {
  const status = data.myStatus;
  if (!status?.partyId) return;
  const mine = document.querySelector('.party-mine:not(.party-mine--guest):not(.party-mine--none)');
  if (!mine || document.getElementById('party-rank-help')) return;
  const pointsToLeader = Number(status.pointsToLeader || 0);
  const rankText = status.partyRank ? `당내 정치력 ${status.partyRank}위` : '당내 순위 집계중';
  const leaderText = status.isLeader ? '현재 당대표' : (pointsToLeader > 0 ? `${fmtNum(pointsToLeader)}P 필요` : '곧 당대표권');
  const help = document.createElement('div');
  help.id = 'party-rank-help';
  help.className = 'party-rank-help';
  help.innerHTML = `
    <div class="party-rank-help__title">📌 내 당내 위치</div>
    <div class="party-rank-help__grid">
      <div class="party-rank-help__item"><span>내 순위</span><b>${rankText}</b></div>
      <div class="party-rank-help__item"><span>당대표까지</span><b>${leaderText}</b></div>
      <div class="party-rank-help__item"><span>이번 주 상승</span><b>+${fmtNum(status.weeklyGain || 0)}P</b></div>
    </div>
    <div class="party-rank-help__note">AI 당원과 실제 회원을 모두 포함한 정치력 순위입니다. 글쓰기·댓글·투표·유세로 정치력을 올리면 당대표와 대선 후보에 가까워집니다.</div>`;
  mine.appendChild(help);
}

async function polishPartyRanking() {
  if (currentPath() !== '/parties') return;
  const section = document.querySelector('.standings-section');
  if (!section || section.dataset.rankPolishing === '1') return;
  section.dataset.rankPolishing = '1';
  ensureStyle();

  try {
    const data = await loadPoliticsData();
    renderRanking(section, data);
    renderMyRankHelp(data);
  } catch (error) {
    console.warn('[party-ranking-polish] failed', error);
    section.dataset.rankPolishing = '0';
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(polishPartyRanking, 160);
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
