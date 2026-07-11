import { auth, db, waitForAuthReady } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

let user = null;
let scheduled = false;
let requestKey = '';

function resultCaseId() {
  const match = (location.hash || '').match(/^#\/result\/([^?]+)/);
  if (!match) return '';
  try { return decodeURIComponent(match[1]); } catch { return match[1]; }
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

async function enhanceResultPage() {
  const caseId = resultCaseId();
  const shell = document.querySelector('.result-shell');
  if (!caseId || !shell) return;

  const key = `${caseId}:${user?.uid || 'guest'}:${shell.childElementCount}`;
  if (requestKey === key && shell.querySelector('[data-engine-enhanced]')) return;
  requestKey = key;

  const result = await loadResultForDisplay(caseId);
  if (!result || resultCaseId() !== caseId) return;

  const label = shell.querySelector('.judgment-engine-label');
  if (label && String(result.generationMode || '').startsWith('gemini')) {
    const judge = result.judgeType || 'AI';
    label.textContent = `Gemini 3단계 편집 판결 · ${judge} 재판부`;
  }

  const version = Number(result.judgment?.engineVersion || 0);
  if (!result.ownerView || version >= 3 || shell.querySelector('[data-engine-upgrade]')) {
    shell.dataset.engineEnhanced = 'true';
    return;
  }

  const panel = document.createElement('section');
  panel.className = 'card result-section';
  panel.dataset.engineUpgrade = 'true';
  panel.dataset.engineEnhanced = 'true';
  panel.innerHTML = `
    <div class="result-section-label">새 판결 엔진 사용 가능</div>
    <p class="result-body">이 판결은 이전 방식으로 작성되었습니다. 사건 분석, 코미디 3안, 최종 편집 검사를 거치는 새 엔진으로 다시 판결받을 수 있습니다.</p>
    <div class="hero-actions"><a class="button button-primary" href="#/trial/${encodeURIComponent(caseId)}">새 판결 다시 받기</a></div>`;
  shell.querySelector('.judgment-cover')?.after(panel);
}

window.addEventListener('hashchange', scheduleEnhance);
new MutationObserver(scheduleEnhance).observe(document.getElementById('app'), { childList: true, subtree: true });
await waitForAuthReady();
onAuthStateChanged(auth, current => {
  user = current;
  requestKey = '';
  scheduleEnhance();
});
scheduleEnhance();
