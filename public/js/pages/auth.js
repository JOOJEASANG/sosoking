import { auth, db } from '../firebase.js?v=20260630-3';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import {
  GoogleAuthProvider,
  EmailAuthProvider,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
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

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

function cleanNickname(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 20);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

async function saveProfile(user, nickname = '') {
  if (!user) return;
  const profileRef = doc(db, 'users', user.uid);
  const snap = await getDoc(profileRef).catch(() => null);
  const existing = snap?.exists() ? snap.data() : {};
  const finalNickname = cleanNickname(nickname || existing.nickname || user.displayName || '소소한 원고');

  if (finalNickname && user.displayName !== finalNickname) {
    await updateProfile(user, { displayName: finalNickname }).catch(() => {});
  }

  await setDoc(profileRef, {
    uid: user.uid,
    email: user.email || existing.email || '',
    nickname: finalNickname,
    provider: user.providerData?.[0]?.providerId || existing.provider || (user.isAnonymous ? 'anonymous' : 'unknown'),
    isAnonymous: !!user.isAnonymous,
    updatedAt: serverTimestamp(),
    createdAt: existing.createdAt || serverTimestamp(),
  }, { merge: true });
}

async function ensureGuestAfterLogout() {
  if (!auth.currentUser) {
    await signInAnonymously(auth).catch(() => {});
  }
}

async function completeEmailLinkIfNeeded() {
  if (!isSignInWithEmailLink(auth, location.href)) return null;

  const pending = JSON.parse(localStorage.getItem('sosoking_email_link') || '{}');
  const email = pending.email || window.prompt('가입/로그인에 사용한 이메일을 입력해주세요.');
  const nickname = cleanNickname(pending.nickname || '소소한 원고');
  if (!email) throw new Error('이메일 확인이 취소되었습니다.');

  let userCred;
  if (auth.currentUser?.isAnonymous) {
    const credential = EmailAuthProvider.credentialWithLink(email, location.href);
    userCred = await linkWithCredential(auth.currentUser, credential).catch(async err => {
      if (err.code === 'auth/credential-already-in-use' || err.code === 'auth/email-already-in-use') {
        return signInWithEmailLink(auth, email, location.href);
      }
      throw err;
    });
  } else {
    userCred = await signInWithEmailLink(auth, email, location.href);
  }

  localStorage.removeItem('sosoking_email_link');
  await saveProfile(userCred.user, nickname);
  history.replaceState(null, '', `${location.origin}/#/auth`);
  return userCred.user;
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
          <div style="text-align:center;padding:24px 0;">
            <div class="loading-dots"><span></span><span></span><span></span></div>
          </div>
        </div>
      </div>
    </div>`;

  const box = document.getElementById('auth-box');

  try {
    const linkedUser = await completeEmailLinkIfNeeded();
    if (linkedUser) showToast('이메일 가입/로그인이 완료되었습니다.', 'success');
  } catch (err) {
    console.error(err);
    showToast(err.message || '이메일 로그인 처리 중 오류가 발생했습니다.', 'error');
  }

  onAuthStateChanged(auth, async user => {
    if (!box) return;
    if (user && !user.isAnonymous) {
      await renderProfile(box, user);
    } else {
      renderLoginForm(box);
    }
  });
}

function renderLoginForm(box) {
  box.innerHTML = `
    <div style="text-align:center;margin-bottom:22px;">
      <div style="font-size:46px;margin-bottom:8px;">⚖️</div>
      <div style="font-family:var(--font-serif);font-size:21px;font-weight:700;color:var(--gold);">소소킹 계정 만들기</div>
      <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-top:8px;">비밀번호 없이 이메일과 닉네임만으로 가입합니다.<br>구글 계정으로도 바로 로그인할 수 있습니다.</div>
    </div>

    <button class="btn btn-secondary" id="google-login" style="margin-bottom:18px;">Google로 계속하기</button>

    <div style="display:flex;align-items:center;gap:10px;margin:20px 0;color:var(--cream-dim);font-size:12px;">
      <div style="height:1px;background:var(--border);flex:1;"></div>
      <span>또는 이메일 링크</span>
      <div style="height:1px;background:var(--border);flex:1;"></div>
    </div>

    <form id="email-link-form">
      <div class="form-group">
        <label class="form-label">이메일</label>
        <input type="email" id="auth-email" class="form-input" placeholder="you@example.com" required>
      </div>
      <div class="form-group">
        <label class="form-label">닉네임</label>
        <input type="text" id="auth-nickname" class="form-input" maxlength="20" placeholder="예: 억울한 라면러버" required>
      </div>
      <button type="submit" class="btn btn-primary" id="email-link-btn">가입/로그인 링크 받기</button>
    </form>

    <div class="disclaimer" style="margin-top:18px;font-size:12px;">
      이메일 링크 방식이라 비밀번호를 만들 필요가 없습니다. 메일함에서 링크를 누르면 가입 또는 로그인이 완료됩니다.
    </div>
  `;

  document.getElementById('google-login').addEventListener('click', async () => {
    try {
      let result;
      if (auth.currentUser?.isAnonymous) {
        result = await linkWithPopup(auth.currentUser, provider).catch(async err => {
          if (err.code === 'auth/credential-already-in-use' || err.code === 'auth/email-already-in-use') {
            return signInWithPopup(auth, provider);
          }
          throw err;
        });
      } else {
        result = await signInWithPopup(auth, provider);
      }
      await saveProfile(result.user, result.user.displayName || '구글 원고');
      showToast('구글 로그인 완료', 'success');
      location.hash = '#/my-cases';
    } catch (err) {
      console.error(err);
      showToast(err.message || '구글 로그인에 실패했습니다.', 'error');
    }
  });

  document.getElementById('email-link-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const nickname = cleanNickname(document.getElementById('auth-nickname').value);
    if (!validEmail(email)) return showToast('이메일 형식을 확인해주세요.', 'error');
    if (!nickname) return showToast('닉네임을 입력해주세요.', 'error');

    const btn = document.getElementById('email-link-btn');
    btn.disabled = true;
    btn.textContent = '메일 보내는 중...';

    try {
      await sendSignInLinkToEmail(auth, email, {
        url: `${location.origin}/#/auth`,
        handleCodeInApp: true,
      });
      localStorage.setItem('sosoking_email_link', JSON.stringify({ email, nickname }));
      showToast('가입/로그인 링크를 이메일로 보냈습니다.', 'success');
      btn.textContent = '메일함을 확인해주세요';
    } catch (err) {
      console.error(err);
      showToast(err.message || '이메일 발송에 실패했습니다.', 'error');
      btn.disabled = false;
      btn.textContent = '가입/로그인 링크 받기';
    }
  });
}

async function renderProfile(box, user) {
  const snap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  const profile = snap?.exists() ? snap.data() : {};
  const nickname = cleanNickname(profile.nickname || user.displayName || '소소한 원고');
  const email = user.email || profile.email || '';

  box.innerHTML = `
    <div style="text-align:center;margin-bottom:22px;">
      <div style="font-size:46px;margin-bottom:8px;">👤</div>
      <div style="font-family:var(--font-serif);font-size:21px;font-weight:700;color:var(--gold);">${escapeHtml(nickname)}</div>
      <div style="font-size:13px;color:var(--cream-dim);margin-top:6px;">${escapeHtml(email || '이메일 정보 없음')}</div>
    </div>

    <form id="profile-form">
      <div class="form-group">
        <label class="form-label">닉네임</label>
        <input type="text" id="profile-nickname" class="form-input" maxlength="20" value="${escapeHtml(nickname)}" required>
      </div>
      <button type="submit" class="btn btn-primary">닉네임 저장</button>
    </form>

    <a href="#/my-cases" class="btn btn-secondary" style="margin-top:10px;">내 사건 보기</a>
    <button class="btn btn-ghost" id="logout-btn" style="margin-top:10px;">로그아웃</button>
  `;

  document.getElementById('profile-form').addEventListener('submit', async e => {
    e.preventDefault();
    const nextNickname = cleanNickname(document.getElementById('profile-nickname').value);
    if (!nextNickname) return showToast('닉네임을 입력해주세요.', 'error');
    await saveProfile(user, nextNickname);
    showToast('닉네임이 저장되었습니다.', 'success');
    renderProfile(box, auth.currentUser);
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await signOut(auth);
    await ensureGuestAfterLogout();
    showToast('로그아웃되었습니다.', 'success');
    location.hash = '#/';
  });
}
