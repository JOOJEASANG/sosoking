export function renderGuide() {
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div class="guide-page">

      <!-- 헤더 -->
      <div class="guide-hero">
        <div class="guide-hero__icon">📖</div>
        <h1 class="guide-hero__title">소소킹 이용 가이드</h1>
        <p class="guide-hero__sub">처음 오셨나요? 3분이면 다 알 수 있어요!</p>
      </div>

      <!-- 소소킹이란 -->
      <div class="guide-section">
        <div class="guide-intro-card">
          <div class="guide-intro-card__icon">🎮</div>
          <div>
            <div class="guide-intro-card__title">소소킹이란?</div>
            <div class="guide-intro-card__desc">
              밸런스게임, 퀴즈, 삼행시, 작명소, 고민까지 — 누구나 놀이판을 열고 짧게 참여하는
              <strong>게임형 커뮤니티</strong>예요. 긴 글 대신 짧은 한마디로도 충분해요!
            </div>
          </div>
        </div>
      </div>

      <!-- 참여 방법 스텝 -->
      <div class="guide-section">
        <h2 class="guide-section__title">🚀 이렇게 시작해요</h2>
        <div class="guide-steps">
          ${[
            { n: '1', icon: '🔑', title: '로그인', desc: 'Google 계정 또는 이메일로 30초 만에 가입' },
            { n: '2', icon: '👀', title: '구경하기', desc: '피드에서 인기 놀이판을 둘러봐요' },
            { n: '3', icon: '⚡', title: '참여하기', desc: '투표·댓글·삼행시 등으로 짧게 참여' },
            { n: '4', icon: '✏️', title: '만들기', desc: '내 놀이판을 열어 친구들을 초대해요' },
          ].map(s => `
            <div class="guide-step">
              <div class="guide-step__num">${s.n}</div>
              <div class="guide-step__icon">${s.icon}</div>
              <div class="guide-step__title">${s.title}</div>
              <div class="guide-step__desc">${s.desc}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- 3개 카테고리 -->
      <div class="guide-section">
        <h2 class="guide-section__title">🗂️ 3가지 놀이 카테고리</h2>
        <div class="guide-cats">

          <div class="guide-cat guide-cat--golra">
            <div class="guide-cat__head">
              <span class="guide-cat__icon">🎯</span>
              <div>
                <div class="guide-cat__name">골라봐 — CHOOSE</div>
                <div class="guide-cat__sub">선택·투표·퀴즈 중심, 누르면 즉시 참여</div>
              </div>
            </div>
            <div class="guide-cat__types">
              ${[
                { name: '밸런스게임', desc: '둘 중 하나만 골라요 — 짜장 vs 짬뽕' },
                { name: '민심투표', desc: '찬반 또는 여러 선택지 투표' },
                { name: 'OX퀴즈', desc: '맞으면 O, 틀리면 X' },
                { name: '4지선다 퀴즈', desc: '4개 중 하나, 정답 확인까지' },
                { name: '선택지배틀', desc: '두 팀으로 나눠 댓글 배틀' },
              ].map(t => `
                <div class="guide-type-item">
                  <span class="guide-type-badge guide-type-badge--golra">${t.name}</span>
                  <span class="guide-type-desc">${t.desc}</span>
                </div>`).join('')}
            </div>
          </div>

          <div class="guide-cat guide-cat--usgyo">
            <div class="guide-cat__head">
              <span class="guide-cat__icon">😂</span>
              <div>
                <div class="guide-cat__name">웃겨봐 — FUNNY</div>
                <div class="guide-cat__sub">드립·삼행시·작명 — 센스 대결</div>
              </div>
            </div>
            <div class="guide-cat__types">
              ${[
                { name: '미친작명소', desc: '사진에 웃긴 이름을 붙여봐요' },
                { name: '삼행시짓기', desc: '제시어로 삼행시 — 좋아요로 순위 결정' },
                { name: '한줄드립', desc: '상황에 맞는 한 줄 드립 대결' },
                { name: '댓글배틀', desc: '두 팀으로 나눠 웃긴 댓글 배틀' },
                { name: '웃참챌린지', desc: '참으면 지는 상황 공유' },
              ].map(t => `
                <div class="guide-type-item">
                  <span class="guide-type-badge guide-type-badge--usgyo">${t.name}</span>
                  <span class="guide-type-desc">${t.desc}</span>
                </div>`).join('')}
            </div>
          </div>

          <div class="guide-cat guide-cat--malhe">
            <div class="guide-cat__head">
              <span class="guide-cat__icon">💬</span>
              <div>
                <div class="guide-cat__name">말해봐 — TALK</div>
                <div class="guide-cat__sub">경험·노하우·고민 — 편하게 나눠요</div>
              </div>
            </div>
            <div class="guide-cat__types">
              ${[
                { name: '나만의노하우', desc: '생활 꿀팁, 나만 아는 방법 공유' },
                { name: '경험담', desc: '직접 겪은 이야기 (성공·실패 모두)' },
                { name: '고민/질문', desc: '가볍게 묻고 댓글로 답받기' },
                { name: '실패담', desc: '웃기거나 아픈 실패 경험 공유' },
                { name: '막장릴레이', desc: '한 문장씩 이어가는 릴레이 스토리' },
              ].map(t => `
                <div class="guide-type-item">
                  <span class="guide-type-badge guide-type-badge--malhe">${t.name}</span>
                  <span class="guide-type-desc">${t.desc}</span>
                </div>`).join('')}
            </div>
          </div>

        </div>
      </div>

      <!-- 게임 기능 -->
      <div class="guide-section">
        <h2 class="guide-section__title">🏆 게임 기능</h2>
        <div class="guide-features">
          ${[
            { icon: '🔥', title: '출석 스트릭', desc: '매일 방문하면 연속 출석 기록이 쌓여요. 7일 달성 시 주간 챌린저!' },
            { icon: '👑', title: '칭호 시스템', desc: '글 작성 수에 따라 뉴비 → 소소왕 → 소소킹까지 칭호가 올라가요.' },
            { icon: '🔔', title: '알림', desc: '내 글에 댓글이 달리면 알림으로 바로 알 수 있어요.' },
            { icon: '🔖', title: '스크랩', desc: '마음에 드는 글을 스크랩해 두면 내 정보 페이지에서 모아볼 수 있어요.' },
            { icon: '🎯', title: 'AI 미션', desc: '매일 새로운 AI 미션이 출제돼요. 미션을 완료하면 더 많은 사람에게 노출!' },
            { icon: '🏅', title: '주간 결선', desc: '이번 주 최고 삼행시·드립을 사이드바에서 확인할 수 있어요.' },
          ].map(f => `
            <div class="guide-feature-card">
              <div class="guide-feature-card__icon">${f.icon}</div>
              <div class="guide-feature-card__title">${f.title}</div>
              <div class="guide-feature-card__desc">${f.desc}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- 이용 규칙 -->
      <div class="guide-section">
        <h2 class="guide-section__title">📋 이용 규칙</h2>
        <div class="guide-rules">
          ${[
            { emoji: '✅', text: '재미있고 창의적인 참여 환영해요!' },
            { emoji: '✅', text: '다른 사람의 게시물에 반응·댓글로 적극 참여해요.' },
            { emoji: '❌', text: '타인 비방, 욕설, 혐오 표현은 제재 대상이에요.' },
            { emoji: '❌', text: '개인정보(실명·연락처 등)는 올리지 마세요.' },
            { emoji: '❌', text: '광고, 스팸, 도배 글은 삭제될 수 있어요.' },
            { emoji: '❌', text: '외부 링크·영상 무단 게시는 운영 방침에 따라 제한됩니다.' },
          ].map(r => `
            <div class="guide-rule-item">
              <span class="guide-rule-emoji">${r.emoji}</span>
              <span>${r.text}</span>
            </div>`).join('')}
        </div>
        <div style="margin-top:16px;text-align:center">
          <a href="#/terms" class="btn btn--ghost btn--sm">이용약관 전문 보기</a>
          <a href="#/privacy" class="btn btn--ghost btn--sm" style="margin-left:8px">개인정보처리방침</a>
        </div>
      </div>

    </div>`;
}
