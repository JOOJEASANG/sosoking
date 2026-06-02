import { toast } from '../components/toast.js';
import { isDetailPath } from './action-utils.js';
import { currentPostId, stop } from './bootstrap-context.js';
import { voteLegacyPost, showVoteToast, renderLegacyVoteOptions, renderLegacyBattleVs } from './vote-actions.js';

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
