import { functions } from '../firebase.js';
import { toast } from '../components/toast.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { ensureAnonymousActor, markLegacyQuizResult } from './action-utils.js';

const checkQuizAnswerFn = httpsCallable(functions, 'checkQuizAnswer');

export async function checkLegacyQuiz(postId, selected) {
  if (!(await ensureAnonymousActor())) return;
  try {
    const result = await checkQuizAnswerFn({ postId, selected });
    markLegacyQuizResult(result?.data?.correct ?? false, result?.data?.explanation || '');
  } catch (error) {
    console.error('[quiz] check failed', error);
    toast.error('정답 확인에 실패했어요. 잠시 후 다시 시도해주세요.');
  }
}
