const BASE_TITLE = '소소킹 - 소소한 논쟁커뮤니티';
const BASE_DESC  = '생활 속 소소한 이슈를 자료로 정리하고 찬성·반대 투표와 댓글로 토론하는 커뮤니티';
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
