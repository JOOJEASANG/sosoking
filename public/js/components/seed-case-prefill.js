function setValue(el, value) {
  if (!el) return;
  el.value = value || '';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function addPrefillNotice() {
  const form = document.getElementById('submit-form');
  if (!form || document.getElementById('seed-case-prefill-notice')) return;
  form.insertAdjacentHTML('afterbegin', `
    <div id="seed-case-prefill-notice" class="card" style="padding:13px 14px;margin-bottom:16px;background:rgba(201,168,76,.1);border-color:rgba(201,168,76,.38);">
      <div style="font-size:12px;color:var(--gold);font-weight:900;margin-bottom:4px;">황당사례 모음에서 가져온 사건입니다</div>
      <div style="font-size:12px;color:var(--cream-dim);line-height:1.6;">내용은 자유롭게 수정한 뒤 접수할 수 있습니다.</div>
    </div>`);
}

function applySeedCaseDraft() {
  if (!location.hash.startsWith('#/submit')) return false;
  const raw = sessionStorage.getItem('sosoking.seedCaseDraft');
  if (!raw) return false;
  const titleEl = document.getElementById('case-title');
  const descEl = document.getElementById('case-desc');
  if (!titleEl || !descEl) return false;

  try {
    const draft = JSON.parse(raw);
    setValue(titleEl, String(draft.title || '').slice(0, 40));
    setValue(descEl, String(draft.caseDescription || '').slice(0, 320));
    setValue(document.getElementById('desired-verdict'), String(draft.desiredVerdict || '').slice(0, 160));
    setValue(document.getElementById('grievance'), String(draft.grievanceIndex || 5));
    const gv = document.getElementById('grievance-val');
    if (gv) gv.textContent = String(draft.grievanceIndex || 5);
    const pub = document.getElementById('is-public');
    if (pub && typeof draft.isPublic === 'boolean') pub.checked = draft.isPublic;
    addPrefillNotice();
    sessionStorage.removeItem('sosoking.seedCaseDraft');
    return true;
  } catch (err) {
    console.warn('seed case prefill failed', err);
    sessionStorage.removeItem('sosoking.seedCaseDraft');
    return false;
  }
}

function schedulePrefill() {
  [80, 220, 500, 900].forEach(ms => setTimeout(applySeedCaseDraft, ms));
}

window.addEventListener('hashchange', schedulePrefill);
window.addEventListener('DOMContentLoaded', schedulePrefill);
schedulePrefill();
