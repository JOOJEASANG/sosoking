export function renderGuide(container) {
  const steps = [
    ['🔐', '로그인하고 생활사건 접수', 'Google 또는 이메일 계정으로 로그인한 뒤 사소한 생활분쟁을 접수합니다. 접수 횟수와 대기시간은 운영 설정에 따라 달라질 수 있으며, 실명·연락처·주소 등 개인정보는 빼주세요.'],
    ['🎲', 'AI 판사 자동 배정', '엄벌주의형·감성형·현실주의형·과몰입형·피곤형·논리집착형·드립형 중 한 명이 사건마다 자동 배정됩니다.'],
    ['📑', '다섯 문서와 생활형 처분 확인', 'AI가 사건접수, 수사보고, 원고측 변론, 피고측 변론, 판결문을 문서처럼 작성합니다. 접수한 본인은 결과를 바로 확인할 수 있습니다.'],
    ['🔒', '기본은 비공개, 공개는 직접 선택', '사건과 판결문은 본인에게만 보이는 것이 기본입니다. 공개로 전환한 경우에만 판결기록, 댓글·투표, 공유 주소와 검색 노출 대상이 됩니다.']
  ];

  const dailyCourtSteps = [
    ['1', '오늘의 실제 판례 읽기', '매일 실제 법원 판례 한 건을 게임용으로 짧게 재구성해 보여드립니다. 결론과 사건번호는 먼저 숨겨집니다.'],
    ['2', '증거를 열고 직접 판결하기', '최대 3개의 증거 카드를 확인한 뒤 결론을 선택합니다. 증거를 적게 열수록 정답 점수가 높습니다.'],
    ['3', '실제 판단과 민심 비교하기', '판결을 제출하면 실제 법원 판단, 판단 이유, 전체 이용자 선택 비율과 내 점수가 공개됩니다. 연속 참여와 적중률도 누적됩니다.']
  ];

  const faqs = [
    ['진짜 법원인가요?', '아닙니다. AI 생활판결은 생성형 AI 오락 콘텐츠이고, 오늘의 재판은 실제 판례를 짧게 재구성한 맞히기 게임입니다. 둘 다 법률상담이나 실제 재판을 대신하지 않습니다.'],
    ['사건 접수에 로그인이 필요한가요?', '네. 내 사건과 공개 여부를 안전하게 관리하기 위해 Google 또는 이메일 로그인이 필요합니다. 이메일 가입자는 인증을 완료해야 합니다.'],
    ['하루에 몇 번 접수할 수 있나요?', '현재 적용 중인 횟수는 사건 접수 화면에 표시됩니다. 운영자는 테스트·비용·안전 상황에 따라 제한을 해제하거나 계정당 일일 건수를 조절할 수 있습니다.'],
    ['내 AI 판결은 언제 볼 수 있나요?', '접수한 본인은 생성이 끝나는 즉시 전체 결과를 확인할 수 있습니다. 사건은 기본적으로 비공개입니다.'],
    ['판결 결과를 공개하면 어떻게 되나요?', '닉네임·사건 내용·AI 판결문이 판결기록에 표시되고 투표와 댓글 대상이 됩니다. 공개 주소는 검색엔진에 노출될 수 있으며, 다시 비공개로 전환하거나 사건을 삭제할 수 있습니다.'],
    ['오늘의 재판은 하루에 몇 번 하나요?', '매일 한 사건이 제공되며 로그인 회원은 같은 날짜의 사건에 한 번만 판결을 제출할 수 있습니다. 지난 판례가 순환될 수 있습니다.'],
    ['오늘의 재판은 정말 실제 사건인가요?', '국가법령정보센터에 공개된 실제 판례를 바탕으로 합니다. 사건관계인의 신상은 표시하지 않고 게임용으로 축약하므로 정확한 내용은 결과 화면의 공식 판례 원문을 확인해야 합니다.'],
    ['증거를 보면 왜 점수가 줄어드나요?', '단서 없이 실제 결론을 맞히는 난이도를 반영하기 위한 게임 규칙입니다. 증거를 열어도 실제 판결과 이유는 답을 제출하기 전까지 공개되지 않습니다.'],
    ['내 투표가 다른 사람에게 공개되나요?', '개별 회원의 선택은 공개하지 않고 선택지별 전체 표 수와 비율만 보여줍니다.'],
    ['진짜 심각한 일이라면요?', '실제 범죄·손해·가정·노동·계약·의료 문제는 변호사, 대한법률구조공단 또는 관계 기관에 상담해야 합니다.']
  ];

  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn" aria-label="홈으로 돌아가기">‹</a>
        <span class="logo">이용 안내</span>
      </div>
      <div class="container" style="padding-top:28px;padding-bottom:90px;">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="font-size:48px;margin-bottom:12px;" aria-hidden="true">⚖️</div>
          <h1 style="font-family:var(--font-serif);font-size:22px;font-weight:800;margin-bottom:6px;color:var(--gold);">소소킹 판결소 사용법</h1>
          <div style="font-size:13px;color:var(--cream-dim);">내 억울함은 AI에게, 실제 판례는 내가 판결합니다.</div>
        </div>

        <section aria-labelledby="guide-steps-title" style="margin-bottom:36px;">
          <h2 id="guide-steps-title" style="font-family:var(--font-serif);font-size:18px;font-weight:800;margin-bottom:6px;color:var(--gold);">AI 생활판결</h2>
          <p style="font-size:12px;color:var(--cream-dim);margin-bottom:16px;">사소한 억울함을 접수하고 문서형 AI 판결을 받는 과정입니다.</p>
          <div style="display:flex;flex-direction:column;gap:14px;">
            ${steps.map(([icon, title, desc], index) => `
              <div class="card" style="display:flex;gap:15px;align-items:flex-start;padding:18px 20px;">
                <div style="width:42px;height:42px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid var(--border);border-radius:50%;background:var(--gold-dim);font-size:22px;" aria-hidden="true">${icon}</div>
                <div style="min-width:0;">
                  <div style="font-size:10px;color:var(--gold);font-weight:900;letter-spacing:.12em;margin-bottom:3px;">STEP ${index + 1}</div>
                  <div style="font-weight:800;font-size:15px;margin-bottom:5px;color:var(--cream);">${title}</div>
                  <div style="font-size:13px;color:var(--cream-dim);line-height:1.75;">${desc}</div>
                </div>
              </div>`).join('')}
          </div>
        </section>

        <section aria-labelledby="daily-court-guide-title" style="margin-bottom:36px;">
          <h2 id="daily-court-guide-title" style="font-family:var(--font-serif);font-size:18px;font-weight:800;margin-bottom:6px;color:var(--gold);">오늘의 재판</h2>
          <p style="font-size:12px;color:var(--cream-dim);margin-bottom:16px;">접수할 일이 없는 날에도 실제 판례를 직접 판단해볼 수 있습니다.</p>
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${dailyCourtSteps.map(([num, title, desc]) => `
              <div class="card" style="display:flex;gap:14px;align-items:flex-start;padding:17px 19px;">
                <div style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border-radius:50%;background:var(--gold);color:var(--navy);font-weight:900;">${num}</div>
                <div style="min-width:0;">
                  <div style="font-weight:800;font-size:15px;margin-bottom:4px;color:var(--cream);">${title}</div>
                  <div style="font-size:13px;color:var(--cream-dim);line-height:1.75;">${desc}</div>
                </div>
              </div>`).join('')}
          </div>
          <a href="#/daily-court" class="btn btn-secondary" style="margin-top:14px;">⚖️ 오늘의 재판 참여하기</a>
        </section>

        <section aria-labelledby="guide-faq-title" style="margin-bottom:36px;">
          <h2 id="guide-faq-title" style="font-family:var(--font-serif);font-size:18px;font-weight:800;margin-bottom:16px;color:var(--gold);">자주 묻는 질문</h2>
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${faqs.map(([question, answer]) => `
              <details class="card" style="padding:0;overflow:hidden;">
                <summary style="list-style:none;cursor:pointer;padding:16px 18px;font-weight:800;font-size:14px;color:var(--cream);display:flex;justify-content:space-between;gap:12px;align-items:center;">
                  <span>Q. ${question}</span><span style="color:var(--gold);">＋</span>
                </summary>
                <div style="padding:0 18px 17px;font-size:13px;color:var(--cream-dim);line-height:1.75;">A. ${answer}</div>
              </details>`).join('')}
          </div>
        </section>

        <div class="disclaimer" style="margin-bottom:24px;">
          <strong>⚠️ 오락 서비스 안내</strong><br>
          AI 생활판결은 생성형 AI가 만든 오락 콘텐츠이며 법적 효력이 없습니다. 오늘의 재판은 실제 판례를 축약한 게임이므로 정확한 법적 판단은 공식 판례 원문을 확인해주세요.
        </div>

        <a href="#/submit" class="btn btn-primary">⚖️ 내 사건 판결받기</a>
      </div>
    </div>`;
}