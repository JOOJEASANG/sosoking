import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

export const POINT_RULES = {
  post_create: { points: 10, label: '피드 글 작성' },
  comment_create: { points: 3, label: '댓글 작성' },
  reply_create: { points: 2, label: '답글 작성' },
  participation_create: { points: 3, label: '참여글 작성' },
  vote_participate: { points: 1, label: '투표 참여' },
  quiz_correct: { points: 5, label: '퀴즈 정답' },
  reaction_received: { points: 1, label: '반응 받음' },
};

const sessionAwards = new Set();
const callAwardUserPoints = httpsCallable(functions, 'awardUserPoints');

export async function awardPoints(action, meta = {}) {
  const user = auth.currentUser;
  const rule = POINT_RULES[action];
  if (!user || !rule || rule.points === 0) return false;

  const dedupeKey = `${user.uid}:${action}:${meta.postId || ''}:${meta.itemId || ''}:${meta.onceKey || ''}`;
  if (sessionAwards.has(dedupeKey)) return false;
  sessionAwards.add(dedupeKey);

  try {
    const result = await callAwardUserPoints({
      action,
      meta: {
        postId: meta.postId || '',
        itemId: meta.itemId || '',
        onceKey: meta.onceKey || '',
        type: meta.type || '',
      },
    });
    return !!result.data?.awarded;
  } catch (error) {
    console.warn('[points] award failed', error);
    sessionAwards.delete(dedupeKey);
    return false;
  }
}

export function pointText(value) {
  return `${Number(value || 0).toLocaleString()}P`;
}
