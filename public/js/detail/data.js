import { db } from '../firebase.js';
import { collection, getDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { fetchFeeds } from '../services/feed-service.js';

export async function fetchComments(postId) {
  try {
    const q = query(collection(db, 'feeds', postId, 'comments'), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export async function fetchSimilarPosts(excludeId, subtype = '') {
  const result = [];
  const seen = new Set([String(excludeId || '')]);
  const append = posts => {
    (posts || []).forEach(post => {
      if (!post?.id || post.hidden || seen.has(post.id)) return;
      seen.add(post.id);
      result.push(post);
    });
  };

  try {
    const sameType = await fetchFeeds({ subtype, pageSize: 10 });
    append(sameType.posts);

    if (result.length < 6) {
      const latest = await fetchFeeds({ pageSize: 12 });
      append(latest.posts);
    }
  } catch {
    try {
      const latest = await fetchFeeds({ pageSize: 12 });
      append(latest.posts);
    } catch {
      return [];
    }
  }

  return result.slice(0, 8);
}

export function markBestComment(comments) {
  if (comments.length < 3) return comments;

  let bestIdx = 0;
  let bestScore = -1;
  comments.forEach((comment, index) => {
    const score =
      (comment.reactions?.funny || 0) * 3 +
      (comment.reactions?.fire || 0) * 2 +
      (comment.reactions?.like || 0) +
      (comment.likes || 0);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = index;
    }
  });

  if (bestScore <= 0) return comments;
  return comments.map((comment, index) => (index === bestIdx ? { ...comment, _isBest: true } : comment));
}