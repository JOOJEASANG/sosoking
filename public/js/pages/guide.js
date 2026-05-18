import { navigate } from '../router.js';

const GAMES = [
  { icon:'🗳️', name:'골라킹', desc:'선택지를 올리고 사람들이 하나를 골라 민심을 확인하는 투표형 놀이입니다.' },
  { icon:'😜', name:'미친작명소', desc:'사진이나 상황에 가장 웃긴 이름을 붙이는 댓글 참여형 놀이입니다.' },
  { icon:'🔤', name:'초성게임', desc:'초성을 보고 떠오르는 단어를 댓글로 남기는 센스 대결입니다. 정답은 따로 없습니다.' },
  { icon:'🧠', name:'미친퀴즈', desc:'사용자가 직접 객관식 또는 주관식 퀴즈를 만들고 정답/오답을 확인하는 자유 퀴즈입니다.' },
  { icon:'⚖️', name:'억까재판', desc:'어이없는 사건에 유죄·무죄·사형·봐준다 판결을 내리고 댓글로 이유를 남기는 놀이입니다.' },
  { icon:'🎭', name:'막장킹', desc:'한 문장씩 이어가며 어디로 튈지 모르는 막장 전개를 만드는 릴레이 놀이입니다.' },
];

export function renderGuide() {
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div class="guide-page">
      <div class="guide-hero">
        <div class="guide-hero__icon">📖</div>
        <h1 class="guide-hero__title">소소킹 이용안내</h1>
        <p class="guide-hero__sub">대표 6가지 놀이와 주간 행시 미션을 가볍게 즐기는 참여형 커뮤니티입니다.</p>
      </div>

      <div class="guide-toc card">
        <div class="guide-toc__title">📌 목차</div>
        <div class="guide-toc__list">
          ${[
            ['#guide-what', '소소킹이란?'],
            ['#guide-start', '시작하기'],
            ['#guide-layout', '화면 구성'],
            ['#guide-games', '대표 6가지 놀이'],
            ['#guide-mission', '주간 행시 미션'],
            ['#guide-play', '참여 방법'],
            ['#guide-write', '놀이판 만들기'],
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
            <div class="guide-intro-card__title">짧게 만들고, 가볍게 참여하는 놀이 커뮤니티</div>
            <div class="guide-intro-card__desc">
              소소킹은 긴 글보다 <strong>선택, 댓글, 투표, 퀴즈, 릴레이</strong>로 노는 커뮤니티입니다.<br><br>
              일반 작성 유형은 <strong>골라킹, 미친작명소, 초성게임, 미친퀴즈, 억까재판, 막장킹</strong> 6가지로 운영됩니다.
              별도로 <strong>삼행시·사행시·오행시·육행시</strong>는 주간 미션 전용으로 제공됩니다.
            </div>
          </div>
        </div>
      </div>

      <div class="guide-section" id="guide-start">
        <h2 class="guide-section__title">🔑 시작하기</h2>
        <div class="guide-steps">
          ${[
            { n:'1', icon:'🔑', title:'로그인', desc:'Google 계정 또는 이메일과 비밀번호로 로그인할 수 있습니다.' },
            { n:'2', icon:'😊', title:'닉네임 설정', desc:'처음 로그인하면 닉네임을 설정합니다. 내 정보에서 수정할 수 있습니다.' },
            { n:'3', icon:'✏️', title:'놀이판 만들기', desc:'대표 6가지 놀이 중 하나를 골라 새 글을 올립니다.' },
            { n:'4', icon:'💬', title:'참여하기', desc:'투표, 댓글, 리액션, 스크랩, 공유로 다른 이용자의 놀이판에 참여합니다.' },
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
              <div class="guide-layout-item"><span class="guide-layout-badge">좌측 사이드바</span>홈, 탐색, 미션, 명예의 전당, 스크랩, 글쓰기 버튼을 사용할 수 있습니다.</div>
              <div class="guide-layout-item"><span class="guide-layout-badge">중앙 콘텐츠</span>홈과 각 페이지는 같은 폭의 중앙 레이아웃으로 표시됩니다.</div>
            </div>
          </div>
          <div class="guide-layout-card">
            <div class="guide-layout-card__head">📱 모바일</div>
            <div class="guide-layout-card__body">
              <div class="guide-layout-item"><span class="guide-layout-badge">상단 헤더</span>로고, 알림, 내 정보, 테마 전환을 사용할 수 있습니다.</div>
              <div class="guide-layout-item"><span class="guide-layout-badge">하단 탭바</span>홈, 탐색, 글쓰기, 미션, 내 정보로 빠르게 이동합니다.</div>
            </div>
          </div>
        </div>
      </div>

      <div class="guide-section" id="guide-games">
        <h2 class="guide-section__title">🎲 대표 6가지 놀이</h2>
        <p style="font-size:13px;color:var(--color-text-secondary);margin-bottom:20px">현재 소소킹은 복잡한 카테고리 구분 없이 대표 놀이 6가지를 중심으로 운영됩니다.</p>
        <div class="guide-features">
          ${GAMES.map(g => `
            <div class="guide-feature-card">
              <div class="guide-feature-card__icon">${g.icon}</div>
              <div class="guide-feature-card__title">${g.name}</div>
              <div class="guide-feature-card__desc">${g.desc}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="guide-section" id="guide-mission">
        <h2 class="guide-section__title">✍️ 주간 행시 미션</h2>
        <div class="guide-intro-card">
          <div class="guide-intro-card__icon">🔥</div>
          <div>
            <div class="guide-intro-card__title">행시는 미션에서만 참여합니다</div>
            <div class="guide-intro-card__desc">
              제시어 길이에 따라 자동으로 삼행시·사행시·오행시·육행시가 됩니다.<br>
              3글자 제시어는 삼행시, 4글자는 사행시, 5글자는 오행시, 6글자는 육행시로 저장됩니다.<br><br>
              미션으로 작성한 글은 하루가 지나도 사라지지 않고 일반 게시글처럼 계속 남습니다.
            </div>
          </div>
        </div>
      </div>

      <div class="guide-section" id="guide-play">
        <h2 class="guide-section__title">⚡ 참여 방법</h2>
        <div class="guide-features">
          ${[
            { icon:'🖱️', title:'투표하기', desc:'골라킹과 억까재판에서 선택지를 눌러 참여합니다.' },
            { icon:'💬', title:'댓글 달기', desc:'작명, 초성게임, 막장킹, 판결 이유 등 대부분의 놀이는 댓글 참여가 핵심입니다.' },
            { icon:'😂', title:'댓글 리액션', desc:'재밌는 댓글에 리액션을 남기고 베스트 댓글을 만듭니다.' },
            { icon:'❤️', title:'게시글 반응', desc:'게시글에도 리액션을 남길 수 있고, 반응이 많으면 인기글에 노출됩니다.' },
            { icon:'🔖', title:'스크랩', desc:'나중에 다시 보고 싶은 글은 스크랩해 내 정보에서 모아봅니다.' },
            { icon:'🚨', title:'신고', desc:'부적절한 글이나 댓글은 신고할 수 있으며 관리자가 검토합니다.' },
          ].map(f => `
            <div class="guide-feature-card">
              <div class="guide-feature-card__icon">${f.icon}</div>
              <div class="guide-feature-card__title">${f.title}</div>
              <div class="guide-feature-card__desc">${f.desc}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="guide-section" id="guide-write">
        <h2 class="guide-section__title">✏️ 놀이판 만들기</h2>
        <div class="guide-write-steps">
          ${[
            ['1', '유형 선택', '대표 6가지 놀이 중 하나를 선택합니다.'],
            ['2', '내용 작성', '유형별 입력 항목에 맞게 제목, 설명, 선택지, 정답, 힌트 등을 작성합니다.'],
            ['3', '올리기', '올린 글은 탐색과 홈 최신글에 노출됩니다.'],
            ['4', '관리', '내 정보에서 내가 쓴 글을 확인하고 필요하면 삭제할 수 있습니다.'],
          ].map(([n, title, desc]) => `
            <div class="guide-write-step">
              <div class="guide-write-step__num">${n}</div>
              <div class="guide-write-step__content">
                <div class="guide-write-step__title">${title}</div>
                <div class="guide-write-step__desc">${desc}</div>
              </div>
            </div>`).join('')}
        </div>
        <button class="btn btn--primary btn--full" id="guide-write-btn" style="margin-top:16px">놀이판 만들기</button>
      </div>

      <div class="guide-section" id="guide-hall">
        <h2 class="guide-section__title">🏆 명예의 전당</h2>
        <p style="font-size:14px;color:var(--color-text-secondary);line-height:1.7">리액션과 댓글 참여가 많은 글과 댓글은 명예의 전당에 노출될 수 있습니다. 운영 상황에 따라 집계 기준은 조정될 수 있습니다.</p>
      </div>

      <div class="guide-section" id="guide-account">
        <h2 class="guide-section__title">👤 내 정보</h2>
        <p style="font-size:14px;color:var(--color-text-secondary);line-height:1.7">내가 쓴 글, 스크랩, 알림, 닉네임 변경, 계정 설정을 확인할 수 있습니다. PC에서는 사이드바 하단 사용자 정보를 누르면 이동합니다.</p>
      </div>

      <div class="guide-section" id="guide-rules">
        <h2 class="guide-section__title">🚦 이용 규칙</h2>
        <div class="guide-rules">
          ${[
            '욕설, 혐오, 비방, 개인정보 노출, 도배, 광고성 게시물은 제한될 수 있습니다.',
            '타인의 저작권을 침해하는 이미지나 내용을 올리지 마세요.',
            '재미있는 표현은 좋지만 특정 개인이나 집단을 공격하는 내용은 삭제될 수 있습니다.',
            '운영자는 신고된 글과 댓글을 검토해 숨김, 삭제, 이용 제한을 할 수 있습니다.',
          ].map(rule => `<div class="guide-rule-item">${rule}</div>`).join('')}
        </div>
      </div>
    </div>`;

  document.getElementById('guide-write-btn')?.addEventListener('click', () => navigate('/write'));
}
