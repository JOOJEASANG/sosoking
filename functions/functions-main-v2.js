'use strict';

const { getApps, initializeApp } = require('firebase-admin/app');
if (!getApps().length) initializeApp();

const moderation = require('./moderation-functions.js');
const secureAiConfig = require('./secure-ai-config-functions.js');
const secureFeed = require('./secure-feed-functions.js');
const sitemap = require('./sitemap-functions.js');
const account = require('./account-functions.js');
const accountCleanup = require('./account-cleanup-functions.js');
const communityContent = require('./community-content-functions.js');
const adminUsers = require('./admin-user-functions.js');
const adminData = require('./admin-data-functions.js');
const adminContent = require('./admin-content-functions.js');
const memberStats = require('./member-stats-functions.js');
const uploadImage = require('./upload-image-functions.js');
const nicknameIcon = require('./nickname-icon-functions.js');
const postOwner = require('./post-owner-functions.js');
const postView = require('./post-view-functions.js');
const points = require('./points-functions.js');
const kakaoAuth = require('./kakao-auth-functions.js');
const sosoMaterials = require('./soso-material-functions.js');
const sosoDebates = require('./soso-debate-functions.js');
const debateComments = require('./debate-comment-functions.js');
const kingPlayground = require('./king-playground-functions.js');
const kingResults = require('./king-result-functions.js');

module.exports = {
  ...moderation,
  ...secureAiConfig,
  seoPost: secureFeed.seoPost,
  castFeedVote: secureFeed.castFeedVote,
  toggleFeedReaction: secureFeed.toggleFeedReaction,
  registerPostView: secureFeed.registerPostView,
  sitemapXml: sitemap.sitemapXml,
  updateNickname: account.updateNickname,
  deleteMyAccount: accountCleanup.deleteMyAccount,
  ...communityContent,
  ...adminUsers,
  ...adminData,
  ...adminContent,
  ...memberStats,
  ...points,
  ...uploadImage,
  ...nicknameIcon,
  ...postOwner,
  ...postView,
  ...kakaoAuth,
  ...sosoMaterials,
  ...sosoDebates,
  ...debateComments,
  ...kingPlayground,
  ...kingResults,
};
