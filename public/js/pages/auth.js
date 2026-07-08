import { auth, db, functions } from '../firebase.js?v=20260630-3';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, updateProfile, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { showToast } from '../components/toast.js?v=20260630-3';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';
import { avatarImg, avatarSourceLabel } from '../utils/avatar.js?v=20260630-3';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
const checkNickname = httpsCallable(functions, 'checkNickname');
const setNickname = httpsCallable(functions, 'setNickname');

function cleanNick(v){ return String(v || '').replace(/\s+/g, '').trim().slice(0, 20); }
function nickError(v){ const n = cleanNick(v); if(n.length < 2) return '닉네임은 2자 이상 입력해주세요.'; if(!/^[가-힣a-zA-Z0-9_]+$/.test(n)) return '한글, 영문, 숫자, 밑줄만 사용할 수 있습니다.'; return ''; }
function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim()); }
function userEmail(user){ return String(user?.email || '').trim().toLowerCase(); }
async function isAdminUser(user){
  if(!user || user.isAnonymous) return false;
  const byUid = await getDoc(doc(db, 'admins', user.uid)).catch(() => null);
  if(byUid?.exists()) return true;
  const email = userEmail(user);
  if(!email) return false;
  const byEmail = await getDoc(doc(db, 'admins', email)).catch(() => null);
  return !!byEmail?.exists();
}
async function goAdmin(user){ if(await isAdminUser(user)){ location.href = '/admin'; return true; } return false; }
async function profileOf(user){ if(!user || user.isAnonymous) return {}; const s = await getDoc(doc(db, 'users', user.uid)).catch(() => null); return s?.exists() ? s.data() : {}; }
async function guest(){ if(!auth.currentUser) await signInAnonymously(auth).catch(() => {}); }
function providerName(user, profile){ const p = profile.provider || user.providerData?.[0]?.providerId || ''; return p.includes('google') ? 'Google 소셜 로그인' : p.includes('password') ? '이메일 로그인' : '로그인'; }
function popupNeedsRedirect(e){ return ['auth/popup-blocked','auth/popup-closed-by-user','auth/cancelled-popup-request','auth/operation-not-supported-in-this-environment'].includes(e?.code); }

export async function renderAuth(container){
  container.innerHTML = `<div><div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">내 계정</span></div><div class="container" style="padding-top:24px;padding-bottom:90px;"><div id="auth-box" class="card" style="padding:22px;"><div class="loading-dots"><span></span><span></span><span></span></div></div></div></div>`;
  const box = document.getElementById('auth-box');
  getRedirectResult(auth).then(async r => {
    if(!r?.user) return;
    if(await goAdmin(r.user)) return;
    const p = await profileOf(r.user);
    showToast('구글 로그인 완료', 'success');
    p.nickname ? drawProfile(box, r.user, p) : drawNick(box, r.user, p);
  }).catch(e => console.warn('redirect login result skipped', e));
  const unsub = onAuthStateChanged(auth, async user => {
    if(!box) return;
    if(user && !user.isAnonymous){ if(await goAdmin(user)) return; const p = await profileOf(user); p.nickname ? drawProfile(box, user, p) : drawNick(box, user, p); }
    else drawLogin(box);
  });
  window._pageCleanup = unsub;
}

function drawLogin(box){
  box.innerHTML = `<div style="text-align:center;margin-bottom:22px;"><div style="font-size:46px;margin-bottom:8px;">⚖️</div><div style="font-family:var(--font-serif);font-size:21px;font-weight:700;color:var(--gold);">소소킹 계정</div><div style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-top:8px;">로그인하면 닉네임, 프로필 아이콘, 내 황당사건 기록이 표시됩니다.</div></div><button class="btn btn-secondary" id="google-login" style="margin-bottom:18px;">Google로 계속하기</button><div style="display:flex;align-items:center;gap:10px;margin:20px 0;color:var(--cream-dim);font-size:12px;"><div style="height:1px;background:var(--border);flex:1;"></div><span>또는 이메일</span><div style="height:1px;background:var(--border);flex:1;"></div></div><form id="email-form"><div class="form-group"><label class="form-label">이메일</label><input type="email" id="auth-email" class="form-input" required></div><div class="form-group"><label class="form-label">비밀번호</label><input type="password" id="auth-password" class="form-input" minlength="6" maxlength="30" required></div><button type="submit" class="btn btn-primary" id="signup-btn">가입하기</button><button type="button" class="btn btn-ghost" id="login-btn" style="margin-top:10px;">이미 계정이 있어요 · 로그인</button></form>`;
  document.getElementById('google-login').onclick = async () => {
    const btn = document.getElementById('google-login'); btn.disabled = true; btn.textContent = 'Google 로그인 중...';
    try { const r = await signInWithPopup(auth, googleProvider); if(await goAdmin(r.user)) return; const p = await profileOf(r.user); showToast('구글 로그인 완료', 'success'); p.nickname ? drawProfile(box, r.user, p) : drawNick(box, r.user, p); }
    catch(e){
      console.error(e);
      if(popupNeedsRedirect(e)) { btn.textContent = 'Google 로그인 화면으로 이동...'; await signInWithRedirect(auth, googleProvider); return; }
      showToast(e.message || '구글 로그인 실패', 'error'); btn.disabled = false; btn.textContent = 'Google로 계속하기';
    }
  };
  document.getElementById('email-form').onsubmit = async e => { e.preventDefault(); await signUpEmail(box); };
  document.getElementById('login-btn').onclick = async () => signInEmail(box);
}

async function signUpEmail(box){
  const email = document.getElementById('auth-email').value.trim(); const pw = document.getElementById('auth-password').value;
  if(!validEmail(email)) return showToast('이메일 형식을 확인해주세요.', 'error');
  try{ const r = await createUserWithEmailAndPassword(auth, email, pw); if(await goAdmin(r.user)) return; showToast('가입 완료. 닉네임을 설정해주세요.', 'success'); drawNick(box, r.user, await profileOf(r.user)); }
  catch(e){ console.error(e); showToast(e.code === 'auth/email-already-in-use' ? '이미 가입된 이메일입니다.' : e.message || '가입 실패', 'error'); }
}
async function signInEmail(box){
  const email = document.getElementById('auth-email').value.trim(); const pw = document.getElementById('auth-password').value;
  if(!validEmail(email)) return showToast('이메일 형식을 확인해주세요.', 'error');
  try{ const r = await signInWithEmailAndPassword(auth, email, pw); if(await goAdmin(r.user)) return; const p = await profileOf(r.user); showToast('로그인 완료', 'success'); p.nickname ? drawProfile(box, r.user, p) : drawNick(box, r.user, p); }
  catch(e){ console.error(e); showToast('이메일 또는 비밀번호를 확인해주세요.', 'error'); }
}

function drawNick(box, user, profile = {}){
  const now = cleanNick(profile.nickname || user.displayName || '');
  box.innerHTML = `<div style="text-align:center;margin-bottom:22px;"><div style="margin-bottom:10px;">${avatarImg(user, {...profile, nickname: now}, 72)}</div><div style="display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;background:rgba(39,174,96,.13);border:1px solid rgba(39,174,96,.35);color:#27ae60;font-size:12px;font-weight:800;margin-bottom:10px;">● 로그인됨</div><div style="font-family:var(--font-serif);font-size:21px;font-weight:700;color:var(--gold);">닉네임 설정</div></div><form id="nick-form"><div class="form-group"><label class="form-label">닉네임</label><div style="display:flex;gap:8px;"><input id="nickname" class="form-input" maxlength="20" value="${escapeHtml(now)}" placeholder="예: 억울한라면러버" style="flex:1;"><button type="button" class="btn btn-secondary" id="check-nick" style="width:112px;padding-left:0;padding-right:0;">중복확인</button></div><div id="nick-status" style="font-size:12px;color:var(--cream-dim);margin-top:8px;">한글, 영문, 숫자, 밑줄 2~20자</div></div><button class="btn btn-primary" id="save-nick" disabled>닉네임 저장</button></form><button class="btn btn-ghost" id="logout" style="margin-top:10px;">로그아웃</button>`;
  let ok = false, checked = ''; const input = document.getElementById('nickname'), save = document.getElementById('save-nick'), status = document.getElementById('nick-status');
  input.oninput = () => { ok = false; checked = ''; save.disabled = true; status.textContent = '중복 확인이 필요합니다.'; status.style.color = 'var(--cream-dim)'; };
  document.getElementById('check-nick').onclick = async () => { const n = cleanNick(input.value); input.value = n; const err = nickError(n); if(err) return showToast(err, 'error'); try{ const r = await checkNickname({ nickname: n }); ok = !!r.data?.available; checked = n; status.textContent = ok ? '사용 가능한 닉네임입니다.' : '이미 사용 중인 닉네임입니다.'; status.style.color = ok ? '#27ae60' : '#e74c3c'; save.disabled = !ok; }catch(e){ showToast(e.message || '중복 확인 실패', 'error'); } };
  document.getElementById('nick-form').onsubmit = async e => { e.preventDefault(); const n = cleanNick(input.value); if(!ok || n !== checked) return showToast('닉네임 중복 확인을 먼저 해주세요.', 'error'); try{ await setNickname({ nickname: n, photoURL: user.photoURL || '' }); await updateProfile(user, { displayName: n }).catch(() => {}); showToast('닉네임이 저장되었습니다.', 'success'); drawProfile(box, user, await profileOf(user)); }catch(err){ showToast(err.message || '닉네임 저장 실패', 'error'); } };
  document.getElementById('logout').onclick = logout;
}

function drawProfile(box, user, profile = {}){
  const nick = cleanNick(profile.nickname || user.displayName || '닉네임미설정');
  box.innerHTML = `<div style="text-align:center;margin-bottom:20px;"><div style="margin-bottom:10px;">${avatarImg(user, profile, 88)}</div><div style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;background:rgba(39,174,96,.13);border:1px solid rgba(39,174,96,.35);color:#27ae60;font-size:12px;font-weight:900;margin-bottom:10px;">● 로그인됨</div><div style="font-family:var(--font-serif);font-size:23px;font-weight:800;color:var(--gold);">${escapeHtml(nick)}</div><div style="font-size:13px;color:var(--cream-dim);margin-top:6px;line-height:1.7;">${escapeHtml(user.email || profile.email || '이메일 정보 없음')}<br>${escapeHtml(providerName(user, profile))}</div></div><div class="card" style="padding:15px;margin-bottom:14px;background:rgba(255,255,255,.025);"><div style="font-weight:900;color:var(--gold);margin-bottom:8px;">내 프로필 상태</div><div style="display:grid;grid-template-columns:92px 1fr;gap:8px;font-size:13px;color:var(--cream-dim);line-height:1.7;"><div>로그인 상태</div><div style="color:#27ae60;font-weight:800;">접속 중</div><div>프로필 아이콘</div><div>${escapeHtml(avatarSourceLabel(user, profile))}</div><div>닉네임</div><div>${escapeHtml(nick)}</div></div></div><button class="btn btn-secondary" id="change-nick">닉네임 변경</button><a href="#/my-cases" class="btn btn-primary" style="margin-top:10px;">내 사건 보기</a><a href="#/submit" class="btn btn-ghost" style="margin-top:10px;">새 황당사건 접수하기</a><button class="btn btn-ghost" id="logout" style="margin-top:10px;">로그아웃</button>`;
  document.getElementById('change-nick').onclick = () => drawNick(box, user, profile);
  document.getElementById('logout').onclick = logout;
}

async function logout(){ await signOut(auth); await guest(); showToast('로그아웃되었습니다.', 'success'); location.hash = '#/'; }
