'use strict';

const DNA_KEYS = ['bold', 'safe', 'unique', 'reader'];
const TRAIT_LABELS = { bold: '돌진형', safe: '수비형', unique: '단독형', reader: '독심형' };
const ALLOWED_EMOJIS = new Set(['🌀', '🪞', '🐲', '👾', '🧟', '🦹', '🤖']);

const FALLBACK_PACKS = [
  {
    bossName: '버릇수집왕 루프', bossEmoji: '🌀',
    intro: '반복한 선택을 모아 스스로 강해지는 괴물이다. 익숙한 버릇을 깨야만 이길 수 있다.',
    roundTitles: ['버릇 반전', '쌍둥이 균열', '외로운 한 방'],
    taunts: ['또 그 선택이지? 이미 다 외웠다!', '서로 따라 하면 내 보호막만 두꺼워진다.', '마지막까지 네 버릇을 지킬 수 있을까?'],
    victory: '오늘은 버릇보다 사람이 강했다. 다음 방에서는 전혀 다른 괴물이 태어날 것이다.',
    defeat: '괴물은 살아남았지만 약점은 들켰다. 한 판 더라면 결과는 달라진다.'
  },
  {
    bossName: '선택복제왕 미러킹', bossEmoji: '🪞',
    intro: '친구들의 익숙한 선택을 그대로 복제해 앞을 막는다. 평소와 다르게 움직여 거울을 깨뜨려라.',
    roundTitles: ['거울 뒤집기', '둘만의 금', '단독 파괴'],
    taunts: ['네 다음 버튼까지 거울에 비친다!', '같은 선택은 내가 가장 좋아하는 먹이다.', '혼자 달라질 용기가 남았나?'],
    victory: '예측할 수 없는 선택 앞에서 거울이 산산조각 났다.',
    defeat: '미러킹이 선택을 완전히 복사했다. 새로운 버릇으로 다시 도전하라.'
  },
  {
    bossName: '습관포식자 데자뷔', bossEmoji: '🐲',
    intro: '이미 본 장면을 계속 되풀이하게 만드는 포식자다. 반대 선택과 팀 호흡으로 반복을 끝내라.',
    roundTitles: ['반대의 첫발', '두 사람의 틈', '혼자의 반격'],
    taunts: ['이 장면, 방금 전에도 봤는데?', '예상대로 움직여줘서 고맙다!', '너희 결말도 이미 정해져 있다.'],
    victory: '반복되던 결말이 바뀌었다. 오늘의 플레이 DNA가 새로 기록됐다.',
    defeat: '데자뷔가 결말을 되돌렸다. 하지만 다음 선택까지 같을 필요는 없다.'
  }
];

function cleanCount(value) {
  const number = Math.floor(Number(value || 0));
  return Number.isFinite(number) ? Math.max(0, Math.min(9999, number)) : 0;
}

function normalizeDna(value = {}) {
  const result = { bold: 0, safe: 0, unique: 0, reader: 0, samples: cleanCount(value?.samples) };
  for (const key of DNA_KEYS) result[key] = cleanCount(value?.[key]);
  return result;
}

function stableHash(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function dominantTrait(value = {}, seed = '') {
  const dna = normalizeDna(value);
  const offset = stableHash(seed) % DNA_KEYS.length;
  let best = DNA_KEYS[offset];
  for (let index = 1; index < DNA_KEYS.length; index += 1) {
    const key = DNA_KEYS[(offset + index) % DNA_KEYS.length];
    if (dna[key] > dna[best]) best = key;
  }
  return best;
}

function cleanText(value, limit, fallback) {
  const text = String(value || '').replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
  return text || fallback;
}

function sanitizePack(value = {}, fallback = FALLBACK_PACKS[0]) {
  const list = (items, alternatives, limit) => alternatives.map((alternative, index) => cleanText(Array.isArray(items) ? items[index] : '', limit, alternative));
  return {
    bossName: cleanText(value.bossName, 24, fallback.bossName),
    bossEmoji: ALLOWED_EMOJIS.has(value.bossEmoji) ? value.bossEmoji : fallback.bossEmoji,
    intro: cleanText(value.intro, 140, fallback.intro),
    roundTitles: list(value.roundTitles, fallback.roundTitles, 28),
    taunts: list(value.taunts, fallback.taunts, 70),
    victory: cleanText(value.victory, 120, fallback.victory),
    defeat: cleanText(value.defeat, 120, fallback.defeat)
  };
}

function fallbackPack(roomId) {
  const fallback = FALLBACK_PACKS[stableHash(roomId) % FALLBACK_PACKS.length];
  return sanitizePack(fallback, fallback);
}

function playerProfiles(playerDocs = []) {
  return playerDocs.slice(0, 8).map(item => {
    const data = typeof item.data === 'function' ? item.data() : item;
    const uid = String(data?.uid || item.id || '').slice(0, 128);
    const dna = normalizeDna(data?.dna);
    const trait = dominantTrait(dna, uid);
    return {
      uid,
      nickname: cleanText(data?.nickname, 12, '플레이어'),
      trait,
      traitLabel: TRAIT_LABELS[trait],
      dna
    };
  });
}

function buildPrompt(profiles) {
  const summary = profiles.map(profile => ({
    nickname: profile.nickname,
    dominantStyle: profile.traitLabel,
    scores: profile.dna
  }));
  return [
    '당신은 한국어 모바일 파티게임 소소킹의 유쾌한 AI 게임 디렉터다.',
    '아래 참가자들의 게임 안 선택 수치만 보고, 이 방에서 한 번만 등장할 코믹 보스를 만든다.',
    '사람을 모욕하거나 외모·성별·나이·건강·정치·성적 내용·실제 개인정보를 추측하지 마라.',
    '닉네임은 필요할 때 한두 번만 가볍게 사용하고, 따뜻하고 장난스러운 한국어로 쓴다.',
    '게임 규칙은 코드가 결정하므로 새로운 규칙이나 숫자를 만들지 말고 이야기 문구만 작성한다.',
    '3개 라운드는 순서대로 ① 평소와 반대 선택 ② 정확히 두 명이 같은 선택 ③ 혼자만 다른 선택이다.',
    `참가자 데이터: ${JSON.stringify(summary)}`
  ].join('\n');
}

function responseSchema() {
  const stringArray = { type: 'ARRAY', minItems: 3, maxItems: 3, items: { type: 'STRING' } };
  return {
    type: 'OBJECT',
    required: ['bossName', 'bossEmoji', 'intro', 'roundTitles', 'taunts', 'victory', 'defeat'],
    properties: {
      bossName: { type: 'STRING' },
      bossEmoji: { type: 'STRING', enum: [...ALLOWED_EMOJIS] },
      intro: { type: 'STRING' },
      roundTitles: stringArray,
      taunts: stringArray,
      victory: { type: 'STRING' },
      defeat: { type: 'STRING' }
    }
  };
}

function parseVertexResponse(payload, fallback) {
  const text = payload?.candidates?.[0]?.content?.parts?.map(part => part?.text || '').join('') || '';
  if (!text) throw new Error('empty-ai-response');
  return sanitizePack(JSON.parse(text), fallback);
}

module.exports = {
  buildPrompt,
  dominantTrait,
  fallbackPack,
  normalizeDna,
  parseVertexResponse,
  playerProfiles,
  responseSchema,
  sanitizePack
};
