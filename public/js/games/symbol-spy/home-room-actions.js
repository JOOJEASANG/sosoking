import { navigate } from '../../router.js';
import { toast } from '../../components/toast.js';
import { createSymbolSpyRoom } from './room-v2.js';

function enhanceSymbolSpyHome() {
  const hero = document.querySelector('.symbol-spy--intro .symbol-spy__hero');
  if (!hero || hero.dataset.roomEnhanced === '1') return;
  const soloBtn = hero.querySelector('[data-action="start"]');
  if (!soloBtn) return;

  hero.dataset.roomEnhanced = '1';
  soloBtn.textContent = '혼자 연습하기';

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
      const roomId = await createSymbolSpyRoom();
      toast.success('심볼스파이 방을 만들었어요');
      navigate(`/game/symbol-spy/${roomId}`);
    } catch (error) {
      console.error('[symbol-spy room create]', error);
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
