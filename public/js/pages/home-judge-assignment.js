import { renderHome as renderBaseHome } from './home-court.js?v=20260730-configurable-limit-1';

function addJudgeAssignmentNotice(container) {
  const courtShell = container.querySelector('#court-entrance .court-shell');
  if (!courtShell || container.querySelector('#judge-assignment-notice')) return;

  courtShell.insertAdjacentHTML('beforeend', `
    <div id="judge-assignment-notice" role="note" style="margin-top:16px;padding:15px 16px;border:1px solid rgba(201,168,76,.42);border-radius:14px;background:rgba(201,168,76,.09);display:flex;gap:12px;align-items:flex-start;">
      <div aria-hidden="true" style="font-size:25px;line-height:1;">🎲</div>
      <div style="min-width:0;">
        <div style="font-size:14px;font-weight:900;color:var(--gold-light);margin-bottom:5px;">담당 판사는 자동 배정됩니다</div>
        <div style="font-size:12px;line-height:1.7;color:var(--cream-dim);">실제 재판에서 당사자가 담당 판사를 직접 선택하지 않는 것처럼, 사건을 접수하면 7명의 AI 판사 중 한 명이 자동으로 배정됩니다. 어떤 판사가 맡을지는 재판이 시작될 때 확인할 수 있습니다.</div>
      </div>
    </div>`);
}

export async function renderHome(container) {
  await renderBaseHome(container);
  addJudgeAssignmentNotice(container);
}
