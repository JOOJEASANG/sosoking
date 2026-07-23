import { toast } from '../components/toast.js';
import { isDetailPath } from './action-utils.js';
import { currentPostId, getCurrentPostSummary, stop } from './bootstrap-context.js';
import { voteLegacyPost, showVoteToast, renderLegacyVoteOptions, renderLegacyBattleVs } from './vote-actions.js';
import { checkLegacyQuiz } from './quiz-actions.js';

export async function handleVote(event) {
  const btn = event.target.closest?.('[data-vote-idx]');
  if (!btn || !isDetailPath()) return false;
  stop(event);
  if (btn._detailPending) return true;
  btn._detailPending = true;

  const idx = Number(btn.dataset.voteIdx || 0);
  try {
    const updated = await voteLegacyPost(currentPostId(), idx);
    if (!updated) return true;
    showVoteToast(updated.options, idx);
    const voteArea = document.getElementById('vote-area');
    if (voteArea) {
      voteArea.outerHTML = updated.type === 'battle'
        ? renderLegacyBattleVs(updated)
        : `<div id="vote-area" class="quiz-options" style="margin-top:16px">${renderLegacyVoteOptions(updated)}</div>`;
    }
  } catch (error) {
    toast.error(error.message || '투표에 실패했어요');
  }

  btn._detailPending = false;
  return true;
}

export async function handleOxQuiz(event) {
  const btn = event.target.closest?.('[data-answer]');
  if (!btn || !isDetailPath()) return false;
  stop(event);
  if (btn._detailPending) return true;
  btn._detailPending = true;
  document.querySelectorAll('[data-answer]').forEach(b => { b.disabled = true; });
  const post = await getCurrentPostSummary();
  await checkLegacyQuiz(currentPostId(), btn.dataset.answer, post?.answer === btn.dataset.answer, post?.explanation || '');
  return true;
}

export async function handleOptionQuiz(event) {
  const btn = event.target.closest?.('[data-quiz-idx]');
  if (!btn || !isDetailPath()) return false;
  stop(event);
  if (btn._detailPending) return true;
  btn._detailPending = true;
  document.querySelectorAll('[data-quiz-idx]').forEach(b => { b.disabled = true; });
  const idx = Number(btn.dataset.quizIdx || 0);
  const post = await getCurrentPostSummary();
  await checkLegacyQuiz(currentPostId(), idx, Number(post?.answerIdx) === idx, post?.explanation || '');
  return true;
}

export async function handleShortQuiz(event) {
  const btn = event.target.closest?.('#btn-quiz-submit');
  if (!btn || !isDetailPath()) return false;
  stop(event);
  const input = document.getElementById('quiz-short-input');
  const answer = input?.value.trim() || '';
  if (!answer) return true;
  btn.disabled = true;
  if (input) input.disabled = true;
  const post = await getCurrentPostSummary();
  await checkLegacyQuiz(currentPostId(), answer, String(post?.answer || '') === answer, post?.explanation || '');
  return true;
}
