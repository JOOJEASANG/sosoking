export function renderPrivacy() {
  const element = document.getElementById('page-content');
  element.innerHTML = `
    <div class="legal-page">
      <div class="legal-page__header">
        <h1 class="legal-page__title">개인정보처리방침</h1>
        <p class="legal-page__updated">시행일·최종 수정: 2026년 6월 23일</p>
      </div>

      <div class="card legal-card">
        <div class="legal-body">
          <div class="legal-notice">
            소소킹은 AI 캐릭터 판결·창작·상담, 생활자료와 토론, 계정 기능을 제공하는 데 필요한 최소한의 정보만 처리합니다.
            AI 결과 기록은 로그인한 이용자 본인에게만 표시되며, 공개 게시물과 구분하여 관리합니다.
          </div>

          <h2 class="legal-h2">1. 처리하는 개인정보 항목</h2>
          <div class="legal-table-wrap">
            <table class="legal-table">
              <thead><tr><th>구분</th><th>처리 항목</th><th>처리 시점</th></tr></thead>
              <tbody>
                <tr><td>회원가입·로그인</td><td>이메일, Firebase UID, 소셜 로그인 제공자가 전달한 이름·닉네임·프로필 사진</td><td>가입 또는 로그인 시</td></tr>
                <tr><td>프로필</td><td>닉네임, 프로필 아이콘, 이용자가 직접 선택한 이미지</td><td>내정보 설정 시</td></tr>
                <tr><td>AI 놀이터</td><td>이용자가 입력한 상황·문장·고민, 선택한 캐릭터, 생성 결과, 생성 시각, 기능별 이용 횟수</td><td>판결소·창작소·상담소 이용 시</td></tr>
                <tr><td>자료실·토론</td><td>찬반 선택, 댓글, 작성 시각, 작성자 UID와 닉네임</td><td>투표·댓글 참여 시</td></tr>
                <tr><td>커뮤니티</td><td>게시물, 댓글, 이미지, 반응, 스크랩, 신고 내역</td><td>관련 기능 이용 시</td></tr>
                <tr><td>자동 생성 정보</td><td>접속 기록, 브라우저 정보, 오류·보안 기록, 비정상 이용 방지용 횟수와 시각</td><td>서비스 이용 시</td></tr>
              </tbody>
            </table>
          </div>

          <h2 class="legal-h2">2. 이용 목적</h2>
          <ul class="legal-list">
            <li>회원 가입, 로그인, 계정과 프로필 관리</li>
            <li>AI 캐릭터 결과 생성, 최근 결과 다시 보기, 복사·공유·삭제 기능 제공</li>
            <li>자료실의 찬반 투표, 댓글, 토론 순위와 이용자별 참여 상태 제공</li>
            <li>게시물, 스크랩, 알림, 신고 등 커뮤니티 기능 제공</li>
            <li>중복 요청, 도배, 자동화된 비정상 이용 방지</li>
            <li>오류 분석, 서비스 안정성 확보와 품질 개선</li>
          </ul>

          <h2 class="legal-h2">3. 보유 및 이용 기간</h2>
          <ul class="legal-list">
            <li>회원과 프로필 정보는 회원 탈퇴 또는 이용자의 삭제 요청 시까지 보유합니다.</li>
            <li>개인 AI 결과는 최근 50개까지만 보관하며, 이용자가 개별 삭제하거나 회원 탈퇴하면 삭제합니다.</li>
            <li>AI 기능 이용 횟수와 비정상 이용 방지 기록은 기능 제한과 보안에 필요한 기간 동안 보관할 수 있습니다.</li>
            <li>공개 게시물과 댓글은 서비스 흐름 유지를 위해 탈퇴 후 작성자 정보를 익명 또는 비식별 처리하여 남을 수 있습니다.</li>
            <li>신고·분쟁·보안 기록은 관련 절차 종료 및 법적 의무 이행에 필요한 기간 동안 보관할 수 있습니다.</li>
            <li>관련 법령에 별도 보관 기간이 정해진 경우 해당 기간을 따릅니다.</li>
          </ul>

          <h2 class="legal-h2">4. 회원 탈퇴 시 처리</h2>
          <div class="legal-table-wrap">
            <table class="legal-table">
              <thead><tr><th>항목</th><th>처리 방식</th></tr></thead>
              <tbody>
                <tr><td>계정·프로필</td><td>Firebase 인증 계정과 서비스 내 회원 정보를 삭제합니다.</td></tr>
                <tr><td>개인 AI 입력·결과</td><td>사용자 전용 AI 결과 하위 컬렉션을 함께 삭제합니다.</td></tr>
                <tr><td>공개 게시물·댓글</td><td>서비스 흐름과 다른 이용자의 대화 보호를 위해 익명 처리 후 유지될 수 있습니다.</td></tr>
                <tr><td>스크랩·개인 설정</td><td>계정 삭제 처리와 함께 삭제합니다.</td></tr>
                <tr><td>신고·분쟁 기록</td><td>관련 절차와 법적 의무가 끝날 때까지 제한적으로 보관할 수 있습니다.</td></tr>
              </tbody>
            </table>
          </div>

          <h2 class="legal-h2">5. 외부 서비스와 처리 위탁</h2>
          <div class="legal-table-wrap">
            <table class="legal-table">
              <thead><tr><th>서비스</th><th>이용 목적</th><th>처리될 수 있는 정보</th></tr></thead>
              <tbody>
                <tr><td>Google Firebase</td><td>인증, 데이터베이스, 파일 저장, 서버 기능, 호스팅</td><td>계정 정보, 서비스 이용 데이터, 게시물·댓글·AI 결과</td></tr>
                <tr><td>Google·카카오</td><td>소셜 로그인</td><td>로그인 제공자가 동의 범위에서 전달하는 식별·프로필 정보</td></tr>
                <tr><td>Google Gemini 또는 Anthropic</td><td>AI 판결·문장 변환·작명·상담 결과 생성</td><td>이용자가 AI 기능에 직접 입력한 텍스트와 생성에 필요한 캐릭터 지시문</td></tr>
              </tbody>
            </table>
          </div>
          <p style="font-size:13px;color:var(--color-text-muted);margin-top:8px">
            AI 제공사에는 결과 생성에 필요한 입력만 전달하며, 소소킹 로그인 비밀번호나 관리용 인증 정보는 전달하지 않습니다.
          </p>

          <h2 class="legal-h2">6. 쿠키와 로컬 저장소</h2>
          <ul class="legal-list">
            <li>로그인 상태 유지, 테마 설정, 앱 설치 상태와 화면 편의를 위해 쿠키·localStorage·Firebase 인증 토큰을 사용할 수 있습니다.</li>
            <li>브라우저에서 저장 기능을 제한하면 로그인 유지나 일부 화면 기능이 정상 작동하지 않을 수 있습니다.</li>
          </ul>

          <h2 class="legal-h2">7. 이용자의 권리</h2>
          <ul class="legal-list">
            <li>이용자는 본인 정보의 열람, 수정, 삭제와 처리 정지를 요청할 수 있습니다.</li>
            <li>닉네임, 프로필 아이콘, 개인 AI 결과는 내정보 화면에서 직접 관리할 수 있습니다.</li>
            <li>회원 탈퇴는 내정보의 설정 화면에서 직접 진행할 수 있습니다.</li>
            <li>공개 게시물이나 댓글 삭제가 별도로 필요한 경우 서비스 내 문의 또는 신고 기능으로 요청할 수 있습니다.</li>
          </ul>

          <h2 class="legal-h2">8. 보호 조치</h2>
          <ul class="legal-list">
            <li>Firebase 인증과 보안 규칙을 통해 이용자별 데이터 접근을 제한합니다.</li>
            <li>개인 AI 결과는 서버 함수에서 인증된 UID를 기준으로 저장·조회·삭제합니다.</li>
            <li>AI 제공사 인증 정보는 공개 데이터베이스나 프런트엔드 코드가 아닌 관리형 비밀 저장소에서 사용합니다.</li>
            <li>댓글과 AI 결과 저장에는 횟수 제한과 입력 길이 검사를 적용합니다.</li>
            <li>관리자 기능은 별도 권한이 확인된 계정에만 제공합니다.</li>
          </ul>

          <h2 class="legal-h2">9. 개인정보 관련 문의</h2>
          <ul class="legal-list">
            <li><b>책임자:</b> 소소킹 운영팀</li>
            <li><b>문의 방법:</b> 서비스 내 문의 또는 신고 기능</li>
            <li>개인정보 침해에 관한 상담이나 신고는 개인정보보호위원회 또는 한국인터넷진흥원 등 관계 기관을 이용할 수 있습니다.</li>
          </ul>

          <h2 class="legal-h2">10. 방침 변경</h2>
          <p>서비스 구조나 관련 법령의 변경으로 본 방침을 수정하는 경우 시행 전에 서비스 화면을 통해 안내합니다.</p>

          <div class="legal-footer-note">
            시행일: 2026년 6월 23일 &nbsp;|&nbsp; 문의: 서비스 내 문의 또는 신고 기능
          </div>
        </div>
      </div>
    </div>`;
}
