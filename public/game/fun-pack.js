const SUPPORTED = ['/game/vault/', '/game/chosung/'];
const active = SUPPORTED.some(path => location.pathname.startsWith(path));

let audioContext = null;
let lastCelebration = '';

function soundEnabled() {
  return localStorage.getItem('sosoking-game-sound') !== 'off';
}

function unlockAudio() {
  if (!soundEnabled()) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') void audioContext.resume();
  } catch {}
}

function beep(frequency, duration = .07, delay = 0, gain = .025) {
  unlockAudio();
  if (!audioContext || audioContext.state !== 'running') return;
  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const volume = audioContext.createGain();
  oscillator.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + .01);
  volume.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(volume); volume.connect(audioContext.destination);
  oscillator.start(start); oscillator.stop(start + duration + .02);
}

function playSound(kind) {
  if (!soundEnabled()) return;
  if (kind === 'click') beep(430, .045, 0, .014);
  if (kind === 'good') { beep(540); beep(760, .09, .08); }
  if (kind === 'finish') { beep(520, .09); beep(700, .1, .1); beep(920, .14, .21); }
}

function particles(emoji = '✨', count = 14) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let index = 0; index < count; index += 1) {
    const node = document.createElement('span');
    node.className = 'fun-particle';
    node.textContent = emoji;
    node.style.left = `${42 + Math.random() * 16}%`;
    node.style.top = `${35 + Math.random() * 15}%`;
    node.style.setProperty('--dx', `${(Math.random() - .5) * 300}px`);
    node.style.setProperty('--dy', `${-50 - Math.random() * 230}px`);
    node.style.setProperty('--rot', `${(Math.random() - .5) * 440}deg`);
    document.body.append(node);
    setTimeout(() => node.remove(), 1200);
  }
}

function mountSoundToggle() {
  if (document.querySelector('.fun-sound-toggle')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'fun-sound-toggle';
  button.setAttribute('aria-label', '게임 효과음 켜기 또는 끄기');
  const sync = () => {
    button.textContent = soundEnabled() ? '🔊' : '🔇';
    button.title = soundEnabled() ? '효과음 끄기' : '효과음 켜기';
  };
  button.addEventListener('click', () => {
    localStorage.setItem('sosoking-game-sound', soundEnabled() ? 'off' : 'on');
    sync();
    if (soundEnabled()) playSound('good');
  });
  sync(); document.body.append(button);
}

function celebrateVisibleResult() {
  const panel = document.querySelector('#game-app .panel');
  if (!panel) return;
  const title = panel.querySelector('h1,h2')?.textContent?.trim() || '';
  const key = `${location.pathname}:${new URL(location.href).searchParams.get('room') || ''}:${title}`;
  if (!title || key === lastCelebration) return;
  if (panel.querySelector('.ranking')) {
    lastCelebration = key; playSound('finish'); particles('👑', 18);
    try { navigator.vibrate?.([45, 40, 90]); } catch {}
  } else if (panel.querySelector('.result-tag.good')) {
    lastCelebration = key; playSound('good'); particles('✨', 10);
  }
}

function boot() {
  if (!active) return;
  mountSoundToggle();
  document.addEventListener('pointerdown', event => {
    if (event.target.closest?.('button') && !event.target.closest('.fun-sound-toggle')) playSound('click');
  }, { passive: true });
  const app = document.getElementById('game-app');
  if (!app) return;
  const observer = new MutationObserver(() => setTimeout(celebrateVisibleResult, 0));
  observer.observe(app, { childList: true, subtree: true });
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
}

boot();
