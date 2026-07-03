// four-game-polish.js
// 4가지 게임형 커뮤니티 전환 후 남는 UI 문구와 글쓰기 전환 상태를 보정합니다.

const GAME_COPY = {
  judgment: {
    title: '사건 제목',
    body: '사건 설명',
    bodyRequired: false,
    titlePlaceholder: '사건 제목을 입력하세요. 예: 이거 제가 예민한 건가요?',
    bodyPlaceholder: '상황을 편하게 적어주세요. 캐릭터들이 판결에 끼어듭니다.',
    tagsPlaceholder: '#판결, #소소재판, #이거누구잘못',
  },
  consult: {
    title: '고민 제목',
    body: '고민 설명',
    bodyRequired: true,
    titlePlaceholder: '고민 제목을 입력하세요. 예: 장바구니가 저를 부릅니다',
    bodyPlaceholder: '고민을 편하게 적어주세요. 웃기게 받아도 선은 지켜드립니다.',
    tagsPlaceholder: '#상담, #고민, #선택장애',
  },
  vote: {
    title: '토론 주제',
    body: '토론 설명',
    bodyRequired: false,
    titlePlaceholder: '토론 주제를 입력하세요. 예: 먼저 연락한다 vs 그냥 둔다',
    bodyPlaceholder: '토론할 상황이나 기준을 입력하세요.',
    tagsPlaceholder: '#토론, #찬반, #소소판정',
  },
  drip: {
    title: '드립 주제',
    body: '드립 설명',
    bodyRequired: false,
    titlePlaceholder: '드립 주제를 입력하세요. 예: 월요일 알람에게 이름을 붙인다면?',
    bodyPlaceholder: '주제 설명이 필요하면 짧게 적어주세요. 비워도 됩니다.',
    tagsPlaceholder: '#드립, #한줄드립, #드립배틀',
  },
};

let polishQueued = false;

function selectedPreset() {
  const selected = document.getElementById('mw-selected-preset')?.value || '';
  return GAME_COPY[selected] ? selected : 'judgment';
}

function requiredHtml(required) {
  return required ? '<span class="required">*</span>' : '';
}

function setHtmlIfChanged(el, html) {
  if (el && el.innerHTML !== html) el.innerHTML = html;
}

function setTextIfChanged(el, text) {
  if (el && el.textContent !== text) el.textContent = text;
}

function setAttrIfChanged(el, name, value) {
  if (el && el.getAttribute(name) !== value) el.setAttribute(name, value);
}

function setStyleIfChanged(el, name, value) {
  if (el && el.style[name] !== value) el.style[name] = value;
}

function polishWriter() {
  const page = document.querySelector('.multi-write-page');
  if (!page) return;
  const key = selectedPreset();
  const copy = GAME_COPY[key];
  const titleLabel = document.querySelector('[data-write-section="standard-fields"] .form-group:first-child .form-label');
  const bodyLabel = document.querySelector('[data-write-section="content-field"] .form-label');
  setHtmlIfChanged(titleLabel, `${copy.title} <span class="required">*</span>`);
  setHtmlIfChanged(bodyLabel, `${copy.body} ${requiredHtml(copy.bodyRequired)}`);
  setAttrIfChanged(document.getElementById('mw-title'), 'placeholder', copy.titlePlaceholder);
  setAttrIfChanged(document.getElementById('mw-desc'), 'placeholder', copy.bodyPlaceholder);
  setAttrIfChanged(document.getElementById('mw-tags'), 'placeholder', copy.tagsPlaceholder);
}

function isMobileViewport() {
  return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
}

function polishHomeCharacters() {
  const home = document.querySelector('.home-onboard');
  if (!home) return;
  const isMobile = isMobileViewport();
  const grids = [...home.querySelectorAll('div')].filter(el => String(el.getAttribute('style') || '').includes('grid-template-columns'));
  grids.forEach(grid => {
    setStyleIfChanged(grid, 'gap', isMobile ? '12px' : '16px');
    setStyleIfChanged(grid, 'marginTop', isMobile ? '18px' : '22px');
    setStyleIfChanged(grid, 'padding', isMobile ? '14px 12px 12px' : '20px 18px 16px');
    setStyleIfChanged(grid, 'boxSizing', 'border-box');
    setStyleIfChanged(grid, 'width', '100%');
    [...grid.children].forEach(card => {
      setStyleIfChanged(card, 'padding', isMobile ? '15px' : '17px');
      setStyleIfChanged(card, 'borderRadius', '18px');
      setStyleIfChanged(card, 'minHeight', isMobile ? '96px' : '104px');
      setStyleIfChanged(card, 'boxSizing', 'border-box');
    });
  });
}

function polishGlobalCopy() {
  document.querySelectorAll('#sb-write-btn span').forEach(el => setTextIfChanged(el, '게임 열기'));
  document.querySelectorAll('.sidebar__nav-item span').forEach(el => {
    if (el.textContent === '피드' || el.textContent === '게시판') setTextIfChanged(el, '커뮤니티');
    if (el.textContent === '통계') setTextIfChanged(el, '랭킹');
  });
}

function schedulePolish() {
  if (polishQueued) return;
  polishQueued = true;
  requestAnimationFrame(() => {
    polishQueued = false;
    polishWriter();
    polishHomeCharacters();
    polishGlobalCopy();
  });
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-multi-preset]');
  if (button) setTimeout(polishWriter, 0);

  const sidebarWrite = event.target.closest('#sb-write-btn');
  if (sidebarWrite) {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.hash = '#/write?type=multi&preset=judgment';
  }
}, true);

window.addEventListener('sosoking:write-option-changed', polishWriter);
window.addEventListener('hashchange', schedulePolish);
window.addEventListener('resize', schedulePolish);
window.addEventListener('orientationchange', schedulePolish);
window.addEventListener('sosoking:extensions-ready', schedulePolish);

if (document.body) {
  const observer = new MutationObserver(schedulePolish);
  observer.observe(document.body, { childList: true, subtree: true });
}

schedulePolish();
