const FRESHNESS_MS = Number(process.env.SHELLY_LOCAL_FRESHNESS_MS) || 30000;

const store = new Map();

export function updateShellyStatus(entries) {
  const now = Date.now();
  for (const entry of entries) {
    store.set(entry.shellyId, {
      online: entry.online ?? false,
      relays: entry.relays ?? [],
      updatedAt: now,
    });
  }
}

export function getShellyStatus(shellyId, maxAgeMs = FRESHNESS_MS) {
  const entry = store.get(shellyId);
  if (!entry) return null;
  if (Date.now() - entry.updatedAt >= maxAgeMs) return null;
  return { online: entry.online, relays: entry.relays };
}

export function markStale(shellyId) {
  const entry = store.get(shellyId);
  if (entry) {
    entry.updatedAt = 0;
  }
}

export function _reset() {
  store.clear();
}