import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { appState } from '../state.js';
import { toast } from '../components/toast.js';
import { navigate } from '../router.js';
import { escHtml } from '../utils/helpers.js';

let currentTab = 'dashboard';

function isAdmin() { return !!appState.isAdmin; }
function call(name, payload = {}) { return httpsCallable(functions, name)(payload).then(response => response.data || {}).catch(error => ({ ok: false, error })); }
function textList(value) { return String(value || '').split('\n').map(item => item.trim()).filter(Boolean); }
function csvList(value) { return String(value || '').split(',').map(item => item.trim()).filter(Boolean); }

function ensureAdminStyle() {
  if (document.getElementById('soso-admin-style')) return;
  const style = document.createElement('style');
  style.id = 'soso-admin-style';
  style.textContent = `
    .soso-admin{display:grid;grid-template-columns:260px minmax(0,1fr);gap:15px;min-height:calc(100vh - 120px)}.soso-admin-side{position:sticky;top:18px;align-self:start;border:1px solid rgba(100,116,139,.16);border-radius:24px;background:var(--color-surface,#fff);padding:14px;box-shadow:0 10px 26px rgba(15,23,42,.055)}.soso-admin-brand{display:flex;gap:10px;align-items:center;margin-bottom:14px}.soso-admin-brand b{display:block;font-size:18px;color:var(--color-text-primary)}.soso-admin-brand span{display:block;font-size:12px;color:var(--color-text-muted);margin-top:2px}.soso-admin-nav{display:grid;gap:7px}.soso-admin-nav button{border:0;border-radius:15px;background:transparent;padding:11px 12px;text-align:left;font-family:inherit;font-weight:900;color:var(--color-text-secondary);cursor:pointer}.soso-admin-nav button.active{background:rgba(47,125,110,.10);color:#2f7d6e}.soso-admin-main{min-width:0}.soso-admin-section{display:grid;gap:14px}.soso-admin-card{border:1px solid rgba(100,116,139,.16);border-radius:24px;background:var(--color-surface,#fff);padding:17px;box-shadow:0 10px 26px rgba(15,23,42,.055)}.soso-admin-title{font-size:22px;font-weight:1000;color:var(--color-text-primary);margin-bottom:6px}.soso-admin-sub{font-size:13px;line-height:1.65;color:var(--color-text-secondary)}.soso-admin-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.soso-admin-stat{border-radius:20px;background:rgba(248,250,252,.82);padding:14px;border:1px solid rgba(100,116,139,.12)}.soso-admin-stat b{display:block;font-size:24px;color:var(--color-text-primary)}.soso-admin-stat span{font-size:12px;color:var(--color-text-muted)}.soso-admin-form{display:grid;gap:11px}.soso-admin-form label{display:grid;gap:6px;font-size:12px;font-weight:900;color:var(--color-text-secondary)}.soso-admin-form input,.soso-admin-form textarea,.soso-admin-form select{width:100%;font-family:inherit}.soso-admin-form textarea{min-height:96px;resize:vertical}.soso-admin-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.soso-admin-list{display:grid;gap:10px}.soso-admin-item{border:1px solid rgba(100,116,139,.14);border-radius:18px;background:rgba(248,250,252,.82);padding:13px}.soso-admin-item__meta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:7px}.soso-admin-item__meta span{border-radius:999px;background:rgba(47,125,110,.10);color:#2f7d6e;padding:5px 8px;font-size:10px;font-weight:1000}.soso-admin-item b{display:block;color:var(--color-text-primary);font-size:15px;margin-bottom:4px}.soso-admin-item p{margin:0;font-size:13px;line-height:1.6;color:var(--color-text-secondary)}.soso-admin-generate{display:grid;grid-template-columns:1fr 1fr;gap:12px}.soso-admin-generate .soso-admin-card{display:grid;align-content:start}.soso-admin-kind{display:inline-flex;width:max-content;border-radius:999px;padding:6px 9px;font-size:10px;font-weight:1000;background:rgba(47,125,110,.10);color:#2f7d6e;margin-bottom:10px}.soso-admin-kind--debate{background:rgba(224,93,68,.10);color:#c84431}@media(max-width:1000px){.soso-admin-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:880px){.soso-admin{grid-template-columns:1fr}.soso-admin-side{position:static}.soso-admin-nav{grid-template-columns:repeat(2,minmax(0,1fr))}.soso-admin-stats,.soso-admin-grid,.soso-admin-generate{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

const MENUS = [
  { key: 'dashboard', label: '📊 현황' },
  { key: 'materials', label: '📚 자료 목록' },
  { key: 'material-create', label: '✍️ 자료 직접등록' },
  { key: 'debates', label: '💬 토론 목록' },
  { key: 'debate-create', label: '🗣️ 토론 직접등록' },
  { key: 'generate', label: '🤖 AI 일일생성' },
];

export async function renderAdmin() {
  ensureAdminStyle();
  const element = document.getElementById('page-content');
  const user = appState.user || auth.currentUser;
  if (!user) { navigate('/login'); return; }
  if (!isAdmin()) {
    element.innerHTML = '<div class="empty-state"><div class="empty-state__icon">🔒</div><div class="empty-state__title">관리자 전용 페이지입니다</div></div>';
    return;
  }

  element.innerHTML = `<div class="soso-admin"><aside class="soso-admin-side"><div class="soso-admin-brand"><img src="/logo.svg" alt="" width="34" height="34"><div><b>소소킹</b><span>자료·토론 독립 관리자</span></div></div><nav class="soso-admin-nav">${MENUS.map(menu => `<button data-tab="${menu.key}" class="${currentTab === menu.key ? 'active' : ''}">${menu.label}</button>`).join('')}</nav><button class="btn btn--ghost" id="admin-home" style="width:100%;margin-top:14px">사이트 홈으로</button></aside><main id="soso-admin-content" class="soso-admin-main"><div class="soso-admin-card">불러오는 중입니다.</div></main></div>`;
  element.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
    currentTab = button.dataset.tab;
    element.querySelectorAll('[data-tab]').forEach(item => item.classList.toggle('active', item.dataset.tab === currentTab));
    loadTab(currentTab);
  }));
  element.querySelector('#admin-home')?.addEventListener('click', () => navigate('/'));
  loadTab(currentTab);
}

async function loadTab(tab) {
  const element = document.getElementById('soso-admin-content');
  if (!element) return;
  element.innerHTML = '<div class="soso-admin-card">불러오는 중입니다.</div>';
  if (tab === 'dashboard') return renderDashboard(element);
  if (tab === 'materials') return renderMaterials(element);
  if (tab === 'material-create') return renderMaterialCreate(element);
  if (tab === 'debates') return renderDebates(element);
  if (tab === 'debate-create') return renderDebateCreate(element);
  if (tab === 'generate') return renderGenerate(element);
}

function materialItem(material) {
  return `<div class="soso-admin-item"><div class="soso-admin-item__meta"><span>${escHtml(material.category || '생활정보')}</span><span>${material.aiGenerated ? 'AI 생성' : '직접 등록'}</span><span>조회 ${Number(material.viewCount || 0)}</span></div><b>${escHtml(material.title || '')}</b><p>${escHtml(material.summary || '')}</p><button class="btn btn--ghost btn--sm" data-open-material="${escHtml(material.id)}" style="margin-top:8px">상세 보기</button></div>`;
}

function debateItem(debate) {
  return `<div class="soso-admin-item"><div class="soso-admin-item__meta"><span>${escHtml(debate.category || '생활토론')}</span><span>${debate.aiGenerated ? 'AI 생성' : '직접 등록'}</span><span>투표 ${Number(debate.totalVotes || 0)}</span><span>댓글 ${Number(debate.commentCount || 0)}</span></div><b>${escHtml(debate.title || '')}</b><p>${escHtml(debate.summary || '')}</p><button class="btn btn--ghost btn--sm" data-open-debate="${escHtml(debate.id)}" style="margin-top:8px">상세 보기</button></div>`;
}

function bindOpenButtons(element) {
  element.querySelectorAll('[data-open-material]').forEach(button => button.addEventListener('click', () => navigate(`/material/${button.dataset.openMaterial}`)));
  element.querySelectorAll('[data-open-debate]').forEach(button => button.addEventListener('click', () => navigate(`/debate/${button.dataset.openDebate}`)));
}

async function renderDashboard(element) {
  const [todayMaterials, todayDebate, materials, debates] = await Promise.all([
    call('getTodayMaterials'),
    call('getTodayDebate'),
    call('getMaterials', { limit: 12 }),
    call('getDebates', { limit: 12, order: 'latest' }),
  ]);
  const materialToday = Array.isArray(todayMaterials.materials) ? todayMaterials.materials : [];
  const debateToday = todayDebate.debate ? [todayDebate.debate] : [];
  const materialItems = Array.isArray(materials.materials) ? materials.materials : [];
  const debateItems = Array.isArray(debates.debates) ? debates.debates : [];
  const totalVotes = debateItems.reduce((sum, item) => sum + Number(item.totalVotes || 0), 0);
  const totalComments = debateItems.reduce((sum, item) => sum + Number(item.commentCount || 0), 0);

  element.innerHTML = `<div class="soso-admin-section"><div class="soso-admin-card"><div class="soso-admin-title">📊 자료·토론 운영 현황</div><div class="soso-admin-sub">자료실과 토론실은 별도 컬렉션과 별도 생성 일정로 운영됩니다.</div></div><div class="soso-admin-stats"><div class="soso-admin-stat"><b>${materialToday.length}</b><span>오늘 자료</span></div><div class="soso-admin-stat"><b>${debateToday.length}</b><span>오늘 토론</span></div><div class="soso-admin-stat"><b>${totalVotes}</b><span>최근 토론 투표</span></div><div class="soso-admin-stat"><b>${totalComments}</b><span>최근 토론 댓글</span></div></div><div class="soso-admin-generate"><div class="soso-admin-card"><span class="soso-admin-kind">오늘의 자료</span><div class="soso-admin-list">${materialToday.length ? materialToday.map(materialItem).join('') : '<div class="soso-admin-sub">오늘 자료가 아직 없습니다.</div>'}</div></div><div class="soso-admin-card"><span class="soso-admin-kind soso-admin-kind--debate">오늘의 토론</span><div class="soso-admin-list">${debateToday.length ? debateToday.map(debateItem).join('') : '<div class="soso-admin-sub">오늘 토론이 아직 없습니다.</div>'}</div></div></div></div>`;
  bindOpenButtons(element);
}

async function renderMaterials(element) {
  const result = await call('getMaterials', { limit: 50 });
  const items = Array.isArray(result.materials) ? result.materials : [];
  element.innerHTML = `<div class="soso-admin-section"><div class="soso-admin-card"><div class="soso-admin-title">📚 자료 목록</div><div class="soso-admin-sub">AI 일일자료와 관리자 직접등록 자료를 확인합니다. 자료에는 찬반투표나 댓글이 붙지 않습니다.</div></div><div class="soso-admin-card"><div class="soso-admin-list">${items.length ? items.map(materialItem).join('') : '<div class="soso-admin-sub">등록된 자료가 없습니다.</div>'}</div></div></div>`;
  bindOpenButtons(element);
}

function renderMaterialCreate(element) {
  element.innerHTML = `<div class="soso-admin-section"><div class="soso-admin-card"><div class="soso-admin-title">✍️ 자료 직접등록</div><div class="soso-admin-sub">정보 열람용 자료를 직접 작성합니다. 찬반 의견은 토론 등록 메뉴에서 별도로 만드세요.</div></div><div class="soso-admin-card"><form class="soso-admin-form" id="material-form"><div class="soso-admin-grid"><label>카테고리<select name="category"><option>생활정보</option><option>민원·신고</option><option>소비자</option><option>계약·주거</option><option>직장·학교</option><option>디지털생활</option><option>기타</option></select></label><label>출처명<input name="sourceName" placeholder="예: 공공기관 안내, 직접 작성"></label></div><label>원문/출처 URL<input name="sourceUrl" placeholder="https://"></label><label>제목<input name="title" required maxlength="100" placeholder="자료 제목"></label><label>요약<textarea name="summary" required maxlength="260" placeholder="한두 문장으로 요약"></textarea></label><label>핵심 내용<textarea name="body" required placeholder="줄바꿈으로 여러 항목 입력"></textarea></label><label>추가 확인 기관·검색어<textarea name="sourceGuide" placeholder="줄바꿈으로 입력"></textarea></label><label>주의 문구<textarea name="disclaimer" placeholder="일반적인 생활정보이며 전문 판단을 대신하지 않습니다."></textarea></label><label>태그<input name="tags" placeholder="쉼표로 구분"></label><button class="btn btn--primary" type="submit">자료 등록</button></form></div></div>`;
  element.querySelector('#material-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const output = await call('adminCreateMaterial', {
      category: data.get('category'),
      sourceName: data.get('sourceName'),
      sourceUrl: data.get('sourceUrl'),
      title: data.get('title'),
      summary: data.get('summary'),
      body: textList(data.get('body')),
      sourceGuide: textList(data.get('sourceGuide')),
      disclaimer: data.get('disclaimer'),
      tags: csvList(data.get('tags')),
    });
    if (!output.ok) { toast.error(output.error?.message || '자료 등록에 실패했습니다.'); return; }
    toast.success('자료를 등록했습니다.');
    navigate(`/material/${output.id}`);
  });
}

async function renderDebates(element) {
  const result = await call('getDebates', { limit: 50, order: 'latest' });
  const items = Array.isArray(result.debates) ? result.debates : [];
  element.innerHTML = `<div class="soso-admin-section"><div class="soso-admin-card"><div class="soso-admin-title">💬 토론 목록</div><div class="soso-admin-sub">자료실과 분리된 찬반 토론 주제입니다. 투표와 댓글은 이 컬렉션에서만 누적됩니다.</div></div><div class="soso-admin-card"><div class="soso-admin-list">${items.length ? items.map(debateItem).join('') : '<div class="soso-admin-sub">등록된 토론이 없습니다.</div>'}</div></div></div>`;
  bindOpenButtons(element);
}

function renderDebateCreate(element) {
  element.innerHTML = `<div class="soso-admin-section"><div class="soso-admin-card"><div class="soso-admin-title">🗣️ 토론 직접등록</div><div class="soso-admin-sub">양쪽 입장이 모두 납득 가능한 생활 토론 주제를 직접 만듭니다.</div></div><div class="soso-admin-card"><form class="soso-admin-form" id="debate-form"><div class="soso-admin-grid"><label>카테고리<select name="category"><option>생활토론</option><option>친구·연애</option><option>가족</option><option>직장·학교</option><option>소비</option><option>주거·매너</option><option>디지털생활</option></select></label><label>태그<input name="tags" placeholder="쉼표로 구분"></label></div><label>질문형 제목<input name="title" required maxlength="100" placeholder="예: 친구가 매번 늦으면 약속을 취소해도 될까?"></label><label>상황 요약<textarea name="summary" required maxlength="260"></textarea></label><label>상황 설명<textarea name="context" required placeholder="줄바꿈으로 여러 항목 입력"></textarea></label><div class="soso-admin-grid"><label>찬성 입장 제목<input name="agreeTitle" required></label><label>반대 입장 제목<input name="disagreeTitle" required></label></div><div class="soso-admin-grid"><label>찬성 논거<textarea name="agreeText" required></textarea></label><label>반대 논거<textarea name="disagreeText" required></textarea></label></div><label>추가 토론 질문<textarea name="questions" placeholder="줄바꿈으로 여러 질문 입력"></textarea></label><button class="btn btn--primary" type="submit">토론 등록</button></form></div></div>`;
  element.querySelector('#debate-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const output = await call('adminCreateDebate', {
      category: data.get('category'),
      tags: csvList(data.get('tags')),
      title: data.get('title'),
      summary: data.get('summary'),
      context: textList(data.get('context')),
      agreeTitle: data.get('agreeTitle'),
      agreeText: data.get('agreeText'),
      disagreeTitle: data.get('disagreeTitle'),
      disagreeText: data.get('disagreeText'),
      questions: textList(data.get('questions')),
    });
    if (!output.ok) { toast.error(output.error?.message || '토론 등록에 실패했습니다.'); return; }
    toast.success('토론을 등록했습니다.');
    navigate(`/debate/${output.id}`);
  });
}

function renderGenerate(element) {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  element.innerHTML = `<div class="soso-admin-section"><div class="soso-admin-card"><div class="soso-admin-title">🤖 AI 일일생성</div><div class="soso-admin-sub">자동 스케줄은 매일 자료 1건과 토론 1건을 각각 생성합니다. 아래 버튼은 누락된 날짜를 수동 실행하거나 강제로 다시 생성할 때 사용합니다.</div></div><div class="soso-admin-generate"><div class="soso-admin-card"><span class="soso-admin-kind">자료실 AI 생성</span><form class="soso-admin-form" id="generate-material-form"><label>생성 날짜<input name="date" value="${date}"></label><label><span><input type="checkbox" name="force"> 기존 자료 덮어쓰기</span></label><button class="btn btn--primary" type="submit">자료 1건 생성</button></form><div id="generate-material-result" style="margin-top:12px"></div></div><div class="soso-admin-card"><span class="soso-admin-kind soso-admin-kind--debate">토론실 AI 생성</span><form class="soso-admin-form" id="generate-debate-form"><label>생성 날짜<input name="date" value="${date}"></label><label><span><input type="checkbox" name="force"> 기존 토론 덮어쓰기</span></label><button class="btn btn--primary" type="submit">토론 1건 생성</button></form><div id="generate-debate-result" style="margin-top:12px"></div></div></div></div>`;

  element.querySelector('#generate-material-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const output = await call('triggerDailyMaterial', { date: data.get('date'), force: !!data.get('force') });
    if (!output.ok) { toast.error(output.error?.message || '자료 생성에 실패했습니다.'); return; }
    toast.success(output.skipped ? '이미 해당 날짜의 자료가 있습니다.' : 'AI 자료를 생성했습니다.');
    element.querySelector('#generate-material-result').innerHTML = `<div class="soso-admin-item"><b>${output.skipped ? '생성 생략' : '생성 완료'}</b><p>${escHtml(output.date || '')} · ${escHtml(output.id || '')}</p></div>`;
  });

  element.querySelector('#generate-debate-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const output = await call('triggerDailyDebate', { date: data.get('date'), force: !!data.get('force') });
    if (!output.ok) { toast.error(output.error?.message || '토론 생성에 실패했습니다.'); return; }
    toast.success(output.skipped ? '이미 해당 날짜의 토론이 있습니다.' : 'AI 토론을 생성했습니다.');
    element.querySelector('#generate-debate-result').innerHTML = `<div class="soso-admin-item"><b>${output.skipped ? '생성 생략' : '생성 완료'}</b><p>${escHtml(output.date || '')} · ${escHtml(output.id || '')}</p></div>`;
  });
}
