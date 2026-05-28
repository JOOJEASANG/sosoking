const TEMPLATES = {
  general: [
    { label: '오늘 있었던 일', title: '오늘 나한테 있었던 소소한 일', body: '오늘 있었던 일을 짧게 적어보세요.\n\n예상 못한 장면이나 마지막 한 줄 반전이 있으면 더 좋아요.' },
    { label: '공감 질문', title: '이런 상황 나만 겪어?', body: '상황:\n\n내 생각:\n\n다른 사람들은 어떻게 생각하는지 궁금해요.' },
    { label: '웃긴 실수담', title: '방금 한 실수인데 너무 어이없음', body: '무슨 일이 있었는지:\n\n내 반응:\n\n결말:' },
  ],
  vote: [
    { label: '찬반 질문', title: '이 상황 찬성인가요 반대인가요?', body: '상황을 짧게 설명해주세요.\n\n여러분 생각은?', voteOptions: ['찬성', '반대'] },
    { label: '누가 더 잘못?', title: '이 상황 누가 더 잘못한 거 같아?', body: '상황을 설명해주세요.\n\nA 입장:\nB 입장:\n\n여러분 생각은?', voteOptions: ['A가 더 잘못', 'B가 더 잘못', '둘 다 비슷'] },
    { label: '오늘 메뉴', title: '오늘 뭐 먹을까?', body: '지금 너무 고민됩니다. 하나만 골라주세요.', voteOptions: ['한식', '중식', '일식', '분식'] },
  ],
  drip: [
    { label: '오늘의 한줄', dripLine: '월요일 아침 내 표정은 이미 퇴근했다' },
    { label: '사진 한마디', dripLine: '이 사진에 어울리는 한 줄을 적어보세요' },
    { label: '퇴근 드립', dripLine: '퇴근 5분 전 팀장님이 부르면 영혼이 로그아웃된다' },
  ],
  quiz: [
    { label: '넌센스 퀴즈', title: '맞히면 인정하는 넌센스 퀴즈', body: '세상에서 가장 빠른 닭은?', answer: '후다닭', hint: '말장난입니다.', explanation: '후다닥과 닭을 합친 넌센스 정답입니다.' },
    { label: '상식 퀴즈', title: '간단 상식 퀴즈', body: '우리나라의 수도는 어디일까요?', answer: '서울', hint: '대한민국 정치와 행정의 중심지입니다.', explanation: '대한민국의 수도는 서울입니다.' },
    { label: '객관식 퀴즈', title: '하나만 고르는 소소퀴즈', body: '다음 중 실제 동물이 아닌 것은?', quizMode: 'multiple', quizOptions: ['고양이', '강아지', '용가리', '햄스터'], correctIndex: 2, hint: '상상 속 느낌이 나는 이름입니다.', explanation: '용가리는 실제 동물명이 아니라 캐릭터/상상 동물에 가깝습니다.' },
  ],
};

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function currentPreset() {
  const page = document.querySelector('.multi-write-page');
  return page?.dataset.presetKey || new URLSearchParams((location.hash.split('?')[1] || '')).get('preset') || 'general';
}

function isWritePage() {
  return !!document.querySelector('.multi-write-page') && /[?&]type=multi\b/.test(location.hash || '');
}

function htmlFromText(text) {
  return String(text || '').split('\n').map(line => line ? `<div>${esc(line)}</div>` : '<div><br></div>').join('');
}

function plainFromHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/div>/gi, '\n').replace(/<\/p>/gi, '\n');
  return (tmp.textContent || '').replace(/\n{4,}/g, '\n\n\n').trim();
}

function dispatch(el) {
  if (!el) return;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function setGhostInput(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value || '';
  el.dataset.templateGhost = '1';
  el.classList.add('is-template-ghost');
  dispatch(el);
}

function setGhostBody(text) {
  const textarea = document.getElementById('mw-desc');
  const editor = document.getElementById('mw-rich-editor');
  const html = htmlFromText(text || '');
  if (textarea) {
    textarea.value = html;
    textarea.dataset.plainText = text || '';
    textarea.dataset.templateGhost = '1';
    textarea.classList.add('is-template-ghost');
    dispatch(textarea);
  }
  if (editor) {
    editor.innerHTML = html;
    editor.dataset.templateGhost = '1';
    editor.classList.add('is-template-ghost');
    dispatch(editor);
  }
}

function clearGhost(el) {
  if (!el || el.dataset.templateGhost !== '1') return;
  el.dataset.templateGhost = '';
  el.classList.remove('is-template-ghost');
  if (el.id === 'mw-rich-editor') {
    el.innerHTML = '';
    const textarea = document.getElementById('mw-desc');
    if (textarea) {
      textarea.value = '';
      textarea.dataset.plainText = '';
      textarea.dataset.templateGhost = '';
      textarea.classList.remove('is-template-ghost');
      dispatch(textarea);
    }
  } else {
    el.value = '';
    if (el.id === 'mw-desc') el.dataset.plainText = '';
    dispatch(el);
  }
}

function bindGhostClear() {
  document.querySelectorAll('#mw-title,#mw-desc,#mw-rich-editor,#mw-drip-line,#mw-quiz-answer,#mw-quiz-hint,#mw-quiz-explanation,.mw-vote-option,.mw-quiz-option').forEach(el => {
    if (el.dataset.ghostBound === '1') return;
    el.dataset.ghostBound = '1';
    el.addEventListener('focus', () => clearGhost(el));
    el.addEventListener('pointerdown', () => clearGhost(el));
  });
}

function setVoteOptions(options = []) {
  const inputs = [...document.querySelectorAll('.mw-vote-option')];
  inputs.forEach((input, index) => {
    if (options[index]) setGhostInput(input.id || '', '');
    input.value = options[index] || '';
    input.dataset.templateGhost = options[index] ? '1' : '';
    input.classList.toggle('is-template-ghost', !!options[index]);
    dispatch(input);
  });
}

function setQuizMode(mode) {
  const key = mode === 'multiple' ? 'multiple' : 'subjective';
  const btn = document.querySelector(`[data-quiz-mode="${key}"]`);
  if (btn) btn.click();
  else {
    const hidden = document.getElementById('mw-quiz-mode');
    if (hidden) hidden.value = key;
  }
}

function setQuizOptions(template) {
  if (template.quizMode !== 'multiple') {
    setQuizMode('subjective');
    setGhostInput('mw-quiz-answer', template.answer || '');
    return;
  }
  setQuizMode('multiple');
  const options = template.quizOptions || [];
  const addBtn = document.getElementById('mw-add-quiz-option');
  while (document.querySelectorAll('.mw-quiz-option').length < options.length && addBtn) addBtn.click();
  [...document.querySelectorAll('.mw-quiz-option')].forEach((input, index) => {
    input.value = options[index] || '';
    input.dataset.templateGhost = options[index] ? '1' : '';
    input.classList.toggle('is-template-ghost', !!options[index]);
    dispatch(input);
  });
  const correct = document.querySelector(`input[name="mw-quiz-correct"][value="${Number(template.correctIndex || 0)}"]`);
  if (correct) {
    correct.checked = true;
    dispatch(correct);
  }
}

function applyTemplate(template) {
  if (template.dripLine) {
    setGhostInput('mw-drip-line', template.dripLine);
  } else {
    setGhostInput('mw-title', template.title || '');
    setGhostBody(template.body || '');
  }
  if (template.voteOptions) setVoteOptions(template.voteOptions);
  if (template.answer || template.quizMode) setQuizOptions(template);
  if (template.hint) setGhostInput('mw-quiz-hint', template.hint);
  if (template.explanation) setGhostInput('mw-quiz-explanation', template.explanation);
  bindGhostClear();
  window.dispatchEvent(new Event('sosoking:render-multi-write'));
}

function renderCard(preset) {
  const list = TEMPLATES[preset] || TEMPLATES.general;
  return `
    <div class="write-template-card" data-write-template-card="${esc(preset)}">
      <div class="write-template-card__head">
        <b>✨ 추천 템플릿</b>
        <span>클릭하면 흐린 예시로 들어가고, 입력칸을 누르면 사라집니다.</span>
      </div>
      <div class="write-template-card__list">
        ${list.map((item, index) => `<button type="button" class="write-template-chip" data-write-template-index="${index}">${esc(item.label)}</button>`).join('')}
      </div>
    </div>`;
}

function injectTemplateCard() {
  if (!isWritePage()) return;
  const preset = currentPreset();
  const existing = document.querySelector('[data-write-template-card]');
  if (existing?.dataset.writeTemplateCard === preset) {
    bindGhostClear();
    return;
  }
  if (existing) existing.remove();
  const anchor = document.querySelector('.multi-preset-box') || document.querySelector('.write-step-header');
  if (!anchor) return;
  anchor.insertAdjacentHTML('afterend', renderCard(preset));
  document.querySelectorAll('.write-template-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const list = TEMPLATES[currentPreset()] || TEMPLATES.general;
      const template = list[Number(btn.dataset.writeTemplateIndex || 0)];
      if (template) applyTemplate(template);
    });
  });
  bindGhostClear();
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(injectTemplateCard, 160);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:render-multi-write', schedule);
window.addEventListener('sosoking:write-option-changed', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 500);
