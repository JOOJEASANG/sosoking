'use strict';

const moderation = require('./index.js');
const aiConfig = require('./secure-ai-config-functions.js');
const communityPosts = require('./community-post-functions.js');
const interactions = require('./community-interactions-functions.js');
const seo = require('./seo-post-functions.js');
const sitemap = require('./sitemap-functions.js');
const linkSummary = require('./link-summary-functions.js');
const account = require('./account-functions.js');
const communityFeatures = require('./community-features-functions.js');
const communityAiContent = require('./community-ai-content-functions.js');
const aiCharacterComments = require('./ai-character-comments-v2-functions.js');
const adminAutomation = require('./ai-admin-automation-functions.js');
const adminUsers = require('./admin-user-functions.js');
const adminData = require('./admin-data-functions.js');
const memberStats = require('./member-stats-functions.js');
const dailyAutoPost = require('./daily-auto-post-v2-functions.js');
const uploadImage = require('./upload-image-functions.js');
const nicknameIcon = require('./nickname-icon-functions.js');
const postOwner = require('./post-owner-functions.js');
const kakaoAuth = require('./kakao-auth-functions.js');

module.exports = {
  ...moderation,
  ...aiConfig,
  ...communityPosts,
  ...interactions,
  ...seo,
  ...sitemap,
  ...linkSummary,
  ...account,
  ...communityFeatures,
  ...communityAiContent,
  ...aiCharacterComments,
  ...adminAutomation,
  ...adminUsers,
  ...adminData,
  ...memberStats,
  ...dailyAutoPost,
  ...uploadImage,
  ...nicknameIcon,
  ...postOwner,
  ...kakaoAuth,
};
