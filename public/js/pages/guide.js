const JUDGE_TYPES = [
  { icon: '👨‍⚖️', name: '엄벌주의형', desc: '카톡 읽씹도 중범죄 수준으로 처리합니다', color: '#c0392b' },
  { icon: '🥹', name: '감성형', desc: '눈물을 닦으며 양측 모두에게 깊이 공감합니다', color: '#8e44ad' },
  { icon: '🤦', name: '현실주의형', desc: '"그래서 어쩌라고요" — 냉소적 직격 판결', color: '#7f8c8d' },
  { icon: '🔥', name: '과몰입형', desc: '사소한 사건을 인류 역사의 정점으로 취급합니다', color: '#e67e22' },
  { icon: '😴', name: '피곤형', desc: '빨리 끝내고 퇴근하고 싶은 번아웃 판사', color: '#95a5a6' },
  { icon: '🧮', name: '논리집착형', desc: '모든 걸 수치화하는 논리 괴물. 감정은 변수가 아닙니다', color: '#2980b9' },
  { icon: '🎭', name: '드립형', desc: '진지한 척하다 절묘한 타이밍에 드립을 날립니다', color: '#27ae60' },
];

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
        <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:16px;">🎯 이용 순서</div>
        <div style="display:flex;flex-direction:column;gap:0;margin-bottom:36px;">
          ${[
            ['⚖️', '사건 고르기', '카톡 읽씹, 치킨 마지막 조각, 더치페이… 공감 100% 사건 중 하나를 고르거나, 직접 등록하세요.'],
            ['🙋', '입장 선택', '원고(주장하는 쪽) 또는 피고(반박하는 쪽) 중 내 입장을 선택하세요.'],
            ['🔗', '친구 초대', '링크를 친구에게 보내면 끝! 클릭하는 순간 자동으로 상대방 역할로 입장합니다. 가입 불필요.'],
            ['💬', '토론 (최대 10라운드)', '각자 번갈아 주장을 입력합니다. 1라운드 완료 후 언제든 판결 요청 가능. 더 토론하고 싶으면 최대 10라운드까지 이어갈 수 있어요.'],
            ['🏛️', 'AI 판결', '판결 요청 버튼을 누르면 랜덤 배정된 AI 판사가 논리와 설득력을 기준으로 판결합니다. 억울해도 논리가 부족하면 집니다.'],
          ].map(([icon, title, desc], i) => `
            <div style="display:flex;gap:0;align-items:stretch;">
              <div style="display:flex;flex-direction:column;align-items:center;width:44px;flex-shrink:0;">
                <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--gold-light));color:#0d1117;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;z-index:1;">${i + 1}</div>
                ${i < 4 ? '<div style="width:2px;flex:1;background:linear-gradient(to bottom,rgba(201,168,76,0.4),transparent);margin:4px 0;"></div>' : ''}
              </div>
              <div style="flex:1;padding:0 0 24px 16px;">
                <div style="font-weight:700;font-size:14px;color:var(--gold);margin-bottom:4px;padding-top:8px;">${icon} ${title}</div>
                <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">${desc}</div>
              </div>
            </div>`).join('')}
        </div>

        <!-- 판사 유형 -->
        <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:16px;">👨‍⚖️ 랜덤 판사 7가지 유형</div>
        <div style="font-size:13px;color:var(--cream-dim);margin-bottom:14px;line-height:1.7;">
          매 재판마다 판사가 랜덤 배정됩니다. 같은 사건도 판사 성향에 따라 판결 톤이 완전히 달라지니 여러 번 해보세요 😄
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:32px;">
          ${JUDGE_TYPES.map(j => `
            <div style="padding:12px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,0.02);">
              <div style="font-size:22px;margin-bottom:5px;">${j.icon}</div>
              <div style="font-size:12px;font-weight:700;color:${j.color};margin-bottom:3px;">${j.name}</div>
              <div style="font-size:11px;color:var(--cream-dim);line-height:1.5;">${j.desc}</div>
            </div>`).join('')}
        </div>

        <!-- FAQ -->
        <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:16px;">❓ 자주 묻는 질문</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:36px;">
          ${[
            ['진짜 법원이에요?', '아니요. AI 판사이며 판결에 어떠한 법적 효력도 없습니다. 순수 오락 서비스입니다.'],
            ['친구가 가입해야 하나요?', '아니요. 링크를 받은 친구는 가입 없이 바로 참가할 수 있습니다.'],
            ['모르는 사람과도 할 수 있나요?', '네! 랜덤 매칭으로 대기자가 있을 때 자동 연결됩니다.'],
            ['몇 라운드나 토론할 수 있나요?', '최대 10라운드까지 가능하며, 1라운드 완료 후 언제든 "지금 바로 판결받기" 버튼으로 판결을 요청할 수 있습니다.'],
            ['개인정보 수집하나요?', '서비스 운영을 위한 익명 인증만 사용합니다. 이름·연락처·주민번호는 절대 입력하지 마세요.'],
            ['직접 사건을 등록할 수 있나요?', '네! "내 억울한 사건 등록하기"에서 직접 등록하면 검토 후 공개됩니다.'],
          ].map(([q, a]) => `
            <details style="border:1px solid var(--border);border-radius:10px;overflow:hidden;">
              <summary style="padding:14px 16px;font-weight:700;font-size:13px;color:var(--cream);cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;">
                Q. ${q}
                <span style="color:var(--gold);font-size:16px;">+</span>
              </summary>
              <div style="padding:0 16px 14px;font-size:13px;color:var(--cream-dim);line-height:1.7;border-top:1px solid var(--border);margin-top:0;padding-top:12px;">
                A. ${a}
              </div>
            </details>`).join('')}
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
