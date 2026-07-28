export function renderGuide(container) {
  const steps = [
    ['📝', '사건 내용 적기', '사건명을 따로 고민할 필요 없이 무슨 일이 있었는지만 적습니다. 실명·연락처·주소 등 개인정보는 제외해주세요.'],
    ['🎲', '판사 자동 배정', '엄벌주의형·감성형·현실주의형·과몰입형·피곤형·논리집착형·드립형 중 한 명이 사건마다 자동 배정됩니다.'],
    ['⏳', '다섯 문서 작성', 'AI가 사건접수, 수사보고, 원고측 변론, 피고측 변론, 재판부 판결을 실제 문서처럼 정리합니다. 처리 시간은 접속 상황에 따라 달라질 수 있습니다.'],
    ['📜', '판결문 읽고 선택적으로 공유', '판결문은 기본적으로 비공개입니다. 내용을 확인한 뒤 직접 공개로 전환한 경우에만 판결기록과 공유 링크가 활성화됩니다.']
  ];

  const faqs = [
    ['진짜 법원인가요?', '아닙니다. 실제 법률 자문이나 법원 판결이 아닌 AI 기반 오락 콘텐츠입니다.'],
    ['사건 접수에 로그인이 필요한가요?', '네. 내 사건 기록과 공개 여부를 안전하게 관리하기 위해 Google 또는 이메일 로그인이 필요합니다. 공개 판결기록 열람은 로그인 상태에서 이용할 수 있습니다.'],
    ['하루에 몇 번 접수할 수 있나요?', '관리자가 정한 현재 한도와 재접수 대기시간이 사건 접수 화면에 표시됩니다.'],
    ['판사는 직접 고르나요?', '아니요. 접수를 단순하게 유지하기 위해 사건마다 판사가 자동 배정되고, 그 성향이 판결문 문체와 처분에 반영됩니다.'],
    ['억울지수는 어떻게 정해지나요?', '신규 사건을 생성할 때 1~10 사이에서 한 번 정해져 저장되며, 화면을 다시 열어도 같은 점수가 유지됩니다.'],
    ['판결 결과를 공유할 수 있나요?', '네. 기본값은 비공개이며, 결과 화면에서 직접 공개로 전환하면 닉네임·사건 내용·AI 판결문이 판결기록에 표시되고 링크가 복사됩니다. 언제든 다시 비공개로 전환할 수 있습니다.'],
    ['진짜 심각한 일이라면요?', '실제 범죄·손해·가정·노동·계약 문제는 변호사, 대한법률구조공단 또는 관계 기관에 상담해야 합니다.']
  ];

  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn" aria-label="홈으로 돌아가기">‹</a>
        <span class="logo">📖 이용 안내</span>
      </div>
      <div class="container" style="padding-top:28px;padding-bottom:90px;">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="font-size:48px;margin-bottom:12px;" aria-hidden="true">⚖️</div>
          <h1 style="font-family:var(--font-serif);font-size:22px;font-weight:800;margin-bottom:6px;color:var(--gold);">소소킹 판결소 사용법</h1>
          <div style="font-size:13px;color:var(--cream-dim);">입력은 간단하게, 결과는 문서답게.</div>
        </div>

        <section aria-labelledby="guide-steps-title" style="margin-bottom:36px;">
          <h2 id="guide-steps-title" style="font-family:var(--font-serif);font-size:18px;font-weight:800;margin-bottom:16px;color:var(--gold);">이용 순서</h2>
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
          생성된 사건명·보고서·변론·판결문은 실제 법률 자문이나 법원 문서가 아닙니다. 실제 법적 문제는 전문가와 관계 기관에 문의해주세요.
        </div>

        <a href="#/submit" class="btn btn-primary">⚖️ 사건 접수하러 가기</a>
      </div>
    </div>`;
}
