import { db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const STYLE_ID = 'sosoking-quiz-gameplay-patch';
let scheduled = false;
let boundWrite = false;

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .soso-quiz-maker{margin:12px 0 16px;padding:14px;border:1px solid rgba(79,70,229,.14);border-radius:14px;background:linear-gradient(180deg,#fff,#f8fafc);box-shadow:0 8px 22px rgba(32,46,90,.06)}
    .soso-quiz-maker-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:12px}.soso-quiz-maker-head b{display:block;font-size:17px;letter-spacing:-.045em;color:#111827}.soso-quiz-maker-head small{display:block;margin-top:4px;color:#667085;font-size:12px;line-height:1.45;font-weight:800}.soso-quiz-mode{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}.soso-quiz-mode label{display:flex!important;align-items:center;justify-content:center;gap:7px;min-height:42px;margin:0!important;border:1px solid rgba(32,46,90,.10);border-radius:12px;background:#fff;color:#111827;font-size:13px;font-weight:950;cursor:pointer}.soso-quiz-mode input{width:auto!important;min-height:auto!important}.soso-quiz-maker select,.soso-quiz-maker input,.soso-quiz-maker textarea{width:100%;min-height:42px;border:1px solid rgba(32,46,90,.10);border-radius:12px;background:#fff;padding:10px 12px;color:#111827;font-family:inherit;font-weight:850}.soso-quiz-maker textarea{min-height:72px;resize:vertical}.soso-quiz-maker-row{display:grid;gap:8px}.soso-quiz-maker-row label{margin:0!important;color:#667085;font-size:12px!important;font-weight:950!important}.soso-quiz-subjective{display:none}.soso-quiz-maker[data-mode="subjective"] .soso-quiz-objective{display:none}.soso-quiz-maker[data-mode="subjective"] .soso-quiz-subjective{display:grid}.soso-quiz-tip{margin-top:9px;color:#98a2b3;font-size:11px;line-height:1.45;font-weight:850}.soso-quiz-play{margin-top:14px;padding:14px;border-radius:14px;border:1px solid rgba(79,70,229,.14);background:#fff}.soso-quiz-play b{display:block;color:#111827;font-size:17px;letter-spacing:-.045em}.soso-quiz-play p{margin:6px 0 12px;color:#667085;font-size:13px;line-height:1.55}.soso-quiz-answer-list{display:grid;gap:8px}.soso-quiz-answer-list button,.soso-quiz-submit{min-height:42px;border:1px solid rgba(32,46,90,.10);border-radius:12px;background:#f8fafc;color:#111827;font-weight:950;font-family:inherit;cursor:pointer}.soso-quiz-answer-list button:hover{background:#eef2ff;color:#4f46e5}.soso-quiz-submission{display:grid;grid-template-columns:1fr auto;gap:8px}.soso-quiz-submission input{min-height:42px;border:1px solid rgba(32,46,90,.12);border-radius:12px;padding:0 12px;font-family:inherit;font-weight:850}.soso-quiz-submit{padding:0 14px;background:#111827;color:#fff}.soso-quiz-result{margin-top:10px;padding:12px;border-radius:12px;font-weight:950;font-size:14px}.soso-quiz-result.correct{background:#ecfdf3;color:#027a48}.soso-quiz-result.wrong{background:#fff1f3;color:#c01048}.soso-quiz-result.pending{background:#eef2ff;color:#4f46e5}
    @media(max-width:640px){.soso-quiz-mode,.soso-quiz-submission{grid-template-columns:1fr}.soso-quiz-maker{padding:12px}}
    [data-theme="dark"] .soso-quiz-maker,[data-theme="dark"] .soso-quiz-play,[data-theme="dark"] .soso-quiz-maker input,[data-theme="dark"] .soso-quiz-maker textarea,[data-theme="dark"] .soso-quiz-maker select,[data-theme="dark"] .soso-quiz-mode label{background:#111827;color:#f8fafc;border-color:rgba(255,255,255,.10)}[data-theme="dark"] .soso-quiz-maker-head b,[data-theme="dark"] .soso-quiz-play b{color:#f8fafc}[data-theme="dark"] .soso-quiz-maker-head small,[data-theme="dark"] .soso-quiz-play p{color:#a8b3c7}
  `;
  document.head.appendChild(style);
}

function clean(value, max = 500) {
  return String(value || '').replace(/[<>]/g, '').replace(/\s{2,}/g, ' ').trim().slice(0, max);
}
function normalizeAnswer(value) {
  return clean(value, 160).replace(/\s+/g, '').toLowerCase();
}
async function sha256Hex(value) {
  try {
    const data = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 0;
    for (let i = 0; i < value.length; i++) h = Math.imul(31, h) + value.charCodeAt(i) | 0;
    return `fallback-${Math.abs(h)}`;
  }
}
function isQuizType(type) {
  return /퀴즈|심리테스트/.test(String(type || ''));
}
function currentType() {
  return document.querySelector('#feed-type')?.value || document.querySelector('#type-grid button.active')?.dataset?.type || '';
}
function getOptionValues() {
  return [...document.querySelectorAll('.feed-option-input')].map(input => clean(input.value, 40)).filter(Boolean);
}
function syncObjectiveOptions() {
  const select = document.querySelector('#soso-quiz-correct-option');
  if (!select) return;
  const previous = select.value;
  const options = getOptionValues();
  select.innerHTML = options.map((option, i) => `<option value="${escapeAttr(option)}">${i + 1}. ${escapeHtml(option)}</option>`).join('');
  if (options.includes(previous)) select.value = previous;
  const answer = document.querySelector('#soso-quiz-answer');
  if (answer && select.value) answer.value = select.value;
}
function patchQuizMaker() {
  if (!location.hash.startsWith('#/feed/new')) return;
  const form = document.querySelector('#feed-write-form');
  const typeHelp = document.querySelector('#feed-type-help');
  if (!form || !typeHelp) return;
  injectStyle();
  let panel = document.querySelector('#soso-quiz-maker');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'soso-quiz-maker';
    panel.className = 'soso-quiz-maker';
    panel.dataset.mode = 'objective';
    panel.innerHTML = `
      <div class="soso-quiz-maker-head"><div><b>내맘대로 퀴즈 설정</b><small>정답은 피드에 공개하지 않고, 참여자가 제출하면 정답/오답만 표시합니다.</small></div></div>
      <div class="soso-quiz-mode">
        <label><input type="radio" name="soso-quiz-mode" value="objective" checked> 객관식</label>
        <label><input type="radio" name="soso-quiz-mode" value="subjective"> 주관식</label>
      </div>
      <div class="soso-quiz-maker-row soso-quiz-objective"><label>객관식 정답 선택</label><select id="soso-quiz-correct-option"></select></div>
      <div class="soso-quiz-maker-row soso-quiz-subjective"><label>주관식 정답 입력</label><input id="soso-quiz-subjective-answer" maxlength="80" placeholder="예: 소소킹"></div>
      <input id="soso-quiz-answer" type="hidden">
      <div class="soso-quiz-maker-row"><label>정답 후 안내 문구 선택사항</label><textarea id="soso-quiz-note" maxlength="220" placeholder="예: 정답자는 댓글로 인증해보세요. 정답 원문은 공개되지 않습니다."></textarea></div>
      <div class="soso-quiz-tip">객관식은 참여자가 보기를 누르면 바로 채점됩니다. 주관식은 입력한 답을 기준으로 공백/대소문자를 무시하고 채점합니다.</div>`;
    typeHelp.insertAdjacentElement('afterend', panel);
  }
  panel.hidden = !isQuizType(currentType());
  if (!panel.hidden) syncObjectiveOptions();
  if (!boundWrite) {
    boundWrite = true;
    document.addEventListener('change', event => {
      if (event.target?.name === 'soso-quiz-mode') {
        const mode = event.target.value === 'subjective' ? 'subjective' : 'objective';
        const quizPanel = document.querySelector('#soso-quiz-maker');
        if (quizPanel) quizPanel.dataset.mode = mode;
        const answer = document.querySelector('#soso-quiz-answer');
        if (answer) answer.value = mode === 'subjective' ? clean(document.querySelector('#soso-quiz-subjective-answer')?.value, 80) : clean(document.querySelector('#soso-quiz-correct-option')?.value, 80);
      }
      if (event.target?.id === 'soso-quiz-correct-option') {
        const answer = document.querySelector('#soso-quiz-answer');
        if (answer) answer.value = clean(event.target.value, 80);
      }
    }, true);
    document.addEventListener('input', event => {
      if (event.target?.classList?.contains('feed-option-input')) syncObjectiveOptions();
      if (event.target?.id === 'soso-quiz-subjective-answer') {
        const mode = document.querySelector('input[name="soso-quiz-mode"]:checked')?.value || 'objective';
        if (mode === 'subjective') document.querySelector('#soso-quiz-answer').value = clean(event.target.value, 80);
      }
    }, true);
    document.addEventListener('click', event => {
      if (event.target?.closest?.('#type-grid button[data-type], .category-grid button[data-category]')) setTimeout(patchQuizMaker, 60);
    }, true);
  }
}

window.sosoBuildQuizPayload = async function sosoBuildQuizPayload(type) {
  if (!isQuizType(type)) return { quizMode: '', quizAnswerHash: '', quizAnswerSalt: '', quizNote: '' };
  const mode = document.querySelector('input[name="soso-quiz-mode"]:checked')?.value === 'subjective' ? 'subjective' : 'objective';
  const rawAnswer = mode === 'subjective' ? clean(document.querySelector('#soso-quiz-subjective-answer')?.value, 80) : clean(document.querySelector('#soso-quiz-correct-option')?.value, 80);
  if (!rawAnswer) throw new Error('퀴즈 정답을 입력하거나 선택해주세요.');
  const salt = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const hash = await sha256Hex(`${salt}:${normalizeAnswer(rawAnswer)}`);
  return { quizMode: mode, quizAnswerHash: hash, quizAnswerSalt: salt, quizNote: clean(document.querySelector('#soso-quiz-note')?.value, 220) };
};

async function patchQuizDetail() {
  const hash = location.hash || '';
  if (!hash.startsWith('#/feed/') || ['#/feed/new', '#/feed/top'].includes(hash)) return;
  injectStyle();
  const postId = decodeURIComponent(hash.replace('#/feed/', ''));
  if (!postId || document.querySelector(`[data-soso-quiz-play="${CSS.escape(postId)}"]`)) return;
  try {
    const snap = await getDoc(doc(db, 'soso_feed_posts', postId));
    if (!snap.exists()) return;
    const data = snap.data();
    if (!data.quizAnswerHash || !isQuizType(data.type)) return;
    const box = document.querySelector('.detail-main-card .feed-question');
    if (!box) return;
    const options = Array.isArray(data.options) ? data.options.filter(Boolean).slice(0, 4) : [];
    const mode = data.quizMode === 'subjective' ? 'subjective' : 'objective';
    box.dataset.sosoQuizPlay = postId;
    box.innerHTML = `
      <div class="soso-quiz-play" data-soso-quiz-play="${escapeAttr(postId)}">
        <b>🧠 내맘대로 퀴즈</b>
        <p>${escapeHtml(data.question || '정답을 맞혀보세요. 정답은 공개되지 않고 정답/오답만 표시됩니다.')}</p>
        ${mode === 'objective' ? `<div class="soso-quiz-answer-list">${options.map(option => `<button type="button" data-quiz-answer="${escapeAttr(option)}">${escapeHtml(option)}</button>`).join('')}</div>` : `<div class="soso-quiz-submission"><input id="soso-quiz-user-answer" maxlength="80" placeholder="정답을 입력하세요"><button class="soso-quiz-submit" type="button">제출</button></div>`}
        <div class="soso-quiz-result pending">정답은 비공개입니다. 제출하면 정답/오답만 표시됩니다.</div>
      </div>`;
    const result = box.querySelector('.soso-quiz-result');
    const check = async (answer) => {
      result.className = 'soso-quiz-result pending';
      result.textContent = '채점 중...';
      const answerHash = await sha256Hex(`${data.quizAnswerSalt}:${normalizeAnswer(answer)}`);
      const correct = answerHash === data.quizAnswerHash;
      result.className = `soso-quiz-result ${correct ? 'correct' : 'wrong'}`;
      result.textContent = correct ? `정답입니다! ${data.quizNote || ''}`.trim() : '오답입니다. 다시 생각해보세요.';
      localStorage.setItem(`sosoQuizResult:${postId}`, correct ? 'correct' : 'wrong');
    };
    box.querySelectorAll('[data-quiz-answer]').forEach(button => button.addEventListener('click', () => check(button.dataset.quizAnswer || '')));
    box.querySelector('.soso-quiz-submit')?.addEventListener('click', () => check(box.querySelector('#soso-quiz-user-answer')?.value || ''));
    box.querySelector('#soso-quiz-user-answer')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); check(event.currentTarget.value || ''); } });
  } catch (error) {
    console.warn('퀴즈 패치 적용 실패:', error.message || error);
  }
}

function escapeHtml(value) { return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escapeAttr(value) { return escapeHtml(value).replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

function schedulePatch() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    patchQuizMaker();
    patchQuizDetail();
  });
}

new MutationObserver(schedulePatch).observe(document.getElementById('page-content') || document.body, { childList: true, subtree: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedulePatch);
else schedulePatch();
window.addEventListener('hashchange', () => setTimeout(schedulePatch, 60));
setTimeout(schedulePatch, 0);
setTimeout(schedulePatch, 400);
setTimeout(schedulePatch, 1200);
