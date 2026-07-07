import { escapeHtml } from './sanitize.js?v=20260630-3';

function hashCode(text) {
  let h = 0;
  for (const ch of String(text || '')) h = ((h << 5) - h + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function initialOf(name, email = '') {
  const source = String(name || email || '소').trim();
  return escapeHtml(source.slice(0, 1).toUpperCase() || '소');
}

export function generatedAvatarUrl(name = '', email = '', seed = '') {
  const source = `${name}|${email}|${seed}`;
  const h = hashCode(source);
  const palettes = [
    ['#2b314f', '#c9a84c'],
    ['#233a34', '#8bd1a5'],
    ['#3d2a43', '#e2a3ff'],
    ['#3c2d24', '#f0b37e'],
    ['#233349', '#8ec5ff'],
    ['#3a2630', '#ff9fb8']
  ];
  const [bg, fg] = palettes[h % palettes.length];
  const mark = initialOf(name, email);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#101522"/></linearGradient></defs><rect width="160" height="160" rx="80" fill="url(#g)"/><circle cx="80" cy="80" r="70" fill="none" stroke="${fg}" stroke-opacity=".55" stroke-width="4"/><text x="80" y="98" text-anchor="middle" font-family="Arial, sans-serif" font-size="62" font-weight="700" fill="${fg}">${mark}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function profilePhotoUrl(user, profile = {}) {
  const url = profile.photoURL || user?.photoURL || '';
  if (typeof url === 'string' && /^https:\/\//.test(url)) return url;
  return generatedAvatarUrl(profile.nickname || user?.displayName || '', profile.email || user?.email || '', profile.avatarSeed || user?.uid || '');
}

export function avatarImg(user, profile = {}, size = 44, extra = '') {
  const src = profilePhotoUrl(user, profile);
  const alt = profile.nickname || user?.displayName || '프로필';
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" ${extra ? `class="${escapeHtml(extra)}"` : ''} style="width:${size}px;height:${size}px;border-radius:999px;object-fit:cover;border:2px solid rgba(201,168,76,.72);background:#101522;display:inline-block;" referrerpolicy="no-referrer">`;
}

export function avatarSourceLabel(user, profile = {}) {
  return (profile.photoURL || user?.photoURL) ? '구글 프로필 사진 사용 중' : '닉네임 기반 자동 생성 아이콘';
}
