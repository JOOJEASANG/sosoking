export function renderTerms() {
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div style="max-width:720px;margin:0 auto">
      <div class="section-header">
        <h1 class="section-title">이용약관</h1>
      </div>
      <div class="card">
        <div class="card__body--lg" style="line-height:1.9;font-size:14px;color:var(--color-text-secondary)">
          <h2 style="font-size:16px;font-weight:800;color:var(--color-text-primary);margin-bottom:8px">제1조 (목적)</h2>
          <p>이 약관은 소소킹(이하 "서비스")이 제공하는 게임형 커뮤니티 서비스의 이용 조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.</p>
          <h2 style="font-size:16px;font-weight:800;color:var(--color-text-primary);margin:20px 0 8px">제2조 (서비스 이용)</h2>
          <ul style="padding-left:16px">
            <li>서비스는 만 14세 이상 누구나 이용할 수 있습니다.</li>
            <li>회원은 Google 계정 또는 이메일로 가입할 수 있습니다.</li>
            <li>1인 1계정을 원칙으로 합니다.</li>
          </ul>
          <h2 style="font-size:16px;font-weight:800;color:var(--color-text-primary);margin:20px 0 8px">제3조 (금지 행위)</h2>
          <ul style="padding-left:16px">
            <li>타인에 대한 비방, 욕설, 혐오 표현 금지</li>
            <li>개인정보(실명, 연락처 등) 노출 금지</li>
            <li>광고, 스팸, 도배 행위 금지</li>
            <li>외부 링크, 유튜브 등 영상 콘텐츠 금지</li>
            <li>저작권 침해 콘텐츠 업로드 금지</li>
          </ul>
          <h2 style="font-size:16px;font-weight:800;color:var(--color-text-primary);margin:20px 0 8px">제4조 (서비스 변경 및 중단)</h2>
          <p>서비스는 운영상 필요에 따라 사전 공지 없이 서비스 내용을 변경하거나 일시 중단할 수 있습니다.</p>
          <h2 style="font-size:16px;font-weight:800;color:var(--color-text-primary);margin:20px 0 8px">제5조 (면책)</h2>
          <p>서비스는 이용자가 게시한 정보, 자료, 사실의 신뢰도·정확성에 대해 책임을 지지 않습니다. 이용자 간 분쟁에 개입하지 않으며 이로 인한 손해를 배상할 책임이 없습니다.</p>
          <p style="margin-top:20px;color:var(--color-text-muted);font-size:13px">시행일: 2025년 1월 1일</p>
        </div>
      </div>
    </div>`;
}
