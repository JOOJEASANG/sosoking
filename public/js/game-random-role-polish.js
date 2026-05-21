function polishGameLobby() {
  const hash = location.hash || '';

  if (hash.startsWith('#/game/wordtrap')) {
    document.getElementById('wordtrap-words')?.closest('.form-group')?.remove();
    const preset = document.getElementById('wordtrap-preset')?.closest('.form-group');
    if (preset && !preset.querySelector('.game-random-note')) {
      preset.insertAdjacentHTML('beforeend', '<div class="form-hint game-random-note">방장은 주제만 선택합니다. 실제 금칙어는 게임 시작 시 참가자별로 랜덤 배정됩니다.</div>');
    }
    const hero = document.querySelector('.game-detail-page--wordtrap .game-detail-hero p');
    if (hero) hero.textContent = '각자에게 랜덤 금칙어가 주어집니다. 자연스럽게 채팅하면서 내 금칙어를 절대 말하지 마세요. 말하는 순간 자동으로 걸립니다.';
  }

  if (hash.startsWith('#/game/liar')) {
    const category = document.getElementById('liar-category')?.closest('.form-group');
    if (category && !category.querySelector('.game-random-note')) {
      category.insertAdjacentHTML('beforeend', '<div class="form-hint game-random-note">방장은 카테고리만 선택합니다. 실제 제시어와 라이어는 게임 시작 시 랜덤으로 정해집니다.</div>');
    }
  }

  if (hash.startsWith('#/game/mafia')) {
    const guide = document.querySelector('.game-detail-page--mafia .game-guide-list');
    if (guide && !guide.dataset.rolePolished) {
      guide.dataset.rolePolished = '1';
      const first = guide.querySelector('div span');
      if (first) first.textContent = '방장이 시작하면 마피아, 시민, 경찰, 의사 역할이 인원에 맞춰 자동 배정됩니다.';
      guide.insertAdjacentHTML('beforeend', '<div><b>역할</b><span>5명부터 경찰, 6명부터 의사 역할이 추가됩니다. 경찰과 의사는 시민팀이며, 현재 버전은 채팅 토론과 투표 중심으로 진행됩니다.</span></div>');
    }
    const createHead = document.querySelector('.game-detail-page--mafia .game-create-panel .game-detail-card__head span');
    if (createHead) createHead.textContent = '5명부터 경찰, 6명부터 의사 역할이 자동 추가됩니다.';
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(polishGameLobby, 100);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(polishGameLobby, 400);
