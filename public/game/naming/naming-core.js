export const TOPIC_LIMIT = 40;
export const NAME_LIMIT = 24;

export function cleanTopic(value) {
  return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, TOPIC_LIMIT);
}

export function cleanName(value) {
  return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, NAME_LIMIT);
}

export function normalizeName(value) {
  return cleanName(value).toLocaleLowerCase('ko-KR').replace(/[^\p{L}\p{N}]/gu, '');
}

export function orderedPlayers(players = []) {
  return [...players].sort((a, b) => (
    Number(a.joinOrder || 0) - Number(b.joinOrder || 0)
    || String(a.uid || '').localeCompare(String(b.uid || ''))
  ));
}

export function activePlayers(players = []) {
  return orderedPlayers(players).filter(player => player.eliminated !== true);
}

export function annotateEntries(entries = []) {
  const seen = new Set();
  return [...entries]
    .sort((a, b) => Number(a.turn || 0) - Number(b.turn || 0) || String(a.id || '').localeCompare(String(b.id || '')))
    .map(entry => {
      if (entry.kind !== 'name') return { ...entry, accepted: false, duplicate: false };
      const normalized = normalizeName(entry.normalized || entry.text);
      const duplicate = !normalized || seen.has(normalized);
      if (!duplicate) seen.add(normalized);
      return { ...entry, normalized, accepted: !duplicate, duplicate };
    });
}

export function isDuplicateName(entries, value) {
  const normalized = normalizeName(value);
  if (!normalized) return true;
  return annotateEntries(entries).some(entry => entry.accepted && entry.normalized === normalized);
}

export function nextActiveUid(players, currentUid, eliminateCurrent = false) {
  const ordered = orderedPlayers(players);
  if (!ordered.length) return '';
  const currentIndex = Math.max(0, ordered.findIndex(player => player.uid === currentUid));
  for (let offset = 1; offset <= ordered.length; offset += 1) {
    const candidate = ordered[(currentIndex + offset) % ordered.length];
    if (candidate.eliminated === true) continue;
    if (eliminateCurrent && candidate.uid === currentUid) continue;
    return candidate.uid || '';
  }
  return eliminateCurrent ? '' : currentUid;
}

export function evaluateTurn({ players = [], entries = [], currentUid = '', kind = 'name', text = '' } = {}) {
  const duplicate = kind === 'name' && isDuplicateName(entries, text);
  const accepted = kind === 'name' && !duplicate;
  const eliminated = !accepted;
  const after = orderedPlayers(players).map(player => (
    player.uid === currentUid && eliminated ? { ...player, eliminated: true } : { ...player }
  ));
  const active = activePlayers(after);
  const finished = active.length <= 1;
  return {
    accepted,
    duplicate,
    eliminated,
    activeCount: active.length,
    finished,
    winnerUid: finished ? active[0]?.uid || '' : '',
    nextUid: finished ? '' : nextActiveUid(after, currentUid, eliminated)
  };
}
