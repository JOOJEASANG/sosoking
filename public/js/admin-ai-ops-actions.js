import { db, functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import {
  doc, setDoc, collection, query, where, orderBy, limit, getDocs, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { toast } from './components/toast.js';

const getAdminAutomationStatus = httpsCallable(functions, 'getAdminAutomationStatus');
const runAdminAutomationNow = httpsCallable(functions, 'runAdminAutomationNow');
const generateAiMissionNow = httpsCallable(functions, 'generateAiMissionNow');
const generateAiContentNow = httpsCallable(functions, 'generateAiContentNow');

const DEFAULT_SETTINGS = {
  aiDailyLimit: 10,
  aiAutoContentEnabled: true,
  aiMissionEnabled: true,
  aiAdminAutomationEnabled: true,
  autoHideReportedPosts: false,
  reportHideThreshold: 3,
  notificationRetentionDays: 45,
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function normalizeSettings(settings = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    aiDailyLimit: Math.max(0, Number(settings.aiDailyLimit ?? DEFAULT_SETTINGS.aiDailyLimit)),
    reportHideThreshold: Math.max(2, Number(settings.reportHideThreshold ?? DEFAULT_SETTINGS.reportHideThreshold)),
    notificationRetentionDays: Math.max(7, Number(settings.notificationRetentionDays ?? DEFAULT_SETTINGS.notificationRetentionDays)),
    aiAutoContentEnabled: settings.aiAutoContentEnabled !== false,
    aiMissionEnabled: settings.aiMissionEnabled !== false,
    aiAdminAutomationEnabled: settings.aiAdminAutomationEnabled !== false,
    autoHideReportedPosts: settings.autoHideReportedPosts === true,
  };
}

function isAdminPage() {
  return !!document.querySelector('.admin-layout') && !!document.getElementById('admin-content');
}

function injectMenu() {
  const sidebar = document.querySelector('.admin-sidebar');
  if (!sidebar || sidebar.querySelector('[data-aiops-tab]')) return;
  const item = document.createElement('div');
  item.className = 'admin-menu-item';
  item.dataset.aiopsTab = 'aiops';
  item.innerHTML = '<span>🤖</span><span>AI 운영관리</span>';

  const missionItem = sidebar.querySelector('[data-tab="missions"]');
  if (missionItem) missionItem.insertAdjacentElement('afterend', item);
  else sidebar.appendChild(item);

  item.addEventListener('click', async () => {
    document.querySelectorAll('.admin-menu-item').forEach(btn => btn.classList.remove('active'));
    item.classList.add('active');
    await renderAiOpsPanel();
  });
}

async function loadAiOpsData() {
  const today = toDateKey();
  const [statusResult, aiPostsSnap, aiMissionSnap, reportsSnap] = await Promise.all([
    getAdminAutomationStatus().catch(error => ({ error })),
    getDocs(query(
      collection(db, 'feeds'),
      where('isAiGenerated', '==', true),
      where('aiGeneratedDate', '==', today),
      limit(20),
    )).catch(() => ({ docs: [] })),
    getDocs(query(
      collection(db, 'missions'),
      where('aiManaged', '==', true),
      where('aiGeneratedDate', '==', today),
      limit(10),
    )).catch(() => ({ docs: [] })),
    getDocs(query(
      collection(db, 'reports'),
      where('resolved', '==', false),
      limit(50),
    )).catch(() => ({ docs: [] })),
  ]);

  if (statusResult.error) throw statusResult.error;
  return {
    today,
    status: statusResult.data || {},
    aiPosts: aiPostsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    aiMissions: aiMissionSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    reports: reportsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
  };
}

function statCard(label, value, sub = '') {
  return `
    <div class="admin-stat-card">
      <div class="admin-stat-card__num">${escapeHtml(value)}</div>
      <div class="admin-stat-card__label">${escapeHtml(label)}</div>
      ${sub ? `<div style="font-size:11px;color:var(--color-text-muted);margin-top:4px">${escapeHtml(sub)}</div>` : ''}
    </div>`;
}

function toggleField(id, label, checked, help = '') {
  return `
    <label style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px;border:1px solid var(--color-border-light);border-radius:var(--radius-md);background:var(--color-surface-2)">
      <span>
        <span style="display:block;font-size:13px;font-weight:800;margin-bottom:3px">${escapeHtml(label)}</span>
        ${help ? `<span style="display:block;font-size:11px;color:var(--color-text-muted);line-height:1.45">${escapeHtml(help)}</span>` : ''}
      </span>
      <input id="${id}" type="checkbox" ${checked ? 'checked' : ''} style="width:18px;height:18px;flex-shrink:0">
    </label>`;
}

function renderPostList(posts) {
  if (!posts.length) return `<div style="padding:18px;text-align:center;color:var(--color-text-muted);font-size:13px">오늘 자동 생성된 AI 게시글이 없어요</div>`;
  return posts.map(post => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--color-border-light)">
      <span style="font-size:11px;font-weight:800;border-radius:99px;padding:3px 8px;background:var(--color-primary-bg);color:var(--color-primary)">${escapeHtml(post.type || 'AI')}</span>
      <a href="#/detail/${post.id}" style="flex:1;font-size:13px;font-weight:700;color:var(--color-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(post.title || '(제목 없음)')}</a>
      <span style="font-size:11px;color:var(--color-text-muted)">${escapeHtml(post.aiSource || post.source || '')}</span>
    </div>`).join('');
}

function renderMissionList(missions) {
  if (!missions.length) return `<div style="padding:18px;text-align:center;color:var(--color-text-muted);font-size:13px">오늘 자동 생성된 AI 미션이 없어요</div>`;
  return missions.map(mission => `
    <div style="padding:10px 0;border-bottom:1px solid var(--color-border-light)">
      <div style="font-size:13px;font-weight:800;color:var(--color-text)">${escapeHtml(mission.title || '(제목 없음)')}</div>
      <div style="font-size:11px;color:var(--color-text-muted);margin-top:3px">${escapeHtml(mission.cat || '')} · ${escapeHtml(mission.type || '')} · ${escapeHtml(mission.source || '')}</div>
    </div>`).join('');
}

function renderRiskList(summary, reports) {
  const risky = Array.isArray(summary?.riskyPosts) ? summary.riskyPosts : [];
  if (risky.length) {
    return risky.map(item => `
      <div style="padding:10px;border:1px solid rgba(239,68,68,.22);border-radius:var(--radius-md);background:rgba(239,68,68,.06);margin-bottom:8px">
        <div style="font-size:13px;font-weight:900;color:var(--color-danger)">신고 ${Number(item.count || 0)}건 · ${escapeHtml(item.postId)}</div>
        ${(item.reasons || []).slice(0, 3).map(reason => `<div style="font-size:11px;color:var(--color-text-secondary);margin-top:3px">- ${escapeHtml(reason)}</div>`).join('')}
      </div>`).join('');
  }
  if (!reports.length) return `<div style="padding:18px;text-align:center;color:var(--color-text-muted);font-size:13px">미처리 신고가 없어요</div>`;
  return reports.slice(0, 8).map(report => `
    <div style="padding:10px;border-bottom:1px solid var(--color-border-light)">
      <div style="font-size:13px;font-weight:800">${escapeHtml(report.reason || '신고')}</div>
      <div style="font-size:11px;color:var(--color-text-muted);margin-top:3px">게시글: ${escapeHtml(report.postId || '-')}</div>
    </div>`).join('');
}

async function renderAiOpsPanel() {
  const el = document.getElementById('admin-content');
  if (!el) return;
  el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;

  let data;
  try {
    data = await loadAiOpsData();
  } catch (error) {
    console.error(error);
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">AI 운영 정보를 불러오지 못했어요</div></div>`;
    return;
  }

  const status = data.status || {};
  const settings = normalizeSettings(status.settings || {});
  const usage = status.aiUsage || { total: 0 };
  const used = Number(usage.total || 0);
  const limitValue = Number(usage.limit || settings.aiDailyLimit || 0);
  const percent = limitValue > 0 ? Math.min(100, Math.round(used / limitValue * 100)) : 0;
  const summary = status.summary || {};

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:18px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <div style="font-size:20px;font-weight:950;letter-spacing:-0.5px">🤖 AI 운영관리</div>
          <div style="font-size:12px;color:var(--color-text-muted);margin-top:4px">${escapeHtml(data.today)} 기준 · 관리자 반복업무 자동 처리</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn--ghost btn--sm" id="btn-run-admin-automation">운영 자동화 실행</button>
          <button class="btn btn--primary btn--sm" id="btn-ai-content-now">AI 게시글 생성</button>
          <button class="btn btn--primary btn--sm" id="btn-ai-mission-now-ops">AI 미션 생성</button>
        </div>
      </div>

      <div class="admin-stat-grid">
        ${statCard('오늘 AI 사용량', `${used}/${limitValue || 0}`, `${percent}% 사용`)}
        ${statCard('오늘 AI 게시글', String(data.aiPosts.length), 'feeds 자동 생성')}
        ${statCard('오늘 AI 미션', String(data.aiMissions.length), 'missions 자동 생성')}
        ${statCard('미처리 신고', String(summary.unresolvedReports ?? data.reports.length), `자동숨김 ${summary.autoHiddenPosts || 0}건`)}
      </div>

      <div class="card">
        <div class="card__body">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px">
            <div>
              <div style="font-size:14px;font-weight:900">AI 무료한도 설정</div>
              <div style="font-size:11px;color:var(--color-text-muted);margin-top:3px">일일 한도 초과 시 AI 호출 대신 기본 콘텐츠로 대체됩니다.</div>
            </div>
            <button class="btn btn--primary btn--sm" id="btn-save-ai-settings">설정 저장</button>
          </div>

          <div style="margin-bottom:14px">
            <div style="height:10px;border-radius:999px;background:var(--color-surface-2);overflow:hidden">
              <div style="height:100%;width:${percent}%;background:${percent >= 90 ? 'var(--color-danger)' : 'var(--color-primary)'}"></div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:12px">
            ${toggleField('aiAutoContentEnabled', 'AI 게시글 자동생성', settings.aiAutoContentEnabled, '매일 오전 AI 또는 기본 콘텐츠를 생성합니다.')}
            ${toggleField('aiMissionEnabled', 'AI 미션 자동생성', settings.aiMissionEnabled, '매일 오늘의 미션을 자동 생성합니다.')}
            ${toggleField('aiAdminAutomationEnabled', '관리자 자동화', settings.aiAdminAutomationEnabled, '만료 미션, 오래된 알림, 신고 위험 목록을 자동 처리합니다.')}
            ${toggleField('autoHideReportedPosts', '신고 많은 글 자동숨김', settings.autoHideReportedPosts, '처음에는 꺼두는 것을 권장합니다.')}
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
            <label class="form-group" style="margin:0">
              <span class="form-label">일일 AI 호출 한도</span>
              <input id="aiDailyLimit" class="form-input" type="number" min="0" max="100" value="${settings.aiDailyLimit}">
            </label>
            <label class="form-group" style="margin:0">
              <span class="form-label">자동숨김 신고 기준</span>
              <input id="reportHideThreshold" class="form-input" type="number" min="2" max="20" value="${settings.reportHideThreshold}">
            </label>
            <label class="form-group" style="margin:0">
              <span class="form-label">읽은 알림 보관일</span>
              <input id="notificationRetentionDays" class="form-input" type="number" min="7" max="365" value="${settings.notificationRetentionDays}">
            </label>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">
        <div class="card"><div class="card__body"><div style="font-size:14px;font-weight:900;margin-bottom:10px">📝 오늘 AI 게시글</div>${renderPostList(data.aiPosts)}</div></div>
        <div class="card"><div class="card__body"><div style="font-size:14px;font-weight:900;margin-bottom:10px">🎯 오늘 AI 미션</div>${renderMissionList(data.aiMissions)}</div></div>
      </div>

      <div class="card">
        <div class="card__body">
          <div style="font-size:14px;font-weight:900;margin-bottom:10px">🚨 AI 운영 점검 / 신고 위험 목록</div>
          ${renderRiskList(summary, data.reports)}
        </div>
      </div>
    </div>`;

  bindAiOpsEvents();
}

function getSettingsFromForm() {
  return {
    aiDailyLimit: Number(document.getElementById('aiDailyLimit')?.value || 0),
    aiAutoContentEnabled: !!document.getElementById('aiAutoContentEnabled')?.checked,
    aiMissionEnabled: !!document.getElementById('aiMissionEnabled')?.checked,
    aiAdminAutomationEnabled: !!document.getElementById('aiAdminAutomationEnabled')?.checked,
    autoHideReportedPosts: !!document.getElementById('autoHideReportedPosts')?.checked,
    reportHideThreshold: Number(document.getElementById('reportHideThreshold')?.value || 3),
    notificationRetentionDays: Number(document.getElementById('notificationRetentionDays')?.value || 45),
    updatedAt: serverTimestamp(),
  };
}

async function withBusy(button, label, task) {
  if (!button || button.disabled) return;
  const old = button.textContent;
  button.disabled = true;
  button.textContent = label;
  try {
    await task();
  } finally {
    button.disabled = false;
    button.textContent = old;
  }
}

function bindAiOpsEvents() {
  document.getElementById('btn-save-ai-settings')?.addEventListener('click', async (event) => {
    await withBusy(event.currentTarget, '저장 중...', async () => {
      await setDoc(doc(db, 'site_settings', 'config'), getSettingsFromForm(), { merge: true });
      toast.success('AI 운영 설정을 저장했어요');
      await renderAiOpsPanel();
    });
  });

  document.getElementById('btn-run-admin-automation')?.addEventListener('click', async (event) => {
    await withBusy(event.currentTarget, '실행 중...', async () => {
      await runAdminAutomationNow();
      toast.success('운영 자동화를 실행했어요');
      await renderAiOpsPanel();
    });
  });

  document.getElementById('btn-ai-content-now')?.addEventListener('click', async (event) => {
    await withBusy(event.currentTarget, '생성 중...', async () => {
      const res = await generateAiContentNow({ force: true });
      toast.success(`AI 게시글을 만들었어요 (${res.data?.source || 'fallback'})`);
      await renderAiOpsPanel();
    });
  });

  document.getElementById('btn-ai-mission-now-ops')?.addEventListener('click', async (event) => {
    await withBusy(event.currentTarget, '생성 중...', async () => {
      const res = await generateAiMissionNow({ force: true });
      toast.success(`AI 미션을 만들었어요 (${res.data?.source || 'fallback'})`);
      await renderAiOpsPanel();
    });
  });
}

let timer = null;
const observer = new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(() => { if (isAdminPage()) injectMenu(); }, 100);
});
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('hashchange', () => setTimeout(() => { if (isAdminPage()) injectMenu(); }, 150));
setTimeout(() => { if (isAdminPage()) injectMenu(); }, 300);
