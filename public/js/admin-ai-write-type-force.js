import { functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from './components/toast.js';

const callGenerate = httpsCallable(functions, 'generateAiContentNow');
const TYPES = [
  ['general', '일반글', '일반 피드 글 데이터'],
  ['vote', '투표/판정', '선택지/투표 모듈 데이터'],
  ['naming', '미친작명소', '작명 주제/참여 모듈 데이터'],
  ['acrostic', '행시', '제시어/2~5행시 모듈 데이터'],
  ['relay', '막장릴레이', '시작문장/릴레이 모듈 데이터'],
  ['quiz', '미친퀴즈', '문제/보기/정답/해설 데이터'],
];

function isAiScreen() {
  const content = document.getElementById('admin-content');
  if (!content) return false;
  if (content.querySelector('#ai-minimal-panel, #ai-content-preset, #btn-ai-content-now')) return true;
  const active = document.querySelector('.admin-menu-item.active');
  return /AI/.test(active?.textContent || '') || /AI\s*관리|AI\s*기본|AI\s*게시글/.test(content.textContent || '');
}

function addStyle() {
  if (document.getElementById('ai-write-type-force-style')) return;
  const s = document.createElement('style');
  s.id = 'ai-write-type-force-style';
  s.textContent = `.ai-write-type-force{border:2px solid var(--color-primary)!important;background:var(--color-surface)!important;box-shadow:0 12px 30px rgba(255,107,74,.14)!important}.ai-write-type-force__title{font-size:17px;font-weight:950;margin-bottom:5px}.ai-write-type-force__desc{font-size:12px;color:var(--color-text-muted);line-height:1.55;margin-bottom:13px}.ai-write-type-force__row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end}.ai-write-type-force__label{display:block;font-size:12px;font-weight:900;margin-bottom:6px}.ai-write-type-force__result{font-size:12px;color:var(--color-text-muted);line-height:1.55;margin-top:10px;min-height:18px}@media(max-width:767px){.ai-write-type-force__row{grid-template-columns:1fr}.ai-write-type-force__row .btn{width:100%}}`;
  document.head.appendChild(s);
}

function panelHtml() {
  const options = TYPES.map(([key, label, hint]) => `<option value="${key}">${label} — ${hint}</option>`).join('');
  return `<div class="card ai-write-type-force" data-ai-write-type-force="1"><div class="card__body"><div class="ai-write-type-force__title">글쓰기 유형 선택</div><div class="ai-write-type-force__desc">글쓰기 유형을 선택하고 <b>데이터 생성</b>을 누르면 해당 유형에 맞는 제목, 본문, 선택지, 제시어, 정답/해설 데이터가 생성됩니다.</div><div class="ai-write-type-force__row"><label><span class="ai-write-type-force__label">글쓰기 유형</span><select class="form-input" id="ai-force-type-select">${options}</select></label><button class="btn btn--primary" id="ai-force-generate-btn">데이터 생성</button></div><div class="ai-write-type-force__result" id="ai-force-result"></div></div></div>`;
}

function ensurePanel() {
  if (!isAiScreen()) return;
  const content = document.getElementById('admin-content');
  if (!content) return;
  addStyle();
  const target = content.querySelector('#ai-minimal-panel') || content;
  let panel = target.querySelector('[data-ai-write-type-force]');
  if (!panel) {
    target.insertAdjacentHTML('afterbegin', panelHtml());
    panel = target.querySelector('[data-ai-write-type-force]');
  }
  const btn = document.getElementById('ai-force-generate-btn');
  if (btn && btn.dataset.bound !== '1') {
    btn.dataset.bound = '1';
    btn.addEventListener('click', generateData);
  }
}

async function generateData(event) {
  const btn = event.currentTarget;
  const preset = document.getElementById('ai-force-type-select')?.value || 'general';
  const label = TYPES.find(t => t[0] === preset)?.[1] || '일반글';
  const result = document.getElementById('ai-force-result');
  btn.disabled = true;
  btn.textContent = '생성 중...';
  if (result) result.textContent = `${label} 데이터를 생성 중입니다...`;
  try {
    const res = await callGenerate({ preset, force: true });
    const data = res.data || {};
    const link = data.docId ? `#/detail/${encodeURIComponent(data.docId)}` : '';
    if (result) result.innerHTML = `✅ 생성 완료: <b>${data.title || ''}</b>${link ? ` · <a href="${link}" style="color:var(--color-primary);font-weight:950">글 보기</a>` : ''}`;
    toast.success(`${label} 데이터 생성 완료`);
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
  timer = setTimeout(ensurePanel, 100);
}

document.addEventListener('click', schedule, true);
window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
for (let i = 1; i <= 30; i += 1) setTimeout(ensurePanel, i * 500);
