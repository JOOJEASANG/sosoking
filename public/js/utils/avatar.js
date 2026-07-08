import { escapeHtml } from './sanitize.js?v=20260630-3';

export const AVATAR_PRESETS = [
  { seed: 'dog', icon: '🐶', label: '강아지' },
  { seed: 'cat', icon: '🐱', label: '고양이' },
  { seed: 'rabbit', icon: '🐰', label: '토끼' },
  { seed: 'bear', icon: '🐻', label: '곰' },
  { seed: 'panda', icon: '🐼', label: '판다' },
  { seed: 'fox', icon: '🦊', label: '여우' },
  { seed: 'tiger', icon: '🐯', label: '호랑이' },
  { seed: 'lion', icon: '🦁', label: '사자' },
  { seed: 'wolf', icon: '🐺', label: '늑대' },
  { seed: 'pig', icon: '🐷', label: '돼지' },
  { seed: 'cow', icon: '🐮', label: '소' },
  { seed: 'hamster', icon: '🐹', label: '햄스터' },
  { seed: 'koala', icon: '🐨', label: '코알라' },
  { seed: 'mouse', icon: '🐭', label: '쥐' },
  { seed: 'chick', icon: '🐥', label: '병아리' },
  { seed: 'duck', icon: '🦆', label: '오리' },
  { seed: 'eagle', icon: '🦅', label: '독수리' },
  { seed: 'frog', icon: '🐸', label: '개구리' },
  { seed: 'monkey', icon: '🐵', label: '원숭이' },
  { seed: 'penguin', icon: '🐧', label: '펭귄' },
  { seed: 'owl', icon: '🦉', label: '부엉이' },
  { seed: 'unicorn', icon: '🦄', label: '유니콘' },
  { seed: 'dragon', icon: '🐲', label: '용' },
  { seed: 'octopus', icon: '🐙', label: '문어' },
  { seed: 'whale', icon: '🐳', label: '고래' },
  { seed: 'dolphin', icon: '🐬', label: '돌고래' },
  { seed: 'turtle', icon: '🐢', label: '거북이' },
  { seed: 'butterfly', icon: '🦋', label: '나비' },
  { seed: 'snail', icon: '🐌', label: '달팽이' },
  { seed: 'bee', icon: '🐝', label: '벌' },
  { seed: 'court', icon: '⚖️', label: '저울' },
  { seed: 'scroll', icon: '📜', label: '문서' },
  { seed: 'book', icon: '📚', label: '책' },
  { seed: 'briefcase', icon: '💼', label: '가방' },
  { seed: 'megaphone', icon: '📣', label: '확성기' },
  { seed: 'bulb', icon: '💡', label: '전구' },
  { seed: 'key', icon: '🔑', label: '열쇠' },
  { seed: 'lock', icon: '🔒', label: '자물쇠' },
  { seed: 'phone', icon: '📱', label: '휴대폰' },
  { seed: 'camera', icon: '📷', label: '카메라' },
  { seed: 'game', icon: '🎮', label: '게임기' },
  { seed: 'headphone', icon: '🎧', label: '헤드폰' },
  { seed: 'tv', icon: '📺', label: '텔레비전' },
  { seed: 'battery', icon: '🔋', label: '배터리' },
  { seed: 'gift', icon: '🎁', label: '선물' },
  { seed: 'balloon', icon: '🎈', label: '풍선' },
  { seed: 'trophy', icon: '🏆', label: '트로피' },
  { seed: 'medal', icon: '🏅', label: '메달' },
  { seed: 'ramen', icon: '🍜', label: '라면' },
  { seed: 'pizza', icon: '🍕', label: '피자' },
  { seed: 'hamburger', icon: '🍔', label: '햄버거' },
  { seed: 'fries', icon: '🍟', label: '감자튀김' },
  { seed: 'sushi', icon: '🍣', label: '초밥' },
  { seed: 'rice', icon: '🍚', label: '밥' },
  { seed: 'bread', icon: '🍞', label: '빵' },
  { seed: 'croissant', icon: '🥐', label: '크루아상' },
  { seed: 'egg', icon: '🥚', label: '달걀' },
  { seed: 'dumpling', icon: '🥟', label: '만두' },
  { seed: 'cookie', icon: '🍪', label: '쿠키' },
  { seed: 'cake', icon: '🍰', label: '케이크' },
  { seed: 'donut', icon: '🍩', label: '도넛' },
  { seed: 'icecream', icon: '🍦', label: '아이스크림' },
  { seed: 'coffee', icon: '☕', label: '커피' },
  { seed: 'bubbletea', icon: '🧋', label: '버블티' },
  { seed: 'rocket', icon: '🚀', label: '로켓' },
  { seed: 'moon', icon: '🌙', label: '달' },
  { seed: 'sun', icon: '☀️', label: '해' },
  { seed: 'star', icon: '⭐', label: '별' },
  { seed: 'rainbow', icon: '🌈', label: '무지개' },
  { seed: 'cloud', icon: '☁️', label: '구름' },
  { seed: 'snow', icon: '❄️', label: '눈꽃' },
  { seed: 'fire', icon: '🔥', label: '불꽃' },
  { seed: 'gem', icon: '💎', label: '보석' },
  { seed: 'clover', icon: '🍀', label: '네잎클로버' },
  { seed: 'flower', icon: '🌸', label: '꽃' },
  { seed: 'cactus', icon: '🌵', label: '선인장' },
  { seed: 'tree', icon: '🌳', label: '나무' },
  { seed: 'dice', icon: '🎲', label: '주사위' },
  { seed: 'mask', icon: '🎭', label: '가면' },
  { seed: 'shield', icon: '🛡️', label: '방패' },
  { seed: 'crown', icon: '👑', label: '왕관' },
  { seed: 'ghost', icon: '👻', label: '유령' },
  { seed: 'alien', icon: '👽', label: '외계인' },
  { seed: 'robot', icon: '🤖', label: '로봇' },
  { seed: 'detective', icon: '🕵️', label: '탐정' },
  { seed: 'wizard', icon: '🧙', label: '마법사' },
  { seed: 'ninja', icon: '🥷', label: '닌자' },
  { seed: 'angel', icon: '😇', label: '천사' },
  { seed: 'laugh', icon: '😂', label: '웃음' },
  { seed: 'thinking', icon: '🤔', label: '생각' },
  { seed: 'angry', icon: '😤', label: '억울함' },
  { seed: 'sleepy', icon: '😴', label: '졸림' },
  { seed: 'cool', icon: '😎', label: '멋짐' },
  { seed: 'melting', icon: '🫠', label: '녹음' }
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
    ['#2d2749', '#a0c4ff'],
    ['#143642', '#7ae7c7'],
    ['#3a1c32', '#f7aef8'],
    ['#402218', '#ffbe76'],
    ['#1e2a28', '#b8f2e6']
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
