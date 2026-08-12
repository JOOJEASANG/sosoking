const originalReplaceState = history.replaceState.bind(history);
let reloading = false;

history.replaceState = function replaceStateWithGameReconnect(state, unused, url) {
  const before = new URL(location.href);
  const result = originalReplaceState(state, unused, url);
  if (reloading || !url) return result;
  try {
    const after = new URL(String(url), location.href);
    const beforeRoom = before.searchParams.get('room') || '';
    const afterRoom = after.searchParams.get('room') || '';
    if (!beforeRoom && afterRoom) {
      reloading = true;
      setTimeout(() => location.reload(), 80);
    }
  } catch {}
  return result;
};
