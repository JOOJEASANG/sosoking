import { functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { ensureAnonymousActor, markLegacyQuizResult } from './action-utils.js';

const checkQuizAnswerFn = httpsCallable(functions, 'checkQuizAnswer');

export async function checkLegacyQuiz(postId, selected, fallbackCorrect, fallbackExplanation = '') {
  if (!(await ensureAnonymousActor())) return;
  try {
    const result = await checkQuizAnswerFn({ postId, selected });
    markLegacyQuizResult(result?.data?.correct ?? false, result?.data?.explanation || '');
  } catch {
    markLegacyQuizResult(!!fallbackCorrect, fallbackExplanation || '');
  }
}
