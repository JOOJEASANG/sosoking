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
          <div style="font-family:var(--font-serif);font-size:22px;font-weight:700;margin-bottom:6px;">소소킹 생활법정 사용법</div>
          <div style="font-size:13px;color:var(--cream-dim);">친구와 토론하고 AI 판사에게 공정한 판결을 받으세요.</div>
        </div>

        <!-- 사용 단계 -->
        <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:36px;">
          ${[
            ['⚖️', '사건 고르기', '카톡 읽씹, 치킨 마지막 조각, 더치페이… 공감 100% 사건 중 하나를 고르거나, 직접 등록하세요.'],
            ['🙋', '입장 선택', '원고(주장하는 쪽) 또는 피고(반박하는 쪽) 중 내 입장을 선택하세요.'],
            ['🔗', '친구 초대', '링크를 친구에게 보내면 끝. 클릭하는 순간 자동으로 상대방 역할로 입장합니다. 가입 불필요.'],
            ['💬', '2라운드 토론', '각자 2번씩 주장을 입력합니다. 논리적으로 설득력 있게 써야 이깁니다.'],
            ['🏛️', 'AI 판결', '4번의 주장이 모두 모이면 AI 판사가 논리와 설득력을 기준으로 공정하게 판결합니다.'],
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
            ['진짜 법원이에요?', '아니요. AI 판사이며 판결에 어떠한 법적 효력도 없습니다. 순수 오락 서비스입니다.'],
            ['친구가 가입해야 하나요?', '아니요. 링크를 받은 친구는 가입 없이 바로 참가할 수 있습니다.'],
            ['모르는 사람과도 할 수 있나요?', '네! 랜덤 매칭으로 대기자가 있을 때 자동 연결됩니다.'],
            ['개인정보 수집하나요?', '서비스 운영을 위한 익명 인증만 사용합니다. 이름·연락처·주민번호는 절대 입력하지 마세요.'],
            ['내가 쓴 주장이 AI에게 불리하게 작용할 수 있나요?', '네. AI는 어느 편도 들지 않아요. 논리가 부족하면 본인 입장도 집니다.'],
            ['직접 사건을 등록할 수 있나요?', '네! "내 억울한 사건 등록하기"에서 직접 등록하면 검토 후 공개됩니다.'],
          ].map(([q, a]) => `
            <div class="card" style="padding:16px 20px;">
              <div style="font-weight:700;font-size:14px;margin-bottom:6px;color:var(--cream);">Q. ${q}</div>
              <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">A. ${a}</div>
            </div>`).join('')}
        </div>

        <!-- 면책 -->
        <div class="disclaimer" style="margin-bottom:24px;">
          <strong>⚠️ 오락 서비스 안내</strong><br>
          소소킹 생활법정은 AI 기반 오락 서비스입니다. 생성된 판결문은 실제 법률 자문이 아니며 어떠한 법적 효력도 없습니다. 진짜 법적 문제는 실제 전문가에게 문의하세요.
        </div>

        <a href="#/topics" class="btn btn-primary">⚖️ 재판 시작하러 가기</a>
      </div>
    </div>`;
}
