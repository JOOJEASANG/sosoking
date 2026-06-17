import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { appState } from '../state.js';
import { toast } from '../components/toast.js';
import { navigate } from '../router.js';
import { escHtml } from '../utils/helpers.js';

let currentTab = 'dashboard';

function isAdmin() { return !!appState.isAdmin; }
function call(name, payload = {}) { return httpsCallable(functions, name)(payload).then(res => res.data || {}).catch(error => ({ ok: false, error })); }
function textList(value) { return String(value || '').split('\n').map(v => v.trim()).filter(Boolean); }
function csvList(value) { return String(value || '').split(',').map(v => v.trim()).filter(Boolean); }

function ensureAdminStyle() {
  if (document.getElementById('soso-admin-style')) return;
  const s = document.createElement('style');
  s.id = 'soso-admin-style';
  s.textContent = `
    .soso-admin{display:grid;grid-template-columns:250px 1fr;gap:14px;min-height:calc(100vh - 120px)}.soso-admin-side{border:1px solid rgba(100,116,139,.16);border-radius:24px;background:var(--color-surface,#fff);padding:14px;box-shadow:0 10px 26px rgba(15,23,42,.055)}.soso-admin-brand{display:flex;gap:10px;align-items:center;margin-bottom:14px}.soso-admin-brand b{display:block;font-size:18px;color:var(--color-text-primary)}.soso-admin-brand span{display:block;font-size:12px;color:var(--color-text-muted);margin-top:2px}.soso-admin-nav{display:grid;gap:8px}.soso-admin-nav button{border:0;border-radius:16px;background:transparent;padding:11px 12px;text-align:left;font-family:inherit;font-weight:900;color:var(--color-text-secondary);cursor:pointer}.soso-admin-nav button.active{background:rgba(47,125,110,.10);color:#2f7d6e}.soso-admin-main{min-width:0}.soso-admin-section{display:grid;gap:14px}.soso-admin-card{border:1px solid rgba(100,116,139,.16);border-radius:24px;background:var(--color-surface,#fff);padding:16px;box-shadow:0 10px 26px rgba(15,23,42,.055)}.soso-admin-title{font-size:22px;font-weight:1000;color:var(--color-text-primary);margin-bottom:6px}.soso-admin-sub{font-size:13px;line-height:1.55;color:var(--color-text-secondary)}.soso-admin-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.soso-admin-stat{border-radius:20px;background:rgba(248,250,252,.82);padding:14px;border:1px solid rgba(100,116,139,.12)}.soso-admin-stat b{display:block;font-size:24px;color:var(--color-text-primary)}.soso-admin-stat span{font-size:12px;color:var(--color-text-muted)}.soso-admin-form{display:grid;gap:10px}.soso-admin-form label{display:grid;gap:5px;font-size:12px;font-weight:900;color:var(--color-text-secondary)}.soso-admin-form input,.soso-admin-form textarea,.soso-admin-form select{width:100%;font-family:inherit}.soso-admin-form textarea{min-height:90px;resize:vertical}.soso-admin-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.soso-admin-list{display:grid;gap:10px}.soso-admin-item{border:1px solid rgba(100,116,139,.14);border-radius:18px;background:rgba(248,250,252,.82);padding:13px}.soso-admin-item__meta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:7px}.soso-admin-item__meta span{border-radius:999px;background:rgba(47,125,110,.10);color:#2f7d6e;padding:5px 8px;font-size:11px;font-weight:1000}.soso-admin-item b{display:block;color:var(--color-text-primary);font-size:15px;margin-bottom:4px}.soso-admin-item p{margin:0;font-size:13px;line-height:1.55;color:var(--color-text-secondary)}@media(max-width:880px){.soso-admin{grid-template-columns:1fr}.soso-admin-stats,.soso-admin-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(s);
}

export async function renderAdmin() {
  ensureAdminStyle();
  const el = document.getElementById('page-content');
  const user = appState.user || auth.currentUser;
  if (!user) { navigate('/login'); return; }
  if (!isAdmin()) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state__icon">🔒</div><div class="empty-state__title">관리자 전용 페이지입니다</div></div>';
    return;
  }
  const menus = [
    { key: 'dashboard', label: '📊 현황' },
    { key: 'materials', label: '📚 자료 관리' },
    { key: 'create', label: '✍️ 자료 등록' },
    { key: 'generate', label: '📰 오늘자료 생성' },
  ];
  el.innerHTML = `<div class="soso-admin"><aside class="soso-admin-side"><div class="soso-admin-brand"><img src="/logo.svg" alt="" width="34" height="34"><div><b>소소킹</b><span>자료·토론 관리자</span></div></div><nav class="soso-admin-nav">${menus.map(m => `<button data-tab="${m.key}" class="${currentTab === m.key ? 'active' : ''}">${m.label}</button>`).join('')}</nav><button class="btn btn--ghost" id="admin-home" style="width:100%;margin-top:14px">사이트 홈으로</button></aside><main id="soso-admin-content" class="soso-admin-main"><div class="soso-admin-card">불러오는 중입니다.</div></main></div>`;
  el.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => { currentTab = btn.dataset.tab; el.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === currentTab)); loadTab(currentTab); }));
  el.querySelector('#admin-home')?.addEventListener('click', () => navigate('/'));
  loadTab(currentTab);
}

async function loadTab(tab) {
  const el = document.getElementById('soso-admin-content');
  if (!el) return;
  el.innerHTML = '<div class="soso-admin-card">불러오는 중입니다.</div>';
  if (tab === 'dashboard') return renderDashboard(el);
  if (tab === 'materials') return renderMaterials(el);
  if (tab === 'create') return renderCreate(el);
  if (tab === 'generate') return renderGenerate(el);
}

async function renderDashboard(el) {
  const today = await call('getTodayMaterials');
  const all = await call('getMaterials', { limit: 12 });
  const todayItems = Array.isArray(today.materials) ? today.materials : [];
  const allItems = Array.isArray(all.materials) ? all.materials : [];
  const comments = allItems.reduce((sum, m) => sum + Number(m.commentCount || 0), 0);
  const votes = allItems.reduce((sum, m) => sum + Number(m.agreeCount || 0) + Number(m.disagreeCount || 0), 0);
  el.innerHTML = `<div class="soso-admin-section"><div class="soso-admin-card"><div class="soso-admin-title">📊 소소킹 현황</div><div class="soso-admin-sub">소소한 논쟁커뮤니티의 자료 생성과 참여 상태를 확인합니다.</div></div><div class="soso-admin-stats"><div class="soso-admin-stat"><b>${todayItems.length}</b><span>오늘자료</span></div><div class="soso-admin-stat"><b>${votes}</b><span>최근 자료 투표</span></div><div class="soso-admin-stat"><b>${comments}</b><span>최근 자료 댓글</span></div></div><div class="soso-admin-card"><div class="soso-admin-title">오늘 생성된 자료</div><div class="soso-admin-list">${todayItems.length ? todayItems.map(adminItem).join('') : '<div class="soso-admin-sub">오늘 자료가 아직 없습니다.</div>'}</div></div></div>`;
}

async function renderMaterials(el) {
  const res = await call('getMaterials', { limit: 40 });
  const items = Array.isArray(res.materials) ? res.materials : [];
  el.innerHTML = `<div class="soso-admin-section"><div class="soso-admin-card"><div class="soso-admin-title">📚 자료 관리</div><div class="soso-admin-sub">현재 공개된 자료 목록입니다. 상세 수정/숨김 기능은 다음 단계에서 추가합니다.</div></div><div class="soso-admin-card"><div class="soso-admin-list">${items.length ? items.map(adminItem).join('') : '<div class="soso-admin-sub">등록된 자료가 없습니다.</div>'}</div></div></div>`;
}

function adminItem(m) {
  return `<div class="soso-admin-item"><div class="soso-admin-item__meta"><span>${escHtml(m.category || '생활논쟁')}</span><span>찬성 ${Number(m.agreeCount || 0)}</span><span>반대 ${Number(m.disagreeCount || 0)}</span><span>댓글 ${Number(m.commentCount || 0)}</span></div><b>${escHtml(m.title || '')}</b><p>${escHtml(m.summary || '')}</p><button class="btn btn--ghost btn--sm" style="margin-top:8px" onclick="navigate('/material/${escHtml(m.id)}')">상세 보기</button></div>`;
}

function renderCreate(el) {
  el.innerHTML = `<div class="soso-admin-section"><div class="soso-admin-card"><div class="soso-admin-title">✍️ 실제자료/수동자료 등록</div><div class="soso-admin-sub">URL, 출처, 핵심 정리, 찬반 논점을 직접 입력해 자료로 공개합니다. 기사 전문 복사는 피하고 요약과 출처 링크 중심으로 등록하세요.</div></div><div class="soso-admin-card"><form class="soso-admin-form" id="material-form"><div class="soso-admin-grid"><label>카테고리<select name="category"><option>생활분쟁</option><option>민원·신고</option><option>소송·법률</option><option>소비자</option><option>부동산·계약</option><option>기타</option></select></label><label>출처명<input name="sourceName" placeholder="예: 공공기관 안내, 직접 작성, 기사명"></label></div><label>원문/출처 URL<input name="sourceUrl" placeholder="https://"></label><label>제목<input name="title" required maxlength="100" placeholder="자료 제목"></label><label>요약<textarea name="summary" required maxlength="240" placeholder="한두 문장으로 요약"></textarea></label><label>핵심 정리<textarea name="body" placeholder="줄바꿈으로 여러 줄 입력"></textarea></label><div class="soso-admin-grid"><label>찬성 제목<input name="agreeTitle" placeholder="예: 신고해야 한다"></label><label>반대 제목<input name="disagreeTitle" placeholder="예: 신중해야 한다"></label></div><div class="soso-admin-grid"><label>찬성 설명<textarea name="agreeText"></textarea></label><label>반대 설명<textarea name="disagreeText"></textarea></label></div><label>토론 질문<textarea name="questions" placeholder="줄바꿈으로 여러 질문 입력"></textarea></label><label>더 찾아볼 검색어<textarea name="sourceGuide" placeholder="줄바꿈으로 검색어 입력"></textarea></label><label>태그<input name="tags" placeholder="쉼표로 구분: 주차, 신고, 손해배상"></label><button class="btn btn--primary" type="submit">자료 등록</button></form></div></div>`;
  el.querySelector('#material-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      category: fd.get('category'), sourceName: fd.get('sourceName'), sourceUrl: fd.get('sourceUrl'), title: fd.get('title'), summary: fd.get('summary'), body: textList(fd.get('body')),
      agreeTitle: fd.get('agreeTitle') || '찬성', agreeText: fd.get('agreeText'), disagreeTitle: fd.get('disagreeTitle') || '반대', disagreeText: fd.get('disagreeText'), questions: textList(fd.get('questions')), sourceGuide: textList(fd.get('sourceGuide')), tags: csvList(fd.get('tags')),
    };
    const out = await call('adminCreateMaterial', payload);
    if (!out.ok) { toast.error(out.error?.message || '자료 등록에 실패했습니다.'); return; }
    toast.success('자료를 등록했습니다.');
    navigate(`/material/${out.id}`);
  });
}

function renderGenerate(el) {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  el.innerHTML = `<div class="soso-admin-section"><div class="soso-admin-card"><div class="soso-admin-title">📰 오늘자료 생성</div><div class="soso-admin-sub">기본 주제 풀에서 하루 3개 자료를 생성합니다. 이미 생성된 날짜는 강제 재생성을 선택해야 덮어씁니다.</div></div><div class="soso-admin-card"><form class="soso-admin-form" id="generate-form"><label>생성 날짜<input name="date" value="${date}"></label><label><span><input type="checkbox" name="force"> 기존 자료 덮어쓰기</span></label><button class="btn btn--primary" type="submit">오늘자료 생성</button></form><div id="generate-result" style="margin-top:12px"></div></div></div>`;
  el.querySelector('#generate-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const out = await call('triggerDailyMaterials', { date: fd.get('date'), force: !!fd.get('force') });
    if (!out.ok) { toast.error(out.error?.message || '생성에 실패했습니다.'); return; }
    toast.success('오늘자료를 생성했습니다.');
    document.getElementById('generate-result').innerHTML = `<div class="soso-admin-item"><b>생성 완료</b><p>${escHtml(out.date || '')} · ${(out.materialIds || []).map(escHtml).join(', ')}</p></div>`;
  });
}
