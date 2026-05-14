import { auth, db } from '../firebase.js';
import { doc, increment, updateDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

export const COMMENT_REACTIONS = [
  { key: 'laugh', icon: '😂', label: '미쳤다' },
  { key: 'wow', icon: '🤯', label: '천재' },
  { key: 'king', icon: '👑', label: '1등' },
  { key: 'fire', icon: '🔥', label: '웃김' }
];

export function getReactionCount(comment, key) {
  return Number(comment?.reactions?.[key] || 0);
}

export function getReactionTotal(comment) {
  return COMMENT_REACTIONS.reduce((sum, item) => sum + getReactionCount(comment, item.key), Number(comment?.likes || 0));
}

export function sortCommentsByRecommendation(comments = []) {
  return [...comments].sort((a, b) => getReactionTotal(b) - getReactionTotal(a) || Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
}

export async function recommendFeedComment(postId, commentId, reactionKey = 'laugh') {
  if (!auth.currentUser) throw new Error('로그인 후 추천할 수 있습니다.');
  const reaction = COMMENT_REACTIONS.find(item => item.key === reactionKey) || COMMENT_REACTIONS[0];
  await updateDoc(doc(db, 'soso_feed_posts', postId, 'comments', commentId), {
    likes: increment(1),
    [`reactions.${reaction.key}`]: increment(1)
  });
  return { ok: true, reaction: reaction.key };
}
