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

// 구글 프로필 URL은 기본적으로 =s96-c 같은 작은 크기로 내려온다.
// 88px 자리에 그대로 쓰면 고해상도 화면에서 흐릿하게 뭉개지므로
// 표시 크기의 2배를 요청해 또렷하게 만든다.
const GOOGLE_PHOTO_HOST = /^https:\/\/(lh[0-9]+\.googleusercontent\.com|[a-z0-9-]+\.ggpht\.com)\//i;

function sizedGooglePhoto(url, size) {
  if (!GOOGLE_PHOTO_HOST.test(url)) return url;
  const target = Math.min(512, Math.max(96, Math.round(Number(size) || 96) * 2));
  return /=s\d+(-c)?$/.test(url)
    ? url.replace(/=s\d+(-c)?$/, `=s${target}-c`)
    : `${url}${url.includes('=') ? '' : `=s${target}-c`}`;
}

export function fallbackAvatarUrl(user, profile = {}) {
  return generatedAvatarUrl(
    profile.nickname || user?.displayName || '',
    profile.email || user?.email || '',
    profile.avatarSeed || user?.uid || ''
  );
}

export function profilePhotoUrl(user, profile = {}, size = 96) {
  // 사용자가 직접 올린 사진이 가장 우선한다.
  const custom = profile.photoData || '';
  if (typeof custom === 'string' && custom.startsWith('data:image/')) return custom;

  const url = profile.photoURL || user?.photoURL || '';
  if (typeof url === 'string' && /^https:\/\//.test(url)) return sizedGooglePhoto(url, size);
  return fallbackAvatarUrl(user, profile);
}

export function avatarImg(user, profile = {}, size = 44, extra = '') {
  const src = profilePhotoUrl(user, profile, size);
  const alt = profile.nickname || user?.displayName || '프로필';
  // 구글 이미지 호스트는 간헐적으로 403/429를 돌려준다. 그때 깨진 아이콘이
  // 그대로 남지 않도록 대체 이미지를 심어둔다. CSP가 script-src-attr 'none'이라
  // 인라인 오류 핸들러 속성은 쓸 수 없고, avatar-fallback.js가 위임 처리한다.
  const fallback = fallbackAvatarUrl(user, profile);
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" ${extra ? `class="${escapeHtml(extra)}"` : ''} data-avatar-fallback="${escapeHtml(fallback)}" style="width:${size}px;height:${size}px;border-radius:999px;object-fit:cover;border:2px solid rgba(201,168,76,.72);background:#101522;display:inline-block;" referrerpolicy="no-referrer">`;
}

export function avatarSourceLabel(user, profile = {}) {
  if (profile.photoData) return '직접 올린 사진 사용 중';
  return (profile.photoURL || user?.photoURL) ? '구글 프로필 사진 사용 중' : '닉네임 기반 자동 생성 아이콘';
}
