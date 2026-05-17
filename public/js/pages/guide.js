import { navigate } from '../router.js';

export function renderGuide() {
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div class="guide-page">

      <!-- 헤더 -->
      <div class="guide-hero">
        <div class="guide-hero__icon">📖</div>
        <h1 class="guide-hero__title">소소킹 이용안내</h1>
        <p class="guide-hero__sub">소소킹의 모든 기능을 한눈에 알아봐요</p>
      </div>

      <!-- 목차 -->
      <div class="guide-toc card">
        <div class="guide-toc__title">📌 목차</div>
        <div class="guide-toc__list">
          ${[
            ['#guide-what',    '소소킹이란?'],
            ['#guide-start',   '시작하기 (회원가입 · 로그인)'],
            ['#guide-layout',  '화면 구성'],
            ['#guide-cats',    '3가지 카테고리 · 9가지 게임'],
            ['#guide-play',    '참여하는 방법'],
            ['#guide-write',   '놀이판 만들기'],
            ['#guide-mission', '미션'],
            ['#guide-hall',    '명예의 전당'],
            ['#guide-title',   '칭호 시스템'],
            ['#guide-account', '내 정보 · 알림 · 스크랩'],
            ['#guide-rules',   '이용 규칙'],
          ].map(([href, label]) => `
            <a class="guide-toc__item" href="${href}">${label}</a>
          `).join('')}
        </div>
      </div>

      <!-- ① 소소킹이란 -->
      <div class="guide-section" id="guide-what">
        <h2 class="guide-section__title">🎮 소소킹이란?</h2>
        <div class="guide-intro-card">
          <div class="guide-intro-card__icon">🃏</div>
          <div>
            <div class="guide-intro-card__title">게임형 커뮤니티예요</div>
            <div class="guide-intro-card__desc">
              소소킹은 <strong>밸런스게임·삼행시·작명소·OX퀴즈</strong> 등
              9가지 미니게임을 주제로 누구나 놀이판을 열고 짧게 참여하는 커뮤니티예요.<br><br>
              긴 글을 쓰지 않아도 돼요. 버튼 하나 누르거나 한 줄 댓글로도 충분히 참여할 수 있어요.
              <strong>AI가 매일 새 게시글과 미션을 자동으로 올려줘서</strong> 항상 새로운 놀이판이 열려 있어요.
            </div>
          </div>
        </div>
      </div>

      <!-- ② 시작하기 -->
      <div class="guide-section" id="guide-start">
        <h2 class="guide-section__title">🔑 시작하기 (회원가입 · 로그인)</h2>
        <div class="guide-steps">
          ${[
            { n:'1', icon:'🔑', title:'로그인 페이지 이동', desc:'우측 상단(모바일) 또는 좌측 사이드바(PC)의 <strong>로그인 / 가입</strong> 버튼을 눌러요.' },
            { n:'2', icon:'📧', title:'가입 방법 선택', desc:'<strong>Google 계정</strong>으로 1초 로그인 또는 <strong>이메일 + 비밀번호</strong>로 가입할 수 있어요.' },
            { n:'3', icon:'😊', title:'닉네임 설정', desc:'처음 로그인하면 닉네임을 설정해요. 2~12자, 한글·영문·숫자·밑줄(_) 사용 가능.' },
            { n:'4', icon:'🎉', title:'완료!', desc:'홈으로 이동되면 바로 시작할 수 있어요. 비밀번호를 잊었다면 로그인 페이지에서 <strong>비밀번호 재설정</strong>을 눌러요.' },
          ].map(s => `
            <div class="guide-step">
              <div class="guide-step__num">${s.n}</div>
              <div class="guide-step__icon">${s.icon}</div>
              <div class="guide-step__title">${s.title}</div>
              <div class="guide-step__desc">${s.desc}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- ③ 화면 구성 -->
      <div class="guide-section" id="guide-layout">
        <h2 class="guide-section__title">🖥️ 화면 구성</h2>
        <div class="guide-layout-grid">

          <div class="guide-layout-card">
            <div class="guide-layout-card__head">💻 PC (넓은 화면)</div>
            <div class="guide-layout-card__body">
              <div class="guide-layout-item">
                <span class="guide-layout-badge">좌측 사이드바</span>
                로고, 전체 메뉴, 놀이판 만들기 버튼, 내 정보, 테마 전환, 앱 설치가 모여 있어요.
              </div>
              <div class="guide-layout-item">
                <span class="guide-layout-badge">중앙 콘텐츠</span>
                최대 680px 폭의 단일 컬럼으로 게시글 목록·상세가 보여요.
              </div>
            </div>
          </div>

          <div class="guide-layout-card">
            <div class="guide-layout-card__head">📱 모바일 (좁은 화면)</div>
            <div class="guide-layout-card__body">
              <div class="guide-layout-item">
                <span class="guide-layout-badge">상단 헤더</span>
                소소킹 로고, 테마 전환, 알림, 내 정보 버튼이 있어요.
              </div>
              <div class="guide-layout-item">
                <span class="guide-layout-badge">하단 탭바 5개</span>
                홈 · 탐색 · ✚(글쓰기) · 미션 · 내정보 탭으로 빠르게 이동해요.
              </div>
            </div>
          </div>

        </div>

        <div class="guide-nav-list">
          ${[
            { icon:'🏠', label:'홈',          desc:'인기글·최신글·카테고리 카드·오늘의 왕좌를 한눈에 볼 수 있어요.' },
            { icon:'🔍', label:'탐색(피드)',  desc:'전체 게시글을 카테고리·유형·검색어로 필터링해서 볼 수 있어요.' },
            { icon:'✏️', label:'놀이판 만들기',desc:'9가지 유형 중 하나를 골라 새 놀이판을 올려요.' },
            { icon:'🎯', label:'미션',         desc:'오늘의 AI 미션과 이번 주 삼행시 챌린지 제시어를 확인해요.' },
            { icon:'🏆', label:'명예의 전당', desc:'작명왕·삼행시왕·드립왕·댓글왕·대결왕 TOP 3를 볼 수 있어요.' },
            { icon:'👤', label:'내 정보',      desc:'내 글·스크랩·알림·닉네임 변경·팔로우 관리를 할 수 있어요.' },
          ].map(n => `
            <div class="guide-nav-item">
              <span class="guide-nav-icon">${n.icon}</span>
              <div>
                <div class="guide-nav-label">${n.label}</div>
                <div class="guide-nav-desc">${n.desc}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <!-- ④ 카테고리 · 게임 유형 -->
      <div class="guide-section" id="guide-cats">
        <h2 class="guide-section__title">🗂️ 3가지 카테고리 · 9가지 게임</h2>
        <p style="font-size:13px;color:var(--color-text-secondary);margin-bottom:20px">
          모든 게시글은 아래 3개 카테고리 중 하나에 속하고, 각 카테고리 안에 3가지 게임 유형이 있어요.
        </p>

        <div class="guide-cats">

          <!-- 골라봐 -->
          <div class="guide-cat guide-cat--golra">
            <div class="guide-cat__head">
              <span class="guide-cat__icon">🎯</span>
              <div>
                <div class="guide-cat__name">골라봐 — 선택형</div>
                <div class="guide-cat__sub">버튼 하나면 참여 완료 — 선택하고 결과를 바로 확인해요</div>
              </div>
            </div>
            <div class="guide-cat__types">
              <div class="guide-type-item">
                <span class="guide-type-badge guide-type-badge--golra">⚖️ 밸런스게임</span>
                <span class="guide-type-desc">딱 2개 선택지 중 하나만 골라요. 짜장 vs 짬뽕, 여름 vs 겨울처럼 양자택일. 선택 후 전체 비율이 공개돼요.</span>
              </div>
              <div class="guide-type-item">
                <span class="guide-type-badge guide-type-badge--golra">🗳️ 민심투표</span>
                <span class="guide-type-desc">3개 이상 선택지 중 하나를 투표해요. 다수결로 민심을 확인하는 투표판이에요.</span>
              </div>
              <div class="guide-type-item">
                <span class="guide-type-badge guide-type-badge--golra">⚔️ 선택지배틀</span>
                <span class="guide-type-desc">여러 후보 중 최강자를 가려내는 배틀. 선택 후 댓글로 이유를 남기면 더 재밌어요.</span>
              </div>
            </div>
          </div>

          <!-- 웃겨봐 -->
          <div class="guide-cat guide-cat--usgyo">
            <div class="guide-cat__head">
              <span class="guide-cat__icon">😂</span>
              <div>
                <div class="guide-cat__name">웃겨봐 — 드립형</div>
                <div class="guide-cat__sub">센스와 유머로 겨루는 글·댓글 대결</div>
              </div>
            </div>
            <div class="guide-cat__types">
              <div class="guide-type-item">
                <span class="guide-type-badge guide-type-badge--usgyo">😜 미친작명소</span>
                <span class="guide-type-desc">올라온 사진이나 상황에 가장 웃긴 이름을 댓글로 달아요. 좋아요를 많이 받은 작명이 명예의 전당에 올라가요.</span>
              </div>
              <div class="guide-type-item">
                <span class="guide-type-badge guide-type-badge--usgyo">✍️ 삼행시짓기</span>
                <span class="guide-type-desc">제시어(3~6글자)의 각 글자로 시작하는 문장을 짓는 삼행시 게임이에요. 댓글 형식으로 참여하고 리액션을 많이 받을수록 TOP에 올라가요.</span>
              </div>
              <div class="guide-type-item">
                <span class="guide-type-badge guide-type-badge--usgyo">🎤 한줄드립</span>
                <span class="guide-type-desc">주어진 상황에 가장 어울리는 한 줄 드립을 댓글로 달아요. 😂🔥👍 리액션으로 순위가 결정돼요.</span>
              </div>
            </div>
          </div>

          <!-- 도전봐 -->
          <div class="guide-cat guide-cat--malhe">
            <div class="guide-cat__head">
              <span class="guide-cat__icon">🎮</span>
              <div>
                <div class="guide-cat__name">도전봐 — 도전형</div>
                <div class="guide-cat__sub">퀴즈·릴레이·대결 — 두뇌와 창의력 대결</div>
              </div>
            </div>
            <div class="guide-cat__types">
              <div class="guide-type-item">
                <span class="guide-type-badge guide-type-badge--malhe">❓ OX퀴즈</span>
                <span class="guide-type-desc">O 또는 X를 선택하면 정답과 해설이 공개돼요. 상식·과학·생활 퀴즈가 자주 올라와요.</span>
              </div>
              <div class="guide-type-item">
                <span class="guide-type-badge guide-type-badge--malhe">🎭 막장릴레이</span>
                <span class="guide-type-desc">첫 문장이 주어지고 댓글로 이야기를 이어가요. 어디로 튈지 모르는 막장 전개가 묘미예요.</span>
              </div>
              <div class="guide-type-item">
                <span class="guide-type-badge guide-type-badge--malhe">🎰 랜덤대결</span>
                <span class="guide-type-desc">같은 주제로 각자 답을 달아요. 리액션을 많이 받은 사람이 승리하는 자유 대결이에요.</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- ⑤ 참여하는 방법 -->
      <div class="guide-section" id="guide-play">
        <h2 class="guide-section__title">⚡ 참여하는 방법</h2>
        <div class="guide-features">
          ${[
            { icon:'🖱️', title:'투표·선택',   desc:'골라봐 게시글에서 선택지를 누르면 즉시 참여 완료. 결과 비율이 바로 보여요. 한 번 투표하면 취소는 안 돼요.' },
            { icon:'💬', title:'댓글 달기',    desc:'모든 게시글에 댓글을 달 수 있어요. 삼행시·작명소·드립·릴레이는 댓글이 곧 참여예요.' },
            { icon:'😂', title:'댓글 리액션',  desc:'댓글에 😂 웃겨요 · 🔥 불타요 · 👍 좋아요 리액션을 달 수 있어요. 리액션 수로 명예의 전당 순위가 결정돼요.' },
            { icon:'❤️', title:'게시글 반응',  desc:'상세 페이지에서 게시글 자체에도 리액션을 달 수 있어요. 반응 수가 많을수록 홈 인기글에 올라가요.' },
            { icon:'🔖', title:'스크랩',        desc:'상세 페이지 우측 상단 🔖 버튼으로 스크랩. 내 정보 → 스크랩 탭에서 모아 볼 수 있어요.' },
            { icon:'🔗', title:'공유',          desc:'🔗 버튼으로 링크를 복사하거나 공유하기로 SNS·카카오톡에 바로 보낼 수 있어요.' },
            { icon:'🚨', title:'신고',          desc:'부적절한 게시글은 🚨 버튼으로 신고해 주세요. 관리자가 검토 후 처리해요.' },
          ].map(f => `
            <div class="guide-feature-card">
              <div class="guide-feature-card__icon">${f.icon}</div>
              <div class="guide-feature-card__title">${f.title}</div>
              <div class="guide-feature-card__desc">${f.desc}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- ⑥ 놀이판 만들기 -->
      <div class="guide-section" id="guide-write">
        <h2 class="guide-section__title">✏️ 놀이판 만들기</h2>
        <div class="guide-write-steps">
          <div class="guide-write-step">
            <div class="guide-write-step__num">1</div>
            <div class="guide-write-step__content">
              <div class="guide-write-step__title">게임 유형 선택</div>
              <div class="guide-write-step__desc">9가지 유형 중 원하는 것을 골라요. 카테고리(골라봐·웃겨봐·도전봐) → 세부 유형 순으로 선택해요.</div>
            </div>
          </div>
          <div class="guide-write-step">
            <div class="guide-write-step__num">2</div>
            <div class="guide-write-step__content">
              <div class="guide-write-step__title">내용 작성</div>
              <div class="guide-write-step__desc">
                유형에 따라 입력할 항목이 달라요:<br>
                • <strong>밸런스·투표·배틀</strong> — 제목 + 선택지 2~4개<br>
                • <strong>작명소</strong> — 제목 + 사진 1장 이상 필수<br>
                • <strong>삼행시</strong> — 제시어(3~6글자) 입력 → 미리보기 자동 생성<br>
                • <strong>드립·릴레이·랜덤대결</strong> — 제목 + 상황 설명<br>
                • <strong>OX퀴즈</strong> — 문제 + 정답(O/X) + 해설
              </div>
            </div>
          </div>
          <div class="guide-write-step">
            <div class="guide-write-step__num">3</div>
            <div class="guide-write-step__content">
              <div class="guide-write-step__title">태그 추가 (선택)</div>
              <div class="guide-write-step__desc">쉼표(,)로 구분해서 태그를 추가하면 관련 게시글과 묶여서 노출돼요.</div>
            </div>
          </div>
          <div class="guide-write-step">
            <div class="guide-write-step__num">4</div>
            <div class="guide-write-step__content">
              <div class="guide-write-step__title">올리기</div>
              <div class="guide-write-step__desc">올리기 버튼을 누르면 피드에 바로 게시돼요. 내 글은 내 정보 → 내 글 탭에서 확인·삭제할 수 있어요.</div>
            </div>
          </div>
        </div>
        <div class="guide-tip">
          💡 <strong>임시저장</strong> — 글 작성 중 나갔다 와도 유형별로 자동 임시저장돼요. 같은 유형으로 다시 들어오면 이어쓸 수 있어요.
        </div>
      </div>

      <!-- ⑦ 미션 -->
      <div class="guide-section" id="guide-mission">
        <h2 class="guide-section__title">🎯 미션</h2>
        <div class="guide-features">
          <div class="guide-feature-card">
            <div class="guide-feature-card__icon">🤖</div>
            <div class="guide-feature-card__title">AI 자동 미션</div>
            <div class="guide-feature-card__desc">
              매일 오전 8시 5분에 AI가 오늘의 미션을 자동으로 생성해요.
              미션 페이지에서 확인하고 <strong>참여하기</strong> 버튼을 누르면 해당 유형의 글쓰기로 바로 이동해요.
            </div>
          </div>
          <div class="guide-feature-card">
            <div class="guide-feature-card__icon">✍️</div>
            <div class="guide-feature-card__title">이번 주 삼행시 챌린지</div>
            <div class="guide-feature-card__desc">
              매주 바뀌는 제시어로 삼행시 챌린지가 열려요. 미션 페이지 상단에서 이번 주 제시어를 확인하고 삼행시를 지어보세요.
            </div>
          </div>
        </div>
      </div>

      <!-- ⑧ 명예의 전당 -->
      <div class="guide-section" id="guide-hall">
        <h2 class="guide-section__title">🏆 명예의 전당</h2>
        <p style="font-size:13px;color:var(--color-text-secondary);margin-bottom:16px">
          분야별로 리액션·댓글을 가장 많이 받은 게시글 TOP 3가 올라와요. 매 조회 시 최신 순위가 반영돼요.
        </p>
        <div class="guide-features">
          ${[
            { icon:'✏️', title:'작명왕',  desc:'미친작명소 유형에서 리액션을 가장 많이 받은 게시글' },
            { icon:'📝', title:'삼행시왕', desc:'삼행시짓기 유형에서 리액션을 가장 많이 받은 게시글' },
            { icon:'💬', title:'댓글왕',  desc:'댓글 수가 가장 많은 게시글 (유형 무관)' },
            { icon:'🎤', title:'드립왕',  desc:'한줄드립 유형에서 리액션을 가장 많이 받은 게시글' },
            { icon:'🎰', title:'대결왕',  desc:'랜덤대결 유형에서 리액션을 가장 많이 받은 게시글' },
          ].map(f => `
            <div class="guide-feature-card">
              <div class="guide-feature-card__icon">${f.icon}</div>
              <div class="guide-feature-card__title">${f.title}</div>
              <div class="guide-feature-card__desc">${f.desc}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- ⑨ 칭호 시스템 -->
      <div class="guide-section" id="guide-title">
        <h2 class="guide-section__title">🏅 칭호 시스템</h2>
        <p style="font-size:13px;color:var(--color-text-secondary);margin-bottom:16px">
          내가 올린 게시글 수에 따라 칭호가 자동으로 부여돼요. 내 정보 페이지에서 확인할 수 있어요.
        </p>
        <div class="guide-title-list">
          ${[
            { badge:'🥚 뉴비',    cond:'가입 직후 (글 0개)',   color:'var(--color-text-muted)' },
            { badge:'🌱 새싹',    cond:'글 1개 이상',           color:'#4ade80' },
            { badge:'😊 소소인',  cond:'글 3개 이상',           color:'var(--color-primary)' },
            { badge:'🔥 놀이꾼',  cond:'글 10개 이상',          color:'#fb923c' },
            { badge:'⭐ 소소러',  cond:'글 20개 이상',          color:'#facc15' },
            { badge:'👑 소소킹',  cond:'글 30개 이상',          color:'#c084fc' },
          ].map(t => `
            <div class="guide-title-item">
              <span class="guide-title-badge" style="color:${t.color}">${t.badge}</span>
              <span class="guide-title-cond">${t.cond}</span>
            </div>`).join('')}
        </div>
        <div class="guide-tip" style="margin-top:16px">
          🔥 <strong>출석 스트릭</strong> — 매일 소소킹에 방문하면 연속 출석 일수가 쌓여요. 7일 연속 방문 시 주간 챌린저 뱃지가 붙어요. 내 정보 페이지에서 현재 스트릭을 확인할 수 있어요.
        </div>
      </div>

      <!-- ⑩ 내 정보 -->
      <div class="guide-section" id="guide-account">
        <h2 class="guide-section__title">👤 내 정보 · 알림 · 스크랩</h2>
        <div class="guide-features">
          ${[
            { icon:'📝', title:'내 글',      desc:'내가 올린 모든 게시글 목록이에요. 클릭하면 상세 페이지로 이동하고 삭제도 여기서 할 수 있어요.' },
            { icon:'🔖', title:'스크랩',     desc:'상세 페이지에서 🔖 버튼으로 저장한 게시글 모음이에요.' },
            { icon:'🔔', title:'알림',       desc:'내 게시글에 댓글·리액션이 달리면 알림이 와요. 읽은 알림은 자동으로 처리돼요.' },
            { icon:'📊', title:'내 통계',    desc:'총 게시글 수, 받은 리액션 총합, 최고 인기 글을 확인할 수 있어요.' },
            { icon:'👥', title:'팔로우',     desc:'다른 유저를 팔로우하면 그 사람의 글을 피드에서 우선 볼 수 있어요.' },
            { icon:'⚙️', title:'닉네임 변경', desc:'설정 탭에서 닉네임을 변경할 수 있어요. 2~12자, 중복 불가.' },
          ].map(f => `
            <div class="guide-feature-card">
              <div class="guide-feature-card__icon">${f.icon}</div>
              <div class="guide-feature-card__title">${f.title}</div>
              <div class="guide-feature-card__desc">${f.desc}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- ⑪ 이용 규칙 -->
      <div class="guide-section" id="guide-rules">
        <h2 class="guide-section__title">📋 이용 규칙</h2>
        <div class="guide-rules">
          ${[
            { emoji:'✅', text:'재미있고 창의적인 참여를 환영해요!' },
            { emoji:'✅', text:'다른 사람 게시물에 댓글·리액션으로 적극 참여해요.' },
            { emoji:'✅', text:'불쾌한 콘텐츠는 🚨 신고 버튼으로 알려주세요.' },
            { emoji:'❌', text:'타인 비방, 욕설, 혐오 표현은 즉시 제재 대상이에요.' },
            { emoji:'❌', text:'개인정보(실명·연락처·주소)는 올리지 마세요.' },
            { emoji:'❌', text:'광고·스팸·도배 글은 경고 없이 삭제될 수 있어요.' },
            { emoji:'❌', text:'저작권 없는 이미지·영상 무단 게시는 제한됩니다.' },
          ].map(r => `
            <div class="guide-rule-item">
              <span class="guide-rule-emoji">${r.emoji}</span>
              <span>${r.text}</span>
            </div>`).join('')}
        </div>
        <div style="margin-top:20px;display:flex;gap:8px;flex-wrap:wrap">
          <a href="#/terms" class="btn btn--ghost btn--sm">이용약관 전문</a>
          <a href="#/privacy" class="btn btn--ghost btn--sm">개인정보처리방침</a>
        </div>
      </div>

      <!-- 하단 CTA -->
      <div class="guide-cta-bottom">
        <div class="guide-cta-bottom__title">이제 시작해볼까요? 🎉</div>
        <div class="guide-cta-bottom__desc">놀이판을 열거나 지금 인기 게시글을 구경해보세요!</div>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:20px">
          <button class="btn btn--primary" onclick="navigate('/write')">✏️ 놀이판 만들기</button>
          <button class="btn btn--ghost" onclick="navigate('/feed')">🔍 게시글 탐색하기</button>
        </div>
      </div>

    </div>`;
}
