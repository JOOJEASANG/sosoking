/* home.js — 소소한 논쟁커뮤니티 홈 */
import { functions } from '../firebase.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';

function call(name, payload = {}) { return httpsCallable(functions, name)(payload).then(res => res.data || {}).catch(error => ({ ok: false, error })); }
function materialCard(m, label = '') {
  return `<button class="soso-card" data-material-id="${escHtml(m.id)}">
    <div class="soso-card__meta"><span>${escHtml(label || m.category || '생활논쟁')}</span><span>찬성 ${Number(m.agreeCount || 0)}</span><span>반대 ${Number(m.disagreeCount || 0)}</span><span>댓글 ${Number(m.commentCount || 0)}</span></div>
    <div class="soso-card__title">${escHtml(m.title || '자료')}</div>
    <div class="soso-card__text">${escHtml(m.summary || '')}</div>
  </button>`;
}
function ensureStyle() {
  if (document.getElementById('soso-home-style')) return;
  const style = document.createElement('style');
  style.id = 'soso-home-style';
  style.textContent = `
    .soso-home{display:grid;gap:14px;padding-bottom:26px}.soso-hero{border-radius:30px;padding:28px 20px;background:linear-gradient(135deg,rgba(15,23,42,.98),rgba(47,125,110,.88));color:#fff;box-shadow:0 18px 42px rgba(15,23,42,.18)}
    .soso-hero__eyebrow{font-size:11px;font-weight:1000;letter-spacing:.1em;color:rgba(255,255,255,.64)}.soso-hero__title{margin:8px 0;font-size:31px;line-height:1.16;font-weight:1000;color:#fff}.soso-hero__desc{max-width:760px;margin:0;color:rgba(255,255,255,.78);font-size:14px;line-height:1.65}.soso-actions,.soso-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}.soso-chips span{border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.14);padding:6px 9px;font-size:12px;font-weight:900}
    .soso-section{border:1px solid rgba(100,116,139,.16);background:var(--color-surface,#fff);border-radius:24px;padding:16px;box-shadow:0 10px 26px rgba(15,23,42,.055)}.soso-section__head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}.soso-section__title{font-size:18px;font-weight:1000;color:var(--color-text-primary)}.soso-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.soso-card{display:block;width:100%;text-align:left;border:1px solid rgba(100,116,139,.14);border-radius:20px;background:rgba(248,250,252,.82);padding:14px;font-family:inherit;color:inherit;cursor:pointer}.soso-card:hover{transform:translateY(-1px)}.soso-card__meta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.soso-card__meta span{border-radius:999px;background:rgba(47,125,110,.10);color:#2f7d6e;font-size:11px;font-weight:1000;padding:5px 7px}.soso-card__title{font-size:15px;font-weight:1000;color:var(--color-text-primary);line-height:1.32;margin-bottom:6px}.soso-card__text{font-size:13px;line-height:1.55;color:var(--color-text-secondary)}@media(max-width:860px){.soso-grid{grid-template-columns:1fr}.soso-hero__title{font-size:25px}}
  `;
  document.head.appendChild(style);
}
export async function renderHome() {
  setMeta('소소킹 — 소소한 논쟁커뮤니티', '생활분쟁·민원·소송·소비자 이슈를 자료로 정리하고 찬반으로 토론하는 커뮤니티');
  ensureStyle();
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<div class="soso-home"><div class="skeleton" style="height:220px;border-radius:30px"></div><div class="skeleton" style="height:320px;border-radius:24px"></div></div>`;
  const [today, debates] = await Promise.all([call('getTodayMaterials'), call('getDebateSummary', { limit: 6 })]);
  const todayItems = Array.isArray(today.materials) ? today.materials : [];
  const debateItems = Array.isArray(debates.materials) ? debates.materials : [];
  el.innerHTML = `<div class="soso-home page-enter">
    <section class="soso-hero"><div class="soso-hero__eyebrow">SOSO DEBATE COMMUNITY</div><h1 class="soso-hero__title">소소한 문제도<br>근거가 있으면 강해집니다</h1><p class="soso-hero__desc">생활분쟁, 민원, 신고, 소송, 소비자 문제를 짧은 자료로 정리하고 찬성·반대 의견과 댓글로 토론합니다.</p><div class="soso-chips"><span>하루 3개 자료</span><span>찬성·반대 투표</span><span>댓글 토론</span><span>실제자료 확장 예정</span></div><div class="soso-actions"><button class="btn btn--primary" data-go="/today">오늘자료 보기</button><button class="btn btn--ghost" data-go="/materials">자료실 전체</button></div></section>
    <section class="soso-section"><div class="soso-section__head"><div class="soso-section__title">오늘의 소소자료</div><button class="btn btn--ghost btn--sm" data-go="/today">전체 보기</button></div><div class="soso-grid">${todayItems.length ? todayItems.map((m, i) => materialCard(m, `오늘 ${i + 1}`)).join('') : '<div class="empty-state">오늘 자료를 준비 중입니다.</div>'}</div></section>
    <section class="soso-section"><div class="soso-section__head"><div class="soso-section__title">토론 많은 자료</div><button class="btn btn--ghost btn--sm" data-go="/debates">토론 보기</button></div><div class="soso-grid">${debateItems.length ? debateItems.slice(0, 6).map(m => materialCard(m)).join('') : '<div class="empty-state">아직 토론 자료가 없습니다.</div>'}</div></section>
  </div>`;
  el.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.go)));
  el.querySelectorAll('[data-material-id]').forEach(btn => btn.addEventListener('click', () => navigate(`/material/${btn.dataset.materialId}`)));
}
