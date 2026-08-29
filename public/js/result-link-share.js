import { functions } from './firebase.js?v=20260729-auth-session-1';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const setResultVisibility = httpsCallable(functions, 'setResultVisibility');
let queued = false;

function currentCaseId() {
  const hash = location.hash || '';
  const hashMatch = hash.match(/^#\/(?:result|verdict)\/(.+)$/);
  const pathMatch = location.pathname.match(/^\/result\/(.+)$/);
  const raw = hashMatch?.[1] || pathMatch?.[1] || '';
  try { return decodeURIComponent(raw); }
  catch { return ''; }
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

function toast(message) {
  let host = document.getElementById('toast-container');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-container';
    document.body.append(host);
  }
  const item = document.createElement('div');
  item.className = 'toast toast-success';
  item.textContent = message;
  host.append(item);
  window.setTimeout(() => item.remove(), 2600);
}

async function shareOrCopy({ title, text, url }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.warn('result native share failed:', error);
    }
  }
  await copyText(url);
  toast('판결 링크를 복사했습니다. 카카오톡이나 메신저에 붙여넣어 공유하세요.');
}

function isPrivateOwnerView(actions) {
  const visibilityButton = actions.querySelector('#btn-share');
  return Boolean(visibilityButton && visibilityButton.textContent.includes('공개하기'));
}

async function ensurePublic(caseId, actions, button) {
  if (!isPrivateOwnerView(actions)) return true;
  const confirmed = window.confirm(
    '링크로 공유하려면 이 판결을 판결기록에 공개해야 합니다.\n\n닉네임과 판결 내용이 공개될 수 있습니다. 공개 후 공유할까요?'
  );
  if (!confirmed) return false;
  const old = button.textContent;
  button.disabled = true;
  button.textContent = '공개 준비 중...';
  try {
    await setResultVisibility({ caseId, isPublic: true });
    const visibilityButton = actions.querySelector('#btn-share');
    if (visibilityButton) {
      visibilityButton.textContent = '🔒 판결기록 비공개로 전환';
      visibilityButton.classList.remove('btn-primary');
      visibilityButton.classList.add('btn-ghost');
    }
    toast('판결기록에 공개했습니다. 이제 링크를 공유합니다.');
    return true;
  } catch (error) {
    console.error('result publish before share failed:', error);
    toast('판결을 공개하지 못해 링크를 공유할 수 없습니다.');
    return false;
  } finally {
    button.disabled = false;
    button.textContent = old;
  }
}

function installShareButton(page) {
  const caseId = currentCaseId();
  const actions = page.querySelector('.result-actions');
  if (!caseId || !actions || actions.querySelector('[data-result-link-share]')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-secondary';
  button.dataset.resultLinkShare = 'true';
  button.textContent = '🔗 결과 링크 공유';
  button.addEventListener('click', async () => {
    if (!(await ensurePublic(caseId, actions, button))) return;
    const title = page.querySelector('.result-cover h2')?.textContent?.trim() || '소소킹 판결';
    const judge = page.querySelector('.judge-name')?.textContent?.trim() || 'AI 판사';
    const url = `${location.origin}/result/${encodeURIComponent(caseId)}`;
    await shareOrCopy({
      title: `${title} · 소소킹 판결소`,
      text: `⚖️ ${judge}가 내린 “${title}” 판결 결과를 확인해보세요.`,
      url
    });
  });

  const newCase = actions.querySelector('a[href="#/submit"]');
  if (newCase) actions.insertBefore(button, newCase);
  else actions.append(button);
}

function normalize(root = document) {
  const pages = [];
  if (root instanceof HTMLElement && root.matches('.result-document-page')) pages.push(root);
  root.querySelectorAll?.('.result-document-page').forEach(page => pages.push(page));
  pages.forEach(installShareButton);
}

function schedule() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    normalize(document.body);
  });
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
normalize(document.body);
