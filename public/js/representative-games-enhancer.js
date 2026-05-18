import { db, auth } from './firebase.js';
import {
  collection, addDoc, doc, getDoc, updateDoc,
  serverTimestamp, arrayUnion,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';

function isWritePage() {
  return (window.location.hash || '').startsWith('#/write');
}

function getWriteType() {
  const hash = window.location.hash || '';
  const query = hash.includes('?') ? hash.split('?')[1] : '';
  return new URLSearchParams(query).get('type') || '';
}

function clean(value, max = 200) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, max);
}

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderShell(title, icon, fieldsHtml) {
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `
    <div class="write-page">
      <div class="write-steps">
        <div class="write-step-dot done">✓</div>
        <div class="write-step-line done"></div>
        <div class="write-step-dot current">2</div>
      </div>
      <div class="write-step-header">
        <button class="write-back-btn" id="btn-rep-back">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <h1 class="write-step-title">${icon} ${title}</h1>
      </div>
      <div class="card">
        <div class="card__body--lg" id="form-fields">${fieldsHtml}</div>
        <div class="card__footer">
          <div class="write-submit">
            <button class="btn btn--ghost" onclick="navigate('/feed')">취소</button>
            <button class="btn btn--primary" id="btn-submit">올리기</button>
          </div>
        </div>
      </div>
    </div>`;
  document.getElementById('btn-rep-back')?.addEventListener('click', () => navigate('/write'));
}

function renderCrazyQuizPage() {
  renderShell('미친퀴즈', '🧠', `
    <div class="form-group">
      <label class="form-label">문제 <span class="required">*</span></label>
      <input id="mq-title" class="form-input" placeholder="예: 라면을 가장 맛있게 먹는 순간은?" maxlength="100">
    </div>
    <div class="form-group">
      <label class="form-label">문제 설명</label>
      <textarea id="mq-desc" class="form-textarea" placeholder="문제 상황이나 힌트를 자유롭게 적어주세요" rows="3"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">퀴즈 방식</label>
      <select id="mq-mode" class="form-input">
        <option value="multiple">객관식</option>
        <option value="short">주관식</option>
      </select>
    </div>
    <div id="mq-multiple-area">
      <div class="form-group">
        <label class="form-label">선택지 개수</label>
        <select id="mq-option-count" class="form-input">
          ${[2,3,4,5,6].map(n => `<option value="${n}" ${n === 4 ? 'selected' : ''}>${n}개</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">선택지와 정답 <span class="required">*</span></label>
        <div id="mq-options"></div>
      </div>
    </div>
    <div id="mq-short-area" style="display:none">
      <div class="form-group">
        <label class="form-label">정답 <span class="required">*</span></label>
        <input id="mq-short-answer" class="form-input" placeholder="정답을 입력하세요" maxlength="50">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">정답 해설</label>
      <textarea id="mq-explanation" class="form-textarea" placeholder="정답/오답 표시 후 보여줄 짧은 해설" rows="2"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">태그</label>
      <input id="mq-tags" class="form-input" placeholder="#미친퀴즈, #상식파괴" maxlength="100">
    </div>`);

  const mode = document.getElementById('mq-mode');
  const count = document.getElementById('mq-option-count');
  mode?.addEventListener('change', updateQuizMode);
  count?.addEventListener('change', renderQuizOptions);
  renderQuizOptions();
  updateQuizMode();
}

function updateQuizMode() {
  const mode = document.getElementById('mq-mode')?.value || 'multiple';
  const multi = document.getElementById('mq-multiple-area');
  const short = document.getElementById('mq-short-area');
  if (multi) multi.style.display = mode === 'multiple' ? '' : 'none';
  if (short) short.style.display = mode === 'short' ? '' : 'none';
}

function renderQuizOptions() {
  const n = Number(document.getElementById('mq-option-count')?.value || 4);
  const box = document.getElementById('mq-options');
  if (!box) return;
  const old = [...box.querySelectorAll('.mq-option-input')].map(input => input.value || '');
  const oldAnswer = Number(document.querySelector('input[name="mq-answer"]:checked')?.value || 0);
  box.innerHTML = Array.from({ length: n }, (_, i) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <input type="radio" name="mq-answer" value="${i}" ${i === Math.min(oldAnswer, n - 1) ? 'checked' : ''}>
      <input class="form-input mq-option-input" placeholder="${i + 1}번 선택지" maxlength="80" value="${esc(old[i] || '')}">
    </div>`).join('');
}

function renderCrazyCourtPage() {
  renderShell('억까재판', '⚖️', `
    <div class="form-group">
      <label class="form-label">사건명 <span class="required">*</span></label>
      <input id="court-title" class="form-input" placeholder="예: 치킨 닭다리 두 개 다 먹은 친구, 유죄?" maxlength="100">
    </div>
    <div class="form-group">
      <label class="form-label">상황 설명 <span class="required">*</span></label>
      <textarea id="court-desc" class="form-textarea" placeholder="억울하거나 어이없는 상황을 적어주세요" rows="4"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">판결 선택지</label>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">
        ${['유죄','무죄','사형','봐준다'].map(v => `<div style="padding:12px;border-radius:12px;background:#F9FAFB;border:1px solid var(--color-border);font-weight:900;text-align:center">${v}</div>`).join('')}
      </div>
      <div class="form-hint">댓글에는 왜 그렇게 판결했는지 드립으로 남기게 됩니다.</div>
    </div>
    <div class="form-group">
      <label class="form-label">태그</label>
      <input id="court-tags" class="form-input" placeholder="#억까재판, #유죄냐무죄냐" maxlength="100">
    </div>`);
}

function tagList(raw, defaults = []) {
  const tags = String(raw || '').split(',').map(t => t.replace('#', '').trim()).filter(Boolean);
  for (const tag of defaults) if (!tags.includes(tag)) tags.push(tag);
  return tags.slice(0, 8);
}

async function submitCrazyQuiz(btn) {
  if (!auth.currentUser) { navigate('/login'); return; }
  const title = clean(document.getElementById('mq-title')?.value || '', 100);
  const desc = clean(document.getElementById('mq-desc')?.value || '', 1000);
  const mode = document.getElementById('mq-mode')?.value || 'multiple';
  const explanation = clean(document.getElementById('mq-explanation')?.value || '', 600);
  if (!title) { toast.error('문제를 입력해주세요'); return; }

  const post = {
    type: 'quiz', cat: 'malhe', title, desc,
    quizTitle: title, quizMode: mode === 'short' ? 'short' : 'multiple',
    explanation,
    tags: tagList(document.getElementById('mq-tags')?.value, ['미친퀴즈']),
    images: [], authorId: auth.currentUser.uid,
    authorName: auth.currentUser.displayName || '익명',
    authorPhoto: auth.currentUser.photoURL || '',
    reactions: { total: 0 }, commentCount: 0, viewCount: 0,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  let secret = { explanation };

  if (mode === 'short') {
    const answer = clean(document.getElementById('mq-short-answer')?.value || '', 50);
    if (!answer) { toast.error('정답을 입력해주세요'); return; }
    secret.answer = answer;
  } else {
    const options = [...document.querySelectorAll('.mq-option-input')].map(input => clean(input.value, 80)).filter(Boolean);
    const answerIdx = Number(document.querySelector('input[name="mq-answer"]:checked')?.value || 0);
    if (options.length < 2) { toast.error('선택지는 2개 이상 입력해주세요'); return; }
    if (!options[answerIdx]) { toast.error('정답 선택지를 확인해주세요'); return; }
    post.options = options;
    secret.answerIdx = answerIdx;
  }

  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '올리는 중...';
  try {
    const ref = await addDoc(collection(db, 'feeds'), post);
    await addDoc(collection(db, 'feeds', ref.id, 'audit'), { type: 'created_quiz', createdAt: serverTimestamp() }).catch(() => {});
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js').then(({ setDoc }) =>
      setDoc(doc(db, 'feeds', ref.id, 'secret', 'answer'), secret)
    );
    toast.success('미친퀴즈를 올렸어요!');
    navigate('/feed');
  } catch (error) {
    console.error(error);
    toast.error('미친퀴즈 올리기에 실패했어요');
    btn.disabled = false;
    btn.textContent = oldText || '올리기';
  }
}

async function submitCrazyCourt(btn) {
  if (!auth.currentUser) { navigate('/login'); return; }
  const title = clean(document.getElementById('court-title')?.value || '', 100);
  const desc = clean(document.getElementById('court-desc')?.value || '', 1000);
  if (!title || !desc) { toast.error('사건명과 상황 설명을 입력해주세요'); return; }

  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '올리는 중...';
  try {
    await addDoc(collection(db, 'feeds'), {
      type: 'crazy_court', cat: 'malhe', title, desc,
      options: ['유죄','무죄','사형','봐준다'].map(text => ({ text, votes: 0 })),
      tags: tagList(document.getElementById('court-tags')?.value, ['억까재판']),
      images: [], authorId: auth.currentUser.uid,
      authorName: auth.currentUser.displayName || '익명',
      authorPhoto: auth.currentUser.photoURL || '',
      reactions: { total: 0 }, commentCount: 0, viewCount: 0,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    toast.success('억까재판을 열었어요!');
    navigate('/feed');
  } catch (error) {
    console.error(error);
    toast.error('억까재판 열기에 실패했어요');
    btn.disabled = false;
    btn.textContent = oldText || '올리기';
  }
}

function isRepForm() {
  return !!document.getElementById('mq-title') || !!document.getElementById('court-title');
}

function patchWriteCards() {
  if (!isWritePage()) return;
  const ox = [...document.querySelectorAll('.type-select-card')].find(card => card.dataset.type === 'ox' || card.textContent.includes('OX퀴즈'));
  if (ox) {
    ox.dataset.type = 'quiz';
    ox.dataset.rep = '1';
    ox.querySelector('.type-select-card__icon') && (ox.querySelector('.type-select-card__icon').textContent = '🧠');
    ox.querySelector('.type-select-card__name') && (ox.querySelector('.type-select-card__name').textContent = '미친퀴즈');
    ox.querySelector('.type-select-card__desc') && (ox.querySelector('.type-select-card__desc').textContent = '객관식/주관식 자유 퀴즈');
  }

  if (!document.querySelector('[data-type="crazy_court"]')) {
    const relay = [...document.querySelectorAll('.type-select-card')].find(card => card.dataset.type === 'relay');
    const grid = relay?.closest('.type-select-grid') || document.querySelector('.type-select-grid');
    if (grid) {
      grid.insertAdjacentHTML('beforeend', `
        <div class="type-select-card" data-type="crazy_court" data-rep="1">
          <div class="type-select-card__icon">⚖️</div>
          <div class="type-select-card__name">억까재판</div>
          <div class="type-select-card__desc">유죄냐 무죄냐 억지 판결 놀이</div>
        </div>`);
    }
  }
}

function renderVoteOptions(post) {
  const options = post.options || [];
  const total = options.reduce((sum, opt) => sum + Number(opt.votes || 0), 0);
  return options.map((opt, i) => {
    const votes = Number(opt.votes || 0);
    const pct = total ? Math.round((votes / total) * 100) : 0;
    return `
      <div class="vote-option" data-court-vote="${i}">
        <div class="vote-option__bar vote-option__bar--selected" style="width:${pct}%"></div>
        <div class="vote-option__content"><span>${esc(opt.text)}</span><span class="vote-option__pct">${pct}%</span></div>
      </div>`;
  }).join('');
}

async function enhanceDetail() {
  const match = (window.location.hash || '').match(/^#\/detail\/([^?]+)/);
  if (!match) return;
  const postId = decodeURIComponent(match[1]);
  const body = document.querySelector('.detail-body');
  if (!body || body.dataset.repEnhanced === '1') return;
  try {
    const snap = await getDoc(doc(db, 'feeds', postId));
    if (!snap.exists()) return;
    const post = { id: postId, ...snap.data() };
    const badge = document.querySelector('.feed-card__type-badge');
    if (badge && post.type === 'quiz') badge.textContent = '🧠 미친퀴즈';
    if (badge && post.type === 'crazy_court') badge.textContent = '⚖️ 억까재판';
    if (post.type !== 'crazy_court') return;
    body.dataset.repEnhanced = '1';
    body.insertAdjacentHTML('beforeend', `
      <div id="court-vote-area" class="quiz-options" style="margin-top:16px">
        <div style="font-size:14px;font-weight:900;margin-bottom:10px">판결을 내려주세요</div>
        ${renderVoteOptions(post)}
        <div style="font-size:12px;color:var(--color-text-secondary);margin-top:10px">댓글로 판결 이유를 드립처럼 남겨보세요.</div>
      </div>`);
  } catch {}
}

async function voteCourt(idx) {
  const match = (window.location.hash || '').match(/^#\/detail\/([^?]+)/);
  if (!match) return;
  const postId = decodeURIComponent(match[1]);
  if (!auth.currentUser) {
    try { await signInAnonymously(auth); } catch { toast.warn('참여에 실패했어요'); return; }
  }
  const ref = doc(db, 'feeds', postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  if ((data.votedBy || []).includes(auth.currentUser.uid)) {
    toast.warn('이미 판결했어요');
    return;
  }
  const options = (data.options || []).map((opt, i) => i === idx ? { ...opt, votes: Number(opt.votes || 0) + 1 } : opt);
  await updateDoc(ref, { options, votedBy: arrayUnion(auth.currentUser.uid) });
  const area = document.getElementById('court-vote-area');
  if (area) area.innerHTML = `<div style="font-size:14px;font-weight:900;margin-bottom:10px">판결 결과</div>${renderVoteOptions({ options })}<div style="font-size:12px;color:var(--color-text-secondary);margin-top:10px">댓글로 판결 이유를 드립처럼 남겨보세요.</div>`;
  toast.success('판결 완료!');
}

function boot() {
  const type = getWriteType();
  if (type === 'quiz') renderCrazyQuizPage();
  if (type === 'crazy_court') renderCrazyCourtPage();
  patchWriteCards();
  enhanceDetail();
}

document.addEventListener('click', event => {
  const card = event.target?.closest?.('[data-type="quiz"], [data-type="crazy_court"]');
  if (card && isWritePage()) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (card.dataset.type === 'quiz') renderCrazyQuizPage();
    if (card.dataset.type === 'crazy_court') renderCrazyCourtPage();
    return;
  }
  const submit = event.target?.closest?.('#btn-submit');
  if (submit && isRepForm()) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (document.getElementById('mq-title')) submitCrazyQuiz(submit);
    if (document.getElementById('court-title')) submitCrazyCourt(submit);
    return;
  }
  const courtVote = event.target?.closest?.('[data-court-vote]');
  if (courtVote) {
    event.preventDefault();
    voteCourt(Number(courtVote.dataset.courtVote));
  }
}, true);

const observer = new MutationObserver(() => setTimeout(boot, 60));
if (document.body) observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('hashchange', () => setTimeout(boot, 120));
setTimeout(boot, 300);
