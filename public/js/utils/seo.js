const BASE_TITLE = '소소킹 - 글과 사진으로 즐기는 게임형 커뮤니티';
const BASE_DESC  = '미친작명소, 삼행시, 밸런스게임, 퀴즈, 나만의 노하우를 즐기는 놀이형 커뮤니티';
const BASE_IMAGE = 'https://sosoking.co.kr/og-image.png';

function setAttr(selector, attr, value) {
  document.querySelector(selector)?.setAttribute(attr, value);
}

export function setMeta(title, desc, image) {
  const t = title ? `${title} | 소소킹` : BASE_TITLE;
  const d = desc  || BASE_DESC;
  const i = image || BASE_IMAGE;

  document.title = t;
  setAttr('meta[name="description"]',           'content', d);
  setAttr('meta[property="og:title"]',          'content', t);
  setAttr('meta[property="og:description"]',    'content', d);
  setAttr('meta[property="og:image"]',          'content', i);
  setAttr('meta[name="twitter:title"]',         'content', t);
  setAttr('meta[name="twitter:description"]',   'content', d);
  setAttr('meta[name="twitter:image"]',         'content', i);
}
