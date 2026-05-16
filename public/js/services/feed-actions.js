import { functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const callSecureRegisterFeedView = httpsCallable(functions, 'secureRegisterFeedView');
const callSecureReactFeedPost = httpsCallable(functions, 'secureReactFeedPost');
const callSecureVoteFeedOption = httpsCallable(functions, 'secureVoteFeedOption');
const callSecureAddFeedComment = httpsCallable(functions, 'secureAddFeedComment');
const callSecureCheckQuizAnswer = httpsCallable(functions, 'secureCheckQuizAnswer');

function messageFromError(error, fallback) {
  return error?.message || error?.details?.message || fallback;
}

export async function registerFeedView(postId) {
  try {
    await callSecureRegisterFeedView({ postId });
    return { ok: true };
  } catch (error) {
    console.warn('[소소킹] 조회수 등록 실패:', error);
    return { ok: false, message: messageFromError(error, '조회수 등록에 실패했습니다.') };
  }
}

export async function reactFeedPost(postId, reactionKey) {
  try {
    const result = await callSecureReactFeedPost({ postId, reactionKey });
    return { ok: true, ...(result.data || {}) };
  } catch (error) {
    return { ok: false, message: messageFromError(error, '반응 등록에 실패했어요.') };
  }
}

export async function voteFeedOption(postId, optionIdx) {
  try {
    const result = await callSecureVoteFeedOption({ postId, optionIdx });
    return { ok: true, ...(result.data || {}) };
  } catch (error) {
    return { ok: false, message: messageFromError(error, '투표에 실패했어요.') };
  }
}

export async function addFeedComment(postId, text) {
  try {
    const result = await callSecureAddFeedComment({ postId, text });
    return { ok: true, ...(result.data || {}) };
  } catch (error) {
    return { ok: false, message: messageFromError(error, '댓글 등록에 실패했어요.') };
  }
}

export async function checkQuizAnswer({ postId, answer, optionIdx }) {
  try {
    const result = await callSecureCheckQuizAnswer({ postId, answer, optionIdx });
    return { ok: true, ...(result.data || {}) };
  } catch (error) {
    return { ok: false, message: messageFromError(error, '정답 확인에 실패했어요.') };
  }
}
