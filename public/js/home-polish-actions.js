const STYLE_ID = 'home-polish-style';
let patchedHero = false;
let patchedCats = false;

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .home-hero.ssk-hero-polished {
      min-height: 292px;
      padding: clamp(26px, 5vw, 52px);
      border-radius: 30px;
      background:
        radial-gradient(circle at 14% 18%, rgba(255,255,255,.35), transparent 28%),
        radial-gradient(circle at 86% 20%, rgba(255,220,110,.35), transparent 30%),
        linear-gradient(135deg, #ff5a2f 0%, #ff7a45 42%, #ffb03a 100%);
      box-shadow: 0 22px 58px rgba(255, 92, 47, .22), inset 0 1px 0 rgba(255,255,255,.28);
    }
    .home-hero.ssk-hero-polished::after {
      content: '🎲';
      right: clamp(24px, 7vw, 86px);
      top: 43%;
      font-size: clamp(88px, 14vw, 150px);
      opacity: .16;
      transform: translateY(-50%) rotate(-10deg);
    }
    .ssk-hero-topline {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .ssk-hero-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 13px;
      border-radius: 999px;
      background: rgba(255,255,255,.20);
      border: 1px solid rgba(255,255,255,.34);
      color: #fff;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: -.1px;
      backdrop-filter: blur(10px);
    }
    .home-hero.ssk-hero-polished .home-hero__title {
      font-size: clamp(32px, 4.4vw, 54px);
      line-height: 1.02;
      letter-spacing: -1.8px;
      max-width: 720px;
    }
    .home-hero.ssk-hero-polished .home-hero__sub {
      max-width: 640px;
      margin-top: 16px;
      font-size: clamp(14px, 1.8vw, 18px);
      line-height: 1.62;
      color: rgba(255,255,255,.92);
      word-break: keep-all;
    }
    .ssk-hero-highlight {
      display: inline;
      color: #fff9c8;
      font-weight: 950;
    }
    .ssk-hero-chips {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 18px;
    }
    .ssk-hero-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,.18);
      border: 1px solid rgba(255,255,255,.28);
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      backdrop-filter: blur(8px);
    }
    .home-hero.ssk-hero-polished .home-hero__action { margin-top: 22px; }
    .home-hero.ssk-hero-polished .btn-hero-primary,
    .home-hero.ssk-hero-polished .btn-hero-secondary {
      min-height: 48px;
      border-radius: 999px;
    }
    .ssk-hero-visual {
      position: absolute;
      right: clamp(24px, 6vw, 70px);
      bottom: 28px;
      z-index: 1;
      display: grid;
      grid-template-columns: repeat(2, minmax(96px, 1fr));
      gap: 10px;
      width: min(320px, 32vw);
      pointer-events: none;
    }
    .ssk-hero-mini-card {
      padding: 12px 13px;
      border-radius: 18px;
      background: rgba(255,255,255,.18);
      border: 1px solid rgba(255,255,255,.28);
      backdrop-filter: blur(12px);
      color: #fff;
      box-shadow: 0 10px 24px rgba(0,0,0,.10);
    }
    .ssk-hero-mini-card b {
      display: block;
      font-size: 13px;
      font-weight: 950;
      margin-bottom: 3px;
    }
    .ssk-hero-mini-card span {
      display: block;
      font-size: 11px;
      opacity: .82;
      line-height: 1.35;
    }
    .home-cats.ssk-cats-polished {
      gap: 18px;
      margin-top: -6px;
    }
    .ssk-section-kicker {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
      margin: 0 0 12px;
    }
    .ssk-section-kicker__title {
      font-size: 18px;
      font-weight: 950;
      letter-spacing: -.5px;
      color: var(--color-text-primary);
    }
    .ssk-section-kicker__sub {
      font-size: 12px;
      color: var(--color-text-muted);
      font-weight: 700;
    }
    .home-cat-card.ssk-cat-polished {
      min-height: 232px;
      padding: 22px;
      border-radius: 26px;
      border-width: 1.5px;
      box-shadow: 0 14px 34px rgba(20,20,43,.07);
      isolation: isolate;
    }
    .home-cat-card.ssk-cat-polished::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      background: linear-gradient(145deg, rgba(255,255,255,.85), rgba(255,255,255,.35));
      opacity: .72;
    }
    .home-cat-card.ssk-cat-polished:hover {
      transform: translateY(-6px);
      box-shadow: 0 22px 46px rgba(20,20,43,.11);
    }
    .ssk-cat-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 14px;
    }
    .home-cat-card.ssk-cat-polished .home-cat-card__badge {
      margin: 0;
      padding: 5px 10px;
      font-size: 10px;
      letter-spacing: .8px;
    }
    .ssk-cat-icon-wrap {
      width: 48px;
      height: 48px;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,.68);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.6), 0 8px 18px rgba(20,20,43,.06);
    }
    .home-cat-card.ssk-cat-polished .home-cat-card__icon {
      margin: 0;
      font-size: 29px;
    }
    .home-cat-card.ssk-cat-polished .home-cat-card__name {
      font-size: clamp(22px, 2.3vw, 28px);
      line-height: 1.08;
      letter-spacing: -1px;
    }
    .ssk-cat-hook {
      margin-top: 6px;
      font-size: 13px;
      font-weight: 850;
      color: var(--color-text-primary);
      letter-spacing: -.2px;
      word-break: keep-all;
    }
    .home-cat-card.ssk-cat-polished .home-cat-card__desc {
      margin-top: 9px;
      min-height: 42px;
      font-size: 13px;
      line-height: 1.55;
      color: var(--color-text-secondary);
      word-break: keep-all;
    }
    .home-cat-card.ssk-cat-polished .home-cat-card__types {
      gap: 6px;
      margin-top: 15px;
    }
    .home-cat-card.ssk-cat-polished .home-cat-card__type-pill {
      padding: 5px 9px;
      font-size: 11px;
      font-weight: 800;
      background: rgba(255,255,255,.72);
      border-color: rgba(255,255,255,.64);
      box-shadow: 0 3px 10px rgba(20,20,43,.04);
    }
    .ssk-cat-cta {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 16px;
      font-size: 12px;
      font-weight: 950;
      color: var(--color-text-primary);
      opacity: .78;
    }
    .home-cat-card--golra .ssk-cat-cta { color: var(--color-golra-dark); }
    .home-cat-card--usgyo .ssk-cat-cta { color: var(--color-usgyo-dark); }
    .home-cat-card--malhe .ssk-cat-cta { color: var(--color-malhe-dark); }

    [data-theme="dark"] .home-cat-card.ssk-cat-polished::before { background: linear-gradient(145deg, rgba(255,255,255,.07), rgba(255,255,255,.02)); }
    [data-theme="dark"] .ssk-cat-icon-wrap,
    [data-theme="dark"] .home-cat-card.ssk-cat-polished .home-cat-card__type-pill { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.08); }

    @media (min-width: 1024px) {
      .home-hero.ssk-hero-polished .home-hero__content { max-width: 720px; }
      .home-hero.ssk-hero-polished .home-hero__stats { margin-top: 28px; }
      .home-hero.ssk-hero-polished { padding-right: min(390px, 38vw); }
    }
    @media (max-width: 900px) {
      .ssk-hero-visual { display: none; }
      .home-hero.ssk-hero-polished { padding-right: clamp(24px, 5vw, 44px); }
      .home-cats.ssk-cats-polished { grid-template-columns: 1fr; gap: 12px; }
      .home-cat-card.ssk-cat-polished { min-height: 0; padding: 18px; }
      .home-cat-card.ssk-cat-polished .home-cat-card__desc { min-height: 0; }
    }
    @media (max-width: 640px) {
      .home-hero.ssk-hero-polished {
        min-height: 0;
        border-radius: 24px;
        padding: 24px 18px 20px;
        margin-bottom: 10px;
      }
      .home-hero.ssk-hero-polished::after {
        right: 16px;
        top: 22px;
        transform: none;
        font-size: 62px;
        opacity: .14;
      }
      .ssk-hero-topline { margin-bottom: 12px; }
      .ssk-hero-pill { padding: 6px 10px; font-size: 11px; }
      .home-hero.ssk-hero-polished .home-hero__title {
        font-size: 30px;
        line-height: 1.08;
        letter-spacing: -1.2px;
        max-width: 280px;
      }
      .home-hero.ssk-hero-polished .home-hero__sub {
        font-size: 13px;
        line-height: 1.55;
        margin-top: 12px;
        max-width: 310px;
      }
      .ssk-hero-chips {
        gap: 6px;
        margin-top: 14px;
      }
      .ssk-hero-chip {
        padding: 6px 9px;
        font-size: 11px;
      }
      .home-hero.ssk-hero-polished .home-hero__action {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 16px;
      }
      .home-hero.ssk-hero-polished .btn-hero-primary,
      .home-hero.ssk-hero-polished .btn-hero-secondary {
        width: 100%;
        min-height: 44px;
        justify-content: center;
        padding: 10px 12px;
        font-size: 13px;
      }
      .home-hero.ssk-hero-polished .home-hero__stats {
        width: 100%;
        margin-top: 16px;
        padding: 10px 8px;
        border-radius: 18px;
      }
      .home-hero.ssk-hero-polished .home-hero__stat { flex: 1; padding: 0 5px; }
      .home-hero.ssk-hero-polished .home-hero__stat-num { font-size: 17px; }
      .home-hero.ssk-hero-polished .home-hero__stat-label { font-size: 9px; letter-spacing: 0; }
      .ssk-section-kicker { align-items: flex-start; flex-direction: column; gap: 2px; margin-top: 2px; }
      .ssk-section-kicker__title { font-size: 16px; }
      .ssk-section-kicker__sub { font-size: 11px; }
      .home-cat-card.ssk-cat-polished {
        border-radius: 22px;
        padding: 16px;
      }
      .ssk-cat-head { margin-bottom: 10px; }
      .ssk-cat-icon-wrap { width: 42px; height: 42px; border-radius: 15px; }
      .home-cat-card.ssk-cat-polished .home-cat-card__icon { font-size: 25px; }
      .home-cat-card.ssk-cat-polished .home-cat-card__name { font-size: 23px; }
      .ssk-cat-hook { font-size: 12px; }
      .home-cat-card.ssk-cat-polished .home-cat-card__desc { font-size: 12px; line-height: 1.5; margin-top: 7px; }
      .home-cat-card.ssk-cat-polished .home-cat-card__types { margin-top: 11px; }
      .home-cat-card.ssk-cat-polished .home-cat-card__type-pill { font-size: 10px; padding: 4px 8px; }
      .ssk-cat-cta { margin-top: 12px; font-size: 11px; }
    }
  `;
  document.head.appendChild(style);
}

function patchHero() {
  const hero = document.querySelector('.home-hero');
  if (!hero || hero.dataset.sskPolished === '1') return;
  hero.dataset.sskPolished = '1';
  patchedHero = true;
  hero.classList.add('ssk-hero-polished');

  const eyebrow = hero.querySelector('.home-hero__eyebrow');
  if (eyebrow) {
    eyebrow.outerHTML = `
      <div class="ssk-hero-topline">
        <span class="ssk-hero-pill">🔥 오늘도 열리는 소소한 놀이판</span>
        <span class="ssk-hero-pill">🤖 AI 미션 운영중</span>
      </div>`;
  }

  const title = hero.querySelector('.home-hero__title');
  if (title) title.innerHTML = `고르거나 웃기거나<br><span class="ssk-hero-highlight">한마디만 던져도</span> 시작!`;

  const sub = hero.querySelector('.home-hero__sub');
  if (sub) {
    sub.innerHTML = `밸런스게임, 퀴즈, 삼행시, 작명, 고민까지.<br>짧게 참여하고 댓글로 같이 노는 <b>소소킹 놀이 커뮤니티</b>`;
    sub.insertAdjacentHTML('afterend', `
      <div class="ssk-hero-chips" aria-label="소소킹 대표 놀이">
        <span class="ssk-hero-chip">🎯 골라봐</span>
        <span class="ssk-hero-chip">😂 웃겨봐</span>
        <span class="ssk-hero-chip">💬 말해봐</span>
        <span class="ssk-hero-chip">⚡ 바로 참여</span>
      </div>`);
  }

  const primary = hero.querySelector('.btn-hero-primary');
  if (primary) primary.textContent = '✏️ 놀이판 만들기';
  const secondary = hero.querySelector('.btn-hero-secondary');
  if (secondary) secondary.textContent = '🎲 아무거나 한 판';

  if (!hero.querySelector('.ssk-hero-visual')) {
    hero.insertAdjacentHTML('beforeend', `
      <div class="ssk-hero-visual" aria-hidden="true">
        <div class="ssk-hero-mini-card"><b>⚖️ 오늘의 선택</b><span>둘 중 하나만 고르면 끝</span></div>
        <div class="ssk-hero-mini-card"><b>😂 한 줄 드립</b><span>짧게 웃기면 인기글</span></div>
        <div class="ssk-hero-mini-card"><b>🎯 AI 미션</b><span>매일 새로운 참여 주제</span></div>
        <div class="ssk-hero-mini-card"><b>💬 고민/노하우</b><span>가볍게 묻고 답하기</span></div>
      </div>`);
  }
}

function patchCategories() {
  const cats = document.querySelector('.home-cats');
  if (!cats || cats.dataset.sskPolished === '1') return;
  cats.dataset.sskPolished = '1';
  patchedCats = true;
  cats.classList.add('ssk-cats-polished');

  if (!document.querySelector('.ssk-section-kicker')) {
    cats.insertAdjacentHTML('beforebegin', `
      <div class="ssk-section-kicker">
        <div class="ssk-section-kicker__title">오늘 뭐 하고 놀까요?</div>
        <div class="ssk-section-kicker__sub">세 가지 놀이판 중 하나만 골라 바로 시작</div>
      </div>`);
  }

  const copy = {
    golra: {
      badge: 'CHOOSE',
      name: '골라봐',
      hook: '선택은 빠르게, 이유는 댓글로',
      desc: '밸런스게임·투표·OX퀴즈처럼 누르자마자 참여하는 놀이판이에요.',
      types: ['밸런스', '민심투표', 'OX퀴즈', '4지선다'],
      cta: '선택하러 가기',
    },
    usgyo: {
      badge: 'FUNNY',
      name: '웃겨봐',
      hook: '드립 한 줄이면 분위기 반전',
      desc: '미친작명소, 삼행시, 댓글배틀로 센스와 웃음을 겨뤄요.',
      types: ['작명소', '삼행시', '한줄드립', '댓글배틀'],
      cta: '웃기러 가기',
    },
    malhe: {
      badge: 'TALK',
      name: '말해봐',
      hook: '소소한 경험도 콘텐츠가 돼요',
      desc: '고민, 실패담, 노하우, 릴레이 이야기까지 편하게 나누는 공간이에요.',
      types: ['고민/질문', '경험담', '노하우', '릴레이'],
      cta: '이야기하러 가기',
    },
  };

  cats.querySelectorAll('.home-cat-card').forEach(card => {
    const key = ['golra', 'usgyo', 'malhe'].find(k => card.classList.contains(`home-cat-card--${k}`));
    const data = copy[key];
    if (!data || card.dataset.sskCatPolished === '1') return;
    card.dataset.sskCatPolished = '1';
    card.classList.add('ssk-cat-polished');

    const emoji = card.dataset.emoji || card.querySelector('.home-cat-card__icon')?.textContent || '';
    card.innerHTML = `
      <div class="ssk-cat-head">
        <div class="home-cat-card__badge">${data.badge}</div>
        <div class="ssk-cat-icon-wrap"><div class="home-cat-card__icon">${emoji}</div></div>
      </div>
      <div class="home-cat-card__name">${data.name}</div>
      <div class="ssk-cat-hook">${data.hook}</div>
      <div class="home-cat-card__desc">${data.desc}</div>
      <div class="home-cat-card__types">
        ${data.types.map(t => `<span class="home-cat-card__type-pill">${t}</span>`).join('')}
      </div>
      <div class="ssk-cat-cta">${data.cta} <span>→</span></div>`;
  });
}

function polishHome() {
  injectStyle();
  patchHero();
  patchCategories();
}

let timer = null;
const observer = new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(polishHome, 80);
});

observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('hashchange', () => {
  patchedHero = false;
  patchedCats = false;
  setTimeout(polishHome, 120);
});
setTimeout(polishHome, 250);
