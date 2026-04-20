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
          <div style="font-family:var(--font-serif);font-size:22px;font-weight:700;margin-bottom:6px;">쇼킹한판결소 사용법</div>
          <div style="font-size:13px;color:var(--cream-dim);">어렵지 않아요. 진짜로요.</div>
        </div>

        <!-- 사용 단계 -->
        <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:36px;">
          ${[
            ['📝', '억울함 적기', '억울한 일을 최대한 상세하게 적으세요. 더 불쌍할수록 판사가 공감해준다는 보장은 없지만… 그냥 적으세요.'],
            ['🎲', '판사 선택', '7명의 AI 판사 중 고르거나, 그냥 운명에 맡기세요. 어차피 다 웃깁니다. 다 다른 방식으로요.'],
            ['⏳', '재판 기다리기', 'AI가 접수관·수사관·변호사·판사를 혼자 다 합니다. 1분도 안 걸려요. 실제 법원보다 체감상 7000배 빠릅니다.'],
            ['📜', '판결 받기', '생활형 처분을 받으세요. "30일간 라면 국물 취식 금지" 뭐 이런 거요. 이행 여부는 양심에 맡깁니다.'],
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
            ['진짜 법원이에요?', '아니요. 판사도 AI, 변호사도 AI, 판결문도 AI. UN도 인정 안 합니다.'],
            ['판결에 법적 효력 있나요?', '없어요. 단 1도요. 하지만 심리적으로 시원합니다.'],
            ['개인정보 수집하나요?', '서비스 운영을 위한 익명 인증만 사용합니다. 이름·연락처·주민번호는 절대 입력하지 마세요.'],
            ['하루에 몇 번 접수할 수 있나요?', '3건이요. 그 이상의 억울함이 있다면… 잠깐 쉬세요. 산책이 도움이 됩니다.'],
            ['진짜 심각한 일인데요?', '그럼 실제 법률 전문가에게 가세요. 저희 AI 판사들은 잠깐 자리 비우겠습니다.'],
            ['판결 결과 공유할 수 있나요?', '네! 결과 페이지에서 이미지 카드로 저장하거나 링크를 공개 전환해서 공유할 수 있어요.'],
          ].map(([q, a]) => `
            <div class="card" style="padding:16px 20px;">
              <div style="font-weight:700;font-size:14px;margin-bottom:6px;color:var(--cream);">Q. ${q}</div>
              <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">A. ${a}</div>
            </div>`).join('')}
        </div>

        <!-- 면책 -->
        <div class="disclaimer" style="margin-bottom:24px;">
          <strong>⚠️ 오락 서비스 안내</strong><br>
          쇼킹한판결소는 AI 기반 오락 서비스입니다. 생성된 판결문은 실제 법률 자문이 아니며 어떠한 법적 효력도 없습니다. 진짜 법적 문제는 실제 전문가에게 문의하세요.
        </div>

        <a href="#/submit" class="btn btn-primary">⚖️ 억울함 접수하러 가기</a>
      </div>
    </div>`;
}
