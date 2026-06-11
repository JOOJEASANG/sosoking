/* political-rank.js — 정치력 → 정치 등급(출세 사다리) 변환 유틸
 * 게임의 핵심 진행 축. 정치력(power)이 등급으로 환산되어
 * 홈·랭킹·프로필·댓글 등 모든 곳에서 플레이어의 신분이 된다. */

export const RANKS = [
  { level: 1, title: '무명 시민',   emoji: '🌱', color: '#9aa0a6', min: 0 },
  { level: 2, title: '동네 운동가', emoji: '📢', color: '#34a853', min: 100 },
  { level: 3, title: '청년 당원',   emoji: '🪧', color: '#1a73e8', min: 300 },
  { level: 4, title: '당 간부',     emoji: '🎖️', color: '#a142f4', min: 700 },
  { level: 5, title: '지역 위원장', emoji: '🏛️', color: '#e8710a', min: 1500 },
  { level: 6, title: '국회의원',    emoji: '⚖️', color: '#d93025', min: 3000 },
  { level: 7, title: '당 중진',     emoji: '👔', color: '#b8860b', min: 6000 },
  { level: 8, title: '거물 정치인', emoji: '👑', color: '#c5a000', min: 10000 },
];

/** power(정치력) → 현재 등급 정보 + 다음 등급까지 진행도 */
export function getPoliticalRank(power) {
  const p = Math.max(0, Number(power || 0));
  let idx = 0;
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (p >= RANKS[i].min) { idx = i; break; }
  }
  const cur = RANKS[idx];
  const next = RANKS[idx + 1] || null;
  const spanStart = cur.min;
  const spanEnd = next ? next.min : cur.min;
  const progress = next ? Math.min(100, Math.round(((p - spanStart) / (spanEnd - spanStart)) * 100)) : 100;
  const remain = next ? Math.max(0, next.min - p) : 0;
  return {
    ...cur,
    isMax: !next,
    next,
    progress,
    remain,
    power: p,
  };
}

/** 인라인 등급 뱃지(이모지+칭호) — 댓글·랭킹 등에서 사용 */
export function renderRankBadge(power, opts = {}) {
  const r = getPoliticalRank(power);
  const showTitle = opts.title !== false;
  return `<span class="rank-badge" style="--rank-c:${r.color}" title="${r.title} · ${r.power}P">${r.emoji}${showTitle ? ` <span class="rank-badge__title">${r.title}</span>` : ''}</span>`;
}
