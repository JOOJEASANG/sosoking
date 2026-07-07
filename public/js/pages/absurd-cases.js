import { ABSURD_CASES, ABSURD_CASE_CATEGORIES } from '../data/absurd-cases.js?v=20260707-1';
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
      <div style="font-size:11px;color:var(--gold);font-weight:900;letter-spacing:.14em;margin-bottom:7px;">SOSOKING ORIGINAL CASES</div>
      <div style="font-family:var(--font-serif);font-size:24px;font-weight:900;color:var(--gold);line-height:1.35;margin-bottom:8px;">황당사례 모음</div>
      <div style="font-size:13px;color:var(--cream-dim);line-height:1.75;">
        회원 글이 없어도 바로 재판받아볼 수 있는 소소킹 오리지널 사례입니다.<br>
        마음에 드는 사례를 골라 <b style="color:var(--cream);">이 사례로 재판받기</b>를 누르면 접수 화면에 자동 입력됩니다.
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;font-size:11px;color:var(--cream-dim);">
        <span style="border:1px solid rgba(201,168,76,.35);border-radius:999px;padding:6px 9px;background:rgba(201,168,76,.08);">총 ${ABSURD_CASES.length}개</span>
        <span style="border:1px solid rgba(201,168,76,.35);border-radius:999px;padding:6px 9px;background:rgba(201,168,76,.08);">실제 인물·사건 무관</span>
        <span style="border:1px solid rgba(201,168,76,.35);border-radius:999px;padding:6px 9px;background:rgba(201,168,76,.08);">오락용 황당재판</span>
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
        <div style="font-size:11px;color:var(--gold);font-weight:900;letter-spacing:.1em;margin-bottom:5px;">${escapeHtml(c.id.toUpperCase())} · ${ICONS[c.category] || '📁'} ${escapeHtml(c.category)}</div>
        <h2 style="font-family:var(--font-serif);font-size:18px;line-height:1.42;margin:0;color:var(--cream);font-weight:900;">${escapeHtml(c.title)}</h2>
      </div>
      <div style="font-size:18px;opacity:.86;">${ICONS[c.category] || '⚖️'}</div>
    </div>
    <p style="margin:0 0 12px;font-size:13px;color:var(--cream-dim);line-height:1.65;">${escapeHtml(compactText(c.summary, 118))}</p>
    <div style="display:grid;grid-template-columns:1fr;gap:7px;margin-bottom:13px;font-size:12px;line-height:1.55;">
      <div style="border-left:2px solid rgba(201,168,76,.45);padding-left:9px;color:var(--cream-dim);"><b style="color:var(--gold);">원고</b> ${escapeHtml(c.plaintiffClaim)}</div>
      <div style="border-left:2px solid rgba(255,255,255,.12);padding-left:9px;color:var(--cream-dim);"><b style="color:var(--cream);">피고</b> ${escapeHtml(c.defendantExcuse)}</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;">
      <span style="font-size:12px;color:var(--cream-dim);">억울지수 ${escapeHtml(c.grievanceIndex)}/10 · 오리지널 사례</span>
      <button type="button" class="btn btn-primary absurd-start" data-id="${escapeHtml(c.id)}" style="padding:9px 12px;font-size:12px;min-width:auto;">이 사례로 재판받기</button>
    </div>
  </article>`;
}

function filterCases(state) {
  const q = state.q.trim().toLowerCase();
  return ABSURD_CASES.filter(c => {
    const matchCat = state.cat === '전체' || c.category === state.cat;
    const text = `${c.title} ${c.summary} ${c.plaintiffClaim} ${c.defendantExcuse} ${c.category}`.toLowerCase();
    return matchCat && (!q || text.includes(q));
  });
}

function setDraftAndGo(c) {
  const title = c.title.length > 40 ? c.title.slice(0, 39) : c.title;
  const desc = c.caseDescription.length > 320 ? c.caseDescription.slice(0, 319) : c.caseDescription;
  sessionStorage.setItem('sosoking.seedCaseDraft', JSON.stringify({
    source: 'absurd-cases',
    title,
    caseDescription: desc,
    grievanceIndex: c.grievanceIndex,
    desiredVerdict: c.desiredVerdict,
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
          <input id="absurd-case-search" class="form-input" type="search" placeholder="예: 라면, 읽씹, 지각, 택배, 냉장고" style="margin-bottom:10px;">
          ${categoryTabs('전체')}
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;color:var(--cream-dim);">
            <span id="absurd-case-count"></span>
            <button type="button" id="absurd-random" style="border:1px solid rgba(201,168,76,.45);background:rgba(201,168,76,.09);color:var(--gold);border-radius:999px;padding:7px 10px;font-size:12px;font-weight:900;cursor:pointer;">🎲 랜덤 사례</button>
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
      : `<div style="text-align:center;padding:48px 0;color:var(--cream-dim);">검색 결과가 없습니다.</div>`;
  }

  search.addEventListener('input', () => {
    state.q = search.value || '';
    renderList();
  });

  document.getElementById('absurd-case-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.absurd-tab');
    if (!btn) return;
    state.cat = btn.dataset.cat || '전체';
    document.querySelectorAll('.absurd-tab').forEach(el => {
      const active = el.dataset.cat === state.cat;
      el.style.borderColor = active ? 'rgba(201,168,76,.75)' : 'var(--border)';
      el.style.background = active ? 'rgba(201,168,76,.16)' : 'rgba(255,255,255,.035)';
      el.style.color = active ? 'var(--gold)' : 'var(--cream-dim)';
    });
    renderList();
  });

  document.getElementById('absurd-random').addEventListener('click', () => {
    const rows = filterCases(state);
    const picked = rows[Math.floor(Math.random() * rows.length)] || ABSURD_CASES[0];
    const card = document.querySelector(`[data-id="${picked.id}"]`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  list.addEventListener('click', e => {
    const btn = e.target.closest('.absurd-start');
    if (!btn) return;
    const c = ABSURD_CASES.find(x => x.id === btn.dataset.id);
    if (c) setDraftAndGo(c);
  });

  renderList();
}
