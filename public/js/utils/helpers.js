export function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

export function formatTime(date) {
  if (!date) return '알 수 없음';
  const d = date instanceof Date ? date : new Date(date);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)    return '방금 전';
  if (diff < 3600)  return `${Math.floor(diff/60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff/3600)}시간 전`;
  return `${Math.floor(diff/86400)}일 전`;
}

const TITLES = [
  { min: 30, label: '👑 소소킹' },
  { min: 20, label: '⭐ 소소러' },
  { min: 10, label: '🔥 놀이꾼' },
  { min: 3,  label: '😊 소소인' },
  { min: 1,  label: '🌱 새싹'  },
  { min: 0,  label: '🥚 뉴비'  },
];

export function computeTitle(count) {
  return (TITLES.find(t => count >= t.min) || TITLES.at(-1)).label;
}
