'use strict';

const coreAi = require('./index.js');
const secureAiConfig = require('./secure-ai-config-functions.js');
const secureFeed = require('./secure-feed-functions.js');
const secureInteractions = require('./secure-interactions-functions.js');
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
const battle = require('./battle-functions.js');
const politics = require('./politics-functions-v2.js');
const coreParties = require('./three-party-functions.js');
const gameDeadline = require('./game-deadline-functions.js');
const partyLeague = require('./party-war-functions.js');
const congress = require('./congress-functions.js');
const constitutionalCourt = require('./constitutional-court-functions.js');

const adminSeed = require('./admin-seed-functions.js');
const parody = require('./parody-issue-functions.js');

module.exports = {
  ...coreAi,
  ...secureAiConfig,
  castFeedVote: secureFeed.castFeedVote,
  toggleFeedReaction: secureFeed.toggleFeedReaction,
  registerPostView: secureFeed.registerPostView,
  seoPost: secureFeed.seoPost,
  incrementPostView: secureInteractions.incrementPostView,
  votePostOption: secureInteractions.votePostOption,
  reactToPost: secureInteractions.reactToPost,
  reactToComment: secureInteractions.reactToComment,
  reactToAcrostic: secureInteractions.reactToAcrostic,
  ...sitemap,
  ...account,
  ...adminUsers,
  ...adminData,
  ...memberStats,
  ...points,
  ...partyLeague,
  ...congress,
  getConstitutionalCourtStatus: constitutionalCourt.getConstitutionalCourtStatus,
  decideConstitutionalReview: constitutionalCourt.decideConstitutionalReview,
  generateCourtAiVerdict: constitutionalCourt.generateCourtAiVerdict,
  generateDailyBattle: battle.generateDailyBattle,
  closeDailyBattle: battle.closeDailyBattle,
  voteForParty: battle.voteForParty,
  addBattleComment: battle.addBattleComment,
  getBattleStatus: battle.getBattleStatus,
  getKingHistory: battle.getKingHistory,
  adminGenerateBattle: battle.adminGenerateBattle,
  reactToBattleComment: battle.reactToBattleComment,
  adminResetBattleData: battle.adminResetBattleData,
  adminResetAllPoints: battle.adminResetAllPoints,
  getPoliticsOverview: coreParties.getPoliticsOverview,
  getPartyMembers: coreParties.getPartyMembers,
  joinParty: coreParties.joinParty,
  leaveParty: coreParties.leaveParty,
  getElection: politics.getElection,
  voteForPresident: politics.voteForPresident || gameDeadline.voteForPresident,
  getPartyActivities: politics.getPartyActivities,
  getRankings: politics.getRankings,
  getMyStatus: politics.getMyStatus || gameDeadline.getMyStatus,
  getPresident: politics.getPresident,
  setPresidentialDecree: politics.setPresidentialDecree,
  setCampaignPledge: politics.setCampaignPledge,
  addElectionEndorsement: politics.addElectionEndorsement,
  getElectionEndorsements: politics.getElectionEndorsements,
  syncPartyMemberPower: politics.syncPartyMemberPower,
  getUserPoliticsStats: politics.getUserPoliticsStats,
  getPartyManifesto: politics.getPartyManifesto,
  setPartyManifesto: politics.setPartyManifesto,
  getElectionHistory: politics.getElectionHistory,
  getDailyNews: politics.getDailyNews,
  generateNewsColumn: politics.generateNewsColumn,
  ratePresidentDecree: politics.ratePresidentDecree,
  claimRulingBonus: politics.claimRulingBonus,
  getWeeklyCrisis: politics.getWeeklyCrisis,
  voteOnCrisis: politics.voteOnCrisis,
  campaignForParty: politics.campaignForParty,
  getImpeachmentStatus: politics.getImpeachmentStatus,
  signImpeachmentPetition: politics.signImpeachmentPetition,
  getPresidentQA: politics.getPresidentQA,
  askPresidentQuestion: politics.askPresidentQuestion,
  answerPresidentQuestion: politics.answerPresidentQuestion,
  getCampaignMomentum: politics.getCampaignMomentum,
  ...uploadImage,
  ...nicknameIcon,
  ...postOwner,
  ...postView,
  ...kakaoAuth,
  adminSeedWorldHistory: adminSeed.adminSeedWorldHistory,
  generateDailyParodyIssues: parody.generateDailyParodyIssues,
  previewHistoryIssue: parody.previewHistoryIssue,
  triggerParodyIssues: parody.triggerParodyIssues,
};
