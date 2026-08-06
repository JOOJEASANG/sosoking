import { auth } from './firebase.js?v=20260729-auth-session-1';

const DRAFT_PREFIX = 'sosoking:case-submit-draft:v1:';
const AUTO_SAVE_DELAY_MS = 500;
const MAX_DESCRIPTION_LENGTH = 600;

let activeForm = null;
let activeSaveTimer = null;

function draftKey() {
  const uid = auth.currentUser?.uid;
  return uid ? `${DRAFT_PREFIX}${uid}` : '';
}

function draftElements(form = activeForm) {
  if (!form) return {};
  return {
    form,
    description: form.querySelector('#case-desc'),
    status: form.querySelector('#submit-draft-status'),
    saveButton: form.querySelector('#submit-draft-save'),
    clearButton: form.querySelector('#submit-draft-clear')
  };
}

function setDraftStatus(message, tone = 'normal', form = activeForm) {
  const status = draftElements(form).status;
  if (!status) return;
  status.textContent = message;
  status.style.color = tone === 'error'
    ? 'var(--red)'
    : tone === 'saved'
      ? 'var(--gold)'
      : 'var(--cream-dim)';
}

function formatSavedAt(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function readDraft() {
  const key = draftKey();
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || typeof parsed.description !== 'string') return null;
    return {
      description: parsed.description.slice(0, MAX_DESCRIPTION_LENGTH),
      updatedAt: Number(parsed.updatedAt) || 0
    };
  } catch (error) {
    console.warn('case draft read failed:', error);
    return null;
  }
}

function removeDraft({ updateStatus = true } = {}) {
  const key = draftKey();
  if (!key) return false;
  try {
    localStorage.removeItem(key);
    if (updateStatus) setDraftStatus('임시저장된 내용이 삭제되었습니다.');
    return true;
  } catch (error) {
    console.warn('case draft removal failed:', error);
    if (updateStatus) setDraftStatus('임시저장 내용을 삭제하지 못했습니다.', 'error');
    return false;
  }
}

function persistDraft(form = activeForm, { manual = false } = {}) {
  const { description } = draftElements(form);
  const key = draftKey();
  if (!description || !key) return false;

  const value = description.value.slice(0, MAX_DESCRIPTION_LENGTH);
  if (!value.trim()) {
    removeDraft({ updateStatus: false });
    setDraftStatus('입력을 시작하면 이 브라우저에 자동 저장됩니다.', 'normal', form);
    return true;
  }

  const updatedAt = Date.now();
  try {
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      description: value,
      updatedAt
    }));
    const label = manual ? '임시저장 완료' : '자동 저장됨';
    setDraftStatus(`${label} · ${formatSavedAt(updatedAt)}`, 'saved', form);
    return true;
  } catch (error) {
    console.warn('case draft save failed:', error);
    setDraftStatus('이 브라우저에서는 임시저장을 사용할 수 없습니다.', 'error', form);
    return false;
  }
}

function scheduleDraftSave(form) {
  if (activeSaveTimer) clearTimeout(activeSaveTimer);
  setDraftStatus('입력 내용을 저장하는 중입니다…', 'normal', form);
  activeSaveTimer = setTimeout(() => {
    activeSaveTimer = null;
    if (form.isConnected) persistDraft(form);
  }, AUTO_SAVE_DELAY_MS);
}

function restoreDraft(form) {
  const { description } = draftElements(form);
  if (!description || description.value) return;
  const draft = readDraft();
  if (!draft?.description) {
    setDraftStatus('입력을 시작하면 이 브라우저에 자동 저장됩니다.', 'normal', form);
    return;
  }

  description.value = draft.description;
  description.dispatchEvent(new Event('input', { bubbles: true }));
  const savedAt = formatSavedAt(draft.updatedAt);
  setDraftStatus(
    savedAt ? `임시저장 내용을 불러왔습니다 · ${savedAt}` : '임시저장 내용을 불러왔습니다.',
    'saved',
    form
  );
}

function addDraftPanel(form) {
  const description = form.querySelector('#case-desc');
  const group = description?.closest('.form-group');
  if (!description || !group || form.querySelector('#submit-draft-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'submit-draft-panel';
  panel.className = 'card';
  panel.style.cssText = 'padding:14px;margin:-4px 0 18px;background:rgba(201,168,76,.06);border-color:rgba(201,168,76,.28);';
  panel.innerHTML = `
    <div style="display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;">
      <div style="min-width:0;flex:1 1 210px;">
        <div style="font-weight:900;color:var(--gold);margin-bottom:5px;">접수 내용 임시저장</div>
        <div id="submit-draft-status" role="status" aria-live="polite" style="font-size:11px;line-height:1.65;color:var(--cream-dim);">
          입력을 시작하면 이 브라우저에 자동 저장됩니다.
        </div>
        <div style="font-size:10px;line-height:1.55;color:var(--cream-dim);opacity:.72;margin-top:3px;">
          같은 계정과 브라우저에서 다시 사건 접수 화면을 열면 이어서 수정할 수 있습니다.
        </div>
      </div>
      <div style="display:flex;gap:7px;flex:1 1 200px;justify-content:flex-end;">
        <button type="button" class="btn btn-ghost" id="submit-draft-save" style="margin:0;padding:9px 11px;min-height:38px;flex:1;white-space:nowrap;">지금 임시저장</button>
        <button type="button" class="btn btn-ghost" id="submit-draft-clear" style="margin:0;padding:9px 11px;min-height:38px;flex:1;white-space:nowrap;">임시본 삭제</button>
      </div>
    </div>`;
  group.insertAdjacentElement('afterend', panel);
}

function attachDraftBehavior(form) {
  if (!form || form.dataset.submitDraftAttached === 'true') return;
  form.dataset.submitDraftAttached = 'true';
  activeForm = form;
  addDraftPanel(form);

  const { description, saveButton, clearButton } = draftElements(form);
  if (!description || !saveButton || !clearButton) return;

  description.addEventListener('input', () => scheduleDraftSave(form));
  saveButton.addEventListener('click', () => {
    if (activeSaveTimer) {
      clearTimeout(activeSaveTimer);
      activeSaveTimer = null;
    }
    persistDraft(form, { manual: true });
  });
  clearButton.addEventListener('click', () => {
    const hasStoredDraft = Boolean(readDraft()?.description);
    if (!description.value && !hasStoredDraft) {
      setDraftStatus('삭제할 임시저장 내용이 없습니다.', 'normal', form);
      return;
    }
    if (!confirm('임시저장된 사건 내용과 현재 입력란을 모두 비울까요?')) return;
    if (activeSaveTimer) {
      clearTimeout(activeSaveTimer);
      activeSaveTimer = null;
    }
    removeDraft({ updateStatus: false });
    description.value = '';
    description.dispatchEvent(new Event('input', { bubbles: true }));
    setDraftStatus('입력 내용과 임시본을 비웠습니다.', 'normal', form);
    description.focus();
  });

  form.addEventListener('submit', () => persistDraft(form), { capture: true });
  restoreDraft(form);
}

function findAndAttachSubmitForm() {
  const form = document.querySelector('#submit-form');
  if (form) attachDraftBehavior(form);
}

const observer = new MutationObserver(findAndAttachSubmitForm);
observer.observe(document.body, { childList: true, subtree: true });
queueMicrotask(findAndAttachSubmitForm);

window.addEventListener('hashchange', () => {
  if (!activeForm?.isConnected) return;
  const nextHash = location.hash || '#/';
  if (nextHash.startsWith('#/trial/')) {
    if (activeSaveTimer) {
      clearTimeout(activeSaveTimer);
      activeSaveTimer = null;
    }
    removeDraft({ updateStatus: false });
    activeForm = null;
    return;
  }
  persistDraft(activeForm);
});

window.addEventListener('pagehide', () => {
  if (activeForm?.isConnected) persistDraft(activeForm);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && activeForm?.isConnected) {
    persistDraft(activeForm);
  }
});
