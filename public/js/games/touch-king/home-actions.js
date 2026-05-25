import { navigate } from '../../router.js';
import { toast } from '../../components/toast.js';
import { createTouchKingRoom } from './creator.js';

function enhanceTouchKingHome() {
  const hero = document.querySelector('.symbol-spy--intro .symbol-spy__hero');
  if (!hero || hero.dataset.touchKingEnhanced === '1') return;
  const soloBtn = hero.querySelector('[data-action="start"]');
  if (!soloBtn) return;

  hero.dataset.touchKingEnhanced = '1';
  const title = hero.querySelector('h1');
  const desc = hero.querySelector('p');
  const kicker = hero.querySelector('.symbol-spy__kicker');
  if (kicker) kicker.textContent = '12개 그림 빠른 터치 대결';
  if (title) title.innerHTML = '같은 그림을 찾고<br>터치왕에 도전하라';
  if (desc) desc.textContent = '중앙판 12개와 내 판 12개 중 동시에 있는 그림 하나를 가장 빠르게 누르는 순발력 대결 게임입니다.';
  soloBtn.textContent = '혼자 연습하기';

  const settings = document.createElement('div');
  settings.className = 'touch-king-settings';
  settings.innerHTML = `
    <label>인원수
      <select id="touch-king-max-players">
        <option value="2">2명</option>
        <option value="3">3명</option>
        <option value="4">4명</option>
        <option value="5">5명</option>
        <option value="6" selected>6명</option>
        <option value="8">8명</option>
        <option value="10">10명</option>
      </select>
    </label>
    <label>판수
      <select id="touch-king-rounds">
        <option value="10">10판</option>
        <option value="20">20판</option>
        <option value="30" selected>30판</option>
        <option value="50">50판</option>
      </select>
    </label>`;
  soloBtn.parentNode.insertBefore(settings, soloBtn);

  const wrap = document.createElement('div');
  wrap.className = 'symbol-spy__mode-actions';
  soloBtn.parentNode.insertBefore(wrap, soloBtn);
  wrap.appendChild(soloBtn);

  const roomBtn = document.createElement('button');
  roomBtn.type = 'button';
  roomBtn.className = 'symbol-spy__start symbol-spy__start--room';
  roomBtn.textContent = '친구와 방 만들기';
  wrap.appendChild(roomBtn);

  roomBtn.addEventListener('click', async () => {
    try {
      roomBtn.disabled = true;
      roomBtn.textContent = '방 만드는 중...';
      const maxPlayers = Number(document.getElementById('touch-king-max-players')?.value || 6);
      const roundLimit = Number(document.getElementById('touch-king-rounds')?.value || 30);
      const roomId = await createTouchKingRoom({ maxPlayers, roundLimit });
      toast.success('터치왕게임 방을 만들었어요');
      navigate(`/game/touch-king/${roomId}`);
    } catch (error) {
      console.error('[touch king room create]', error);
      toast.error(error.message || '방 만들기에 실패했어요');
      roomBtn.disabled = false;
      roomBtn.textContent = '친구와 방 만들기';
    }
  });
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(enhanceTouchKingHome, 80);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 200);
