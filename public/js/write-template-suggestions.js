const TEMPLATES = {
  general: [
    { label: '오늘 있었던 일', title: '오늘 나한테 있었던 소소한 일', body: '오늘 있었던 일을 짧게 적어보세요.\n\n예상 못한 장면이나 마지막 한 줄 반전이 있으면 더 좋아요.' },
    { label: '공감 질문', title: '이런 상황 나만 겪어?', body: '상황:\n\n내 생각:\n\n다른 사람들은 어떻게 생각하는지 궁금해요.' },
    { label: '웃긴 실수담', title: '방금 한 실수인데 너무 어이없음', body: '무슨 일이 있었는지:\n\n내 반응:\n\n결말:' },
  ],
  vote: [
    { label: '누가 더 잘못?', title: '이 상황 누가 더 잘못한 거 같아?', body: '상황을 설명해주세요.\n\nA 입장:\nB 입장:\n\n여러분 생각은?', voteOptions: ['A가 더 잘못', 'B가 더 잘못', '둘 다 비슷'] },
    { label: '밸런스 게임', title: '이거 둘 중 하나만 고르면?', body: '둘 중 하나만 고를 수 있다면 무엇을 선택할지 투표해주세요.', voteOptions: ['1번 선택', '2번 선택'] },
    { label: '오늘 메뉴', title: '오늘 뭐 먹을까?', body: '지금 너무 고민됩니다. 하나만 골라주세요.', voteOptions: ['한식', '중식', '일식', '분식'] },
  ],
  fill: [
    { label: '기분 빈칸', title: '오늘 내 기분은 ___다', body: '오늘 내 기분은 ___다.\n왜냐하면 ___ 때문이다.' },
    { label: '상황 완성', title: '이 상황에서 나는 ___했다', body: '친구가 갑자기 ___라고 말했다.\n그래서 나는 ___했다.' },
    { label: '웃긴 문장', title: '가장 웃기게 빈칸 채워봐', body: '아침에 일어나보니 내 방에 ___가 있었다.\n나는 너무 놀라서 ___했다.' },
  ],
  naming: [
    { label: '사진 이름', title: '이 사진 이름 좀 지어줘', body: '이 장면에 어울리는 웃긴 이름을 지어주세요.' },
    { label: '별명 공모', title: '이 사람 별명 뭐가 좋을까?', body: '특징을 보고 가장 잘 어울리는 별명을 지어주세요.' },
    { label: '상품명 장난', title: '이 물건 이름을 미친 듯이 지어보자', body: '평범한 물건인데 이름만 기깔나게 지어주세요.' },
  ],
  acrostic: [
    { label: '삼행시 기본', title: '이걸로 삼행시 해줘', body: '센스 있는 삼행시 부탁합니다.', keyword: '소소킹' },
    { label: '웃긴 제시어', title: '이 제시어로 미친 삼행시 가능?', body: '웃기거나 어이없는 방향이면 더 좋습니다.', keyword: '월요일' },
    { label: '고백 삼행시', title: '고백 느낌으로 삼행시 해줘', body: '오글거려도 괜찮습니다. 최대한 진심처럼 써주세요.', keyword: '사랑해' },
  ],
  relay: [
    { label: '막장 시작', title: '릴레이로 막장 드라마 만들어보자', body: '그날 밤, 나는 분명 혼자 집에 들어왔다.\n그런데 냉장고 앞에 누군가 서 있었다.', mission: 'twist' },
    { label: '공포 시작', title: '이 이야기 공포로 이어가줘', body: '엘리베이터가 13층에서 멈췄다.\n문이 열리자 복도 끝에서 내 이름을 부르는 소리가 들렸다.', mission: 'horror' },
    { label: '개그 시작', title: '릴레이로 이상한 이야기 만들기', body: '나는 오늘부터 평범하게 살기로 했다.\n그런데 출근길에 말하는 비둘기를 만났다.', mission: 'animal' },
  ],
  quiz: [
    { label: '넌센스 퀴즈', title: '맞히면 인정하는 넌센스 퀴즈', body: '세상에서 가장 빠른 닭은?', answer: '후다닭', hint: '말장난입니다.', explanation: '후다닥과 닭을 합친 넌센스 정답입니다.' },
    { label: '상식 퀴즈', title: '간단 상식 퀴즈', body: '우리나라의 수도는 어디일까요?', answer: '서울', hint: '대한민국 정치와 행정의 중심지입니다.', explanation: '대한민국의 수도는 서울입니다.' },
    { label: '객관식 퀴즈', title: '하나만 고르는 미친퀴즈', body: '다음 중 실제 동물이 아닌 것은?', quizMode: 'multiple', quizOptions: ['고양이', '강아지', '용가리', '햄스터'], correctIndex: 2, hint: '상상 속 느낌이 나는 이름입니다.', explanation: '용가리는 실제 동물명이 아니라 캐릭터/상상 동물에 가깝습니다.' },
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

function dispatch(el) {
  if (!el) return;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value || '';
  dispatch(el);
}

function setBody(text) {
  const textarea = document.getElementById('mw-desc');
  const editor = document.getElementById('mw-rich-editor');
  const html = htmlFromText(text || '');
  if (textarea) {
    textarea.value = html;
    textarea.dataset.plainText = text || '';
    dispatch(textarea);
  }
  if (editor) {
    editor.innerHTML = html;
    dispatch(editor);
  }
}

function setVoteOptions(options = []) {
  const inputs = [...document.querySelectorAll('.mw-vote-option')];
  inputs.forEach((input, index) => {
    input.value = options[index] || '';
    dispatch(input);
  });
}

function setAcrostic(keyword) {
  setValue('mw-acrostic-keyword', keyword || '');
}

function setRelayMission(key) {
  const hidden = document.getElementById('mw-relay-mission');
  if (hidden) {
    hidden.value = key || 'none';
    dispatch(hidden);
  }
  document.querySelectorAll('[data-relay-mission]').forEach(btn => btn.click && btn.dataset.relayMission === (key || 'none') && btn.click());
}

function setQuizMode(mode) {
  const key = mode === 'multiple' ? 'multiple' : 'subjective';
  const btn = document.querySelector(`[data-quiz-mode="${key}"]`);
  if (btn) btn.click();
  else setValue('mw-quiz-mode', key);
}

function setQuizOptions(template) {
  if (template.quizMode !== 'multiple') {
    setQuizMode('subjective');
    setValue('mw-quiz-answer', template.answer || '');
    return;
  }
  setQuizMode('multiple');
  const options = template.quizOptions || [];
  const addBtn = document.getElementById('mw-add-quiz-option');
  while (document.querySelectorAll('.mw-quiz-option').length < options.length && addBtn) addBtn.click();
  [...document.querySelectorAll('.mw-quiz-option')].forEach((input, index) => {
    input.value = options[index] || '';
    dispatch(input);
  });
  const correct = document.querySelector(`input[name="mw-quiz-correct"][value="${Number(template.correctIndex || 0)}"]`);
  if (correct) {
    correct.checked = true;
    dispatch(correct);
  }
}

function applyTemplate(template) {
  setValue('mw-title', template.title || '');
  setBody(template.body || '');
  if (template.voteOptions) setVoteOptions(template.voteOptions);
  if (template.keyword) setAcrostic(template.keyword);
  if (template.mission) setRelayMission(template.mission);
  if (template.answer || template.quizMode) setQuizOptions(template);
  if (template.hint) setValue('mw-quiz-hint', template.hint);
  if (template.explanation) setValue('mw-quiz-explanation', template.explanation);
  window.dispatchEvent(new Event('sosoking:render-multi-write'));
}

function renderCard(preset) {
  const list = TEMPLATES[preset] || TEMPLATES.general;
  return `
    <div class="write-template-card" data-write-template-card="${esc(preset)}">
      <div class="write-template-card__head">
        <b>✨ 추천 템플릿</b>
        <span>막힐 때 하나 눌러서 시작하세요.</span>
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
  if (existing?.dataset.writeTemplateCard === preset) return;
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
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(injectTemplateCard, 160);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:render-multi-write', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 500);
