// republic-detail-panel.js
// 공화국 메인에 오늘의 판세, 정당 모멘텀, 일일 행동을 동적으로 추가합니다.

import { auth, functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';

function currentPath() {
  const hashPath = (window.location.hash.slice(1) || '').split('?')[0];
  if (hashPath && hashPath !== '/') return hashPath;
  return window.location.pathname || '/';
}

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function fmt(n) {
  n = Number(n || 0);
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function call(name, payload = {}) {
  return httpsCallable(functions, name)(payload).then(res => res.data || {});
}

function ensureStyle() {
  if (document.getElementById('republic-detail-panel-style')) return;
  const style = document.createElement('style');
  style.id = 'republic-detail-panel-style';
  style.textContent = `
    .rep-detail-panel{margin:0 0 14px;border-radius:24px;overflow:hidden;background:linear-gradient(135deg,rgba(15,23,42,.98),rgba(30,41,59,.94));color:#fff;box-shadow:0 18px 42px rgba(15,23,42,.22);border:1px solid rgba(255,255,255,.08)}
    .rep-detail-panel__hero{padding:17px 17px 14px;display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}
    .rep-detail-panel__eyebrow{font-size:11px;font-weight:1000;letter-spacing:.08em;color:rgba(255,255,255,.58)}
    .rep-detail-panel__title{font-size:22px;font-weight:1000;margin-top:4px;color:#fff}
    .rep-detail-panel__sub{font-size:13px;line-height:1.55;color:rgba(255,255,255,.72);margin-top:4px}
    .rep-detail-panel__date{border-radius:999px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14);padding:8px 10px;font-size:12px;font-weight:900;color:#fff;white-space:nowrap}
    .rep-detail-grid{display:grid;grid-template-columns:1.08fr .92fr;gap:0;border-top:1px solid rgba(255,255,255,.08)}
    .rep-briefing{padding:15px 16px;border-right:1px solid rgba(255,255,255,.08)}
    .rep-briefing__title,.rep-momentum__title,.rep-actions__title{font-size:13px;font-weight:1000;color:rgba(255,255,255,.82);margin-bottom:10px}
    .rep-headline{border-radius:16px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.1);padding:11px 12px;margin-bottom:8px}
    .rep-headline__title{font-size:14px;font-weight:1000;color:#fff;display:flex;gap:7px;align-items:center}
    .rep-headline__body{font-size:12px;line-height:1.55;color:rgba(255,255,255,.7);margin-top:5px}
    .rep-momentum{padding:15px 16px}
    .rep-mrow{margin-bottom:11px}
    .rep-mrow__top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px}
    .rep-mrow__name{font-size:13px;font-weight:1000;color:#fff;display:flex;gap:6px;align-items:center}
    .rep-mrow__score{font-size:12px;font-weight:1000;color:rgba(255,255,255,.76)}
    .rep-mrow__track{height:8px;border-radius:999px;background:rgba(255,255,255,.12);overflow:hidden}
    .rep-mrow__fill{height:100%;border-radius:999px;width:0;transition:width .35s ease;background:var(--party-color,#ff6b4a)}
    .rep-mrow__meta{font-size:11px;color:rgba(255,255,255,.62);margin-top:5px;line-height:1.35}
    .rep-actions{padding:15px 16px;border-top:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.045)}
    .rep-action-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
    .rep-action{border:1px solid rgba(255,255,255,.12);border-radius:17px;background:rgba(255,255,255,.08);padding:12px;text-align:left;color:#fff;font-family:inherit;cursor:pointer;min-height:104px}
    .rep-action:hover{background:rgba(255,255,255,.13)}
    .rep-action__emoji{font-size:21px;display:block;margin-bottom:6px}
    .rep-action__title{font-size:13px;font-weight:1000;line-height:1.3;color:#fff}
    .rep-action__desc{font-size:11px;line-height:1.45;color:rgba(255,255,255,.66);margin-top:5px}
    .rep-action__reward{display:inline-flex;margin-top:8px;border-radius:999px;background:rgba(255,255,255,.12);padding:4px 7px;font-size:11px;font-weight:900;color:#fff}
    .rep-my-action{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;padding:10px 11px;border-radius:16px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);font-size:12px;color:rgba(255,255,255,.76)}
    .rep-my-action b{color:#fff}
    .rep-my-action button{border:0;border-radius:999px;background:var(--color-primary,#ff6b4a);color:#fff;font-weight:1000;font-family:inherit;cursor:pointer;padding:8px 10px}
    .rep-my-action button:disabled{opacity:.55;cursor:not-allowed}
    @media(max-width:720px){.rep-detail-grid{grid-template-columns:1fr}.rep-briefing{border-right:0;border-bottom:1px solid rgba(255,255,255,.08)}.rep-action-grid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:420px){.rep-action-grid{grid-template-columns:1fr}.rep-detail-panel__title{font-size:19px}}
  `;
  document.head.appendChild(style);
}

function renderHeadlines(headlines) {
  const list = Array.isArray(headlines) && headlines.length ? headlines : [
    { icon: '🏛️', title: '공화국 준비 중', body: '정당 활동 데이터가 쌓이면 오늘의 정국 브리핑이 표시됩니다.' },
  ];
  return list.slice(0, 3).map(h => `
    <div class="rep-headline">
      <div class="rep-headline__title"><span>${esc(h.icon || '📌')}</span><span>${esc(h.title)}</span></div>
      <div class="rep-headline__body">${esc(h.body)}</div>
    </div>`).join('');
}

function renderMomentum(momentum) {
  const rows = Array.isArray(momentum) ? momentum.slice(0, 3) : [];
  const maxScore = Math.max(1, ...rows.map(r => Number(r.score || 0)));
  if (!rows.length) return '<div class="rep-headline__body">판세 데이터가 아직 없습니다.</div>';
  return rows.map(r => {
    const pct = Math.max(8, Math.round((Number(r.score || 0) / maxScore) * 100));
    const meta = [
      `정치력 ${fmt(r.power)}P`,
      r.campaignCount ? `유세 ${r.campaignCount}` : '',
      r.electionVotes ? `대선 ${r.electionVotes}` : '',
      r.crisisVotes ? `위기 ${r.crisisVotes}` : '',
      r.congressVotes ? `국회 ${r.congressVotes}` : '',
    ].filter(Boolean).join(' · ');
    return `
      <div class="rep-mrow" style="--party-color:${esc(r.color || '#ff6b4a')}">
        <div class="rep-mrow__top">
          <div class="rep-mrow__name"><span>${esc(r.emoji)}</span><span>${esc(r.partyName)}</span></div>
          <div class="rep-mrow__score">${esc(r.trend)} · ${fmt(r.score)}점</div>
        </div>
        <div class="rep-mrow__track"><div class="rep-mrow__fill" style="width:${pct}%"></div></div>
        <div class="rep-mrow__meta">${esc(meta || r.agenda || '조직 정비 중')}</div>
      </div>`;
  }).join('');
}

function renderMyAction(status) {
  if (!status?.loggedIn) {
    return `<div class="rep-my-action"><b>정치 인생 시작</b><span>로그인하면 입당·유세·선거 보상이 기록됩니다.</span><button type="button" data-rdp-path="/login">로그인</button></div>`;
  }
  if (!status.partyId) {
    return `<div class="rep-my-action"><b>아직 무소속</b><span>정당에 입당하면 매일 유세로 정치력을 쌓을 수 있습니다.</span><button type="button" data-rdp-path="/parties">입당하기</button></div>`;
  }
  const done = Number(status.campaignsToday || 0);
  const limit = Number(status.campaignDailyLimit || 3);
  const disabled = done >= limit ? 'disabled' : '';
  return `<div class="rep-my-action">
    <b>${esc(status.partyEmoji || '')} ${esc(status.partyName || '내 정당')}</b>
    <span>오늘 유세 ${done}/${limit}회 · ${status.isLeader ? '당대표' : `당대표까지 ${fmt(status.pointsToLeader)}P`}</span>
    <button type="button" data-rdp-campaign="${esc(status.partyId)}" ${disabled}>📣 유세하기 +3P</button>
  </div>`;
}

function renderActions(agenda) {
  const list = Array.isArray(agenda) && agenda.length ? agenda : [];
  return list.slice(0, 4).map(item => `
    <button type="button" class="rep-action" data-rdp-path="${esc(item.path || '/republic')}">
      <span class="rep-action__emoji">${esc(item.emoji || '📌')}</span>
      <div class="rep-action__title">${esc(item.title)}</div>
      <div class="rep-action__desc">${esc(item.desc)}</div>
      ${item.reward ? `<span class="rep-action__reward">${esc(item.reward)}</span>` : ''}
    </button>`).join('');
}

async function loadPanel(panel) {
  const [activityRes, momentumRes, statusRes] = await Promise.allSettled([
    call('getPartyActivities'),
    call('getCampaignMomentum'),
    auth.currentUser ? call('getMyStatus') : Promise.resolve({ loggedIn: false }),
  ]);

  const activity = activityRes.value || {};
  const momentum = momentumRes.value || {};
  const status = statusRes.value || { loggedIn: false };
  const date = activity.date || momentum.date || '';
  const totals = momentum.totals || activity.totals || {};

  panel.innerHTML = `
    <div class="rep-detail-panel__hero">
      <div>
        <div class="rep-detail-panel__eyebrow">LIVE REPUBLIC BOARD</div>
        <div class="rep-detail-panel__title">📡 오늘의 정국 상황판</div>
        <div class="rep-detail-panel__sub">유세, 대선 투표, 위기 선택, 국회 표결이 정당 모멘텀으로 합산됩니다.</div>
      </div>
      <div class="rep-detail-panel__date">${esc(date || '오늘')} · 유세 ${fmt(totals.campaigns)} · 대선 ${fmt(totals.electionVotes)}</div>
    </div>
    <div class="rep-detail-grid">
      <div class="rep-briefing">
        <div class="rep-briefing__title">📰 국정 브리핑</div>
        ${renderHeadlines(activity.headlines || momentum.headlines)}
      </div>
      <div class="rep-momentum">
        <div class="rep-momentum__title">📊 정당 모멘텀</div>
        ${renderMomentum(momentum.momentum)}
      </div>
    </div>
    <div class="rep-actions">
      <div class="rep-actions__title">🎮 오늘 할 정치 행동</div>
      ${renderMyAction(status)}
      <div class="rep-action-grid">${renderActions(activity.dailyAgenda)}</div>
    </div>`;

  panel.querySelectorAll('[data-rdp-path]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.rdpPath || '/republic'));
  });

  panel.querySelectorAll('[data-rdp-campaign]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const partyId = btn.dataset.rdpCampaign;
      btn.disabled = true;
      const oldText = btn.textContent;
      btn.textContent = '유세 중…';
      try {
        const data = await call('campaignForParty', { partyId });
        toast.success(`📣 유세 완료! +${data.points || 3}P (${data.count}/${data.dailyLimit})`);
        panel.innerHTML = '<div class="rep-detail-panel__hero"><div><div class="rep-detail-panel__title">📡 판세 갱신 중…</div><div class="rep-detail-panel__sub">방금 유세한 결과를 반영하고 있습니다.</div></div></div>';
        await loadPanel(panel);
      } catch (error) {
        toast.error(error?.message || '유세에 실패했습니다.');
        btn.disabled = false;
        btn.textContent = oldText;
      }
    });
  });
}

function addRepublicDetailPanel() {
  if (currentPath() !== '/republic') return;
  if (document.getElementById('republic-detail-panel')) return;
  const content = document.querySelector('.rep-content') || document.querySelector('.page-section');
  if (!content) return;
  const firstSection = content.querySelector('.rep-section');
  if (!firstSection) return;

  ensureStyle();
  const panel = document.createElement('div');
  panel.id = 'republic-detail-panel';
  panel.className = 'rep-detail-panel';
  panel.innerHTML = '<div class="rep-detail-panel__hero"><div><div class="rep-detail-panel__title">📡 오늘의 정국 상황판</div><div class="rep-detail-panel__sub">판세 데이터를 불러오는 중입니다…</div></div></div>';
  firstSection.insertAdjacentElement('afterend', panel);
  loadPanel(panel).catch(error => {
    console.warn('[republic-detail-panel] failed', error);
    panel.innerHTML = '<div class="rep-detail-panel__hero"><div><div class="rep-detail-panel__title">⚠️ 정국 상황판을 불러오지 못했어요</div><div class="rep-detail-panel__sub">잠시 후 다시 시도해 주세요.</div></div></div>';
  });
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(addRepublicDetailPanel, 180);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('popstate', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
schedule();
