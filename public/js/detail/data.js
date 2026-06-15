import { db } from '../firebase.js';
import { collection, getDocs, limit, orderBy, query, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const PLAZA_TYPES = ['citizen_speech', 'ai_judge'];

function isPoliticalFeedPost(post) {
  return PLAZA_TYPES.includes(post.feedType || post.type || post.subtype);
}

export async function fetchAdjacentPosts(postId, createdAt) {
  if (!createdAt) return { prev: null, next: null };
  try {
    const [prevSnap, nextSnap] = await Promise.all([
      getDocs(query(
        collection(db, 'feeds'),
        where('type', 'in', PLAZA_TYPES),
        where('createdAt', '<', createdAt),
        orderBy('createdAt', 'desc'),
        limit(5),
      )),
      getDocs(query(
        collection(db, 'feeds'),
        where('type', 'in', PLAZA_TYPES),
        where('createdAt', '>', createdAt),
        orderBy('createdAt', 'desc'),
        limit(5),
      )),
    ]);
    const toPost = d => ({ id: d.id, ...d.data() });
    const prev = prevSnap.docs.map(toPost).find(p => !p.hidden && p.id !== postId && isPoliticalFeedPost(p)) || null;
    const nextCandidates = nextSnap.docs.map(toPost).filter(p => !p.hidden && p.id !== postId && isPoliticalFeedPost(p));
    const next = nextCandidates.length ? nextCandidates[nextCandidates.length - 1] : null;
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
  const safeType = PLAZA_TYPES.includes(type) ? type : 'citizen_speech';
  try {
    const q = query(collection(db, 'feeds'), where('type', '==', safeType), orderBy('reactions.total', 'desc'), limit(5));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(post => !post.hidden && post.id !== excludeId && isPoliticalFeedPost(post))
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
