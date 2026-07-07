import { ABSURD_CASES, ABSURD_CASE_CATEGORIES } from '../data/absurd-cases.js?v=20260707-2';
import { escapeHtml, compactText } from '../utils/sanitize.js?v=20260630-3';

const ICONS = {
  '음식': '🍜',
  '배달·택배': '📦',
  '카톡·SNS': '💬',
  '가족': '🏠',
  '친구': '🤝',
  '직장': '💼',
  '학교': '🎒',
  '이웃': '🏢',
  '공동생활': '🧹',
  '약속·지각': '⏰'
};

function introCard() {
  return `
    <div class="card" style="padding:20px;margin-bottom:16px;border-color:rgba(201,168,76,.5);background:linear-gradient(135deg,rgba(201,168,76,.13),rgba(255,255,255,.025));">
      <div style="font-size:11px;color:var(--gold);font-weight:900;letter-spacing:.14em;margin-bottom:7px;">SOSOKING CASE COLLECTION</div>
      <div style="font-family:var(--font-serif);font-size:24px;font-weight:900;color:var(--gold);line-height:1.35;margin-bottom:8px;">황당사례 모음</div>
      <div style="font-size:13px;color:var(--cream-dim);line-height:1.75;">
        사소하지만 이상하게 억울한 사례를 모아두는 공간입니다.<br>
        현재 등록된 사례 데이터는 없습니다.
      </div>
    </div>`;
}

function categoryTabs(active) {
  const tabs = ['전체', ...ABSURD_CASE_CATEGORIES];
  return `<div id="absurd-case-tabs" style="display:flex;gap:7px;overflow-x:auto;padding:2px 0 12px;margin-bottom:8px;">
    ${tabs.map(cat => `<button type="button" class="absurd-tab" data-cat="${escapeHtml(cat)}" style="white-space:nowrap;border:1px solid ${cat === active ? 'rgba(201,168,76,.75)' : 'var(--border)'};background:${cat === active ? 'rgba(201,168,76,.16)' : 'rgba(255,255,255,.035)'};color:${cat === active ? 'var(--gold)' : 'var(--cream-dim)'};border-radius:999px;padding:9px 11px;font-size:12px;font-weight:900;cursor:pointer;">${cat === '전체' ? '⚖️' : ICONS[cat] || '📁'} ${escapeHtml(cat)}</button>`).join('')}
  </div>`;
}

function caseCard(c) {
  return `<article class="card absurd-case-card" data-id="${escapeHtml(c.id)}" style="padding:16px 17px;position:relative;overflow:hidden;">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:8px;">
      <div style="min-width:0;">
        <div style="font-size:11px;color:var(--gold);font-weight:900;letter-spacing:.1em;margin-bottom:5px;">${escapeHtml(String(c.id || '').toUpperCase())} · ${ICONS[c.category] || '📁'} ${escapeHtml(c.category || '기타')}</div>
        <h2 style="font-family:var(--font-serif);font-size:18px;line-height:1.42;margin:0;color:var(--cream);font-weight:900;">${escapeHtml(c.title || '제목 없음')}</h2>
      </div>
      <div style="font-size:18px;opacity:.86;">${ICONS[c.category] || '⚖️'}</div>
    </div>
    <p style="margin:0 0 12px;font-size:13px;color:var(--cream-dim);line-height:1.65;">${escapeHtml(compactText(c.summary || c.caseDescription || '', 118))}</p>
    <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;">
      <span style="font-size:12px;color:var(--cream-dim);">억울지수 ${escapeHtml(c.grievanceIndex || '?')}/10</span>
      <button type="button" class="btn btn-primary absurd-start" data-id="${escapeHtml(c.id)}" style="padding:9px 12px;font-size:12px;min-width:auto;">이 사례로 재판받기</button>
    </div>
  </article>`;
}

function filterCases(state) {
  const q = state.q.trim().toLowerCase();
  return ABSURD_CASES.filter(c => {
    const matchCat = state.cat === '전체' || c.category === state.cat;
    const text = `${c.title || ''} ${c.summary || ''} ${c.caseDescription || ''} ${c.category || ''}`.toLowerCase();
    return matchCat && (!q || text.includes(q));
  });
}

function setDraftAndGo(c) {
  sessionStorage.setItem('sosoking.seedCaseDraft', JSON.stringify({
    source: 'absurd-cases',
    title: String(c.title || '').slice(0, 40),
    caseDescription: String(c.caseDescription || c.summary || '').slice(0, 320),
    grievanceIndex: c.grievanceIndex || 5,
    desiredVerdict: c.desiredVerdict || '',
    isPublic: true
  }));
  location.hash = '#/submit';
}

export function renderAbsurdCases(container) {
  const state = { cat: '전체', q: '' };
  container.innerHTML = `
    <div>
      <div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">황당사례 모음</span></div>
      <div class="container" style="padding-top:22px;padding-bottom:96px;">
        ${introCard()}
        <div class="card" style="padding:13px;margin-bottom:14px;background:rgba(255,255,255,.025);">
          <input id="absurd-case-search" class="form-input" type="search" placeholder="사례 검색" style="margin-bottom:10px;">
          ${categoryTabs('전체')}
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;color:var(--cream-dim);">
            <span id="absurd-case-count"></span>
          </div>
        </div>
        <div id="absurd-case-list" style="display:flex;flex-direction:column;gap:10px;"></div>
      </div>
    </div>`;

  const list = document.getElementById('absurd-case-list');
  const count = document.getElementById('absurd-case-count');
  const search = document.getElementById('absurd-case-search');

  function renderList() {
    const rows = filterCases(state);
    count.textContent = `${state.cat} · ${rows.length}개 사례`;
    list.innerHTML = rows.length
      ? rows.map(caseCard).join('')
      : `<div class="card" style="text-align:center;padding:42px 18px;color:var(--cream-dim);line-height:1.7;">
          <div style="font-size:42px;margin-bottom:10px;">📭</div>
          아직 등록된 황당사례가 없습니다.<br>
          <span style="font-size:12px;opacity:.72;">원하는 데이터만 추후 추가할 수 있습니다.</span>
        </div>`;
  }

  search.addEventListener('input', () => {
    state.q = search.value || '';
    renderList();
  });

  document.getElementById('absurd-case-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.absurd-tab');
    if (!btn) return;
    state.cat = btn.dataset.cat || '전체';
    renderList();
  });

  list.addEventListener('click', e => {
    const btn = e.target.closest('.absurd-start');
    if (!btn) return;
    const c = ABSURD_CASES.find(x => x.id === btn.dataset.id);
    if (c) setDraftAndGo(c);
  });

  renderList();
}
