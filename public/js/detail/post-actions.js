import { auth, db } from '../firebase.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { appState } from '../state.js';
import { doc, getDoc, setDoc, deleteDoc, addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

function loginWithReturn() {
  const returnTo = window.location.hash.slice(1).split('?')[0] || '/';
  navigate('/login?return=' + encodeURIComponent(returnTo));
}

export async function toggleScrap(postId, btn) {
  if (!auth.currentUser) {
    loginWithReturn();
    return;
  }
  const uid = auth.currentUser.uid;
  const postSnap = await getDoc(doc(db, 'feeds', postId)).catch(() => null);
  const post = postSnap?.exists?.() ? postSnap.data() : {};
  const scrapRef = doc(db, 'users', uid, 'scraps', postId);

  if (btn?.classList.contains('active')) {
    await deleteDoc(scrapRef).catch(() => {});
    btn.classList.remove('active');
    toast.success('스크랩을 취소했어요');
    return;
  }

  await setDoc(scrapRef, {
    postId,
    title: post.title || '',
    type: post.type || '',
    cat: post.cat || '',
    authorName: post.authorName || '',
    scrappedAt: serverTimestamp(),
  }).catch(() => {});
  btn?.classList.add('active');
  toast.success('스크랩했어요! 🔖');
}

export async function reportPost(postId, btn) {
  if (!auth.currentUser) {
    loginWithReturn();
    return;
  }
  const reason = prompt('신고 사유를 입력해주세요 (스팸, 욕설, 허위정보 등)');
  if (!reason?.trim()) return;

  const postSnap = await getDoc(doc(db, 'feeds', postId)).catch(() => null);
  const post = postSnap?.exists?.() ? postSnap.data() : {};

  await addDoc(collection(db, 'reports'), {
    postId,
    postTitle: post.title || '',
    reason: reason.trim(),
    reporterId: auth.currentUser.uid,
    reporterName: appState.nickname || auth.currentUser.displayName || '익명',
    resolved: false,
    createdAt: serverTimestamp(),
  });

  toast.success('신고가 접수됐어요. 검토 후 처리할게요.');
  if (btn) {
    btn.textContent = '신고됨';
    btn.disabled = true;
  }
}
