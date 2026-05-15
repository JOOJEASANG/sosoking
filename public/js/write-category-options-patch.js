const WRITE_OPTION_STYLE_ID = 'sosoking-write-category-options-patch';

const OPTION_SETS = {
  fun: [
    ['image', '사진/짤', '이미지 업로드를 강조합니다'],
    ['vote', '웃긴 선택지', '4개 선택지로 반응을 받습니다'],
    ['comment', '댓글놀이', '댓글 참여를 유도합니다']
  ],
  game: [
    ['vote', '투표 필수', '선택지 중심 글쓰기'],
    ['duel', 'A/B 대결', '두 가지 선택을 강조합니다'],
    ['result', '결과 공개', '투표 후 퍼센트 확인']
  ],
  quiz: [
    ['answer', '정답/해설', '정답과 해설 입력칸 사용'],
    ['hint', '힌트', '문제 설명을 더 자세히 작성'],
    ['vote', '보기 선택', '보기 2~4개 사용']
  ],
  story: [
    ['opening', '첫 장면', '시작 문장을 따로 작성'],
    ['rule', '이어쓰기 규칙', '댓글 이어쓰기 규칙 작성'],
    ['genre', '장르', '막장/공포/개그 등 장르 표시']
  ],
  info: [
    ['link', '링크 카드', '사이트 링크와 요약 사용'],
    ['ai', 'AI 요약', 'AI로 핵심 요약 생성'],
    ['source', '출처', '출처/사이트명을 강조']
  ],
  media: [
    ['link', '영상/이미지 링크', '유튜브 또는 이미지 링크 사용'],
    ['reaction', '리액션 질문', '한 줄 평과 반응 투표'],
    ['thumbnail', '썸네일', '영상/이미지 미리보기 강조']
  ],
  talk: [
    ['vote', '찬반/민심', '생각이 갈리는 선택지'],
    ['context', '상황 설명', '갈리는 기준을 본문에 작성'],
    ['rule', '토론 매너', '비방 없는 의견 유도']
  ],
  ai: [
    ['prompt', 'AI 프롬프트', 'AI에게 넣은 요청을 설명'],
    ['result', 'AI 결과', 'AI 답변/이미지 설명 공유'],
    ['remix', '댓글 확장', '댓글로 다시 변형하기']
  ]
};

const CATEGORY_LABELS = {
  fun: '재미형', game: '게임/투표형', quiz: '퀴즈형', story: '소설/역할극형', info: '정보공유형', media: '영상/이미지형', talk: '토론형', ai: 'AI 놀이형'
};

function injectStyle() {
  if (document.getElementById(WRITE_OPTION_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = WRITE_OPTION_STYLE_ID;
  style.textContent = `
    .write-option-board {
      margin: 14px 0 18px;
      padding: 16px;
      border-radius: 26px;
      background: linear-gradient(135deg, rgba(79,124,255,.08), rgba(255,122,89,.08));
      border: 1px solid rgba(79,124,255,.14);
      box-shadow: 0 14px 36px rgba(55,90,170,.08);
    }
    .write-option-board-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .write-option-board-head span {
      display: inline-flex;
      padding: 7px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,.82);
      color: #6d38ff;
      font-size: 11px;
      font-weight: 1000;
      letter-spacing: .08em;
    }
    .write-option-board-head b {
      display: block;
      margin-top: 7px;
      font-size: 20px;
      letter-spacing: -.055em;
      color: #111936;
    }
    .write-option-board-head p {
      margin: 6px 0 0;
      color: #667085;
      font-size: 13px;
      line-height: 1.55;
      font-weight: 800;
    }
    .write-option-mode-badge {
      white-space: nowrap;
      padding: 9px 12px;
      border-radius: 999px;
      background: #fff;
      color: #ff5c8a;
      font-size: 12px;
      font-weight: 1000;
      box-shadow: 0 8px 18px rgba(55,90,170,.08);
    }
    .write-option-list {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .write-option-item {
      position: relative;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 9px;
      align-items: flex-start;
      min-height: 88px;
      padding: 13px;
      border-radius: 20px;
      background: rgba(255,255,255,.86);
      border: 1px solid rgba(79,124,255,.12);
      cursor: pointer;
      transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
    }
    .write-option-item:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 30px rgba(55,90,170,.12);
    }
    .write-option-item input {
      width: 20px !important;
      min-height: 20px !important;
      height: 20px !important;
      margin-top: 2px;
      accent-color: #7c5cff;
    }
    .write-option-item b {
      display: block;
      color: #141a33;
      font-size: 15px;
      letter-spacing: -.04em;
    }
    .write-option-item small {
      display: block;
      margin-top: 4px;
      color: #667085;
      font-size: 12px;
      line-height: 1.4;
      font-weight: 800;
    }
    .write-option-item.active {
      border-color: rgba(124,92,255,.35);
      background: linear-gradient(135deg, #fff, #f4f0ff);
    }
    .write-option-tip {
      margin-top: 11px;
      padding: 11px 12px;
      border-radius: 16px;
      background: rgba(255,255,255,.76);
      color: #667085;
      font-size: 12px;
      line-height: 1.55;
      font-weight: 850;
    }
    .write-option-dimmed {
      opacity: .45;
      filter: grayscale(.2);
    }
    .write-option-required {
      outline: 2px solid rgba(124,92,255,.22) !important;
      box-shadow: 0 0 0 6px rgba(124,92,255,.06) !important;
    }
    @media (min-width: 901px) {
      body.soso-desktop-page-active .write-option-board {
        padding: 18px;
        border-radius: 28px;
      }
      body.soso-desktop-page-active .write-option-board-head b {
        font-size: 23px;
      }
      body.soso-desktop-page-active .write-option-list {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
    @media (max-width: 680px) {
      .write-option-board-head { display: grid; }
      .write-option-mode-badge { width: max-content; }
      .write-option-list { grid-template-columns: 1fr; }
      .write-option-item { min-height: 72px; }
    }
    [data-theme="dark"] .write-option-board {
      background: linear-gradient(135deg, rgba(79,124,255,.13), rgba(255,92,138,.10));
      border-color: rgba(255,255,255,.10);
    }
    [data-theme="dark"] .write-option-board-head b,
    [data-theme="dark"] .write-option-item b { color: #f5f7fb; }
    [data-theme="dark"] .write-option-board-head p,
    [data-theme="dark"] .write-option-item small,
    [data-theme="dark"] .write-option-tip { color: #a8b3c7; }
    [data-theme="dark"] .write-option-item,
    [data-theme="dark"] .write-option-tip,
    [data-theme="dark"] .write-option-board-head span,
    [data-theme="dark"] .write-option-mode-badge { background: rgba(255,255,255,.07); }
  `;
  document.head.appendChild(style);
}

function getCurrentCategory() {
  const active = document.querySelector('.category-grid button.active');
  return active?.dataset?.category || 'fun';
}

function setFieldGroupVisibility(options) {
  const checked = new Set(options);
  const linkPanel = document.querySelector('#link-panel');
  const quizPanel = document.querySelector('#quiz-panel');
  const storyPanel = document.querySelector('#story-panel');
  const rolePanel = document.querySelector('#role-panel');
  const uploadBox = document.querySelector('#feed-upload-box');
  const question = document.querySelector('#feed-question');
  const optionInputs = document.querySelectorAll('.feed-option-input');

  [linkPanel, quizPanel, storyPanel, rolePanel, uploadBox, question, ...optionInputs].forEach(el => el?.classList.remove('write-option-dimmed', 'write-option-required'));

  if (linkPanel) {
    const visible = checked.has('link') || checked.has('ai') || checked.has('source') || checked.has('thumbnail');
    linkPanel.hidden = !visible;
    if (visible) linkPanel.classList.add('write-option-required');
  }
  if (quizPanel) {
    const visible = checked.has('answer') || checked.has('hint');
    quizPanel.hidden = !visible;
    if (visible) quizPanel.classList.add('write-option-required');
  }
  if (storyPanel) {
    const visible = checked.has('opening') || checked.has('rule') || checked.has('genre');
    storyPanel.hidden = !visible;
    if (visible) storyPanel.classList.add('write-option-required');
  }
  if (rolePanel) {
    const visible = checked.has('prompt') || checked.has('result') || checked.has('remix') || checked.has('opening') || checked.has('rule');
    if (rolePanel && !['story'].includes(getCurrentCategory())) rolePanel.hidden = !visible;
    if (visible && rolePanel) rolePanel.classList.add('write-option-required');
  }
  if (uploadBox) {
    if (checked.has('image') || checked.has('thumbnail')) uploadBox.classList.add('write-option-required');
    else uploadBox.classList.add('write-option-dimmed');
  }
  if (question) {
    if (checked.has('vote') || checked.has('duel') || checked.has('reaction') || checked.has('context')) question.classList.add('write-option-required');
  }
  optionInputs.forEach(input => {
    if (checked.has('vote') || checked.has('duel') || checked.has('answer')) input.classList.add('write-option-required');
    else input.classList.add('write-option-dimmed');
  });
}

function renderOptionBoard() {
  const form = document.querySelector('#feed-write-form');
  const categoryGrid = document.querySelector('.category-grid');
  if (!form || !categoryGrid) return;
  injectStyle();

  const category = getCurrentCategory();
  const options = OPTION_SETS[category] || OPTION_SETS.fun;
  const existing = document.querySelector('#write-option-board');
  const html = `
    <div class="write-option-board-head">
      <div><span>WRITE OPTIONS</span><b>필요한 작성 항목만 선택</b><p>카테고리에 맞는 옵션을 체크하면 관련 입력칸만 강조됩니다. 필요 없는 항목은 흐리게 처리됩니다.</p></div>
      <div class="write-option-mode-badge">${CATEGORY_LABELS[category] || '작성형'}</div>
    </div>
    <div class="write-option-list">
      ${options.map(([id, label, desc], index) => `<label class="write-option-item ${index < 2 ? 'active' : ''}"><input type="checkbox" value="${id}" ${index < 2 ? 'checked' : ''}><span><b>${label}</b><small>${desc}</small></span></label>`).join('')}
    </div>
    <div class="write-option-tip">선택한 옵션은 작성 편의를 위한 화면 구성입니다. 실제 등록은 제목, 본문, 질문, 선택지를 기반으로 저장됩니다.</div>`;

  if (existing) existing.innerHTML = html;
  else {
    const board = document.createElement('section');
    board.id = 'write-option-board';
    board.className = 'write-option-board';
    board.innerHTML = html;
    categoryGrid.insertAdjacentElement('afterend', board);
  }

  const board = document.querySelector('#write-option-board');
  const refresh = () => {
    const checked = [...board.querySelectorAll('input:checked')].map(input => input.value);
    board.querySelectorAll('.write-option-item').forEach(label => label.classList.toggle('active', label.querySelector('input')?.checked));
    setFieldGroupVisibility(checked);
  };
  board.querySelectorAll('input').forEach(input => input.addEventListener('change', refresh));
  refresh();
}

function patchWritePage() {
  if (!location.hash.startsWith('#/feed/new')) return;
  if (!document.querySelector('#feed-write-form')) return;
  renderOptionBoard();
  document.querySelectorAll('.category-grid button').forEach(button => {
    if (button.dataset.optionPatchBound === '1') return;
    button.dataset.optionPatchBound = '1';
    button.addEventListener('click', () => setTimeout(renderOptionBoard, 30));
  });
  document.querySelectorAll('#type-grid button').forEach(button => {
    if (button.dataset.optionTypePatchBound === '1') return;
    button.dataset.optionTypePatchBound = '1';
    button.addEventListener('click', () => setTimeout(renderOptionBoard, 30));
  });
}

const observer = new MutationObserver(() => patchWritePage());
observer.observe(document.documentElement, { childList: true, subtree: true });

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patchWritePage);
else patchWritePage();
setTimeout(patchWritePage, 0);
setTimeout(patchWritePage, 300);
setTimeout(patchWritePage, 1000);
window.addEventListener('hashchange', () => setTimeout(patchWritePage, 50));
