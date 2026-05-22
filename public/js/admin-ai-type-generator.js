import { functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from './components/toast.js';

const generateAiContentNow = httpsCallable(functions, 'generateAiContentNow');

const TYPES = [
  { key: 'general', icon: '📝', label: '일반글', desc: '댓글 반응형 일반 피드' },
  { key: 'vote', icon: '🗳️', label: '투표/판정', desc: '선택지와 투표 데이터 포함' },
  { key: 'naming', icon: '😜', label: '미친작명소', desc: '작명 미션/예시 데이터 포함' },
  { key: 'acrostic', icon: '✍️', label: '행시', desc: '제시어 기반 2~5행시 자동 구성' },
  { key: 'relay', icon: '🎭', label: '막장릴레이', desc: '시작문장/릴레이 설정 포함' },
  { key: 'quiz', icon: '🧠', label: '미친퀴즈', desc: '문제/보기/정답/해설 포함' },
];

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function isAiAdminTab() {
  const content = document.getElementById('admin-content');
  if (!content) return false;
  const active = document.querySelector('.admin-menu-item.active[data-admin-tab="ai"], .admin-menu-item.active[data-tab="ai"]');
  return !!active || content.textContent.includes('AI 관리');
}

function cardHtml(type) {
  return `
    <button type="button" class="admin-ai-type-card" data-ai-type-generate="${esc(type.key)}">
      <span class="admin-ai-type-card__icon">${type.icon}</span>
      <span class="admin-ai-type-card__body">
        <b>${esc(type.label)}</b>
        <small>${esc(type.desc)}</small>
      </span>
      <span class="admin-ai-type-card__action">1개 생성</span>
    </button>`;
}

function ensureStyles() {
  if (document.getElementById('admin-ai-type-generator-style')) return;
  const style = document.createElement('style');
  style.id = 'admin-ai-type-generator-style';
  style.textContent = `
    .admin-ai-type-generator{display:flex;flex-direction:column;gap:10px}
    .admin-ai-type-generator__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:2px}
    .admin-ai-type-generator__title{font-size:14px;font-weight:950;color:var(--color-text-primary)}
    .admin-ai-type-generator__desc{font-size:12px;color:var(--color-text-muted);line-height:1.55;margin-top:3px}
    .admin-ai-type-generator__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}
    .admin-ai-type-card{display:flex;align-items:center;gap:10px;text-align:left;padding:12px;border:1px solid var(--color-border-light);border-radius:16px;background:var(--color-surface);box-shadow:var(--shadow-sm);cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease}
    .admin-ai-type-card:hover{transform:translateY(-1px);border-color:var(--color-primary);box-shadow:var(--shadow-md)}
    .admin-ai-type-card:disabled{opacity:.58;cursor:progress;transform:none}
    .admin-ai-type-card__icon{width:38px;height:38px;display:grid;place-items:center;border-radius:14px;background:var(--color-primary-bg);font-size:20px;flex:0 0 auto}
    .admin-ai-type-card__body{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
    .admin-ai-type-card__body b{font-size:13px;color:var(--color-text-primary)}
    .admin-ai-type-card__body small{font-size:11px;color:var(--color-text-muted);line-height:1.35}
    .admin-ai-type-card__action{font-size:11px;font-weight:950;color:var(--color-primary);white-space:nowrap}
    .admin-ai-type-generator__result{font-size:12px;color:var(--color-text-muted);line-height:1.55;min-height:18px}
    @media(max-width:767px){.admin-ai-type-generator__grid{grid-template-columns:1fr}.admin-ai-type-card{padding:11px}.admin-ai-type-card__action{font-size:10px}}
  `;
  document.head.appendChild(style);
}

function ensureTypeGenerator() {
  if (!isAiAdminTab()) return;
  const panel = document.getElementById('ai-minimal-panel');
  if (!panel || panel.querySelector('[data-admin-ai-type-generator]')) return;
  ensureStyles();

  const manualCard = [...panel.querySelectorAll('.card')].find(card => card.textContent.includes('AI 게시글 수동 생성'));
  const section = document.createElement('div');
  section.className = 'card';
  section.dataset.adminAiTypeGenerator = '1';
  section.innerHTML = `
    <div class="card__body admin-ai-type-generator">
      <div class="admin-ai-type-generator__head">
        <div>
          <div class="admin-ai-type-generator__title">글쓰기 유형별 자동데이터 생성</div>
          <div class="admin-ai-type-generator__desc">각 유형의 게시판 구조에 맞춰 제목, 본문, modules, 선택지, 정답/해설 같은 상세 데이터를 자동 주입합니다. 버튼을 누른 유형만 1개 생성됩니다.</div>
        </div>
      </div>
      <div class="admin-ai-type-generator__grid">
        ${TYPES.map(cardHtml).join('')}
      </div>
      <div class="admin-ai-type-generator__result" id="admin-ai-type-result"></div>
    </div>`;

  if (manualCard) manualCard.insertAdjacentElement('beforebegin', section);
  else panel.appendChild(section);

  section.querySelectorAll('[data-ai-type-generate]').forEach(btn => {
    btn.addEventListener('click', () => generateOne(btn));
  });
}

async function generateOne(btn) {
  const preset = btn.dataset.aiTypeGenerate || 'general';
  const type = TYPES.find(item => item.key === preset) || TYPES[0];
  const result = document.getElementById('admin-ai-type-result');
  if (!confirm(`${type.label} 유형 게시글 1개를 자동 생성할까요?`)) return;

  const old = btn.querySelector('.admin-ai-type-card__action')?.textContent || '1개 생성';
  const action = btn.querySelector('.admin-ai-type-card__action');
  btn.disabled = true;
  if (action) action.textContent = '생성 중...';
  if (result) result.textContent = `${type.label} 유형 데이터를 생성하고 있습니다...`;

  try {
    const res = await generateAiContentNow({ preset, force: true });
    const data = res.data || {};
    const link = data.docId ? `#/detail/${encodeURIComponent(data.docId)}` : '';
    if (result) {
      result.innerHTML = `✅ ${esc(data.typeLabel || type.label)} 생성 완료: <b>${esc(data.title || '')}</b>${link ? ` · <a href="${link}" style="color:var(--color-primary);font-weight:950">글 보기</a>` : ''}`;
    }
    toast.success(`${type.label} AI 게시글을 생성했어요`);
  } catch (error) {
    console.error(error);
    if (result) result.textContent = '❌ ' + (error.message || 'AI 게시글 생성에 실패했어요');
    toast.error(error.message || 'AI 게시글 생성에 실패했어요');
  } finally {
    btn.disabled = false;
    if (action) action.textContent = old;
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(ensureTypeGenerator, 180);
}

document.addEventListener('click', event => {
  if (event.target.closest?.('[data-admin-tab="ai"], [data-tab="ai"]')) schedule();
}, true);
window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 800);
