import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { firebaseConfig } from '../js/firebase-config.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

let adminModulesLoaded = false;
let authViewVersion = 0;

function host() {
  return document.getElementById('admin-content');
}

function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  container.appendChild(item);
  setTimeout(() => item.remove(), 3200);
}

function friendlyError(error, fallback = '로그인에 실패했습니다.') {
  const code = String(error?.code || '');
  if (code.includes('popup-closed-by-user')) return '로그인 창이 닫혔습니다.';
  if (code.includes('unauthorized-domain')) return 'Firebase 인증 도메인 설정을 확인해주세요.';
  if (code.includes('network-request-failed')) return '네트워크 연결을 확인해주세요.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return '이메일 또는 비밀번호를 확인해주세요.';
  }
  return fallback;
}

async function isAdmin(user) {
  if (!user || user.isAnonymous) return false;
  const uidDoc = await getDoc(doc(db, 'admins', user.uid)).catch(() => null);
  if (uidDoc?.exists()) return true;

  const email = String(user.email || '').trim().toLowerCase();
  if (!email) return false;
  const emailDoc = await getDoc(doc(db, 'admins', email)).catch(() => null);
  return !!emailDoc?.exists();
}

async function loadAdminModules() {
  if (adminModulesLoaded) return;
  adminModulesLoaded = true;
  await import('./admin.js?v=20260729-script-csp-1');
  await import('./admin-enhancements.js?v=20260729-script-csp-1');
  await import('./admin-security-overrides.js?v=20260729-script-csp-1');
}

function renderLogin() {
  const root = host();
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div class="card" style="width:100%;max-width:390px;padding:26px;">
        <div style="text-align:center;margin-bottom:24px;">
          <img src="/app-icon.svg?v=20260630-3" style="width:70px;height:70px;margin-bottom:10px;" alt="">
          <div style="font-family:var(--font-serif);font-size:21px;color:var(--gold);font-weight:800;">소소킹 관리자</div>
          <div style="font-size:13px;color:var(--cream-dim);margin-top:4px;">등록된 관리자 계정만 접근할 수 있습니다.</div>
        </div>
        <button class="btn btn-secondary" id="strict-google-admin" type="button" style="margin-bottom:16px;">Google 관리자 로그인</button>
        <form id="strict-login-form">
          <div class="form-group"><label class="form-label">이메일</label><input type="email" id="strict-em" class="form-input" autocomplete="username" required></div>
          <div class="form-group"><label class="form-label">비밀번호</label><input type="password" id="strict-pw" class="form-input" autocomplete="current-password" required></div>
          <button type="submit" class="btn btn-primary" id="strict-login-btn">이메일 로그인</button>
          <button type="button" id="strict-reset-btn" style="width:100%;margin-top:10px;background:none;border:none;color:var(--cream-dim);font-size:13px;cursor:pointer;padding:8px;">비밀번호 재설정</button>
        </form>
      </div>
    </div>`;

  const googleButton = document.getElementById('strict-google-admin');
  googleButton?.addEventListener('click', async () => {
    googleButton.disabled = true;
    const oldText = googleButton.textContent;
    googleButton.textContent = 'Google 로그인 준비 중...';
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(error?.code)) {
        try {
          googleButton.textContent = 'Google 로그인 화면으로 이동...';
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError) {
          error = redirectError;
        }
      }
      toast(friendlyError(error, 'Google 로그인에 실패했습니다.'), 'error');
      googleButton.disabled = false;
      googleButton.textContent = oldText;
    }
  });

  document.getElementById('strict-login-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('strict-login-btn');
    button.disabled = true;
    button.textContent = '로그인 중...';
    try {
      await signInWithEmailAndPassword(
        auth,
        document.getElementById('strict-em').value.trim(),
        document.getElementById('strict-pw').value
      );
    } catch (error) {
      toast(friendlyError(error), 'error');
      button.disabled = false;
      button.textContent = '이메일 로그인';
    }
  });

  document.getElementById('strict-reset-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('strict-em').value.trim();
    if (!email) return toast('이메일을 먼저 입력해주세요.', 'error');
    try {
      await sendPasswordResetEmail(auth, email);
      toast('재설정 메일을 보냈습니다.', 'success');
    } catch (error) {
      toast(friendlyError(error, '재설정 메일 전송에 실패했습니다.'), 'error');
    }
  });
}

function renderNoAccess(user) {
  const root = host();
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center;">
      <div class="card" style="max-width:460px;padding:26px;">
        <div style="font-size:46px;margin-bottom:12px;">🚫</div>
        <div style="font-family:var(--font-serif);font-size:20px;color:var(--gold);font-weight:800;margin-bottom:8px;">관리자 권한 없음</div>
        <div style="font-size:13px;color:var(--cream-dim);line-height:1.8;margin-bottom:20px;overflow-wrap:anywhere;">
          Firestore의 <code>admins/${String(user?.uid || '')}</code> 또는 등록 이메일 문서가 필요합니다.<br>
          로그인 계정: ${String(user?.email || '이메일 없음')}
        </div>
        <button class="btn btn-secondary" id="strict-noaccess-logout">로그아웃</button>
      </div>
    </div>`;
  document.getElementById('strict-noaccess-logout')?.addEventListener('click', () => signOut(auth));
}

getRedirectResult(auth).catch(error => {
  console.error('admin redirect login result failed:', error);
  toast(friendlyError(error), 'error');
});

onAuthStateChanged(auth, async user => {
  const version = ++authViewVersion;
  if (!user) {
    renderLogin();
    return;
  }

  const root = host();
  if (root) root.innerHTML = '<div class="loading-dots" style="min-height:100vh;"><span></span><span></span><span></span></div>';
  const allowed = await isAdmin(user);
  if (version !== authViewVersion) return;

  if (!allowed) {
    renderNoAccess(user);
    return;
  }

  await loadAdminModules();
});
