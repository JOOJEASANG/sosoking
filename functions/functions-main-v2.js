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
const aiLadder = require('./ai-ladder-functions.js');
const hotPotato = require('./hot-potato-functions.js');
const battle = require('./battle-functions.js');
const politics = require('./politics-functions.js');
const jabdam = require('./jabdam-functions.js');
const chosung = require('./chosung-functions.js');

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
  ...aiLadder,
  ...hotPotato,
  ...jabdam,
  ...chosung,
  generateDailyBattle: battle.generateDailyBattle,
  closeDailyBattle: battle.closeDailyBattle,
  voteForChar: battle.voteForChar,
  addBattleComment: battle.addBattleComment,
  getBattleStatus: battle.getBattleStatus,
  getKingHistory: battle.getKingHistory,
  adminGenerateBattle: battle.adminGenerateBattle,
  reactToBattleComment: battle.reactToBattleComment,
  getPoliticsOverview: politics.getPoliticsOverview,
  getPartyMembers: politics.getPartyMembers,
  joinParty: politics.joinParty,
  leaveParty: politics.leaveParty,
  getElection: politics.getElection,
  voteForPresident: politics.voteForPresident,
  getPartyActivities: politics.getPartyActivities,
  getRankings: politics.getRankings,
  getMyStatus: politics.getMyStatus,
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
  ratePresidentDecree: politics.ratePresidentDecree,
  claimRulingBonus: politics.claimRulingBonus,
  getWeeklyCrisis: politics.getWeeklyCrisis,
  voteOnCrisis: politics.voteOnCrisis,
  campaignForParty: politics.campaignForParty,
  getImpeachmentStatus: politics.getImpeachmentStatus,
  signImpeachmentPetition: politics.signImpeachmentPetition,
  ...uploadImage,
  ...nicknameIcon,
  ...postOwner,
  ...postView,
  ...kakaoAuth,
};
