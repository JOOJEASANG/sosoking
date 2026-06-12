import { auth, functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';

let pendingTimer = null;
let observer = null;
let loading = false;

function fmtNum(n) {
  n = Number(n || 0);
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function esc(value) {
  return String(value || '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}

function currentPath() {
  const hashPath = (window.location.hash.slice(1) || '').split('?')[0];
  if (hashPath && hashPath !== '/') return hashPath;
  return window.location.pathname || '/';
}

function cardHtml(data) {
  const winner = data.winner || {};
  const standings = Array.isArray(data.standings) ? data.standings.slice(0, 3) : [];
  const loggedIn = !!auth.currentUser;
  const canClaim = loggedIn && data.eligible && !data.claimed;
  const status = !loggedIn
    ? '로그인하면 소속 정당 보상 여부를 확인할 수 있어요.'
    : data.claimed
      ? '이번 주 보상을 이미 받았습니다.'
      : data.eligible
        ? `이번 주 1위 정당 소속입니다. +${data.reward || 30}P를 받을 수 있어요.`
        : '이번 주 1위 정당 소속만 보상을 받을 수 있어요.';

  return `
    <section class="party-war-card" id="party-war-card" style="margin:16px 0;padding:18px;border-radius:20px;background:linear-gradient(135deg,rgba(255,214,102,.18),rgba(255,255,255,.7));border:1px solid var(--color-border);box-shadow:0 8px 24px rgba(15,23,42,.06)">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <div style="font-size:13px;font-weight:900;color:var(--color-text-muted);margin-bottom:4px">🏆 주간 정당전</div>
          <div style="font-size:20px;font-weight:1000;color:var(--color-text-primary)">${esc(winner.emoji)} ${esc(winner.name || '집계 중')} 선두</div>
          <div style="font-size:13px;color:var(--color-text-secondary);margin-top:4px">${esc(status)}</div>
        </div>
        <button id="party-war-claim" class="btn btn--primary btn--sm" ${canClaim ? '' : 'disabled'}>${data.claimed ? '수령 완료' : `보상 받기 +${data.reward || 30}P`}</button>
      </div>
      ${standings.length ? `
        <div style="display:grid;gap:8px;margin-top:14px">
          ${standings.map(p => `
            <div style="display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.65)">
              <span style="width:30px;font-weight:900">${p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : '🥉'}</span>
              <span style="font-size:18px">${esc(p.emoji)}</span>
              <span style="font-weight:900;flex:1">${esc(p.name)}</span>
              <span style="font-weight:900;color:var(--color-text-secondary)">${fmtNum(p.totalPower)}P</span>
            </div>`).join('')}
        </div>` : ''}
    </section>`;
}

function bindClaimButton(holder, data) {
  holder.querySelector('#party-war-claim')?.addEventListener('click', async e => {
    if (!auth.currentUser) { navigate('/login'); return; }
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = '수령 중…';
    try {
      const res = await httpsCallable(functions, 'claimWeeklyPartyWarReward')({});
      if (res.data?.awarded) toast.success(`주간 정당전 보상 +${res.data.points || 30}P`);
      else toast.info?.('이미 수령했어요');
      holder.remove();
      scheduleInject(200);
    } catch (err) {
      toast.error(err?.message || '보상 수령 실패');
      btn.disabled = false;
      btn.textContent = `보상 받기 +${data.reward || 30}P`;
    }
  });
}

async function injectPartyWarCard() {
  if (currentPath() !== '/parties' || loading || document.getElementById('party-war-card')) return;
  const page = document.querySelector('.parties-page');
  const anchor = page?.querySelector('.parties-standings-title');
  if (!page || !anchor) return;

  loading = true;
  const holder = document.createElement('div');
  holder.id = 'party-war-card-holder';
  holder.innerHTML = `<section class="party-war-card" id="party-war-card" style="margin:16px 0;padding:18px;border-radius:20px;border:1px solid var(--color-border)">🏆 주간 정당전 불러오는 중…</section>`;
  anchor.parentNode.insertBefore(holder, anchor);

  try {
    const { data } = await httpsCallable(functions, 'getWeeklyPartyWar')({});
    holder.innerHTML = cardHtml(data || {});
    bindClaimButton(holder, data || {});
  } catch (err) {
    console.warn('[party-war-ui]', err);
    holder.remove();
  } finally {
    loading = false;
  }
}

function scheduleInject(delay = 500) {
  clearTimeout(pendingTimer);
  pendingTimer = setTimeout(injectPartyWarCard, delay);
}

function observePageChanges() {
  if (observer) return;
  const root = document.getElementById('page-content') || document.body;
  observer = new MutationObserver(() => {
    if (currentPath() === '/parties') scheduleInject(150);
  });
  observer.observe(root, { childList: true, subtree: true });
}

window.addEventListener('hashchange', () => scheduleInject(250));
window.addEventListener('popstate', () => scheduleInject(250));
window.addEventListener('sosoking:extensions-ready', () => scheduleInject(250));
observePageChanges();
scheduleInject(250);
