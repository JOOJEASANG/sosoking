/* republic.js — 소소킹 관심 분야 허브 */
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { toast } from '../components/toast.js';

function call(name, payload = {}) {
  return httpsCallable(functions, name)(payload).then(res => res.data || {}).catch(error => ({ error }));
}

function fmtNum(n) {
  n = Number(n || 0);
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function ensureStyle() {
  if (document.getElementById('republic-core-style')) return;
  const style = document.createElement('style');
  style.id = 'republic-core-style';
  style.textContent = `
    .rep-core{display:grid;gap:14px;padding-bottom:24px}.rep-core-hero{border-radius:28px;padding:24px 20px;background:linear-gradient(135deg,rgba(15,23,42,.97),rgba(47,125,110,.86));color:#fff;box-shadow:0 18px 42px rgba(15,23,42,.18)}.rep-core-hero__eyebrow{font-size:11px;font-weight:1000;letter-spacing:.1em;color:rgba(255,255,255,.62)}.rep-core-hero__title{font-size:28px;line-height:1.18;font-weight:1000;margin:7px 0;color:#fff}.rep-core-hero__desc{font-size:14px;line-height:1.6;color:rgba(255,255,255,.76);margin:0;max-width:760px}.rep-core-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}.rep-core-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.rep-core-card{border:1px solid rgba(100,116,139,.16);border-radius:22px;background:var(--color-surface,#fff);padding:15px;box-shadow:0 10px 26px rgba(15,23,42,.055)}.rep-core-card__title{font-size:16px;font-weight:1000;color:var(--color-text-primary);margin-bottom:6px}.rep-core-card__text{font-size:13px;line-height:1.55;color:var(--color-text-secondary);margin-bottom:12px}.rep-party-card{position:relative;overflow:hidden}.rep-party-card:before{content:'';position:absolute;inset:0 0 auto 0;height:5px;background:var(--party-color,#2f7d6e)}.rep-party-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-top:4px}.rep-party-name{font-size:17px;font-weight:1000;color:var(--color-text-primary)}.rep-party-meta{font-size:12px;color:var(--color-text-muted);margin-top:2px}.rep-party-badge{font-size:12px;font-weight:1000;color:var(--party-color,#2f7d6e);background:rgba(47,125,110,.10);border-radius:999px;padding:6px 8px;white-space:nowrap}.rep-party-leader{font-size:12px;color:var(--color-text-secondary);margin:10px 0}.rep-mine{display:inline-flex;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:1000;background:rgba(34,197,94,.1);color:#16a34a}.rep-core-status{display:grid;grid-template-columns:1fr 1fr;gap:12px}.rep-core-kv{display:flex;justify-content:space-between;gap:10px;border-radius:14px;background:rgba(248,250,252,.9);padding:10px 11px;font-size:13px}.rep-core-kv span{color:var(--color-text-muted)}.rep-core-kv b{color:var(--color-text-primary)}@media(max-width:880px){.rep-core-grid,.rep-core-status{grid-template-columns:1fr}.rep-core-hero__title{font-size:23px}}
  `;
  document.head.appendChild(style);
}

function renderHero(status) {
  const loggedIn = !!status?.loggedIn;
  const party = status?.partyName || '선택 안 함';
  return `<section class="rep-core-hero">
    <div class="rep-core-hero__eyebrow">INTEREST HUB</div>
    <div class="rep-core-hero__title">🏛️ 관심 분야를 고르고 자료를 읽으세요</div>
    <p class="rep-core-hero__desc">정치력과 포인트 보상은 화면에서 제거했습니다. 이 화면은 내가 어떤 관점의 자료와 댓글에 관심이 있는지 정리하는 보조 공간입니다.</p>
    <div class="rep-core-actions">
      <button class="btn btn--primary" data-go="/battle">📰 오늘자료</button>
      <button class="btn btn--ghost" data-go="/history">📚 역사자료</button>
      ${loggedIn ? `<span class="rep-mine">내 관심 분야 · ${escHtml(party)}</span>` : `<button class="btn btn--ghost" data-go="/login">로그인</button>`}
    </div>
  </section>`;
}

function renderStatus(status, election) {
  const joined = !!status?.partyId;
  const voteText = election?.election?.myVote ? '참여 완료' : '참여 가능';
  return `<section class="rep-core-card">
    <div class="rep-core-card__title">오늘 할 일</div>
    <div class="rep-core-status">
      <div class="rep-core-kv"><span>관심 분야</span><b>${joined ? '선택됨' : '선택 가능'}</b></div>
      <div class="rep-core-kv"><span>오늘자료</span><b>읽기</b></div>
      <div class="rep-core-kv"><span>댓글 참여</span><b>가능</b></div>
      <div class="rep-core-kv"><span>오늘 선택</span><b>${voteText}</b></div>
    </div>
  </section>`;
}

function renderParties(parties, status) {
  const myPartyId = status?.partyId || '';
  const cards = (parties || []).slice(0, 3).map(p => {
    const isMine = p.id === myPartyId;
    return `<section class="rep-core-card rep-party-card" style="--party-color:${escHtml(p.color || '#2f7d6e')}">
      <div class="rep-party-head">
        <div><div class="rep-party-name">${escHtml(p.emoji || '🏛️')} ${escHtml(p.name || '')}</div><div class="rep-party-meta">${escHtml(p.ideology || '')} · 참여자 ${fmtNum(p.memberCount || 0)}명</div></div>
        <div class="rep-party-badge">관심분야</div>
      </div>
      <div class="rep-party-leader">대표 관점 · ${escHtml(p.leader?.nickname || p.leaderName || '자료 해설')}</div>
      ${isMine ? '<span class="rep-mine">내 관심 분야</span>' : ''}
      <div class="rep-core-actions">
        ${isMine ? `<button class="btn btn--primary btn--sm" data-go="/battle">오늘자료 댓글 참여</button>` : `<button class="btn btn--ghost btn--sm" data-join="${escHtml(p.id)}">관심 분야 선택</button>`}
      </div>
    </section>`;
  }).join('');
  return `<div class="rep-core-grid">${cards}</div>`;
}

async function bindActions(el) {
  el.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.go)));
  el.querySelectorAll('[data-join]').forEach(btn => btn.addEventListener('click', async () => {
    if (!auth.currentUser) { navigate('/login'); return; }
    btn.disabled = true;
    const res = await call('joinParty', { partyId: btn.dataset.join });
    if (res?.error) toast.error('관심 분야 선택에 실패했습니다.');
    else toast.success('관심 분야가 저장됐습니다.');
    renderRepublic();
  }));
}

export async function renderRepublic() {
  setMeta('관심 분야');
  ensureStyle();
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<div class="rep-core"><div class="skeleton" style="height:190px;border-radius:28px"></div><div class="skeleton" style="height:340px;border-radius:22px"></div></div>`;

  const [overview, status, election] = await Promise.all([
    call('getPoliticsOverview'),
    call('getMyStatus'),
    call('getElection'),
  ]);

  const parties = Array.isArray(overview?.parties) ? overview.parties : [];
  el.innerHTML = `<div class="rep-core page-enter">
    ${renderHero(status)}
    ${renderStatus(status, election)}
    ${renderParties(parties, status)}
  </div>`;
  bindActions(el);
}
