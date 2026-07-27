import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  writeBatch,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import {
  getFunctions,
  httpsCallable
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { firebaseConfig } from '../js/firebase-config.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, 'asia-northeast3');
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
const deleteCourtPost = httpsCallable(functions, 'deleteCourtPost');
const generateDailyAiNow = httpsCallable(functions, 'generateDailyAiNow');

let patchQueued = false;

function toast(message, type = 'info') {
  const host = document.getElementById('toast-container');
  if (!host) {
    alert(message);
    return;
  }
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  host.appendChild(item);
  setTimeout(() => item.remove(), 3200);
}

function isMobileLike() {
  return matchMedia('(max-width: 760px)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function readableAuthError(err) {
  const code = String(err?.code || '');
  if (code.includes('popup-closed-by-user')) return '로그인 창이 닫혔습니다.';
  if (code.includes('unauthorized-domain')) return 'Firebase 인증 도메인 설정을 확인해주세요.';
  if (code.includes('network-request-failed')) return '네트워크 연결을 확인해주세요.';
  if (code.includes('invalid-credential') || code.includes('wrong-password')) return '이메일 또는 비밀번호를 확인해주세요.';
  return String(err?.message || '로그인에 실패했습니다.').replace('FirebaseError: ', '');
}

async function startGoogleAdminLogin(button) {
  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = 'Google 로그인 준비 중...';

  try {
    if (isMobileLike()) {
      button.textContent = 'Google 로그인 화면으로 이동...';
      await signInWithRedirect(auth, provider);
      return;
    }

    await signInWithPopup(auth, provider);
  } catch (err) {
    const redirectCodes = new Set([
      'auth/popup-blocked',
      'auth/cancelled-popup-request',
      'auth/operation-not-supported-in-this-environment'
    ]);

    if (redirectCodes.has(err?.code)) {
      button.textContent = 'Google 로그인 화면으로 이동...';
      await signInWithRedirect(auth, provider);
      return;
    }

    console.error('admin Google login failed:', err);
    toast(readableAuthError(err), 'error');
    button.disabled = false;
    button.textContent = oldText;
  }
}

function patchLoginForm() {
  const google = document.getElementById('google-admin');
  if (google && google.dataset.enhanced !== 'true') {
    const replacement = google.cloneNode(true);
    replacement.dataset.enhanced = 'true';
    replacement.type = 'button';
    replacement.addEventListener('click', () => startGoogleAdminLogin(replacement));
    google.replaceWith(replacement);
  }

  const email = document.getElementById('em');
  const password = document.getElementById('pw');
  if (email) {
    email.autocomplete = 'username';
    email.inputMode = 'email';
    email.spellcheck = false;
  }
  if (password) password.autocomplete = 'current-password';
}

function patchNoAccess() {
  const root = document.getElementById('admin-content');
  if (!root || !root.textContent.includes('관리자 권한 없음')) return;
  const card = root.querySelector('.card');
  if (!card || document.getElementById('admin-access-detail')) return;

  const user = auth.currentUser;
  const detail = document.createElement('div');
  detail.id = 'admin-access-detail';
  detail.style.cssText = 'margin-top:14px;padding:12px 13px;border:1px solid rgba(201,168,76,.35);border-radius:10px;color:var(--cream-dim);font-size:12px;line-height:1.75;text-align:left;overflow-wrap:anywhere;';

  const heading = document.createElement('strong');
  heading.style.color = 'var(--gold)';
  heading.textContent = '로그인 계정 확인';
  const emailLine = document.createElement('div');
  emailLine.textContent = `이메일: ${String(user?.email || '없음')}`;
  const uidLine = document.createElement('div');
  uidLine.textContent = `UID: ${String(user?.uid || '없음')}`;
  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'admin-btn gold';
  copyButton.style.marginTop = '8px';
  copyButton.textContent = 'UID 복사';
  copyButton.addEventListener('click', async () => {
    await navigator.clipboard?.writeText(String(user?.uid || '')).catch(() => {});
    toast('관리자 UID를 복사했습니다.', 'success');
  });

  detail.append(heading, emailLine, uidLine, copyButton);
  card.appendChild(detail);
}

function installAdminActions() {
  if (!document.querySelector('.admin-shell')) return;

  window._recordPublic = async (caseId, isPublic) => {
    try {
      const caseRef = doc(db, 'cases', caseId);
      const resultRef = doc(db, 'results', caseId);
      const [caseSnap, resultSnap] = await Promise.all([
        getDoc(caseRef),
        getDoc(resultRef)
      ]);
      if (!caseSnap.exists() && !resultSnap.exists()) throw new Error('사건 기록을 찾을 수 없습니다.');

      const batch = writeBatch(db);
      if (resultSnap.exists()) {
        batch.update(resultRef, {
          isPublic: Boolean(isPublic),
          updatedAt: serverTimestamp()
        });
      }
      if (caseSnap.exists()) {
        batch.update(caseRef, {
          isPublic: Boolean(isPublic),
          updatedAt: serverTimestamp()
        });
      }
      await batch.commit();
      toast('공개 상태를 변경했습니다.', 'success');
      window._tab?.('records');
    } catch (err) {
      console.error('admin visibility update failed:', err);
      toast('공개 상태 변경에 실패했습니다.', 'error');
    }
  };

  window._delRecord = async caseId => {
    if (!confirm('이 사건과 연결된 판결문·투표·댓글·신고 기록까지 모두 삭제할까요?\n삭제 후 복구할 수 없습니다.')) return;
    try {
      const response = await deleteCourtPost({ caseId });
      toast(`완전 삭제 완료 · ${Number(response.data?.deleted || 0)}개 항목`, 'success');
      window._tab?.('records');
    } catch (err) {
      console.error('admin complete delete failed:', err);
      toast(String(err?.message || '삭제에 실패했습니다.').replace('FirebaseError: ', ''), 'error');
    }
  };
}

function patchStaleAdminCopy() {
  const prompt = document.getElementById('dailyPrompt');
  if (prompt && /원하는 판결|사건명은 30자/.test(prompt.value)) {
    prompt.value = '생활사건 내용을 바탕으로 알아보기 쉬운 사건명을 자동 생성하고, 사건접수·수사보고·원고측 변론·피고측 변론·재판부 판결의 다섯 문서를 실제 문서 형식처럼 작성한다. 문서 형식은 진지하게 유지하되 사건의 구체적인 사물과 행동에서 나온 웃음코드를 충분히 넣는다. 판사 성향을 문체와 판단에 반영하고, 개인정보·혐오·성적 내용·자해·실제 범죄의 상세 묘사는 피한다.';
  }

  const policy = document.getElementById('pc');
  if (policy && !policy.dataset.copyAudited) {
    policy.dataset.copyAudited = 'true';
    policy.value = policy.value
      .replace(/사건명·사건 경위·원하는 판결/g, '사건 경위·자동 생성된 사건명·판결문')
      .replace(/사건명·사건 경위/g, '사건 경위·자동 생성된 사건명')
      .replace(/접수계, 조사관, 원고 측, 피고 측, 판사 판결문, 생활형 처분/g, '사건접수, 수사보고, 원고측 변론, 피고측 변론, 재판부 판결');
  }
}

function injectDailyAiButton() {
  const content = document.getElementById('tab-content');
  if (!content || document.getElementById('daily-ai-now-box')) return;
  const text = content.textContent || '';
  if (!text.includes('AI 자동 사건') && !text.includes('자동 생성 주제 힌트')) return;

  const box = document.createElement('div');
  box.id = 'daily-ai-now-box';
  box.className = 'card';
  box.style.cssText = 'padding:16px;margin-bottom:14px;border-color:rgba(201,168,76,.45);';
  box.innerHTML = `
    <div style="font-weight:900;color:var(--gold);margin-bottom:7px;">🤖 오늘의 AI 판결기록 생성/복구</div>
    <div style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-bottom:12px;">오늘 날짜의 AI 사건을 즉시 생성하거나 비어 있는 판결기록을 복구합니다.</div>
    <button type="button" class="btn btn-primary" id="daily-ai-now-btn">오늘의 AI 판결기록 지금 생성</button>`;
  content.prepend(box);

  document.getElementById('daily-ai-now-btn')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = '생성 중...';
    try {
      const response = await generateDailyAiNow({ force: true });
      const caseId = response.data?.caseId || '';
      toast('오늘의 AI 판결기록을 생성했습니다.', 'success');
      if (caseId) setTimeout(() => { location.href = `/#/result/${encodeURIComponent(caseId)}`; }, 500);
    } catch (err) {
      console.error('daily AI generation failed:', err);
      toast(String(err?.message || '생성에 실패했습니다.').replace('FirebaseError: ', ''), 'error');
      button.disabled = false;
      button.textContent = '오늘의 AI 판결기록 지금 생성';
    }
  });
}

function improveAdminLayout() {
  if (document.getElementById('admin-audit-style')) return;
  const style = document.createElement('style');
  style.id = 'admin-audit-style';
  style.textContent = `
    .admin-header{padding-top:calc(14px + env(safe-area-inset-top,0px));}
    .admin-shell{overflow-x:hidden;}
    .admin-nav{scrollbar-width:none;-webkit-overflow-scrolling:touch;}
    .admin-nav::-webkit-scrollbar{display:none;}
    .admin-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--border);border-radius:12px;}
    .admin-table b{color:var(--cream)!important;}
    @media(max-width:760px){
      .admin-header{align-items:flex-start;gap:10px;}
      .admin-header>div{gap:6px!important;flex-wrap:wrap;justify-content:flex-end;}
      .admin-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
      .admin-table{min-width:720px;}
      .admin-shell{padding-bottom:96px;}
      #google-admin{min-height:50px;}
    }
  `;
  document.head.appendChild(style);
}

function patchTableWrappers() {
  document.querySelectorAll('.admin-table').forEach(table => {
    const parent = table.parentElement;
    if (parent) parent.classList.add('admin-table-wrap');
  });
}

function patchAdmin() {
  patchQueued = false;
  const root = document.getElementById('admin-content');
  if (!root) return;

  improveAdminLayout();
  patchLoginForm();
  patchNoAccess();
  installAdminActions();
  patchStaleAdminCopy();
  injectDailyAiButton();
  patchTableWrappers();
}

function schedulePatch() {
  if (patchQueued) return;
  patchQueued = true;
  requestAnimationFrame(patchAdmin);
}

getRedirectResult(auth)
  .then(result => {
    if (result?.user) toast('Google 관리자 로그인 완료', 'success');
  })
  .catch(err => {
    console.error('admin redirect login result failed:', err);
    toast(readableAuthError(err), 'error');
  });

const observer = new MutationObserver(schedulePatch);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', schedulePatch, { once: true });
window.addEventListener('pageshow', schedulePatch);
schedulePatch();
