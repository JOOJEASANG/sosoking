/* history.js — 독립 자료실/자료 상세 */
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
  if (document.getElementById('material-page-style')) return;
  const style = document.createElement('style');
  style.id = 'material-page-style';
  style.textContent = `
    .mat-page{display:grid;gap:15px;padding-bottom:30px}.mat-hero,.mat-panel{border:1px solid rgba(100,116,139,.16);border-radius:25px;background:var(--color-surface,#fff);padding:19px;box-shadow:0 12px 30px rgba(15,23,42,.055)}
    .mat-hero{padding:26px;background:radial-gradient(circle at 88% 16%,rgba(105,196,171,.24),transparent 28%),linear-gradient(135deg,#10243b,#276653);color:#fff}.mat-hero h1{margin:7px 0 8px;color:#fff;font-size:31px;line-height:1.25}.mat-hero p{max-width:760px;margin:0;color:rgba(255,255,255,.78);line-height:1.7}.mat-hero__eyebrow{font-size:10px;font-weight:1000;letter-spacing:.12em;color:rgba(255,255,255,.64)}
    .mat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.mat-card{position:relative;display:block;width:100%;min-height:190px;border:1px solid rgba(100,116,139,.16);border-radius:22px;background:var(--color-surface,#fff);padding:18px;text-align:left;font-family:inherit;color:inherit;box-shadow:0 10px 26px rgba(15,23,42,.055);cursor:pointer;transition:transform .18s,border-color .18s,box-shadow .18s}.mat-card:hover{transform:translateY(-3px);border-color:rgba(47,125,110,.34);box-shadow:0 17px 34px rgba(15,23,42,.08)}.mat-card__arrow{position:absolute;right:18px;top:17px;color:#2f7d6e;font-weight:1000}.mat-meta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:13px}.mat-meta span,.mat-chip{border-radius:999px;background:rgba(47,125,110,.10);color:#2f7d6e;padding:5px 8px;font-size:10px;font-weight:1000}.mat-title{padding-right:28px;font-size:19px;font-weight:1000;line-height:1.4;color:var(--color-text-primary);margin-bottom:8px}.mat-text{font-size:13px;line-height:1.7;color:var(--color-text-secondary)}
    .mat-body{display:grid;grid-template-columns:minmax(0,1fr) 310px;align-items:start;gap:14px}.mat-main{display:grid;gap:14px}.mat-side{position:sticky;top:18px;display:grid;gap:14px}.mat-panel h2{font-size:17px;margin:0 0 10px;color:var(--color-text-primary)}.mat-panel p{font-size:14px;line-height:1.8;color:var(--color-text-secondary);margin:0 0 10px}.mat-point{display:grid;grid-template-columns:30px minmax(0,1fr);gap:10px;align-items:start;padding:12px 0;border-bottom:1px solid rgba(100,116,139,.10)}.mat-point:last-child{border-bottom:0}.mat-point__num{display:grid;place-items:center;width:28px;height:28px;border-radius:10px;background:rgba(47,125,110,.10);color:#2f7d6e;font-size:11px;font-weight:1000}.mat-tags{display:flex;gap:6px;flex-wrap:wrap}.mat-actions{display:flex;gap:8px;flex-wrap:wrap}.mat-source{font-size:12px;line-height:1.65;color:var(--color-text-muted)}.mat-disclaimer{border-color:rgba(245,158,11,.22);background:rgba(245,158,11,.07)}
    @media(max-width:900px){.mat-body{grid-template-columns:1fr}.mat-side{position:static}.mat-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function originLabel(material) {
  return material.aiGenerated ? 'AI 일일자료' : material.imported ? '관리자 등록' : '자료';
}

function listCard(material) {
  return `<button class="mat-card" data-id="${escHtml(material.id)}"><span class="mat-card__arrow">↗</span><div class="mat-meta"><span>${escHtml(material.category || '생활정보')}</span><span>${originLabel(material)}</span><span>조회 ${Number(material.viewCount || 0)}</span></div><div class="mat-title">${escHtml(material.title)}</div><div class="mat-text">${escHtml(material.summary)}</div></button>`;
}

export async function renderHistory() {
  setMeta('자료실', 'AI가 하루 한 번 만들고 관리자가 직접 등록하는 생활정보 자료실');
  styleOnce();
  const element = document.getElementById('page-content');
  if (!element) return;
  element.innerHTML = `<div class="mat-page"><div class="skeleton" style="height:170px;border-radius:25px"></div><div class="skeleton" style="height:430px;border-radius:22px"></div></div>`;

  const result = await call('getMaterials', { limit: 50 });
  const items = Array.isArray(result.materials) ? result.materials : [];
  element.innerHTML = `<div class="mat-page page-enter"><section class="mat-hero"><div class="mat-hero__eyebrow">MATERIAL ARCHIVE</div><h1>소소자료실</h1><p>AI가 매일 한 번 정리한 생활정보와 관리자가 직접 등록한 자료를 모아봅니다. 자료실은 정보 열람에 집중하고 찬반 토론은 별도 토론실에서 운영합니다.</p><div class="mat-actions" style="margin-top:14px"><button class="btn btn--ghost" data-go="/today">오늘의 콘텐츠</button><button class="btn btn--ghost" data-go="/debates">토론실</button></div></section><div class="mat-grid">${items.length ? items.map(listCard).join('') : '<div class="empty-state"><div class="empty-state__title">등록된 자료가 없습니다.</div><div class="empty-state__desc">AI 일일 생성 또는 관리자 등록 후 표시됩니다.</div></div>'}</div></div>`;
  element.querySelectorAll('[data-id]').forEach(button => button.addEventListener('click', () => navigate(`/material/${button.dataset.id}`)));
  element.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
}

export async function renderMaterialDetail(id) {
  styleOnce();
  const element = document.getElementById('page-content');
  if (!element) return;
  element.innerHTML = `<div class="mat-page"><div class="skeleton" style="height:560px;border-radius:25px"></div></div>`;

  const result = await call('getMaterial', { materialId: id });
  if (!result.ok || !result.material) {
    element.innerHTML = '<div class="empty-state"><div class="empty-state__title">자료를 찾을 수 없습니다.</div><button class="btn btn--primary" id="back-materials">자료실로</button></div>';
    element.querySelector('#back-materials')?.addEventListener('click', () => navigate('/materials'));
    return;
  }

  const material = result.material;
  setMeta(material.title, material.summary);
  const tags = Array.isArray(material.tags) ? material.tags : [];
  const body = Array.isArray(material.body) ? material.body : [];
  const guides = Array.isArray(material.sourceGuide) ? material.sourceGuide : [];

  element.innerHTML = `<div class="mat-page page-enter"><section class="mat-hero"><button class="btn btn--ghost btn--sm" id="mat-back">← 자료실</button><div class="mat-hero__eyebrow" style="margin-top:18px">${material.aiGenerated ? 'AI DAILY MATERIAL' : 'ADMIN MATERIAL'}</div><h1>${escHtml(material.title)}</h1><p>${escHtml(material.summary)}</p><div class="mat-tags" style="margin-top:13px"><span class="mat-chip">${escHtml(material.category)}</span>${tags.map(tag => `<span class="mat-chip">#${escHtml(tag)}</span>`).join('')}</div></section><div class="mat-body"><div class="mat-main"><section class="mat-panel"><h2>핵심 정리</h2>${body.map((paragraph, index) => `<div class="mat-point"><span class="mat-point__num">${index + 1}</span><p>${escHtml(paragraph)}</p></div>`).join('')}</section><section class="mat-panel mat-disclaimer"><h2>이용 안내</h2><p>${escHtml(material.disclaimer || '일반적인 생활정보이며 개별 상황에 대한 전문적인 판단을 대신하지 않습니다.')}</p></section></div><aside class="mat-side"><section class="mat-panel"><h2>자료 정보</h2><p class="mat-source"><b>등록 방식</b><br>${escHtml(originLabel(material))}</p><p class="mat-source"><b>출처 표시</b><br>${escHtml(material.sourceName || '소소킹')}</p>${material.sourceUrl ? `<a class="btn btn--ghost btn--sm" href="${escHtml(material.sourceUrl)}" target="_blank" rel="noopener noreferrer">출처 열기</a>` : ''}</section><section class="mat-panel"><h2>추가 확인 항목</h2><div class="mat-tags">${guides.length ? guides.map(guide => `<span class="mat-chip">${escHtml(guide)}</span>`).join('') : '<span class="mat-source">별도 검색어가 없습니다.</span>'}</div></section><section class="mat-panel"><h2>의견을 나누고 싶다면</h2><p class="mat-source">자료실과 별도로 운영되는 토론실에서 오늘의 찬반 주제에 참여할 수 있습니다.</p><button class="btn btn--primary" id="go-debates">토론실 열기</button></section></aside></div></div>`;
  element.querySelector('#mat-back')?.addEventListener('click', () => navigate('/materials'));
  element.querySelector('#go-debates')?.addEventListener('click', () => navigate('/debates'));
}
