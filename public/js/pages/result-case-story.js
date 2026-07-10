import { db, auth } from '../firebase.js?v=20260708-1';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { renderResult as renderBaseResult } from './result.js?v=20260710-v2result1';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

function ensureOriginalCaseStyle() {
  if (document.getElementById('original-case-story-style')) return;
  const style = document.createElement('style');
  style.id = 'original-case-story-style';
  style.textContent = `
    .emergency-briefing-card{position:relative;overflow:hidden;border:1px solid rgba(255,115,72,.62)!important;background:linear-gradient(145deg,rgba(104,23,27,.94),rgba(36,25,45,.96))!important;box-shadow:0 14px 34px rgba(74,10,18,.28)!important;padding:0!important;}
    .emergency-ticker{display:flex;align-items:center;gap:8px;padding:9px 13px;background:rgba(255,85,51,.16);border-bottom:1px solid rgba(255,139,94,.25);font-size:10px;font-weight:900;letter-spacing:.12em;color:#ffd3bd;}
    .emergency-ticker::before{content:'';width:8px;height:8px;border-radius:50%;background:#ff6947;box-shadow:0 0 0 5px rgba(255,105,71,.13);}
    .emergency-body{padding:17px 16px 18px;}
    .emergency-level{display:inline-block;border:1px solid rgba(255,180,116,.46);border-radius:999px;padding:5px 9px;margin-bottom:10px;font-size:10px;font-weight:900;color:#ffd59d;background:rgba(255,169,83,.1);}
    .emergency-headline{font-family:var(--font-serif);font-size:18px;font-weight:900;line-height:1.62;color:#fff3df;margin:0 0 13px;word-break:keep-all;}
    .emergency-grid{display:grid;gap:10px;}
    .emergency-block{padding:12px 13px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(255,255,255,.045);}
    .emergency-block strong{display:block;margin-bottom:6px;font-size:11px;letter-spacing:.08em;color:#ffc18c;}
    .emergency-block p{margin:0!important;font-size:13px!important;line-height:1.8!important;color:#fff0e6!important;white-space:pre-wrap;word-break:keep-all;}
    .original-case-card{position:relative;overflow:hidden;border-color:rgba(201,168,76,.62)!important;background:linear-gradient(135deg,rgba(201,168,76,.12),rgba(255,255,255,.035))!important;}
    .original-case-card::before{content:'접수원문';position:absolute;right:12px;top:12px;border:1px solid rgba(201,168,76,.4);border-radius:999px;padding:3px 8px;font-size:9px;font-weight:900;letter-spacing:.08em;color:var(--gold);}
    .original-case-card .original-case-title{font-size:11px;font-weight:900;letter-spacing:.12em;color:var(--gold);margin-bottom:9px;}
    .original-case-card .original-case-text{font-size:14px;line-height:1.85;color:var(--cream);white-space:pre-wrap;word-break:keep-all;padding-right:54px;}
    .original-case-card .original-case-wish{margin-top:10px;padding-top:10px;border-top:1px dashed rgba(201,168,76,.28);font-size:12px;line-height:1.65;color:var(--cream-dim);}
    [data-theme="light"] .emergency-briefing-card,:root:not([data-theme="dark"]) .emergency-briefing-card{background:linear-gradient(145deg,#fff0e4,#fff8ee)!important;border-color:#e7a37f!important;box-shadow:0 10px 24px rgba(132,58,32,.1)!important;}
    [data-theme="light"] .emergency-ticker,:root:not([data-theme="dark"]) .emergency-ticker{background:#ffe1cf!important;color:#8e2e18!important;border-color:#f2b495!important;}
    [data-theme="light"] .emergency-level,:root:not([data-theme="dark"]) .emergency-level{color:#923515!important;border-color:#dfa27f!important;background:#fff0e2!important;}
    [data-theme="light"] .emergency-headline,:root:not([data-theme="dark"]) .emergency-headline{color:#4b2115!important;}
    [data-theme="light"] .emergency-block,:root:not([data-theme="dark"]) .emergency-block{background:rgba(255,255,255,.66)!important;border-color:#ebc4ac!important;}
    [data-theme="light"] .emergency-block strong,:root:not([data-theme="dark"]) .emergency-block strong{color:#a34320!important;}
    [data-theme="light"] .emergency-block p,:root:not([data-theme="dark"]) .emergency-block p{color:#47261b!important;}
    [data-theme="light"] .original-case-card,:root:not([data-theme="dark"]) .original-case-card{background:linear-gradient(135deg,#fff5d5,#fffaf0)!important;}
    [data-theme="light"] .original-case-card .original-case-text,:root:not([data-theme="dark"]) .original-case-card .original-case-text{color:#342514!important;}
    @media(min-width:720px){.emergency-grid{grid-template-columns:1.15fr .85fr}.emergency-headline{font-size:20px}}
  `;
  document.head.appendChild(style);
}

function emergencyFromResult(result = {}) {
  const judgment = result.judgment && typeof result.judgment === 'object' ? result.judgment : {};
  return {
    incidentLevel: String(judgment.incidentLevel || '').trim(),
    breakingNews: String(judgment.breakingNews || '').trim(),
    emergencyBriefing: String(judgment.emergencyBriefing || '').trim(),
    impactAssessment: String(judgment.impactAssessment || '').trim(),
  };
}

async function loadOriginalCase(caseId) {
  const resultSnap = await getDoc(doc(db, 'results', caseId)).catch(() => null);
  const result = resultSnap?.exists() ? resultSnap.data() : {};
  let description = String(result.caseDescription || '').trim();
  let desiredVerdict = String(result.desiredVerdict || '').trim();

  if ((!description || !desiredVerdict) && auth.currentUser) {
    const caseSnap = await getDoc(doc(db, 'cases', caseId)).catch(() => null);
    if (caseSnap?.exists()) {
      const data = caseSnap.data() || {};
      description ||= String(data.caseDescription || '').trim();
      desiredVerdict ||= String(data.desiredVerdict || '').trim();
    }
  }
  return { description, desiredVerdict, emergency: emergencyFromResult(result) };
}

function hasEmergencyBriefing(emergency) {
  return !!(emergency?.breakingNews && emergency?.emergencyBriefing && emergency?.impactAssessment);
}

function decorateEmergencyBriefing(container, emergency) {
  if (!hasEmergencyBriefing(emergency) || container.querySelector('.emergency-briefing-card')) return;
  const cover = container.querySelector('.result-cover');
  if (!cover) return;
  cover.insertAdjacentHTML('afterend', `
    <section class="result-card emergency-briefing-card">
      <div class="emergency-ticker">소소킹 긴급사건 특보 · 생활질서 이상 징후 포착</div>
      <div class="emergency-body">
        ${emergency.incidentLevel ? `<div class="emergency-level">${escapeHtml(emergency.incidentLevel)}</div>` : ''}
        <h2 class="emergency-headline">${escapeHtml(emergency.breakingNews)}</h2>
        <div class="emergency-grid">
          <div class="emergency-block">
            <strong>현장 상황 브리핑</strong>
            <p>${escapeHtml(emergency.emergencyBriefing)}</p>
          </div>
          <div class="emergency-block">
            <strong>방치 시 예상 파급효과</strong>
            <p>${escapeHtml(emergency.impactAssessment)}</p>
          </div>
        </div>
      </div>
    </section>`);
}

function decorateOriginalCase(container, original) {
  if (!original.description || container.querySelector('.original-case-card')) return;
  const emergencyCard = container.querySelector('.emergency-briefing-card');
  const cover = container.querySelector('.result-cover');
  const anchor = emergencyCard || cover;
  if (!anchor) return;
  anchor.insertAdjacentHTML('afterend', `
    <section class="result-card original-case-card">
      <div class="original-case-title">사용자가 접수한 실제 사건 내용</div>
      <div class="original-case-text">${escapeHtml(original.description)}</div>
      ${original.desiredVerdict ? `<div class="original-case-wish"><strong>희망 판결</strong> · ${escapeHtml(original.desiredVerdict)}</div>` : ''}
    </section>`);
}

function decorateResult(container, original) {
  decorateEmergencyBriefing(container, original.emergency);
  decorateOriginalCase(container, original);
}

export async function renderResult(container, caseId) {
  ensureOriginalCaseStyle();
  const originalPromise = loadOriginalCase(caseId);
  await renderBaseResult(container, caseId);
  const original = await originalPromise;
  decorateResult(container, original);

  const observer = new MutationObserver(() => decorateResult(container, original));
  observer.observe(container, { childList: true, subtree: true });
  const previousCleanup = window._pageCleanup;
  window._pageCleanup = () => {
    observer.disconnect();
    previousCleanup?.();
  };
}
