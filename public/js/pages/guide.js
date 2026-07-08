export function renderGuide(container) {
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">📖 이용 안내</span>
      </div>
      <div class="container" style="padding-top:28px;padding-bottom:80px;">

        <div style="text-align:center;margin-bottom:32px;">
          <div style="font-size:48px;margin-bottom:12px;">⚖️</div>
          <div style="font-family:var(--font-serif);font-size:22px;font-weight:700;margin-bottom:6px;">소소킹 황당재판소 사용법</div>
          <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">세상의 모든 소소한 사건과 황당한 사례를<br>AI 재판부에게 판결받아보세요.</div>
        </div>

        <!-- 사용 단계 -->
        <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:36px;">
          ${[
            ['📝', '소소사건 적기', '일상 속 사소한 억울함, 웃긴 갈등, 황당한 사례를 적으세요. 거창하지 않아도 됩니다. 사소할수록 재판부는 더 진지해집니다.'],
            ['🎲', '재판부 선택', '7명의 AI 재판부 중 고르거나, 그냥 운명에 맡기세요. 같은 사건도 재판부에 따라 전혀 다른 판결이 나옵니다.'],
            ['⏳', '황당재판 기다리기', 'AI가 접수관·수사관·변호사·판사를 혼자 다 합니다. 실제 법원보다 빠르고, 실제 법원보다 훨씬 가볍습니다.'],
            ['📜', '판결 받기', '소장, 쟁점, 판결이유, 주문, 소소 형량까지 판결문처럼 받아보세요. 이행 여부는 양심과 웃음에 맡깁니다.'],
          ].map(([icon, title, desc]) => `
            <div class="card" style="display:flex;gap:16px;align-items:flex-start;padding:18px 20px;">
              <div style="font-size:28px;line-height:1;flex-shrink:0;margin-top:2px;">${icon}</div>
              <div>
                <div style="font-weight:700;font-size:15px;margin-bottom:4px;color:var(--gold);">${title}</div>
                <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">${desc}</div>
              </div>
            </div>`).join('')}
        </div>

        <!-- FAQ -->
        <div style="font-family:var(--font-serif);font-size:18px;font-weight:700;margin-bottom:16px;">자주 묻는 질문</div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:36px;">
          ${[
            ['어떤 사건을 접수하면 되나요?', '친구, 가족, 회사, 학교, 배달, 카톡, 음식, 리모컨, 충전기처럼 일상에서 생긴 소소한 사건과 황당한 사례면 됩니다.'],
            ['진짜 법원이에요?', '아니요. 판사도 AI, 변호사도 AI, 판결문도 AI. 실제 법원은 아니고 오락형 황당재판소입니다.'],
            ['판결에 법적 효력 있나요?', '없어요. 단 1도요. 대신 사소한 억울함을 웃기고 진지하게 정리해주는 재미가 있습니다.'],
            ['개인정보 수집하나요?', '서비스 운영을 위한 인증 정보만 사용합니다. 이름·연락처·주민번호·주소 같은 개인정보는 절대 입력하지 마세요.'],
            ['하루에 몇 번 접수할 수 있나요?', '기본 3건입니다. 그 이상의 억울함이 있다면 잠깐 쉬었다가 다시 접수하세요.'],
            ['진짜 심각한 일인데요?', '실제 범죄, 폭력, 소송, 의료, 법률 문제라면 소소킹이 아니라 실제 전문가와 기관에 문의해야 합니다.'],
            ['판결 결과 공유할 수 있나요?', '네. 결과 페이지에서 링크를 공개 전환해 다른 사람들과 공유할 수 있습니다.'],
          ].map(([q, a]) => `
            <div class="card" style="padding:16px 20px;">
              <div style="font-weight:700;font-size:14px;margin-bottom:6px;color:var(--cream);">Q. ${q}</div>
              <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">A. ${a}</div>
            </div>`).join('')}
        </div>

        <!-- 면책 -->
        <div class="disclaimer" style="margin-bottom:24px;">
          <strong>⚠️ 오락 서비스 안내</strong><br>
          소소킹 황당재판소는 AI 기반 오락형 판결 서비스입니다. 생성된 판결문은 실제 법률 자문이 아니며 어떠한 법적 효력도 없습니다. 진짜 법적 문제는 실제 전문가에게 문의하세요.
        </div>

        <a href="#/submit" class="btn btn-primary">⚖️ 소소사건 판결받으러 가기</a>
      </div>
    </div>`;
}
