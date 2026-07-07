import { db } from '../firebase.js?v=20260630-3';
import { collection, getDocs, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { escapeHtml, compactText } from '../utils/sanitize.js?v=20260630-3';

const ICONS = {
  '음식': '🍜', '배달·택배': '📦', '카톡·SNS': '💬', '가족': '🏠', '친구': '🤝',
  '직장': '💼', '학교': '🎒', '이웃': '🏢', '공동생활': '🧹', '약속·지각': '⏰', '기타': '⚖️'
};

let CASES_CACHE = [];
let CATEGORIES_CACHE = ['전체'];

async function loadCases() {
  try {
    const snap = await getDocs(query(collection(db, 'absurd_cases'), orderBy('createdAt', 'desc'), limit(200)));
    CASES_CACHE = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(c => c.isPublic !== false);
  } catch (err) {
    console.warn('absurd cases load failed', err);
    CASES_CACHE = [];
  }
  CATEGORIES_CACHE = ['전체', ...new Set(CASES_CACHE.map(c => c.category || '기타'))];
  return CASES_CACHE;
}

function introCard() {
  return `
    <div class="card" style="padding:20px;margin-bottom:16px;border-color:rgba(201,168,76,.5);background:linear-gradient(135deg,rgba(201,168,76,.13),rgba(255,255,255,.025));">
      <div style="font-size:11px;color:var(--gold);font-weight:900;letter-spacing:.14em;margin-bottom:7px;">SOSOKING ABSURD CASE VAULT</div>
      <div style="font-family:var(--font-serif);font-size:24px;font-weight:900;color:var(--gold);line-height:1.35;margin-bottom:8px;">황당사례 보관소</div>
      <div style="font-size:13px;color:var(--cream-dim);line-height:1.75;">
        별일 아닌데 이상하게 마음에 남는 사건들을 소소킹식으로 모았습니다.<br>
        마음에 걸리는 사례를 고르면 접수 화면으로 보내 <b style="color:var(--cream);">쓸데없이 진지한 재판</b>을 받을 수 있습니다.
      </div>
      <div style="font-size:12px;color:var(--gold);margin-top:12px;line-height:1.6;">“이런 걸로 재판까지?” 싶으면 정상입니다. 그게 바로 소소킹 관할입니다.</div>
    </div>`;
}

function categoryTabs(active) {
  return `<div id="absurd-case-tabs" style="display:flex;gap:7px;overflow-x:auto;padding:2px 0 12px;margin-bottom:8px;">
    ${CATEGORIES_CACHE.map(cat => `<button type="button" class="absurd-tab" data-cat="${escapeHtml(cat)}" style="white-space:nowrap;border:1px solid ${cat === active ? 'rgba(201,168,76,.75)' : 'var(--border)'};background:${cat === active ? 'rgba(201,168,76,.16)' : 'rgba(255,255,255,.035)'};color:${cat === active ? 'var(--gold)' : 'var(--cream-dim)'};border-radius:999px;padding:9px 11px;font-size:12px;font-weight:900;cursor:pointer;">${cat === '전체' ? '⚖️' : ICONS[cat] || '📁'} ${escapeHtml(cat)}</button>`).join('')}
  </div>`;
}

function levelText(n) {
  const v = Number(n || 5);
  if (v >= 9) return '마음속 대법원행';
  if (v >= 7) return '표정만 봐도 유죄 느낌';
  if (v >= 5) return '그냥 넘기긴 애매함';
  return '민망하지만 접수 가능';
}

function caseCard(c) {
  const title = c.title || '제목 없음';
  const summary = c.summary || c.caseDescription || '';
  return `<article class="card absurd-case-card" data-id="${escapeHtml(c.id)}" style="padding:17px 18px;position:relative;overflow:hidden;border-color:rgba(201,168,76,.22);">
    <div style="position:absolute;right:-18px;top:-22px;font-size:88px;opacity:.035;transform:rotate(-12deg);">⚖️</div>
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:9px;position:relative;">
      <div style="min-width:0;">
        <div style="font-size:11px;color:var(--gold);font-weight:900;letter-spacing:.1em;margin-bottom:5px;">소소킹 접수 대기 · ${ICONS[c.category] || '📁'} ${escapeHtml(c.category || '기타')}</div>
        <h2 style="font-family:var(--font-serif);font-size:18px;line-height:1.42;margin:0;color:var(--cream);font-weight:900;">${escapeHtml(title)}</h2>
      </div>
      <div style="font-size:20px;opacity:.9;">${ICONS[c.category] || '⚖️'}</div>
    </div>
    <p style="margin:0 0 12px;font-size:13px;color:var(--cream-dim);line-height:1.68;position:relative;">${escapeHtml(compactText(summary, 140))}</p>
    <div style="display:grid;grid-template-columns:1fr;gap:7px;margin-bottom:13px;font-size:12px;line-height:1.55;position:relative;">
      ${c.plaintiffClaim ? `<div style="border-left:2px solid rgba(201,168,76,.55);padding-left:9px;color:var(--cream-dim);"><b style="color:var(--gold);">원고의 절규</b> ${escapeHtml(c.plaintiffClaim)}</div>` : ''}
      ${c.defendantExcuse ? `<div style="border-left:2px solid rgba(255,255,255,.12);padding-left:9px;color:var(--cream-dim);"><b style="color:var(--cream);">피고의 항변</b> ${escapeHtml(c.defendantExcuse)}</div>` : ''}
    </div>
    <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;position:relative;">
      <span style="font-size:12px;color:var(--cream-dim);">억울함 ${escapeHtml(c.grievanceIndex || '?')}/10 · ${escapeHtml(levelText(c.grievanceIndex))}</span>
      <button type="button" class="btn btn-primary absurd-start" data-id="${escapeHtml(c.id)}" style="padding:9px 12px;font-size:12px;min-width:auto;">이 사건으로 재판받기</button>
    </div>
  </article>`;
}

function filterCases(state) {
  const q = state.q.trim().toLowerCase();
  return CASES_CACHE.filter(c => {
    const matchCat = state.cat === '전체' || c.category === state.cat;
    const text = `${c.title || ''} ${c.summary || ''} ${c.caseDescription || ''} ${c.plaintiffClaim || ''} ${c.defendantExcuse || ''} ${c.category || ''}`.toLowerCase();
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

export async function renderAbsurdCases(container) {
  const state = { cat: '전체', q: '' };
  container.innerHTML = `
    <div>
      <div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">황당사례 보관소</span></div>
      <div class="container" style="padding-top:22px;padding-bottom:96px;">
        ${introCard()}
        <div class="card" style="padding:28px;text-align:center;color:var(--cream-dim);"><div class="loading-dots"><span></span><span></span><span></span></div></div>
      </div>
    </div>`;

  await loadCases();

  container.querySelector('.container').innerHTML = `
    ${introCard()}
    <div class="card" style="padding:13px;margin-bottom:14px;background:rgba(255,255,255,.025);">
      <input id="absurd-case-search" class="form-input" type="search" placeholder="라면, 읽씹, 지각, 택배, 치킨 다리 검색" style="margin-bottom:10px;">
      ${categoryTabs('전체')}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;color:var(--cream-dim);">
        <span id="absurd-case-count"></span>
      </div>
    </div>
    <div id="absurd-case-list" style="display:flex;flex-direction:column;gap:10px;"></div>`;

  const list = document.getElementById('absurd-case-list');
  const count = document.getElementById('absurd-case-count');
  const search = document.getElementById('absurd-case-search');

  function renderList() {
    const rows = filterCases(state);
    count.textContent = `${state.cat} 관할 · ${rows.length}건 대기 중`;
    list.innerHTML = rows.length
      ? rows.map(caseCard).join('')
      : `<div class="card" style="text-align:center;padding:42px 18px;color:var(--cream-dim);line-height:1.7;">
          <div style="font-size:42px;margin-bottom:10px;">📭</div>
          아직 등록된 황당사례가 없습니다.<br>
          <span style="font-size:12px;opacity:.72;">관리자 페이지에서 “이걸로 재판까지?” 싶은 사례를 등록해주세요.</span>
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
    document.querySelectorAll('.absurd-tab').forEach(el => {
      const active = el.dataset.cat === state.cat;
      el.style.borderColor = active ? 'rgba(201,168,76,.75)' : 'var(--border)';
      el.style.background = active ? 'rgba(201,168,76,.16)' : 'rgba(255,255,255,.035)';
      el.style.color = active ? 'var(--gold)' : 'var(--cream-dim)';
    });
    renderList();
  });

  list.addEventListener('click', e => {
    const btn = e.target.closest('.absurd-start');
    if (!btn) return;
    const c = CASES_CACHE.find(x => x.id === btn.dataset.id);
    if (c) setDraftAndGo(c);
  });

  renderList();
}
