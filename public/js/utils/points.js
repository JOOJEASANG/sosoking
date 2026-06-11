import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { appState } from '../state.js';
import { checkRankUp } from './rank-up.js';

export const POINT_RULES = {
  post_create: { points: 10, label: '피드 글 작성' },
  comment_create: { points: 20, label: '댓글 작성' },
  reply_create: { points: 2, label: '답글 작성' },
  participation_create: { points: 3, label: '참여글 작성' },
  vote_participate: { points: 1, label: '투표 참여' },
  reaction_received: { points: 1, label: '반응 받음' },
  reaction_give: { points: 1, label: '댓글에 반응 남기기' },
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
    const awarded = !!result.data?.awarded;
    if (awarded && rule?.points) {
      appState.points = (appState.points || 0) + rule.points;
      if (auth.currentUser) checkRankUp(auth.currentUser.uid, appState.points);
      // 포인트가 충분히 클 때만 정당 정치력 동기화 (fire-and-forget)
      if (rule.points >= 10) {
        httpsCallable(functions, 'syncPartyMemberPower')({}).catch(() => {});
      }
    }
    return awarded;
  } catch (error) {
    console.warn('[points] award failed', error);
    sessionAwards.delete(dedupeKey);
    return false;
  }
}

export function pointText(value) {
  return `${Number(value || 0).toLocaleString()}P`;
}
