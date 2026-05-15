export function renderPrivacy() {
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div style="max-width:720px;margin:0 auto">
      <div class="section-header">
        <h1 class="section-title">개인정보처리방침</h1>
      </div>
      <div class="card">
        <div class="card__body--lg" style="line-height:1.9;font-size:14px;color:var(--color-text-secondary)">
          <h2 style="font-size:16px;font-weight:800;color:var(--color-text-primary);margin-bottom:8px">1. 수집하는 개인정보</h2>
          <ul style="padding-left:16px">
            <li>Google 로그인 시: 이름, 이메일, 프로필 사진</li>
            <li>이메일 가입 시: 이메일 주소</li>
            <li>서비스 이용 시: 작성한 게시물, 댓글, 반응(이모지)</li>
          </ul>
          <h2 style="font-size:16px;font-weight:800;color:var(--color-text-primary);margin:20px 0 8px">2. 개인정보 이용 목적</h2>
          <ul style="padding-left:16px">
            <li>서비스 회원 가입 및 관리</li>
            <li>게시물 작성자 표시</li>
            <li>서비스 운영 통계 분석</li>
          </ul>
          <h2 style="font-size:16px;font-weight:800;color:var(--color-text-primary);margin:20px 0 8px">3. 보유 및 이용 기간</h2>
          <p>회원 탈퇴 시까지 보유합니다. 단, 관련 법령에 따라 일정 기간 보관이 필요한 정보는 해당 기간 동안 보유합니다.</p>
          <h2 style="font-size:16px;font-weight:800;color:var(--color-text-primary);margin:20px 0 8px">4. 제3자 제공</h2>
          <p>서비스는 Firebase(Google)를 통해 인증 및 데이터를 저장합니다. Firebase의 개인정보처리방침은 <a href="https://policies.google.com/privacy" target="_blank" style="color:var(--color-primary)">여기</a>에서 확인하세요.</p>
          <h2 style="font-size:16px;font-weight:800;color:var(--color-text-primary);margin:20px 0 8px">5. 이용자 권리</h2>
          <ul style="padding-left:16px">
            <li>개인정보 열람, 수정, 삭제를 요청할 수 있습니다.</li>
            <li>계정 삭제 시 모든 개인정보가 삭제됩니다.</li>
          </ul>
          <p style="margin-top:20px;color:var(--color-text-muted);font-size:13px">시행일: 2025년 1월 1일</p>
        </div>
      </div>
    </div>`;
}
