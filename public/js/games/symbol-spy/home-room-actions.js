import { navigate } from '../../router.js';
import { toast } from '../../components/toast.js';
import { createTouchKingRoom } from './touch-room.js';

function enhanceSymbolSpyHome() {
  const hero = document.querySelector('.symbol-spy--intro .symbol-spy__hero');
  if (!hero || hero.dataset.roomEnhanced === '1') return;
  const soloBtn = hero.querySelector('[data-action="start"]');
  if (!soloBtn) return;

  hero.dataset.roomEnhanced = '1';
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
        <option value="3">3판</option>
        <option value="5" selected>5판</option>
        <option value="7">7판</option>
        <option value="10">10판</option>
        <option value="15">15판</option>
        <option value="20">20판</option>
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
      const roundLimit = Number(document.getElementById('touch-king-rounds')?.value || 5);
      const roomId = await createTouchKingRoom({ maxPlayers, roundLimit });
      toast.success('터치왕게임 방을 만들었어요');
      navigate(`/game/symbol-spy/${roomId}`);
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
  timer = setTimeout(enhanceSymbolSpyHome, 80);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 200);
