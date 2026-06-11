/* parties.js — 소소공화국 정당: 입당·정당 순위·당대표 */
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { toast } from '../components/toast.js';

function fmtNum(n) {
  n = Number(n || 0);
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function medal(rank) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
}

function leaderLine(p) {
  if (p.leader && p.leader.power > 0) {
    return `현 당대표 <b>${escHtml(p.leader.nickname)}</b> · 정치력 ${fmtNum(p.leader.power)}`;
  }
  return `당대표 공석 — 입당 후 활동 1위가 당대표!`;
}

function renderMyBanner(me) {
  if (!auth.currentUser) {
    return `<div class="party-mine party-mine--guest">
      <div class="party-mine__title">🏛️ 소소공화국 정당</div>
      <div class="party-mine__desc">로그인하고 정당에 입당하면 활동이 곧 정치력이 됩니다.</div>
      <button class="btn btn--primary btn--sm" id="party-login">로그인하고 입당하기</button>
    </div>`;
  }
  if (me && me.partyId) {
    return `<div class="party-mine">
      <div class="party-mine__label">내 소속 정당</div>
      <div class="party-mine__name">${escHtml(me.partyName)}</div>
      <div class="party-mine__power">내 정치력 <b>${fmtNum(me.power)}</b></div>
      <div class="party-mine__hint">글·댓글·투표로 활동할수록 정치력이 오르고, 당내 1위가 당대표가 됩니다.</div>
    </div>`;
  }
  return `<div class="party-mine party-mine--none">
    <div class="party-mine__title">아직 소속 정당이 없어요</div>
    <div class="party-mine__desc">7개 정당 중 하나를 골라 입당하세요. 내 활동 ${me ? `(정치력 ${fmtNum(me.power)})` : ''}이 그대로 정당의 힘이 됩니다.</div>
  </div>`;
}

function renderPartyCard(p, me) {
  const isMine = me && me.partyId === p.id;
  const btn = isMine
    ? `<span class="party-card__mine-tag">내 정당</span>`
    : `<button class="btn btn--primary btn--sm party-join-btn" data-party="${p.id}" data-name="${escHtml(p.name)}">${me && me.partyId ? '이 당으로 이적' : '입당'}</button>`;
  return `
    <div class="party-card${isMine ? ' party-card--mine' : ''}" style="--party-color:${p.color}">
      <div class="party-card__rank">${medal(p.rank)}</div>
      <div class="party-card__emoji">${p.emoji}</div>
      <div class="party-card__body">
        <div class="party-card__top">
          <span class="party-card__name">${escHtml(p.name)}</span>
          <span class="party-card__count">당원 ${fmtNum(p.memberCount)}</span>
        </div>
        <div class="party-card__slogan">“${escHtml(p.slogan)}”</div>
        <div class="party-card__leader">${leaderLine(p)}</div>
        <div class="party-card__meta">
          <span class="party-card__power">⚡ 정당 정치력 <b>${fmtNum(p.totalPower)}</b></span>
          <button class="party-members-btn" data-party="${p.id}">당원 보기</button>
        </div>
      </div>
      <div class="party-card__action">${btn}</div>
    </div>
    <div class="party-members" id="members-${p.id}" hidden></div>`;
}

async function loadMembers(partyId, host) {
  host.innerHTML = `<div class="party-members__loading">불러오는 중…</div>`;
  try {
    const call = httpsCallable(functions, 'getPartyMembers');
    const { data } = await call({ partyId });
    const members = data.members || [];
    if (!members.length) {
      host.innerHTML = `<div class="party-members__empty">아직 당원이 없어요. 첫 당원이 되어보세요!</div>`;
      return;
    }
    host.innerHTML = members.map(m => `
      <div class="party-member${m.rank === 1 ? ' party-member--leader' : ''}">
        <span class="party-member__rank">${m.rank === 1 ? '👑' : m.rank}</span>
        <span class="party-member__name">${escHtml(m.nickname)}${m.rank === 1 ? ' <span class="party-member__badge">당대표</span>' : ''}</span>
        <span class="party-member__power">${fmtNum(m.power)}</span>
      </div>`).join('');
  } catch (e) {
    host.innerHTML = `<div class="party-members__empty">당원 목록을 불러오지 못했어요.</div>`;
  }
}

export async function renderParties() {
  setMeta('소소공화국 정당');
  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `<div class="parties-page page-enter">
    <div class="skeleton" style="height:120px;border-radius:16px;margin-bottom:12px"></div>
    <div class="skeleton" style="height:320px;border-radius:16px"></div>
  </div>`;

  let overview;
  try {
    const call = httpsCallable(functions, 'getPoliticsOverview');
    const { data } = await call();
    overview = data;
  } catch (err) {
    console.error('[parties] load error', err);
    el.innerHTML = `<div class="empty-state">
      <div class="empty-state__icon">⚠️</div>
      <div class="empty-state__title">정당 현황을 불러오지 못했어요</div>
      <button class="btn btn--primary" style="margin-top:16px" id="party-retry">다시 시도</button>
    </div>`;
    el.querySelector('#party-retry')?.addEventListener('click', renderParties);
    return;
  }

  const { parties = [], me = null } = overview;

  el.innerHTML = `<div class="parties-page page-enter">
    <div class="parties-hero">
      <div class="parties-hero__badge">🏛️ 소소공화국</div>
      <h1 class="parties-hero__title">정당 정치 1번지</h1>
      <p class="parties-hero__sub">입당하고 활동하면 정치력이 쌓입니다. 당내 1위는 당대표, 정치력 최강 정당이 제1당!</p>
    </div>
    ${renderMyBanner(me)}
    <div class="parties-standings-title">📊 정당 순위 <span>정치력 기준</span></div>
    <div class="parties-list">
      ${parties.map(p => renderPartyCard(p, me)).join('')}
    </div>
  </div>`;

  el.querySelector('#party-login')?.addEventListener('click', () => navigate('/login'));

  el.querySelectorAll('.party-members-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.party;
      const host = el.querySelector(`#members-${pid}`);
      if (!host) return;
      if (host.hidden) {
        host.hidden = false;
        btn.textContent = '닫기';
        loadMembers(pid, host);
      } else {
        host.hidden = true;
        btn.textContent = '당원 보기';
      }
    });
  });

  el.querySelectorAll('.party-join-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!auth.currentUser) { navigate('/login'); return; }
      const partyId = btn.dataset.party;
      const name = btn.dataset.name;
      if (me && me.partyId && !confirm(`현재 정당을 탈당하고 '${name}'으로 이적할까요?`)) return;
      btn.disabled = true;
      btn.textContent = '처리 중…';
      try {
        const call = httpsCallable(functions, 'joinParty');
        await call({ partyId });
        toast.success(`${name}에 입당했어요! 🎉`);
        renderParties();
      } catch (e) {
        toast.error(e?.message || '입당에 실패했어요.');
        btn.disabled = false;
        btn.textContent = '입당';
      }
    });
  });
}
