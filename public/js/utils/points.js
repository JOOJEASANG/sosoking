import { auth, db } from '../firebase.js';
import { doc, updateDoc, increment, serverTimestamp, setDoc, collection, addDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function awardPoints(action, meta = {}) {
  const user = auth.currentUser;
  const rule = POINT_RULES[action];
  if (!user || !rule || rule.points === 0) return false;

  const dedupeKey = `${user.uid}:${action}:${meta.postId || ''}:${meta.itemId || ''}:${meta.onceKey || ''}`;
  if (sessionAwards.has(dedupeKey)) return false;
  sessionAwards.add(dedupeKey);

  const userRef = doc(db, 'users', user.uid);
  const payload = {
    points: increment(rule.points),
    totalPoints: increment(rule.points),
    [`pointStats.${action}`]: increment(rule.points),
    [`pointDaily.${todayKey()}`]: increment(rule.points),
    lastPointAt: serverTimestamp(),
  };

  try {
    await updateDoc(userRef, payload);
  } catch {
    await setDoc(userRef, {
      points: rule.points,
      totalPoints: rule.points,
      pointStats: { [action]: rule.points },
      pointDaily: { [todayKey()]: rule.points },
      lastPointAt: serverTimestamp(),
    }, { merge: true });
  }

  await addDoc(collection(db, 'users', user.uid, 'point_logs'), {
    action,
    label: rule.label,
    points: rule.points,
    meta: {
      postId: meta.postId || '',
      itemId: meta.itemId || '',
      type: meta.type || '',
    },
    createdAt: serverTimestamp(),
  }).catch(() => {});

  return true;
}

export function pointText(value) {
  return `${Number(value || 0).toLocaleString()}P`;
}
