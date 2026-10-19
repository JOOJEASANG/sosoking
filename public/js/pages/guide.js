export function renderGuide(container) {
  const steps = [
    ['🔐', '로그인하고 생활사건 접수', 'Google 또는 이메일 계정으로 로그인한 뒤 사소한 생활분쟁을 접수합니다. 접수 횟수와 재접수 대기시간은 현재 운영 설정에 따라 달라질 수 있으며, 실명·연락처·주소 등 개인정보는 입력하지 마세요.'],
    ['🎲', 'AI 판사 자동 배정', '꼰대형·냉혈형·회피형·추궁형·오버형·드립형·빙의형 중 한 명이 자동 배정됩니다. 사건접수부터 수사·양측 변론·판결까지 같은 판사 성격이 이어집니다.'],
    ['📑', '사건 기록을 먼저 읽기', 'AI가 사건접수, 수사보고, 원고측 변론, 피고측 변론, 재판부 판결의 다섯 단계 문서를 작성합니다. 작성이 끝나도 본인 사건의 최종 판결은 바로 보여주지 않습니다.'],
    ['🔒', '내 예상 판정 후 판결 봉인 해제', '사건 기록과 양측 주장을 읽고 원고 승·피고 승·쌍방 과실 중 하나를 최초 1회 선택하면 AI 재판부의 판결이 공개됩니다. 이 선택은 판결을 본 뒤 변경할 수 없고 공개 민심 집계에도 섞이지 않습니다.'],
    ['🌐', '원하면 판결기록에 공개', '기본값은 비공개입니다. 판결을 확인한 뒤 직접 공개하면 안전검사를 통과한 공개용 정보와 AI 판결이 민심소·명예의 전당의 대상이 됩니다. 접수 원문은 작성자 본인에게만 공개됩니다.']
  ];

  const participationSteps = [
    ['1', '공개 사건을 블라인드로 읽기', '민심소에서 다른 이용자가 공개한 생활사건을 AI 판결을 가린 상태로 먼저 읽습니다.'],
    ['2', '원고·피고·쌍방 중 먼저 판정', '내 판단을 선택하면 그때 AI 재판부의 판결과 전체 민심 비율이 열립니다. 이미 투표한 사건은 다시 들어가 결과를 확인할 수 있습니다.'],
    ['3', '판결과 내 판단 비교·토론', 'AI와 내 판단이 같았는지 비교하고 같은 사건을 본 이용자들과 의견을 나눌 수 있습니다. 개인정보 추측·욕설·위협·인신공격은 허용되지 않습니다.'],
    ['4', '명예의 전당에서 화제 사건 찾기', '공개 사건의 참여 기록과 실제 저장된 억울지수를 바탕으로 화제·접전·억울지수 랭킹을 보여줍니다. 랭킹에서 판결을 미리 노출하지 않고 민심소의 블라인드 판정으로 이어집니다.']
  ];

  const faqs = [
    ['진짜 법원이나 법률상담 서비스인가요?', '아닙니다. 생성형 AI가 법정 문서 형식을 흉내 내어 만든 오락용 생활판결 서비스이며, 법률상담·법적 판단·실제 재판을 대신하지 않습니다.'],
    ['사건 접수에 로그인이 필요한가요?', '네. 내 사건 기록과 공개 여부를 안전하게 관리하기 위해 Google 또는 이메일 로그인이 필요합니다. 이메일 가입자는 이메일 인증을 완료해야 사건을 접수할 수 있습니다.'],
    ['하루에 몇 번 접수할 수 있나요?', '현재 적용 중인 횟수와 재접수 대기시간은 사건 접수 화면에 표시됩니다. 운영자는 비용·안전·운영 상황에 따라 제한을 해제하거나 계정당 일일 건수를 조절할 수 있습니다.'],
    ['내 AI 판결은 언제 볼 수 있나요?', 'AI 문서 생성이 끝난 뒤 사건접수·수사·양측 주장을 먼저 확인하고, 원고 승·피고 승·쌍방 과실 중 내 예상 판정을 최초 1회 선택하면 최종 AI 판결이 공개됩니다.'],
    ['내 예상 판정을 다시 바꿀 수 있나요?', '아니요. AI 판결을 보기 전에 내 판단을 남기는 재미를 유지하기 위해 최초 선택만 기록됩니다. 이 기록은 공개 민심 투표와 별개이며 다른 이용자의 민심 비율에 영향을 주지 않습니다.'],
    ['판결을 공개하면 접수 원문도 공개되나요?', '아니요. 작성자가 처음 입력한 접수 원문은 작성자 본인에게만 보여줍니다. 다른 이용자에게는 안전검사를 통과한 공개용 사건 정보와 AI가 만든 판결 기록만 제공됩니다.'],
    ['판결 결과를 공개하면 어떻게 되나요?', '공개용 사건 정보와 AI 판결이 공개 판결기록이 되어 민심소의 블라인드 투표·토론 대상이 됩니다. 공개 주소는 검색엔진에 노출될 수 있으며, 작성자는 다시 비공개로 전환하거나 사건 전체를 삭제할 수 있습니다.'],
    ['내 민심소 투표가 다른 사람에게 공개되나요?', '개별 회원이 어느 선택을 했는지는 공개 목록에 표시하지 않고 선택지별 전체 표 수와 비율만 보여줍니다. 댓글을 작성하면 설정한 닉네임과 댓글 내용은 공개될 수 있습니다.'],
    ['토론과 사건 접수에서 무엇을 조심해야 하나요?', '실명·연락처·주소·계좌번호 같은 개인정보, 욕설, 위협, 실제 범죄·폭력·위기 상황, 타인의 신상을 특정할 수 있는 내용은 입력하지 마세요. 신고된 공개 글은 운영 정책에 따라 숨김 또는 삭제될 수 있습니다.'],
    ['진짜 심각한 일이라면요?', '실제 범죄·폭력·손해·가정·노동·계약·의료·정신건강 문제는 이 서비스에 맡기지 말고 관계 기관이나 적절한 전문가에게 도움을 요청해야 합니다.']
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
          <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">내 사건은 내가 먼저 찍고 AI 판결과 비교하고,<br>공개 사건은 민심소에서 모두가 블라인드로 판정합니다.</div>
        </div>

        <section aria-labelledby="guide-steps-title" style="margin-bottom:36px;">
          <h2 id="guide-steps-title" style="font-family:var(--font-serif);font-size:18px;font-weight:800;margin-bottom:6px;color:var(--gold);">AI 생활판결</h2>
          <p style="font-size:12px;color:var(--cream-dim);margin-bottom:16px;">접수부터 내 예상 판정, 판결 확인과 선택적 공개까지의 흐름입니다.</p>
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

        <section aria-labelledby="participation-guide-title" style="margin-bottom:36px;">
          <h2 id="participation-guide-title" style="font-family:var(--font-serif);font-size:18px;font-weight:800;margin-bottom:6px;color:var(--gold);">민심소 참여</h2>
          <p style="font-size:12px;color:var(--cream-dim);margin-bottom:16px;">남의 공개 사건도 판결을 먼저 보지 않고 직접 판단한 뒤 AI와 비교합니다.</p>
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${participationSteps.map(([num, title, desc]) => `
              <div class="card" style="display:flex;gap:14px;align-items:flex-start;padding:17px 19px;">
                <div style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border-radius:50%;background:var(--gold);color:var(--navy);font-weight:900;">${num}</div>
                <div style="min-width:0;">
                  <div style="font-weight:800;font-size:15px;margin-bottom:4px;color:var(--cream);">${title}</div>
                  <div style="font-size:13px;color:var(--cream-dim);line-height:1.75;">${desc}</div>
                </div>
              </div>`).join('')}
          </div>
          <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
            <a href="#/jury" class="btn btn-primary" style="flex:1;min-width:150px;">🗳️ 민심소에서 판정하기</a>
            <a href="#/board" class="btn btn-secondary" style="flex:1;min-width:150px;">🏆 명예의 전당</a>
          </div>
        </section>

        <section aria-labelledby="privacy-guide-title" class="card" style="padding:18px 20px;margin-bottom:32px;border-color:rgba(201,168,76,.38);">
          <h2 id="privacy-guide-title" style="font-family:var(--font-serif);font-size:17px;font-weight:800;margin-bottom:8px;color:var(--gold);">🔐 공개와 개인정보 한눈에 보기</h2>
          <div style="font-size:13px;color:var(--cream-dim);line-height:1.8;">
            · 새 사건은 항상 <strong style="color:var(--cream);">비공개</strong>로 시작합니다.<br>
            · 최초 접수 원문은 <strong style="color:var(--cream);">작성자 본인만</strong> 확인합니다.<br>
            · 공개 전 서버에서 개인정보·고위험 내용 안전검사를 수행합니다.<br>
            · 공개 후에는 공개용 사건 정보·AI 판결·공개 닉네임·투표 집계·공개 댓글이 다른 이용자에게 보일 수 있습니다.<br>
            · 공개 판결은 검색엔진에 노출될 수 있으므로 공개 전에 내용을 다시 확인하세요.
          </div>
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
          소소킹의 AI 생활판결과 민심 투표는 오락 콘텐츠이며 법적 효력이 없습니다. 실제 권리·의무나 중요한 문제의 판단 근거로 사용하지 마세요.
        </div>

        <a href="#/submit" class="btn btn-primary">⚖️ 내 사건 접수하기</a>
      </div>
    </div>`;
}
