import { functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from './components/toast.js';

const generateAiContentNow = httpsCallable(functions, 'generateAiContentNow');

const TYPES = [
  { key: 'general', label: '일반',    hint: '일반 피드 글 데이터' },
  { key: 'vote',    label: '투표·판정', hint: '선택지/투표 모듈 데이터' },
  { key: 'naming',  label: '작명',    hint: '작명 주제/참여 모듈 데이터' },
  { key: 'drip',    label: '드립',    hint: '한 줄 드립 주제/드립 모듈 데이터' },
  { key: 'quiz',    label: '퀴즈',    hint: '문제/보기/정답/해설 데이터' },
];

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function isAiTab() {
  const content = document.getElementById('admin-content');
  if (!content) return false;
  const active = document.querySelector('.admin-menu-item.active[data-admin-tab="ai"], .admin-menu-item.active[data-tab="ai"]');
  return !!active || content.textContent.includes('AI 관리');
}

function optionHtml() {
  return TYPES.map(type => `<option value="${type.key}">${esc(type.label)} — ${esc(type.hint)}</option>`).join('');
}

function ensureStyle() {
  if (document.getElementById('admin-ai-write-type-select-style')) return;
  const style = document.createElement('style');
  style.id = 'admin-ai-write-type-select-style';
  style.textContent = `
    .admin-ai-write-type-select{border:2px solid color-mix(in srgb,var(--color-primary) 34%,var(--color-border-light));background:linear-gradient(180deg,color-mix(in srgb,var(--color-primary) 6%,var(--color-surface)),var(--color-surface));}
    .admin-ai-write-type-select__title{font-size:16px;font-weight:950;color:var(--color-text-primary);margin-bottom:4px}
    .admin-ai-write-type-select__desc{font-size:12px;color:var(--color-text-muted);line-height:1.55;margin-bottom:14px}
    .admin-ai-write-type-select__row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end}
    .admin-ai-write-type-select__label{display:block;font-size:12px;font-weight:900;margin-bottom:6px;color:var(--color-text-primary)}
    .admin-ai-write-type-select__result{font-size:12px;color:var(--color-text-muted);line-height:1.55;margin-top:10px;min-height:18px}
    @media(max-width:767px){.admin-ai-write-type-select__row{grid-template-columns:1fr}.admin-ai-write-type-select__row .btn{width:100%}}
  `;
  document.head.appendChild(style);
}

function buildPanel() {
  const wrap = document.createElement('div');
  wrap.className = 'card admin-ai-write-type-select';
  wrap.dataset.aiWriteTypeSelect = '1';
  wrap.innerHTML = `
    <div class="card__body">
      <div class="admin-ai-write-type-select__title">글쓰기 유형 선택</div>
      <div class="admin-ai-write-type-select__desc">게시판 글쓰기 유형을 고른 뒤 <b>데이터 생성</b>을 누르면 해당 유형에 맞는 제목, 본문, 선택지, 제시어, 정답/해설 같은 데이터가 자동 생성됩니다.</div>
      <div class="admin-ai-write-type-select__row">
        <label>
          <span class="admin-ai-write-type-select__label">글쓰기 유형</span>
          <select class="form-input" id="admin-ai-write-type-select">
            ${optionHtml()}
          </select>
        </label>
        <button type="button" class="btn btn--primary" id="admin-ai-generate-data-btn">데이터 생성</button>
      </div>
      <div class="admin-ai-write-type-select__result" id="admin-ai-generate-data-result"></div>
    </div>`;
  return wrap;
}

function ensureWriteTypeSelect() {
  if (!isAiTab()) return;
  const content = document.getElementById('admin-content');
  if (!content || content.querySelector('[data-ai-write-type-select]')) return;
  ensureStyle();

  const panel = content.querySelector('#ai-minimal-panel') || content;
  const card = buildPanel();
  const firstCard = panel.querySelector('.card');
  if (firstCard) firstCard.insertAdjacentElement('beforebegin', card);
  else panel.appendChild(card);

  document.getElementById('admin-ai-generate-data-btn')?.addEventListener('click', generateData);
}

async function generateData(event) {
  const btn = event.currentTarget;
  const select = document.getElementById('admin-ai-write-type-select');
  const result = document.getElementById('admin-ai-generate-data-result');
  const preset = select?.value || 'general';
  const type = TYPES.find(item => item.key === preset) || TYPES[0];

  btn.disabled = true;
  btn.textContent = '생성 중...';
  if (result) result.textContent = `${type.label} 유형 데이터를 생성하고 있습니다...`;

  try {
    const res = await generateAiContentNow({ preset, force: true });
    const data = res.data || {};
    const link = data.docId ? `#/detail/${encodeURIComponent(data.docId)}` : '';
    if (result) {
      result.innerHTML = `✅ ${esc(data.typeLabel || type.label)} 데이터 생성 완료: <b>${esc(data.title || '')}</b>${link ? ` · <a href="${link}" style="color:var(--color-primary);font-weight:950">글 보기</a>` : ''}`;
    }
    toast.success(`${type.label} 데이터 생성 완료`);
  } catch (error) {
    console.error(error);
    if (result) result.textContent = '❌ ' + (error.message || '데이터 생성에 실패했어요');
    toast.error(error.message || '데이터 생성에 실패했어요');
  } finally {
    btn.disabled = false;
    btn.textContent = '데이터 생성';
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(ensureWriteTypeSelect, 120);
}

document.addEventListener('click', event => {
  if (event.target.closest?.('[data-admin-tab="ai"], [data-tab="ai"]')) schedule();
}, true);
window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 700);
