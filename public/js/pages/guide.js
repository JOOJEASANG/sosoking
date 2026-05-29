import { navigate } from '../router.js';

const ROOM_FEATURES = [
  { icon:'📌', name:'모음방', desc:'유튜브 쇼츠/영상, 웃긴그림, 링크를 짧게 모아보는 공간입니다.' },
  { icon:'🗳️', name:'토론방', desc:'질문을 올리고 여러 선택지로 의견을 모으며 댓글로 이야기합니다.' },
  { icon:'🧠', name:'퀴즈방', desc:'주관식·객관식 퀴즈를 올리고 정답과 해설을 확인합니다.' },
  { icon:'🤣', name:'드립방', desc:'제목 없이 오늘의 한줄만 올리고 짧게 웃는 공간입니다.' },
];

export function renderGuide() {
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div class="guide-page">
      <div class="guide-hero">
        <div class="guide-hero__icon">📖</div>
        <h1 class="guide-hero__title">소소킹 이용안내</h1>
        <p class="guide-hero__sub">소소킹은 유튜브, 웃긴그림, 퀴즈, 토론, 한줄드립을 짧게 모아보고 가볍게 반응하는 모음방 서비스입니다.</p>
      </div>

      <div class="guide-toc card">
        <div class="guide-toc__title">📌 목차</div>
        <div class="guide-toc__list">
          ${[
            ['#guide-what', '소소킹이란?'],
            ['#guide-rooms', '방 구성'],
            ['#guide-start', '시작하기'],
            ['#guide-layout', '화면 구성'],
            ['#guide-play', '참여 방법'],
            ['#guide-write', '올리기'],
            ['#guide-stats', '통계'],
            ['#guide-account', '내 정보'],
            ['#guide-rules', '이용 규칙'],
          ].map(([href, label]) => `<a class="guide-toc__item" href="${href}">${label}</a>`).join('')}
        </div>
      </div>

      <div class="guide-section" id="guide-what">
        <h2 class="guide-section__title">👑 소소킹이란?</h2>
        <div class="guide-intro-card">
          <div class="guide-intro-card__icon">⚡</div>
          <div>
            <div class="guide-intro-card__title">쇼츠처럼 짧게 보고, 웃긴 것만 모아보는 곳</div>
            <div class="guide-intro-card__desc">
              소소킹은 긴 글을 잘 써야 하는 게시판이 아닙니다.<br><br>
              <strong>모음방, 토론방, 퀴즈방, 드립방</strong>처럼 목적이 분명한 방에서 짧은 콘텐츠를 올리고 바로 반응하는 공간입니다.<br><br>
              유튜브 링크, 웃긴 그림, 짧은 퀴즈, 선택지 토론, 오늘의 한줄을 가볍게 모아보세요.
            </div>
          </div>
        </div>
      </div>

      <div class="guide-section" id="guide-rooms">
        <h2 class="guide-section__title">🧩 방 구성</h2>
        <p style="font-size:13px;color:var(--color-text-secondary);margin-bottom:20px">소소킹은 일반 게시판보다 방별 모음 구조를 중심으로 운영됩니다.</p>
        <div class="guide-features">
          ${ROOM_FEATURES.map(g => `
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
            { n:'3', icon:'📌', title:'방 선택', desc:'모음방, 토론방, 퀴즈방, 드립방 중 올릴 방을 고릅니다.' },
            { n:'4', icon:'💬', title:'짧게 참여', desc:'좋아요, 댓글, 투표, 퀴즈 정답, 한줄드립으로 가볍게 반응합니다.' },
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
              <div class="guide-layout-item"><span class="guide-layout-badge">사이드바</span>홈, 모음, 통계, 스크랩, 내 정보로 이동합니다.</div>
              <div class="guide-layout-item"><span class="guide-layout-badge">모음 올리기</span>모음방을 기본으로 바로 콘텐츠를 올릴 수 있습니다.</div>
              <div class="guide-layout-item"><span class="guide-layout-badge">중앙 콘텐츠</span>방별 모음, 상세 페이지, 내 정보가 중앙 영역에 표시됩니다.</div>
            </div>
          </div>
          <div class="guide-layout-card">
            <div class="guide-layout-card__head">📱 모바일</div>
            <div class="guide-layout-card__body">
              <div class="guide-layout-item"><span class="guide-layout-badge">하단 탭바</span>홈, 모음, 올리기, 통계, 내 정보로 빠르게 이동합니다.</div>
              <div class="guide-layout-item"><span class="guide-layout-badge">방별 탭</span>모음방, 토론방, 퀴즈방, 드립방을 탭으로 전환합니다.</div>
              <div class="guide-layout-item"><span class="guide-layout-badge">모바일 보기</span>짧은 콘텐츠를 빠르게 확인하고 반응할 수 있습니다.</div>
            </div>
          </div>
        </div>
      </div>

      <div class="guide-section" id="guide-play">
        <h2 class="guide-section__title">⚡ 참여 방법</h2>
        <div class="guide-features">
          ${[
            { icon:'📌', title:'모음 보기', desc:'유튜브, 웃긴그림, 링크를 보고 반응하거나 댓글을 남깁니다.' },
            { icon:'🗳️', title:'토론 참여', desc:'선택지를 누르고 댓글로 이유를 남깁니다.' },
            { icon:'🧠', title:'퀴즈 풀기', desc:'정답을 맞히고 해설을 확인합니다.' },
            { icon:'🤣', title:'한줄드립 보기', desc:'짧은 한 줄을 보고 반응하거나 댓글로 이어갑니다.' },
            { icon:'💬', title:'댓글과 답글', desc:'소소킹의 핵심은 짧은 반응입니다. 부담 없이 남기면 됩니다.' },
            { icon:'🚨', title:'신고', desc:'부적절한 글과 댓글은 신고할 수 있으며 관리자가 검토합니다.' },
          ].map(f => `
            <div class="guide-feature-card">
              <div class="guide-feature-card__icon">${f.icon}</div>
              <div class="guide-feature-card__title">${f.title}</div>
              <div class="guide-feature-card__desc">${f.desc}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="guide-section" id="guide-write">
        <h2 class="guide-section__title">✏️ 올리기</h2>
        <div class="guide-write-steps">
          ${[
            ['1', '올리기 선택', 'PC에서는 사이드바의 모음 올리기, 모바일에서는 하단 올리기 버튼을 누릅니다.'],
            ['2', '방 선택', '모음방, 토론방, 퀴즈방, 드립방 중 하나를 고릅니다.'],
            ['3', '짧게 입력', '모음방은 제목과 링크/이미지, 토론방은 제목·내용·선택지, 퀴즈방은 문제와 정답, 드립방은 오늘의 한줄만 입력합니다.'],
            ['4', '반응 받기', '올린 콘텐츠는 방별 모음에 노출되고 댓글, 반응, 투표, 정답 참여로 이어집니다.'],
          ].map(([n, title, desc]) => `
            <div class="guide-write-step">
              <div class="guide-write-step__num">${n}</div>
              <div class="guide-write-step__content">
                <div class="guide-write-step__title">${title}</div>
                <div class="guide-write-step__desc">${desc}</div>
              </div>
            </div>`).join('')}
        </div>
        <button class="btn btn--primary btn--full" id="guide-write-btn" style="margin-top:16px">올리기</button>
      </div>

      <div class="guide-section" id="guide-stats">
        <h2 class="guide-section__title">📊 통계</h2>
        <p style="font-size:14px;color:var(--color-text-secondary);line-height:1.7">반응과 댓글 참여가 많은 콘텐츠는 통계 화면에서 확인할 수 있습니다. 운영 상황에 따라 집계 기준은 조정될 수 있습니다.</p>
      </div>

      <div class="guide-section" id="guide-account">
        <h2 class="guide-section__title">👤 내 정보</h2>
        <p style="font-size:14px;color:var(--color-text-secondary);line-height:1.7">내가 올린 콘텐츠, 스크랩, 알림, 활동 통계, 설정을 확인할 수 있습니다.</p>
      </div>

      <div class="guide-section" id="guide-rules">
        <h2 class="guide-section__title">🚨 이용 규칙</h2>
        <div class="guide-rules">
          ${[
            '타인에게 불쾌감을 주는 콘텐츠는 제한될 수 있습니다.',
            '개인정보와 민감한 정보는 동의 없이 올리지 마세요.',
            '권리를 침해하는 이미지, 영상, 링크 공유는 삭제될 수 있습니다.',
            '서비스 운영을 방해하는 반복投稿와 광고성 콘텐츠는 제한될 수 있습니다.',
            '신고된 콘텐츠는 관리자가 검토 후 숨김 또는 삭제할 수 있습니다.',
          ].map(rule => `<div class="guide-rule-item">${rule}</div>`).join('')}
        </div>
      </div>
    </div>`;

  document.getElementById('guide-write-btn')?.addEventListener('click', () => navigate('/write?type=multi&preset=collect'));
}
