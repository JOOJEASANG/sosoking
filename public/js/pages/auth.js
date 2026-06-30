import { auth, db, functions } from '../firebase.js?v=20260630-3';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import {
  GoogleAuthProvider,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  linkWithPopup,
  linkWithCredential,
  signOut,
  updateProfile,
  onAuthStateChanged,
  signInAnonymously,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { showToast } from '../components/toast.js?v=20260630-3';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';
import { avatarImg, avatarSourceLabel } from '../utils/avatar.js?v=20260630-3';

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
const checkNicknameFn = httpsCallable(functions, 'checkNickname');
const setNicknameFn = httpsCallable(functions, 'setNickname');

function cleanNickname(value) {
  return String(value || '').replace(/\s+/g, '').trim().slice(0, 20);
}

function nicknameError(value) {
  const n = cleanNickname(value);
  if (n.length < 2) return '닉네임은 2자 이상 입력해주세요.';
  if (n.length > 20) return '닉네임은 20자 이하로 입력해주세요.';
  if (!/^[가-힣a-zA-Z0-9_]+$/.test(n)) return '닉네임은 한글, 영문, 숫자, 밑줄만 사용할 수 있습니다.';
  return '';
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function passwordMessage(value) {
  const pw = String(value || '');
  if (pw.length < 6) return '비밀번호는 최소 6자 이상이어야 합니다.';
  if (pw.length > 30) return '비밀번호는 30자 이하로 입력해주세요.';
  return '';
}

function providerLabel(user, profile = {}) {
  const p = profile.provider || user.providerData?.[0]?.providerId || '';
  if (p.includes('google')) return 'Google 소셜 로그인';
  if (p.includes('password')) return '이메일 로그인';
  return '로그인';
}

async function ensureGuestAfterLogout() {
  if (!auth.currentUser) await signInAnonymously(auth).catch(() => {});
}

async function loadProfile(user) {
  if (!user) return {};
  const snap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  return snap?.exists() ? snap.data() : {};
}

async function isNicknameAvailable(user, nickname) {
  const err = nicknameError(nickname);
  if (err) throw new Error(err);
  const res = await checkNicknameFn({ nickname: cleanNickname(nickname) });
  return !!res.data?.available;
}

async function saveNickname(user, nickname) {
  const finalNickname = cleanNickname(nickname);
  const err = nicknameError(finalNickname);
  if (err) throw new Error(err);
  await setNicknameFn({ nickname: finalNickname, photoURL: user.photoURL || '' });
  await updateProfile(user, { displayName: finalNickname }).catch(() => {});
}

export async function renderAuth(container) {
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">내 계정</span>
      </div>
      <div class="container" style="padding-top:24px;padding-bottom:90px;">
        <div id="auth-box" class="card" style="padding:22px;">
          <div style="text-align:center;padding:24px 0;"><div class="loading-dots"><span></span><span></span><span></span></div></div>
        </div>
      </div>
    </div>`;

  const box = document.getElementById('auth-box');
  onAuthStateChanged(auth, async user => {
    if (!box) return;
    if (user && !user.isAnonymous) {
      const profile = await loadProfile(user);
      if (!profile.nickname) renderNicknameSetup(box, user, profile);
      else renderProfile(box, user, profile);
    } else {
      renderLoginForm(box);
    }
  });
}

function renderLoginForm(box) {
  box.innerHTML = `
    <div style="text-align:center;margin-bottom:22px;">
      <div style="font-size:46px;margin-bottom:8px;">⚖️</div>
      <div style="font-family:var(--font-serif);font-size:21px;font-weight:700;color:var(--gold);">소소킹 계정</div>
      <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-top:8px;">현재 로그인되어 있지 않습니다.<br>로그인하면 닉네임, 프로필 아이콘, 내 사건 기록이 표시됩니다.</div>
    </div>

    <button class="btn btn-secondary" id="google-login" style="margin-bottom:18px;">Google로 계속하기</button>

    <div style="display:flex;align-items:center;gap:10px;margin:20px 0;color:var(--cream-dim);font-size:12px;"><div style="height:1px;background:var(--border);flex:1;"></div><span>또는 이메일</span><div style="height:1px;background:var(--border);flex:1;"></div></div>

    <form id="email-auth-form">
      <div class="form-group"><label class="form-label">이메일</label><input type="email" id="auth-email" class="form-input" placeholder="you@example.com" required></div>
      <div class="form-group"><label class="form-label">간단 비밀번호</label><input type="password" id="auth-password" class="form-input" minlength="6" maxlength="30" placeholder="6자 이상" required><div style="font-size:11px;color:var(--cream-dim);margin-top:6px;">Firebase 기본 정책상 비밀번호는 최소 6자 이상이어야 합니다.</div></div>
      <button type="submit" class="btn btn-primary" id="signup-btn">가입하기</button>
      <button type="button" class="btn btn-ghost" id="login-btn" style="margin-top:10px;">이미 계정이 있어요 · 로그인</button>
    </form>`;

  document.getElementById('google-login').addEventListener('click', async () => {
    try {
      let result;
      if (auth.currentUser?.isAnonymous) {
        result = await linkWithPopup(auth.currentUser, provider).catch(async err => {
          if (err.code === 'auth/credential-already-in-use' || err.code === 'auth/email-already-in-use') return signInWithPopup(auth, provider);
          throw err;
        });
      } else {
        result = await signInWithPopup(auth, provider);
      }
      const profile = await loadProfile(result.user);
      showToast(profile.nickname ? '구글 로그인 완료' : '구글 로그인 완료. 닉네임을 설정해주세요.', 'success');
      if (profile.nickname) renderProfile(box, result.user, profile);
      else renderNicknameSetup(box, result.user, profile);
    } catch (err) {
      console.error(err);
      showToast(err.message || '구글 로그인에 실패했습니다.', 'error');
    }
  });

  document.getElementById('email-auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    await handleEmailSignup(box);
  });
  document.getElementById('login-btn').addEventListener('click', async () => handleEmailLogin(box));
}

async function handleEmailSignup(box) {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!validEmail(email)) return showToast('이메일 형식을 확인해주세요.', 'error');
  const pwMsg = passwordMessage(password);
  if (pwMsg) return showToast(pwMsg, 'error');
  const btn = document.getElementById('signup-btn');
  btn.disabled = true;
  btn.textContent = '가입 처리 중...';
  try {
    let result;
    if (auth.currentUser?.isAnonymous) result = await linkWithCredential(auth.currentUser, EmailAuthProvider.credential(email, password));
    else result = await createUserWithEmailAndPassword(auth, email, password);
    showToast('가입 완료. 닉네임을 설정해주세요.', 'success');
    renderNicknameSetup(box, result.user, await loadProfile(result.user));
  } catch (err) {
    console.error(err);
    const msg = err.code === 'auth/email-already-in-use' ? '이미 가입된 이메일입니다. 로그인 버튼을 눌러주세요.' : (err.message || '가입에 실패했습니다.');
    showToast(msg, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '가입하기';
  }
}

async function handleEmailLogin(box) {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!validEmail(email)) return showToast('이메일 형식을 확인해주세요.', 'error');
  if (!password) return showToast('비밀번호를 입력해주세요.', 'error');
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const profile = await loadProfile(result.user);
    showToast('로그인 완료', 'success');
    if (!profile.nickname) renderNicknameSetup(box, result.user, profile);
    else renderProfile(box, result.user, profile);
  } catch (err) {
    console.error(err);
    showToast('이메일 또는 비밀번호를 확인해주세요.', 'error');
  }
}

function renderNicknameSetup(box, user, profile = {}) {
  const current = cleanNickname(profile.nickname || user.displayName || '');
  box.innerHTML = `
    <div style="text-align:center;margin-bottom:22px;">
      <div style="margin-bottom:10px;">${avatarImg(user, { ...profile, nickname: current }, 72)}</div>
      <div style="display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;background:rgba(39,174,96,.13);border:1px solid rgba(39,174,96,.35);color:#27ae60;font-size:12px;font-weight:800;margin-bottom:10px;">● 로그인됨</div>
      <div style="font-family:var(--font-serif);font-size:21px;font-weight:700;color:var(--gold);">닉네임 설정</div>
      <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-top:8px;">구글 사진이 있으면 프로필 아이콘으로 사용됩니다.<br>사진이 없으면 닉네임 기반 아이콘이 자동 생성됩니다.</div>
    </div>

    <form id="nickname-form">
      <div class="form-group">
        <label class="form-label">닉네임</label>
        <div style="display:flex;gap:8px;"><input type="text" id="profile-nickname" class="form-input" maxlength="20" value="${escapeHtml(current)}" placeholder="예: 억울한라면러버" required style="flex:1;"><button type="button" class="btn btn-secondary" id="check-nickname" style="width:112px;padding-left:0;padding-right:0;">중복확인</button></div>
        <div id="nickname-status" style="font-size:12px;color:var(--cream-dim);margin-top:8px;">한글, 영문, 숫자, 밑줄 2~20자</div>
      </div>
      <button type="submit" class="btn btn-primary" id="save-nickname" disabled>닉네임 저장</button>
    </form>
    <button class="btn btn-ghost" id="logout-btn" style="margin-top:10px;">로그아웃</button>`;

  let checkedName = '';
  let available = false;
  const input = document.getElementById('profile-nickname');
  const status = document.getElementById('nickname-status');
  const saveBtn = document.getElementById('save-nickname');

  input.addEventListener('input', () => {
    available = false;
    checkedName = '';
    saveBtn.disabled = true;
    status.textContent = '중복 확인이 필요합니다.';
    status.style.color = 'var(--cream-dim)';
  });

  document.getElementById('check-nickname').addEventListener('click', async () => {
    const nickname = cleanNickname(input.value);
    input.value = nickname;
    if (!nickname) return showToast('닉네임을 입력해주세요.', 'error');
    try {
      available = await isNicknameAvailable(user, nickname);
      checkedName = nickname;
      status.textContent = available ? '사용 가능한 닉네임입니다.' : '이미 사용 중인 닉네임입니다.';
      status.style.color = available ? '#27ae60' : '#e74c3c';
      saveBtn.disabled = !available;
    } catch (err) {
      console.error(err);
      available = false;
      saveBtn.disabled = true;
      showToast(err.message || '중복 확인에 실패했습니다.', 'error');
    }
  });

  document.getElementById('nickname-form').addEventListener('submit', async e => {
    e.preventDefault();
    const nickname = cleanNickname(input.value);
    if (!available || nickname !== checkedName) return showToast('닉네임 중복 확인을 먼저 해주세요.', 'error');
    try {
      await saveNickname(user, nickname);
      showToast('닉네임이 저장되었습니다.', 'success');
      renderProfile(box, user, await loadProfile(user));
    } catch (err) {
      console.error(err);
      showToast(err.message || '닉네임 저장에 실패했습니다.', 'error');
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await signOut(auth);
    await ensureGuestAfterLogout();
    showToast('로그아웃되었습니다.', 'success');
    location.hash = '#/';
  });
}

function renderProfile(box, user, profile = {}) {
  const nickname = cleanNickname(profile.nickname || user.displayName || '닉네임미설정');
  const email = user.email || profile.email || '';
  const provider = providerLabel(user, profile);

  box.innerHTML = `
    <div style="text-align:center;margin-bottom:20px;">
      <div style="margin-bottom:10px;">${avatarImg(user, profile, 88)}</div>
      <div style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;background:rgba(39,174,96,.13);border:1px solid rgba(39,174,96,.35);color:#27ae60;font-size:12px;font-weight:900;margin-bottom:10px;">● 로그인됨</div>
      <div style="font-family:var(--font-serif);font-size:23px;font-weight:800;color:var(--gold);">${escapeHtml(nickname)}</div>
      <div style="font-size:13px;color:var(--cream-dim);margin-top:6px;line-height:1.7;">${escapeHtml(email || '이메일 정보 없음')}<br>${escapeHtml(provider)}</div>
    </div>

    <div class="card" style="padding:15px;margin-bottom:14px;background:rgba(255,255,255,.025);">
      <div style="font-weight:900;color:var(--gold);margin-bottom:8px;">내 프로필 상태</div>
      <div style="display:grid;grid-template-columns:92px 1fr;gap:8px;font-size:13px;color:var(--cream-dim);line-height:1.7;">
        <div>로그인 상태</div><div style="color:#27ae60;font-weight:800;">접속 중</div>
        <div>프로필 아이콘</div><div>${escapeHtml(avatarSourceLabel(user, profile))}</div>
        <div>닉네임</div><div>${escapeHtml(nickname)}</div>
      </div>
    </div>

    <button class="btn btn-secondary" id="change-nickname">닉네임 변경</button>
    <a href="#/my-cases" class="btn btn-primary" style="margin-top:10px;">내 사건 보기</a>
    <a href="#/submit" class="btn btn-ghost" style="margin-top:10px;">새 사건 접수하기</a>
    <button class="btn btn-ghost" id="logout-btn" style="margin-top:10px;">로그아웃</button>`;

  document.getElementById('change-nickname').addEventListener('click', () => renderNicknameSetup(box, user, profile));
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await signOut(auth);
    await ensureGuestAfterLogout();
    showToast('로그아웃되었습니다.', 'success');
    location.hash = '#/';
  });
}
