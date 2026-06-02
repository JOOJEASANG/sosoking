'use strict';

const coreAi = require('./index.js');
const secureAiConfig = require('./secure-ai-config-functions.js');
const secureFeed = require('./secure-feed-functions.js');
const secureMulti = require('./secure-multi-functions.js');
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
const adminUsers = require('./admin-user-functions.js');
const adminData = require('./admin-data-functions.js');
const memberStats = require('./member-stats-functions.js');
const weeklyAiSchedule = require('./weekly-ai-schedule-functions.js');
const uploadImage = require('./upload-image-functions.js');
const nicknameIcon = require('./nickname-icon-functions.js');
const postOwner = require('./post-owner-functions.js');
const postView = require('./post-view-functions.js');
const points = require('./points-functions.js');
const bestReward = require('./best-reward-functions.js');
const kakaoAuth = require('./kakao-auth-functions.js');
const aiLadder = require('./ai-ladder-functions.js');

module.exports = {
  ...coreAi,
  ...secureAiConfig,
  checkQuizAnswer: secureFeed.checkQuizAnswer,
  castFeedVote: secureFeed.castFeedVote,
  toggleFeedReaction: secureFeed.toggleFeedReaction,
  registerPostView: secureFeed.registerPostView,
  seoPost: secureFeed.seoPost,
  checkMultiQuizAnswer: secureMulti.checkMultiQuizAnswer,
  castMultiVote: secureMulti.castMultiVote,
  addMultiParticipation: secureMulti.addMultiParticipation,
  addMultiItemReply: secureMulti.addMultiItemReply,
  reactMultiItem: secureMulti.reactMultiItem,
  finalizeBestReward: bestReward.finalizeBestReward,
  incrementPostView: secureInteractions.incrementPostView,
  votePostOption: secureInteractions.votePostOption,
  reactToPost: secureInteractions.reactToPost,
  reactToComment: secureInteractions.reactToComment,
  reactToAcrostic: secureInteractions.reactToAcrostic,
  ...sitemap,
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
  ...adminUsers,
  ...adminData,
  ...memberStats,
  ...points,
  ...aiLadder,
  ...weeklyAiSchedule,
  ...uploadImage,
  ...nicknameIcon,
  ...postOwner,
  ...postView,
  ...kakaoAuth,
};
