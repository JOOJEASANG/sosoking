export const TITLE = '물결우체국';
export const ROUND_LIMIT = 8;
export const TEAMS = [
  { name: '산호', color: '#cc6248', light: '#f3c1aa' },
  { name: '청록', color: '#277d78', light: '#b3dcd0' },
  { name: '제비꽃', color: '#8065a6', light: '#d7c7e7' },
  { name: '호박', color: '#ae802c', light: '#f4d891' }
];

const port = (name, theme) => ({name, theme, kind: 'port'});
export const TILES = [
  { name: '출항 우체국', kind: 'start', theme: 'post' },
  port('귤빛 부두','orange'), port('조개 공방','shell'), port('산호 서점','book'),
  { name: '우표 창고', kind: 'stock', theme: 'stamp' },
  port('솔바람 숲','pine'), port('꽃등 정원','flower'), port('백사장 찻집','tea'),
  { name: '순풍 등대', kind: 'wind', theme: 'light' },
  port('하늘 유리방','glass'), port('해달 시장','market'), port('라일락 만','lilac'),
  { name: '병편지 곶', kind: 'bottle', theme: 'bottle' },
  port('노을 빵집','bread'), port('파도 다방','cafe'), port('별모래 항','star')
];

export const OFFER = {
  build: {label:'우체국 세우기', cost:4, stars:2},
  upgrade: {label:'등대 우체국으로 증축', cost:3, stars:2}
};
export const TILE_RULE = {
  port:'빈 섬에 우표 4장으로 우체국을 세울 수 있어요.',
  start:'이 칸을 지나거나 도착하면 우표 2장을 받아요.',
  stock:'도착하면 우표 3장을 받아요.',
  wind:'특급권을 1장 충전해요. 이미 2장이면 우표 2장을 받아요.',
  bottle:'도착하면 표류한 병편지를 열어 선물을 받아요.'
};

export function tide(round) { return Math.floor((round - 1) / 2) % 2 === 0 ? 1 : -1; }
export function route(pos, steps, direction) {
  return Array.from({length:steps}, (_, i) => (pos + direction * (i + 1) + 32) % 16);
}
export function captain(g) { return g.players[g.active]; }
export function points(p) { return p.stars + Math.floor(p.stamps / 3); }
export function ranking(g) {
  return g.players.slice().sort((a,b) => Number(a.out) - Number(b.out) || points(b) - points(a) || a.seat - b.seat);
}
export function winners(g) {
  const ranks = ranking(g).filter(p => !p.out);
  return ranks.filter(p => points(p) === points(ranks[0])).map(p => p.id);
}
const end = path => path[path.length - 1];
const d6 = random => 1 + Math.floor(random() * 6);
function note(g, text) {
  g.log.unshift({id:++g.serial, text});
  if (g.log.length > 14) g.log.pop();
}

export function newGame(members) {
  if (members.length < 2 || members.length > 4) throw Error('선장 2~4명이 필요해요.');
  const players = members.map(m => ({
    id:m.id, name:m.name, seat:m.seat, pos:0, stamps:8, stars:0, express:2,
    destination:3, delivered:0, out:false
  }));
  const g = {players, round:1, active:0, phase:'roll', dice:[], offices:{},
    offer:null, move:null, turn:1, serial:0, log:[], finishReason:null};
  note(g, '첫 편지의 목적지는 산호 서점입니다.');
  return g;
}

function nextLetter(g, p, random) {
  const candidates = route(p.pos, 9, tide(g.round)).slice(2).filter(i => TILES[i].kind === 'port');
  return candidates[Math.floor(random() * candidates.length)];
}

export function options(g) {
  if (g.phase !== 'choose') return [];
  const p = captain(g);
  const faces = [{id:'a',steps:g.dice[0]}];
  if (g.dice[0] !== g.dice[1]) faces.push({id:'b',steps:g.dice[1]});
  if (p.express > 0) faces.push({id:'express',steps:g.dice[0] + g.dice[1]});
  return faces.map(face => {
    const path = route(p.pos, face.steps, tide(g.round));
    return {...face, path, to:end(path), delivery:path.includes(p.destination)};
  });
}
function finish(g, reason) {
  g.phase = 'finished'; g.offer = null; g.finishReason = reason;
  note(g, reason === 'last' ? '마지막 선장이 항해를 마쳤습니다.' : '여덟 번째 라운드의 배달을 마쳤습니다.');
}
function nextTurn(g) {
  const oldActive = g.active;
  let next = (oldActive + 1) % g.players.length;
  while (g.players[next].out) next = (next + 1) % g.players.length;
  if (next <= oldActive) {
    if (g.round === ROUND_LIMIT) { finish(g,'rounds'); return; }
    g.round++;
    if (g.round % 2 === 1) note(g, '물때가 바뀌어 항로가 반대로 돕니다.');
  }
  g.active = next; g.turn++; g.phase = 'roll'; g.offer = null; g.dice = [];
}
function land(g, p, random) {
  const tile = TILES[p.pos], office = g.offices[p.pos];
  if (tile.kind === 'port') {
    if (office && office.owner !== p.id) {
      const owner = g.players.find(q => q.id === office.owner);
      const fee = Math.min(p.stamps, office.level);
      p.stamps -= fee; owner.stamps += fee;
      if (fee) note(g, p.name + ' → ' + owner.name + ' · 우편 이용료 ' + fee + '장');
    } else {
      const type = !office ? 'build' : office.level === 1 ? 'upgrade' : null;
      if (type && p.stamps >= OFFER[type].cost) {
        g.phase = 'office'; g.offer = type; return;
      }
    }
  }
  if (tile.kind === 'stock') {
    p.stamps += 3; note(g,p.name + ' · 창고에서 우표 3장 수령');
  } else if (tile.kind === 'wind') {
    if (p.express < 2) { p.express++; note(g,p.name + ' · 특급권 1장 충전'); }
    else { p.stamps += 2; note(g,p.name + ' · 순풍 보너스 우표 2장'); }
  } else if (tile.kind === 'bottle') {
    const gift = Math.floor(random() * 3);
    if (gift === 0) { p.stamps += 3; note(g,'병편지 선물 · '+p.name+'에게 우표 3장'); }
    else if (gift === 1) { p.stars += 2; note(g,'병편지 선물 · '+p.name+'에게 별도장 2개'); }
    else { p.stars++; p.stamps += 2; note(g,'병편지 선물 · '+p.name+'에게 별도장 1개와 우표 2장'); }
  }
  nextTurn(g);
}

export function play(g, id, action, random = Math.random) {
  const p = captain(g);
  if (g.phase === 'finished' || p.id !== id || p.out) throw Error('지금은 내 차례가 아니에요.');
  if (action.type === 'roll' && g.phase === 'roll') {
    g.dice = [d6(random), d6(random)]; g.phase = 'choose'; return;
  }
  if (action.type === 'sail' && g.phase === 'choose') {
    const choice = options(g).find(o => o.id === action.choice);
    if (!choice) throw Error('선택할 수 없는 항로예요.');
    if (choice.id === 'express') p.express--;
    g.move = {turn:g.turn, player:p.id, from:p.pos, path:choice.path, delivery:choice.delivery};
    p.pos = choice.to;
    note(g,p.name + ' · ' + TILES[p.pos].name + ' 도착');
    if (choice.path.includes(0)) { p.stamps += 2; note(g,'출항 우체국 통과 · '+p.name+' 우표 2장'); }
    if (choice.delivery) {
      p.delivered++; p.stars += 4; p.stamps += 3;
      note(g,p.name + ' · ' + TILES[p.destination].name + ' 배달! 별도장 4개와 우표 3장');
      p.destination = nextLetter(g,p,random);
    }
    land(g,p,random); return;
  }
  if ((action.type === 'build' || action.type === 'pass') && g.phase === 'office') {
    if (action.type === 'build') {
      const offer = OFFER[g.offer];
      if (p.stamps < offer.cost) throw Error('우표가 부족해요.');
      p.stamps -= offer.cost; p.stars += offer.stars;
      g.offices[p.pos] = {owner:p.id, level:g.offer === 'upgrade' ? 2 : 1};
      note(g,p.name+' · '+TILES[p.pos].name+' '+(g.offer === 'upgrade'?'등대 우체국 증축':'우체국 개설'));
    }
    nextTurn(g); return;
  }
  throw Error('현재 단계에서 할 수 없는 행동이에요.');
}

export function retire(g,id) {
  const p = g.players.find(q => q.id === id);
  if (!p || p.out || g.phase === 'finished') return;
  p.out = true;
  for (const [key,office] of Object.entries(g.offices)) if (office.owner === id) delete g.offices[key];
  note(g,p.name+' 선장이 항해에서 내렸습니다.');
  if (g.players.filter(q => !q.out).length <= 1) finish(g,'last');
  else if (captain(g).id === id) nextTurn(g);
}

export function pilotAction(g) {
  if (g.phase === 'roll') return {type:'roll'};
  if (g.phase === 'office') return {type:'build'};
  const p = captain(g);
  function weight(o) {
    const t = TILES[o.to], off = g.offices[o.to];
    const distance = route(o.to,16,tide(g.round)).indexOf(p.destination) + 1;
    return (o.delivery ? 12 : -distance*.22) + (o.path.includes(0)?1.4:0)
      + (t.kind === 'port' ? !off ? 2.2 : off.owner === p.id ? .8 : -1.2*off.level : 1)
      - (o.id === 'express' ? g.round < 7 ? 2.7 : .5 : 0);
  }
  const best = options(g).sort((a,b) => weight(b) - weight(a))[0];
  return {type:'sail',choice:best.id};
}

export function finishAutoTurn(g, random) {
  const turn = g.turn, id = captain(g).id;
  for (let step=0; step<3 && g.turn===turn && g.phase!=='finished'; step++) play(g,id,pilotAction(g),random);
}
