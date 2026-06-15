import { isDetailPath } from './detail/action-utils.js';
import { handleScrap, handleReport, handleShare, handleGallery } from './detail/handlers-basic.js';
import { handleVote } from './detail/handlers-vote-quiz.js';
import {
  handleCommentSubmit,
  handleCommentDelete,
  handleCommentReaction,
} from './detail/handlers-comments.js';

document.addEventListener('click', async event => {
  if (!isDetailPath()) return;
  if (await handleScrap(event)) return;
  if (await handleReport(event)) return;
  if (await handleShare(event)) return;
  if (handleGallery(event)) return;
  if (await handleVote(event)) return;
  if (await handleCommentSubmit(event)) return;
  if (await handleCommentDelete(event)) return;
  await handleCommentReaction(event);
}, true);
