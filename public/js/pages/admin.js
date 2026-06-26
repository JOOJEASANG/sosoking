import { auth, db, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { appState } from '../state.js';
import { toast } from '../components/toast.js';
import { navigate } from '../router.js';
import { escHtml } from '../utils/helpers.js';

let currentTab = 'dashboard';
let memberPageToken = 0;
let memberSearch = '';

function isAdmin() { return !!appState.isAdmin; }
function call(name, payload = {}) {
  return httpsCallable(functions, name)(payload)
    .then(response => response.data || {})
    .catch(error => ({ ok: false, error }));
}
function textList(value) { return String(value || '').split('\n').map(item => item.trim()).filter(Boolean); }
function csvList(value) { return String(value || '').split(',').map(item => item.trim()).filter(Boolean); }
function formatDate(value) {
  if (!value) return '-';
  try { return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  catch { return '-'; }
}
function sourceLabel(item) {
  if (item.sourceType === 'ai' || item.aiGenerated) return 'AI 자동생성';
  if (item.sourceType === 'user' || item.userGenerated) return '회원 등록';
  return '관리자 등록';
}
function statusLabel(status) {
  return ({ published: '공개', draft: '초안', hidden: '숨김', success: '성공', failed: '실패', running: '진행 중', open: '미처리', reviewing: '검토 중', resolved: '처리 완료' })[status] || status || '-';
}
function empty(message) { return `<div class="soso-admin-empty">${escHtml(message)}</div>`; }

function ensureAdminStyle() {
  if (document.getElementById('soso-admin-style')) return;
  const style = document.createElement('style');
  style.id = 'soso-admin-style';
  style.textContent = `
    .soso-admin{display:grid;grid-template-columns:250px minmax(0,1fr);gap:16px;min-height:calc(100vh - 120px)}
    .soso-admin-side{position:sticky;top:18px;align-self:start;border:1px solid rgba(100,116,139,.16);border-radius:24px;background:var(--color-surface,#fff);padding:14px;box-shadow:0 10px 26px rgba(15,23,42,.055)}
    .soso-admin-brand{display:flex;gap:10px;align-items:center;margin-bottom:14px}.soso-admin-brand b{display:block;font-size:18px;color:var(--color-text-primary)}.soso-admin-brand span{display:block;font-size:12px;color:var(--color-text-muted);margin-top:2px}
    .soso-admin-nav{display:grid;gap:6px}.soso-admin-nav button{border:0;border-radius:14px;background:transparent;padding:10px 11px;text-align:left;font-family:inherit;font-weight:900;color:var(--color-text-secondary);cursor:pointer}.soso-admin-nav button.active{background:rgba(47,125,110,.11);color:#2f7d6e}
    .soso-admin-main{min-width:0}.soso-admin-section{display:grid;gap:14px}.soso-admin-card{border:1px solid rgba(100,116,139,.16);border-radius:24px;background:var(--color-surface,#fff);padding:17px;box-shadow:0 10px 26px rgba(15,23,42,.055)}
    .soso-admin-title{font-size:22px;font-weight:1000;color:var(--color-text-primary);margin-bottom:6px}.soso-admin-sub{font-size:13px;line-height:1.65;color:var(--color-text-secondary)}
    .soso-admin-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.soso-admin-stat{border-radius:20px;background:rgba(248,250,252,.82);padding:14px;border:1px solid rgba(100,116,139,.12)}.soso-admin-stat b{display:block;font-size:24px;color:var(--color-text-primary)}.soso-admin-stat span{font-size:12px;color:var(--color-text-muted)}
    .soso-admin-form{display:grid;gap:11px}.soso-admin-form label{display:grid;gap:6px;font-size:12px;font-weight:900;color:var(--color-text-secondary)}.soso-admin-form input,.soso-admin-form textarea,.soso-admin-form select{width:100%;font-family:inherit}.soso-admin-form textarea{min-height:96px;resize:vertical}.soso-admin-form input[type=checkbox]{width:auto}.soso-admin-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .soso-admin-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:end}.soso-admin-toolbar label{display:grid;gap:5px;font-size:11px;font-weight:900;color:var(--color-text-secondary)}.soso-admin-toolbar input,.soso-admin-toolbar select{min-width:150px}
    .soso-admin-list{display:grid;gap:10px}.soso-admin-item{border:1px solid rgba(100,116,139,.14);border-radius:18px;background:rgba(248,250,252,.82);padding:13px}.soso-admin-item__meta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:7px}.soso-admin-item__meta span{border-radius:999px;background:rgba(47,125,110,.10);color:#2f7d6e;padding:5px 8px;font-size:10px;font-weight:1000}.soso-admin-item__meta .warn{background:rgba(224,93,68,.10);color:#c84431}.soso-admin-item b{display:block;color:var(--color-text-primary);font-size:15px;margin-bottom:4px}.soso-admin-item p{margin:0;font-size:13px;line-height:1.6;color:var(--color-text-secondary)}.soso-admin-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
    .soso-admin-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px}.soso-admin-empty{padding:22px;text-align:center;color:var(--color-text-muted);font-size:13px}.soso-admin-note{border-radius:16px;padding:12px 14px;background:rgba(47,125,110,.08);color:var(--color-text-secondary);font-size:12px;line-height:1.6}.soso-admin-note--warn{background:rgba(224,93,68,.08)}
    .soso-admin-table-wrap{overflow:auto}.soso-admin-table{width:100%;border-collapse:collapse;min-width:720px}.soso-admin-table th,.soso-admin-table td{padding:10px;border-bottom:1px solid rgba(100,116,139,.13);text-align:left;font-size:12px}.soso-admin-table th{color:var(--color-text-muted)}
    @media(max-width:1100px){.soso-admin-stats{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:880px){.soso-admin{grid-template-columns:1fr}.soso-admin-side{position:static}.soso-admin-nav{grid-template-columns:repeat(2,minmax(0,1fr))}.soso-admin-stats,.soso-admin-grid,.soso-admin-columns{grid-template-columns:1fr}.soso-admin-toolbar>*{flex:1 1 140px}}
  `;
  document.head.appendChild(style);
}

const MENUS = [
  { key: 'dashboard', label: '📊 운영 현황' },
  { key: 'materials', label: '📚 자료 관리' },
  { key: 'material-create', label: '✍️ 자료 등록' },
  { key: 'debates', label: '💬 토론 관리' },
  { key: 'debate-create', label: '🗣️ 토론 등록' },
  { key: 'generate', label: '🤖 일일 생성' },
  { key: 'ai-settings', label: '⚙️ AI 설정' },
  { key: 'members', label: '👥 회원 관리' },
  { key: 'inbox', label: '🚨 신고·문의' },
];

export async function renderAdmin() {
  ensureAdminStyle();
  const element = document.getElementById('page-content');
  const user = appState.user || auth.currentUser;
  if (!user) { navigate('/login?return=/admin'); return; }
  if (!isAdmin()) {
    element.innerHTML = '<div class="empty-state"><div class="empty-state__icon">🔒</div><div class="empty-state__title">관리자 전용 페이지입니다</div><div class="empty-state__desc">관리자 문서 또는 관리자 권한이 확인된 계정만 접근할 수 있습니다.</div></div>';
    return;
  }
  element.innerHTML = `<div class="soso-admin"><aside class="soso-admin-side"><div class="soso-admin-brand"><img src="/logo.svg" alt="" width="34" height="34"><div><b>소소킹 운영센터</b><span>AI·자료·토론·회원 관리</span></div></div><nav class="soso-admin-nav">${MENUS.map(menu => `<button data-tab="${menu.key}" class="${currentTab === menu.key ? 'active' : ''}">${menu.label}</button>`).join('')}</nav><button class="btn btn--ghost" id="admin-home" style="width:100%;margin-top:14px">사이트 홈으로</button></aside><main id="soso-admin-content" class="soso-admin-main"><div class="soso-admin-card">불러오는 중입니다.</div></main></div>`;
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
  if (tab === 'materials') return renderContentManager(element, 'material');
  if (tab === 'material-create') return renderMaterialCreate(element);
  if (tab === 'debates') return renderContentManager(element, 'debate');
  if (tab === 'debate-create') return renderDebateCreate(element);
  if (tab === 'generate') return renderGenerate(element);
  if (tab === 'ai-settings') return renderAiSettings(element);
  if (tab === 'members') return renderMembers(element);
  if (tab === 'inbox') return renderInbox(element);
}

function contentItem(item, type, controls = false) {
  const detailPath = type === 'material' ? `/material/${item.id}` : `/debate/${item.id}`;
  const activity = type === 'debate'
    ? `투표 ${Number(item.totalVotes || 0)} · 댓글 ${Number(item.commentCount || 0)} · 조회 ${Number(item.viewCount || 0)}`
    : `댓글 ${Number(item.commentCount || 0)} · 조회 ${Number(item.viewCount || 0)}`;
  return `<article class="soso-admin-item" data-content-id="${escHtml(item.id)}"><div class="soso-admin-item__meta"><span>${escHtml(item.category || (type === 'material' ? '생활정보' : '생활토론'))}</span><span>${escHtml(sourceLabel(item))}</span><span class="${item.status === 'published' ? '' : 'warn'}">${escHtml(statusLabel(item.status))}</span><span>${escHtml(activity)}</span></div><b>${escHtml(item.title || '')}</b><p>${escHtml(item.summary || '')}</p><p style="margin-top:5px;font-size:11px">${escHtml(item.sourceName || '')} · ${escHtml(formatDate(item.createdAtMs))}</p><div class="soso-admin-actions"><button class="btn btn--ghost btn--sm" data-open="${detailPath}">상세 보기</button>${controls ? `<button class="btn btn--ghost btn--sm" data-status="published" data-type="${type}" data-id="${escHtml(item.id)}">공개</button><button class="btn btn--ghost btn--sm" data-status="hidden" data-type="${type}" data-id="${escHtml(item.id)}">숨김</button><button class="btn btn--ghost btn--sm" data-status="draft" data-type="${type}" data-id="${escHtml(item.id)}">초안</button><button class="btn btn--danger btn--sm" data-delete-content data-type="${type}" data-id="${escHtml(item.id)}">삭제</button>` : ''}</div></article>`;
}

function bindOpenButtons(element) {
  element.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.open)));
}

async function renderDashboard(element) {
  const result = await call('getAdminOverview');
  if (!result.ok) { element.innerHTML = empty(result.error?.message || '운영 현황을 불러오지 못했습니다.'); return; }
  const counts = result.counts || {};
  const failedRuns = (result.generationRuns || []).filter(run => run.status === 'failed');
  element.innerHTML = `<div class="soso-admin-section"><div class="soso-admin-card"><div class="soso-admin-title">📊 운영 현황</div><div class="soso-admin-sub">현재 운영 중인 AI 놀이터, 자료실, 토론실, 회원과 신고·문의 상태를 한곳에서 확인합니다.</div></div><div class="soso-admin-stats"><div class="soso-admin-stat"><b>${Number(counts.materials || 0)}</b><span>전체 자료</span></div><div class="soso-admin-stat"><b>${Number(counts.debates || 0)}</b><span>전체 토론</span></div><div class="soso-admin-stat"><b>${Number(counts.members || 0)}</b><span>회원 문서</span></div><div class="soso-admin-stat"><b>${Number(counts.reports || 0)}</b><span>신고</span></div><div class="soso-admin-stat"><b>${Number(counts.feedback || 0)}</b><span>문의·의견</span></div></div><div class="soso-admin-columns"><section class="soso-admin-card"><div class="soso-admin-title" style="font-size:17px">최근 자료</div><div class="soso-admin-list">${(result.latestMaterials || []).length ? result.latestMaterials.map(item => contentItem(item, 'material')).join('') : empty('등록된 자료가 없습니다.')}</div></section><section class="soso-admin-card"><div class="soso-admin-title" style="font-size:17px">최근 토론</div><div class="soso-admin-list">${(result.latestDebates || []).length ? result.latestDebates.map(item => contentItem(item, 'debate')).join('') : empty('등록된 토론이 없습니다.')}</div></section></div><section class="soso-admin-card"><div class="soso-admin-title" style="font-size:17px">AI 운영 상태</div><div class="soso-admin-note">${result.ai?.enabled ? 'AI 기능 사용 중' : 'AI 기능 중지'} · ${escHtml(result.ai?.geminiModel || 'gemini-2.5-flash')} · 회원 일일 기본 한도 ${Number(result.ai?.dailyFreeLimit || 3)}회 · 월간 상한 ${Number(result.ai?.monthlyCap || 0) || '제한 없음'}</div>${failedRuns.length ? `<div class="soso-admin-note soso-admin-note--warn" style="margin-top:10px">최근 생성 실패 ${failedRuns.length}건이 있습니다. 일일 생성 메뉴에서 확인하고 다시 실행하세요.</div>` : ''}</section></div>`;
  bindOpenButtons(element);
}

async function renderContentManager(element, type) {
  const label = type === 'material' ? '자료' : '토론';
  element.innerHTML = `<div class="soso-admin-section"><div class="soso-admin-card"><div class="soso-admin-title">${type === 'material' ? '📚 자료 관리' : '💬 토론 관리'}</div><div class="soso-admin-sub">AI·관리자·회원 등록 콘텐츠를 구분해 확인하고 공개, 숨김, 초안 상태를 변경하거나 완전히 삭제합니다. 삭제하면 하위 댓글·투표·조회 기록과 연결 이미지도 함께 정리됩니다.</div></div><div class="soso-admin-card"><div class="soso-admin-toolbar"><label>공개 상태<select id="content-status"><option value="all">전체</option><option value="published">공개</option><option value="hidden">숨김</option><option value="draft">초안</option></select></label><label>등록 방식<select id="content-source"><option value="all">전체</option><option value="ai">AI 자동생성</option><option value="manual">관리자 등록</option><option value="user">회원 등록</option></select></label><button class="btn btn--primary btn--sm" id="content-refresh">조회</button></div></div><div class="soso-admin-card"><div id="content-list" class="soso-admin-list">불러오는 중입니다.</div></div></div>`;
  const load = async () => {
    const listElement = element.querySelector('#content-list');
    listElement.innerHTML = '불러오는 중입니다.';
    const result = await call('getAdminContentList', { type, status: element.querySelector('#content-status').value, sourceType: element.querySelector('#content-source').value, limit: 100 });
    const items = Array.isArray(result.items) ? result.items : [];
    listElement.innerHTML = items.length ? items.map(item => contentItem(item, type, true)).join('') : empty(`조건에 맞는 ${label}가 없습니다.`);
    bindOpenButtons(listElement);
    listElement.querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', async () => {
      const output = await call('setAdminContentStatus', { type: button.dataset.type, id: button.dataset.id, status: button.dataset.status });
      if (!output.ok) { toast.error(output.error?.message || '상태 변경에 실패했습니다.'); return; }
      toast.success(`${label} 상태를 ${statusLabel(button.dataset.status)}로 변경했습니다.`);
      load();
    }));
    listElement.querySelectorAll('[data-delete-content]').forEach(button => button.addEventListener('click', async () => {
      if (!window.confirm(`이 ${label}와 하위 참여 기록, 연결 이미지를 완전히 삭제할까요?`)) return;
      const output = await call('deleteAdminContent', { type: button.dataset.type, id: button.dataset.id });
      if (!output.ok) { toast.error(output.error?.message || '삭제에 실패했습니다.'); return; }
      toast.success(`${label}를 삭제했습니다.`);
      load();
    }));
  };
  element.querySelector('#content-refresh')?.addEventListener('click', load);
  load();
}

function renderMaterialCreate(element) {
  element.innerHTML = `<div class="soso-admin-section"><div class="soso-admin-card"><div class="soso-admin-title">✍️ 관리자 자료 등록</div><div class="soso-admin-sub">자료는 생활정보 열람과 댓글 참여를 위한 콘텐츠입니다. 법률·의료·세무 등 최신 확인이 필요한 내용은 관계 기관 확인 안내를 함께 작성하세요.</div></div><div class="soso-admin-card"><form class="soso-admin-form" id="material-form"><div class="soso-admin-grid"><label>카테고리<select name="category"><option>생활정보</option><option>민원·신고</option><option>소비자</option><option>계약·주거</option><option>직장·학교</option><option>디지털생활</option><option>인간관계</option><option>기타</option></select></label><label>출처명<input name="sourceName" placeholder="예: 관계 기관 안내, 관리자 정리"></label></div><label>원문·출처 URL<input name="sourceUrl" placeholder="https://"></label><label>제목<input name="title" required maxlength="100" placeholder="자료 제목"></label><label>요약<textarea name="summary" required maxlength="260" placeholder="한두 문장으로 요약"></textarea></label><label>핵심 내용<textarea name="body" required placeholder="줄바꿈으로 여러 항목 입력"></textarea></label><label>추가 확인 기관·검색어<textarea name="sourceGuide" placeholder="줄바꿈으로 입력"></textarea></label><label>주의 문구<textarea name="disclaimer" placeholder="일반적인 생활정보이며 전문적인 판단을 대신하지 않습니다."></textarea></label><label>태그<input name="tags" placeholder="쉼표로 구분"></label><label>초기 상태<select name="status"><option value="published">바로 공개</option><option value="draft">초안 저장</option></select></label><button class="btn btn--primary" type="submit">자료 등록</button></form></div></div>`;
  element.querySelector('#material-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type=submit]');
    const data = new FormData(event.currentTarget);
    button.disabled = true;
    const output = await call('adminCreateMaterial', { category: data.get('category'), sourceName: data.get('sourceName'), sourceUrl: data.get('sourceUrl'), title: data.get('title'), summary: data.get('summary'), body: textList(data.get('body')), sourceGuide: textList(data.get('sourceGuide')), disclaimer: data.get('disclaimer'), tags: csvList(data.get('tags')), status: data.get('status') });
    button.disabled = false;
    if (!output.ok) { toast.error(output.error?.message || '자료 등록에 실패했습니다.'); return; }
    toast.success('자료를 등록했습니다.');
    if (data.get('status') === 'published') navigate(`/material/${output.id}`); else { currentTab = 'materials'; loadTab('materials'); }
  });
}

function renderDebateCreate(element) {
  element.innerHTML = `<div class="soso-admin-section"><div class="soso-admin-card"><div class="soso-admin-title">🗣️ 관리자 토론 등록</div><div class="soso-admin-sub">A와 B 어느 한쪽을 정답으로 몰지 않고 두 입장 모두 납득 가능한 생활형 토론을 작성합니다. 댓글은 이용자가 실제로 선택한 A/B 투표와 자동 연결됩니다.</div></div><div class="soso-admin-card"><form class="soso-admin-form" id="debate-form"><div class="soso-admin-grid"><label>카테고리<select name="category"><option>생활토론</option><option>친구·연애</option><option>가족</option><option>직장·학교</option><option>소비</option><option>주거·매너</option><option>디지털생활</option></select></label><label>태그<input name="tags" placeholder="쉼표로 구분"></label></div><label>질문형 제목<input name="title" required maxlength="100" placeholder="예: 친구가 매번 늦으면 약속을 취소해도 될까?"></label><label>상황 요약<textarea name="summary" required maxlength="260"></textarea></label><label>상황 설명<textarea name="context" required placeholder="줄바꿈으로 여러 항목 입력"></textarea></label><div class="soso-admin-grid"><label>A 입장 제목<input name="agreeTitle" required></label><label>B 입장 제목<input name="disagreeTitle" required></label></div><div class="soso-admin-grid"><label>A 논거<textarea name="agreeText" required></textarea></label><label>B 논거<textarea name="disagreeText" required></textarea></label></div><label>추가 토론 질문<textarea name="questions" placeholder="줄바꿈으로 여러 질문 입력"></textarea></label><label>초기 상태<select name="status"><option value="published">바로 공개</option><option value="draft">초안 저장</option></select></label><button class="btn btn--primary" type="submit">토론 등록</button></form></div></div>`;
  element.querySelector('#debate-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type=submit]');
    const data = new FormData(event.currentTarget);
    button.disabled = true;
    const output = await call('adminCreateDebate', { category: data.get('category'), tags: csvList(data.get('tags')), title: data.get('title'), summary: data.get('summary'), context: textList(data.get('context')), agreeTitle: data.get('agreeTitle'), agreeText: data.get('agreeText'), disagreeTitle: data.get('disagreeTitle'), disagreeText: data.get('disagreeText'), questions: textList(data.get('questions')), status: data.get('status') });
    button.disabled = false;
    if (!output.ok) { toast.error(output.error?.message || '토론 등록에 실패했습니다.'); return; }
    toast.success('토론을 등록했습니다.');
    if (data.get('status') === 'published') navigate(`/debate/${output.id}`); else { currentTab = 'debates'; loadTab('debates'); }
  });
}

function renderRun(run) {
  return `<div class="soso-admin-item"><div class="soso-admin-item__meta"><span>${run.type === 'material' ? '자료' : '토론'}</span><span class="${run.status === 'failed' ? 'warn' : ''}">${escHtml(statusLabel(run.status))}</span><span>${escHtml(run.date || '')}</span></div><b>${escHtml(run.contentId || run.id || '')}</b><p>${escHtml(run.error || run.reviewStatus || '처리 기록')}</p><p style="margin-top:5px;font-size:11px">${escHtml(formatDate(run.updatedAtMs))}</p></div>`;
}

async function renderGenerate(element) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const runsResult = await call('getAdminGenerationRuns', { limit: 30 });
  element.innerHTML = `<div class="soso-admin-section"><div class="soso-admin-card"><div class="soso-admin-title">🤖 AI 일일 생성</div><div class="soso-admin-sub">자료는 매일 오전 7시 30분, 토론은 오전 8시에 각각 생성됩니다. 생성 결과는 AI 검수 단계를 통과한 경우에만 공개되며 실패 기록은 아래에 남습니다.</div></div><div class="soso-admin-columns"><div class="soso-admin-card"><div class="soso-admin-title" style="font-size:17px">자료 생성</div><form class="soso-admin-form" id="generate-material-form"><label>생성 날짜<input type="date" name="date" value="${today}"></label><label><span><input type="checkbox" name="force"> 기존 날짜 자료를 다시 생성</span></label><button class="btn btn--primary" type="submit">자료 생성 실행</button></form><div id="generate-material-result" style="margin-top:12px"></div></div><div class="soso-admin-card"><div class="soso-admin-title" style="font-size:17px">토론 생성</div><form class="soso-admin-form" id="generate-debate-form"><label>생성 날짜<input type="date" name="date" value="${today}"></label><label><span><input type="checkbox" name="force"> 기존 날짜 토론을 다시 생성</span></label><button class="btn btn--primary" type="submit">토론 생성 실행</button></form><div id="generate-debate-result" style="margin-top:12px"></div></div></div><div class="soso-admin-card"><div class="soso-admin-title" style="font-size:17px">최근 생성 기록</div><div class="soso-admin-list">${(runsResult.runs || []).length ? runsResult.runs.map(renderRun).join('') : empty('생성 기록이 없습니다.')}</div></div></div>`;
  const bind = (formId, functionName, resultId, noun) => element.querySelector(formId)?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type=submit]');
    const data = new FormData(event.currentTarget);
    button.disabled = true;
    const output = await call(functionName, { date: data.get('date'), force: !!data.get('force') });
    button.disabled = false;
    if (!output.ok) { toast.error(output.error?.message || `${noun} 생성에 실패했습니다.`); return; }
    toast.success(output.skipped ? `이미 해당 날짜의 ${noun}가 있습니다.` : `${noun} 생성을 완료했습니다.`);
    element.querySelector(resultId).innerHTML = `<div class="soso-admin-note">${output.skipped ? '생성 생략' : '생성 완료'} · ${escHtml(output.date || '')} · ${escHtml(output.id || '')}</div>`;
  });
  bind('#generate-material-form', 'triggerDailyMaterial', '#generate-material-result', '자료');
  bind('#generate-debate-form', 'triggerDailyDebate', '#generate-debate-result', '토론');
}

async function renderAiSettings(element) {
  const [kingSnap, featureSnap] = await Promise.all([
    getDoc(doc(db, 'config', 'ai_king')).catch(() => null),
    getDoc(doc(db, 'config', 'ai')).catch(() => null),
  ]);
  const king = kingSnap?.exists() ? kingSnap.data() || {} : {};
  const feature = featureSnap?.exists() ? featureSnap.data() || {} : {};
  element.innerHTML = `<div class="soso-admin-section"><div class="soso-admin-card"><div class="soso-admin-title">⚙️ AI 운영 설정</div><div class="soso-admin-sub">현재 Functions에는 Gemini 인증 정보만 연결되어 있습니다. API 키는 이 화면이나 Firestore에 저장하지 않고 Firebase Secret Manager에서만 관리합니다.</div></div><div class="soso-admin-columns"><div class="soso-admin-card"><div class="soso-admin-title" style="font-size:17px">AI 놀이터·일일 생성</div><form class="soso-admin-form" id="ai-king-form"><label><span><input type="checkbox" name="enabled" ${king.enabled !== false ? 'checked' : ''}> AI 기능 활성화</span></label><label>실행 공급자<input value="Google Gemini" disabled></label><label>Gemini 모델<input name="geminiModel" value="${escHtml(king.geminiModel || 'gemini-2.5-flash')}"></label><label>회원 일일 기본 이용 횟수<input type="number" name="dailyFreeLimit" min="1" max="20" value="${Number(king.dailyFreeLimit || 3)}"></label><label>월간 전체 실행 상한<input type="number" name="monthlyCap" min="0" max="100000" value="${Number(king.monthlyCap || 0)}"><span class="soso-admin-sub">0은 월간 상한을 사용하지 않는 값입니다.</span></label><button class="btn btn--primary" type="submit">AI 실행 설정 저장</button></form></div><div class="soso-admin-card"><div class="soso-admin-title" style="font-size:17px">보조 자동검토</div><form class="soso-admin-form" id="ai-feature-form"><label><span><input type="checkbox" name="enabled" ${feature.enabled !== false ? 'checked' : ''}> 보조 AI 전체 활성화</span></label><label><span><input type="checkbox" name="moderation" ${feature.features?.moderation !== false ? 'checked' : ''}> 구형 피드 신규 글 검토</span></label><label><span><input type="checkbox" name="autoReport" ${feature.features?.autoReport !== false ? 'checked' : ''}> 신고 우선순위 보조 검토</span></label><div class="soso-admin-note">자료·토론 일일 생성의 공개 전 안전 검수는 별도 생성 과정에서 수행됩니다.</div><button class="btn btn--primary" type="submit">보조 검토 설정 저장</button></form></div></div></div>`;
  element.querySelector('#ai-king-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const output = await call('saveAiKingConfig', { enabled: !!data.get('enabled'), activeModel: 'gemini', geminiModel: data.get('geminiModel'), dailyFreeLimit: Number(data.get('dailyFreeLimit')), monthlyCap: Number(data.get('monthlyCap')) });
    if (!output.success) { toast.error(output.error?.message || 'AI 설정 저장에 실패했습니다.'); return; }
    toast.success('AI 실행 설정을 저장했습니다.');
  });
  element.querySelector('#ai-feature-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const output = await call('saveAiConfig', { enabled: !!data.get('enabled'), features: { moderation: !!data.get('moderation'), autoReport: !!data.get('autoReport') } });
    if (!output.ok) { toast.error(output.error?.message || '보조 검토 설정 저장에 실패했습니다.'); return; }
    toast.success('보조 검토 설정을 저장했습니다.');
  });
}

async function renderMembers(element) {
  const result = await call('getAdminMemberList', { pageSize: 30, pageToken: memberPageToken, search: memberSearch });
  const members = Array.isArray(result.members) ? result.members : [];
  element.innerHTML = `<div class="soso-admin-section"><div class="soso-admin-card"><div class="soso-admin-title">👥 회원 관리</div><div class="soso-admin-sub">익명 인증과 관리자 계정은 제외하고 Firebase Authentication 또는 회원 문서가 있는 가입 회원을 확인합니다.</div></div><div class="soso-admin-card"><form class="soso-admin-toolbar" id="member-search-form"><label>회원 검색<input name="search" value="${escHtml(memberSearch)}" placeholder="닉네임, 이메일, UID"></label><button class="btn btn--primary btn--sm" type="submit">검색</button><button class="btn btn--ghost btn--sm" type="button" id="member-reset">초기화</button></form><div class="soso-admin-sub" style="margin-top:10px">검색 결과 ${Number(result.total || 0)}명 · 전체 가입 식별 회원 ${Number(result.totalRegistered || 0)}명</div></div><div class="soso-admin-card soso-admin-table-wrap"><table class="soso-admin-table"><thead><tr><th>닉네임</th><th>이메일</th><th>로그인 방식</th><th>가입일</th><th>최근 로그인</th><th>상태</th></tr></thead><tbody>${members.map(member => `<tr><td><b>${escHtml(member.nickname || '회원')}</b><br><small>${escHtml(member.uid)}</small></td><td>${escHtml(member.email || '-')}</td><td>${escHtml(member.provider || member.source || '-')}</td><td>${escHtml(formatDate(member.createdAtMs))}</td><td>${escHtml(formatDate(member.lastLoginAtMs))}</td><td>${member.disabled ? '사용 중지' : '정상'}</td></tr>`).join('') || '<tr><td colspan="6">검색된 회원이 없습니다.</td></tr>'}</tbody></table></div><div class="soso-admin-card"><div class="soso-admin-actions"><button class="btn btn--ghost btn--sm" id="member-prev" ${result.prevPageToken == null ? 'disabled' : ''}>이전</button><button class="btn btn--ghost btn--sm" id="member-next" ${result.nextPageToken == null ? 'disabled' : ''}>다음</button></div></div></div>`;
  element.querySelector('#member-search-form')?.addEventListener('submit', event => { event.preventDefault(); memberSearch = new FormData(event.currentTarget).get('search') || ''; memberPageToken = 0; renderMembers(element); });
  element.querySelector('#member-reset')?.addEventListener('click', () => { memberSearch = ''; memberPageToken = 0; renderMembers(element); });
  element.querySelector('#member-prev')?.addEventListener('click', () => { if (result.prevPageToken != null) { memberPageToken = result.prevPageToken; renderMembers(element); } });
  element.querySelector('#member-next')?.addEventListener('click', () => { if (result.nextPageToken != null) { memberPageToken = result.nextPageToken; renderMembers(element); } });
}

function inboxItem(item) {
  return `<div class="soso-admin-item"><div class="soso-admin-item__meta"><span>${item.collection === 'reports' ? '신고' : '문의·의견'}</span><span class="${item.status === 'open' ? 'warn' : ''}">${escHtml(statusLabel(item.status))}</span>${item.aiPriority ? `<span>AI 우선순위 ${escHtml(item.aiPriority)}</span>` : ''}</div><b>${escHtml(item.reporterName || item.reporterId || '회원')}</b><p>${escHtml(item.reason || '')}</p>${item.aiReason ? `<p style="margin-top:6px"><b>AI 검토 참고:</b> ${escHtml(item.aiReason)}</p>` : ''}<p style="margin-top:5px;font-size:11px">${escHtml(formatDate(item.createdAtMs))}</p><div class="soso-admin-actions"><button class="btn btn--ghost btn--sm" data-inbox-status="reviewing" data-collection="${item.collection}" data-id="${escHtml(item.id)}">검토 중</button><button class="btn btn--primary btn--sm" data-inbox-status="resolved" data-collection="${item.collection}" data-id="${escHtml(item.id)}">처리 완료</button><button class="btn btn--ghost btn--sm" data-inbox-status="open" data-collection="${item.collection}" data-id="${escHtml(item.id)}">미처리로 변경</button></div></div>`;
}

async function renderInbox(element) {
  const result = await call('getAdminInbox', { limit: 60 });
  const reports = Array.isArray(result.reports) ? result.reports : [];
  const feedback = Array.isArray(result.feedback) ? result.feedback : [];
  element.innerHTML = `<div class="soso-admin-section"><div class="soso-admin-card"><div class="soso-admin-title">🚨 신고·문의 관리</div><div class="soso-admin-sub">회원이 남긴 신고와 문의·의견을 확인하고 처리 상태를 기록합니다. AI 우선순위는 참고 정보일 뿐 위반 여부를 자동 확정하지 않습니다.</div></div><div class="soso-admin-columns"><section class="soso-admin-card"><div class="soso-admin-title" style="font-size:17px">신고 ${reports.length}건</div><div class="soso-admin-list">${reports.length ? reports.map(inboxItem).join('') : empty('신고가 없습니다.')}</div></section><section class="soso-admin-card"><div class="soso-admin-title" style="font-size:17px">문의·의견 ${feedback.length}건</div><div class="soso-admin-list">${feedback.length ? feedback.map(inboxItem).join('') : empty('문의·의견이 없습니다.')}</div></section></div></div>`;
  element.querySelectorAll('[data-inbox-status]').forEach(button => button.addEventListener('click', async () => {
    const output = await call('updateAdminInboxStatus', { collection: button.dataset.collection, id: button.dataset.id, status: button.dataset.inboxStatus });
    if (!output.ok) { toast.error(output.error?.message || '처리 상태 변경에 실패했습니다.'); return; }
    toast.success('처리 상태를 변경했습니다.');
    renderInbox(element);
  }));
}
