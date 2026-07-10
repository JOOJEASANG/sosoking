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
    .original-case-title{font-size:11px;font-weight:900;letter-spacing:.12em;color:var(--gold);margin-bottom:9px;}
    .original-case-text{font-size:14px;line-height:1.85;color:var(--cream);white-space:pre-wrap;word-break:keep-all;padding-right:54px;}
    .original-case-wish{margin-top:10px;padding-top:10px;border-top:1px dashed rgba(201,168,76,.28);font-size:12px;line-height:1.65;color:var(--cream-dim);}
    .claim-showdown{padding:0!important;overflow:hidden;}
    .claim-showdown-head{padding:13px 16px;border-bottom:1px solid var(--border);font-size:11px;font-weight:900;letter-spacing:.11em;color:var(--gold);}
    .claim-showdown-grid{display:grid;gap:1px;background:var(--border);}
    .claim-side{background:var(--navy-card);padding:17px 16px;}
    .claim-side-label{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:900;margin-bottom:8px;}
    .claim-side.plaintiff .claim-side-label{color:#ffb27f;}
    .claim-side.defendant .claim-side-label{color:#91b7ff;}
    .claim-side p{font-size:14px!important;line-height:1.8!important;color:var(--cream)!important;margin:0!important;white-space:pre-wrap;word-break:keep-all;}
    .claim-versus{text-align:center;padding:7px;background:var(--navy-light);font-size:10px;font-weight:900;color:var(--cream-dim);letter-spacing:.16em;}
    [data-theme="light"] .emergency-briefing-card,:root:not([data-theme="dark"]) .emergency-briefing-card{background:linear-gradient(145deg,#fff0e4,#fff8ee)!important;border-color:#e7a37f!important;box-shadow:0 10px 24px rgba(132,58,32,.1)!important;}
    [data-theme="light"] .emergency-ticker,:root:not([data-theme="dark"]) .emergency-ticker{background:#ffe1cf!important;color:#8e2e18!important;border-color:#f2b495!important;}
    [data-theme="light"] .emergency-level,:root:not([data-theme="dark"]) .emergency-level{color:#923515!important;border-color:#dfa27f!important;background:#fff0e2!important;}
    [data-theme="light"] .emergency-headline,:root:not([data-theme="dark"]) .emergency-headline{color:#4b2115!important;}
    [data-theme="light"] .emergency-block,:root:not([data-theme="dark"]) .emergency-block{background:rgba(255,255,255,.66)!important;border-color:#ebc4ac!important;}
    [data-theme="light"] .emergency-block strong,:root:not([data-theme="dark"]) .emergency-block strong{color:#a34320!important;}
    [data-theme="light"] .emergency-block p,:root:not([data-theme="dark"]) .emergency-block p{color:#47261b!important;}
    [data-theme="light"] .original-case-card,:root:not([data-theme="dark"]) .original-case-card{background:linear-gradient(135deg,#fff5d5,#fffaf0)!important;}
    [data-theme="light"] .original-case-text,:root:not([data-theme="dark"]) .original-case-text{color:#342514!important;}
    [data-theme="light"] .claim-side,:root:not([data-theme="dark"]) .claim-side{background:#fffaf1!important;}
    [data-theme="light"] .claim-side p,:root:not([data-theme="dark"]) .claim-side p{color:#342514!important;}
    [data-theme="light"] .claim-versus,:root:not([data-theme="dark"]) .claim-versus{background:#f1e4ce!important;color:#6b563c!important;}
    @media(min-width:720px){.emergency-grid{grid-template-columns:1.15fr .85fr}.emergency-headline{font-size:20px}.claim-showdown-grid{grid-template-columns:1fr auto 1fr}.claim-versus{display:flex;align-items:center;padding:0 9px}}
  `;
  document.head.appendChild(style);
}

function judgmentExtras(result = {}) {
  const judgment = result.judgment && typeof result.judgment === 'object' ? result.judgment : {};
  return {
    incidentLevel: String(judgment.incidentLevel || '').trim(),
    breakingNews: String(judgment.breakingNews || '').trim(),
    emergencyBriefing: String(judgment.emergencyBriefing || '').trim(),
    impactAssessment: String(judgment.impactAssessment || '').trim(),
    plaintiffClaim: String(judgment.plaintiffClaim || '').trim(),
    defendantClaim: String(judgment.defendantClaim || '').trim(),
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
  return { description, desiredVerdict, extras: judgmentExtras(result) };
}

function hasEmergencyBriefing(extras) {
  return !!(extras?.breakingNews && extras?.emergencyBriefing && extras?.impactAssessment);
}

function decorateEmergencyBriefing(container, extras) {
  if (!hasEmergencyBriefing(extras) || container.querySelector('.emergency-briefing-card')) return;
  const cover = container.querySelector('.result-cover');
  if (!cover) return;
  cover.insertAdjacentHTML('afterend', `
    <section class="result-card emergency-briefing-card">
      <div class="emergency-ticker">소소킹 긴급사건 특보 · 생활질서 이상 징후 포착</div>
      <div class="emergency-body">
        ${extras.incidentLevel ? `<div class="emergency-level">${escapeHtml(extras.incidentLevel)}</div>` : ''}
        <h2 class="emergency-headline">${escapeHtml(extras.breakingNews)}</h2>
        <div class="emergency-grid">
          <div class="emergency-block"><strong>현장 상황 브리핑</strong><p>${escapeHtml(extras.emergencyBriefing)}</p></div>
          <div class="emergency-block"><strong>방치 시 예상 파급효과</strong><p>${escapeHtml(extras.impactAssessment)}</p></div>
        </div>
      </div>
    </section>`);
}

function decorateOriginalCase(container, original) {
  if (!original.description || container.querySelector('.original-case-card')) return;
  const anchor = container.querySelector('.emergency-briefing-card') || container.querySelector('.result-cover');
  if (!anchor) return;
  anchor.insertAdjacentHTML('afterend', `
    <section class="result-card original-case-card">
      <div class="original-case-title">사용자가 접수한 실제 사건 내용</div>
      <div class="original-case-text">${escapeHtml(original.description)}</div>
      ${original.desiredVerdict ? `<div class="original-case-wish"><strong>희망 판결</strong> · ${escapeHtml(original.desiredVerdict)}</div>` : ''}
    </section>`);
}

function decorateClaims(container, extras) {
  if (!extras?.plaintiffClaim || !extras?.defendantClaim || container.querySelector('.claim-showdown')) return;
  const anchor = container.querySelector('.original-case-card') || container.querySelector('.emergency-briefing-card') || container.querySelector('.result-cover');
  if (!anchor) return;
  anchor.insertAdjacentHTML('afterend', `
    <section class="result-card claim-showdown">
      <div class="claim-showdown-head">법정공방 핵심 요약 · 양측 최종 1분 주장</div>
      <div class="claim-showdown-grid">
        <div class="claim-side plaintiff"><div class="claim-side-label">⚔️ 원고측 핵심 주장</div><p>${escapeHtml(extras.plaintiffClaim)}</p></div>
        <div class="claim-versus">VS</div>
        <div class="claim-side defendant"><div class="claim-side-label">🛡️ 피고측 핵심 반박</div><p>${escapeHtml(extras.defendantClaim)}</p></div>
      </div>
    </section>`);
}

function decorateResult(container, original) {
  decorateEmergencyBriefing(container, original.extras);
  decorateOriginalCase(container, original);
  decorateClaims(container, original.extras);
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
