'use strict';

const { getApps, initializeApp } = require('firebase-admin/app');
if (!getApps().length) initializeApp();

const coreAi = require('./index.js');
const secureAiConfig = require('./secure-ai-config-functions.js');
const secureFeed = require('./secure-feed-functions.js');
const sitemap = require('./sitemap-functions.js');
const account = require('./account-functions.js');
const adminUsers = require('./admin-user-functions.js');
const adminData = require('./admin-data-functions.js');
const memberStats = require('./member-stats-functions.js');
const uploadImage = require('./upload-image-functions.js');
const nicknameIcon = require('./nickname-icon-functions.js');
const postOwner = require('./post-owner-functions.js');
const postView = require('./post-view-functions.js');
const points = require('./points-functions.js');
const kakaoAuth = require('./kakao-auth-functions.js');
const legacyDisabled = require('./legacy-disabled-functions.js');
const sosoMaterials = require('./soso-material-functions.js');
const kingPlayground = require('./king-playground-functions.js');

module.exports = {
  ...coreAi,
  ...secureAiConfig,
  seoPost: secureFeed.seoPost || coreAi.seoPost,
  castFeedVote: secureFeed.castFeedVote,
  toggleFeedReaction: secureFeed.toggleFeedReaction,
  registerPostView: secureFeed.registerPostView,
  sitemapXml: sitemap.sitemapXml || coreAi.sitemapXml,
  ...account,
  ...adminUsers,
  ...adminData,
  ...memberStats,
  ...points,
  ...uploadImage,
  ...nicknameIcon,
  ...postOwner,
  ...postView,
  ...kakaoAuth,
  ...legacyDisabled,
  ...sosoMaterials,
  ...kingPlayground,
};
