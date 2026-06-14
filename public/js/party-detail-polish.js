// party-detail-polish.js
// 정당 상세 정보 · 입당 영역이 속성 따옴표 문제로 텍스트처럼 보이는 경우 카드형 UI로 다시 렌더링합니다.

import { auth, functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';

const PARTY_META = {
  national: {
    strengths: ['안정', '경험', '절차'],
    policy: '검증된 정책만 신중하게 — 흔들림 없는 안정',
    perk: '🎖️ 경력직 배지',
  },
  youth: {
    strengths: ['변화', '개혁', 'MZ파워'],
    policy: '기득권 타파, 청년 우선 — 갈아엎자',
    perk: '🔥 혁명가 배지',
  },
  center: {
    strengths: ['데이터', '중도', '합리'],
    policy: '여론·통계 기반 합리 정치 — 숫자가 곧 민심',
    perk: '📈 분석가 배지',
  },
};

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

function medal(rank) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
}

function ensureStyle() {
  if (document.getElementById('party-detail-polish-style')) return;
  const style = document.createElement('style');
  style.id = 'party-detail-polish-style';
  style.textContent = `
    .parties-detail-title.party-detail-polished-title{margin:18px 0 10px;padding-left:10px;border-left:4px solid var(--color-primary);font-size:16px;font-weight:1000;color:var(--color-text-primary);letter-spacing:-.02em}
    .parties-list.party-detail-polished-list{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px!important;margin-bottom:22px!important}
    .party-detail-card{position:relative;overflow:hidden;border-radius:24px;background:linear-gradient(180deg,#fff,rgba(248,250,252,.96));border:1px solid rgba(100,116,139,.14);box-shadow:0 14px 30px rgba(15,23,42,.08);padding:15px;--pc:#64748b}
    .party-detail-card:before{content:"";position:absolute;left:0;top:0;right:0;height:5px;background:var(--pc)}
    .party-detail-card--mine{outline:2px solid rgba(34,197,94,.18);background:linear-gradient(180deg,#fff,rgba(240,253,244,.72))}
    .party-detail-card--top{box-shadow:0 16px 34px rgba(255,107,74,.12)}
    .party-detail-card__badges{display:flex;gap:5px;flex-wrap:wrap;margin:2px 0 10px}
    .party-detail-badge{border-radius:999px;padding:5px 8px;font-size:10px;font-weight:1000;background:rgba(15,23,42,.06);color:var(--color-text-secondary)}
    .party-detail-badge--top{background:rgba(255,193,7,.18);color:#8a5b00}
    .party-detail-badge--prez{background:rgba(59,130,246,.14);color:#1d4ed8}
    .party-detail-badge--mine{background:rgba(34,197,94,.14);color:#15803d}
    .party-detail-card__head{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;margin-bottom:10px}
    .party-detail-card__medal{width:42px;height:42px;border-radius:16px;background:rgba(15,23,42,.06);display:grid;place-items:center;font-size:21px;font-weight:1000}
    .party-detail-card__name-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}
    .party-detail-card__emoji{font-size:22px;line-height:1}
    .party-detail-card__name{font-size:17px;font-weight:1000;color:var(--color-text-primary);letter-spacing:-.03em}
    .party-detail-card__slogan{font-size:12px;line-height:1.45;color:var(--color-text-secondary);margin-top:3px}
    .party-detail-card__chips{display:flex;gap:5px;flex-wrap:wrap;margin:9px 0}
    .party-detail-chip{border-radius:999px;background:rgba(15,23,42,.055);padding:5px 8px;font-size:11px;font-weight:900;color:var(--color-text-secondary)}
    .party-detail-card__policy{border-radius:16px;background:rgba(255,107,74,.08);border:1px solid rgba(255,107,74,.13);padding:10px;font-size:12px;line-height:1.45;color:var(--color-text-primary);font-weight:800;margin-bottom:10px}
    .party-detail-card__leader{font-size:12px;line-height:1.45;color:var(--color-text-secondary);margin-bottom:10px}
    .party-detail-card__leader b{color:var(--color-text-primary)}
    .party-detail-card__stats{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-bottom:12px}
    .party-detail-stat{border-radius:15px;background:#fff;border:1px solid rgba(100,116,139,.12);padding:9px;text-align:left}
    .party-detail-stat span{display:block;font-size:10px;font-weight:900;color:var(--color-text-secondary);margin-bottom:3px}
    .party-detail-stat b{display:block;font-size:14px;font-weight:1000;color:var(--color-text-primary)}
    .party-detail-card__footer{display:grid;gap:8px;margin-top:8px}
    .party-detail-card__note{font-size:11px;line-height:1.45;color:var(--color-text-secondary)}
    .party-detail-join{border:0;border-radius:16px;padding:12px 14px;background:var(--pc);color:#fff;font-size:13px;font-weight:1000;font-family:inherit;cursor:pointer;box-shadow:0 10px 20px rgba(15,23,42,.12)}
    .party-detail-join--mine{background:rgba(34,197,94,.14);color:#15803d;box-shadow:none;cursor:default}
    .party-detail-join:disabled{opacity:.65;cursor:not-allowed}
    .party-detail-card__perk{font-size:11px;color:var(--color-text-secondary);font-weight:900}
    @media(max-width:900px){.parties-list.party-detail-polished-list{grid-template-columns:1fr!important}.party-detail-card{border-radius:22px}.party-detail-card__stats{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:420px){.party-detail-card__stats{grid-template-columns:1fr}.party-detail-card__name{font-size:16px}}
  `;
  document.head.appendChild(style);
}

async function loadData() {
  const callOverview = httpsCallable(functions, 'getPoliticsOverview');
  const callPresident = httpsCallable(functions, 'getPresident');
  const callElection = httpsCallable(functions, 'getElection');
  const callHistory = httpsCallable(functions, 'getElectionHistory');
  const callMomentum = httpsCallable(functions, 'getCampaignMomentum');
  const [overviewRes, presidentRes, electionRes, historyRes, momentumRes] = await Promise.all([
    callOverview(),
    callPresident().catch(() => null),
    callElection().catch(() => null),
    callHistory().catch(() => null),
    callMomentum().catch(() => null),
  ]);
  return {
    parties: overviewRes?.data?.parties || [],
    me: overviewRes?.data?.me || null,
    president: presidentRes?.data?.president || null,
    election: electionRes?.data?.election || null,
    history: historyRes?.data?.history || [],
    momentum: momentumRes?.data || {},
  };
}

function leaderLine(p) {
  if (p.leader && Number(p.leader.power || 0) > 0) {
    return `현 당대표 <b>${esc(p.leader.nickname)}</b> · 정치력 ${fmtNum(p.leader.power)}P`;
  }
  return '당대표 공석 — 입당 후 활동 1위가 당대표입니다.';
}

function renderCard(p, index, data) {
  const meta = PARTY_META[p.id] || {};
  const isMine = data.me?.partyId === p.id;
  const isTop = index === 0 || p.rank === 1;
  const isPrez = data.president?.partyId === p.id;
  const electionTotal = Number(data.election?.totalVotes || 0);
  const candidate = (data.election?.candidates || []).find(c => c.partyId === p.id);
  const elecVotes = Number(candidate?.votes || 0);
  const elecPct = electionTotal > 0 ? Math.round((elecVotes / electionTotal) * 100) : null;
  const wins = (data.history || []).filter(h => !h.seeded && h.winner?.partyId === p.id).length;
  const campaign = (data.momentum?.byParty || []).find(c => c.partyId === p.id)?.count || 0;
  const badges = [
    isTop ? '<span class="party-detail-badge party-detail-badge--top">👑 제1당</span>' : '',
    isPrez ? '<span class="party-detail-badge party-detail-badge--prez">🏛️ 집권당</span>' : '',
    isMine ? '<span class="party-detail-badge party-detail-badge--mine">✅ 내 정당</span>' : '',
  ].filter(Boolean).join('');
  const joinHTML = isMine
    ? '<button type="button" class="party-detail-join party-detail-join--mine" disabled>가입 완료 · 내 정당</button>'
    : `<button type="button" class="party-detail-join" data-party-join="${esc(p.id)}" data-party-name="${esc(p.name)}">${data.me?.partyId ? '이 정당으로 이적' : '입당하기'}</button>`;

  return `
    <article class="party-detail-card${isMine ? ' party-detail-card--mine' : ''}${isTop ? ' party-detail-card--top' : ''}" style="--pc:${esc(p.color || '#64748b')}">
      ${badges ? `<div class="party-detail-card__badges">${badges}</div>` : ''}
      <div class="party-detail-card__head">
        <div class="party-detail-card__medal">${medal(index + 1)}</div>
        <div>
          <div class="party-detail-card__name-row">
            <span class="party-detail-card__emoji">${esc(p.emoji || '🏛️')}</span>
            <span class="party-detail-card__name">${esc(p.name)}</span>
          </div>
          <div class="party-detail-card__slogan">“${esc(p.slogan || '')}”</div>
        </div>
      </div>
      ${meta.strengths ? `<div class="party-detail-card__chips">${meta.strengths.map(s => `<span class="party-detail-chip">#${esc(s)}</span>`).join('')}</div>` : ''}
      ${meta.policy ? `<div class="party-detail-card__policy">📌 ${esc(meta.policy)}</div>` : ''}
      <div class="party-detail-card__leader">${leaderLine(p)}</div>
      <div class="party-detail-card__stats">
        <div class="party-detail-stat"><span>정치력</span><b>⚡ ${fmtNum(p.totalPower)}P</b></div>
        <div class="party-detail-stat"><span>당원</span><b>👥 ${fmtNum(p.memberCount)}명</b></div>
        <div class="party-detail-stat"><span>득표율</span><b>🗳️ ${elecPct !== null ? `${elecPct}%` : '집계 전'}</b></div>
        <div class="party-detail-stat"><span>오늘 유세</span><b>🎤 ${fmtNum(campaign)}회</b></div>
        ${wins > 0 ? `<div class="party-detail-stat"><span>역대 집권</span><b>🏆 ${wins}회</b></div>` : ''}
      </div>
      <div class="party-detail-card__footer">
        ${joinHTML}
        <div class="party-detail-card__note">입당 후 글쓰기·댓글·투표로 정치력을 올리면 당내 순위가 오르고, 1위가 되면 당대표·대선 후보가 됩니다.</div>
        ${meta.perk ? `<div class="party-detail-card__perk">입당 콘셉트: ${esc(meta.perk)}</div>` : ''}
      </div>
    </article>`;
}

async function rerenderPartyDetails() {
  if (currentPath() !== '/parties') return;
  const title = document.querySelector('.parties-detail-title');
  const list = document.querySelector('.parties-list');
  if (!title || !list || list.dataset.partyDetailPolishing === '1') return;
  list.dataset.partyDetailPolishing = '1';
  ensureStyle();

  try {
    const data = await loadData();
    if (!data.parties.length) {
      list.dataset.partyDetailPolishing = '0';
      return;
    }
    title.classList.add('party-detail-polished-title');
    title.textContent = '정당 상세 정보 · 입당';
    list.classList.add('party-detail-polished-list');
    list.innerHTML = data.parties.map((p, i) => renderCard(p, i, data)).join('');

    list.querySelectorAll('[data-party-join]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!auth.currentUser) {
          navigate('/login');
          return;
        }
        const partyId = btn.dataset.partyJoin;
        const partyName = btn.dataset.partyName || '정당';
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = '입당 처리 중…';
        try {
          await httpsCallable(functions, 'joinParty')({ partyId });
          toast.success(`${partyName} 입당 완료!`);
          list.dataset.partyDetailPolishing = '0';
          setTimeout(rerenderPartyDetails, 250);
        } catch (error) {
          toast.error(error?.message || '입당에 실패했습니다.');
          btn.disabled = false;
          btn.textContent = original;
        }
      });
    });
  } catch (error) {
    console.warn('[party-detail-polish] failed', error);
    list.dataset.partyDetailPolishing = '0';
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(rerenderPartyDetails, 180);
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
