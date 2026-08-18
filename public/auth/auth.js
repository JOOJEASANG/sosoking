import { auth, db, functions } from '/js/firebase.js?v=20260818-auth-2';
import { getDoc, doc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  linkWithPopup,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const checkNickname = httpsCallable(functions, 'checkNickname');
const saveMemberProfile = httpsCallable(functions, 'saveMemberProfile');
const returnUrl = safeReturnUrl();
const emailForm = document.getElementById('email-form');
const email = document.getElementById('email');
const password = document.getElementById('password');
const nickname = document.getElementById('nickname');
const nicknameWrap = document.getElementById('nickname-wrap');
const nicknameStatus = document.getElementById('nickname-status');
const submitButton = document.getElementById('email-submit');
const googleButton = document.getElementById('google-button');
const modeToggle = document.getElementById('mode-toggle');
const resetButton = document.getElementById('reset-button');
const message = document.getElementById('auth-message');
const title = document.getElementById('auth-title');
const description = document.getElementById('auth-description');
let mode = 'login';
let nicknameChecked = '';

function safeReturnUrl() {
  const raw = new URLSearchParams(location.search).get('return') || '/game/';
  try {
    const url = new URL(raw, location.origin);
    return url.origin === location.origin ? `${url.pathname}${url.search}${url.hash}` : '/game/';
  } catch { return '/game/'; }
}

function setMessage(text = '', error = false) {
  message.textContent = text;
  message.classList.toggle('error', error);
}

function errorText(error) {
  const map = {
    'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/invalid-email': '이메일 주소를 확인해주세요.',
    'auth/email-already-in-use': '이미 가입된 이메일입니다. 로그인해주세요.',
    'auth/weak-password': '비밀번호는 6자 이상이어야 합니다.',
    'auth/popup-closed-by-user': 'Google 로그인 창을 닫았습니다.',
    'auth/popup-blocked': '팝업이 차단되었습니다. 브라우저에서 팝업을 허용해주세요.',
    'auth/account-exists-with-different-credential': '같은 이메일의 다른 로그인 방식이 이미 있습니다. 이메일 로그인으로 먼저 로그인해주세요.',
    'functions/already-exists': '이미 사용 중인 닉네임입니다.',
    'functions/unauthenticated': '회원 로그인이 필요합니다.'
  };
  return map[error?.code] || error?.message || '처리하지 못했습니다. 잠시 후 다시 시도해주세요.';
}

function setMode(next) {
  mode = next;
  const signup = mode === 'signup';
  const profile = mode === 'profile';
  title.textContent = profile ? '닉네임 설정' : signup ? '회원가입' : '로그인';
  description.textContent = profile
    ? 'Google 계정으로 로그인되었습니다. 게임에서 사용할 닉네임을 정해주세요.'
    : signup
      ? '이메일·비밀번호를 만든 뒤 사용할 닉네임을 정해주세요.'
      : '로그인하면 내 닉네임으로 방을 만들고 어디서든 이어서 플레이할 수 있습니다.';
  nicknameWrap.classList.toggle('hidden', !signup && !profile);
  email.closest('.field').classList.toggle('hidden', profile);
  password.closest('.field').classList.toggle('hidden', profile);
  googleButton.classList.toggle('hidden', profile);
  document.querySelector('.auth-divider').classList.toggle('hidden', profile);
  submitButton.textContent = profile ? '닉네임 저장' : signup ? '회원가입' : '로그인';
  modeToggle.classList.toggle('hidden', profile);
  resetButton.classList.toggle('hidden', signup || profile);
  password.autocomplete = signup ? 'new-password' : 'current-password';
  nicknameStatus.textContent = '';
  nicknameStatus.className = 'field-status';
  nicknameChecked = '';
  setMessage('');
}

function redirectAfterAuth() {
  location.assign(returnUrl || '/game/');
}

async function profileExists(user) {
  if (!user || user.isAnonymous) return false;
  const snap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  return Boolean(snap?.exists() && String(snap.data()?.nickname || '').trim());
}

async function ensureProfile(user, preferredNickname = '') {
  if (!user || user.isAnonymous) return false;
  if (await profileExists(user)) return true;
  setMode('profile');
  nickname.value = preferredNickname || '';
  setMessage('닉네임을 정하면 로그인이 완료됩니다.');
  nickname.focus();
  return false;
}

async function saveProfile() {
  const value = String(nickname.value || '').trim();
  if (value.length < 2 || value.length > 12) throw new Error('닉네임은 2~12자로 입력해주세요.');
  if (nicknameChecked !== value) {
    const result = await checkNickname({ nickname: value });
    if (!result.data?.available) throw Object.assign(new Error('이미 사용 중인 닉네임입니다.'), { code: 'functions/already-exists' });
    nicknameChecked = value;
  }
  await saveMemberProfile({ nickname: value });
}

async function signupEmail() {
  const emailValue = String(email.value || '').trim();
  const passwordValue = String(password.value || '');
  if (!emailValue || passwordValue.length < 6) throw new Error('이메일과 6자 이상의 비밀번호를 입력해주세요.');
  const current = auth.currentUser;
  if (current?.isAnonymous) {
    try {
      await linkWithCredential(current, EmailAuthProvider.credential(emailValue, passwordValue));
    } catch (error) {
      if (error?.code !== 'auth/credential-already-in-use') throw error;
      await signInWithEmailAndPassword(auth, emailValue, passwordValue);
    }
  } else {
    await createUserWithEmailAndPassword(auth, emailValue, passwordValue);
  }
  await saveProfile();
  redirectAfterAuth();
}

async function loginEmail() {
  const emailValue = String(email.value || '').trim();
  const passwordValue = String(password.value || '');
  if (!emailValue || !passwordValue) throw new Error('이메일과 비밀번호를 입력해주세요.');
  const credential = await signInWithEmailAndPassword(auth, emailValue, passwordValue);
  const ready = await ensureProfile(credential.user);
  if (ready) redirectAfterAuth();
}

async function loginGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  let result;
  const current = auth.currentUser;
  if (current?.isAnonymous) {
    try {
      result = await linkWithPopup(current, provider);
    } catch (error) {
      if (error?.code !== 'auth/credential-already-in-use' && error?.code !== 'auth/provider-already-linked') throw error;
      result = await signInWithPopup(auth, provider);
    }
  } else {
    result = await signInWithPopup(auth, provider);
  }
  const ready = await ensureProfile(result.user, result.user.displayName || '');
  if (ready) redirectAfterAuth();
}

document.getElementById('check-nickname').addEventListener('click', async () => {
  try {
    const value = String(nickname.value || '').trim();
    if (value.length < 2 || value.length > 12) throw new Error('닉네임은 2~12자로 입력해주세요.');
    const result = await checkNickname({ nickname: value });
    if (!result.data?.available) throw Object.assign(new Error('이미 사용 중인 닉네임입니다.'), { code: 'functions/already-exists' });
    nicknameChecked = value;
    nicknameStatus.textContent = '사용할 수 있는 닉네임입니다.';
    nicknameStatus.className = 'field-status good';
  } catch (error) {
    nicknameChecked = '';
    nicknameStatus.textContent = errorText(error);
    nicknameStatus.className = 'field-status bad';
  }
});

emailForm.addEventListener('submit', async event => {
  event.preventDefault();
  submitButton.disabled = true;
  googleButton.disabled = true;
  setMessage('처리 중…');
  try {
    if (mode === 'profile') {
      await saveProfile();
      redirectAfterAuth();
    } else if (mode === 'signup') {
      await signupEmail();
    } else {
      await loginEmail();
    }
  } catch (error) {
    setMessage(errorText(error), true);
  } finally {
    submitButton.disabled = false;
    googleButton.disabled = false;
  }
});

googleButton.addEventListener('click', async () => {
  googleButton.disabled = true;
  submitButton.disabled = true;
  setMessage('Google 로그인 창을 여는 중…');
  try {
    await loginGoogle();
  } catch (error) {
    setMessage(errorText(error), true);
  } finally {
    googleButton.disabled = false;
    submitButton.disabled = false;
  }
});

modeToggle.addEventListener('click', () => setMode(mode === 'login' ? 'signup' : 'login'));

resetButton.addEventListener('click', async () => {
  const emailValue = String(email.value || '').trim();
  if (!emailValue) return setMessage('먼저 이메일을 입력해주세요.', true);
  try {
    await sendPasswordResetEmail(auth, emailValue);
    setMessage('비밀번호 재설정 이메일을 보냈습니다. 받은편지함을 확인해주세요.');
  } catch (error) {
    setMessage(errorText(error), true);
  }
});

void (async () => {
  try {
    await auth.authStateReady();
    const user = auth.currentUser;
    if (user && !user.isAnonymous) {
      const ready = await ensureProfile(user, user.displayName || '');
      if (ready) redirectAfterAuth();
    }
  } catch (error) {
    setMessage(errorText(error), true);
  }
})();
