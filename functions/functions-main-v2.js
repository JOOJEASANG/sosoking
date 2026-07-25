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
const aiCharacterCommentsUnified = require('./ai-character-comments-unified-functions.js');
const migration = require('./community-migration-functions.js');
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

  // v2 모듈은 관리자 설정·수동 테스트 callable만 공개합니다.
  // 자동 생성 트리거는 unified 한 개만 배포해 중복 실행과 마커 경쟁을 막습니다.
  getAiCharacterSettings: aiCharacterComments.getAiCharacterSettings,
  saveAiCharacterSettings: aiCharacterComments.saveAiCharacterSettings,
  generateAiCharacterCommentsTest: aiCharacterComments.generateAiCharacterCommentsTest,
  ...aiCharacterCommentsUnified,

  ...migration,
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
