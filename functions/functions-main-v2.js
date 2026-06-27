'use strict';

// Cloud Functions export를 명시적으로 구성합니다.
// 여러 모듈이 같은 이름을 export하면 뒤쪽 모듈이 앞쪽 모듈을 조용히 덮어쓰므로,
// 운영에서 사용하는 대표 함수만 공개하고 레거시/대체 구현은 덮어쓰지 않도록 고정합니다.

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
const dailyAutoPost = require('./daily-auto-post-functions.js');
const uploadImage = require('./upload-image-functions.js');
const nicknameIcon = require('./nickname-icon-functions.js');
const postOwner = require('./post-owner-functions.js');
const postView = require('./post-view-functions.js');
const points = require('./points-functions.js');
const bestReward = require('./best-reward-functions.js');
const kakaoAuth = require('./kakao-auth-functions.js');

module.exports = {
  // Gemini 기반 관리자 AI 폼 자동 입력, 모더레이션, 리포트
  ...coreAi,

  // AI 설정 저장은 Secret Manager 전용 보안 구현으로 덮어씁니다.
  ...secureAiConfig,

  // 메인 피드 보안 액션: 이 구현을 checkQuizAnswer의 단일 기준으로 사용
  checkQuizAnswer: secureFeed.checkQuizAnswer,
  castFeedVote: secureFeed.castFeedVote,
  toggleFeedReaction: secureFeed.toggleFeedReaction,
  registerPostView: secureFeed.registerPostView,
  seoPost: secureFeed.seoPost,

  // 멀티 게시글 전용 보안 액션
  checkMultiQuizAnswer: secureMulti.checkMultiQuizAnswer,
  castMultiVote: secureMulti.castMultiVote,
  addMultiParticipation: secureMulti.addMultiParticipation,
  addMultiItemReply: secureMulti.addMultiItemReply,
  reactMultiItem: secureMulti.reactMultiItem,
  finalizeBestReward: bestReward.finalizeBestReward,

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
  ...adminUsers,
  ...adminData,
  ...memberStats,

  // 서버 검증 기반 포인트 지급
  ...points,

  // 주간 자동 생성 유지
  ...weeklyAiSchedule,

  // 매일 3개 게시판 자동 글 생성이 최종 dailyAiContent 기준입니다.
  ...dailyAutoPost,

  // 이미지 업로드 fallback callable
  ...uploadImage,

  // 신규 작성 콘텐츠에 작성자 닉네임 아이콘 자동 복사
  ...nicknameIcon,

  // 작성자 본인 게시글 관리
  ...postOwner,

  // 조회수 중복/관리자 보정
  ...postView,

  // 카카오 소셜 로그인
  ...kakaoAuth,
};
