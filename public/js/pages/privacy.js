const YEAR = new Date().getFullYear();

export function renderPrivacy() {
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div class="legal-page">
      <div class="legal-page__header">
        <h1 class="legal-page__title">개인정보처리방침</h1>
        <p class="legal-page__updated">시행일: 2025년 6월 1일 · 최종 수정: ${YEAR}년</p>
      </div>

      <div class="card legal-card">
        <div class="legal-body">
          <div class="legal-notice">
            소소킹은 이용자의 개인정보를 안전하게 처리하기 위해 필요한 최소한의 정보만 수집·이용합니다.
          </div>

          <h2 class="legal-h2">1. 수집하는 개인정보 항목</h2>
          <div class="legal-table-wrap">
            <table class="legal-table">
              <thead><tr><th>구분</th><th>수집 항목</th><th>수집 시점</th></tr></thead>
              <tbody>
                <tr><td>Google 로그인</td><td>이름, 이메일, 프로필 사진 URL, Firebase UID</td><td>소셜 로그인 시</td></tr>
                <tr><td>이메일 로그인</td><td>이메일 주소, Firebase UID, 닉네임</td><td>회원가입·로그인 시</td></tr>
                <tr><td>서비스 이용</td><td>게시물, 댓글, 선택지, 퀴즈 정답, 리액션, 스크랩, 신고 내역</td><td>서비스 이용 중</td></tr>
                <tr><td>자동 수집</td><td>접속 기록, 브라우저 정보, 오류 기록, 보안 관련 로그</td><td>서비스 접속 및 이용 시</td></tr>
              </tbody>
            </table>
          </div>

          <h2 class="legal-h2">2. 개인정보 이용 목적</h2>
          <ul class="legal-list">
            <li>회원 가입, 로그인, 본인 확인 및 계정 관리</li>
            <li>게시물 작성자 표시, 댓글·투표·퀴즈·리액션 등 커뮤니티 기능 제공</li>
            <li>스크랩, 알림, 명예의 전당, 미션 참여 등 개인화 기능 제공</li>
            <li>신고 처리, 부정 이용 방지, 서비스 보안 유지</li>
            <li>서비스 운영 통계, 오류 분석, 품질 개선</li>
          </ul>

          <h2 class="legal-h2">3. 보유 및 이용 기간</h2>
          <ul class="legal-list">
            <li>회원 정보는 회원 탈퇴 또는 삭제 요청 시까지 보유합니다.</li>
            <li>게시물과 댓글은 서비스 흐름 유지를 위해 탈퇴 후에도 익명 처리되어 유지될 수 있습니다.</li>
            <li>신고, 보안, 부정 이용 관련 기록은 분쟁 대응과 서비스 보호를 위해 필요한 기간 보관될 수 있습니다.</li>
            <li>법령에 따라 보관이 필요한 정보는 해당 법령에서 정한 기간 동안 보관합니다.</li>
          </ul>

          <h2 class="legal-h2">4. 개인정보 처리 위탁 및 외부 서비스</h2>
          <div class="legal-table-wrap">
            <table class="legal-table">
              <thead><tr><th>업체명</th><th>이용 목적</th><th>처리 정보</th></tr></thead>
              <tbody>
                <tr><td>Google Firebase</td><td>인증, 데이터베이스, 파일 저장, 서버리스 기능</td><td>계정 정보, 게시물, 댓글, 서비스 이용 데이터</td></tr>
                <tr><td>Google Analytics 또는 유사 분석 도구</td><td>접속 통계 및 서비스 개선</td><td>비식별 이용 기록</td></tr>
              </tbody>
            </table>
          </div>
          <p style="font-size:13px;color:var(--color-text-muted);margin-top:8px">
            Google 개인정보처리방침:
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener" style="color:var(--color-primary)">https://policies.google.com/privacy</a>
          </p>

          <h2 class="legal-h2">5. 쿠키 및 로컬 저장소</h2>
          <ul class="legal-list">
            <li>서비스는 로그인 상태 유지와 화면 설정 저장을 위해 쿠키, localStorage, Firebase 인증 토큰을 사용할 수 있습니다.</li>
            <li>브라우저 설정에서 쿠키를 제한할 수 있으나 일부 기능이 정상 작동하지 않을 수 있습니다.</li>
          </ul>

          <h2 class="legal-h2">6. 이용자의 권리</h2>
          <ul class="legal-list">
            <li>이용자는 본인의 개인정보 열람, 수정, 삭제, 처리 정지를 요청할 수 있습니다.</li>
            <li>닉네임 등 일부 정보는 내 정보 페이지에서 직접 수정할 수 있습니다.</li>
            <li>계정 삭제 또는 개인정보 관련 요청은 서비스 내 신고/문의 기능을 통해 접수할 수 있습니다.</li>
            <li>요청 내용은 관련 법령과 서비스 운영상 필요한 범위 내에서 처리됩니다.</li>
          </ul>

          <h2 class="legal-h2">7. 개인정보 보호 조치</h2>
          <ul class="legal-list">
            <li>Firebase 인증과 보안 규칙을 통해 계정 및 데이터 접근을 제한합니다.</li>
            <li>관리자 기능은 권한이 확인된 계정에 한해 제공됩니다.</li>
            <li>비밀번호는 Firebase 인증 시스템을 통해 처리되며, 서비스 운영자가 평문 비밀번호를 저장하지 않습니다.</li>
          </ul>

          <h2 class="legal-h2">8. 개인정보 보호 책임자</h2>
          <ul class="legal-list">
            <li><b>책임자:</b> 소소킹 운영팀</li>
            <li><b>문의:</b> 서비스 내 신고/문의 기능 이용</li>
            <li>개인정보 침해 신고는 개인정보보호위원회 또는 한국인터넷진흥원에 하실 수 있습니다.</li>
          </ul>

          <h2 class="legal-h2">9. 방침 변경</h2>
          <p>본 방침이 변경되는 경우 서비스 내 공지 또는 화면 게시를 통해 안내합니다.</p>

          <div class="legal-footer-note">
            시행일: 2025년 6월 1일 &nbsp;|&nbsp; 문의: 서비스 내 신고 기능 이용
          </div>
        </div>
      </div>
    </div>`;
}
