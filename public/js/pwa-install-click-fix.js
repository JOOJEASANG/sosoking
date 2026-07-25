import { appState } from './state.js';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    Boolean(navigator.standalone);
}

function installButtonFromEvent(event) {
  const target = event.target instanceof Element ? event.target : null;
  return target?.closest('#hdr-install-btn, #sb-install-btn') || null;
}

function setBusy(button, busy) {
  if (!button) return;
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
  const label = button.querySelector('span');
  if (!label) return;
  if (!button.dataset.installLabel) button.dataset.installLabel = label.textContent || '앱 설치';
  label.textContent = busy ? '설치 확인 중' : button.dataset.installLabel;
}

function clearPrompt(reason) {
  appState.installPrompt = null;
  window.__pwaInstallPrompt = null;
  window.dispatchEvent(new CustomEvent('sosoking:pwa-statechange', {
    detail: { reason, installable: false, installed: isStandalone() },
  }));
}

async function runPromptImmediately(event, button, prompt) {
  event.preventDefault();
  event.stopImmediatePropagation();
  setBusy(button, true);
  try {
    // prompt()는 사용자 클릭 이벤트가 살아 있는 동안 즉시 실행해야 한다.
    await prompt.prompt();
    const choice = await prompt.userChoice;
    clearPrompt(choice?.outcome === 'accepted' ? 'accepted' : 'dismissed');
  } catch (error) {
    console.warn('[pwa immediate install]', error);
    clearPrompt('prompt-error');
    window.dispatchEvent(new CustomEvent('sosoking:pwa-install-fallback'));
  } finally {
    setBusy(button, false);
  }
}

// 기존 버튼 핸들러보다 먼저 실행해 await로 사용자 활성화가 끊기는 문제를 막는다.
document.addEventListener('click', event => {
  const button = installButtonFromEvent(event);
  if (!button || isStandalone()) return;
  const prompt = appState.installPrompt || window.__pwaInstallPrompt;
  if (!prompt || typeof prompt.prompt !== 'function') return;
  void runPromptImmediately(event, button, prompt);
}, true);
