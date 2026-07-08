import { escapeHtml } from './sanitize.js?v=20260630-3';

export const AVATAR_PRESETS = [
  { seed: 'dog', icon: '🐶', label: '강아지' },
  { seed: 'cat', icon: '🐱', label: '고양이' },
  { seed: 'rabbit', icon: '🐰', label: '토끼' },
  { seed: 'bear', icon: '🐻', label: '곰' },
  { seed: 'panda', icon: '🐼', label: '판다' },
  { seed: 'fox', icon: '🦊', label: '여우' },
  { seed: 'tiger', icon: '🐯', label: '호랑이' },
  { seed: 'frog', icon: '🐸', label: '개구리' },
  { seed: 'monkey', icon: '🐵', label: '원숭이' },
  { seed: 'penguin', icon: '🐧', label: '펭귄' },
  { seed: 'owl', icon: '🦉', label: '부엉이' },
  { seed: 'unicorn', icon: '🦄', label: '유니콘' },
  { seed: 'court', icon: '⚖️', label: '저울' },
  { seed: 'book', icon: '📚', label: '책' },
  { seed: 'ramen', icon: '🍜', label: '라면' },
  { seed: 'pizza', icon: '🍕', label: '피자' },
  { seed: 'game', icon: '🎮', label: '게임기' },
  { seed: 'headphone', icon: '🎧', label: '헤드폰' },
  { seed: 'coffee', icon: '☕', label: '커피' },
  { seed: 'rocket', icon: '🚀', label: '로켓' },
  { seed: 'moon', icon: '🌙', label: '달' },
  { seed: 'star', icon: '⭐', label: '별' },
  { seed: 'fire', icon: '🔥', label: '불꽃' },
  { seed: 'gem', icon: '💎', label: '보석' },
  { seed: 'dice', icon: '🎲', label: '주사위' },
  { seed: 'mask', icon: '🎭', label: '가면' },
  { seed: 'shield', icon: '🛡️', label: '방패' },
  { seed: 'crown', icon: '👑', label: '왕관' }
];

function hashCode(text) {
  let h = 0;
  for (const ch of String(text || '')) h = ((h << 5) - h + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function initialOf(name, email = '') {
  const source = String(name || email || '소').trim();
  return escapeHtml(source.slice(0, 1).toUpperCase() || '소');
}

function presetFor(seed = '') {
  return AVATAR_PRESETS.find(p => p.seed === seed) || null;
}

export function generatedAvatarUrl(name = '', email = '', seed = '', icon = '') {
  const preset = presetFor(seed);
  const source = `${name}|${email}|${seed}|${icon}`;
  const h = hashCode(source);
  const palettes = [
    ['#2b314f', '#c9a84c'],
    ['#233a34', '#8bd1a5'],
    ['#3d2a43', '#e2a3ff'],
    ['#3c2d24', '#f0b37e'],
    ['#233349', '#8ec5ff'],
    ['#3a2630', '#ff9fb8'],
    ['#263447', '#ffd166'],
    ['#2d2749', '#a0c4ff']
  ];
  const [bg, fg] = palettes[h % palettes.length];
  const mark = preset?.icon || icon || initialOf(name, email);
  const isEmoji = !!(preset?.icon || icon);
  const textSize = isEmoji ? 72 : 62;
  const textY = isEmoji ? 102 : 98;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#101522"/></linearGradient></defs><rect width="160" height="160" rx="80" fill="url(#g)"/><circle cx="80" cy="80" r="70" fill="none" stroke="${fg}" stroke-opacity=".55" stroke-width="4"/><circle cx="118" cy="38" r="18" fill="${fg}" fill-opacity=".18"/><text x="80" y="${textY}" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Arial, sans-serif" font-size="${textSize}" font-weight="700" fill="${fg}">${escapeHtml(mark)}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function profilePhotoUrl(user, profile = {}) {
  const avatarType = profile.avatarType || (profile.photoURL || user?.photoURL ? 'google' : 'generated');
  const photoUrl = profile.photoURL || user?.photoURL || '';
  if ((avatarType === 'google' || avatarType === 'upload') && typeof photoUrl === 'string' && /^https:\/\//.test(photoUrl)) return photoUrl;
  return generatedAvatarUrl(profile.nickname || user?.displayName || '', profile.email || user?.email || '', profile.avatarSeed || user?.uid || 'dog', profile.avatarIcon || '');
}

export function avatarImg(user, profile = {}, size = 44, extra = '') {
  const src = profilePhotoUrl(user, profile);
  const alt = profile.nickname || user?.displayName || '프로필';
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" ${extra ? `class="${escapeHtml(extra)}"` : ''} style="width:${size}px;height:${size}px;border-radius:999px;object-fit:cover;border:2px solid rgba(201,168,76,.72);background:#101522;display:inline-block;" referrerpolicy="no-referrer">`;
}

export function avatarSourceLabel(user, profile = {}) {
  const avatarType = profile.avatarType || (profile.photoURL || user?.photoURL ? 'google' : 'generated');
  if (avatarType === 'upload') return '직접 등록한 프로필 사진';
  if (avatarType === 'generated') return '선택한 프로필 아이콘';
  return (profile.photoURL || user?.photoURL) ? '소셜 로그인 프로필 사진' : '닉네임 기반 자동 생성 아이콘';
}
