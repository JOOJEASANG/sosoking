export function renderHome(container) {
  const EXAMPLES = [
    { title: '라면 국물 무단 음용 사건', desc: '분명 내 라면인데 룸메이트가 국물만 다 마셨다.', index: 9, judge: '엄벌주의형' },
    { title: '충전기 독점 점거 사건', desc: '본인 폰은 완충됐는데 충전기를 계속 자기 방에 두었다.', index: 7, judge: '감성형' },
    { title: '카톡 읽씹 반복 사건', desc: '읽고 답장을 안 하길 반복. 총 17회.', index: 8, judge: '논리집착형' }
  ];

  container.innerHTML = `
    <div style="padding-bottom:60px;">
      <div style="background:linear-gradient(180deg,#161b2e 0%,#0d1117 100%);padding:60px 20px 44px;text-align:center;">
        <div style="font-size:12px;letter-spacing:.15em;color:var(--gold);margin-bottom:16px;font-weight:700;">⚖️ 소소킹 판결소</div>
        <h1 style="font-size:28px;line-height:1.35;margin-bottom:14px;">
          억울하셨군요.<br><span style="color:var(--gold);">판결해 드리겠습니다.</span>
        </h1>
        <p style="color:var(--cream-dim);font-size:15px;line-height:1.75;margin-bottom:32px;max-width:320px;margin-left:auto;margin-right:auto;">
          사소하고 유치한 일상의 사건을 입력하면<br>AI 판사가 진지하게 판결해드립니다.
        </p>
        <div style="max-width:360px;margin:0 auto;">
          <a href="#/submit" class="btn btn-primary">⚖️ 사건 접수하기</a>
        </div>
      </div>

      <div class="container" style="margin-top:36px;">
        <div style="font-size:11px;letter-spacing:.12em;color:var(--gold);font-weight:700;text-transform:uppercase;margin-bottom:14px;">판결 사례 예시</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${EXAMPLES.map(c => `
            <div class="card example-card" onclick="location.hash='#/submit'">
              <div class="case-title">${c.title}</div>
              <div style="font-size:13px;color:var(--cream-dim);margin-top:3px;">${c.desc}</div>
              <div class="case-meta">
                <span>억울지수 ${c.index}/10</span>
                <span>담당: ${c.judge} 판사</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="container" style="margin-top:28px;">
        <div class="disclaimer">
          <strong>⚠️ 오락 서비스 안내</strong><br>
          소소킹 판결소는 실제 법률 자문 서비스가 아닌 AI 기반 오락형 체험 서비스입니다. 본 서비스의 판결은 어떠한 법적 효력도 없으며, 재미를 위한 창작 결과물입니다.
        </div>
      </div>

      <div class="container" style="margin-top:36px;">
        <div style="font-size:11px;letter-spacing:.12em;color:var(--gold);font-weight:700;text-transform:uppercase;margin-bottom:14px;">이용 방법</div>
        <div style="display:flex;flex-direction:column;gap:14px;">
          ${[
            ['01','사건 접수','억울한 사건을 입력합니다'],
            ['02','AI 수사','접수관, 수사관이 사건을 검토합니다'],
            ['03','법정 공방','원고·피고 측 변호사가 주장을 펼칩니다'],
            ['04','최종 판결','판사가 판결문과 처분을 내립니다']
          ].map(([num,title,desc]) => `
            <div class="how-step">
              <div class="how-step-num">${num}</div>
              <div>
                <div style="font-weight:700;font-size:14px;margin-bottom:2px;">${title}</div>
                <div style="font-size:13px;color:var(--cream-dim);">${desc}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}
