import { auth, db } from './firebase.js';
import { appState } from './state.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function showIOSInstallGuide() {
  const prev = document.getElementById('ios-install-tip');
  if (prev) { prev.remove(); return; }
  const tip = document.createElement('div');
  tip.id = 'ios-install-tip';
  tip.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:10000;width:min(320px,calc(100vw - 32px));background:var(--color-surface);border:1px solid var(--color-border);border-radius:16px;padding:18px 20px;box-shadow:0 12px 40px rgba(0,0,0,.2);text-align:center;font-size:13px;line-height:1.65';
  tip.innerHTML = `
    <div style="font-size:24px;margin-bottom:8px">📲</div>
    <div style="font-weight:800;color:var(--color-text-primary);margin-bottom:6px">홈 화면에 추가하기</div>
    <div style="color:var(--color-text-secondary)">
      Safari 하단 <b>공유 버튼 ⬆</b> 탭 후<br><b>"홈 화면에 추가"</b>를 선택하세요
    </div>
    <button id="ios-tip-close" style="margin-top:14px;padding:7px 24px;background:var(--color-primary);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:800;cursor:pointer">확인</button>
  `;
  document.body.appendChild(tip);
  document.getElementById('ios-tip-close')?.addEventListener('click', () => tip.remove());
  setTimeout(() => tip.remove(), 10000);
}

function isAccountPage() {
  return (window.location.hash.slice(1).split('?')[0] || '/') === '/account';
}

function removeAccountInstallButtons() {
  document.querySelectorAll('[data-account-install-button]').forEach(el => el.remove());
}

function showAndroidInstallGuide() {
  const prev = document.getElementById('android-install-tip');
  if (prev) { prev.remove(); return; }
  const ua = navigator.userAgent;
  const isInApp = /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NaverApp|Twitter|Snapchat/i.test(ua);
  const tip = document.createElement('div');
  tip.id = 'android-install-tip';
  tip.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:10000;width:min(340px,calc(100vw - 32px));background:var(--color-surface);border:1px solid var(--color-border);border-radius:16px;padding:20px;box-shadow:0 12px 40px rgba(0,0,0,.2);text-align:center;font-size:13px;line-height:1.7';
  if (isInApp) {
    tip.innerHTML = `
      <div style="font-size:24px;margin-bottom:8px">⚠️</div>
      <div style="font-weight:800;color:var(--color-text-primary);margin-bottom:8px">인앱 브라우저에서는 설치 불가</div>
      <div style="color:var(--color-text-secondary);margin-bottom:14px">
        카카오톡·인스타그램 등 앱 내 브라우저는<br>PWA 설치를 지원하지 않아요.<br>
        <b>Chrome 브라우저</b>로 직접 열어주세요.
      </div>
      <button id="android-tip-close" style="padding:9px 32px;background:var(--color-primary);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit">확인</button>
    `;
  } else {
    tip.innerHTML = `
      <div style="font-size:24px;margin-bottom:8px">📲</div>
      <div style="font-weight:800;color:var(--color-text-primary);margin-bottom:10px">Chrome에서 앱 설치하기</div>
      <div style="color:var(--color-text-secondary);text-align:left;margin-bottom:14px">
        <div style="margin-bottom:6px">① Chrome 주소창 오른쪽 <b>⋮ 메뉴</b> 탭</div>
        <div style="margin-bottom:6px">② <b>"앱 설치"</b> 또는 <b>"홈 화면에 추가"</b> 선택</div>
        <div style="font-size:12px;color:var(--color-text-tertiary,#999);margin-top:8px">주소창에 설치 아이콘(⊕)이 보이면 그것을 탭해도 됩니다.</div>
      </div>
      <button id="android-tip-close" style="width:100%;padding:10px 0;background:var(--color-primary);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit">확인</button>
    `;
  }
  document.body.appendChild(tip);
  document.getElementById('android-tip-close')?.addEventListener('click', () => tip.remove());
  setTimeout(() => tip.remove(), 20000);
}

async function openInstallPrompt() {
  const prompt = appState.installPrompt || window.__pwaInstallPrompt;
  if (prompt) {
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        window.__pwaInstallPrompt = null;
        appState.installPrompt = null;
        removeAccountInstallButtons();
      } else {
        if (isIOS()) showIOSInstallGuide();
        else showAndroidInstallGuide();
      }
    } catch {
      if (isIOS()) showIOSInstallGuide();
      else showAndroidInstallGuide();
    }
  } else if (isIOS()) {
    showIOSInstallGuide();
  } else {
    showAndroidInstallGuide();
  }
}

function ensureAccountInstallButton() {
  if (!isAccountPage()) return;
  const logoutBtn = document.getElementById('btn-logout');
  if (!logoutBtn) return;
  const footer = logoutBtn.closest('.card__footer');
  if (!footer) return;
  footer.classList.add('account-action-footer');

  // 이미 설치된 경우(standalone) 버튼 숨김, 그 외에는 항상 표시
  if (isStandalone()) {
    removeAccountInstallButtons();
    return;
  }
  if (footer.querySelector('[data-account-install-button]')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn--primary btn--sm account-install-btn';
  btn.dataset.accountInstallButton = 'true';
  btn.innerHTML = '📲 앱 설치';
  btn.addEventListener('click', openInstallPrompt);
  logoutBtn.insertAdjacentElement('afterend', btn);
}

function formatPoint(value) {
  return `${Number(value || 0).toLocaleString()}P`;
}

async function renderPoints() {
  if (!auth.currentUser || !isAccountPage()) return;
  const page = document.querySelector('.account-profile-card .account-stats');
  if (!page || page.dataset.pointsReady === '1') return;
  page.dataset.pointsReady = '1';
  const snap = await getDoc(doc(db, 'users', auth.currentUser.uid)).catch(() => null);
  const data = snap?.exists?.() ? snap.data() : {};
  const points = Number(data.points || data.totalPoints || 0);
  page.insertAdjacentHTML('beforeend', `
    <div class="account-stat account-stat--points">
      <div class="account-stat__num">${formatPoint(points)}</div>
      <div class="account-stat__label">포인트</div>
    </div>`);
}

function runAccountUi() {
  ensureAccountInstallButton();
  renderPoints();
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(runAccountUi, 180);
}

window.addEventListener('beforeinstallprompt', schedule);
window.addEventListener('appinstalled', () => {
  removeAccountInstallButtons();
  schedule();
});
window.addEventListener('hashchange', schedule);
window.addEventListener('themechange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(runAccountUi, 500);
