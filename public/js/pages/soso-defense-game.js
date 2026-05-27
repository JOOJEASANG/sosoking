import { setMeta } from '../utils/seo.js';

const TYPES = ['fire', 'water', 'leaf', 'bolt', 'stone'];
const ICON = { fire: '🔥', water: '💧', leaf: '🌿', bolt: '⚡', stone: '🧱' };
const SIZE = 5;
let game;

function pick() {
  return TYPES[Math.floor(Math.random() * TYPES.length)];
}

function freshBoard() {
  return Array.from({ length: SIZE * SIZE }, pick);
}

function reset() {
  game = {
    mode: 'coop',
    wave: 1,
    hp: 20,
    score: 0,
    enemy: 20,
    selected: null,
    board: freshBoard(),
    resource: { fire: 0, water: 0, leaf: 0, bolt: 0, stone: 0 },
    defense: { tower: 1, wall: 2 },
    log: ['퍼즐을 맞춰 자원을 얻고, 타워/성벽/스킬로 웨이브를 막으세요.'],
  };
}

function addLog(text) {
  game.log.unshift(text);
  game.log = game.log.slice(0, 5);
}

function adjacent(a, b) {
  const ax = a % SIZE;
  const ay = Math.floor(a / SIZE);
  const bx = b % SIZE;
  const by = Math.floor(b / SIZE);
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}

function swap(a, b) {
  [game.board[a], game.board[b]] = [game.board[b], game.board[a]];
}

function findMatches() {
  const matched = new Set();
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE - 2; x += 1) {
      const i = y * SIZE + x;
      if (game.board[i] === game.board[i + 1] && game.board[i] === game.board[i + 2]) {
        matched.add(i); matched.add(i + 1); matched.add(i + 2);
      }
    }
  }
  for (let x = 0; x < SIZE; x += 1) {
    for (let y = 0; y < SIZE - 2; y += 1) {
      const i = y * SIZE + x;
      if (game.board[i] === game.board[i + SIZE] && game.board[i] === game.board[i + SIZE * 2]) {
        matched.add(i); matched.add(i + SIZE); matched.add(i + SIZE * 2);
      }
    }
  }
  return [...matched];
}

function modeName() {
  return game.mode === 'duel' ? '1:1 대전' : game.mode === 'team' ? '팀전' : '협동전';
}

function enemySpeed() {
  return game.mode === 'duel' ? 12 : game.mode === 'team' ? 9 : 7;
}

function resolveTurn(match) {
  if (!match.length) return false;
  const gained = {};
  match.forEach(i => {
    const type = game.board[i];
    game.resource[type] += 1;
    gained[type] = (gained[type] || 0) + 1;
    game.board[i] = pick();
  });
  const attack = (gained.fire || 0) * 3 + game.defense.tower * 2;
  game.enemy = Math.max(0, game.enemy + enemySpeed() - attack - game.defense.wall);
  game.score += match.length * 10 + attack * 3;
  if (game.enemy <= 0) {
    game.wave += 1;
    game.enemy = 18 + game.wave * 6;
    game.resource.bolt += game.mode === 'duel' ? 2 : 1;
    addLog(`${game.wave} 웨이브 시작! ${modeName()} 보너스가 적용됐습니다.`);
  } else if (game.enemy >= 100) {
    game.hp = Math.max(0, game.hp - 4);
    game.enemy = 35;
    addLog('적이 방어선을 돌파했습니다. 본진 체력 -4');
  } else {
    addLog(`조합 성공: ${match.length}칸 제거 · 적 진입 ${Math.round(game.enemy)}%`);
  }
  return true;
}

function spend(cost) {
  if (Object.entries(cost).some(([k, v]) => game.resource[k] < v)) return false;
  Object.entries(cost).forEach(([k, v]) => { game.resource[k] -= v; });
  return true;
}

function action(type) {
  if (type === 'tower') {
    if (!spend({ leaf: 3, stone: 2, bolt: 1 })) return addLog('타워는 🌿3 🧱2 ⚡1 이 필요합니다.'), draw();
    game.defense.tower += 1; game.score += 60; addLog('공격 타워를 추가했습니다.');
  }
  if (type === 'wall') {
    if (!spend({ leaf: 2, stone: 3, water: 1 })) return addLog('성벽은 🌿2 🧱3 💧1 이 필요합니다.'), draw();
    game.defense.wall += 2; game.score += 40; addLog('성벽을 강화했습니다.');
  }
  if (type === 'skill') {
    if (!spend({ fire: 3, bolt: 3 })) return addLog('스킬은 🔥3 ⚡3 이 필요합니다.'), draw();
    game.enemy = Math.max(0, game.enemy - 35); game.score += 90; addLog('연쇄 폭발로 적을 크게 밀어냈습니다.');
  }
  draw();
}

function tile(index) {
  if (game.hp <= 0) return;
  if (game.selected === null) { game.selected = index; return draw(); }
  if (!adjacent(game.selected, index)) { game.selected = index; return draw(); }
  const prev = game.selected;
  swap(prev, index);
  game.selected = null;
  if (!resolveTurn(findMatches())) {
    swap(prev, index);
    addLog('3개 이상 연결되지 않았습니다. 다른 칸을 선택하세요.');
  }
  draw();
}

function ensureStyle() {
  if (document.getElementById('soso-defense-lite-style')) return;
  const style = document.createElement('style');
  style.id = 'soso-defense-lite-style';
  style.textContent = `.sd{min-height:100vh;padding:18px;background:linear-gradient(135deg,#fff7ed,#eef6ff);font-family:'Noto Sans KR',system-ui,sans-serif;color:#172033}.sd-wrap{max-width:1080px;margin:0 auto}.sd-hero{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.sd h1{font-size:clamp(30px,7vw,58px);line-height:1;margin:8px 0;font-weight:1000;letter-spacing:-.06em}.sd p{color:#526174;line-height:1.65;font-weight:700}.sd-back,.sd-mode,.sd-btn{border:0;border-radius:16px;padding:11px 13px;font-weight:900;cursor:pointer}.sd-back{background:#fff;box-shadow:0 8px 22px #0001}.sd-mode{background:#fff;color:#334155}.sd-mode.on,.sd-btn{background:#ff6b4a;color:white}.sd-modes,.sd-actions{display:flex;flex-wrap:wrap;gap:8px}.sd-grid{display:grid;grid-template-columns:380px 1fr;gap:14px;margin-top:14px}.sd-card{background:#ffffffcc;border:1px solid #00000012;border-radius:24px;padding:14px;box-shadow:0 14px 36px #0f172a14}.sd-board{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.sd-tile{aspect-ratio:1;border:0;border-radius:18px;background:linear-gradient(#fff,#f1f5f9);font-size:34px;box-shadow:inset 0 -4px 0 #0001,0 8px 18px #0001}.sd-tile.on{outline:4px solid #ff6b4a}.sd-res,.sd-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:10px}.sd-pill,.sd-stat{background:#f8fafc;border-radius:16px;padding:10px;text-align:center;font-weight:1000}.sd-stats{grid-template-columns:repeat(4,1fr)}.sd-bar{height:18px;background:#e2e8f0;border-radius:999px;overflow:hidden}.sd-fill{height:100%;background:linear-gradient(90deg,#38bdf8,#ff6b4a)}.sd-log{padding:0;margin:10px 0 0;list-style:none;display:grid;gap:8px}.sd-log li{background:#f8fafc;border-radius:14px;padding:9px 11px;color:#475569;font-size:13px;font-weight:800}@media(max-width:800px){.sd{padding:12px}.sd-hero{display:block}.sd-back{margin-top:8px}.sd-grid{grid-template-columns:1fr}.sd-stats{grid-template-columns:repeat(2,1fr)}}`;
  document.head.appendChild(style);
}

function draw() {
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<section class="sd"><div class="sd-wrap">
    <div class="sd-hero"><div><b>🧩 퍼즐 × 보드게임 × 디펜스</b><h1>소소 디펜스 랩</h1><p>퍼즐로 자원을 만들고, 타워·성벽·스킬을 골라 웨이브를 막는 종합게임 초안입니다. 협동/1:1/팀전 버튼으로 기본 밸런스가 바뀝니다.</p><div class="sd-modes">${['coop','duel','team'].map(m => `<button class="sd-mode ${game.mode === m ? 'on' : ''}" data-mode="${m}">${m === 'coop' ? '🤝 협동' : m === 'duel' ? '⚔️ 1:1' : '🏳️ 팀전'}</button>`).join('')}</div></div><button class="sd-back" data-back>← 게임 목록</button></div>
    <div class="sd-stats"><div class="sd-stat">HP ${game.hp}/20</div><div class="sd-stat">${game.wave} 웨이브</div><div class="sd-stat">점수 ${game.score}</div><div class="sd-stat">타워 ${game.defense.tower} · 벽 ${game.defense.wall}</div></div>
    <div class="sd-grid"><article class="sd-card"><h2>자원 퍼즐판</h2><div class="sd-board">${game.board.map((t,i)=>`<button class="sd-tile ${game.selected===i?'on':''}" data-tile="${i}">${ICON[t]}</button>`).join('')}</div><div class="sd-res">${TYPES.map(t=>`<div class="sd-pill">${ICON[t]} ${game.resource[t]}</div>`).join('')}</div></article>
    <article class="sd-card"><h2>${modeName()} 방어선</h2><p>적 진입률 ${Math.round(game.enemy)}%</p><div class="sd-bar"><div class="sd-fill" style="width:${Math.min(100, game.enemy)}%"></div></div><div class="sd-actions" style="margin-top:14px"><button class="sd-btn" data-action="tower">타워 🌿3 🧱2 ⚡1</button><button class="sd-btn" data-action="wall">성벽 🌿2 🧱3 💧1</button><button class="sd-btn" data-action="skill">스킬 🔥3 ⚡3</button><button class="sd-btn" data-reset>다시 시작</button></div><ul class="sd-log">${game.log.map(x=>`<li>${x}</li>`).join('')}</ul></article></div>
  </div></section>`;
  el.querySelectorAll('[data-tile]').forEach(btn => btn.addEventListener('click', () => tile(Number(btn.dataset.tile))));
  el.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => { game.mode = btn.dataset.mode; addLog(`${modeName()} 모드로 전환했습니다.`); draw(); }));
  el.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', () => action(btn.dataset.action)));
  el.querySelector('[data-reset]')?.addEventListener('click', () => { reset(); draw(); });
  el.querySelector('[data-back]')?.addEventListener('click', () => { location.hash = '/sosoland'; });
}

export function renderSosoDefenseGame() {
  setMeta('소소 디펜스 랩');
  ensureStyle();
  reset();
  draw();
}
