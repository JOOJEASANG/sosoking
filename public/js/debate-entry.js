// 과거 버전이 홈에 주입했던 '소소킹 유니버스' 진입 블록(#sosoking-rooms-entry)을
// 제거하는 정리 가드. 현재 홈(home.js)이 세 서비스 진입을 직접 렌더하므로 중복 블록만 걷어낸다.
const ENTRY_ID = 'sosoking-rooms-entry';

function normalizeHome() {
  document.getElementById(ENTRY_ID)?.remove();
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => { scheduled = false; normalizeHome(); });
}

const observer = new MutationObserver(schedule);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', schedule);
window.addEventListener('pageshow', schedule);
normalizeHome();
