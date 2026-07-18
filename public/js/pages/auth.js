import { auth, db, functions, storage } from '../firebase.js?v=20260708-1';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, updateProfile, onAuthStateChanged, signInAnonymously, sendEmailVerification, reload } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-storage.js';
import { showToast } from '../components/toast.js?v=20260630-3';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';
import { avatarImg, avatarSourceLabel, generatedAvatarUrl, AVATAR_PRESETS } from '../utils/avatar.js?v=20260708-2';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
const checkNickname = httpsCallable(functions, 'checkNickname');
const setNickname = httpsCallable(functions, 'setNickname');

function cleanNick(v){ return String(v || '').replace(/\s+/g, '').trim().slice(0, 20); }
function nickError(v){ const n = cleanNick(v); if(n.length < 2) return '닉네임은 2자 이상 입력해주세요.'; if(!/^[가-힣a-zA-Z0-9_]+$/.test(n)) return '한글, 영문, 숫자, 밑줄만 사용할 수 있습니다.'; return ''; }
function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim()); }
function userEmail(user){ return String(user?.email || '').trim().toLowerCase(); }
function httpsUrl(v){ const url = String(v || '').trim(); return /^https:\/\//.test(url) ? url : ''; }
function googlePhotoUrl(user, profile = {}){ return httpsUrl(user?.photoURL) || (profile.avatarType === 'google' ? httpsUrl(profile.photoURL) : ''); }
function uploadPhotoUrl(profile = {}){ return profile.avatarType === 'upload' ? httpsUrl(profile.photoURL) : ''; }
function currentAvatarType(user, profile = {}) { if (profile.avatarType === 'upload' && uploadPhotoUrl(profile)) return 'upload'; if (profile.avatarType === 'generated') return 'generated'; return googlePhotoUrl(user, profile) ? 'google' : 'generated'; }
function isPasswordUser(user){ return !!user?.providerData?.some(item => item.providerId === 'password'); }
async function isVerifiedUser(user){ if(!user || user.isAnonymous) return false; await reload(user).catch(() => {}); return !isPasswordUser(user) || user.emailVerified === true; }
async function isAdminUser(user){
  if(!user || user.isAnonymous) return false;
  const byUid = await getDoc(doc(db, 'admins', user.uid)).catch(() => null);
  if(byUid?.exists()) return true;
  const email = userEmail(user);
  if(!email || user.emailVerified !== true) return false;
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
    p.nickname ? drawProfile(box, r.user, p) : drawEditProfile(box, r.user, p);
  }).catch(e => console.warn('redirect login result skipped', e));
  const unsub = onAuthStateChanged(auth, async user => {
    if(!box) return;
    if(user && !user.isAnonymous){
      if(!(await isVerifiedUser(user))){ drawVerificationRequired(box, user); return; }
      if(await goAdmin(user)) return;
      const p = await profileOf(user);
      p.nickname ? drawProfile(box, user, p) : drawEditProfile(box, user, p);
    } else drawLogin(box);
  });
  window._pageCleanup = unsub;
}

function drawLogin(box){
  box.innerHTML = `<div style="text-align:center;margin-bottom:22px;"><div style="font-size:46px;margin-bottom:8px;">⚖️</div><div style="font-family:var(--font-serif);font-size:21px;font-weight:700;color:var(--gold);">소소킹 계정</div><div style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-top:8px;">로그인하면 닉네임, 프로필 사진, 내 황당사건 기록이 표시됩니다.<br>이메일 가입은 인증 완료 후 이용할 수 있습니다.</div></div><button class="btn btn-secondary" id="google-login" style="margin-bottom:18px;">Google로 계속하기</button><div style="display:flex;align-items:center;gap:10px;margin:20px 0;color:var(--cream-dim);font-size:12px;"><div style="height:1px;background:var(--border);flex:1;"></div><span>또는 이메일</span><div style="height:1px;background:var(--border);flex:1;"></div></div><form id="email-form"><div class="form-group"><label class="form-label">이메일</label><input type="email" id="auth-email" class="form-input" required></div><div class="form-group"><label class="form-label">비밀번호</label><input type="password" id="auth-password" class="form-input" minlength="6" maxlength="30" required></div><button type="submit" class="btn btn-primary" id="signup-btn">가입하기</button><button type="button" class="btn btn-ghost" id="login-btn" style="margin-top:10px;">이미 계정이 있어요 · 로그인</button></form>`;
  document.getElementById('google-login').onclick = async () => {
    const btn = document.getElementById('google-login'); btn.disabled = true; btn.textContent = 'Google 로그인 중...';
    try { const r = await signInWithPopup(auth, googleProvider); if(await goAdmin(r.user)) return; const p = await profileOf(r.user); showToast('구글 로그인 완료', 'success'); p.nickname ? drawProfile(box, r.user, p) : drawEditProfile(box, r.user, p); }
    catch(e){
      console.error(e);
      if(popupNeedsRedirect(e)) { btn.textContent = 'Google 로그인 화면으로 이동...'; await signInWithRedirect(auth, googleProvider); return; }
      showToast(e.message || '구글 로그인 실패', 'error'); btn.disabled = false; btn.textContent = 'Google로 계속하기';
    }
  };
  document.getElementById('email-form').onsubmit = async e => { e.preventDefault(); await signUpEmail(box); };
  document.getElementById('login-btn').onclick = async () => signInEmail(box);
}

function drawVerificationRequired(box, user){
  box.innerHTML = `<div style="text-align:center;"><div style="font-size:46px;margin-bottom:10px;">📨</div><div style="font-family:var(--font-serif);font-size:21px;font-weight:800;color:var(--gold);margin-bottom:8px;">이메일 인증이 필요합니다</div><div style="font-size:13px;color:var(--cream-dim);line-height:1.75;margin-bottom:18px;">${escapeHtml(user.email || '')} 주소로 발송된 인증 메일의 링크를 누른 뒤 다시 로그인해주세요.<br>스팸함도 확인해주세요.</div><button class="btn btn-primary" id="resend-verification">인증 메일 다시 보내기</button><button class="btn btn-ghost" id="verification-logout" style="margin-top:10px;">다른 계정으로 로그인</button></div>`;
  document.getElementById('resend-verification').onclick = async () => {
    const button = document.getElementById('resend-verification');
    button.disabled = true;
    try { await sendEmailVerification(user); showToast('인증 메일을 다시 보냈습니다.', 'success'); }
    catch(error){ showToast(error.message || '인증 메일을 보내지 못했습니다.', 'error'); }
    finally { button.disabled = false; }
  };
  document.getElementById('verification-logout').onclick = logout;
}

async function signUpEmail(box){
  const email = document.getElementById('auth-email').value.trim(); const pw = document.getElementById('auth-password').value;
  if(!validEmail(email)) return showToast('이메일 형식을 확인해주세요.', 'error');
  try{
    const r = await createUserWithEmailAndPassword(auth, email, pw);
    await sendEmailVerification(r.user);
    showToast('가입되었습니다. 인증 메일의 링크를 누른 뒤 로그인해주세요.', 'success');
    drawVerificationRequired(box, r.user);
  }
  catch(e){ console.error(e); showToast(e.code === 'auth/email-already-in-use' ? '이미 가입된 이메일입니다.' : e.message || '가입 실패', 'error'); }
}
async function signInEmail(box){
  const email = document.getElementById('auth-email').value.trim(); const pw = document.getElementById('auth-password').value;
  if(!validEmail(email)) return showToast('이메일 형식을 확인해주세요.', 'error');
  try{
    const r = await signInWithEmailAndPassword(auth, email, pw);
    if(!(await isVerifiedUser(r.user))){ drawVerificationRequired(box, r.user); return; }
    if(await goAdmin(r.user)) return;
    const p = await profileOf(r.user);
    showToast('로그인 완료', 'success');
    p.nickname ? drawProfile(box, r.user, p) : drawEditProfile(box, r.user, p);
  }
  catch(e){ console.error(e); showToast('이메일 또는 비밀번호를 확인해주세요.', 'error'); }
}

function avatarChoiceButton(type, seed, icon, src, label, active) {
  return `<button type="button" class="avatar-choice ${active ? 'active' : ''}" data-avatar-type="${escapeHtml(type)}" data-avatar-seed="${escapeHtml(seed || '')}" data-avatar-icon="${escapeHtml(icon || '')}" aria-label="${escapeHtml(label)}" style="width:52px;height:52px;border-radius:999px;border:2px solid ${active ? 'rgba(232,201,122,.9)' : 'var(--border)'};background:${active ? 'rgba(201,168,76,.14)' : 'rgba(255,255,255,.035)'};padding:3px;cursor:pointer;box-shadow:${active ? '0 0 0 3px rgba(201,168,76,.18)' : 'none'};"><img src="${escapeHtml(src)}" alt="${escapeHtml(label)}" style="width:100%;height:100%;border-radius:999px;object-fit:cover;display:block;" referrerpolicy="no-referrer"></button>`;
}
function uploadChoiceButton(active) {
  return `<label class="avatar-upload-choice ${active ? 'active' : ''}" style="width:52px;height:52px;border-radius:999px;border:2px dashed ${active ? 'rgba(232,201,122,.95)' : 'var(--border)'};background:${active ? 'rgba(201,168,76,.14)' : 'rgba(255,255,255,.035)'};display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;box-shadow:${active ? '0 0 0 3px rgba(201,168,76,.18)' : 'none'};" title="직접 등록"><span>📷</span><input type="file" id="avatar-file" accept="image/jpeg,image/png,image/webp" style="display:none;"></label>`;
}
function avatarChoiceHtml(user, profile, nickname, selectedType, selectedSeed) {
  const email = profile.email || user?.email || '';
  const google = googlePhotoUrl(user, profile);
  const uploaded = uploadPhotoUrl(profile);
  const items = [];
  if (google) items.push(avatarChoiceButton('google', '', '', google, '소셜 로그인 프로필 사진', selectedType === 'google'));
  if (uploaded) items.push(avatarChoiceButton('upload', '', '', uploaded, '직접 등록한 프로필 사진', selectedType === 'upload'));
  items.push(uploadChoiceButton(selectedType === 'upload' && !uploaded));
  AVATAR_PRESETS.forEach(p => {
    items.push(avatarChoiceButton('generated', p.seed, p.icon, generatedAvatarUrl(nickname, email, p.seed, p.icon), p.label, selectedType === 'generated' && selectedSeed === p.seed));
  });
  return items.join('');
}
function resizeProfileImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) return reject(new Error('JPG, PNG, WEBP 이미지만 등록할 수 있습니다.'));
    if (file.size > 5 * 1024 * 1024) return reject(new Error('이미지는 5MB 이하만 등록할 수 있습니다.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('이미지를 처리하지 못했습니다.'));
      img.onload = () => {
        const max = 512;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#101522';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('이미지를 변환하지 못했습니다.')), 'image/jpeg', 0.86);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
async function uploadProfilePhoto(user, blob) {
  const fileRef = ref(storage, `profile-photos/${user.uid}/avatar.jpg`);
  await uploadBytes(fileRef, blob, { contentType: 'image/jpeg', cacheControl: 'public,max-age=300' });
  return await getDownloadURL(fileRef);
}

function drawEditProfile(box, user, profile = {}){
  const savedNick = cleanNick(profile.nickname || '');
  const now = cleanNick(profile.nickname || user.displayName || '');
  let selectedAvatarType = currentAvatarType(user, profile);
  let selectedAvatarSeed = profile.avatarSeed || AVATAR_PRESETS[0].seed;
  let selectedAvatarIcon = profile.avatarIcon || AVATAR_PRESETS.find(p => p.seed === selectedAvatarSeed)?.icon || AVATAR_PRESETS[0].icon;
  let selectedUploadBlob = null;
  let selectedUploadPreview = uploadPhotoUrl(profile);
  if (selectedAvatarType === 'generated' && !AVATAR_PRESETS.some(p => p.seed === selectedAvatarSeed)) {
    selectedAvatarSeed = AVATAR_PRESETS[0].seed;
    selectedAvatarIcon = AVATAR_PRESETS[0].icon;
  }
  const currentProfileForPreview = () => {
    const nickname = cleanNick(document.getElementById('nickname')?.value || now) || now;
    if (selectedAvatarType === 'upload') return { ...profile, nickname, avatarType: 'upload', photoURL: selectedUploadPreview || uploadPhotoUrl(profile) };
    if (selectedAvatarType === 'google') return { ...profile, nickname, avatarType: 'google', photoURL: googlePhotoUrl(user, profile) };
    return { ...profile, nickname, avatarType: 'generated', avatarSeed: selectedAvatarSeed, avatarIcon: selectedAvatarIcon, photoURL: '' };
  };
  const initialProfile = currentProfileForPreview();
  box.innerHTML = `<div style="text-align:center;margin-bottom:22px;"><div id="profile-preview" style="margin-bottom:10px;">${avatarImg(user, initialProfile, 78)}</div><div style="display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;background:rgba(39,174,96,.13);border:1px solid rgba(39,174,96,.35);color:#27ae60;font-size:12px;font-weight:800;margin-bottom:10px;">● 로그인됨</div><div style="font-family:var(--font-serif);font-size:21px;font-weight:700;color:var(--gold);">${savedNick ? '내 정보 변경' : '내 정보 설정'}</div></div><form id="profile-form"><div class="form-group"><label class="form-label">프로필 사진</label><div id="avatar-choice-wrap" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:8px 0 10px;max-height:190px;overflow:auto;padding:6px 2px;">${avatarChoiceHtml(user, profile, now, selectedAvatarType, selectedAvatarSeed)}</div><div style="font-size:12px;color:var(--cream-dim);line-height:1.6;text-align:center;">소셜 사진, 직접 등록, 동물·사물 아이콘 중에서 선택할 수 있습니다.</div></div><div class="form-group"><label class="form-label">닉네임</label><div style="display:flex;gap:8px;"><input id="nickname" class="form-input" maxlength="20" value="${escapeHtml(now)}" placeholder="예: 억울한라면러버" style="flex:1;"><button type="button" class="btn btn-secondary" id="check-nick" style="width:112px;padding-left:0;padding-right:0;">중복확인</button></div><div id="nick-status" style="font-size:12px;color:var(--cream-dim);margin-top:8px;">${savedNick ? '닉네임을 바꿀 때만 중복 확인이 필요합니다.' : '한글, 영문, 숫자, 밑줄 2~20자'}</div></div><button class="btn btn-primary" id="save-profile" ${savedNick ? '' : 'disabled'}>내 정보 저장</button></form><button class="btn btn-ghost" id="logout" style="margin-top:10px;">로그아웃</button>`;
  let ok = !!savedNick, checked = savedNick;
  const input = document.getElementById('nickname'), save = document.getElementById('save-profile'), status = document.getElementById('nick-status'), preview = document.getElementById('profile-preview');
  const refreshPreview = () => { preview.innerHTML = avatarImg(user, currentProfileForPreview(), 78); };
  const markActive = target => {
    document.querySelectorAll('.avatar-choice,.avatar-upload-choice').forEach(el => {
      const active = el === target;
      el.classList.toggle('active', active);
      el.style.borderColor = active ? 'rgba(232,201,122,.9)' : 'var(--border)';
      el.style.background = active ? 'rgba(201,168,76,.14)' : 'rgba(255,255,255,.035)';
      el.style.boxShadow = active ? '0 0 0 3px rgba(201,168,76,.18)' : 'none';
    });
  };
  document.querySelectorAll('.avatar-choice').forEach(btn => btn.onclick = () => {
    selectedAvatarType = btn.dataset.avatarType || 'generated';
    selectedAvatarSeed = btn.dataset.avatarSeed || selectedAvatarSeed || AVATAR_PRESETS[0].seed;
    selectedAvatarIcon = btn.dataset.avatarIcon || selectedAvatarIcon || AVATAR_PRESETS[0].icon;
    if (selectedAvatarType !== 'upload') selectedUploadBlob = null;
    markActive(btn);
    refreshPreview();
    if (savedNick) save.disabled = false;
  });
  const fileInput = document.getElementById('avatar-file');
  if (fileInput) fileInput.onchange = async () => {
    try {
      const file = fileInput.files?.[0];
      if (!file) return;
      selectedUploadBlob = await resizeProfileImage(file);
      if (selectedUploadPreview && selectedUploadPreview.startsWith('blob:')) URL.revokeObjectURL(selectedUploadPreview);
      selectedUploadPreview = URL.createObjectURL(selectedUploadBlob);
      selectedAvatarType = 'upload';
      markActive(document.querySelector('.avatar-upload-choice'));
      refreshPreview();
      if (savedNick) save.disabled = false;
      showToast('프로필 사진이 선택되었습니다. 저장을 눌러 반영하세요.', 'success');
    } catch (err) {
      showToast(err.message || '이미지 선택 실패', 'error');
    }
  };
  input.oninput = () => {
    const n = cleanNick(input.value);
    refreshPreview();
    if (savedNick && n === savedNick) { ok = true; checked = savedNick; save.disabled = false; status.textContent = '기존 닉네임을 그대로 사용합니다.'; status.style.color = 'var(--cream-dim)'; return; }
    ok = false; checked = ''; save.disabled = true; status.textContent = '닉네임 중복 확인이 필요합니다.'; status.style.color = 'var(--cream-dim)';
  };
  document.getElementById('check-nick').onclick = async () => { const n = cleanNick(input.value); input.value = n; const err = nickError(n); if(err) return showToast(err, 'error'); if(savedNick && n === savedNick){ ok = true; checked = n; save.disabled = false; status.textContent = '기존 닉네임을 그대로 사용합니다.'; status.style.color = '#27ae60'; return; } try{ const r = await checkNickname({ nickname: n }); ok = !!r.data?.available; checked = n; status.textContent = ok ? '사용 가능한 닉네임입니다.' : '이미 사용 중인 닉네임입니다.'; status.style.color = ok ? '#27ae60' : '#e74c3c'; save.disabled = !ok; }catch(e){ showToast(e.message || '중복 확인 실패', 'error'); } };
  document.getElementById('profile-form').onsubmit = async e => {
    e.preventDefault();
    const n = cleanNick(input.value);
    if (!n) return showToast('닉네임을 입력해주세요.', 'error');
    if(!ok || n !== checked) return showToast('닉네임 중복 확인을 먼저 해주세요.', 'error');
    try{
      save.disabled = true;
      save.textContent = '저장 중...';
      let photoURL = '';
      if (selectedAvatarType === 'upload') {
        photoURL = selectedUploadBlob ? await uploadProfilePhoto(user, selectedUploadBlob) : uploadPhotoUrl(profile);
        if (!photoURL) throw new Error('등록할 프로필 사진을 선택해주세요.');
      } else if (selectedAvatarType === 'google') {
        photoURL = googlePhotoUrl(user, profile);
      }
      await setNickname({ nickname: n, photoURL, avatarType: selectedAvatarType, avatarSeed: selectedAvatarSeed, avatarIcon: selectedAvatarIcon });
      await updateProfile(user, { displayName: n }).catch(() => {});
      showToast('내 정보가 저장되었습니다.', 'success');
      drawProfile(box, user, await profileOf(user));
    }catch(err){
      save.disabled = false;
      save.textContent = '내 정보 저장';
      showToast(err.message || '내 정보 저장 실패', 'error');
    }
  };
  document.getElementById('logout').onclick = logout;
}

function drawProfile(box, user, profile = {}){
  const nick = cleanNick(profile.nickname || user.displayName || '닉네임미설정');
  box.innerHTML = `<div style="text-align:center;margin-bottom:20px;"><div style="margin-bottom:10px;">${avatarImg(user, profile, 88)}</div><div style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;background:rgba(39,174,96,.13);border:1px solid rgba(39,174,96,.35);color:#27ae60;font-size:12px;font-weight:900;margin-bottom:10px;">● 로그인됨</div><div style="font-family:var(--font-serif);font-size:23px;font-weight:800;color:var(--gold);">${escapeHtml(nick)}</div><div style="font-size:13px;color:var(--cream-dim);margin-top:6px;line-height:1.7;">${escapeHtml(user.email || profile.email || '이메일 정보 없음')}<br>${escapeHtml(providerName(user, profile))}</div></div><div class="card" style="padding:15px;margin-bottom:14px;background:rgba(255,255,255,.025);"><div style="font-weight:900;color:var(--gold);margin-bottom:8px;">내 프로필 상태</div><div style="display:grid;grid-template-columns:92px 1fr;gap:8px;font-size:13px;color:var(--cream-dim);line-height:1.7;"><div>로그인 상태</div><div style="color:#27ae60;font-weight:800;">접속 중</div><div>프로필 사진</div><div>${escapeHtml(avatarSourceLabel(user, profile))}</div><div>닉네임</div><div>${escapeHtml(nick)}</div></div></div><button class="btn btn-secondary" id="change-profile">내 정보 변경</button><a href="#/my-cases" class="btn btn-primary" style="margin-top:10px;">내 사건 보기</a><a href="#/submit" class="btn btn-ghost" style="margin-top:10px;">새 황당사건 접수하기</a><button class="btn btn-ghost" id="logout" style="margin-top:10px;">로그아웃</button>`;
  document.getElementById('change-profile').onclick = () => drawEditProfile(box, user, profile);
  document.getElementById('logout').onclick = logout;
}

async function logout(){ await signOut(auth); await guest(); showToast('로그아웃되었습니다.', 'success'); location.hash = '#/'; }
