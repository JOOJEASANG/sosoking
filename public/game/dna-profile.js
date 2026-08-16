export const DNA_KEYS = ['bold', 'safe', 'unique', 'reader'];

export const DNA_TRAITS = {
  bold: {
    emoji: '🔥',
    label: '돌진형',
    short: '일단 간다',
    description: '큰 보상과 과감한 선택을 즐깁니다.',
    counter: 'safe'
  },
  safe: {
    emoji: '🛡️',
    label: '수비형',
    short: '확실하게 간다',
    description: '안전하고 계산된 선택을 선호합니다.',
    counter: 'bold'
  },
  unique: {
    emoji: '⚡',
    label: '단독형',
    short: '남들과 다르게',
    description: '겹치지 않는 자기만의 선택에 강합니다.',
    counter: 'reader'
  },
  reader: {
    emoji: '🔮',
    label: '독심형',
    short: '사람부터 읽는다',
    description: '친구들의 선택과 흐름을 잘 읽습니다.',
    counter: 'unique'
  }
};

function safeCount(value) {
  const number = Math.floor(Number(value || 0));
  return Number.isFinite(number) ? Math.max(0, Math.min(9999, number)) : 0;
}

export function emptyDna() {
  return { bold: 0, safe: 0, unique: 0, reader: 0, samples: 0 };
}

export function normalizeDna(value = {}) {
  const normalized = emptyDna();
  for (const key of DNA_KEYS) normalized[key] = safeCount(value?.[key]);
  normalized.samples = safeCount(value?.samples);
  return normalized;
}

export function addDna(current = {}, additions = {}) {
  const next = normalizeDna(current);
  for (const key of [...DNA_KEYS, 'samples']) {
    next[key] = safeCount(next[key] + safeCount(additions?.[key]));
  }
  return next;
}

function stableHash(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function dominantTrait(value = {}, seed = '') {
  const dna = normalizeDna(value);
  const offset = stableHash(seed);
  let best = DNA_KEYS[offset % DNA_KEYS.length];
  for (let index = 1; index < DNA_KEYS.length; index += 1) {
    const key = DNA_KEYS[(offset + index) % DNA_KEYS.length];
    if (dna[key] > dna[best]) best = key;
  }
  return best;
}

export function counterTrait(value = {}, seed = '') {
  return DNA_TRAITS[dominantTrait(value, seed)]?.counter || 'safe';
}

export function dnaTotal(value = {}) {
  const dna = normalizeDna(value);
  return DNA_KEYS.reduce((sum, key) => sum + dna[key], 0);
}
