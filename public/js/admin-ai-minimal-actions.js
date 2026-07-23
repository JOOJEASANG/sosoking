import { db, functions } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from './components/toast.js';

const getAdminAutomationStatus = httpsCallable(functions, 'getAdminAutomationStatus');
const runAdminAutomationNow = httpsCallable(functions, 'runAdminAutomationNow');
const generateAiContentNow = httpsCallable(functions, 'generateAiContentNow');
const generateAllAiContentNow = httpsCallable(functions, 'generateAllAiContentNow');
const saveAiConfig = httpsCallable(functions, 'saveAiConfig');

const AI_POST_TYPES = [
  { key: 'judgment', label: '판결', desc: '사소한 사건 판정 커뮤니티 글' },
  { key: 'consult', label: '상담', desc: '웃기지만 은근 쓸모 있는 고민 상담 글' },
  { key: 'vote', label: '토론', desc: '찬성·반대 의견 커뮤니티 글' },
  { key: 'drip', label: '드립', desc: '한 줄 드립 배틀 커뮤니티 글' },
];

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePreset(value) {
  const key = String(value || 'judgment');
  return AI_POST_TYPES.some(type => type.key === key) ? key : 'judgment';
}

function isAiAdminTab() {
  const content = document.getElementById('admin-content');
  if (!content) return false;
  const active = document.querySelector('.admin-menu-item.active[data-admin-tab="ai"], .admin-menu-item.active[data-tab="ai"]');
  return !!active || content.textContent.includes('AI 관리');
}

async function loadSettings() {
  const [aiSnap, statusResult] = await Promise.all([
    getDoc(doc(db, 'config', 'ai')).catch(() => null),
    getAdminAutomationStatus().catch(() => null),
  ]);
  const ai = aiSnap?.exists?.() ? aiSnap.data() : {};
  const status = statusResult?.data || {};
  const site = status.settings || {};
  return {
    enabled: ai.enabled !== false,
    aiAutoContentEnabled: site.aiAutoContentEnabled !== false,
    aiAdminAutomationEnabled: site.aiAdminAutomationEnabled !== false,
    autoHideReportedPosts: site.autoHideReportedPosts === true,
    aiDailyLimit: Math.max(0, num(site.aiDailyLimit, 10)),
    reportHideThreshold: Math.max(2, num(site.reportHideThreshold, 3)),
    notificationRetentionDays: Math.max(7, num(site.notificationRetentionDays, 45)),
    status,
  };
}

function fieldChecked(id) { return document.getElementById(id)?.checked === true; }
function fieldNumber(id, fallback) { return num(document.getElementById(id)?.value, fallback); }
function renderStat(label, value, sub = '') { return `<div class="admin-stat-card"><div class="admin-stat-card__num">${esc(value)}</div><div class="admin-stat-card__label">${esc(label)}</div>${sub ? `<div style="font-size:11px;color:var(--color-text-muted);margin-top:4px">${esc(sub)}</div>` : ''}</div>`; }
function renderToggle(id, label, checked, help) { return `<label style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px;border:1px solid var(--color-border-light);border-radius:12px;background:var(--color-surface-2)"><span><span style="display:block;font-size:13px;font-weight:900;margin-bottom:3px">${esc(label)}</span><span style="display:block;font-size:11px;color:var(--color-text-muted);line-height:1.45">${esc(help)}</span></span><input id="${id}" type="checkbox" ${checked ? 'checked' : ''} style="width:18px;height:18px;flex-shrink:0"></label>`; }
function renderAiPostTypeOptions() { return AI_POST_TYPES.map(type => `<option value="${type.key}">${esc(type.label)} — ${esc(type.desc)}</option>`).join(''); }
function detailLink(data) { const id = data.docId || ''; return id ? `#/detail/${encodeURIComponent(id)}` : ''; }

async function createCommunityPost(preset) {
  const res = await generateAiContentNow({ preset, force: true });
  return res.data || {};
}

async function createAllCommunityPosts() {
  const res = await generateAllAiContentNow({ force: true });
  return res.data || {};
}

let renderInProgress = false;
let renderedOnce = false;

async function renderMinimalAiPanel(force = false) {
  const content = document.getElementById('admin-content');
  if (!content || !isAiAdminTab()) return;
  if (renderInProgress) return;
  if (!force && renderedOnce && content.querySelector('#ai-minimal-panel')) return;

  renderInProgress = true;
  content.dataset.aiMinimalReady = '1';
  if (!content.querySelector('#ai-minimal-panel')) content.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;

  let settings;
  try {
    settings = await loadSettings();
  } catch (error) {
    console.error(error);
    content.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">AI 설정을 불러오지 못했어요</div></div>`;
    renderInProgress = false;
    return;
  }

  const usage = settings.status.aiUsage || { total: 0 };
  const summary = settings.status.summary || {};
  const used = Number(usage.total || 0);
  const limit = Number(usage.limit || settings.aiDailyLimit || 0);
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  content.innerHTML = `
    <div id="ai-minimal-panel" style="display:flex;flex-direction:column;gap:18px;max-width:860px">
      <div>
        <h2 class="admin-section-title">🤖 AI 관리</h2>
        <div style="font-size:12px;color:var(--color-text-muted);line-height:1.6">AI 데이터는 <b>커뮤니티</b> 영역에 판결 · 상담 · 토론 · 드립 글로 생성됩니다.</div>
      </div>
      <div class="admin-stat-grid">
        ${renderStat('오늘 AI 사용량', `${used}/${limit || 0}`, `${pct}% 사용`)}
        ${renderStat('오늘 AI 커뮤니티 글', summary.todayAiPosts ?? '-', '수동 생성 포함')}
        ${renderStat('미처리 신고', summary.unresolvedReports ?? '-', `자동숨김 ${summary.autoHiddenPosts || 0}건`)}
      </div>
      <div class="card"><div class="card__body">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
          <div>
            <div style="font-size:14px;font-weight:900">AI 기본 설정</div>
            <div style="font-size:11px;color:var(--color-text-muted);margin-top:3px">AI 기능 사용 여부를 저장합니다. 세부 자동화 값은 서버 설정 문서를 기준으로 표시됩니다.</div>
          </div>
          <button class="btn btn--primary btn--sm" id="btn-ai-minimal-save">설정 저장</button>
        </div>
        <div style="height:10px;border-radius:999px;background:var(--color-surface-2);overflow:hidden;margin-bottom:14px"><div style="height:100%;width:${pct}%;background:${pct >= 90 ? 'var(--color-danger)' : 'var(--color-primary)'}"></div></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:14px">
          ${renderToggle('ai-enabled', 'AI 기능 사용', settings.enabled, '전체 AI 기능의 기본 사용 여부입니다.')}
          ${renderToggle('ai-auto-content', 'AI 커뮤니티 글 생성 사용', settings.aiAutoContentEnabled, '서버 설정값을 표시합니다.')}
          ${renderToggle('ai-admin-automation', '관리자 자동화', settings.aiAdminAutomationEnabled, '서버 설정값을 표시합니다.')}
          ${renderToggle('ai-auto-hide', '신고 많은 글 자동숨김', settings.autoHideReportedPosts, '서버 설정값을 표시합니다.')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
          <label class="form-group" style="margin:0"><span class="form-label">일일 AI 호출 한도</span><input id="ai-daily-limit" class="form-input" type="number" min="0" max="100" value="${settings.aiDailyLimit}"></label>
          <label class="form-group" style="margin:0"><span class="form-label">자동숨김 신고 기준</span><input id="ai-report-threshold" class="form-input" type="number" min="2" max="20" value="${settings.reportHideThreshold}"></label>
          <label class="form-group" style="margin:0"><span class="form-label">읽은 알림 보관일</span><input id="ai-retention-days" class="form-input" type="number" min="7" max="365" value="${settings.notificationRetentionDays}"></label>
        </div>
      </div></div>
      <div class="card"><div class="card__body">
        <div style="font-size:14px;font-weight:900;margin-bottom:6px">AI 커뮤니티 데이터 수동 생성</div>
        <div style="font-size:12px;color:var(--color-text-muted);line-height:1.6;margin-bottom:12px"><b>커뮤니티</b>에 표시될 판결 / 상담 / 토론 / 드립 글을 생성합니다.</div>
        <div style="display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center"><select class="form-input" id="ai-content-preset" aria-label="AI 커뮤니티 유형 선택">${renderAiPostTypeOptions()}</select><button class="btn btn--primary btn--sm" id="btn-ai-content-now">선택 글 1개 생성</button><button class="btn btn--ghost btn--sm" id="btn-ai-content-all">4종 모두 생성</button></div>
        <div id="ai-content-result" style="font-size:12px;color:var(--color-text-muted);margin-top:10px;line-height:1.6"></div>
      </div></div>
      <div class="card"><div class="card__body">
        <div style="font-size:14px;font-weight:900;margin-bottom:12px">관리자 자동화</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn--ghost btn--sm" id="btn-ai-run-automation">관리자 자동화 실행</button></div>
        <div style="font-size:11px;color:var(--color-text-muted);margin-top:10px">관리자 자동화는 알림 정리와 신고 요약 등 운영 보조 기능입니다.</div>
      </div></div>
    </div>`;

  document.getElementById('btn-ai-minimal-save')?.addEventListener('click', async () => {
    try {
      await saveAiConfig({
        enabled: fieldChecked('ai-enabled'),
        features: { mission: false },
        aiAutoContentEnabled: fieldChecked('ai-auto-content'),
        aiAdminAutomationEnabled: fieldChecked('ai-admin-automation'),
        autoHideReportedPosts: fieldChecked('ai-auto-hide'),
        aiDailyLimit: Math.max(0, fieldNumber('ai-daily-limit', 10)),
        reportHideThreshold: Math.max(2, fieldNumber('ai-report-threshold', 3)),
        notificationRetentionDays: Math.max(7, fieldNumber('ai-retention-days', 45)),
      });
      toast.success('AI 설정을 저장했어요');
      renderedOnce = false;
      await renderMinimalAiPanel(true);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'AI 설정 저장에 실패했어요');
    }
  });

  document.getElementById('btn-ai-content-now')?.addEventListener('click', async event => {
    const btn = event.currentTarget;
    const preset = normalizePreset(document.getElementById('ai-content-preset')?.value || 'judgment');
    const selected = AI_POST_TYPES.find(type => type.key === preset) || AI_POST_TYPES[0];
    const result = document.getElementById('ai-content-result');
    if (!confirm(`${selected.label} 커뮤니티 글 1개를 생성할까요?`)) return;
    btn.disabled = true;
    btn.textContent = '생성 중...';
    if (result) result.textContent = `${selected.label} 커뮤니티 글을 생성 중입니다...`;
    try {
      const data = await createCommunityPost(preset);
      const link = detailLink(data);
      if (result) result.innerHTML = `✅ ${esc(data.typeLabel || selected.label)} 생성 완료: <b>${esc(data.title || '')}</b>${link ? ` · <a href="${link}" style="color:var(--color-primary);font-weight:900">글 보기</a>` : ''}`;
      toast.success(`${selected.label} 커뮤니티 글을 생성했어요`);
    } catch (error) {
      console.error(error);
      if (result) result.textContent = '❌ ' + (error.message || 'AI 커뮤니티 글 생성에 실패했어요');
      toast.error(error.message || 'AI 커뮤니티 글 생성에 실패했어요');
    } finally {
      btn.disabled = false;
      btn.textContent = '선택 글 1개 생성';
    }
  });

  document.getElementById('btn-ai-content-all')?.addEventListener('click', async event => {
    const btn = event.currentTarget;
    const result = document.getElementById('ai-content-result');
    if (!confirm('판결 / 상담 / 토론 / 드립 커뮤니티 글을 모두 생성할까요?')) return;
    btn.disabled = true;
    btn.textContent = '생성 중...';
    if (result) result.textContent = '커뮤니티 글 4종을 생성 중입니다...';
    try {
      const data = await createAllCommunityPosts();
      const links = Array.isArray(data.results) ? data.results.map(item => {
        const link = detailLink(item);
        return link ? `<a href="${link}" style="color:var(--color-primary);font-weight:900">${esc(item.title || item.preset)}</a>` : esc(item.title || item.preset);
      }).join(' · ') : '';
      if (result) result.innerHTML = `✅ ${data.total || 0}개 커뮤니티 글 생성 완료${links ? `<br>${links}` : ''}`;
      toast.success('커뮤니티 AI 글을 생성했어요');
    } catch (error) {
      console.error(error);
      if (result) result.textContent = '❌ ' + (error.message || 'AI 커뮤니티 글 생성에 실패했어요');
      toast.error(error.message || 'AI 커뮤니티 글 생성에 실패했어요');
    } finally {
      btn.disabled = false;
      btn.textContent = '4종 모두 생성';
    }
  });

  document.getElementById('btn-ai-run-automation')?.addEventListener('click', async event => {
    const btn = event.currentTarget;
    btn.disabled = true;
    btn.textContent = '실행 중...';
    try {
      await runAdminAutomationNow({ force: true });
      toast.success('관리자 자동화를 실행했어요');
    } catch (error) {
      console.error(error);
      toast.error(error.message || '관리자 자동화 실행에 실패했어요');
    } finally {
      btn.disabled = false;
      btn.textContent = '관리자 자동화 실행';
    }
  });

  renderInProgress = false;
  renderedOnce = true;
}

function scheduleRender(force = false) { setTimeout(() => renderMinimalAiPanel(force), 80); }

window.addEventListener('hashchange', () => { renderedOnce = false; scheduleRender(false); });
window.addEventListener('sosoking:extensions-ready', () => scheduleRender(false));
document.addEventListener('click', event => {
  if (event.target.closest('.admin-menu-item, [data-admin-tab], [data-tab]')) {
    renderedOnce = false;
    scheduleRender(false);
  }
});

const observer = new MutationObserver(() => scheduleRender(false));
observer.observe(document.documentElement, { childList: true, subtree: true });
scheduleRender(false);
