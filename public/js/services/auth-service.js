/* auth-service.js — 인증 관련 서비스 */
import { auth, googleProvider, signInWithPopup, signOut } from '../firebase.js';
import { appState } from '../state.js';

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function loginWithEmail(email, password) {
  const { signInWithEmailAndPassword } = await import(
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'
  );
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signupWithEmail(email, password, displayName) {
  const { createUserWithEmailAndPassword, updateProfile } = await import(
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'
  );
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: displayName || email.split('@')[0] });
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}

export function getCurrentUser() {
  return appState.user;
}

export function isLoggedIn() {
  return !!appState.user;
}
