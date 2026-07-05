/* seo-copy-fix.js
   오래된 판정/상담 SEO 문구를 현재 토론/드립 구조로 보정
*/

function setMeta(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute('content', value);
}

function fixSeoCopy() {
  document.title = '소소킹 - 웃긴토론과 드립 커뮤니티';

  setMeta('meta[name="description"]', '사소한 상황을 올리면 운영봇과 AI 캐릭터가 토론과 드립으로 받아치는 참여형 커뮤니티입니다.');
  setMeta('meta[name="keywords"]', '소소킹, 웃긴토론, 토론, 드립, 토론소, 드립소, AI 캐릭터, 커뮤니티, 댓글놀이');
  setMeta('meta[property="og:title"]', '소소킹 - 웃긴토론과 드립 커뮤니티');
  setMeta('meta[property="og:description"]', '사소한 상황을 올리면 운영봇과 AI 캐릭터가 토론과 드립으로 받아치는 참여형 커뮤니티');
  setMeta('meta[name="twitter:title"]', '소소킹 - 웃긴토론과 드립 커뮤니티');
  setMeta('meta[name="twitter:description"]', '사소한 상황을 올리면 AI 캐릭터와 사람들이 토론과 드립으로 받아치는 참여형 커뮤니티');
}

fixSeoCopy();
document.addEventListener('DOMContentLoaded', fixSeoCopy);
window.addEventListener('hashchange', fixSeoCopy);
window.addEventListener('sosoking:extensions-ready', fixSeoCopy);
