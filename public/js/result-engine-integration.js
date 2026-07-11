import { auth, db, waitForAuthReady } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { resultPageHtml, bindResultActions } from './judgment-ui.js';

const ROLE_TRIAL_VERSION = 'role-based-trial-v10';
let user = null;
let scheduled = false;
let requestKey = '';
let replacedCaseId = '';

function resultCaseId() {
  const match = (location.hash || '').match(/^#\/result\/([^?]+)/);
  if (!match) return '';
  try { return decodeURIComponent(match[1]); } catch { return match[1]; }
}

function toast(message, type = '') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const item = document.createElement('div');
  item.className = `toast ${type}`.trim();
  item.textContent = message;
  root.appendChild(item);
  setTimeout(() => item.remove(), 3500);
}

function scheduleEnhance() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    enhanceResultPage();
  }, 0);
}

async function loadResultForDisplay(caseId) {
  if (user) {
    try {
      const privateSnap = await getDoc(doc(db, 'results', caseId));
      if (privateSnap.exists()) return { id: privateSnap.id, ...privateSnap.data(), ownerView: true };
    } catch {}
  }
  try {
    const publicSnap = await getDoc(doc(db, 'public_results', caseId));
    return publicSnap.exists() ? { id: publicSnap.id, ...publicSnap.data(), ownerView: false } : null;
  } catch {
    return null;
  }
}

function isCurrentRoleTrial(result) {
  return result?.resultVersion === ROLE_TRIAL_VERSION
    && result?.trialRecord?.resultVersion === ROLE_TRIAL_VERSION;
}

function replaceStaleOwnerResult(caseId, result, shell) {
  if (!result.ownerView || !isCurrentRoleTrial(result) || shell.classList.contains('role-trial-document')) return false;
  if (replacedCaseId === caseId) return false;
  const page = document.querySelector('.page');
  if (!page) return false;

  replacedCaseId = caseId;
  page.innerHTML = resultPageHtml(result);
  bindResultActions(result, (message, type) => toast(message, type));
  requestKey = '';
  return true;
}

async function enhanceResultPage() {
  const caseId = resultCaseId();
  const shell = document.querySelector('.result-shell');
  if (!caseId || !shell) return;

  const key = `${caseId}:${user?.uid || 'guest'}:${shell.childElementCount}`;
  if (requestKey === key && shell.querySelector('[data-engine-enhanced]')) return;
  requestKey = key;

  const result = await loadResultForDisplay(caseId);
  if (!result || resultCaseId() !== caseId) return;

  if (replaceStaleOwnerResult(caseId, result, shell)) return;

  if (isCurrentRoleTrial(result)) {
    shell.dataset.engineEnhanced = 'true';
    return;
  }

  const label = shell.querySelector('.judgment-engine-label');
  if (label && String(result.generationMode || '').startsWith('gemini')) {
    const judge = result.judgeType || 'AI';
    label.textContent = `이전 Gemini 판결 · ${judge} 재판부`;
  }

  if (!result.ownerView || shell.querySelector('[data-engine-upgrade]')) {
    shell.dataset.engineEnhanced = 'true';
    return;
  }

  const panel = document.createElement('section');
  panel.className = 'card result-section role-engine-upgrade';
  panel.dataset.engineUpgrade = 'true';
  panel.dataset.engineEnhanced = 'true';
  panel.innerHTML = `
    <div class="result-section-label">역할 분리형 황당재판 사용 가능</div>
    <h2>이 사건을 수사기록부터 다시 재판합니다</h2>
    <p class="result-body">현재 보고 있는 내용은 이전 판결 방식입니다. 사건번호, 수사관, 예능용 가상 CCTV·감식, 검사·변호인 공방과 단계별 주문이 포함된 새 기록철로 다시 만들 수 있습니다.</p>
    <div class="hero-actions"><a class="button button-primary" href="#/trial/${encodeURIComponent(caseId)}">수사 재판으로 다시 받기</a></div>`;
  (shell.querySelector('.role-docket-cover') || shell.querySelector('.judgment-cover'))?.after(panel);
}

window.addEventListener('hashchange', () => {
  replacedCaseId = '';
  scheduleEnhance();
});
new MutationObserver(scheduleEnhance).observe(document.getElementById('app'), { childList: true, subtree: true });
await waitForAuthReady();
onAuthStateChanged(auth, current => {
  user = current;
  requestKey = '';
  replacedCaseId = '';
  scheduleEnhance();
});
scheduleEnhance();
