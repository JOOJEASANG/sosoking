'use strict';

const { onRequest } = require('firebase-functions/v2/https');

const REGION = 'asia-northeast3';
const SITE_URL = 'https://sosoking.co.kr';

const GAMES = {
  liar: {
    title: 'AI 라이어 찾기 — 제시어를 모르는 AI를 잡아라',
    desc: '제시어를 모르는 AI 라이어가 채팅에 숨어듭니다. 말투와 설명의 빈틈을 찾아 투표로 잡아내세요. 4~8명 실시간 추리 게임.',
    keywords: 'AI 라이어 찾기, 라이어게임, AI 라이어게임, 추리게임, 채팅게임, 온라인게임, 소소킹',
    hash: '/#/game/liar',
    image: `${SITE_URL}/og-image.png`,
  },
  mafia: {
    title: 'AI 마피아 — 낮 토론으로 AI 마피아를 처형하라',
    desc: 'AI 마피아가 토론에 직접 참여합니다. 낮에는 설득하고 밤에는 속이는 AI를 찾아 투표로 처형하세요. 5~9명 사회추론 게임.',
    keywords: 'AI 마피아, AI 마피아게임, 온라인 마피아, 채팅 추리게임, 사회추론게임, 소소킹',
    hash: '/#/game/mafia',
    image: `${SITE_URL}/og-image.png`,
  },
  'touch-king': {
    title: '터치왕게임 — 12개 그림 중 같은 그림을 가장 빨리 터치!',
    desc: '중앙판과 내 판 12개 그림 중 같은 그림을 가장 빨리 찾아 터치하는 순발력 대결. 2~10명, 방 만들기 지원. 소소킹 소소랜드.',
    keywords: '터치왕게임, 순발력게임, 그림 맞추기 게임, 온라인 파티게임, 소소킹',
    hash: '/#/game/touch-king',
    image: `${SITE_URL}/og-image.png`,
  },
  'soso-code': {
    title: '소소코드 — 숨겨진 코드를 추리하는 턴제 게임',
    desc: '상대의 숨겨진 숫자·색상·기호 코드를 질문과 힌트로 추리합니다. AI 해커가 가짜 힌트를 섞는 2~4명 추론 게임.',
    keywords: '소소코드, 코드 추리게임, 턴제게임, 온라인게임, 소소킹',
    hash: '/#/game/soso-code',
    image: `${SITE_URL}/og-image.png`,
  },
  'ai-court': {
    title: 'AI 재판소 — AI 증언의 모순을 찾는 토론 추리 게임',
    desc: '사건 기록, 증거 카드, AI 증언을 놓고 토론합니다. 진짜 범인과 조작된 증거를 함께 찾아내는 3~7명 추리 게임.',
    keywords: 'AI 재판소, 토론 추리게임, 법정게임, 온라인게임, 소소킹',
    hash: '/#/game/ai-court',
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

const seoGameLiar      = onRequest({ region: REGION }, (req, res) => { res.set('Cache-Control', 'public, max-age=86400'); res.send(makeGamePage('liar')); });
const seoGameMafia     = onRequest({ region: REGION }, (req, res) => { res.set('Cache-Control', 'public, max-age=86400'); res.send(makeGamePage('mafia')); });
const seoGameTouchKing = onRequest({ region: REGION }, (req, res) => { res.set('Cache-Control', 'public, max-age=86400'); res.send(makeGamePage('touch-king')); });
const seoGameSosoCode  = onRequest({ region: REGION }, (req, res) => { res.set('Cache-Control', 'public, max-age=86400'); res.send(makeGamePage('soso-code')); });
const seoGameAiCourt   = onRequest({ region: REGION }, (req, res) => { res.set('Cache-Control', 'public, max-age=86400'); res.send(makeGamePage('ai-court')); });

module.exports = { seoGameLiar, seoGameMafia, seoGameTouchKing, seoGameSosoCode, seoGameAiCourt };
