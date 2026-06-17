/* history.js — 자료실/상세 */
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { toast } from '../components/toast.js';

function call(name, payload = {}) { return httpsCallable(functions, name)(payload).then(res => res.data || {}).catch(error => ({ ok: false, error })); }
function styleOnce() {
  if (document.getElementById('material-page-style')) return;
  const s = document.createElement('style');
  s.id = 'material-page-style';
  s.textContent = `.mat-page{display:grid;gap:14px;padding-bottom:28px}.mat-hero,.mat-panel{border:1px solid rgba(100,116,139,.16);border-radius:24px;background:var(--color-surface,#fff);padding:16px;box-shadow:0 10px 26px rgba(15,23,42,.055)}.mat-hero{background:linear-gradient(135deg,#0f172a,#334155);color:#fff}.mat-hero h1{margin:4px 0 6px;color:#fff;font-size:28px}.mat-hero p{margin:0;color:rgba(255,255,255,.76);line-height:1.6}.mat-grid{display:grid;gap:12px}.mat-card{display:block;width:100%;border:1px solid rgba(100,116,139,.16);border-radius:22px;background:var(--color-surface,#fff);padding:16px;text-align:left;font-family:inherit;color:inherit;box-shadow:0 10px 26px rgba(15,23,42,.055);cursor:pointer}.mat-meta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.mat-meta span,.mat-chip{border-radius:999px;background:rgba(47,125,110,.10);color:#2f7d6e;padding:5px 8px;font-size:11px;font-weight:1000}.mat-title{font-size:19px;font-weight:1000;line-height:1.3;color:var(--color-text-primary);margin-bottom:7px}.mat-text{font-size:13px;line-height:1.65;color:var(--color-text-secondary)}.mat-body{display:grid;gap:12px}.mat-panel h2{font-size:16px;margin:0 0 8px;color:var(--color-text-primary)}.mat-panel p{font-size:14px;line-height:1.75;color:var(--color-text-secondary);margin:0 0 8px}.mat-vote{display:grid;grid-template-columns:1fr 1fr;gap:10px}.mat-vote button{border:1px solid rgba(100,116,139,.16);border-radius:18px;background:rgba(248,250,252,.84);padding:13px;text-align:left;font-family:inherit;color:inherit;cursor:pointer}.mat-vote button.active{outline:3px solid rgba(47,125,110,.20);border-color:#2f7d6e}.mat-comment{border-top:1px solid rgba(100,116,139,.12);padding:10px 0}.mat-comment b{font-size:13px;color:var(--color-text-primary)}.mat-comment p{white-space:pre-wrap;font-size:13px;margin:4px 0 0}.mat-form{display:grid;gap:8px}.mat-form textarea{width:100%;min-height:82px;resize:vertical;font-family:inherit}.mat-actions{display:flex;gap:8px;flex-wrap:wrap}.mat-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}@media(max-width:760px){.mat-vote{grid-template-columns:1fr}}`;
  document.head.appendChild(s);
}
function listCard(m) {
  return `<button class="mat-card" data-id="${escHtml(m.id)}"><div class="mat-meta"><span>${escHtml(m.category || '생활논쟁')}</span><span>찬성 ${Number(m.agreeCount || 0)}</span><span>반대 ${Number(m.disagreeCount || 0)}</span><span>댓글 ${Number(m.commentCount || 0)}</span></div><div class="mat-title">${escHtml(m.title)}</div><div class="mat-text">${escHtml(m.summary)}</div></button>`;
}
function sideLabel(side) { return side === 'agree' ? '찬성' : side === 'disagree' ? '반대' : '중립'; }
function commentHtml(c) { return `<div class="mat-comment"><b>${escHtml(c.nickname || '익명')} · ${sideLabel(c.side)}</b><p>${escHtml(c.text || '')}</p></div>`; }
async function reloadComments(materialId) {
  const box = document.getElementById('material-comments');
  if (!box) return;
  const res = await call('getMaterialComments', { materialId, limit: 50 });
  const comments = Array.isArray(res.comments) ? res.comments : [];
  box.innerHTML = comments.length ? comments.map(commentHtml).join('') : '<div class="mat-text">아직 댓글이 없습니다.</div>';
}
export async function renderHistory() {
  setMeta('자료실', '생활분쟁·민원·소송·소비자 논쟁 자료실');
  styleOnce();
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<div class="mat-page"><div class="skeleton" style="height:150px;border-radius:24px"></div><div class="skeleton" style="height:420px;border-radius:22px"></div></div>`;
  const res = await call('getMaterials', { limit: 40 });
  const items = Array.isArray(res.materials) ? res.materials : [];
  el.innerHTML = `<div class="mat-page page-enter"><section class="mat-hero"><div style="font-size:11px;font-weight:1000;letter-spacing:.1em;color:rgba(255,255,255,.62)">MATERIAL ARCHIVE</div><h1>소소자료실</h1><p>생활 속 분쟁과 민원 이슈를 짧게 정리한 자료를 모았습니다.</p><div class="mat-actions" style="margin-top:12px"><button class="btn btn--ghost" data-go="/today">오늘자료</button><button class="btn btn--ghost" data-go="/debates">토론</button></div></section><div class="mat-grid">${items.length ? items.map(listCard).join('') : '<div class="empty-state"><div class="empty-state__title">자료가 아직 없습니다.</div></div>'}</div></div>`;
  el.querySelectorAll('[data-id]').forEach(btn => btn.addEventListener('click', () => navigate(`/material/${btn.dataset.id}`)));
  el.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.go)));
}
export async function renderMaterialDetail(id) {
  styleOnce();
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<div class="mat-page"><div class="skeleton" style="height:520px;border-radius:24px"></div></div>`;
  const res = await call('getMaterial', { materialId: id });
  if (!res.ok || !res.material) { el.innerHTML = '<div class="empty-state"><div class="empty-state__title">자료를 찾을 수 없습니다.</div><button class="btn btn--primary" id="back-materials">자료실로</button></div>'; el.querySelector('#back-materials')?.addEventListener('click', () => navigate('/materials')); return; }
  const m = res.material;
  setMeta(m.title, m.summary);
  const tags = Array.isArray(m.tags) ? m.tags : [];
  const body = Array.isArray(m.body) ? m.body : [];
  const guides = Array.isArray(m.sourceGuide) ? m.sourceGuide : [];
  const questions = Array.isArray(m.questions) ? m.questions : [];
  el.innerHTML = `<div class="mat-page page-enter"><section class="mat-hero"><button class="btn btn--ghost btn--sm" id="mat-back">← 자료실</button><h1>${escHtml(m.title)}</h1><p>${escHtml(m.summary)}</p><div class="mat-tags"><span class="mat-chip">${escHtml(m.category)}</span>${tags.map(t => `<span class="mat-chip">#${escHtml(t)}</span>`).join('')}</div></section><div class="mat-body"><section class="mat-panel"><h2>핵심 정리</h2>${body.map(p => `<p>${escHtml(p)}</p>`).join('')}</section><section class="mat-panel"><h2>찬성 / 반대</h2><div class="mat-vote"><button data-vote="agree" class="${res.myVote === 'agree' ? 'active' : ''}"><b>찬성 · ${Number(m.agreeCount || 0)}</b><p>${escHtml(m.agreeTitle)}<br>${escHtml(m.agreeText)}</p></button><button data-vote="disagree" class="${res.myVote === 'disagree' ? 'active' : ''}"><b>반대 · ${Number(m.disagreeCount || 0)}</b><p>${escHtml(m.disagreeTitle)}<br>${escHtml(m.disagreeText)}</p></button></div></section><section class="mat-panel"><h2>더 찾아볼 자료</h2><div class="mat-tags">${guides.map(g => `<span class="mat-chip">${escHtml(g)}</span>`).join('')}</div></section><section class="mat-panel"><h2>토론 질문</h2>${questions.map(q => `<p>• ${escHtml(q)}</p>`).join('')}</section><section class="mat-panel"><h2>댓글 토론</h2><div class="mat-form"><select id="comment-side"><option value="neutral">중립</option><option value="agree">찬성</option><option value="disagree">반대</option></select><textarea id="comment-text" maxlength="700" placeholder="의견을 입력하세요."></textarea><button class="btn btn--primary" id="comment-submit">댓글 등록</button></div><div id="material-comments" style="margin-top:12px"></div></section></div></div>`;
  el.querySelector('#mat-back')?.addEventListener('click', () => navigate('/materials'));
  el.querySelectorAll('[data-vote]').forEach(btn => btn.addEventListener('click', async () => {
    if (!auth.currentUser) { navigate('/login'); return; }
    const out = await call('voteMaterial', { materialId: id, side: btn.dataset.vote });
    if (!out.ok) { toast.error(out.error?.message || '투표에 실패했습니다.'); return; }
    toast.success('투표를 반영했습니다.');
    renderMaterialDetail(id);
  }));
  el.querySelector('#comment-submit')?.addEventListener('click', async () => {
    if (!auth.currentUser) { navigate('/login'); return; }
    const textEl = el.querySelector('#comment-text');
    const sideEl = el.querySelector('#comment-side');
    const text = String(textEl?.value || '').trim();
    if (text.length < 2) { toast.info('댓글을 2자 이상 입력해주세요.'); return; }
    const out = await call('addMaterialComment', { materialId: id, text, side: sideEl?.value || 'neutral' });
    if (!out.ok) { toast.error(out.error?.message || '댓글 등록에 실패했습니다.'); return; }
    textEl.value = '';
    toast.success('댓글을 등록했습니다.');
    reloadComments(id);
  });
  reloadComments(id);
}
