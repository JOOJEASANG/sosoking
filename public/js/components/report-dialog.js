import { auth, functions } from '../firebase.js?v=20260729-auth-session-1';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from './toast.js?v=20260630-3';

const submitReport = httpsCallable(functions, 'submitReport');

function closeDialog(dialog, trigger) {
  dialog.remove();
  trigger?.focus();
}

function openReportDialog(caseId, trigger) {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    showToast('Google 또는 이메일 로그인 후 신고할 수 있습니다.', 'error');
    location.hash = '#/auth';
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'report-dialog-title');
  overlay.innerHTML = `
    <div class="modal" style="max-width:460px;">
      <div id="report-dialog-title" style="font-family:var(--font-serif);font-size:19px;font-weight:900;color:var(--gold);margin-bottom:8px;">판결기록 신고</div>
      <div style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-bottom:14px;">개인정보 노출, 명예훼손, 부적절한 내용 등 구체적인 사유를 적어주세요. 동일 판결문은 한 번만 신고할 수 있습니다.</div>
      <form id="report-dialog-form">
        <label class="form-label" for="report-reason">신고 사유</label>
        <textarea id="report-reason" class="form-textarea" minlength="5" maxlength="300" required placeholder="예: 전화번호가 포함되어 있어 개인정보 노출 우려가 있습니다." style="min-height:120px;"></textarea>
        <div style="display:flex;gap:8px;margin-top:16px;">
          <button type="button" class="btn btn-ghost" id="report-cancel" style="flex:1;">취소</button>
          <button type="submit" class="btn btn-primary" id="report-submit" style="flex:1;">신고 접수</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);

  const input = overlay.querySelector('#report-reason');
  const cancel = overlay.querySelector('#report-cancel');
  const form = overlay.querySelector('#report-dialog-form');
  input?.focus();

  cancel?.addEventListener('click', () => closeDialog(overlay, trigger));
  overlay.addEventListener('click', event => {
    if (event.target === overlay) closeDialog(overlay, trigger);
  });
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeDialog(overlay, trigger);
  });
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const reason = input?.value?.trim() || '';
    if (reason.length < 5) {
      showToast('신고 사유를 5자 이상 입력해주세요.', 'error');
      return;
    }

    const button = overlay.querySelector('#report-submit');
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = '접수 중...';
    try {
      await submitReport({ caseId, reason });
      closeDialog(overlay, trigger);
      showToast('신고가 접수되었습니다. 관리자가 확인합니다.', 'success');
    } catch (error) {
      console.error('report submission failed:', error);
      const message = String(error?.message || '신고 접수에 실패했습니다.')
        .replace(/^FirebaseError:\s*/, '')
        .slice(0, 180);
      showToast(message, 'error');
      button.disabled = false;
      button.textContent = oldText;
    }
  });
}

export function attachReportButton(container, caseId) {
  const actions = container.querySelector('.result-actions');
  const publicReaction = container.querySelector('.reaction-btn:not([disabled])');
  if (!actions || !publicReaction || actions.querySelector('#btn-report') || actions.querySelector('#btn-share')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'btn-report';
  button.className = 'btn btn-ghost';
  button.textContent = '⚠️ 판결기록 신고';
  button.addEventListener('click', () => openReportDialog(caseId, button));
  actions.appendChild(button);
}
