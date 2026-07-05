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
  { key: 'vote', label: '토론', storageLabel: '토론소', desc: '글쓰기의 VS 투표 구조로 생성' },
  { key: 'drip', label: '드립', storageLabel: '드립소', desc: '글쓰기의 드립소 구조로 생성' },
];

const FALLBACK_TEXT = {
  vote: {
    title: '배달비 4천원이면 시킨다 VS 참는다',
    desc: '메뉴보다 배달비가 더 크게 느껴지는 순간입니다. 이건 행복 비용일까요, 지갑 배신일까요?',
    tags: ['토론', 'VS', '배달비'],
    options: ['시킨다', '참는다'],
  },
  drip: {
    title: '퇴근 5분 전 회의 이름 지어주세요',
    desc: '퇴근 5분 전에 “잠깐 회의 가능?” 메시지가 왔을 때의 감정을 한 줄로 살려주세요.',
    tags: ['드립', '작명', '직장인'],
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
  const key = String(value || 'drip').trim();
  if (key === 'vote' || key === 'debate' || key === 'discussion' || key === 'ox') return 'vote';
  if (key === 'drip' || key === 'naming' || key === 'translation' || key === 'translate') return 'drip';
  return AI_POST_TYPES.some(type => type.key === key) ? key : 'drip';
}

function storageLabel(preset) {
  return normalizePreset(preset) === 'vote' ? '토론소' : '드립소';
}

function isAiAdminTab() {
  const content = document.getElementById('admin-content');
  if (!content) return false;
  const active = document.querySelector('.admin-menu-item.active[data-admin-tab="ai"], .admin-menu-item.active[data-tab="ai"]');
  return !!active || content.textContent.includes('AI 운영');
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
  const features = ai.features || {};
  return {
    enabled: ai.enabled !== false,
    characterPanelEnabled: features.characterPanel !== false,
    imageAnalysisEnabled: features.imageAnalysis !== false,
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
function detailLink(data) { const id = data.docId || ''; return id ? `#/detail/${encodeURIComponent(id)}` : ''; }
function renderAiPostTypeOptions() { return AI_POST_TYPES.map(type => `<option value="${type.key}">${esc(type.label)} — ${esc(type.desc)}</option>`).join(''); }
function renderStat(label, value, sub = '') { return `<div class="admin-stat-card"><div class="admin-stat-card__num">${esc(value)}</div><div class="admin-stat-card__label">${esc(label)}</div>${sub ? `<div style="font-size:11px;color:var(--color-text-muted);margin-top:4px">${esc(sub)}</div>` : ''}</div>`; }
function renderToggle(id, label, checked, help) { return `<label style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px;border:1px solid var(--color-border-light);border-radius:12px;background:var(--color-surface-2)"><span><span style="display:block;font-size:13px;font-weight:900;margin-bottom:3px">${esc(label)}</span><span style="display:block;font-size:11px;color:var(--color-text-muted);line-height:1.45">${esc(help)}</span></span><input id="${id}" type="checkbox" ${checked ? 'checked' : ''} style="width:18px;height:18px;flex-shrink:0"></label>`; }

function buildFallbackPanel(preset, post) {
  const isVote = preset === 'vote';
  return {
    enabled: true,
    status: 'fallback',
    kind: preset,
    headline: isVote ? '운영봇이 토론소를 열었습니다' : '운영봇이 드립소를 열었습니다',
    imageRead: '',
    imageCountAnalyzed: 0,
    host: {
      id: 'opsbot', name: '운영봇', emoji: '🤖', role: '사회자',
      opening: isVote ? `오늘의 토론 주제는 “${post.title}”입니다.` : `오늘의 드립 소재는 “${post.title}”입니다.`,
      summary: isVote ? '사소하지만 은근히 갈릴 만한 VS 주제입니다.' : '짧게 받을수록 더 웃긴 소재입니다.',
      question: isVote ? '어느 쪽인지 투표하고 이유를 한 줄로 남겨주세요.' : '이 상황을 더 웃긴 한 줄로 받아쳐주세요.',
    },
    characters: isVote ? [
      { id: 'rebel', name: '반항아', emoji: '😤', role: '삐딱한 반대충', stance: '반대쪽부터 봄', lines: ['저는 일단 반대편부터 보겠습니다.'], punchline: '다들 너무 빨리 결론 냈습니다.' },
      { id: 'bothsides', name: '갈팡러', emoji: '🤔', role: '양쪽 다 맞는 중립러', stance: '둘 다 이해됨', lines: ['이쪽도 맞고 저쪽도 맞는 것 같습니다.'], punchline: '저는 오늘도 결론을 보류하겠습니다.' },
      { id: 'fact', name: '팩폭러', emoji: '🧊', role: '차가운 요약러', stance: '핵심 정리', lines: ['핵심은 나중에 덜 후회하는 쪽입니다.'], punchline: '이건 후회 관리입니다.' },
    ] : [
      { id: 'jujup', name: '주접러', emoji: '😍', role: '호들갑 칭찬러', stance: '소재 띄우기', lines: ['이 소재는 그냥 지나가면 드립 예의가 아닙니다.'], punchline: '지금 박수 치면서 댓글 달아도 됩니다.' },
      { id: 'madcap', name: '광기러', emoji: '🤪', role: '이상한 상상러', stance: '세계관 확장', lines: ['이건 현실이 잠깐 장르를 잘못 고른 순간입니다.'], punchline: '현실이 오늘 업데이트를 잘못 눌렀습니다.' },
      { id: 'ajae', name: '아재봇', emoji: '🧓', role: '썰렁 개그 담당', stance: '말장난', lines: ['웃기지 않아도 기억에는 남습니다.'], punchline: '이건 드립이 아니라 드립커피입니다.' },
    ],
    bestLines: isVote ? ['저는 오늘도 결론을 보류하겠습니다.', '이건 후회 관리입니다.'] : ['현실이 오늘 업데이트를 잘못 눌렀습니다.', '이건 드립이 아니라 드립커피입니다.'],
    commentPrompt: isVote ? '투표하고 한 줄 이유를 남겨주세요.' : '더 웃긴 이름이나 한 줄 드립을 댓글로 남겨주세요.',
    model: 'fallback',
    generatedAt: serverTimestamp(),
  };
}

function buildFallbackPost(preset) {
  const current = auth.currentUser;
  if (!current?.uid) throw new Error('로그인이 필요합니다.');
  const normalized = normalizePreset(preset);
  const data = FALLBACK_TEXT[normalized] || FALLBACK_TEXT.drip;
  const label = storageLabel(normalized);
  const post = {
    type: 'multi',
    cat: 'multi',
    subtype: normalized,
    feedType: normalized,
    typeLabel: label,
    title: data.title,
    desc: data.desc,
    tags: [...(data.tags || []), label, '소소킹'].filter((tag, index, arr) => tag && arr.indexOf(tag) === index).slice(0, 8),
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
    viewCount: 0,
    pointsScore: 0,
    isAiGenerated: true,
    aiSource: 'admin-client-fallback',
    aiPreset: normalized,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (normalized === 'vote') {
    post.modules.vote = {
      enabled: true,
      voteMode: 'pros_cons',
      question: post.desc,
      options: (data.options || ['왼쪽', '오른쪽']).slice(0, 2).map(text => ({ text, votes: 0 })),
    };
  } else {
    post.modules.drip = { enabled: true, prompt: post.desc, maxLength: 50, responseLabel: '한 줄 드립' };
  }
  post.aiCharacterPanel = buildFallbackPanel(normalized, post);
  return post;
}

async function fallbackCreateCommunityPost(preset) {
  const normalized = normalizePreset(preset);
  const post = buildFallbackPost(normalized);
  const ref = await addDoc(collection(db, 'feeds'), post);
  return { ok: true, fallback: true, preset: normalized, typeLabel: post.typeLabel, docId: ref.id, title: post.title };
}

async function createCommunityPost(preset) {
  const normalized = normalizePreset(preset);
  try {
    const res = await generateAiContentNow({ preset: normalized, force: true });
    return res.data || {};
  } catch (callableError) {
    console.warn('[admin ai] callable failed, using client fallback', callableError);
    return fallbackCreateCommunityPost(normalized);
  }
}

async function createTwoCommunityPosts() {
  try {
    const res = await generateAllAiContentNow({ force: true, presets: ['vote', 'drip'] });
    const data = res.data || {};
    if (Array.isArray(data.results)) {
      data.results = data.results.filter(item => ['vote', 'drip'].includes(normalizePreset(item.preset || item.type || item.feedType)));
      data.total = data.results.length;
    }
    return data;
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
  content.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;

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
        <h2 class="admin-section-title">🤖 AI 운영</h2>
        <div style="font-size:12px;color:var(--color-text-muted);line-height:1.6">AI 데이터는 글쓰기와 같은 저장 구조로 생성됩니다. <b>토론</b>은 VS 투표, <b>드립</b>은 드립소 구조로 저장됩니다.</div>
      </div>
      <div class="admin-stat-grid">
        ${renderStat('오늘 AI 사용량', `${used}/${limit || 0}`, `${pct}% 사용`)}
        ${renderStat('오늘 AI 콘텐츠', summary.todayAiPosts ?? '-', '토론/드립 생성 포함')}
        ${renderStat('미처리 신고', summary.unresolvedReports ?? '-', `자동숨김 ${summary.autoHiddenPosts || 0}건`)}
      </div>
      <div class="card"><div class="card__body">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
          <div><div style="font-size:14px;font-weight:900">AI 기본 설정</div><div style="font-size:11px;color:var(--color-text-muted);margin-top:3px">AI 캐릭터 패널, 이미지 분석, 관리자 자동화 사용 여부를 설정합니다.</div></div>
          <button class="btn btn--primary btn--sm" id="btn-ai-minimal-save">설정 저장</button>
        </div>
        <div style="height:10px;border-radius:999px;background:var(--color-surface-2);overflow:hidden;margin-bottom:14px"><div style="height:100%;width:${pct}%;background:${pct >= 90 ? 'var(--color-danger)' : 'var(--color-primary)'}"></div></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:14px">
          ${renderToggle('ai-enabled', 'AI 기능 사용', settings.enabled, '전체 AI 기능의 기본 사용 여부입니다.')}
          ${renderToggle('ai-character-panel', 'AI 캐릭터 패널 생성', settings.characterPanelEnabled, '글 작성 후 운영봇과 캐릭터 반응을 생성합니다.')}
          ${renderToggle('ai-image-analysis', '첨부 이미지 분석 반영', settings.imageAnalysisEnabled, '사진이 있으면 보이는 범위에서 상황을 읽고 반영합니다.')}
          ${renderToggle('ai-auto-content', '토론/드립 샘플 생성 허용', settings.aiAutoContentEnabled, '운영봇 자동 생성과 관리자 수동 생성을 허용합니다.')}
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
        <div style="font-size:14px;font-weight:900;margin-bottom:6px">AI 데이터 자동 생성</div>
        <div style="font-size:12px;color:var(--color-text-muted);line-height:1.6;margin-bottom:12px">생성되는 글은 글쓰기 저장 구조와 동일합니다. 토론은 <code>modules.vote</code>, 드립은 <code>modules.drip</code>로 저장됩니다.</div>
        <div style="display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center"><select class="form-input" id="ai-content-preset" aria-label="AI 콘텐츠 유형 선택">${renderAiPostTypeOptions()}</select><button class="btn btn--primary btn--sm" id="btn-ai-content-now">선택 글 1개 생성</button><button class="btn btn--ghost btn--sm" id="btn-ai-content-all">토론+드립 생성</button></div>
        <div id="ai-content-result" style="font-size:12px;color:var(--color-text-muted);margin-top:10px;line-height:1.6"></div>
      </div></div>
      <div class="card"><div class="card__body"><div style="font-size:14px;font-weight:900;margin-bottom:12px">관리자 자동화</div><button class="btn btn--ghost btn--sm" id="btn-ai-run-automation">관리자 자동화 실행</button><div style="font-size:11px;color:var(--color-text-muted);margin-top:10px">관리자 자동화는 알림 정리와 신고 요약 등 운영 보조 기능입니다.</div></div></div>
    </div>`;

  document.getElementById('btn-ai-minimal-save')?.addEventListener('click', async () => {
    try {
      await Promise.all([
        setDoc(doc(db, 'site_settings', 'config'), {
          aiAutoContentEnabled: fieldChecked('ai-auto-content'),
          aiAdminAutomationEnabled: fieldChecked('ai-admin-automation'),
          autoHideReportedPosts: fieldChecked('ai-auto-hide'),
          aiDailyLimit: Math.max(0, fieldNumber('ai-daily-limit', 10)),
          reportHideThreshold: Math.max(2, fieldNumber('ai-report-threshold', 3)),
          notificationRetentionDays: Math.max(7, fieldNumber('ai-retention-days', 45)),
          aiMissionEnabled: false,
          updatedAt: serverTimestamp(),
        }, { merge: true }),
        saveAiConfig({ enabled: fieldChecked('ai-enabled'), features: { mission: false, characterPanel: fieldChecked('ai-character-panel'), imageAnalysis: fieldChecked('ai-image-analysis') } }),
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
    const preset = normalizePreset(document.getElementById('ai-content-preset')?.value || 'drip');
    const selected = AI_POST_TYPES.find(type => type.key === preset) || AI_POST_TYPES[1];
    const result = document.getElementById('ai-content-result');
    if (!confirm(`${selected.label} 글 1개를 글쓰기 구조로 생성할까요?`)) return;
    btn.disabled = true;
    btn.textContent = '생성 중...';
    if (result) result.textContent = `${selected.label} 글을 생성 중입니다...`;
    try {
      const data = await createCommunityPost(preset);
      const link = detailLink(data);
      if (result) result.innerHTML = `✅ ${esc(data.typeLabel || selected.storageLabel)} 생성 완료: <b>${esc(data.title || '')}</b>${data.fallback ? ' <span style="color:var(--color-warning);font-weight:900">직접생성</span>' : ''}${link ? ` · <a href="${link}" style="color:var(--color-primary);font-weight:900">글 보기</a>` : ''}`;
      toast.success(`${selected.label} 글을 생성했어요`);
    } catch (error) {
      console.error(error);
      if (result) result.textContent = '❌ ' + (error.message || 'AI 콘텐츠 생성에 실패했어요');
      toast.error(error.message || 'AI 콘텐츠 생성에 실패했어요');
    } finally {
      btn.disabled = false;
      btn.textContent = '선택 글 1개 생성';
    }
  });

  document.getElementById('btn-ai-content-all')?.addEventListener('click', async event => {
    const btn = event.currentTarget;
    const result = document.getElementById('ai-content-result');
    if (!confirm('토론 글과 드립 글을 글쓰기 구조로 각각 1개씩 생성할까요?')) return;
    btn.disabled = true;
    btn.textContent = '생성 중...';
    if (result) result.textContent = '토론+드립 2개 글을 생성 중입니다...';
    try {
      const data = await createTwoCommunityPosts();
      const links = Array.isArray(data.results) ? data.results.map(item => {
        const link = detailLink(item);
        return link ? `<a href="${link}" style="color:var(--color-primary);font-weight:900">${esc(item.title || item.preset)}</a>` : esc(item.title || item.preset);
      }).join(' · ') : '';
      if (result) result.innerHTML = `✅ ${data.total || 0}개 글 생성 완료${data.fallback ? ' <span style="color:var(--color-warning);font-weight:900">직접생성</span>' : ''}${links ? `<br>${links}` : ''}`;
      toast.success('토론+드립 글을 생성했어요');
    } catch (error) {
      console.error(error);
      if (result) result.textContent = '❌ ' + (error.message || 'AI 콘텐츠 생성에 실패했어요');
      toast.error(error.message || 'AI 콘텐츠 생성에 실패했어요');
    } finally {
      btn.disabled = false;
      btn.textContent = '토론+드립 생성';
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

new MutationObserver(() => scheduleRender(false)).observe(document.documentElement, { childList: true, subtree: true });
scheduleRender(false);
