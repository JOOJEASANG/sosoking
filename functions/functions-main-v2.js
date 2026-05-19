'use strict';

// Cloud Functions export를 명시적으로 구성합니다.
// 여러 모듈이 같은 이름을 export하면 뒤쪽 모듈이 앞쪽 모듈을 조용히 덮어쓰므로,
// 운영에서 사용하는 대표 함수만 공개하고 레거시/대체 구현은 덮어쓰지 않도록 고정합니다.

const coreAi = require('./index.js');
const secureFeed = require('./secure-feed-functions.js');
const secureInteractions = require('./secure-interactions-functions.js');
const sitemap = require('./sitemap-functions.js');
const aiMission = require('./ai-mission-functions.js');
const aiHunt = require('./ai-hunt-functions.js');
const settlement = require('./settlement-functions.js');
const linkSummary = require('./link-summary-functions.js');
const dailySeed = require('./daily-seed-functions.js');
const sosoFeed = require('./soso-feed-functions.js');
const account = require('./account-functions.js');
const features = require('./sosoking-features-functions.js');
const aiContent = require('./ai-content-functions.js');
const adminAutomation = require('./ai-admin-automation-functions.js');

module.exports = {
  // Gemini 기반 관리자 AI 설정, 폼 자동 입력, 모더레이션, 리포트
  ...coreAi,

  // 메인 피드 보안 액션: 이 구현을 checkQuizAnswer의 단일 기준으로 사용
  checkQuizAnswer: secureFeed.checkQuizAnswer,
  castFeedVote: secureFeed.castFeedVote,
  toggleFeedReaction: secureFeed.toggleFeedReaction,
  registerPostView: secureFeed.registerPostView,
  seoPost: secureFeed.seoPost,

  // 상세 상호작용 보안 액션: 중복 checkQuizAnswer는 공개하지 않음
  incrementPostView: secureInteractions.incrementPostView,
  votePostOption: secureInteractions.votePostOption,
  reactToPost: secureInteractions.reactToPost,
  reactToComment: secureInteractions.reactToComment,
  reactToAcrostic: secureInteractions.reactToAcrostic,

  ...sitemap,

  // Anthropic 기반 AI 미션/자동 콘텐츠를 대표 구현으로 사용
  ...aiMission,
  ...aiContent,

  ...aiHunt,
  ...settlement,
  ...linkSummary,
  ...dailySeed,
  ...sosoFeed,
  ...account,
  ...features,
  ...adminAutomation,
};
