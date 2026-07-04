const BASE_TITLE = '소소킹 - 황당사건 판정 커뮤니티';
const BASE_DESC  = '세상의 황당한 사건, 어이없는 상황, 소소한 논란을 모아 AI 캐릭터와 사람들이 함께 판정하고 토론하는 참여형 커뮤니티';
const BASE_IMAGE = 'https://sosoking.co.kr/og-image.png';
const SITE_URL   = 'https://sosoking.co.kr';

function setAttr(selector, attr, value) {
  document.querySelector(selector)?.setAttribute(attr, value);
}

export function setMeta(title, desc, image, canonical) {
  const t = title ? `${title} | 소소킹` : BASE_TITLE;
  const d = desc  || BASE_DESC;
  const i = image || BASE_IMAGE;
  const c = canonical || `${SITE_URL}/`;

  document.title = t;
  setAttr('meta[name="description"]',           'content', d);
  setAttr('meta[property="og:title"]',          'content', t);
  setAttr('meta[property="og:description"]',    'content', d);
  setAttr('meta[property="og:image"]',          'content', i);
  setAttr('meta[property="og:url"]',            'content', c);
  setAttr('meta[name="twitter:title"]',         'content', t);
  setAttr('meta[name="twitter:description"]',   'content', d);
  setAttr('meta[name="twitter:image"]',         'content', i);
  setAttr('link[rel="canonical"]',              'href',    c);
}
