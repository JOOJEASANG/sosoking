import { db } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { currentDetailPostId, stopDetailEvent } from './action-utils.js';

export function currentPostId() {
  return currentDetailPostId();
}

export function stop(event) {
  stopDetailEvent(event);
}

export async function getCurrentPostSummary() {
  const id = currentPostId();
  if (!id) return null;
  const snap = await getDoc(doc(db, 'feeds', id)).catch(() => null);
  if (!snap?.exists?.()) return { id };
  const data = snap.data();
  return {
    id,
    title: data.title || '',
    desc: data.desc || '',
    images: data.images || [],
    type: data.type || '',
    answer: data.answer,
    answerIdx: data.answerIdx,
    explanation: data.explanation || '',
    keyword: data.keyword || '',
  };
}
