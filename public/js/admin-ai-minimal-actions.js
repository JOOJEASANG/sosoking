import { db, functions, auth } from './firebase.js';
import { addDoc, collection, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
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

const FALLBACK_TEXT = {
  judgment: {
    title: '친구가 약속 30분 전에 또 취소함',
    desc: '이번 달에만 세 번째입니다. 사정은 있다는데 제 시간도 소중한 거 아닌가요? 가볍게 판결 부탁합니다.',
    tags: ['판결', '약속', '소소킹'],
  },
  consult: {
    title: '장바구니가 저를 부릅니다',
    desc: '며칠째 장바구니에서 손짓하는 물건이 있습니다. 사도 되는지 말려야 하는지 상담 부탁합니다.',
    tags: ['상담', '고민', '소소킹'],
  },
  vote: {
    title: '먼저 연락한다 vs 그냥 둔다',
    desc: '한동안 연락이 뜸한 친구에게 먼저 연락하는 게 좋을까요, 아니면 그냥 자연스럽게 두는 게 좋을까요?',
    tags: ['토론', '찬반', '소소킹'],
  },
  drip: {
    title: '오늘의 드립 주제',
    desc: '퇴근 5분 전에 회의 잡힌 사람의 한마디는?',
    tags: ['드립', '한줄드립', '소소킹'],
  },
};

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

function typeLabel(preset) {
  return preset === 'judgment' ? '판결' : preset === 'consult' ? '상담' : preset === 'vote' ? '토론' : '드립';
}

function isAiAdminTab() {
  const content = document.getElementById('admin-content');
  if (!content) return false;
  const active = document.querySelector('.admin-menu-item.active[data-admin-tab="ai"], .admin-menu-item.active[data-tab="ai"]');
  return !!active || content.textContent.includes('AI 관리');
}

async function loadSettings() {
  const [siteSnap, aiSnap, statusResult] = await Promise.all([
    getDoc(doc(db, 'site_settings', 'config')).catch(() => null),
    getDoc(doc(db, 'config', 'ai')).catch(() => null),
    getAdminAutomationStatus().catch(() => null),
  ]);
  const site = siteSnap?.exists?.() ? siteSnap.data() : {};
  const ai = aiSnap?.exists?.() ? aiSnap.data() : {};
  const status = statusResult?.data || {};
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

function buildFallbackPost(preset) {
  const current = auth.currentUser;
  if (!current?.uid) throw new Error('로그인이 필요합니다.');
  const normalized = normalizePreset(preset);
  const label = typeLabel(normalized);
  const data = FALLBACK_TEXT[normalized] || FALLBACK_TEXT.judgment;
  const post = {
    type: 'multi',
    cat: 'multi',
    subtype: normalized,
    feedType: normalized === 'judgment' || normalized === 'vote' ? 'vote' : normalized === 'drip' ? 'drip' : 'collect',
    typeLabel: label,
    title: data.title,
    desc: data.desc,
    tags: data.tags,
    images: [],
    modules: { comments: { enabled: true } },
    anonymous: false,
    anonymousMode: '',
    authorId: current.uid,
    authorName: current.displayName || current.email?.split('@')[0] || '관리자',
    authorPhoto: current.photoURL || '',
    authorEmail: current.email || '',
    reactions: { total: 0 },
    commentCount: 0,
    acrosticCount: 0,
    viewCount: 0,
    pointsScore: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (normalized === 'judgment') {
    post.modules.vote = { enabled: true, voteMode: 'judgment', question: post.desc, options: ['글쓴이가 예민함', '상대가 선 넘음', '둘 다 문제 있음'].map(text => ({ text, votes: 0 })) };
  } else if (normalized === 'vote') {
    post.modules.vote = { enabled: true, voteMode: 'pros_cons', question: post.desc, options: ['찬성', '반대'].map(text => ({ text, votes: 0 })) };
  } else if (normalized === 'consult') {
    post.modules.consult = { enabled: true, topic: 'daily', topicLabel: '일상', style: 'funny', styleLabel: '웃긴해결', question: post.desc };
  } else if (normalized === 'drip') {
    post.modules.drip = { enabled: true, prompt: post.desc, maxLength: 50, responseLabel: '한 줄 드립' };
  }
  return post;
}

async function fallbackCreateCommunityPost(preset) {
  const normalized = normalizePreset(preset);
  const post = buildFallbackPost(normalized);
  const ref = await addDoc(collection(db, 'feeds'), post);
  return { ok: true, fallback: true, preset: normalized, typeLabel: post.typeLabel, docId: ref.id, title: post.title };
}

async function createCommunityPost(preset) {
  try {
    const res = await generateAiContentNow({ preset, force: true });
    return res.data || {};
  } catch (callableError) {
    console.warn('[admin ai] callable failed, using client fallback', callableError);
    return fallbackCreateCommunityPost(preset);
  }
}

async function createAllCommunityPosts() {
  try {
    const res = await generateAllAiContentNow({ force: true });
    return res.data || {};
  } catch (callableError) {
    console.warn('[admin ai] callable all failed, using client fallback', callableError);
    const results = [];
    for (const type of AI_POST_TYPES) results.push(await fallbackCreateCommunityPost(type.key));
    return { ok: true, fallback: true, total: results.length, results };
  }
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
        <div style="font-size:12px;color:var(--color-text-muted);line-height:1.6">AI 데이터는 <b>커뮤니티</b> 영역에 판결 · 상담 · 토론 · 드립 글로 생성됩니다. 서버 생성이 실패하면 현재 관리자 계정으로 직접 생성합니다.</div>
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
            <div style="font-size:11px;color:var(--color-text-muted);margin-top:3px">커뮤니티 AI 글 생성과 관리자 자동화 사용 여부를 설정합니다.</div>
          </div>
          <button class="btn btn--primary btn--sm" id="btn-ai-minimal-save">설정 저장</button>
        </div>
        <div style="height:10px;border-radius:999px;background:var(--color-surface-2);overflow:hidden;margin-bottom:14px"><div style="height:100%;width:${pct}%;background:${pct >= 90 ? 'var(--color-danger)' : 'var(--color-primary)'}"></div></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:14px">
          ${renderToggle('ai-enabled', 'AI 기능 사용', settings.enabled, '전체 AI 기능의 기본 사용 여부입니다.')}
          ${renderToggle('ai-auto-content', 'AI 커뮤니티 글 생성 사용', settings.aiAutoContentEnabled, '운영봇 자동 생성과 관리자 수동 생성을 허용합니다.')}
          ${renderToggle('ai-admin-automation', '관리자 자동화', settings.aiAdminAutomationEnabled, '읽은 알림 정리, 신고 요약 등 운영 보조 기능입니다.')}
          ${renderToggle('ai-auto-hide', '신고 많은 글 자동숨김', settings.autoHideReportedPosts, '처음에는 꺼두는 것을 권장합니다.')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
          <label class="form-group" style="margin:0"><span class="form-label">일일 AI 호출 한도</span><input id="ai-daily-limit" class="form-input" type="number" min="0" max="100" value="${settings.aiDailyLimit}"></label>
          <label class="form-group" style="margin:0"><span class="form-label">자동숨김 신고 기준</span><input id="ai-report-threshold" class="form-input" type="number" min="2" max="20" value="${settings.reportHideThreshold}"></label>
          <label class="form-group" style="margin:0"><span class="form-label">읽은 알림 보관일</span><input id="ai-retention-days" class="form-input" type="number" min="7" max="365" value="${settings.notificationRetentionDays}"></label>
        </div>
      </div></div>
      <div class="card"><div class="card__body">
        <div style="font-size:14px;font-weight:900;margin-bottom:6px">AI 커뮤니티 데이터 수동 생성</div>
        <div style="font-size:12px;color:var(--color-text-muted);line-height:1.6;margin-bottom:12px"><b>커뮤니티</b>에 표시될 판결 / 상담 / 토론 / 드립 글을 생성합니다. 추리방 게임 데이터는 생성하지 않습니다.</div>
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
      const payload = {
        aiAutoContentEnabled: fieldChecked('ai-auto-content'),
        aiAdminAutomationEnabled: fieldChecked('ai-admin-automation'),
        autoHideReportedPosts: fieldChecked('ai-auto-hide'),
        aiDailyLimit: Math.max(0, fieldNumber('ai-daily-limit', 10)),
        reportHideThreshold: Math.max(2, fieldNumber('ai-report-threshold', 3)),
        notificationRetentionDays: Math.max(7, fieldNumber('ai-retention-days', 45)),
        aiMissionEnabled: false,
        updatedAt: serverTimestamp(),
      };
      await Promise.all([
        setDoc(doc(db, 'site_settings', 'config'), payload, { merge: true }),
        saveAiConfig({ enabled: fieldChecked('ai-enabled'), features: { mission: false } }),
      ]);
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
      if (result) result.innerHTML = `✅ ${esc(data.typeLabel || selected.label)} 생성 완료: <b>${esc(data.title || '')}</b>${data.fallback ? ' <span style="color:var(--color-warning);font-weight:900">직접생성</span>' : ''}${link ? ` · <a href="${link}" style="color:var(--color-primary);font-weight:900">글 보기</a>` : ''}`;
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
      if (result) result.innerHTML = `✅ ${data.total || 0}개 커뮤니티 글 생성 완료${data.fallback ? ' <span style="color:var(--color-warning);font-weight:900">직접생성</span>' : ''}${links ? `<br>${links}` : ''}`;
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
