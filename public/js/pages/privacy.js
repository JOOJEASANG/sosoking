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
            소소킹은 이용자의 개인정보를 소중히 여깁니다.
            본 방침은 어떤 정보를 수집하고, 어떻게 사용하는지 투명하게 안내합니다.
          </div>

          <h2 class="legal-h2">1. 수집하는 개인정보 항목</h2>
          <div class="legal-table-wrap">
            <table class="legal-table">
              <thead><tr><th>구분</th><th>수집 항목</th><th>수집 시점</th></tr></thead>
              <tbody>
                <tr><td>Google 로그인</td><td>이름, 이메일, 프로필 사진 URL, 고유 식별자(UID)</td><td>소셜 로그인 시</td></tr>
                <tr><td>이메일 가입</td><td>이메일 주소, 닉네임(직접 입력)</td><td>회원 가입 시</td></tr>
                <tr><td>서비스 이용</td><td>게시물, 댓글, 반응(이모지), 스크랩 내역</td><td>서비스 이용 중</td></tr>
                <tr><td>자동 수집</td><td>접속 IP, 브라우저 종류, 방문 일시, 서비스 이용 기록</td><td>서비스 접속 시</td></tr>
              </tbody>
            </table>
          </div>

          <h2 class="legal-h2">2. 개인정보 이용 목적</h2>
          <ul class="legal-list">
            <li>회원 가입·관리 및 본인 확인</li>
            <li>게시물 작성자 표시 및 커뮤니티 활동 지원</li>
            <li>서비스 운영 통계 분석 및 품질 개선</li>
            <li>불법·부정 이용 방지 및 서비스 보안 유지</li>
            <li>고지사항 전달 및 공지 발송</li>
          </ul>

          <h2 class="legal-h2">3. 보유 및 이용 기간</h2>
          <ul class="legal-list">
            <li><b>원칙:</b> 회원 탈퇴 또는 개인정보 삭제 요청 시까지 보유합니다.</li>
            <li><b>예외:</b> 관련 법령에 따라 일정 기간 보관이 필요한 정보는 해당 기간 보유합니다.
              <ul style="margin-top:6px;margin-left:16px">
                <li>전자상거래 기록: 5년 (전자상거래법)</li>
                <li>접속 로그: 3개월 (통신비밀보호법)</li>
                <li>불법 행위 관련 기록: 필요 시 최대 1년</li>
              </ul>
            </li>
            <li>탈퇴 후 게시물은 즉시 삭제되지 않을 수 있으며, 익명 처리 후 일정 기간 유지될 수 있습니다.</li>
          </ul>

          <h2 class="legal-h2">4. 제3자 제공 및 위탁</h2>
          <div class="legal-table-wrap">
            <table class="legal-table">
              <thead><tr><th>업체명</th><th>제공·위탁 목적</th><th>보유 기간</th></tr></thead>
              <tbody>
                <tr><td>Google Firebase</td><td>인증, 데이터베이스, 파일 저장, 서버리스 함수 실행</td><td>위탁 계약 종료 시까지</td></tr>
                <tr><td>Google Analytics</td><td>서비스 이용 통계 분석 (비식별 데이터)</td><td>26개월</td></tr>
              </tbody>
            </table>
          </div>
          <p style="font-size:13px;color:var(--color-text-muted);margin-top:8px">
            Firebase 개인정보처리방침:
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener"
               style="color:var(--color-primary)">https://policies.google.com/privacy</a>
          </p>

          <h2 class="legal-h2">5. 쿠키 및 추적 기술</h2>
          <ul class="legal-list">
            <li>서비스는 로그인 상태 유지를 위해 브라우저의 localStorage 및 세션 토큰을 사용합니다.</li>
            <li>Google Firebase SDK가 내부적으로 세션 관리용 쿠키를 사용할 수 있습니다.</li>
            <li>브라우저 설정에서 쿠키를 거부할 수 있으나, 일부 서비스 기능이 제한될 수 있습니다.</li>
          </ul>

          <h2 class="legal-h2">6. 이용자의 권리</h2>
          <ul class="legal-list">
            <li><b>열람:</b> 본인의 개인정보 처리 현황을 언제든지 확인할 수 있습니다.</li>
            <li><b>수정:</b> 내 정보 페이지에서 닉네임 등을 직접 수정할 수 있습니다.</li>
            <li><b>삭제·탈퇴:</b> 내 정보 &gt; 설정 탭 &gt; 회원 탈퇴를 통해 계정을 삭제할 수 있습니다.</li>
            <li><b>처리 정지:</b> 개인정보 처리 정지를 요청할 수 있으며, 법령에 따라 처리될 수 있습니다.</li>
            <li>권리 행사는 서비스 내 신고/문의 기능 또는 이메일을 통해 요청하세요.</li>
          </ul>

          <h2 class="legal-h2">7. 개인정보 보호 책임자</h2>
          <ul class="legal-list">
            <li><b>책임자:</b> 소소킹 운영팀</li>
            <li><b>문의:</b> 서비스 내 신고 기능 이용</li>
            <li>개인정보 침해 관련 신고는 개인정보보호위원회(privacy.go.kr) 또는
              한국인터넷진흥원(kisa.or.kr)에 하실 수 있습니다.</li>
          </ul>

          <h2 class="legal-h2">8. 개인정보 유출 시 대응</h2>
          <ul class="legal-list">
            <li>개인정보 유출 사실이 확인된 경우, 72시간 이내에 이용자에게 통지합니다.</li>
            <li>통지 내용: 유출된 항목, 유출 시점, 이용자 피해 최소화 방법, 대응 조치</li>
          </ul>

          <h2 class="legal-h2">9. 방침 변경</h2>
          <p>본 방침이 변경될 경우 시행 7일 전에 서비스 공지사항을 통해 안내합니다.
            중요한 변경 사항이 있을 경우 이메일 또는 팝업으로 별도 고지합니다.</p>

          <div class="legal-footer-note">
            시행일: 2025년 6월 1일 &nbsp;|&nbsp; 문의: 서비스 내 신고 기능 이용
          </div>
        </div>
      </div>
    </div>`;
}
