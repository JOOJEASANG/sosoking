/* battle.js — 오늘의 자료와 토론 */
import { functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';

function call(name, payload = {}) {
  return httpsCallable(functions, name)(payload)
    .then(response => response.data || {})
    .catch(error => ({ ok: false, error }));
}

function styleOnce() {
  if (document.getElementById('today-content-style')) return;
  const style = document.createElement('style');
  style.id = 'today-content-style';
  style.textContent = `
    .today-page{display:grid;gap:15px;padding-bottom:30px}.today-hero{border-radius:28px;padding:27px;background:radial-gradient(circle at 88% 14%,rgba(255,191,118,.28),transparent 30%),linear-gradient(135deg,#172033,#5b3e72);color:#fff}.today-hero h1{margin:6px 0 8px;font-size:31px;color:#fff}.today-hero p{max-width:760px;margin:0;color:rgba(255,255,255,.78);font-size:14px;line-height:1.7}.today-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.today-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.today-card{position:relative;display:grid;align-content:start;min-height:300px;border:1px solid rgba(100,116,139,.16);border-radius:24px;background:var(--color-surface,#fff);padding:21px;text-align:left;font-family:inherit;color:inherit;box-shadow:0 12px 30px rgba(15,23,42,.06);cursor:pointer;transition:transform .18s,border-color .18s,box-shadow .18s}.today-card:hover{transform:translateY(-4px);box-shadow:0 18px 38px rgba(15,23,42,.09)}.today-card--material:hover{border-color:rgba(47,125,110,.34)}.today-card--debate:hover{border-color:rgba(224,93,68,.34)}.today-type{display:flex;align-items:center;justify-content:space-between;gap:8px}.today-type span{border-radius:999px;padding:6px 9px;font-size:10px;font-weight:1000}.today-card--material .today-type span{background:rgba(47,125,110,.10);color:#2f7d6e}.today-card--debate .today-type span{background:rgba(224,93,68,.10);color:#c84431}.today-icon{font-size:34px}.today-title{margin:22px 0 10px;font-size:23px;font-weight:1000;line-height:1.35;color:var(--color-text-primary)}.today-text{font-size:14px;line-height:1.75;color:var(--color-text-secondary)}.today-footer{display:flex;gap:7px;flex-wrap:wrap;margin-top:auto;padding-top:20px}.today-footer span{border-radius:999px;background:rgba(100,116,139,.09);padding:6px 8px;color:var(--color-text-muted);font-size:10px;font-weight:900}.today-empty{display:grid;place-items:center;min-height:300px;border:1px dashed rgba(100,116,139,.22);border-radius:24px;color:var(--color-text-muted);text-align:center;padding:24px}@media(max-width:760px){.today-grid{grid-template-columns:1fr}.today-card{min-height:260px}}
  `;
  document.head.appendChild(style);
}

function materialCard(material) {
  if (!material) return `<div class="today-empty"><div><b>오늘의 자료를 준비 중입니다.</b><p>AI 생성이 완료되면 이곳에 표시됩니다.</p></div></div>`;
  return `<button class="today-card today-card--material" data-go="/material/${escHtml(material.id)}"><div class="today-type"><span>📚 오늘의 자료</span><div class="today-icon">🗂️</div></div><div class="today-title">${escHtml(material.title)}</div><div class="today-text">${escHtml(material.summary)}</div><div class="today-footer"><span>${escHtml(material.category || '생활정보')}</span><span>${material.aiGenerated ? 'AI 생성' : '관리자 등록'}</span></div></button>`;
}

function debateCard(debate) {
  if (!debate) return `<div class="today-empty"><div><b>오늘의 토론을 준비 중입니다.</b><p>AI 생성이 완료되면 이곳에 표시됩니다.</p></div></div>`;
  return `<button class="today-card today-card--debate" data-go="/debate/${escHtml(debate.id)}"><div class="today-type"><span>💬 오늘의 토론</span><div class="today-icon">🗣️</div></div><div class="today-title">${escHtml(debate.title)}</div><div class="today-text">${escHtml(debate.summary)}</div><div class="today-footer"><span>${escHtml(debate.category || '생활토론')}</span><span>투표 ${Number(debate.totalVotes || 0)}</span><span>댓글 ${Number(debate.commentCount || 0)}</span></div></button>`;
}

export async function renderBattle() {
  setMeta('오늘의 콘텐츠', 'AI가 하루 한 번 생성하는 오늘의 생활자료와 독립 토론 주제');
  styleOnce();
  const element = document.getElementById('page-content');
  if (!element) return;
  element.innerHTML = `<div class="today-page"><div class="skeleton" style="height:170px;border-radius:28px"></div><div class="skeleton" style="height:360px;border-radius:24px"></div></div>`;

  const [materialResult, debateResult] = await Promise.all([call('getTodayMaterials'), call('getTodayDebate')]);
  const material = Array.isArray(materialResult.materials) ? materialResult.materials[0] || null : null;
  const debate = debateResult.debate || (Array.isArray(debateResult.debates) ? debateResult.debates[0] || null : null);

  element.innerHTML = `<div class="today-page page-enter"><section class="today-hero"><div style="font-size:10px;font-weight:1000;letter-spacing:.12em;color:rgba(255,255,255,.64)">DAILY AI CONTENT</div><h1>오늘의 자료와 토론</h1><p>자료실과 토론실은 서로 별도로 운영합니다. AI가 매일 생활정보 자료 1건과 찬반 토론 1건을 각각 생성하며, 관리자가 직접 등록한 콘텐츠도 함께 운영됩니다.</p><div class="today-actions"><button class="btn btn--ghost" data-go="/materials">자료실 전체</button><button class="btn btn--ghost" data-go="/debates">토론실 전체</button></div></section><div class="today-grid">${materialCard(material)}${debateCard(debate)}</div></div>`;
  element.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
}
