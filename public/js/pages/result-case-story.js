import { db, auth } from '../firebase.js?v=20260708-1';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { renderResult as renderBaseResult } from './result.js?v=20260710-v2result1';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

function ensureOriginalCaseStyle() {
  if (document.getElementById('original-case-story-style')) return;
  const style = document.createElement('style');
  style.id = 'original-case-story-style';
  style.textContent = `
    .emergency-briefing-card{--alert-title:#fff3df;--alert-text:#fff0e6;--alert-label:#ffc18c;--alert-chip:#ffd59d;--alert-ticker:#ffd3bd;position:relative;overflow:hidden;border:1px solid rgba(255,115,72,.62)!important;background:linear-gradient(145deg,rgba(104,23,27,.94),rgba(36,25,45,.96))!important;box-shadow:0 14px 34px rgba(74,10,18,.28)!important;padding:0!important;}
    .emergency-ticker{display:flex;align-items:center;gap:8px;padding:9px 13px;background:rgba(255,85,51,.16);border-bottom:1px solid rgba(255,139,94,.25);font-size:10px;font-weight:900;letter-spacing:.12em;color:var(--alert-ticker);}
    .emergency-ticker::before{content:'';width:8px;height:8px;border-radius:50%;background:#ff6947;box-shadow:0 0 0 5px rgba(255,105,71,.13);}
    .emergency-body{padding:17px 16px 18px;}
    .emergency-level{display:inline-block;border:1px solid rgba(255,180,116,.46);border-radius:999px;padding:5px 9px;margin-bottom:10px;font-size:10px;font-weight:900;color:var(--alert-chip);background:rgba(255,169,83,.1);}
    .emergency-headline{font-family:var(--font-serif);font-size:18px;font-weight:900;line-height:1.62;color:var(--alert-title)!important;margin:0 0 13px;word-break:keep-all;}
    .emergency-grid{display:grid;gap:10px;}
    .emergency-block{padding:12px 13px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(255,255,255,.045);}
    .emergency-block strong{display:block;margin-bottom:6px;font-size:11px;letter-spacing:.08em;color:var(--alert-label);}
    .emergency-block p{margin:0!important;font-size:13px!important;line-height:1.8!important;color:var(--alert-text)!important;white-space:pre-wrap;word-break:keep-all;}
    .comedy-lines-card{padding:0!important;overflow:hidden;border-color:color-mix(in srgb,var(--ui-gold,var(--gold)) 60%,var(--ui-line,var(--border)))!important;}
    .comedy-lines-head{padding:12px 16px;border-bottom:1px solid var(--ui-line,var(--border));font-size:11px;font-weight:900;letter-spacing:.1em;color:var(--ui-gold,var(--gold));}
    .comedy-lines-list{display:grid;gap:1px;background:var(--ui-line,var(--border));}
    .comedy-line{position:relative;padding:15px 16px 15px 44px;background:var(--ui-surface,var(--navy-card));font-family:var(--font-serif);font-size:15px;font-weight:800;line-height:1.75;color:var(--ui-text-main,var(--cream));word-break:keep-all;}
    .comedy-line::before{content:'ㅋ';position:absolute;left:15px;top:15px;display:grid;place-items:center;width:21px;height:21px;border-radius:50%;background:color-mix(in srgb,var(--ui-gold,var(--gold)) 16%,transparent);color:var(--ui-gold,var(--gold));font-family:var(--font-sans);font-size:11px;font-weight:900;}
    .original-case-card{position:relative;overflow:hidden;border-color:var(--ui-line-strong,var(--border))!important;background:color-mix(in srgb,var(--ui-gold,var(--gold)) 7%,var(--ui-surface,var(--navy-card)))!important;padding:0!important;}
    .original-case-card summary{list-style:none;cursor:pointer;padding:14px 16px;font-size:12px;font-weight:900;letter-spacing:.07em;color:var(--ui-gold,var(--gold));display:flex;align-items:center;justify-content:space-between;gap:12px;}
    .original-case-card summary::-webkit-details-marker{display:none;}
    .original-case-card summary::after{content:'원문 보기 ＋';font-size:10px;color:var(--ui-text-muted,var(--cream-dim));letter-spacing:0;}
    .original-case-card[open] summary::after{content:'원문 닫기 －';}
    .original-case-body{border-top:1px dashed var(--ui-line,var(--border));padding:15px 16px 17px;}
    .original-case-title{font-size:10px;font-weight:900;letter-spacing:.12em;color:var(--ui-text-soft,var(--cream-dim));margin-bottom:8px;}
    .original-case-text{font-size:13px;line-height:1.8;color:var(--ui-text-main,var(--cream));white-space:pre-wrap;word-break:keep-all;}
    .original-case-wish{margin-top:10px;padding-top:10px;border-top:1px dashed var(--ui-line,var(--border));font-size:12px;line-height:1.65;color:var(--ui-text-muted,var(--cream-dim));}
    .claim-showdown{padding:0!important;overflow:hidden;}
    .claim-showdown-head{padding:13px 16px;border-bottom:1px solid var(--ui-line,var(--border));font-size:11px;font-weight:900;letter-spacing:.11em;color:var(--ui-gold,var(--gold));}
    .claim-showdown-grid{display:grid;gap:1px;background:var(--ui-line,var(--border));}
    .claim-side{background:var(--ui-surface,var(--navy-card));padding:17px 16px;}
    .claim-side-label{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:900;margin-bottom:8px;}
    .claim-side.plaintiff .claim-side-label{color:var(--ui-plaintiff,#ffb27f);}
    .claim-side.defendant .claim-side-label{color:var(--ui-defendant,#91b7ff);}
    .claim-side p{font-size:14px!important;line-height:1.8!important;color:var(--ui-text-main,var(--cream))!important;margin:0!important;white-space:pre-wrap;word-break:keep-all;}
    .claim-versus{text-align:center;padding:7px;background:var(--ui-bg-soft,var(--navy-light));font-size:10px;font-weight:900;color:var(--ui-text-soft,var(--cream-dim));letter-spacing:.16em;}
    html[data-theme="light"] .emergency-briefing-card{--alert-title:#4b2115;--alert-text:#47261b;--alert-label:#a34320;--alert-chip:#923515;--alert-ticker:#8e2e18;background:linear-gradient(145deg,#fff0e4,#fff8ee)!important;border-color:#e7a37f!important;box-shadow:0 10px 24px rgba(132,58,32,.1)!important;}
    html[data-theme="light"] .emergency-ticker{background:#ffe1cf!important;border-color:#f2b495!important;}
    html[data-theme="light"] .emergency-level{border-color:#dfa27f!important;background:#fff0e2!important;}
    html[data-theme="light"] .emergency-block{background:rgba(255,255,255,.66)!important;border-color:#ebc4ac!important;}
    @media(prefers-color-scheme:light){
      html:not([data-theme="dark"]) .emergency-briefing-card{--alert-title:#4b2115;--alert-text:#47261b;--alert-label:#a34320;--alert-chip:#923515;--alert-ticker:#8e2e18;background:linear-gradient(145deg,#fff0e4,#fff8ee)!important;border-color:#e7a37f!important;box-shadow:0 10px 24px rgba(132,58,32,.1)!important;}
      html:not([data-theme="dark"]) .emergency-ticker{background:#ffe1cf!important;border-color:#f2b495!important;}
      html:not([data-theme="dark"]) .emergency-level{border-color:#dfa27f!important;background:#fff0e2!important;}
      html:not([data-theme="dark"]) .emergency-block{background:rgba(255,255,255,.66)!important;border-color:#ebc4ac!important;}
    }
    @media(min-width:720px){.emergency-grid{grid-template-columns:1.15fr .85fr}.emergency-headline{font-size:20px}.claim-showdown-grid{grid-template-columns:1fr auto 1fr}.claim-versus{display:flex;align-items:center;padding:0 9px}.comedy-lines-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
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
    comedyLines: Array.isArray(judgment.comedyLines) ? judgment.comedyLines.map(item => String(item || '').trim()).filter(Boolean).slice(0, 4) : [],
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
      <div class="emergency-ticker">소소킹 긴급사건 특보 · 사건 핵심 포착 완료</div>
      <div class="emergency-body">
        ${extras.incidentLevel ? `<div class="emergency-level">${escapeHtml(extras.incidentLevel)}</div>` : ''}
        <h2 class="emergency-headline">${escapeHtml(extras.breakingNews)}</h2>
        <div class="emergency-grid">
          <div class="emergency-block"><strong>결정적 순간</strong><p>${escapeHtml(extras.emergencyBriefing)}</p></div>
          <div class="emergency-block"><strong>이대로 두면 벌어질 일</strong><p>${escapeHtml(extras.impactAssessment)}</p></div>
        </div>
      </div>
    </section>`);
}

function decorateComedyLines(container, extras) {
  if (!extras?.comedyLines?.length || container.querySelector('.comedy-lines-card')) return;
  const anchor = container.querySelector('.emergency-briefing-card') || container.querySelector('.result-cover');
  if (!anchor) return;
  anchor.insertAdjacentHTML('afterend', `
    <section class="result-card comedy-lines-card">
      <div class="comedy-lines-head">판결문에서 건진 결정적 한마디</div>
      <div class="comedy-lines-list">${extras.comedyLines.map(line => `<div class="comedy-line">${escapeHtml(line)}</div>`).join('')}</div>
    </section>`);
}

function decorateOriginalCase(container, original) {
  if (!original.description || container.querySelector('.original-case-card')) return;
  const anchor = container.querySelector('.comedy-lines-card') || container.querySelector('.emergency-briefing-card') || container.querySelector('.result-cover');
  if (!anchor) return;
  anchor.insertAdjacentHTML('afterend', `
    <details class="result-card original-case-card">
      <summary>접수 원문은 판결과 분리해 보관됩니다</summary>
      <div class="original-case-body">
        <div class="original-case-title">사용자가 입력한 원문</div>
        <div class="original-case-text">${escapeHtml(original.description)}</div>
        ${original.desiredVerdict ? `<div class="original-case-wish"><strong>희망 판결</strong> · ${escapeHtml(original.desiredVerdict)}</div>` : ''}
      </div>
    </details>`);
}

function decorateClaims(container, extras) {
  if (!extras?.plaintiffClaim || !extras?.defendantClaim || container.querySelector('.claim-showdown')) return;
  const anchor = container.querySelector('.original-case-card') || container.querySelector('.comedy-lines-card') || container.querySelector('.emergency-briefing-card') || container.querySelector('.result-cover');
  if (!anchor) return;
  anchor.insertAdjacentHTML('afterend', `
    <section class="result-card claim-showdown">
      <div class="claim-showdown-head">법정공방 핵심 · 같은 사건, 완전히 다른 변명</div>
      <div class="claim-showdown-grid">
        <div class="claim-side plaintiff"><div class="claim-side-label">⚔️ 원고측 핵심 주장</div><p>${escapeHtml(extras.plaintiffClaim)}</p></div>
        <div class="claim-versus">VS</div>
        <div class="claim-side defendant"><div class="claim-side-label">🛡️ 피고측 황당 반박</div><p>${escapeHtml(extras.defendantClaim)}</p></div>
      </div>
    </section>`);
}

function simplifyJudgmentStages(container) {
  const rename = new Map([
    ['사건의 경위', '사건 핵심'],
    ['수사 과정', 'AI 감식 결과'],
    ['재판부 판단', '재판부 최종 판단'],
  ]);
  container.querySelectorAll('.judgment-section').forEach(section => {
    const heading = section.querySelector('h2');
    const title = heading?.textContent?.trim() || '';
    if (title === '검사의 주장' || title === '변호인의 주장') {
      section.remove();
      return;
    }
    if (heading && rename.has(title)) heading.textContent = rename.get(title);
  });
}

function decorateResult(container, original) {
  decorateEmergencyBriefing(container, original.extras);
  decorateComedyLines(container, original.extras);
  decorateOriginalCase(container, original);
  decorateClaims(container, original.extras);
  simplifyJudgmentStages(container);
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
