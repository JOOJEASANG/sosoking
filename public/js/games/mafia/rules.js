import { shuffle } from '../common.js';

export function roleLabel(role) {
  return role === 'mafia' ? '마피아' : '시민';
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
  const safeMafiaCount = Math.min(Number(mafiaCount || 1), Math.max(1, players.length - 2));
  return shuffle([
    ...Array(safeMafiaCount).fill('mafia'),
    ...Array(players.length - safeMafiaCount).fill('citizen'),
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
  const citizenAlive = nextPlayers.filter(p => p.alive !== false && p.assignedRole !== 'mafia').length;

  if (mafiaAlive === 0) return { status: 'ended', winner: 'citizen', nextPlayers };
  if (mafiaAlive >= citizenAlive) return { status: 'ended', winner: 'mafia', nextPlayers };
  return { status: 'playing', winner: '', nextPlayers };
}
