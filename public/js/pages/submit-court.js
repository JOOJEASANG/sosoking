import { renderSubmit as renderBaseSubmit } from './submit.js?v=20260730-configurable-limit-1';

function enforcePrivateFirstSubmission(container) {
  const publicInput = container.querySelector('#is-public');
  const publicCard = publicInput?.closest('.card');
  if (!publicInput || !publicCard) return;

  publicCard.innerHTML = `
    <input type="checkbox" id="is-public" hidden disabled aria-hidden="true">
    <div role="note" style="display:flex;gap:11px;align-items:flex-start;">
      <div aria-hidden="true" style="font-size:22px;line-height:1;">🔒</div>
      <div style="min-width:0;">
        <div style="font-weight:900;color:var(--gold);margin-bottom:5px;">판결문은 먼저 비공개로 생성됩니다</div>
        <div style="font-size:12px;line-height:1.7;color:var(--cream-dim);">
          AI 결과를 직접 확인한 뒤 결과 화면에서 공개할 수 있습니다. 공개 여부를 바꿔도 이미 생성된 AI 판결문은 다시 작성하거나 손상시키지 않습니다.
        </div>
      </div>
    </div>`;
}

export async function renderSubmit(container) {
  await renderBaseSubmit(container);
  enforcePrivateFirstSubmission(container);
}
