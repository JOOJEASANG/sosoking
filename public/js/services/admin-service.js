/* admin-service.js — 관리자 서비스 */
import { db, auth } from '../firebase.js';
import {
  doc, getDoc, collection, query, orderBy, limit,
  getDocs, deleteDoc, addDoc, serverTimestamp,
  getCountFromServer,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/** 관리자 여부 확인 */
export async function isAdmin() {
  const user = auth.currentUser;
  if (!user) return false;
  const snap = await getDoc(doc(db, 'admins', user.uid));
  return snap.exists();
}

/** 컬렉션 총 문서 수 */
export async function countCollection(col) {
  const snap = await getCountFromServer(collection(db, col));
  return snap.data().count;
}

/** 최근 게시물 N개 */
export async function fetchRecentPosts(n = 20) {
  const snap = await getDocs(
    query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(n))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** 게시물 삭제 */
export async function adminDeletePost(id) {
  return deleteDoc(doc(db, 'feeds', id));
}

/** 미션 생성 */
export async function createMission(data) {
  return addDoc(collection(db, 'missions'), {
    ...data,
    active:    true,
    createdAt: serverTimestamp(),
  });
}
