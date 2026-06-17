'use strict';

const { onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');

const REGION = 'asia-northeast3';

function legacyCallable(payload = {}) {
  return onCall({ region: REGION, timeoutSeconds: 10, memory: '256MiB' }, async () => ({
    ok: true,
    disabled: true,
    redirected: true,
    ...payload,
  }));
}

function legacySchedule() {
  return onSchedule({ schedule: '0 0 1 1 *', timeZone: 'Asia/Seoul', region: REGION, timeoutSeconds: 10, memory: '256MiB' }, async () => null);
}

exports.playAiLadderBonus = legacyCallable();
exports.createHotPotato = legacyCallable();
exports.throwHotPotato = legacyCallable();
exports.reactToAcrostic = legacyCallable();
exports.scheduledHotPotatoExploder = legacySchedule();

exports.getBattleStatus = legacyCallable({ exists: false, recentComments: [], totalVotes: 0 });
exports.voteForParty = legacyCallable();
exports.addBattleComment = legacyCallable();
exports.getKingHistory = legacyCallable({ kings: [], history: [] });
exports.adminGenerateBattle = legacyCallable();
exports.reactToBattleComment = legacyCallable();
exports.adminResetBattleData = legacyCallable();
exports.adminResetAllPoints = legacyCallable();
exports.generateDailyBattle = legacySchedule();
exports.closeDailyBattle = legacySchedule();

exports.getPoliticsOverview = legacyCallable({ parties: [] });
exports.getPartyMembers = legacyCallable({ members: [] });
exports.joinParty = legacyCallable();
exports.leaveParty = legacyCallable();
exports.getPartyActivities = legacyCallable({ activities: [] });
exports.getRankings = legacyCallable({ rankings: [] });
exports.getMyStatus = legacyCallable({ status: null });
exports.getUserPoliticsStats = legacyCallable({ stats: null });
exports.getPartyManifesto = legacyCallable({ manifesto: '' });
exports.setPartyManifesto = legacyCallable();
exports.campaignForParty = legacyCallable();
exports.syncPartyMemberPower = legacyCallable();
exports.getCampaignMomentum = legacyCallable({ momentum: [] });

exports.getElection = legacyCallable({ candidates: [], votes: {} });
exports.voteForPresident = legacyCallable();
exports.getPresident = legacyCallable({ president: null });
exports.setPresidentialDecree = legacyCallable();
exports.setCampaignPledge = legacyCallable();
exports.addElectionEndorsement = legacyCallable();
exports.getElectionEndorsements = legacyCallable({ endorsements: [] });
exports.getElectionHistory = legacyCallable({ history: [] });
exports.ratePresidentDecree = legacyCallable();
exports.claimRulingBonus = legacyCallable();
exports.getPresidentQA = legacyCallable({ questions: [] });
exports.askPresidentQuestion = legacyCallable();
exports.answerPresidentQuestion = legacyCallable();

exports.getDailyNews = legacyCallable({ news: [] });
exports.generateNewsColumn = legacyCallable();
exports.getWeeklyCrisis = legacyCallable({ crisis: null });
exports.voteOnCrisis = legacyCallable();
exports.getImpeachmentStatus = legacyCallable({ status: null });
exports.signImpeachmentPetition = legacyCallable();

exports.getConstitutionalCourtStatus = legacyCallable({ status: null });
exports.decideConstitutionalReview = legacyCallable();
exports.generateCourtAiVerdict = legacyCallable();
exports.getCongressStatus = legacyCallable({ bills: [] });
exports.proposeBill = legacyCallable();
exports.voteBill = legacyCallable();

exports.getHistoryArchive = legacyCallable({ events: [] });
exports.getHistoryEvent = legacyCallable({ event: null });
exports.getHistoryComments = legacyCallable({ comments: [] });
exports.addHistoryComment = legacyCallable();
exports.generateDailyParodyIssues = legacySchedule();
exports.previewHistoryIssue = legacyCallable({ issue: null });
exports.triggerParodyIssues = legacyCallable();
