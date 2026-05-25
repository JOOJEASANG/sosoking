import { navigate } from '../router.js';

const FEED_FEATURES = [
  { icon:'📝', name:'일반', desc:'일상, 고민, 웃긴 일, 사진을 자유롭게 올리고 댓글로 이야기합니다.' },
  { icon:'🗳️', name:'투표·판정', desc:'일반 투표, 밸런스 게임, 판정(유/무죄), 찬반 토론 4가지 방식으로 가볍게 의견을 받아봅니다.' },
  { icon:'😜', name:'작명', desc:'사진이나 상황에 어울리는 웃긴 이름을 댓글로 붙입니다.' },
  { icon:'🤣', name:'드립', desc:'짧은 주제에 80자 이내 한 줄 드립을 남기며 피식 웃는 공간입니다.' },
  { icon:'🧠', name:'퀴즈', desc:'주관식 또는 객관식 문제를 올리고 정답과 해설을 확인합니다.' },
];

const GAME_FEATURES = [
  { icon:'🕵️', name:'AI 라이어 찾기', desc:'친구를 초대해 제시어를 모르는 AI 라이어를 채팅으로 추리하고 투표로 잡아내는 게임입니다. 4~8명.' },
  { icon:'🌙', name:'AI 마피아', desc:'AI 마피아가 직접 토론에 참여합니다. 낮 토론·투표로 AI를 찾아내는 사회추론 게임입니다. 5~9명.' },
  { icon:'👑', name:'터치왕게임', desc:'12개 그림 중 같은 그림을 가장 빨리 터치하는 순발력 대결 게임입니다. 2~10명, 방 만들기 지원.' },
];

export function renderGuide() {
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div class="guide-page">
      <div class="guide-hero">
        <div class="guide-hero__icon">📖</div>
        <h1 class="guide-hero__title">소소킹 이용안내</h1>
        <p class="guide-hero__sub">소소킹은 거창하지 않아도 재밌는 순간을 모으는 참여형 커뮤니티입니다. 짧게 올리고, 가볍게 누르고, 댓글로 피식 웃어보세요.</p>
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
            <div class="guide-intro-card__title">소소함의 재미를 모으는 놀이터</div>
            <div class="guide-intro-card__desc">
              소소킹은 긴 글을 잘 써야 하는 곳이 아닙니다.<br><br>
              <strong>일반, 투표, 작명, 드립, 퀴즈</strong>처럼 짧고 쉬운 형식으로 누구나 바로 참여할 수 있는 커뮤니티입니다.<br><br>
              별것 아닌 일상도 누군가의 댓글, 투표, 드립을 만나면 작은 재미가 됩니다.
            </div>
          </div>
        </div>
      </div>

      <div class="guide-section" id="guide-feed">
        <h2 class="guide-section__title">🧩 피드 · 짧게 노는 게시판</h2>
        <p style="font-size:13px;color:var(--color-text-secondary);margin-bottom:20px">피드는 하나의 게시판 안에서 다섯 가지 형식으로 글을 만들고 참여하는 공간입니다.</p>
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
            <div class="guide-intro-card__title">가볍게 모여 노는 게임공간</div>
            <div class="guide-intro-card__desc">
              소소랜드는 돈을 써야 유리해지는 게임공간이 아닙니다. 누구나 같은 조건에서 즐길 수 있는 게임을 목표로 합니다.<br>
              초기에는 초대 링크로 친구를 불러 함께 노는 구조로 시작하고, 이후 게임 종류와 편의 기능을 단계적으로 추가합니다.
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
            { n:'3', icon:'✏️', title:'피드 글쓰기', desc:'일반, 투표, 작명, 드립, 퀴즈 중 하나를 골라 짧게 올릴 수 있습니다.' },
            { n:'4', icon:'💬', title:'가볍게 참여', desc:'투표하고, 이름 붙이고, 드립을 남기고, 댓글로 소소하게 놀면 됩니다.' },
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
              <div class="guide-layout-item"><span class="guide-layout-badge">사이드바</span>홈, 피드, 게임, 통계, 스크랩, 내 정보로 이동합니다.</div>
              <div class="guide-layout-item"><span class="guide-layout-badge">글쓰기</span>피드 만들기 버튼으로 바로 글쓰기를 시작합니다.</div>
              <div class="guide-layout-item"><span class="guide-layout-badge">중앙 콘텐츠</span>피드 글, 게임 화면, 상세 페이지가 중앙 영역에 표시됩니다.</div>
            </div>
          </div>
          <div class="guide-layout-card">
            <div class="guide-layout-card__head">📱 모바일</div>
            <div class="guide-layout-card__body">
              <div class="guide-layout-item"><span class="guide-layout-badge">상단 헤더</span>로고, 알림, 내 정보, 테마 전환을 사용할 수 있습니다.</div>
              <div class="guide-layout-item"><span class="guide-layout-badge">하단 탭바</span>홈, 피드, 글쓰기(+), 게임, 내 정보로 빠르게 이동합니다.</div>
              <div class="guide-layout-item"><span class="guide-layout-badge">피드</span>짧은 글과 참여형 글을 바로 확인하고 반응할 수 있습니다.</div>
            </div>
          </div>
        </div>
      </div>

      <div class="guide-section" id="guide-play">
        <h2 class="guide-section__title">⚡ 참여 방법</h2>
        <div class="guide-features">
          ${[
            { icon:'🖱️', title:'투표하기', desc:'선택지를 누르고 댓글로 이유를 남깁니다.' },
            { icon:'😜', title:'작명하기', desc:'사진이나 상황에 어울리는 이름을 자유롭게 붙입니다.' },
            { icon:'🤣', title:'드립 남기기', desc:'80자 이내 한 줄로 짧고 강하게 웃겨봅니다.' },
            { icon:'🧠', title:'퀴즈 풀기', desc:'정답을 맞히고 해설을 확인합니다.' },
            { icon:'💬', title:'댓글과 답글', desc:'소소킹의 핵심은 댓글입니다. 짧게 반응하고 이어가면 됩니다.' },
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
            ['1', '글쓰기 선택', 'PC에서는 사이드바의 피드 만들기 버튼, 모바일에서는 피드 화면의 글쓰기 버튼을 누릅니다.'],
            ['2', '글쓰기 형식 선택', '일반, 투표·판정, 작명, 드립, 퀴즈 중 하나를 고릅니다.'],
            ['3', '짧게 작성', '제목, 본문, 사진, 선택지, 정답 등 형식에 맞는 내용을 입력합니다.'],
            ['4', '소소하게 놀기', '올린 글은 피드에 노출되고 댓글, 답글, 반응으로 이어집니다.'],
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
        <p style="font-size:14px;color:var(--color-text-secondary);line-height:1.7">내가 쓴 글, 스크랩, 알림, 닉네임, 프로필 아이콘, 계정 설정을 확인할 수 있습니다. 익명 글은 화면에는 익명으로 보이지만 운영상 필요한 범위에서 신고 대응을 위해 작성자 식별 정보가 보관될 수 있습니다.</p>
      </div>

      <div class="guide-section" id="guide-rules">
        <h2 class="guide-section__title">🚦 이용 규칙</h2>
        <div class="guide-rules">
          ${[
            '욕설, 혐오, 비방, 개인정보 노출, 도배, 광고성 게시물은 제한될 수 있습니다.',
            '타인의 저작권, 초상권, 개인정보를 침해하는 이미지나 내용을 올리지 마세요.',
            '익명 글도 신고와 운영 정책 적용 대상이며, 타인을 공격하거나 허위 사실을 퍼뜨리는 용도로 사용할 수 없습니다.',
            '재미있는 표현은 좋지만 특정 개인이나 집단을 공격하는 내용은 삭제될 수 있습니다.',
            '게임은 공정한 공간을 지향하며, 부정행위나 방해 행위는 제한될 수 있습니다.',
            '운영자는 신고된 글, 댓글, 게임방을 검토해 숨김, 삭제, 이용 제한을 할 수 있습니다.',
          ].map(rule => `<div class="guide-rule-item">${rule}</div>`).join('')}
        </div>
      </div>
    </div>`;

  document.getElementById('guide-write-btn')?.addEventListener('click', () => navigate('/write?type=multi'));
}