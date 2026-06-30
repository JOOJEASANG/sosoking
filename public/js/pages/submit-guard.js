import { auth } from '../firebase.js?v=20260630-3';
import { renderSubmit as renderSubmitForm } from './submit.js?v=20260630-8';

function loginRequired(container) {
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">소장 접수</span>
      </div>
      <div class="container" style="padding-top:24px;padding-bottom:90px;">
        <div class="card" style="padding:26px 22px;text-align:center;border-color:rgba(201,168,76,.45);">
          <div style="font-size:52px;margin-bottom:12px;">🔐</div>
          <div style="font-family:var(--font-serif);font-size:21px;font-weight:900;color:var(--gold);margin-bottom:8px;">로그인 후 접수할 수 있습니다</div>
          <div style="font-size:13px;color:var(--cream-dim);line-height:1.8;margin-bottom:22px;">
            사건 접수, 내 사건 기록, 판결문 관리를 위해<br>
            구글 또는 이메일 로그인이 필요합니다.
          </div>
          <a href="#/auth" class="btn btn-primary">로그인하고 사건 접수하기</a>
          <a href="#/board" class="btn btn-ghost" style="margin-top:10px;">공개 판결 먼저 보기</a>
        </div>
      </div>
    </div>`;
}

export async function renderSubmit(container) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    loginRequired(container);
    return;
  }
  await renderSubmitForm(container);
}
