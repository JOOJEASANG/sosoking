/* forces.js — 외부세력 루트 */
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { toast } from '../components/toast.js';

const FALLBACK_FORCES = [
  { id: 'investigation', name: '특별수사청', emoji: '🕵️', color: '#334155', role: '수사·권력 감시', routeName: '수사권력 루트', agenda: '부패 수사, 권력기관 개혁, 정치권 압박', strength: '정치권을 압박하고 비리 프레임을 만들 수 있습니다.', memberCount: 0, totalInfluence: 0 },
  { id: 'police', name: '치안안전청', emoji: '🚓', color: '#1D4ED8', role: '치안·집회 관리', routeName: '치안권력 루트', agenda: '민생 안전, 집회 대응, 질서 유지', strength: '사회 불안 이슈에서 여론과 안정성에 영향을 줍니다.', memberCount: 0, totalInfluence: 0 },
  { id: 'business', name: '재계연합', emoji: '🏢', color: '#B45309', role: '경제·투자 압력', routeName: '경제권력 루트', agenda: '투자, 고용, 규제 완화, 성장 프레임', strength: '경제 위기와 성장 이슈에서 정당과 대통령을 움직입니다.', memberCount: 0, totalInfluence: 0 },
  { id: 'media', name: '전국언론연합', emoji: '📰', color: '#7C3AED', role: '여론·프레임 형성', routeName: '여론권력 루트', agenda: '보도 프레임, 지지율, 의혹 제기, 여론전', strength: '대선 판세와 정당 이미지에 강한 영향을 줍니다.', memberCount: 0, totalInfluence: 0 },
  { id: 'civic', name: '시민연대', emoji: '✊', color: '#059669', role: '개혁·시민권 요구', routeName: '시민운동 루트', agenda: '개혁 요구, 복지, 인권, 시민 참여', strength: '개혁 이슈와 광장 여론을 움직입니다.', memberCount: 0, totalInfluence: 0 },
  { id: 'bureaucracy', name: '행정관료단', emoji: '🏛️', color: '#475569', role: '예산·정책 집행', routeName: '관료권력 루트', agenda: '정책 집행, 예산 배분, 행정 저항, 실무 통제', strength: '대통령 공약이 실제로 실행되는 속도에 영향을 줍니다.', memberCount: 0, totalInfluence: 0 },
];

function call(name, payload = {}) {
  return httpsCallable(functions, name)(payload).then(res => res.data || {}).catch(error => ({ error }));
}

function fmtNum(n) {
  n = Number(n || 0);
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function localForceId() {
  try { return localStorage.getItem('sosoking.externalForceId') || ''; } catch { return ''; }
}
function setLocalForceId(id) {
  try { if (id) localStorage.setItem('sosoking.externalForceId', id); else localStorage.removeItem('sosoking.externalForceId'); } catch {}
}
function normalizeOverview(overview) {
  const forces = Array.isArray(overview?.forces) && overview.forces.length ? overview.forces : FALLBACK_FORCES;
  const localId = localForceId();
  const localForce = forces.find(f => f.id === localId);
  const me = overview?.me || (localForce ? { forceId: localForce.id, forceName: localForce.name, influence: 0 } : null);
  return { ok: !!overview?.ok, forces, me, dailyLimit: overview?.dailyLimit || 3, reward: overview?.reward || 3, backendError: overview?.error || null };
}

function ensureStyle() {
  if (document.getElementById('forces-style')) return;
  const style = document.createElement('style');
  style.id = 'forces-style';
  style.textContent = `
    .forces-page{display:grid;gap:14px;padding-bottom:24px}.forces-hero{border-radius:28px;padding:24px 20px;background:linear-gradient(135deg,rgba(15,23,42,.98),rgba(124,58,237,.84));color:#fff;box-shadow:0 18px 42px rgba(15,23,42,.2);position:relative;overflow:hidden}.forces-hero:after{content:'';position:absolute;width:230px;height:230px;border-radius:999px;right:-90px;top:-90px;background:rgba(255,255,255,.13)}.forces-hero__eyebrow{font-size:11px;font-weight:1000;letter-spacing:.1em;color:rgba(255,255,255,.62)}.forces-hero__title{font-size:28px;line-height:1.18;font-weight:1000;margin:7px 0;color:#fff;letter-spacing:-.06em}.forces-hero__desc{font-size:14px;line-height:1.6;color:rgba(255,255,255,.76);margin:0;max-width:760px}.forces-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}.forces-status{display:inline-flex;border-radius:999px;padding:6px 9px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.14);font-size:12px;font-weight:1000;color:#fff}.forces-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.force-card{position:relative;overflow:hidden;border:1px solid rgba(100,116,139,.16);border-radius:22px;background:var(--color-surface,#fff);padding:16px;box-shadow:0 10px 26px rgba(15,23,42,.055)}.force-card:before{content:'';position:absolute;inset:0 0 auto 0;height:5px;background:var(--force-color,#6366f1)}.force-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-top:3px}.force-name{font-size:17px;font-weight:1000;color:var(--color-text-primary);letter-spacing:-.04em}.force-role{font-size:12px;color:var(--color-text-muted);margin-top:2px}.force-power{font-size:16px;font-weight:1000;color:var(--force-color,#6366f1);white-space:nowrap}.force-text{margin-top:10px;font-size:13px;line-height:1.55;color:var(--color-text-secondary)}.force-meta{display:grid;gap:7px;margin-top:12px}.force-kv{display:flex;justify-content:space-between;gap:10px;border-radius:14px;background:rgba(248,250,252,.9);padding:9px 10px;font-size:12px}.force-kv span{color:var(--color-text-muted)}.force-kv b{color:var(--color-text-primary)}.force-badge{display:inline-flex;border-radius:999px;padding:5px 8px;background:rgba(20,184,127,.12);color:#0f9f72;font-size:11px;font-weight:1000}.force-note{font-size:11px;line-height:1.45;color:var(--color-text-muted);margin-top:8px}.forces-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.forces-summary__card{border:1px solid rgba(100,116,139,.16);border-radius:20px;background:var(--color-surface,#fff);padding:14px;box-shadow:0 10px 26px rgba(15,23,42,.055)}.forces-summary__card b{display:block;font-size:13px;color:var(--color-text-primary)}.forces-summary__card span{display:block;font-size:12px;color:var(--color-text-secondary);line-height:1.45;margin-top:4px}.btn--danger-soft{border:1px solid rgba(239,68,68,.22)!important;background:rgba(239,68,68,.08)!important;color:#dc2626!important}@media(max-width:820px){.forces-grid,.forces-summary{grid-template-columns:1fr}.forces-hero__title{font-size:23px}.force-card{padding:14px}}
  `;
  document.head.appendChild(style);
}

function renderHero(me, overview) {
  const loggedIn = !!auth.currentUser;
  const force = me?.forceName || '미선택';
  return `<section class="forces-hero">
    <div class="forces-hero__eyebrow">OUTSIDE POWER ROUTE</div>
    <div class="forces-hero__title">⚡ 정당 밖 권력으로<br>정치판을 흔드세요</div>
    <p class="forces-hero__desc">당대표 루트가 싫다면 외부세력을 선택해 영향력을 키울 수 있습니다. 수사·치안·재계·언론·시민운동·관료 조직 중 하나를 선택하세요.</p>
    <div class="forces-actions">
      ${loggedIn ? `<span class="forces-status">내 세력 · ${escHtml(force)} · 영향력 ${fmtNum(me?.influence || 0)}P</span>` : `<button class="btn btn--primary" data-go="/login">로그인</button>`}
      <span class="forces-status">활동 보상 +${overview?.reward || 3}P</span>
      <span class="forces-status">일일 ${overview?.dailyLimit || 3}회</span>
    </div>
  </section>`;
}

function renderSummary(overview) {
  const forces = overview?.forces || [];
  const top = forces[0];
  const totalInfluence = forces.reduce((s, f) => s + Number(f.totalInfluence || 0), 0);
  return `<section class="forces-summary">
    <div class="forces-summary__card"><b>현재 1위 세력</b><span>${top ? `${top.emoji} ${escHtml(top.name)} · ${fmtNum(top.totalInfluence)}P` : '집계 준비 중'}</span></div>
    <div class="forces-summary__card"><b>외부세력 총 영향력</b><span>${fmtNum(totalInfluence)}P</span></div>
    <div class="forces-summary__card"><b>성장 방식</b><span>소속 선택 후 매일 외부세력 활동으로 영향력을 쌓습니다.</span></div>
  </section>`;
}

function renderForces(overview) {
  const forces = overview?.forces || [];
  const myForceId = overview?.me?.forceId || '';
  return `<section class="forces-grid">
    ${forces.map(f => {
      const isMine = f.id === myForceId;
      return `<article class="force-card" style="--force-color:${escHtml(f.color || '#6366f1')}">
        <div class="force-head"><div><div class="force-name">${escHtml(f.emoji)} ${escHtml(f.name)}</div><div class="force-role">${escHtml(f.routeName)} · ${escHtml(f.role)}</div></div><div class="force-power">${fmtNum(f.totalInfluence)}P</div></div>
        <div class="force-text">${escHtml(f.strength)}</div>
        <div class="force-meta"><div class="force-kv"><span>핵심 의제</span><b>${escHtml(f.agenda)}</b></div><div class="force-kv"><span>구성원</span><b>${fmtNum(f.memberCount)}명</b></div><div class="force-kv"><span>대표 영향력</span><b>${f.leader ? `${escHtml(f.leader.nickname)} · ${fmtNum(f.leader.influence)}P` : '아직 없음'}</b></div></div>
        ${isMine ? '<div style="margin-top:12px"><span class="force-badge">내 외부세력</span></div>' : ''}
        <div class="forces-actions">${isMine ? `<button class="btn btn--primary btn--sm" data-act="${escHtml(f.id)}">세력 활동 +${overview?.reward || 3}P</button><button class="btn btn--ghost btn--sm btn--danger-soft" data-leave-force="${escHtml(f.id)}">세력 탈퇴</button>` : `<button class="btn btn--primary btn--sm" data-join-force="${escHtml(f.id)}">이 세력 선택</button>`}</div>
        ${isMine ? `<div class="force-note">오늘 활동은 하루 ${overview?.dailyLimit || 3}회까지 가능합니다. 영향력이 높아질수록 이 세력의 정치적 압박력이 커집니다.</div>` : ''}
      </article>`;
    }).join('')}
  </section>`;
}

async function bindActions(el) {
  el.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.go)));
  el.querySelectorAll('[data-join-force]').forEach(btn => btn.addEventListener('click', async () => {
    if (!auth.currentUser) { navigate('/login'); return; }
    btn.disabled = true;
    const forceId = btn.dataset.joinForce;
    const res = await call('joinExternalForce', { forceId });
    if (res?.error) {
      setLocalForceId(forceId);
      toast.info('세력 선택 표시 완료. 서버 배포 후 자동 저장됩니다.');
    } else {
      setLocalForceId(forceId);
      toast.success(`${res.force?.emoji || '⚡'} ${res.force?.name || '외부세력'} 선택 완료`);
    }
    renderForcesPage();
  }));
  el.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', async () => {
    if (!auth.currentUser) { navigate('/login'); return; }
    btn.disabled = true;
    const res = await call('actForExternalForce', {});
    if (res?.error) toast.error(res.error.message || '세력 활동에 실패했습니다.');
    else toast.success(`세력 활동 완료 +${res.points || 3}P`);
    renderForcesPage();
  }));
  el.querySelectorAll('[data-leave-force]').forEach(btn => btn.addEventListener('click', async () => {
    if (!auth.currentUser) { navigate('/login'); return; }
    if (!window.confirm('외부세력 소속을 해제할까요? 포인트 차감은 없습니다.')) return;
    btn.disabled = true;
    const res = await call('leaveExternalForce', {});
    setLocalForceId('');
    if (res?.error) toast.info('세력 선택 표시를 해제했습니다.');
    else toast.success('외부세력 소속을 해제했습니다.');
    renderForcesPage();
  }));
}

export async function renderForcesPage() {
  setMeta('외부세력');
  ensureStyle();
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<div class="forces-page"><div class="skeleton" style="height:190px;border-radius:28px"></div><div class="skeleton" style="height:420px;border-radius:22px"></div></div>`;
  const overview = normalizeOverview(await call('getExternalForcesOverview'));
  el.innerHTML = `<div class="forces-page page-enter">${renderHero(overview.me, overview)}${renderSummary(overview)}${renderForces(overview)}</div>`;
  bindActions(el);
}
