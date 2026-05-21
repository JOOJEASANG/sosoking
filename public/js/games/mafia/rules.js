import { shuffle } from '../common.js';

export function roleLabel(role) {
  if (role === 'mafia') return '마피아';
  if (role === 'police') return '경찰';
  if (role === 'doctor') return '의사';
  return '시민';
}

export function roleGuide(role) {
  if (role === 'mafia') return '정체를 숨기고 시민처럼 행동하세요. 투표에서 살아남으면 유리합니다.';
  if (role === 'police') return '수사관 역할입니다. 채팅에서 논리적으로 의심 대상을 좁혀보세요.';
  if (role === 'doctor') return '보호자 역할입니다. 시민 편으로 토론을 이끌고 마피아를 찾아내세요.';
  return '시민입니다. 말투와 투표 흐름을 보고 마피아를 찾아내세요.';
}

export function alivePlayers(players) {
  return players.filter(p => p.alive !== false);
}

export function voteCounts(players) {
  const counts = {};
  players.forEach(p => {
    if (p.alive !== false && p.votedFor) counts[p.votedFor] = (counts[p.votedFor] || 0) + 1;
  });
  return counts;
}

export function assignRoles(players, mafiaCount) {
  if (players.length < 3) throw new Error('마피아게임은 최소 3명이 필요합니다.');
  const safeMafiaCount = Math.min(Number(mafiaCount || 1), Math.max(1, players.length - 2));
  const specialRoles = [];
  const remainingAfterMafia = players.length - safeMafiaCount;

  if (players.length >= 5 && remainingAfterMafia >= 2) specialRoles.push('police');
  if (players.length >= 6 && remainingAfterMafia >= 3) specialRoles.push('doctor');

  const citizenCount = players.length - safeMafiaCount - specialRoles.length;
  return shuffle([
    ...Array(safeMafiaCount).fill('mafia'),
    ...specialRoles,
    ...Array(citizenCount).fill('citizen'),
  ]);
}

export function topVoteTarget(players) {
  const counts = voteCounts(players);
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return { status: 'empty', targetUid: '', count: 0 };
  if (entries[1] && entries[0][1] === entries[1][1]) return { status: 'tie', targetUid: '', count: entries[0][1] };
  return { status: 'ok', targetUid: entries[0][0], count: entries[0][1] };
}

export function judgeAfterElimination(players, targetUid) {
  const nextPlayers = players.map(p => (
    p.uid === targetUid
      ? { ...p, alive: false, votedFor: '' }
      : { ...p, votedFor: '' }
  ));
  const mafiaAlive = nextPlayers.filter(p => p.alive !== false && p.assignedRole === 'mafia').length;
  const citizenSideAlive = nextPlayers.filter(p => p.alive !== false && p.assignedRole !== 'mafia').length;

  if (mafiaAlive === 0) return { status: 'ended', winner: 'citizen', nextPlayers };
  if (mafiaAlive >= citizenSideAlive) return { status: 'ended', winner: 'mafia', nextPlayers };
  return { status: 'playing', winner: '', nextPlayers };
}
