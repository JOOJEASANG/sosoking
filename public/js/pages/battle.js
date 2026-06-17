/* battle.js — 오늘자료 */
import { functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';

function call(name, payload = {}) { return httpsCallable(functions, name)(payload).then(res => res.data || {}).catch(error => ({ ok: false, error })); }
function styleOnce() {
  if (document.getElementById('today-material-style')) return;
  const s = document.createElement('style');
  s.id = 'today-material-style';
  s.textContent = `.today-page{display:grid;gap:14px;padding-bottom:26px}.today-hero{border-radius:28px;padding:24px 20px;background:linear-gradient(135deg,#0f172a,#2f7d6e);color:#fff}.today-hero h1{margin:4px 0 6px;font-size:28px;color:#fff}.today-hero p{margin:0;color:rgba(255,255,255,.76);font-size:14px;line-height:1.6}.today-grid{display:grid;gap:12px}.today-card{border:1px solid rgba(100,116,139,.16);border-radius:22px;background:var(--color-surface,#fff);padding:16px;text-align:left;font-family:inherit;color:inherit;box-shadow:0 10px 26px rgba(15,23,42,.055);cursor:pointer}.today-meta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.today-meta span{border-radius:999px;background:rgba(47,125,110,.10);color:#2f7d6e;padding:5px 8px;font-size:11px;font-weight:1000}.today-title{font-size:18px;font-weight:1000;color:var(--color-text-primary);line-height:1.32;margin-bottom:6px}.today-text{font-size:13px;line-height:1.6;color:var(--color-text-secondary)}.today-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}`;
  document.head.appendChild(s);
}
function card(m, i) {
  return `<button class="today-card" data-id="${escHtml(m.id)}"><div class="today-meta"><span>오늘 ${i + 1}</span><span>${escHtml(m.category || '생활논쟁')}</span><span>찬성 ${Number(m.agreeCount || 0)}</span><span>반대 ${Number(m.disagreeCount || 0)}</span><span>댓글 ${Number(m.commentCount || 0)}</span></div><div class="today-title">${escHtml(m.title)}</div><div class="today-text">${escHtml(m.summary)}</div></button>`;
}
export async function renderBattle() {
  setMeta('오늘자료', '오늘 올라온 소소논쟁 자료 3개');
  styleOnce();
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<div class="today-page"><div class="skeleton" style="height:150px;border-radius:28px"></div><div class="skeleton" style="height:360px;border-radius:22px"></div></div>`;
  const res = await call('getTodayMaterials');
  const items = Array.isArray(res.materials) ? res.materials : [];
  el.innerHTML = `<div class="today-page page-enter"><section class="today-hero"><div style="font-size:11px;font-weight:1000;letter-spacing:.1em;color:rgba(255,255,255,.62)">TODAY MATERIALS</div><h1>오늘의 소소자료</h1><p>하루 3개씩 생활 속 논쟁거리를 짧은 자료로 정리합니다.</p><div class="today-actions"><button class="btn btn--ghost" data-go="/materials">자료실 전체</button><button class="btn btn--ghost" data-go="/debates">토론 많은 자료</button></div></section><div class="today-grid">${items.length ? items.map(card).join('') : '<div class="empty-state"><div class="empty-state__title">오늘 자료를 준비 중입니다.</div></div>'}</div></div>`;
  el.querySelectorAll('[data-id]').forEach(btn => btn.addEventListener('click', () => navigate(`/material/${btn.dataset.id}`)));
  el.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.go)));
}
