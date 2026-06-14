const BASE_TITLE = '소소킹 - 가상 정치 공화국 커뮤니티';
const BASE_DESC  = '정당에 입당하고 정치배틀에 참여하며 대선, 국회, 헌법재판소까지 이어지는 가상 정치 시뮬레이션 커뮤니티';
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
