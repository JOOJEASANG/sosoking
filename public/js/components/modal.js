/* modal.js — 범용 모달 컴포넌트 */

let activeModal = null;

/**
 * 모달 열기
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.body    - HTML string
 * @param {Array}  opts.actions - [{label, primary, onClick}]
 */
export function openModal({ title = '', body = '', actions = [] } = {}) {
  closeModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${escHtml(title)}">
      <div class="modal__header">
        <div class="modal__title">${escHtml(title)}</div>
        <button class="modal__close" id="modal-close-btn" aria-label="닫기">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal__body">${body}</div>
      ${actions.length ? `
        <div class="modal__footer">
          ${actions.map((a, i) => `
            <button class="btn ${a.primary ? 'btn--primary' : 'btn--ghost'}" data-action="${i}">
              ${escHtml(a.label)}
            </button>`).join('')}
        </div>` : ''}
    </div>`;

  document.body.appendChild(overlay);
  activeModal = overlay;

  overlay.querySelector('#modal-close-btn').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  actions.forEach((action, i) => {
    overlay.querySelector(`[data-action="${i}"]`)?.addEventListener('click', () => {
      action.onClick?.();
      if (action.closeOnClick !== false) closeModal();
    });
  });

  document.addEventListener('keydown', handleEsc);
  return overlay;
}

export function closeModal() {
  if (activeModal) {
    activeModal.remove();
    activeModal = null;
  }
  document.removeEventListener('keydown', handleEsc);
}

function handleEsc(e) {
  if (e.key === 'Escape') closeModal();
}

/** 확인 다이얼로그 (Promise 반환) */
export function confirmModal(message, title = '확인') {
  return new Promise((resolve) => {
    openModal({
      title,
      body: `<p style="font-size:14px;line-height:1.7;color:var(--color-text-secondary)">${escHtml(message)}</p>`,
      actions: [
        { label: '취소',  primary: false, onClick: () => resolve(false) },
        { label: '확인',  primary: true,  onClick: () => resolve(true)  },
      ],
    });
  });
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
