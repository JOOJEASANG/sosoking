import { navigate } from '../router.js';

const FEED_FEATURES = [
  { icon:'🧩', name:'멀티형 게시판', desc:'글, 사진, 투표, 작명, 삼행시, 퀴즈, 댓글, 답글을 한 게시판 안에서 자유롭게 조합합니다.' },
  { icon:'😜', name:'미친작명소', desc:'사진이나 상황을 올리고 사람들이 웃긴 이름을 붙이며 소통합니다.' },
  { icon:'✍️', name:'삼행시', desc:'제시어를 등록하고 참여자가 글자별로 한 줄씩 센스 있게 완성합니다.' },
  { icon:'🗳️', name:'투표/판정', desc:'고민, 선택, 억울한 상황, 밸런스 질문을 올리고 사람들의 판정을 받아봅니다.' },
  { icon:'🧠', name:'퀴즈', desc:'간단한 문제를 내고 사람들이 정답을 맞히며 댓글로 함께 놀 수 있습니다.' },
  { icon:'💬', name:'댓글형 이어쓰기', desc:'릴레이형 놀이는 별도 메뉴가 아니라 댓글과 답글 흐름에서 자연스럽게 이어갑니다.' },
];

const GAME_FEATURES = [
  { icon:'🕵️', name:'라이어게임', desc:'친구를 초대해 제시어를 모르는 라이어를 찾아내는 추리 게임입니다.' },
  { icon:'🌙', name:'소소마피아', desc:'복잡한 과금 없이 가볍게 즐기는 모바일 마피아 게임으로 확장 예정입니다.' },
  { icon:'🎲', name:'소소마블', desc:'돈 쓰는 게임이 아니라 운과 선택으로 즐기는 공정한 보드게임으로 기획 중입니다.' },
];

export function renderGuide() {
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div class="guide-page">
      <div class="guide-hero">
        <div class="guide-hero__icon">📖</div>
        <h1 class="guide-hero__title">소소킹 이용안내</h1>
        <p class="guide-hero__sub">소소킹은 재미있는 멀티게시판 커뮤니티와 과금유도 없는 게임공간을 함께 제공하는 참여형 놀이터입니다.</p>
      </div>

      <div class="guide-toc card">
        <div class="guide-toc__title">📌 목차</div>
        <div class="guide-toc__list">
          ${[
            ['#guide-what', '소소킹이란?'],
            ['#guide-feed', '피드'],
            ['#guide-game', '게임'],
            ['#guide-start', '시작하기'],
            ['#guide-layout', '화면 구성'],
            ['#guide-play', '참여 방법'],
            ['#guide-write', '글쓰기'],
            ['#guide-hall', '명예의 전당'],
            ['#guide-account', '내 정보'],
            ['#guide-rules', '이용 규칙'],
          ].map(([href, label]) => `<a class="guide-toc__item" href="${href}">${label}</a>`).join('')}
        </div>
      </div>

      <div class="guide-section" id="guide-what">
        <h2 class="guide-section__title">🎮 소소킹이란?</h2>
        <div class="guide-intro-card">
          <div class="guide-intro-card__icon">🃏</div>
          <div>
            <div class="guide-intro-card__title">재밌는 커뮤니티와 게임공간</div>
            <div class="guide-intro-card__desc">
              소소킹은 <strong>피드</strong>와 <strong>게임</strong>으로 나뉩니다.<br><br>
              피드는 멀티형 게시판입니다. 글을 쓰고, 사진을 올리고, 문제를 내고, 투표를 붙이고, 댓글과 답글로 소통하는 모든 활동이 한 게시판 안에서 이루어집니다.<br><br>
              게임은 과금유도 없이 진짜 재미를 중심으로 운영되는 공간입니다. 라이어게임을 시작으로 소소마피아, 소소마블 같은 게임을 계속 추가해 나갑니다.
            </div>
          </div>
        </div>
      </div>

      <div class="guide-section" id="guide-feed">
        <h2 class="guide-section__title">🧩 피드 · 멀티게시판 커뮤니티</h2>
        <p style="font-size:13px;color:var(--color-text-secondary);margin-bottom:20px">피드는 하나의 게시판 안에서 여러 기능을 조합해 노는 공간입니다.</p>
        <div class="guide-features">
          ${FEED_FEATURES.map(g => `
            <div class="guide-feature-card">
              <div class="guide-feature-card__icon">${g.icon}</div>
              <div class="guide-feature-card__title">${g.name}</div>
              <div class="guide-feature-card__desc">${g.desc}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="guide-section" id="guide-game">
        <h2 class="guide-section__title">🎲 게임 · 소소랜드</h2>
        <div class="guide-intro-card">
          <div class="guide-intro-card__icon">🎮</div>
          <div>
            <div class="guide-intro-card__title">과금유도 없는 게임공간</div>
            <div class="guide-intro-card__desc">
              소소랜드는 돈을 써야 유리해지는 게임공간이 아닙니다. 누구나 같은 조건에서 즐길 수 있는 게임을 목표로 합니다.<br>
              초기에는 초대 링크로 친구를 불러 함께 노는 구조로 시작하고, 이후 실시간 방, 관전, 랭킹 기능을 단계적으로 추가합니다.
            </div>
          </div>
        </div>
        <div class="guide-features" style="margin-top:16px">
          ${GAME_FEATURES.map(g => `
            <div class="guide-feature-card">
              <div class="guide-feature-card__icon">${g.icon}</div>
              <div class="guide-feature-card__title">${g.name}</div>
              <div class="guide-feature-card__desc">${g.desc}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="guide-section" id="guide-start">
        <h2 class="guide-section__title">🔑 시작하기</h2>
        <div class="guide-steps">
          ${[
            { n:'1', icon:'🔑', title:'로그인', desc:'Google 계정 또는 이메일과 비밀번호로 로그인할 수 있습니다.' },
            { n:'2', icon:'😊', title:'닉네임 설정', desc:'처음 로그인하면 닉네임을 설정합니다. 내 정보에서 닉네임과 프로필 아이콘을 바꿀 수 있습니다.' },
            { n:'3', icon:'✏️', title:'피드 글쓰기', desc:'피드에서 글쓰기 버튼을 눌러 미친작명소, 삼행시, 투표/판정, 퀴즈형 글을 만들 수 있습니다.' },
            { n:'4', icon:'🎮', title:'게임 참여', desc:'게임 버튼에서 소소랜드로 이동해 라이어게임 등 추가되는 게임을 즐길 수 있습니다.' },
          ].map(s => `
            <div class="guide-step">
              <div class="guide-step__num">${s.n}</div>
              <div class="guide-step__icon">${s.icon}</div>
              <div class="guide-step__title">${s.title}</div>
              <div class="guide-step__desc">${s.desc}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="guide-section" id="guide-layout">
        <h2 class="guide-section__title">🖥️ 화면 구성</h2>
        <div class="guide-layout-grid">
          <div class="guide-layout-card">
            <div class="guide-layout-card__head">💻 PC</div>
            <div class="guide-layout-card__body">
              <div class="guide-layout-item"><span class="guide-layout-badge">사이드바</span>홈, 피드, 게임, 명예의 전당, 스크랩, 내 정보로 이동합니다.</div>
              <div class="guide-layout-item"><span class="guide-layout-badge">중앙 콘텐츠</span>피드 글, 게임 화면, 상세 페이지가 중앙 영역에 표시됩니다.</div>
            </div>
          </div>
          <div class="guide-layout-card">
            <div class="guide-layout-card__head">📱 모바일</div>
            <div class="guide-layout-card__body">
              <div class="guide-layout-item"><span class="guide-layout-badge">상단 헤더</span>로고, 알림, 내 정보, 테마 전환을 사용할 수 있습니다.</div>
              <div class="guide-layout-item"><span class="guide-layout-badge">하단 탭바</span>홈, 피드, 게임, 명예의 전당, 내 정보로 빠르게 이동합니다.</div>
            </div>
          </div>
        </div>
      </div>

      <div class="guide-section" id="guide-play">
        <h2 class="guide-section__title">⚡ 참여 방법</h2>
        <div class="guide-features">
          ${[
            { icon:'🖱️', title:'투표/판정하기', desc:'피드 글의 선택지를 누르거나 댓글로 의견을 남깁니다.' },
            { icon:'💬', title:'댓글과 답글', desc:'피드의 핵심은 소통입니다. 이어쓰기형 놀이는 댓글과 답글로 자연스럽게 이어집니다.' },
            { icon:'😂', title:'참여글 반응', desc:'재밌는 작명, 삼행시, 댓글에 반응을 남겨 분위기를 띄울 수 있습니다.' },
            { icon:'❤️', title:'게시글 반응', desc:'게시글에도 리액션을 남길 수 있고, 반응이 많으면 인기글에 노출될 수 있습니다.' },
            { icon:'🔖', title:'스크랩', desc:'나중에 다시 보고 싶은 글은 스크랩해 내 정보에서 모아봅니다.' },
            { icon:'🚨', title:'신고', desc:'부적절한 글, 댓글, 게임방은 신고할 수 있으며 관리자가 검토합니다.' },
          ].map(f => `
            <div class="guide-feature-card">
              <div class="guide-feature-card__icon">${f.icon}</div>
              <div class="guide-feature-card__title">${f.title}</div>
              <div class="guide-feature-card__desc">${f.desc}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="guide-section" id="guide-write">
        <h2 class="guide-section__title">✏️ 글쓰기</h2>
        <div class="guide-write-steps">
          ${[
            ['1', '피드에서 글쓰기 선택', '피드 상단의 글쓰기 버튼 또는 메뉴의 글쓰기 진입 버튼을 누릅니다.'],
            ['2', '형식 선택', '미친작명소, 삼행시, 투표/판정, 퀴즈 중 하나를 고르거나 필요한 기능을 직접 켭니다.'],
            ['3', '내용 작성', '제목, 본문, 사진, 제시어, 선택지, 정답 등을 입력합니다.'],
            ['4', '소통 시작', '올린 글은 피드에 노출되고 댓글, 답글, 반응으로 이어집니다.'],
          ].map(([n, title, desc]) => `
            <div class="guide-write-step">
              <div class="guide-write-step__num">${n}</div>
              <div class="guide-write-step__content">
                <div class="guide-write-step__title">${title}</div>
                <div class="guide-write-step__desc">${desc}</div>
              </div>
            </div>`).join('')}
        </div>
        <button class="btn btn--primary btn--full" id="guide-write-btn" style="margin-top:16px">글쓰기</button>
      </div>

      <div class="guide-section" id="guide-hall">
        <h2 class="guide-section__title">🏆 명예의 전당</h2>
        <p style="font-size:14px;color:var(--color-text-secondary);line-height:1.7">리액션과 댓글 참여가 많은 글과 댓글은 명예의 전당에 노출될 수 있습니다. 운영 상황에 따라 집계 기준은 조정될 수 있습니다.</p>
      </div>

      <div class="guide-section" id="guide-account">
        <h2 class="guide-section__title">👤 내 정보</h2>
        <p style="font-size:14px;color:var(--color-text-secondary);line-height:1.7">내가 쓴 글, 스크랩, 알림, 닉네임, 프로필 아이콘, 계정 설정을 확인할 수 있습니다. 프로필 아이콘은 기존 닉네임 앞글자 원형 자리에 표시됩니다.</p>
      </div>

      <div class="guide-section" id="guide-rules">
        <h2 class="guide-section__title">🚦 이용 규칙</h2>
        <div class="guide-rules">
          ${[
            '욕설, 혐오, 비방, 개인정보 노출, 도배, 광고성 게시물은 제한될 수 있습니다.',
            '타인의 저작권, 초상권, 개인정보를 침해하는 이미지나 내용을 올리지 마세요.',
            '재미있는 표현은 좋지만 특정 개인이나 집단을 공격하는 내용은 삭제될 수 있습니다.',
            '게임은 과금유도 없는 공정한 공간을 지향하며, 부정행위나 방해 행위는 제한될 수 있습니다.',
            '운영자는 신고된 글, 댓글, 게임방을 검토해 숨김, 삭제, 이용 제한을 할 수 있습니다.',
          ].map(rule => `<div class="guide-rule-item">${rule}</div>`).join('')}
        </div>
      </div>
    </div>`;

  document.getElementById('guide-write-btn')?.addEventListener('click', () => navigate('/write'));
}
