import { functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

let timer = null;
let loading = false;
let observer = null;

function esc(value) {
  return String(value || '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}

function currentPath() {
  const hashPath = (window.location.hash.slice(1) || '').split('?')[0];
  if (hashPath && hashPath !== '/') return hashPath;
  return window.location.pathname || '/';
}

function scoreGrade(avg) {
  if (avg >= 85) return 'A+';
  if (avg >= 75) return 'A';
  if (avg >= 65) return 'B+';
  if (avg >= 55) return 'B';
  if (avg >= 45) return 'C';
  return 'D';
}

function approvalOf(president) {
  const approve = Number(president?.decreeApprove || 0);
  const disapprove = Number(president?.decreeDisapprove || 0);
  const total = approve + disapprove;
  if (total > 0) return Math.max(1, Math.min(99, Math.round((approve / total) * 100)));
  if (president?.candidateName) return 52;
  return 0;
}

function buildMetrics(president, parties) {
  const approval = approvalOf(president);
  const topPower = Number(parties?.[0]?.totalPower || 0);
  const secondPower = Number(parties?.[1]?.totalPower || 0);
  const competition = topPower > 0 ? Math.round(Math.min(30, (secondPower / topPower) * 30)) : 15;
  const base = president?.candidateName ? 50 : 42;
  const stability = Math.max(25, Math.min(95, base + Math.round(approval * 0.25) + (topPower > secondPower ? 8 : 0)));
  const economy = Math.max(30, Math.min(92, 56 + Math.round(approval * 0.18) + Math.round(competition * 0.2)));
  const welfare = Math.max(30, Math.min(92, 52 + Math.round(approval * 0.15) + (parties?.length ? 4 : 0)));
  const order = Math.max(30, Math.min(92, 58 + Math.round(stability * 0.18)));
  const media = Math.max(30, Math.min(92, 50 + Math.round(competition * 0.8)));
  const avg = Math.round((stability + economy + welfare + order + media) / 5);
  return { approval, stability, economy, welfare, order, media, grade: scoreGrade(avg) };
}

function partyRows(parties, rulingPartyId) {
  return (parties || []).slice(0, 3).map((p, idx) => {
    const role = p.id === rulingPartyId ? '여당' : idx === 0 ? '제1당' : '야당';
    return `<div class="republic-dashboard__party-row">
      <span>${idx + 1}</span>
      <b>${esc(p.emoji)} ${esc(p.name)}</b>
      <em>${role}</em>
    </div>`;
  }).join('');
}

function dashboardHtml({ president, overview, news }) {
  const parties = Array.isArray(overview?.parties) ? overview.parties : [];
  const rulingPartyId = president?.partyId || parties[0]?.id || '';
  const rulingParty = parties.find(p => p.id === rulingPartyId) || parties[0];
  const opposition = parties.find(p => p.id !== rulingPartyId);
  const metrics = buildMetrics(president, parties);
  const headline = news?.headline || '오늘의 정세가 곧 갱신됩니다';
  const presidentName = president?.candidateName || '공석';
  const presidentParty = president?.partyName || rulingParty?.name || '미정';

  return `<section id="republic-dashboard" class="republic-dashboard" style="margin:0 0 18px;padding:18px;border-radius:24px;background:linear-gradient(135deg,rgba(15,23,42,.96),rgba(30,41,59,.92));color:#fff;box-shadow:0 18px 40px rgba(15,23,42,.18);overflow:hidden;position:relative">
    <div style="position:absolute;inset:auto -40px -70px auto;width:180px;height:180px;border-radius:999px;background:rgba(255,255,255,.08)"></div>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;position:relative;z-index:1">
      <div>
        <div style="font-size:12px;font-weight:900;letter-spacing:.08em;color:rgba(255,255,255,.66)">SOSO REPUBLIC STATUS</div>
        <div style="font-size:24px;font-weight:1000;margin-top:4px">🏛️ 소소공화국 국가 현황</div>
        <div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:4px">${esc(headline)}</div>
      </div>
      <div style="min-width:96px;text-align:center;padding:10px 12px;border-radius:18px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.14)">
        <div style="font-size:11px;color:rgba(255,255,255,.64);font-weight:800">국가등급</div>
        <div style="font-size:30px;font-weight:1000;line-height:1.1">${metrics.grade}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin-top:16px;position:relative;z-index:1">
      <div class="republic-dashboard__tile"><span>대통령</span><b>${esc(presidentName)}</b><small>${esc(presidentParty)}</small></div>
      <div class="republic-dashboard__tile"><span>대통령 지지율</span><b>${metrics.approval ? `${metrics.approval}%` : '대기중'}</b><small>${metrics.approval < 30 && metrics.approval ? '탄핵 위험권' : '국정 평가 반영'}</small></div>
      <div class="republic-dashboard__tile"><span>여당</span><b>${esc(rulingParty?.emoji)} ${esc(rulingParty?.name || '미정')}</b><small>${esc(rulingParty?.leader?.nickname || '당대표 집계중')}</small></div>
      <div class="republic-dashboard__tile"><span>제1야당</span><b>${esc(opposition?.emoji)} ${esc(opposition?.name || '미정')}</b><small>견제 세력</small></div>
    </div>

    <div style="display:grid;grid-template-columns:1.15fr .85fr;gap:12px;margin-top:12px;position:relative;z-index:1" class="republic-dashboard__lower">
      <div class="republic-dashboard__metrics">
        ${metricBar('국정 안정도', metrics.stability)}
        ${metricBar('경제 체감도', metrics.economy)}
        ${metricBar('복지 만족도', metrics.welfare)}
        ${metricBar('치안 질서', metrics.order)}
        ${metricBar('언론 신뢰도', metrics.media)}
      </div>
      <div class="republic-dashboard__parties">
        <div style="font-size:12px;font-weight:900;color:rgba(255,255,255,.65);margin-bottom:8px">정당 판세</div>
        ${partyRows(parties, rulingPartyId) || '<div style="font-size:13px;color:rgba(255,255,255,.7)">정당 집계 대기중</div>'}
      </div>
    </div>
  </section>`;
}

function metricBar(label, value) {
  return `<div style="display:grid;grid-template-columns:82px 1fr 38px;gap:8px;align-items:center;margin:8px 0">
    <span style="font-size:12px;color:rgba(255,255,255,.72);font-weight:800">${label}</span>
    <span style="height:8px;border-radius:999px;background:rgba(255,255,255,.14);overflow:hidden"><i style="display:block;width:${value}%;height:100%;border-radius:999px;background:rgba(255,255,255,.82)"></i></span>
    <b style="font-size:12px;text-align:right">${value}</b>
  </div>`;
}

function injectStyles() {
  if (document.getElementById('republic-dashboard-style')) return;
  const style = document.createElement('style');
  style.id = 'republic-dashboard-style';
  style.textContent = `
    .republic-dashboard__tile{padding:12px;border-radius:16px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.13)}
    .republic-dashboard__tile span{display:block;font-size:11px;font-weight:900;color:rgba(255,255,255,.62);margin-bottom:4px}
    .republic-dashboard__tile b{display:block;font-size:16px;font-weight:1000;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .republic-dashboard__tile small{display:block;font-size:11px;color:rgba(255,255,255,.62);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .republic-dashboard__metrics,.republic-dashboard__parties{padding:12px;border-radius:18px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.12)}
    .republic-dashboard__party-row{display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:center;padding:7px 0;border-top:1px solid rgba(255,255,255,.09)}
    .republic-dashboard__party-row:first-of-type{border-top:0}
    .republic-dashboard__party-row span{font-size:12px;color:rgba(255,255,255,.55);font-weight:900}
    .republic-dashboard__party-row b{font-size:13px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .republic-dashboard__party-row em{font-style:normal;font-size:11px;color:rgba(255,255,255,.68);font-weight:900}
    @media(max-width:680px){.republic-dashboard__lower{grid-template-columns:1fr!important}.republic-dashboard{border-radius:20px!important}}
  `;
  document.head.appendChild(style);
}

async function loadData() {
  const [presidentRes, overviewRes, newsRes] = await Promise.allSettled([
    httpsCallable(functions, 'getPresident')({}),
    httpsCallable(functions, 'getPoliticsOverview')({}),
    httpsCallable(functions, 'getDailyNews')({}),
  ]);
  return {
    president: presidentRes.value?.data?.president || null,
    overview: overviewRes.value?.data || null,
    news: newsRes.value?.data || null,
  };
}

async function injectDashboard() {
  if (currentPath() !== '/' || loading || document.getElementById('republic-dashboard')) return;
  const page = document.getElementById('page-content');
  if (!page || !page.children.length) return;
  loading = true;
  try {
    injectStyles();
    const data = await loadData();
    if (document.getElementById('republic-dashboard') || currentPath() !== '/') return;
    const wrap = document.createElement('div');
    wrap.innerHTML = dashboardHtml(data);
    page.insertBefore(wrap.firstElementChild, page.firstElementChild);
  } catch (err) {
    console.warn('[republic-dashboard]', err);
  } finally {
    loading = false;
  }
}

function schedule(delay = 400) {
  clearTimeout(timer);
  timer = setTimeout(injectDashboard, delay);
}

function observe() {
  if (observer) return;
  const root = document.getElementById('page-content') || document.body;
  observer = new MutationObserver(() => {
    if (currentPath() === '/' && !document.getElementById('republic-dashboard')) schedule(160);
  });
  observer.observe(root, { childList: true, subtree: true });
}

window.addEventListener('hashchange', () => schedule(250));
window.addEventListener('popstate', () => schedule(250));
window.addEventListener('sosoking:extensions-ready', () => schedule(250));
observe();
schedule(250);
