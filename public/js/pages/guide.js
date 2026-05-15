export function renderGuide() {
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div style="max-width:720px;margin:0 auto">
      <div class="section-header">
        <h1 class="section-title">소소킹 이용 가이드 📖</h1>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card__body--lg">
          <h2 style="font-size:18px;font-weight:800;margin-bottom:8px">소소킹이란?</h2>
          <p style="font-size:14px;color:var(--color-text-secondary);line-height:1.8">
            소소킹은 글과 사진으로 <strong>미친작명소, 삼행시, 밸런스게임, 퀴즈, 나만의 노하우</strong>를 즐기는 놀이형 커뮤니티예요.
            누구나 놀이판을 열고, 다른 사람들이 투표·댓글·퀴즈·삼행시·드립으로 참여할 수 있어요.
          </p>
        </div>
      </div>

      <div class="section-header" style="margin-top:24px">
        <h2 class="section-title">3개 카테고리</h2>
      </div>

      ${[
        {
          icon: '🎯', cat: '골라봐', color: 'var(--color-cat-golra)',
          desc: '선택, 투표, 퀴즈 중심 — 빠르게 고르고 참여하는 공간',
          types: ['밸런스게임', '민심투표', '선택지배틀', 'OX퀴즈', '내맘대로퀴즈'],
        },
        {
          icon: '😂', cat: '웃겨봐', color: 'var(--color-cat-usgyo)',
          desc: '드립, 댓글, 삼행시, 사진 제목 — 소소킹 재미의 핵심',
          types: ['미친작명소', '삼행시짓기', '댓글배틀', '웃참챌린지', '한줄드립'],
        },
        {
          icon: '💬', cat: '말해봐', color: 'var(--color-cat-malhe)',
          desc: '경험, 노하우, 고민 — 직접 겪은 이야기와 나만의 방법',
          types: ['나만의노하우', '경험담', '실패담', '고민/질문', '막장릴레이'],
        },
      ].map(c => `
        <div class="card" style="margin-bottom:12px">
          <div class="card__body">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <span style="font-size:28px">${c.icon}</span>
              <div>
                <div style="font-size:17px;font-weight:800;color:${c.color}">${c.cat}</div>
                <div style="font-size:12px;color:var(--color-text-muted)">${c.desc}</div>
              </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${c.types.map(t => `<span class="badge badge--gray">${t}</span>`).join('')}
            </div>
          </div>
        </div>`).join('')}

      <div class="section-header" style="margin-top:24px">
        <h2 class="section-title">이용 규칙</h2>
      </div>
      <div class="card">
        <div class="card__body">
          <ul style="font-size:14px;line-height:2;color:var(--color-text-secondary);padding-left:16px">
            <li>타인을 비방하거나 혐오하는 내용은 제재 대상이에요</li>
            <li>개인정보(실명, 연락처 등)는 올리지 마세요</li>
            <li>광고, 스팸, 도배 글은 삭제될 수 있어요</li>
            <li>글과 사진 중심으로 운영해요 (유튜브·외부링크 제외)</li>
          </ul>
        </div>
      </div>
    </div>`;
}
