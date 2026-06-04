import { db } from '../firebase.js';
import { collection, getDocs, limit, orderBy, query, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export async function fetchAdjacentPosts(postId, createdAt) {
  if (!createdAt) return { prev: null, next: null };
  try {
    const [prevSnap, nextSnap] = await Promise.all([
      getDocs(query(
        collection(db, 'feeds'),
        where('createdAt', '<', createdAt),
        orderBy('createdAt', 'desc'),
        limit(3),
      )),
      getDocs(query(
        collection(db, 'feeds'),
        where('createdAt', '>', createdAt),
        orderBy('createdAt', 'asc'),
        limit(3),
      )),
    ]);
    const toPost = d => ({ id: d.id, ...d.data() });
    const prev = prevSnap.docs.map(toPost).find(p => !p.hidden && p.id !== postId) || null;
    const next = nextSnap.docs.map(toPost).find(p => !p.hidden && p.id !== postId) || null;
    return { prev, next };
  } catch {
    return { prev: null, next: null };
  }
}

export async function fetchComments(postId) {
  try {
    const q = query(collection(db, 'feeds', postId, 'comments'), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}


export async function fetchSimilarPosts(excludeId, type) {
  try {
    const q = query(collection(db, 'feeds'), where('type', '==', type), orderBy('reactions.total', 'desc'), limit(5));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(post => !post.hidden && post.id !== excludeId)
      .slice(0, 4);
  } catch {
    return [];
  }
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
