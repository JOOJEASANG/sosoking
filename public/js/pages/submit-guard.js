import { auth } from '../firebase.js?v=20260630-3';
import { renderSubmit as renderSubmitForm } from './submit-court.js?v=20260702-10';

function loginRequired(container) {
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">한 줄 분쟁 접수</span>
      </div>
      <div class="container" style="padding-top:24px;padding-bottom:90px;">
        <div class="court-shell" style="padding:26px 22px;text-align:center;">
          <div class="court-seal" style="margin-bottom:12px;">🔐</div>
          <div class="court-kicker">LOGIN REQUIRED</div>
          <div class="court-title" style="margin-bottom:8px;">로그인 후 분쟁을 접수할 수 있습니다</div>
          <div class="court-desc" style="margin-bottom:22px;">
            내 접수 기록, 결정문 확인, 공개 여부 관리를 위해<br>
            구글 또는 이메일 로그인이 필요합니다.
          </div>
          <a href="#/auth" class="btn btn-primary">로그인하고 바로 접수하기</a>
          <a href="#/board" class="btn btn-ghost" style="margin-top:10px;">공개 기록 보기</a>
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