'use strict';

const { onRequest } = require('firebase-functions/v2/https');

const REGION = 'asia-northeast3';
const SITE_URL = 'https://sosoking.co.kr';

const GAMES = {
  liar: {
    title: '라이어게임 — AI를 찾아라',
    desc: 'AI가 라이어로 위장 참가합니다. 채팅으로 제시어를 설명하며 어색한 사람을 찾아내세요. 소소킹 소소랜드 실시간 추리 게임.',
    keywords: '라이어게임, AI 라이어게임, 심리게임, 온라인게임, 추리게임, 채팅게임, 소소킹',
    hash: '/#/game/liar',
    image: `${SITE_URL}/og-image.png`,
    type: '라이어게임',
  },
  mafia: {
    title: '마피아게임 — AI 마피아를 잡아라',
    desc: 'AI가 마피아로 위장합니다. 채팅 토론과 투표로 AI 마피아를 찾아내세요. 소소킹 소소랜드 실시간 추리 심리 게임.',
    keywords: '마피아게임, AI 마피아게임, 온라인 마피아, 채팅 추리게임, 소소킹',
    hash: '/#/game/mafia',
    image: `${SITE_URL}/og-image.png`,
    type: '마피아게임',
  },
  wordtrap: {
    title: '금칙어 채팅게임',
    desc: '내 금칙어를 숨기면서 상대가 자기 금칙어를 말하도록 유도하는 채팅 심리 게임. 소소킹 소소랜드에서 즐겨보세요.',
    keywords: '금칙어게임, 금칙어 채팅게임, 채팅 심리게임, 온라인게임, 소소킹',
    hash: '/#/game/wordtrap',
    image: `${SITE_URL}/og-image.png`,
    type: '금칙어게임',
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

const seoGameLiar     = onRequest({ region: REGION }, (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(makeGamePage('liar'));
});

const seoGameMafia    = onRequest({ region: REGION }, (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(makeGamePage('mafia'));
});

module.exports = { seoGameLiar, seoGameMafia };
