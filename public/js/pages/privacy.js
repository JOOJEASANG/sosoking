export function renderPrivacy() {
  const element = document.getElementById('page-content');
  if (!element) return;
  element.innerHTML = `
    <div class="legal-page">
      <div class="legal-page__header">
        <h1 class="legal-page__title">개인정보처리방침</h1>
        <p class="legal-page__updated">시행일·최종 수정: 2026년 6월 26일</p>
      </div>

      <div class="card legal-card">
        <div class="legal-body">
          <div class="legal-notice">
            소소킹은 AI 캐릭터 판결·창작·상담, 생활자료실, A/B 토론실과 계정 기능을 제공하는 데 필요한 정보를 처리합니다.
            개인 AI 결과는 로그인한 이용자 본인에게만 표시되며, 회원이 공개 영역에 등록한 자료·토론·댓글·이미지는 비회원에게도 공개될 수 있습니다.
          </div>

          <h2 class="legal-h2">1. 처리하는 개인정보와 서비스 데이터</h2>
          <div class="legal-table-wrap">
            <table class="legal-table">
              <thead><tr><th>구분</th><th>처리 항목</th><th>처리 시점</th></tr></thead>
              <tbody>
                <tr><td>가입·로그인</td><td>이메일, Firebase UID, 로그인 제공자가 전달한 이름·닉네임·프로필 사진, 로그인 방식, 가입·최근 로그인 시각</td><td>가입 또는 로그인 시</td></tr>
                <tr><td>프로필</td><td>닉네임, 프로필 아이콘, 회원이 직접 설정한 이미지</td><td>내정보 설정 시</td></tr>
                <tr><td>AI 놀이터</td><td>입력한 상황·문장·고민, 선택 또는 무작위 배정된 캐릭터, 생성 결과, 생성 시각, 기능별 이용 횟수</td><td>판결소·창작소·미친 상담소 이용 시</td></tr>
                <tr><td>자료실</td><td>제목·요약·핵심 내용·태그·출처·대표 이미지, 댓글, UID·닉네임, 작성 시각, 자료별 일일 중복 조회 방지 기록</td><td>자료 등록·댓글·상세 열람 시</td></tr>
                <tr><td>토론실</td><td>상황·A/B 입장·태그·대표 이미지, A/B 투표, 댓글, UID·닉네임, 작성 시각, 토론별 일일 중복 조회 방지 기록</td><td>토론 등록·투표·댓글·상세 열람 시</td></tr>
                <tr><td>신고·문의</td><td>신고 사유, 문의 내용, 대상 게시물 ID, 신고자 UID·닉네임, 처리 상태와 관리자 처리 기록</td><td>신고·문의 기능 이용 시</td></tr>
                <tr><td>자동 생성 정보</td><td>접속 기록, 브라우저 정보, 오류·보안 기록, 비정상 이용 방지 횟수와 시각, 이미지 업로드 횟수, 서비스 작업 기록</td><td>서비스 이용 및 서버 작업 시</td></tr>
              </tbody>
            </table>
          </div>

          <h2 class="legal-h2">2. 이용 목적</h2>
          <ul class="legal-list">
            <li>회원 가입, 로그인, 계정과 프로필 관리</li>
            <li>AI 캐릭터 판결·창작·상담 결과 생성과 최근 결과 다시 보기</li>
            <li>생활자료 등록·열람·댓글과 중복 조회수 방지</li>
            <li>A/B 토론 등록·투표·실제 선택 연동 댓글과 참여 상태 제공</li>
            <li>대표 이미지 자동 최적화, 업로드, 공개 표시와 소유자 확인</li>
            <li>신고·문의 접수, 관리자 검토, 콘텐츠 공개·숨김·삭제 처리</li>
            <li>중복 요청, 도배, 자동화된 비정상 이용과 보안 위협 방지</li>
            <li>오류 분석, 서비스 안정성 확보, 사용량 관리와 품질 개선</li>
          </ul>

          <h2 class="legal-h2">3. 개인 AI 결과와 공개 콘텐츠의 구분</h2>
          <div class="legal-table-wrap">
            <table class="legal-table">
              <thead><tr><th>데이터</th><th>기본 공개 범위</th><th>설명</th></tr></thead>
              <tbody>
                <tr><td>개인 AI 입력·결과</td><td>회원 본인</td><td>계정 전용 하위 데이터에 저장하며 공개 자료·토론으로 자동 등록하지 않습니다.</td></tr>
                <tr><td>자료·토론·댓글</td><td>전체 공개</td><td>작성자 닉네임, 내용과 대표 이미지는 비회원에게도 표시될 수 있습니다.</td></tr>
                <tr><td>개별 투표·조회 기록</td><td>비공개</td><td>중복 참여 방지와 집계에 사용하며 화면에는 합계만 표시합니다.</td></tr>
                <tr><td>관리자 운영 기록</td><td>관리자 전용</td><td>생성 실패, 신고 처리, 콘텐츠 상태 변경과 시스템 점검에 사용합니다.</td></tr>
              </tbody>
            </table>
          </div>

          <h2 class="legal-h2">4. AI 처리와 자동 생성 콘텐츠</h2>
          <ul class="legal-list">
            <li>AI 놀이터를 이용하면 회원이 입력한 텍스트와 선택한 기능·캐릭터 정보가 결과 생성을 위해 AI 제공사로 전송될 수 있습니다.</li>
            <li>현재 운영 AI 공급자는 Google Gemini이며 API 인증 정보는 프런트엔드나 Firestore가 아닌 Firebase Secret Manager에서 관리합니다.</li>
            <li>일일 생활자료와 A/B 토론 생성에는 회원의 개인 AI 입력이나 비공개 결과를 사용하지 않습니다.</li>
            <li>최근 공개 콘텐츠 제목은 중복 방지를 위해 자동 생성 요청에 포함될 수 있습니다.</li>
            <li>자동 생성 결과는 별도의 AI 안전·균형 검수를 거친 뒤 승인된 경우에만 공개합니다.</li>
            <li>신고 우선순위 보조 AI는 관리자 확인 순서를 제안할 수 있지만 위반 여부를 자동 확정하거나 콘텐츠를 자동 삭제하지 않습니다.</li>
          </ul>

          <h2 class="legal-h2">5. 공개 이미지 처리</h2>
          <ul class="legal-list">
            <li>회원이 선택한 큰 이미지는 브라우저에서 긴 변 1,920px 이하, 약 1.8MB 이하로 축소·압축될 수 있습니다.</li>
            <li>이미지는 서버 업로드 함수에서 형식, 용량, 소유자 UID와 사용 목적을 다시 확인한 후 저장합니다.</li>
            <li>자료·토론 대표 이미지는 공개 화면 표시를 위해 인터넷에서 접근 가능한 저장 주소로 제공될 수 있습니다.</li>
            <li>개인정보, 주소, 연락처, 문서번호, 타인의 얼굴이나 비공개 자료가 포함된 이미지를 동의 없이 등록해서는 안 됩니다.</li>
          </ul>

          <h2 class="legal-h2">6. 보유 및 이용 기간</h2>
          <ul class="legal-list">
            <li>회원·프로필 정보는 회원 탈퇴 또는 이용자의 삭제 요청 시까지 보유합니다.</li>
            <li>개인 AI 결과는 최근 50개까지만 저장하며 개별 삭제 또는 회원 탈퇴 시 삭제합니다.</li>
            <li>회원이 작성한 자료·토론·댓글과 업로드 파일은 회원 탈퇴 또는 관리자 삭제 시 삭제합니다.</li>
            <li>AI·댓글·글·이미지 이용 횟수와 비정상 이용 방지 기록은 제한 적용과 보안에 필요한 기간 또는 회원 탈퇴 시까지 보관합니다.</li>
            <li>생성 작업, 신고·문의와 관리자 처리 기록은 운영 및 분쟁 대응에 필요한 기간 동안 보관할 수 있습니다.</li>
            <li>개별 투표와 조회 이벤트는 회원 탈퇴 시 삭제하며 작성자를 식별하지 않는 전체 집계 수치는 통계로 유지될 수 있습니다.</li>
            <li>관련 법령에 별도 보관 기간이 정해진 경우 해당 기간을 따릅니다.</li>
          </ul>

          <h2 class="legal-h2">7. 회원 탈퇴 시 처리</h2>
          <div class="legal-table-wrap">
            <table class="legal-table">
              <thead><tr><th>항목</th><th>처리 방식</th></tr></thead>
              <tbody>
                <tr><td>계정·프로필</td><td>Firebase 인증 계정, 회원 문서와 개인 하위 컬렉션을 삭제합니다.</td></tr>
                <tr><td>개인 AI 입력·결과</td><td>사용자 전용 AI 결과와 기능별 개인 이용 기록을 삭제합니다.</td></tr>
                <tr><td>회원 작성 콘텐츠</td><td>자료, 토론, 공개 게시물, 댓글과 답글 등 UID로 확인 가능한 작성물을 삭제합니다.</td></tr>
                <tr><td>업로드 파일</td><td>회원 UID 경로에 저장된 피드·자료실·토론실 이미지를 삭제합니다.</td></tr>
                <tr><td>개별 참여 기록</td><td>투표, 조회 이벤트, 스크랩, 팔로우, 알림, 닉네임 예약과 제한 기록을 삭제합니다.</td></tr>
                <tr><td>비식별 집계</td><td>전체 투표수·조회수처럼 탈퇴 회원을 식별하지 않는 합계는 남을 수 있습니다.</td></tr>
              </tbody>
            </table>
          </div>

          <h2 class="legal-h2">8. 외부 서비스와 처리 위탁</h2>
          <div class="legal-table-wrap">
            <table class="legal-table">
              <thead><tr><th>서비스</th><th>이용 목적</th><th>처리될 수 있는 정보</th></tr></thead>
              <tbody>
                <tr><td>Google Firebase</td><td>인증, 데이터베이스, 파일 저장, 서버 기능, 호스팅과 보안</td><td>계정 정보, 공개 콘텐츠, 이미지, 투표·댓글, 개인 AI 결과와 이용 기록</td></tr>
                <tr><td>Google·카카오</td><td>소셜 로그인</td><td>로그인 제공자가 동의 범위에서 전달하는 식별·프로필 정보</td></tr>
                <tr><td>Google Gemini</td><td>AI 판결·문장 변환·작명·상담, 일일 자료·토론 생성, 공개 전 자동 검수와 신고 검토 보조</td><td>AI 기능 입력 텍스트, 공개 제목, 생성 결과와 검수 지시문</td></tr>
              </tbody>
            </table>
          </div>
          <p style="font-size:13px;color:var(--color-text-muted);margin-top:8px">AI 제공사에는 해당 결과 생성과 검수에 필요한 정보만 전달하며 로그인 비밀번호, Firebase 관리 인증 정보 또는 Secret 값은 전달하지 않습니다.</p>

          <h2 class="legal-h2">9. 쿠키와 브라우저 저장소</h2>
          <ul class="legal-list">
            <li>로그인 상태 유지, OAuth 요청 위조 방지, 로그인 후 이동 경로, 테마와 화면 편의를 위해 쿠키·sessionStorage·localStorage·Firebase 인증 토큰을 사용할 수 있습니다.</li>
            <li>이미지 미리보기와 자동 최적화를 위해 브라우저 메모리와 임시 객체 주소를 사용할 수 있으며 페이지 종료 또는 선택 해제 시 해제합니다.</li>
            <li>브라우저 저장 기능을 제한하면 로그인 유지나 일부 화면 기능이 정상 작동하지 않을 수 있습니다.</li>
          </ul>

          <h2 class="legal-h2">10. 이용자의 권리</h2>
          <ul class="legal-list">
            <li>이용자는 본인 정보의 열람, 수정, 삭제와 처리 정지를 요청할 수 있습니다.</li>
            <li>닉네임, 프로필 아이콘과 개인 AI 결과는 내정보에서 직접 관리할 수 있습니다.</li>
            <li>회원 탈퇴는 내정보 설정에서 직접 진행할 수 있으며 삭제된 계정과 데이터는 복구할 수 없습니다.</li>
            <li>공개 콘텐츠의 별도 삭제, 권리 침해 또는 개인정보 노출 대응이 필요한 경우 서비스 내 문의·신고 기능으로 요청할 수 있습니다.</li>
          </ul>

          <h2 class="legal-h2">11. 안전성 확보 조치</h2>
          <ul class="legal-list">
            <li>Firebase Authentication과 Firestore·Storage 보안 규칙을 통해 이용자별 접근을 제한합니다.</li>
            <li>개인 AI 결과와 자료·토론 참여 데이터는 Cloud Functions에서 인증된 UID를 기준으로 저장·조회·삭제합니다.</li>
            <li>자료·토론 이미지는 서버 업로드 경로와 Storage 메타데이터로 소유자·용도·형식·용량을 검증합니다.</li>
            <li>카카오 로그인은 요청마다 난수 상태값을 생성하고 콜백에서 일치 여부를 확인합니다.</li>
            <li>AI 인증 정보는 공개 데이터베이스나 프런트엔드 코드가 아닌 관리형 비밀 저장소에서 사용합니다.</li>
            <li>댓글, 글 등록, 이미지 업로드와 AI 실행에는 횟수 제한, 대기 간격과 입력 길이 검사를 적용합니다.</li>
            <li>관리자 화면과 관리 함수는 관리자 문서 또는 관리자 권한이 확인된 계정에만 제공합니다.</li>
          </ul>

          <h2 class="legal-h2">12. 개인정보 관련 문의</h2>
          <ul class="legal-list">
            <li><b>책임자:</b> 소소킹 운영팀</li>
            <li><b>문의 방법:</b> 서비스 내 문의 또는 신고 기능</li>
            <li>개인정보 침해 신고나 상담이 필요한 경우 개인정보침해 신고센터 등 관계 기관을 이용할 수 있습니다.</li>
          </ul>
        </div>
      </div>
    </div>`;
}
