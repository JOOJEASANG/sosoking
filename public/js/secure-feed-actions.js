import { auth, functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';

const callCheckQuizAnswer = httpsCallable(functions, 'checkQuizAnswer');
const callCastFeedVote = httpsCallable(functions, 'castFeedVote');
const callToggleFeedReaction = httpsCallable(functions, 'toggleFeedReaction');
const callRegisterPostView = httpsCallable(functions, 'registerPostView');

let activeDetailId = '';
let activeViewRegistered = '';
let installing = false;

function getDetailId() {
  const hash = window.location.hash.slice(1).split('?')[0] || '';
  const match = hash.match(/^\/detail\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : '';
}

function requireLogin() {
  if (!auth.currentUser) {
    navigate('/login');
    return false;
  }
  return true;
}

function showQuizResult(correct, explanation = '') {
  const resultEl = document.getElementById('quiz-result');
  if (!resultEl) return;
  resultEl.style.display = '';
  resultEl.className = `quiz-result quiz-result--${correct ? 'correct' : 'wrong'}`;
  const iconEl = resultEl.querySelector('.quiz-result__icon');
  const textEl = resultEl.querySelector('.quiz-result__text');
  const exEl = resultEl.querySelector('.quiz-result__explanation');
  if (iconEl) iconEl.textContent = correct ? '⭕' : '❌';
  if (textEl) textEl.textContent = correct ? '정답이에요!' : '오답이에요!';
  if (exEl) exEl.textContent = explanation ? `💡 ${explanation}` : '';
}

function renderVoteOptions(options) {
  const total = options.reduce((sum, opt) => sum + Number(opt?.votes || 0), 0);
  return options.map((opt, i) => {
    const text = typeof opt === 'object' ? (opt.text || '') : String(opt || '');
    const votes = typeof opt === 'object' ? Number(opt.votes || 0) : 0;
    const pct = total ? Math.round(votes / total * 100) : 0;
    return `
      <div class="vote-option" data-vote-idx="${i}">
        <div class="vote-option__bar vote-option__bar--selected" style="width:${pct}%"></div>
        <div class="vote-option__content">
          <span>${escapeHtml(text)}</span>
          <span class="vote-option__pct">${pct}%</span>
        </div>
      </div>`;
  }).join('');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function refreshVoteArea(options) {
  const area = document.getElementById('vote-area');
  if (!area) return;
  area.innerHTML = renderVoteOptions(options);
}

async function handleVote(event) {
  const btn = event.target.closest('[data-vote-idx]');
  if (!btn || !getDetailId()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!requireLogin()) return;
  if (btn.dataset.securePending === '1') return;
  btn.dataset.securePending = '1';
  try {
    const res = await callCastFeedVote({ postId: getDetailId(), optionIdx: Number(btn.dataset.voteIdx) });
    refreshVoteArea(res.data?.options || []);
    toast.success('투표했어요!');
  } catch (error) {
    toast.error(error?.message || '투표에 실패했어요');
  } finally {
    delete btn.dataset.securePending;
  }
}

async function handleQuiz(event) {
  const answerBtn = event.target.closest('[data-answer]');
  const optionBtn = event.target.closest('[data-quiz-idx]');
  const submitBtn = event.target.closest('#btn-quiz-submit');
  if (!getDetailId() || (!answerBtn && !optionBtn && !submitBtn)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!requireLogin()) return;

  let selected = '';
  if (answerBtn) selected = answerBtn.dataset.answer;
  else if (optionBtn) selected = Number(optionBtn.dataset.quizIdx);
  else selected = document.getElementById('quiz-short-input')?.value.trim() || '';
  if (selected === '') return;

  [answerBtn, optionBtn, submitBtn].filter(Boolean).forEach(el => { el.disabled = true; });
  try {
    const res = await callCheckQuizAnswer({ postId: getDetailId(), selected });
    showQuizResult(!!res.data?.correct, res.data?.explanation || '');
  } catch (error) {
    toast.error(error?.message || '정답 확인에 실패했어요');
    [answerBtn, optionBtn, submitBtn].filter(Boolean).forEach(el => { el.disabled = false; });
  }
}

function updateReactionButtons(bar, reactions, myReaction) {
  bar.querySelectorAll('[data-reaction]').forEach(btn => {
    const key = btn.dataset.reaction;
    const count = Number(reactions?.[key] || 0);
    btn.classList.toggle('active', myReaction === key);
    const labelText = btn.textContent.replace(/\s+\d+\s*$/, '').trim();
    btn.innerHTML = `${labelText}${count > 0 ? ` <strong>${count}</strong>` : ''}`;
  });
}

async function handleReaction(event) {
  const btn = event.target.closest('[data-reaction]');
  const postId = btn?.dataset.postId || getDetailId();
  if (!btn || !postId) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!requireLogin()) return;
  if (btn.dataset.securePending === '1') return;
  btn.dataset.securePending = '1';
  try {
    const res = await callToggleFeedReaction({ postId, reaction: btn.dataset.reaction });
    const bar = btn.closest('.reaction-bar');
    if (bar) updateReactionButtons(bar, res.data?.reactions || {}, res.data?.myReaction || null);
  } catch (error) {
    toast.error(error?.message || '반응 등록에 실패했어요');
  } finally {
    delete btn.dataset.securePending;
  }
}

async function registerViewOnce() {
  const postId = getDetailId();
  if (!postId || postId === activeViewRegistered || !auth.currentUser) return;
  activeViewRegistered = postId;
  try { await callRegisterPostView({ postId }); } catch { /* non-critical */ }
}

function bindDetailGuards() {
  const postId = getDetailId();
  if (!postId || postId === activeDetailId) return;
  activeDetailId = postId;
  setTimeout(registerViewOnce, 600);
}

function installGuards() {
  if (installing) return;
  installing = true;
  document.addEventListener('click', handleVote, true);
  document.addEventListener('click', handleQuiz, true);
  document.addEventListener('click', handleReaction, true);
  window.addEventListener('hashchange', () => {
    activeDetailId = '';
    setTimeout(bindDetailGuards, 100);
  });
  new MutationObserver(bindDetailGuards).observe(document.body, { childList: true, subtree: true });
  bindDetailGuards();
}

installGuards();
