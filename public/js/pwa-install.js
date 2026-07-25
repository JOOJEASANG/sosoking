import { appState } from './state.js';

const STATE_EVENT = 'sosoking:pwa-statechange';
const INSTALL_RECORD_KEY = 'sosoking-pwa-installed-at';
let initialized = false;
let serviceWorkerReadyPromise = null;

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    Boolean(navigator.standalone);
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.MSStream;
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isInAppBrowser() {
  return /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NaverApp|Twitter|Snapchat|DaumApps/i.test(navigator.userAgent);
}

function isSamsungBrowser() {
  return /SamsungBrowser/i.test(navigator.userAgent);
}

function hasInstallRecord() {
  try { return Boolean(localStorage.getItem(INSTALL_RECORD_KEY)); } catch { return false; }
}

function setInstallRecord() {
  try { localStorage.setItem(INSTALL_RECORD_KEY, new Date().toISOString()); } catch {}
}

function clearInstallRecord() {
  try { localStorage.removeItem(INSTALL_RECORD_KEY); } catch {}
}

function removeInstallUi() {
  document.querySelectorAll('#hdr-install-btn, #sb-install-btn, #btn-pwa-install, [data-account-install-button], [data-pwa-install-shortcut]').forEach(element => element.remove());
  document.getElementById('pwa-install-guide')?.remove();
}

function emitState(reason) {
  window.dispatchEvent(new CustomEvent(STATE_EVENT, {
    detail: {
      reason,
      installable: Boolean(getInstallPrompt()),
      installed: isStandalone() || hasInstallRecord(),
    },
  }));
}

function setInstallPrompt(prompt, reason) {
  const next = prompt || null;
  appState.installPrompt = next;
  window.__pwaInstallPrompt = next;
  emitState(reason);
}

export function getInstallPrompt() {
  return appState.installPrompt || window.__pwaInstallPrompt || null;
}

export function canOfferInstall() {
  if (isStandalone()) return false;
  if (getInstallPrompt()) return true;
  if (hasInstallRecord()) return false;
  return isMobile();
}

async function ensureServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  if (serviceWorkerReadyPromise) return serviceWorkerReadyPromise;

  serviceWorkerReadyPromise = navigator.serviceWorker
    .register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .then(async registration => {
      try { await registration.update(); } catch {}
      try { await navigator.serviceWorker.ready; } catch {}
      emitState('service-worker-ready');
      return registration;
    })
    .catch(error => {
      console.warn('[pwa] service worker registration failed', error);
      return null;
    });

  return serviceWorkerReadyPromise;
}

export function initPwaInstall() {
  if (initialized) return;
  initialized = true;

  if (window.__pwaInstallPrompt) appState.installPrompt = window.__pwaInstallPrompt;
  if (isStandalone()) {
    setInstallRecord();
    removeInstallUi();
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    clearInstallRecord();
    setInstallPrompt(event, 'prompt-ready');
  });

  window.addEventListener('appinstalled', () => {
    setInstallRecord();
    removeInstallUi();
    setInstallPrompt(null, 'installed');
  });

  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', event => {
    if (event.matches || isStandalone()) {
      setInstallRecord();
      removeInstallUi();
    }
    emitState('display-mode-change');
  });

  void ensureServiceWorker();
  queueMicrotask(() => emitState(window.__pwaInstallPrompt ? 'prompt-restored' : 'initialized'));
}

function setButtonBusy(button, busy) {
  if (!button || !button.isConnected) return;
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
  const label = button.querySelector('span');
  if (!label) return;
  if (!button.dataset.installLabel) button.dataset.installLabel = label.textContent || '앱 설치';
  label.textContent = busy ? '설치 확인 중' : button.dataset.installLabel;
}

function guideContent() {
  const ua = navigator.userAgent;
  if (isInAppBrowser()) {
    return {
      icon: '⚠️',
      title: '브라우저에서 열어주세요',
      body: '카카오톡·인스타그램·네이버 앱 안에서는 설치가 제한될 수 있습니다.<br><b>외부 브라우저로 열기</b>를 선택한 뒤 Chrome 또는 삼성 인터넷에서 다시 눌러주세요.',
    };
  }
  if (isIOS()) {
    const safari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
    return safari ? {
      icon: '📲',
      title: '홈 화면에 추가하기',
      body: 'Safari의 <b>공유 버튼</b>을 누른 뒤<br><b>홈 화면에 추가</b>를 선택하세요.',
    } : {
      icon: '🧭',
      title: 'Safari에서 열어주세요',
      body: '아이폰·아이패드에서는 Safari로 사이트를 연 뒤<br><b>공유 → 홈 화면에 추가</b>를 선택하세요.',
    };
  }
  if (isSamsungBrowser()) {
    return {
      icon: '📲',
      title: '삼성 인터넷에서 설치하기',
      body: '브라우저 메뉴를 연 뒤<br><b>페이지 추가 → 홈 화면</b>을 선택하세요.',
    };
  }
  if (isAndroid()) {
    return {
      icon: '📲',
      title: '브라우저 메뉴에서 설치하기',
      body: 'Chrome 메뉴의 <b>앱 설치</b> 또는<br><b>홈 화면에 추가</b>를 선택하세요.',
    };
  }
  return {
    icon: '💻',
    title: '브라우저에서 앱 설치하기',
    body: '주소창의 설치 아이콘을 누르거나<br>브라우저 메뉴에서 <b>소소킹 설치</b>를 선택하세요.',
  };
}

export function showInstallGuide() {
  document.getElementById('pwa-install-guide')?.remove();
  const guide = guideContent();
  const panel = document.createElement('div');
  panel.id = 'pwa-install-guide';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', '앱 설치 안내');
  panel.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.48);backdrop-filter:blur(3px)';
  panel.innerHTML = `
    <div style="width:min(360px,100%);background:var(--color-surface);color:var(--color-text-primary);border:1px solid var(--color-border);border-radius:18px;padding:22px;box-shadow:0 18px 50px rgba(0,0,0,.26);text-align:center;font-size:13px;line-height:1.7">
      <div style="font-size:28px;margin-bottom:8px">${guide.icon}</div>
      <div style="font-size:16px;font-weight:900;margin-bottom:8px">${guide.title}</div>
      <div style="color:var(--color-text-secondary);margin-bottom:16px">${guide.body}</div>
      <button type="button" data-pwa-guide-close style="width:100%;padding:10px 14px;border:0;border-radius:10px;background:var(--color-primary);color:#fff;font:inherit;font-weight:900;cursor:pointer">확인</button>
    </div>`;
  document.body.appendChild(panel);
  panel.querySelector('[data-pwa-guide-close]')?.addEventListener('click', () => panel.remove());
  panel.addEventListener('click', event => { if (event.target === panel) panel.remove(); });
}

export async function requestPwaInstall({ button = null } = {}) {
  if (isStandalone() || hasInstallRecord()) {
    removeInstallUi();
    return { status: 'installed' };
  }

  const prompt = getInstallPrompt();
  if (!prompt || typeof prompt.prompt !== 'function') {
    void ensureServiceWorker();
    showInstallGuide();
    return { status: 'manual' };
  }

  setButtonBusy(button, true);
  try {
    const promptResult = prompt.prompt();
    await promptResult;
    const choice = await prompt.userChoice;
    const accepted = choice?.outcome === 'accepted';
    if (accepted) {
      setInstallRecord();
      removeInstallUi();
    }
    setInstallPrompt(null, accepted ? 'accepted' : 'dismissed');
    return { status: choice?.outcome || 'dismissed' };
  } catch (error) {
    console.warn('[pwa] install prompt failed', error);
    setInstallPrompt(null, 'prompt-error');
    showInstallGuide();
    return { status: 'manual', error };
  } finally {
    setButtonBusy(button, false);
  }
}
