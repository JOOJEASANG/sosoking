import { toast } from '../components/toast.js';
import { openShareSheet } from './share.js';
import { openGallery } from './gallery.js';
import { toggleScrap, reportPost } from './post-actions.js';
import { isDetailPath } from './action-utils.js';
import { currentPostId, getCurrentPostSummary, stop } from './bootstrap-context.js';
import { downloadShareCard } from './share-card.js';

export async function handleScrap(event) {
  const btn = event.target.closest?.('#btn-scrap');
  if (!btn || !isDetailPath()) return false;
  stop(event);
  await toggleScrap(currentPostId(), btn).catch(() => toast.error('스크랩 처리에 실패했어요'));
  return true;
}

export async function handleReport(event) {
  const btn = event.target.closest?.('#btn-report');
  if (!btn || !isDetailPath()) return false;
  stop(event);
  await reportPost(currentPostId(), btn).catch(() => toast.error('신고 접수에 실패했어요'));
  return true;
}

export async function handleShare(event) {
  const btn = event.target.closest?.('#btn-share');
  if (!btn || !isDetailPath()) return false;
  stop(event);
  const post = await getCurrentPostSummary();
  if (post) openShareSheet(post);
  return true;
}

export async function handleShareCard(event) {
  const btn = event.target.closest?.('.ai-share-card-btn');
  if (!btn || !isDetailPath()) return false;
  stop(event);
  const post = await getCurrentPostSummary();
  if (post) downloadShareCard(post);
  return true;
}

export function handleGallery(event) {
  const thumb = event.target.closest?.('.detail-gallery__thumb');
  if (!thumb || !isDetailPath()) return false;
  stop(event);
  const grid = thumb.closest('[data-images]');
  if (!grid) return true;
  const images = JSON.parse(decodeURIComponent(grid.dataset.images || '%5B%5D'));
  const idx = parseInt(thumb.dataset.galleryIdx || '0', 10) || 0;
  if (images.length) openGallery(images, idx);
  return true;
}
