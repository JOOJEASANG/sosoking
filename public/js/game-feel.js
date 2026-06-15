// game-feel.js
// 전역 "게임감" 인터랙션 레이어 — 색/레이아웃은 그대로 두고 반응만 게임처럼.
//  • 햅틱(진동)  • 가벼운 효과음(WebAudio, 에셋 없음)  • 탭 반짝임/포인트 팝
// 독립 실행형: 실패해도 앱 부팅을 막지 않는다.

const LS_SFX = 'soso-sfx';        // 'off' 이면 음소거
const LS_HAPTIC = 'soso-haptic';  // 'off' 이면 진동 끔

export function sfxEnabled() {
  try { return localStorage.getItem(LS_SFX) !== 'off'; } catch { return true; }
}
export function hapticEnabled() {
  try { return localStorage.getItem(LS_HAPTIC) !== 'off'; } catch { return true; }
}
export function setSfx(on) { try { localStorage.setItem(LS_SFX, on ? 'on' : 'off'); } catch {} }
export function setHaptic(on) { try { localStorage.setItem(LS_HAPTIC, on ? 'on' : 'off'); } catch {} }

// ── WebAudio (사용자 제스처 시 lazy 생성) ──
let ac = null;
function ctx() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}

function blip(freq, dur, { type = 'sine', gain = 0.05, when = 0, slideTo = null } = {}) {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// kind: 'tap' | 'success' | 'levelup' | 'error' | 'nav'
export function playSfx(kind) {
  if (!sfxEnabled()) return;
  if (!ctx()) return;
  switch (kind) {
    case 'tap':
      blip(440, 0.04, { type: 'triangle', gain: 0.018 });
      break;
    case 'nav':
      blip(560, 0.05, { type: 'sine', gain: 0.025 });
      break;
    case 'success':
      blip(660, 0.09, { type: 'triangle', gain: 0.05 });
      blip(990, 0.11, { type: 'triangle', gain: 0.045, when: 0.07 });
      break;
    case 'levelup':
      blip(523, 0.12, { type: 'triangle', gain: 0.05 });
      blip(659, 0.12, { type: 'triangle', gain: 0.05, when: 0.1 });
      blip(784, 0.16, { type: 'triangle', gain: 0.055, when: 0.2 });
      blip(1047, 0.22, { type: 'triangle', gain: 0.05, when: 0.32 });
      break;
    case 'error':
      blip(220, 0.16, { type: 'sawtooth', gain: 0.04, slideTo: 130 });
      break;
  }
}

export function haptic(pattern) {
  if (!hapticEnabled()) return;
  try { navigator.vibrate?.(pattern); } catch {}
}

// ── 시각 효과 ──
function rectCenter(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function burstAt(el, { color = '#ffd200', count = 8 } = {}) {
  if (!el || !document.body) return;
  const { x, y } = rectCenter(el);
  const layer = document.createElement('div');
  layer.className = 'soso-spark-layer';
  layer.style.left = `${x}px`;
  layer.style.top = `${y}px`;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'soso-spark';
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 22 + Math.random() * 22;
    s.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
    s.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
    s.style.background = color;
    layer.appendChild(s);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 700);
}

export function pointPop(el, text, { color = '#16a34a' } = {}) {
  if (!el || !document.body) return;
  const { x, y } = rectCenter(el);
  const pop = document.createElement('div');
  pop.className = 'soso-pop';
  pop.textContent = text;
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;
  pop.style.color = color;
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 900);
}

// 등급 상승 등 큰 순간 — 사운드 + 화면 가벼운 반짝임
export function celebrate(el) {
  playSfx('levelup');
  haptic([12, 40, 12, 40, 18]);
  if (el) burstAt(el, { color: '#ffd200', count: 14 });
}

// ── 전역 클릭 위임 (capture: stopPropagation 이전에 실행) ──
const POSITIVE_SEL = [
  '.reaction-btn', '[data-reaction]', '.react-btn', '.vote-btn', '.battle-vote',
  '.battle-party-card__vote', '[data-account-go]', '.home-yresult__cta',
  '[data-share]', '.share-btn', '.btn--primary', '.mission-claim', '[data-claim]',
].join(',');
const DANGER_SEL = '.btn--danger, [data-danger]';
const INTERACTIVE_SEL = 'button, a[href], [role="button"], [data-path], .btn, .reaction-btn, [data-account-go]';

function onClick(e) {
  const t = e.target;
  if (!(t instanceof Element)) return;
  const danger = t.closest(DANGER_SEL);
  if (danger) { haptic(22); playSfx('error'); return; }

  const pos = t.closest(POSITIVE_SEL);
  if (pos) {
    haptic([8, 24, 8]);
    playSfx('success');
    burstAt(pos);
    return;
  }

  const inter = t.closest(INTERACTIVE_SEL);
  if (inter) {
    haptic(6);
    playSfx(inter.matches('[data-path], a[href]') ? 'nav' : 'tap');
  }
}

function init() {
  if (window.__sosoGameFeel) return;
  window.__sosoGameFeel = true;
  document.addEventListener('click', onClick, true);
  // 외부(기존 연출 코드)에서 호출할 수 있게 노출
  window.SosoGame = { playSfx, haptic, burstAt, pointPop, celebrate, sfxEnabled, hapticEnabled, setSfx, setHaptic };
}

init();
