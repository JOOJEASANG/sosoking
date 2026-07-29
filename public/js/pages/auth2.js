import { auth, db, functions, getInitialRedirectResult } from '../firebase.js?v=20260729-auth-session-1';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut, updateProfile, onAuthStateChanged, signInAnonymously, sendEmailVerification, reload } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { showToast } from '../components/toast.js?v=20260728-ui-audit-2';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';
import { avatarImg, avatarSourceLabel } from '../utils/avatar.js?v=20260630-3';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
const checkNickname = httpsCallable(functions, 'checkNickname');
const setNickname = httpsCallable(functions, 'setNickname');
const REDIRECT_FLAG = 'sosoking:google-login-redirect';
const NOTICE_FLAG = 'sosoking:last-auth-notice';

function cleanNick(v){ return String(v || '').replace(/\s+/g, '').trim().slice(0, 20); }
function nickError(v){ const n = cleanNick(v); if(n.length < 2) return '닉네임은 2자 이상 입력해주세요.'; if(!/^[가-힣a-zA-Z0-9_]+$/.test(n)) return '한글, 영문, 숫자, 밑줄만 사용할 수 있습니다.'; return ''; }
function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim()); }
async function profileOf(user){ if(!user || user.isAnonymous) return {}; const s = await getDoc(doc(db, 'users', user.uid)).catch(() => null); return s?.exists() ? s.data() : {}; }
async function guest(){ if(!auth.currentUser) await signInAnonymously(auth).catch(() => {}); }
function providerName(user, profile){ const p = profile.provider || user.providerData?.[0]?.providerId || ''; return p.includes('google') ? 'Google 소셜 로그인' : p.includes('password') ? '이메일 로그인' : '로그인'; }
function needsEmailVerification(user){ return Boolean(user && !user.isAnonymous && user.providerData?.some(p => p.providerId === 'password') && !user.emailVerified); }
function popupNeedsRedirect(e){ return ['auth/popup-blocked','auth/operation-not-supported-in-this-environment'].includes(e?.code); }

function friendlyAuthMessage(error, fallback = '로그인 처리 중 문제가 발생했습니다.') {
  const messages = {
    'auth/popup-closed-by-user': 'Google 로그인이 취소되었습니다.',
    'auth/cancelled-popup-request': '이미 로그인 창이 열려 있습니다.',
    'auth/network-request-failed': '네트워크 연결을 확인한 뒤 다시 시도해주세요.',
    'auth/too-many-requests': '로그인 시도가 많습니다. 잠시 후 다시 시도해주세요.',
    'auth/user-disabled': '사용이 제한된 계정입니다.',
    'auth/invalid-credential': '이메일 또는 비밀번호를 확인해주세요.',
    'auth/wrong-password': '이메일 또는 비밀번호를 확인해주세요.',
    'auth/user-not-found': '이메일 또는 비밀번호를 확인해주세요.',
    'auth/email-already-in-use': '이미 가입된 이메일입니다.',
    'auth/weak-password': '비밀번호는 6자 이상 입력해주세요.',
    'auth/invalid-email': '이메일 형식을 확인해주세요.',
    'auth/unauthorized-domain': '현재 사이트 주소가 Google 로그인 허용 목록에 없습니다. 관리자에게 문의해주세요.',
    'auth/operation-not-allowed': 'Firebase에서 Google 로그인이 활성화되지 않았습니다.',
    'auth/account-exists-with-different-credential': '같은 이메일로 가입한 다른 로그인 방식이 있습니다.',
    'auth/web-storage-unsupported': '브라우저 저장소가 차단되어 있습니다. 일반 Chrome 탭에서 다시 시도해주세요.'
  };
  return messages[error?.code] || fallback;
}

function showAuthNotice(message, type = 'success') {
  const now = Date.now();
  const key = `${type}:${message}`;
  let previous = null;
  try { previous = JSON.parse(sessionStorage.getItem(NOTICE_FLAG) || 'null'); } catch { previous = null; }
  if (previous?.key === key && now - Number(previous.at || 0) < 4000) return;
  try { sessionStorage.setItem(NOTICE_FLAG, JSON.stringify({ key, at: now })); } catch {}
  showToast(message, type);
}

function markRedirectStarted() {
  try {
    sessionStorage.setItem(REDIRECT_FLAG, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}
function consumeRedirectFlag() {
  try {
    const active = sessionStorage.getItem(REDIRECT_FLAG);
    sessionStorage.removeItem(REDIRECT_FLAG);
    return Boolean(active);
  } catch {
    return false;
  }
}

export async function renderAuth(container){
  container.innerHTML = `<div><div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">내 계정</span></div><div class="container" style="padding-top:24px;padding-bottom:90px;"><div id="auth-box" class="card auth-card" style="padding:22px;"><div class="loading-dots"><span></span><span></span><span></span></div></div></div></div>`;
  const box = document.getElementById('auth-box');
  let active = true;
  let lastView = '';

  const renderUser = async user => {
    if(!active || !box) return;
    if(user && !user.isAnonymous){
      if(needsEmailVerification(user)){
        const view = `${user.uid}:verify-email`;
        if(view === lastView) return;
        lastView = view;
        drawEmailVerification(box, user);
        return;
      }
      const p = await profileOf(user);
      if(!active) return;
      const view = `${user.uid}:${p.nickname ? 'profile' : 'nickname'}:${p.nickname || user.displayName || ''}`;
      if(view === lastView) return;
      lastView = view;
      p.nickname ? drawProfile(box, user, p) : drawNick(box, user, p);
    } else {
      if(lastView === 'login') return;
      lastView = 'login';
      drawLogin(box);
    }
  };

  const unsub = onAuthStateChanged(auth, user => { renderUser(user).catch(err => console.warn('auth view render skipped', err)); });
  getInitialRedirectResult().then(async result => {
    if(!result?.user) return;
    if(consumeRedirectFlag()) showAuthNotice('Google 로그인 완료', 'success');
    await renderUser(result.user);
  }).catch(error => {
    console.warn('redirect login result skipped', error?.code || error);
    if(consumeRedirectFlag()) showAuthNotice(friendlyAuthMessage(error), 'error');
  });
  window._pageCleanup = () => { active = false; unsub(); };
}

function drawLogin(box){
  box.innerHTML = `<div style="text-align:center;margin-bottom:22px;"><img class="auth-brand-logo" src="/logo.png?v=20260729-brand-unified-1" alt="소소킹 저울 로고" width="112" height="112"><div style="font-family:var(--font-serif);font-size:21px;font-weight:700;color:var(--gold);">소소킹 계정</div><div style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-top:8px;">로그인하면 닉네임, 프로필 아이콘, 내 사건 기록이 표시됩니다.</div></div><button class="btn btn-secondary" id="google-login" style="margin-bottom:18px;">Google로 계속하기</button><div class="auth-divider"><span></span><b>또는 이메일</b><span></span></div><form id="email-form"><div class="form-group"><label class="form-label">이메일</label><input type="email" id="auth-email" class="form-input" autocomplete="email" required></div><div class="form-group"><label class="form-label">비밀번호</label><input type="password" id="auth-password" class="form-input" autocomplete="current-password" minlength="6" maxlength="30" required></div><button type="submit" class="btn btn-primary" id="signup-btn">가입하기</button><button type="button" class="btn btn-ghost" id="login-btn" style="margin-top:10px;">이미 계정이 있어요 · 로그인</button></form>`;
  document.getElementById('google-login').onclick = async () => {
    const btn = document.getElementById('google-login');
    if(!btn || btn.disabled) return;
    btn.disabled = true;
    btn.textContent = 'Google 로그인 준비 중...';
    try {
      const result = await signInWithPopup(auth, googleProvider);
      showAuthNotice('Google 로그인 완료', 'success');
      const profile = await profileOf(result.user);
      profile.nickname ? drawProfile(box, result.user, profile) : drawNick(box, result.user, profile);
    } catch(error){
      console.warn('google login failed', error?.code || error);
      if(popupNeedsRedirect(error)) {
        if(!markRedirectStarted()) {
          showAuthNotice(friendlyAuthMessage({ code: 'auth/web-storage-unsupported' }), 'error');
          btn.disabled = false;
          btn.textContent = 'Google로 계속하기';
          return;
        }
        btn.textContent = 'Google 로그인 화면으로 이동...';
        try { await signInWithRedirect(auth, googleProvider); return; }
        catch(redirectError) { consumeRedirectFlag(); error = redirectError; }
      }
      showAuthNotice(friendlyAuthMessage(error, 'Google 로그인에 실패했습니다.'), 'error');
      btn.disabled = false;
      btn.textContent = 'Google로 계속하기';
    }
  };
  document.getElementById('email-form').onsubmit = async e => { e.preventDefault(); await signUpEmail(box); };
  document.getElementById('login-btn').onclick = async () => signInEmail(box);
}

async function signUpEmail(box){
  const email = document.getElementById('auth-email').value.trim(); const pw = document.getElementById('auth-password').value;
  if(!validEmail(email)) return showAuthNotice('이메일 형식을 확인해주세요.', 'error');
  try{
    const r = await createUserWithEmailAndPassword(auth, email, pw);
    await sendEmailVerification(r.user);
    showAuthNotice('인증 메일을 보냈습니다.', 'success');
    drawEmailVerification(box, r.user);
  }
  catch(error){ console.warn('email signup failed', error?.code || error); showAuthNotice(friendlyAuthMessage(error, '가입 처리에 실패했습니다.'), 'error'); }
}

async function signInEmail(box){
  const email = document.getElementById('auth-email').value.trim(); const pw = document.getElementById('auth-password').value;
  if(!validEmail(email)) return showAuthNotice('이메일 형식을 확인해주세요.', 'error');
  try{
    const r = await signInWithEmailAndPassword(auth, email, pw);
    if(needsEmailVerification(r.user)){
      showAuthNotice('이메일 인증을 완료해주세요.', 'error');
      drawEmailVerification(box, r.user);
      return;
    }
    const p = await profileOf(r.user);
    showAuthNotice('로그인 완료', 'success');
    p.nickname ? drawProfile(box, r.user, p) : drawNick(box, r.user, p);
  }
  catch(error){ console.warn('email login failed', error?.code || error); showAuthNotice(friendlyAuthMessage(error, '이메일 또는 비밀번호를 확인해주세요.'), 'error'); }
}

function drawEmailVerification(box, user){
  box.innerHTML = `<div style="text-align:center;margin-bottom:22px;"><div style="font-size:44px;margin-bottom:10px;">✉️</div><div style="font-family:var(--font-serif);font-size:21px;font-weight:700;color:var(--gold);">이메일 인증이 필요합니다</div><div style="font-size:13px;color:var(--cream-dim);line-height:1.8;margin-top:10px;"><strong>${escapeHtml(user.email || '')}</strong> 주소로 전송된 인증 링크를 눌러주세요.<br>인증 전에는 사건 접수와 AI 판결을 이용할 수 없습니다.</div></div><button class="btn btn-primary" id="verify-refresh">인증 완료 확인</button><button class="btn btn-secondary" id="verify-resend" style="margin-top:10px;">인증 메일 다시 보내기</button><button class="btn btn-ghost" id="logout" style="margin-top:10px;">다른 계정으로 로그인</button>`;
  document.getElementById('verify-refresh').onclick = async () => {
    try{
      await reload(user);
      if(!user.emailVerified) return showAuthNotice('아직 인증되지 않았습니다. 메일의 링크를 확인해주세요.', 'error');
      await user.getIdToken(true);
      showAuthNotice('이메일 인증이 확인되었습니다.', 'success');
      const p = await profileOf(user);
      p.nickname ? drawProfile(box, user, p) : drawNick(box, user, p);
    }catch(error){
      console.warn('email verification refresh failed', error?.code || error);
      showAuthNotice('인증 상태 확인에 실패했습니다.', 'error');
    }
  };
  document.getElementById('verify-resend').onclick = async () => {
    const button = document.getElementById('verify-resend');
    if(!button || button.disabled) return;
    button.disabled = true;
    try{
      await sendEmailVerification(user);
      showAuthNotice('인증 메일을 다시 보냈습니다.', 'success');
    }catch(error){
      console.warn('email verification resend failed', error?.code || error);
      showAuthNotice(friendlyAuthMessage(error, '인증 메일 전송에 실패했습니다.'), 'error');
    }finally{
      setTimeout(() => { if(button) button.disabled = false; }, 5000);
    }
  };
  document.getElementById('logout').onclick = logout;
}

function drawNick(box, user, profile = {}){
  const now = cleanNick(profile.nickname || user.displayName || '');
  box.innerHTML = `<div style="text-align:center;margin-bottom:22px;"><div style="margin-bottom:10px;">${avatarImg(user, {...profile, nickname: now}, 72)}</div><div class="auth-status">● 로그인됨</div><div style="font-family:var(--font-serif);font-size:21px;font-weight:700;color:var(--gold);">닉네임 설정</div></div><form id="nick-form"><div class="form-group"><label class="form-label">닉네임</label><div class="auth-inline-field"><input id="nickname" class="form-input" maxlength="20" value="${escapeHtml(now)}" placeholder="예: 억울한라면러버"><button type="button" class="btn btn-secondary" id="check-nick">중복확인</button></div><div id="nick-status" class="auth-help">한글, 영문, 숫자, 밑줄 2~20자</div></div><button class="btn btn-primary" id="save-nick" disabled>닉네임 저장</button></form><button class="btn btn-ghost" id="logout" style="margin-top:10px;">로그아웃</button>`;
  let ok = false, checked = ''; const input = document.getElementById('nickname'), save = document.getElementById('save-nick'), status = document.getElementById('nick-status');
  input.oninput = () => { ok = false; checked = ''; save.disabled = true; status.textContent = '중복 확인이 필요합니다.'; status.style.color = 'var(--cream-dim)'; };
  document.getElementById('check-nick').onclick = async () => { const n = cleanNick(input.value); input.value = n; const err = nickError(n); if(err) return showAuthNotice(err, 'error'); try{ const r = await checkNickname({ nickname: n }); ok = !!r.data?.available; checked = n; status.textContent = ok ? '사용 가능한 닉네임입니다.' : '이미 사용 중인 닉네임입니다.'; status.style.color = ok ? 'var(--green)' : 'var(--red)'; save.disabled = !ok; }catch(error){ console.warn('nickname check failed', error?.code || error); showAuthNotice('닉네임 확인에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error'); } };
  document.getElementById('nick-form').onsubmit = async e => { e.preventDefault(); const n = cleanNick(input.value); if(!ok || n !== checked) return showAuthNotice('닉네임 중복 확인을 먼저 해주세요.', 'error'); try{ await setNickname({ nickname: n, photoURL: user.photoURL || '' }); await updateProfile(user, { displayName: n }).catch(() => {}); showAuthNotice('닉네임이 저장되었습니다.', 'success'); drawProfile(box, user, await profileOf(user)); }catch(error){ console.warn('nickname save failed', error?.code || error); showAuthNotice('닉네임 저장에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error'); } };
  document.getElementById('logout').onclick = logout;
}

function drawProfile(box, user, profile = {}){
  const nick = cleanNick(profile.nickname || user.displayName || '닉네임미설정');
  box.innerHTML = `<div style="text-align:center;margin-bottom:20px;"><div style="margin-bottom:10px;">${avatarImg(user, profile, 88)}</div><div class="auth-status">● 로그인됨</div><div style="font-family:var(--font-serif);font-size:23px;font-weight:800;color:var(--gold);">${escapeHtml(nick)}</div><div style="font-size:13px;color:var(--cream-dim);margin-top:6px;line-height:1.7;">${escapeHtml(user.email || profile.email || '이메일 정보 없음')}<br>${escapeHtml(providerName(user, profile))}</div></div><div class="card auth-profile-state"><div style="font-weight:900;color:var(--gold);margin-bottom:8px;">내 프로필 상태</div><div class="auth-profile-grid"><div>로그인 상태</div><div class="auth-online">접속 중</div><div>프로필 아이콘</div><div>${escapeHtml(avatarSourceLabel(user, profile))}</div><div>닉네임</div><div>${escapeHtml(nick)}</div></div></div><button class="btn btn-secondary" id="change-nick">닉네임 변경</button><a href="#/my-cases" class="btn btn-primary" style="margin-top:10px;">내 사건 보기</a><a href="#/submit" class="btn btn-ghost" style="margin-top:10px;">새 사건 접수하기</a><button class="btn btn-ghost" id="logout" style="margin-top:10px;">로그아웃</button>`;
  document.getElementById('change-nick').onclick = () => drawNick(box, user, profile);
  document.getElementById('logout').onclick = logout;
}

async function logout(){ await signOut(auth); await guest(); showAuthNotice('로그아웃되었습니다.', 'success'); location.hash = '#/'; }
