'use strict';

const { onRequest } = require('firebase-functions/v2/https');

const REGION = 'asia-northeast3';
const SITE_URL = 'https://sosoking.co.kr';

const GAMES = {
  'soso-code': {
    title: '소소코드 — AI 해커의 가짜 정보를 뚫는 코드 추리 게임',
    desc: 'AI 해커가 가짜 인텔을 흘립니다. 질문으로 Hit·Blow를 얻고 상대의 4자리 비밀 코드를 먼저 추리하세요. 2~4명 논리 추리 게임.',
    keywords: '소소코드, AI 해커게임, 코드 추리게임, Hit Blow, 숫자 추리, 온라인게임, 소소킹',
    hash: '/#/game/soso-code',
    image: `${SITE_URL}/og-image.png`,
  },
  'soso-spy': {
    title: '소소스파이 — AI가 다른 단어로 잠입하는 힌트 추리 게임',
    desc: 'AI 스파이가 살짝 다른 단어를 받고 잠입합니다. 힌트를 교환하고 토론해서 숨은 AI를 찾아내세요. 4~8명 심리전 추리 게임.',
    keywords: '소소스파이, AI 스파이게임, 힌트 추리게임, AI 숨겨진 단어, 심리전게임, 온라인게임, 소소킹',
    hash: '/#/game/soso-spy',
    image: `${SITE_URL}/og-image.png`,
  },
  'touch-king': {
    title: '터치왕게임 — 12개 그림 중 같은 그림을 가장 빨리 터치!',
    desc: '중앙판과 내 판 12개 그림 중 같은 그림을 가장 빨리 찾아 터치하는 순발력 대결. 2~10명, 방 만들기 지원. 소소킹 소소랜드.',
    keywords: '터치왕게임, 순발력게임, 그림 맞추기 게임, 온라인 파티게임, 소소킹',
    hash: '/#/game/touch-king',
    image: `${SITE_URL}/og-image.png`,
  },
  'soso-deal': {
    title: '소소딜 — AI 브로커와 겨루는 자원 카드 거래 게임',
    desc: '6종 자원 카드를 시장에서 교환하고 플레이어와 거래해 세트를 완성하세요. AI 브로커가 최적 전략으로 방해하는 2~5명 협상 게임.',
    keywords: '소소딜, AI 브로커게임, 카드 거래게임, 자원 교환, 협상게임, 온라인게임, 소소킹',
    hash: '/#/game/soso-deal',
    image: `${SITE_URL}/og-image.png`,
  },
};

function makeGamePage(key) {
  const g = GAMES[key];
  const url = `${SITE_URL}/game/${key}`;
  const dest = `${SITE_URL}${g.hash}`;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: `소소킹 ${g.title}`,
    description: g.desc,
    applicationCategory: 'GameApplication',
    operatingSystem: 'Web',
    inLanguage: 'ko-KR',
    isAccessibleForFree: true,
    url,
    publisher: {
      '@type': 'Organization',
      name: '소소킹',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` },
    },
  });

  return `<!DOCTYPE html><html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${g.title} | 소소킹 소소랜드</title>
  <meta name="description" content="${g.desc}">
  <meta name="keywords" content="${g.keywords}">
  <meta property="og:title" content="${g.title} | 소소킹 소소랜드">
  <meta property="og:description" content="${g.desc}">
  <meta property="og:image" content="${g.image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${url}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:site_name" content="소소킹">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${g.title} | 소소킹 소소랜드">
  <meta name="twitter:description" content="${g.desc}">
  <meta name="twitter:image" content="${g.image}">
  <link rel="canonical" href="${url}">
  <script type="application/ld+json">${jsonLd}</script>
  <meta http-equiv="refresh" content="0;url=${dest}">
  <script>window.location.replace(${JSON.stringify(dest)});</script>
  <style>body{font-family:-apple-system,sans-serif;max-width:680px;margin:24px auto;padding:0 16px;color:#222}h1{font-size:1.4em;margin-bottom:8px}p{color:#555;line-height:1.6}a{color:#FF4422}</style>
</head>
<body>
  <p><a href="${SITE_URL}">← 소소킹</a> · <a href="${SITE_URL}/#/sosoland">소소랜드</a></p>
  <h1>${g.title}</h1>
  <p>${g.desc}</p>
  <p><a href="${dest}">게임 시작하기 →</a></p>
</body></html>`;
}

const seoGameSosoCode  = onRequest({ region: REGION }, (req, res) => { res.set('Cache-Control', 'public, max-age=86400'); res.send(makeGamePage('soso-code')); });
const seoGameSosoSpy   = onRequest({ region: REGION }, (req, res) => { res.set('Cache-Control', 'public, max-age=86400'); res.send(makeGamePage('soso-spy')); });
const seoGameSosoDeal  = onRequest({ region: REGION }, (req, res) => { res.set('Cache-Control', 'public, max-age=86400'); res.send(makeGamePage('soso-deal')); });
const seoGameTouchKing = onRequest({ region: REGION }, (req, res) => { res.set('Cache-Control', 'public, max-age=86400'); res.send(makeGamePage('touch-king')); });

module.exports = { seoGameSosoCode, seoGameSosoSpy, seoGameSosoDeal, seoGameTouchKing };
