// president-decree-helper.js
// 현직 대통령 전용 포고령 추천 버튼

function currentPath() {
  const hashPath = (window.location.hash.slice(1) || '').split('?')[0];
  if (hashPath && hashPath !== '/') return hashPath;
  return window.location.pathname || '/';
}

function decreeSuggestions() {
  return [
    '소소공화국은 오늘부터 민생 안정과 정당 간 협치를 최우선 국정 과제로 삼겠습니다.',
    '모든 시민의 정치 참여를 장려하기 위해 토론과 투표 참여 문화를 강화하겠습니다.',
    '정쟁보다 결과로 평가받는 정부를 만들고, 공화국 안정도를 높이는 데 집중하겠습니다.',
    '청년·중도·안정 세력이 함께 참여하는 균형 국정을 추진하겠습니다.',
    '불필요한 갈등을 줄이고, 국민이 체감할 수 있는 생활 정치부터 실행하겠습니다.',
    '국회와 정당의 의견을 존중하되, 공화국 질서와 민생을 흔드는 혼란에는 단호히 대응하겠습니다.',
  ];
}

function addPresidentDecreeRecommendButton() {
  if (currentPath() !== '/election') return;
  if (document.getElementById('prez-decree-recommend')) return;
  const input = document.getElementById('prez-decree-input');
  const submit = document.getElementById('prez-decree-submit');
  const actions = document.querySelector('.prez-decree-form__actions');
  if (!input || !submit || !actions) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'prez-decree-recommend';
  btn.className = 'btn btn--ghost btn--sm';
  btn.textContent = '✨ 포고령 추천';
  btn.addEventListener('click', () => {
    const list = decreeSuggestions();
    const next = list[Math.floor(Math.random() * list.length)].slice(0, 200);
    input.value = next;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
  actions.insertBefore(btn, submit);
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(addPresidentDecreeRecommendButton, 120);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('popstate', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
schedule();
