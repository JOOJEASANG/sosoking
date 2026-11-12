import { CRAFT, LEVELS, SECTORS, clamp }
from './config.js';
import { Mission }
from './simulation.js';
import { SpaceView }
from './render.js';
import { Synth }
from './sound.js';

const el = id => document.getElementById(id);
const icon = name => '<svg aria-hidden="true"><use href="#i-' + name + '"/></svg>';
const storageKey = 'sosoking.skybreak.v1';
function readStore() {
  try { return JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { return {}; }
}
const stored = readStore();
let craft = CRAFT.find(c => c.id === stored.craft) || CRAFT[0];
let level = LEVELS.find(d => d.id === stored.level) || LEVELS[1];
let runs = Array.isArray(stored.runs) ? stored.runs.filter(r => r && CRAFT.some(c => c.id === r.craft) && LEVELS.some(d => d.id === r.level) && Number.isFinite(r.score) && r.score >= 0 && ['win', 'loss'].includes(r.outcome)).slice(0, 12) : [];
const best = Object.fromEntries(LEVELS.map(d => [d.id, Math.max(0, Number(stored.best?.[d.id]) || 0, ...runs.filter(r => r.level === d.id).map(r => r.score))]));
const sound = new Synth(stored.sound !== false);
const dialog = el('dialog'), canvas = el('space'), keys = new Set();
const view = new SpaceView(canvas);
const moveCodes = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);
const integer = n => Math.round(n).toLocaleString('ko-KR');
const timeLabel = s => Math.floor(s / 60) + '분 ' + Math.floor(s % 60) + '초';
let mode = 'hangar', panel = '', mission = null, drag = null, pointerTarget = null, animation = 0, lastFrame = 0, accumulator = 0;
let bannerUntil = 0, endingTime = 0, hudAt = -1, previousFocus = null;

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({craft: craft.id, level: level.id, sound: sound.enabled, runs, best}));
  } catch { /* Storage can be unavailable in private browsing. */ }
}
function selectSound() {
  sound.unlock();
  sound.play('select');
}
function updateSound() {
  const label = sound.enabled ? '음소거' : '소리 켜기';
  el('sound').innerHTML = icon(sound.enabled ? 'audio' : 'mute');
  el('sound').setAttribute('aria-label', label);
  el('sound').title = label;
  el('sound').setAttribute('aria-pressed', String(sound.enabled));
}
function chooseCraft(id, audible = true) {
  craft = CRAFT.find(c => c.id === id) || CRAFT[0];
  if (audible) selectSound();
  const index = CRAFT.indexOf(craft);
  el('hero-image').src = './flight/art/' + craft.id + '.webp';
  el('hero-code').replaceChildren(document.createTextNode(craft.code + ' '), Object.assign(document.createElement('span'), {textContent: '/'}), document.createTextNode(' ' + craft.role));
  el('hero-name').textContent = craft.call;
  el('hero-copy').textContent = craft.summary;
  el('setup-shield').textContent = String(craft.shield);
  el('setup-speed').textContent = craft.handling;
  el('showcase').style.setProperty('--accent', craft.tag);
  el('fleet-current').textContent = String(index + 1).padStart(2, '0');
  for (const b of el('fleet-options').children) {
    const active = b.dataset.id === id;
    b.classList.toggle('picked', active);
    b.setAttribute('aria-pressed', String(active));
  }
  save();
}
function chooseLevel(id, audible = true) {
  level = LEVELS.find(d => d.id === id) || LEVELS[1];
  if (audible) selectSound();
  el('difficulty-options').querySelector('input[value="' + level.id + '"]').checked = true;
  el('difficulty-note').textContent = level.note;
  save();
}
function createSelectors() {
  for (const c of CRAFT) {
    const b = document.createElement('button');
    b.className = 'craft';
    b.type = 'button';
    b.dataset.id = c.id;
    b.setAttribute('aria-label', c.name + ' 선택, ' + c.role + ', ' + c.weapon + ', 보호막 ' + c.shield);
    b.innerHTML = '<span class="craft-art"><img src="./flight/art/' + c.id + '.webp" alt=""></span><span class="craft-info"><span class="craft-code">' + c.code + '</span><strong class="craft-name">' + c.name + '</strong><span class="craft-role">' + c.role.split(' ')[0] + ' · ' + c.weapon + '</span></span><span class="craft-status">' + icon('check') + '</span>';
    b.addEventListener('click', () => chooseCraft(c.id));
    el('fleet-options').append(b);
  }
  for (const d of LEVELS) {
    const label = document.createElement('label'), input = document.createElement('input'), span = document.createElement('span');
    input.type = 'radio';
    input.name = 'difficulty';
    input.value = d.id;
    input.addEventListener('change', () => chooseLevel(d.id));
    span.textContent = d.name;
    label.append(input, span);
    el('difficulty-options').append(label);
  }
  chooseCraft(craft.id, false);
  chooseLevel(level.id, false);
  updateSound();
}

function showDialog(id, title, html, buttons, closeVisible=true) {
  if (!dialog.open) previousFocus = document.activeElement;
  panel = id;
  el('dialog-title').textContent = title;
  el('dialog-content').innerHTML = html;
  if (buttons.length) {
    const actions = document.createElement('div');
    actions.className = 'dialog-actions';
    for (const [label, action, primary] of buttons) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.className = primary ? 'action-primary' : 'action-secondary';
      b.addEventListener('click', action);
      actions.append(b);
    }
    el('dialog-content').append(actions);
  }
  el('dialog-close').hidden = !closeVisible;
  if (!dialog.open) dialog.showModal();
  (dialog.querySelector('.action-primary') || el('dialog-close')).focus({preventScroll: true});
}
function hideDialog() {
  if (dialog.open) dialog.close();
  panel = '';
}
function closePanel() {
  if (panel === 'pause') {
    resume();
    return;
  }
  if (panel === 'result') {
    hangar();
    return;
  }
  hideDialog();
  if (previousFocus instanceof HTMLElement) previousFocus.focus({preventScroll: true});
}
function rows(items) {
  return '<dl class="info-list">' + items.map(([a, b]) => '<div><dt>' + a + '</dt><dd>' + b + '</dd></div>').join('') + '</dl>';
}
function help() {
  showDialog('help', '비행 조작법', rows([['기체 이동', '방향키 / WASD'], ['마우스 · 터치', '화면을 누른 채 드래그'], ['기본 사격', '자동 발사'], ['충격파', 'Space / 화면의 충격파 버튼'], ['일시정지', 'Esc / P']]) +
    '<p class="dialog-note">조준점을 적기에 맞추면 사격이 보정됩니다. 충격파는 적탄을 지우고 주변 적기를 타격하며, 7초 뒤 다시 쓸 수 있습니다. 청록색 십자 보급품으로 보호막을 회복하세요.</p>', [['확인', closePanel, true]]);
}
function records() {
  const recordRows = runs.slice(0, 5).map(r => '<div class="record-row"><div>' + CRAFT.find(c => c.id === r.craft).name + ' <span>· ' + LEVELS.find(d => d.id === r.level).name + ' · ' + (r.outcome === 'win' ? '돌파' : '격추') + '</span></div><strong>' + integer(r.score) + '</strong></div>').join('');
  const html = rows(LEVELS.map(d => [d.name + ' 최고 점수', runs.some(r => r.level === d.id) || best[d.id] > 0 ? integer(best[d.id]) + '점' : '—'])) + '<h3 class="record-title">최근 비행</h3>' + (recordRows || '<p>첫 임무를 마치면 이 기기에 비행 기록이 저장됩니다.</p>');
  showDialog('records', '비행 기록', html, [['확인', closePanel, true]]);
}

function clearInput() {
  keys.clear();
  if (drag && canvas.hasPointerCapture?.(drag.id)) canvas.releasePointerCapture(drag.id);
  drag = null;
  pointerTarget = null;
}
function start() {
  hideDialog();
  clearInput();
  cancelAnimationFrame(animation);
  sound.unlock();
  sound.play('launch');
  mission = new Mission(craft.id, level.id);
  mode = 'playing';
  accumulator = 0;
  lastFrame = 0;
  hudAt = -1;
  endingTime = 0;
  el('hangar').hidden = true;
  el('flight').hidden = false;
  document.body.classList.add('flying');
  el('flight-craft').textContent = craft.call;
  el('boss-hud').hidden = true;
  el('message').replaceChildren();
  canvas.tabIndex = -1;
  canvas.focus({preventScroll: true});
  drainEvents();
  drawHUD();
  view.render(mission);
  animation = requestAnimationFrame(frame);
}
function hangar() {
  hideDialog();
  cancelAnimationFrame(animation);
  clearInput();
  mode = 'hangar';
  mission = null;
  el('flight').hidden = true;
  el('hangar').hidden = false;
  document.body.classList.remove('flying');
  el('launch').focus({preventScroll: true});
}
function pause() {
  if (mode !== 'playing') return;
  mode = 'paused';
  cancelAnimationFrame(animation);
  clearInput();
  sound.play('select');
  showDialog('pause', '일시정지', '<p>' + craft.name + ' · ' + level.name + ' · ' + SECTORS[mission.sector] + '</p>',
    [['비행 계속', resume, true], ['격납고로 나가기', hangar, false]]);
}
function resume() {
  if (mode !== 'paused') return;
  hideDialog();
  clearInput();
  sound.unlock();
  mode = 'playing';
  lastFrame = 0;
  accumulator = 0;
  canvas.focus({preventScroll: true});
  animation = requestAnimationFrame(frame);
}
function finish() {
  if (mode !== 'ending') return;
  mode = 'finished';
  clearInput();
  const m = mission;
  const record = {craft: craft.id, level: level.id, score: m.score, outcome: m.outcome};
  runs = [record, ...runs].slice(0, 12);
  best[level.id] = Math.max(best[level.id], record.score);
  save();
  sound.play(m.outcome);
  const title = m.outcome === 'win' ? '궤도 돌파 성공' : '기체 격추';
  const html = '<p class="result-score">' + integer(m.score) + ' <small style="font:600 15px var(--body)">점</small></p>' + rows([['기체 · 난이도', craft.name + ' · ' + level.name], ['도달 구역', SECTORS[m.sector]], ['격추한 적기', m.kills + '대'], ['비행 시간', timeLabel(m.elapsed)], ['이 난이도 최고 기록', integer(best[level.id]) + '점']]);
  showDialog('result', title, html, [['같은 기체로 재출격', start, true], ['격납고로', hangar, false]], false);
}
function usePulse() {
  if (mode === 'playing' && mission.pulse()) {
    drainEvents();
    drawHUD();
  }
}
function announce(kicker, text, seconds) {
  const msg = el('message'), small = document.createElement('small');
  small.textContent = kicker;
  msg.replaceChildren(small, document.createTextNode(text));
  msg.style.opacity = '1';
  bannerUntil = mission.elapsed + seconds;
}
function drainEvents() {
  for (const e of mission.events) {
    switch (e.type) {
      case 'sector':
      el('sector-number').textContent = 'SECTOR 0' + (e.index + 1) + ' / 03';
      el('sector-name').textContent = SECTORS[e.index];
      announce('SECTOR 0' + (e.index + 1), SECTORS[e.index], 1.75);
      break;
      case 'boss':
      announce('WARNING', '궤도 수호기 접근', 2);
      sound.play('boss');
      break;
      case 'repair':
      if (mission.elapsed > bannerUntil) announce('REPAIR', '보급품 회수', .9);
      sound.play('repair');
      break;
      case 'bossKill':
      sound.play('kill');
      break;
      default:
      sound.play(e.type);
    }
  }
  mission.events.length = 0;
}
function drawHUD() {
  const m = mission, p = m.player, fraction = clamp(p.hp / craft.shield, 0, 1);
  el('score').textContent = String(m.score).padStart(6, '0');
  el('shield-value').textContent = Math.ceil(fraction * 100) + '%';
  el('shield-fill').style.transform = 'scaleX(' + fraction + ')';
  el('shield-fill').style.background = fraction < .3 ? '#ff856a' : '#81dece';
  el('pulse').disabled = m.pulseClock > 0;
  el('pulse-status').textContent = m.pulseClock > 0 ? Math.ceil(m.pulseClock) + '초 후 충전' : '사용 가능';
  const boss = m.boss;
  el('boss-hud').hidden = !boss;
  if (boss) el('boss-fill').style.transform = 'scaleX(' + clamp(boss.hp / boss.maxHp, 0, 1) + ')';
  if (m.elapsed > bannerUntil) el('message').style.opacity = '0';
}
function keyboardInput() {
  const pressed = (a, b) => keys.has(a) || keys.has(b) ? 1 : 0;
  const dx = pressed('ArrowRight', 'KeyD') - pressed('ArrowLeft', 'KeyA');
  const dy = pressed('ArrowDown', 'KeyS') - pressed('ArrowUp', 'KeyW');
  if (dx || dy) pointerTarget = null;
  return { dx, dy, target: pointerTarget};
}
function frame(now) {
  if (mode !== 'playing' && mode !== 'ending') return;
  const dt = lastFrame ? Math.min(.1, (now - lastFrame) / 1000) : 0;
  lastFrame = now;
  if (mode === 'ending') {
    endingTime += dt;
    for (const fx of mission.particles) {
      fx.x += fx.vx * dt;
      fx.y += fx.vy * dt;
      fx.life = Math.max(0, fx.life - dt);
    }
    mission.ripple = Math.max(0, mission.ripple - dt);
    mission.shake = Math.max(0, mission.shake - dt);
    if (endingTime >= .58) {
      finish();
      return;
    }
  } else {
    accumulator += dt;
    const input = keyboardInput();
    while (accumulator >= 1 / 60 && !mission.outcome) {
      mission.step(1 / 60, input);
      accumulator -= 1 / 60;
    }
    drainEvents();
    if (mission.elapsed - hudAt >= .07 || mission.outcome) {
      drawHUD();
      hudAt = mission.elapsed;
    }
    if (mission.outcome) {
      mode = 'ending';
      endingTime = 0;
      clearInput();
    }
  }
  view.render(mission);
  animation = requestAnimationFrame(frame);
}

canvas.addEventListener('pointerdown', event => {
    if (mode !== 'playing' || drag || event.button !== 0) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    canvas.focus({preventScroll: true});
    pointerTarget = {x: mission.player.x, y: mission.player.y};
    drag = {id: event.pointerId, clientX: event.clientX, clientY: event.clientY, originX: mission.player.x, originY: mission.player.y};
});
canvas.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id || mode !== 'playing') return;
    pointerTarget = {
      x: clamp(drag.originX + (event.clientX - drag.clientX) / (view.w * .36), -1.02, 1.02),
      y: clamp(drag.originY + (event.clientY - drag.clientY) / (view.h * .31), -1.2, .64)
    };
});
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(eventName, event => {
      if (drag?.id !== event.pointerId) return;
      if (eventName === 'pointercancel') pointerTarget = null;
      drag = null;
  });
}
document.addEventListener('keydown', event => {
    if (dialog.open) {
      if (panel === 'pause' && event.code === 'KeyP' && !event.repeat) {
        event.preventDefault();
        resume();
      }
      return;
    }
    if (mode !== 'playing') return;
    if (moveCodes.has(event.code)) {
      event.preventDefault();
      keys.add(event.code);
      return;
    }
    if (event.code === 'Escape' || event.code === 'KeyP') {
      event.preventDefault();
      if (!event.repeat) pause();
    }
    if (event.code === 'Space' && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      if (!event.repeat) usePulse();
    }
});
document.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => {if (document.hidden) pause();});
window.addEventListener('resize', () => {if (mode === 'paused') view.render(mission);});
el('launch').addEventListener('click', start);el('pause').addEventListener('click', pause);el('pulse').addEventListener('click', () => {
    usePulse();
    if (mode === 'playing') canvas.focus({preventScroll: true});
});
el('help-open').addEventListener('click', help);el('records-open').addEventListener('click', records);
el('sound').addEventListener('click', () => {
    sound.enabled = !sound.enabled;
    updateSound();
    if (sound.enabled) selectSound();
    save();
});
el('dialog-close').addEventListener('click', closePanel);
dialog.addEventListener('cancel', event => {
    event.preventDefault();
    closePanel();
});
createSelectors();
