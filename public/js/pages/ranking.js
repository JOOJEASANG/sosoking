/* ranking.js — 토론 많은 자료 */
import { functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';

function call(name, payload = {}) { return httpsCallable(functions, name)(payload).then(res => res.data || {}).catch(error => ({ ok: false, error })); }
function ensureStyle() {
  if (document.getElementById('debate-page-style')) return;
  const s = document.createElement('style');
  s.id = 'debate-page-style';
  s.textContent = `.debate-page{display:grid;gap:14px;padding-bottom:26px}.debate-hero{border-radius:28px;padding:24px 20px;background:linear-gradient(135deg,#0f172a,#475569);color:#fff}.debate-hero h1{margin:4px 0 6px;font-size:28px;color:#fff}.debate-hero p{margin:0;color:rgba(255,255,255,.76);font-size:14px;line-height:1.6}.debate-list{display:grid;gap:10px}.debate-card{display:grid;grid-template-columns:52px 1fr auto;gap:12px;align-items:center;border:1px solid rgba(100,116,139,.16);border-radius:20px;background:var(--color-surface,#fff);padding:14px;text-align:left;font-family:inherit;color:inherit;box-shadow:0 10px 26px rgba(15,23,42,.055);cursor:pointer}.debate-rank{width:52px;height:52px;border-radius:18px;background:rgba(47,125,110,.10);color:#2f7d6e;display:flex;align-items:center;justify-content:center;font-weight:1000}.debate-title{font-size:16px;font-weight:1000;color:var(--color-text-primary);margin-bottom:4px}.debate-text{font-size:13px;line-height:1.55;color:var(--color-text-secondary)}.debate-stats{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.debate-stats span{border-radius:999px;background:rgba(47,125,110,.10);color:#2f7d6e;padding:5px 8px;font-size:11px;font-weight:1000}@media(max-width:760px){.debate-card{grid-template-columns:42px 1fr}.debate-stats{grid-column:2;justify-content:flex-start}}`;
  document.head.appendChild(s);
}
function card(m, i) {
  return `<button class="debate-card" data-id="${escHtml(m.id)}"><div class="debate-rank">${i + 1}</div><div><div class="debate-title">${escHtml(m.title)}</div><div class="debate-text">${escHtml(m.summary)}</div></div><div class="debate-stats"><span>댓글 ${Number(m.commentCount || 0)}</span><span>찬성 ${Number(m.agreeCount || 0)}</span><span>반대 ${Number(m.disagreeCount || 0)}</span></div></button>`;
}
export async function renderRanking() {
  setMeta('토론 많은 자료', '댓글과 찬반 참여가 많은 소소자료');
  ensureStyle();
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<div class="debate-page"><div class="skeleton" style="height:150px;border-radius:28px"></div><div class="skeleton" style="height:420px;border-radius:20px"></div></div>`;
  const res = await call('getDebateSummary', { limit: 30 });
  const items = Array.isArray(res.materials) ? res.materials : [];
  el.innerHTML = `<div class="debate-page page-enter"><section class="debate-hero"><div style="font-size:11px;font-weight:1000;letter-spacing:.1em;color:rgba(255,255,255,.62)">ACTIVE DEBATES</div><h1>토론 많은 자료</h1><p>댓글과 찬성·반대 참여가 많은 자료를 모아봅니다.</p></section><div class="debate-list">${items.length ? items.map(card).join('') : '<div class="empty-state"><div class="empty-state__title">아직 토론 자료가 없습니다.</div></div>'}</div></div>`;
  el.querySelectorAll('[data-id]').forEach(btn => btn.addEventListener('click', () => navigate(`/material/${btn.dataset.id}`)));
}
