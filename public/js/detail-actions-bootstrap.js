import { isDetailPath } from './detail/action-utils.js';
import { handleScrap, handleReport, handleShare, handleGallery } from './detail/handlers-basic.js';
import { handleCommentSubmit, handleCommentDelete } from './detail/handlers-comments.js';

document.addEventListener('click', async event => {
  if (!isDetailPath()) return;
  if (await handleScrap(event)) return;
  if (await handleReport(event)) return;
  if (await handleShare(event)) return;
  if (handleGallery(event)) return;
  if (await handleCommentSubmit(event)) return;
  await handleCommentDelete(event);
}, true);
