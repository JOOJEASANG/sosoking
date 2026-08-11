import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  payloadRecords,
  validateDeployedFunctions
} from './check-deployed-functions.mjs';

// 실제 운영 배포의 strict drift 검사에서 확인됐고 현재 source export에는 없는
// 과거 Functions만 명시적으로 정리한다. 이 목록 밖의 예상치 못한 Function은
// 자동 삭제하지 않고 배포를 중단해 수동 검토하도록 한다.
const KNOWN_OBSOLETE_FUNCTIONS = new Set([
  'addDripParticipation',
  'addDripReply',
  'addDripsoComment',
  'castCommunityVote',
  'cleanupNotifications',
  'createCommunityPost',
  'createDailyAiCase',
  'createDripsoBattle',
  'createDripsoTopic',
  'createDripsoTournamentBattle',
  'createOfficialDripsoBattleNow',
  'dailyAdminAutomation',
  'dailyAiContent',
  'deleteAdminDocument',
  'deleteFeedPostDeep',
  'deleteMyAccount',
  'deleteOwnDripsoComment',
  'deleteOwnDripsoTopic',
  'deleteOwnPost',
  'deleteUploadedFeedImages',
  'generateAiCharacterCommentsTest',
  'generateAiContentNow',
  'generateAllAiContentNow',
  'generateCourtCase',
  'generateCourtCaseV3',
  'generateCourtCaseV6',
  'generateCourtCaseV7',
  'generateLatestAiCharacterComments',
  'getAdminAutomationStatus',
  'getAdminMemberList',
  'getAiCharacterSettings',
  'getDailyRealCourt',
  'getDripsoBattleMatchup',
  'getDripsoBattleView',
  'getDripsoOwnership',
  'getDripsoTournamentMatchup',
  'getDripsoTournamentView',
  'getRegisteredMemberCount',
  'incrementPostView',
  'kakaoLogin',
  'listAdminCollectionDocs',
  'listAdminCollections',
  'migrateCommunityData',
  'migrateCommunityDataOnce',
  'moderateDripsoReport',
  'onCommentCreated',
  'onCommentDeleted',
  'onCreateAiCharacterCommentsUnified',
  'onFeedPostCreate',
  'onReportCreate',
  'provisionUserProfile',
  'publishDailyOfficialDripsoBattle',
  'reactDripItem',
  'reactToComment',
  'reactToPost',
  'runAdminAutomationNow',
  'sanitizePublicResult',
  'saveAiCharacterSettings',
  'saveAiConfig',
  'seoPost',
  'sitemapXml',
  'submitDailyRealCourtVerdict',
  'submitDripsoBattleEntry',
  'submitDripsoReport',
  'submitDripsoTournamentEntry',
  'summarizeLink',
  'syncAcrosticAuthorIconOnCreate',
  'syncCommentAuthorIconOnCreate',
  'syncFeedAuthorIconOnCreate',
  'toggleDripsoCommentLike',
  'updateCommunityPost',
  'updateNickname',
  'updateUserTitle',
  'uploadFeedImage',
  'voteDripsoBattleMatchup',
  'voteDripsoTournamentMatchup'
]);

function classifyObsoleteFunctions(records) {
  const { unexpected } = validateDeployedFunctions(records);
  return {
    removable: unexpected.filter(name => KNOWN_OBSOLETE_FUNCTIONS.has(name)),
    unknown: unexpected.filter(name => !KNOWN_OBSOLETE_FUNCTIONS.has(name))
  };
}

function run(inputPath) {
  if (!inputPath || !fs.existsSync(inputPath)) {
    console.error('Usage: node tools/list-obsolete-deployed-functions.mjs <firebase-functions-list.json>');
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const records = payloadRecords(payload);
  if (!records.length && payload.status !== 'success') {
    console.error('Firebase Functions 목록 JSON을 해석하지 못했습니다.');
    process.exit(1);
  }

  const { removable, unknown } = classifyObsoleteFunctions(records);
  if (unknown.length) {
    console.error(`Unknown unmanaged Functions require review: ${unknown.join(', ')}`);
    process.exit(2);
  }

  process.stdout.write(removable.join('\n'));
  if (removable.length) process.stdout.write('\n');
}

const invokedAsScript = Boolean(process.argv[1])
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) run(process.argv[2]);

export {
  KNOWN_OBSOLETE_FUNCTIONS,
  classifyObsoleteFunctions
};
