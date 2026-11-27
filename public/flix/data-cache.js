// Public data only. Never put authentication tokens or viewer identities here.
export const CATALOG_CACHE = 'sosoking.flix.public-catalog.v1';
export const RECOMMENDATIONS_CACHE = 'sosoking.flix.recommendations.v1';
export const CATALOG_TTL = 5 * 60 * 1000;
export const RECOMMENDATIONS_TTL = 60 * 60 * 1000;
const inFlight = new Map();
const storage = () => { try { return globalThis.localStorage; } catch { return null; } };

export function cachedRecord(key, maxAge, { now = Date.now(), store = storage() } = {}) {
  try {
    const raw = store?.getItem(key);
    if (!raw || raw.length > 750000) return null;
    const row = JSON.parse(raw);
    if (row.version !== 1 || !Number.isFinite(row.checkedAt) || row.checkedAt > now || now - row.checkedAt >= maxAge) return null;
    return row;
  } catch { return null; }
}

export function cachePublicValue(key, value, { now = Date.now(), store = storage() } = {}) {
  try { store?.setItem(key, JSON.stringify({ version: 1, checkedAt: now, value })); } catch { /* Viewing works when storage is full or blocked. */ }
}

export function invalidatePublicData() {
  try { storage()?.removeItem(CATALOG_CACHE); storage()?.removeItem(RECOMMENDATIONS_CACHE); } catch {}
}

export function cachedRead(key, fetchValue, { ttl, force = false, validate = value => value, store = storage(), now = () => Date.now(), locks = globalThis.navigator?.locks } = {}) {
  if (inFlight.has(key)) return inFlight.get(key);
  const started = now();
  const read = async () => {
    const row = cachedRecord(key, ttl, { store, now: now() });
    // A forced refresh can share a refresh already completed by another tab.
    if (row && (!force || row.checkedAt > started)) {
      try { return validate(row.value); } catch { /* Invalid cache is replaced from the server. */ }
    }
    const value = validate(await fetchValue());
    // Publishing from an admin tab can update storage while this request is pending.
    const latest = cachedRecord(key, ttl, { store, now: now() });
    if (latest && latest.checkedAt > started) {
      try { return validate(latest.value); } catch {}
    }
    cachePublicValue(key, value, { store, now: now() });
    return value;
  };
  const pending = Promise.resolve().then(() => locks?.request ? locks.request(key, read) : read()).finally(() => inFlight.delete(key));
  inFlight.set(key, pending);
  return pending;
}
