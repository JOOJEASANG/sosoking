import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { payloadRecords, validateDeployedFunctions } from './check-deployed-functions.mjs';

// 게임 전용 전환에서 명시적으로 폐기한 판결소 Functions와 과거 Functions만
// 정리한다. 이 목록 밖의 예상치 못한 Function은 자동 삭제하지 않는다.
const RETIRED_FUNCTIONS = new Set([
  'addCourtComment',
  'addDiscussionComment',
  'castCommunityVote',
  'checkNickname',
  'cleanupNotifications',
  'createCommunityPost',
  'createDailyAiCase',
  'dailyAdminAutomation',
  'dailyAiContent',
  'deleteAdminDocument',
  'deleteCourtPost',
  'deleteFeedPostDeep',
  'deleteMyAccount',
  'deleteOwnCourtPost',
  'deleteOwnPost',
  'deleteUploadedFeedImages',
  'deleteUserProfile',
  'generateAiCharacterCommentsTest',
  'generateAiContentNow',
  'generateAllAiContentNow',
  'generateCourtCase',
  'generateCourtCaseV3',
  'generateCourtCaseV6',
  'generateCourtCaseV7',
  'generateDailyAiNow',
  'generateLatestAiCharacterComments',
  'generateTrial',
  'getAdminAutomationStatus',
  'getAdminMemberList',
  'getAiCharacterSettings',
  'getDailyRealCourt',
  'getPublicCaseOriginal',
  'getRegisteredMemberCount',
  'incrementPostView',
  'kakaoLogin',
  'listAdminCollectionDocs',
  'listAdminCollections',
  'migrateCommunityData',
  'migrateCommunityDataOnce',
  'migrateLegacyCaseIds',
  'moderateReport',
  'onCommentCreated',
  'onCommentDeleted',
  'onCreateAiCharacterCommentsUnified',
  'onFeedPostCreate',
  'onReportCreate',
  'provisionUserProfile',
  'publicResultPage',
  'publicSitemap',
  'reactToComment',
  'reactToPost',
  'requestAppeal',
  'resolveCaseAlias',
  'runAdminAutomationNow',
  'sanitizePublicResult',
  'saveAiCharacterSettings',
  'saveAiConfig',
  'seoPost',
  'setAdminResultVisibility',
  'setNickname',
  'setResultVisibility',
  'sitemapXml',
  'submitCase',
  'submitDailyRealCourtVerdict',
  'submitReport',
  'summarizeLink',
  'syncAcrosticAuthorIconOnCreate',
  'syncCommentAuthorIconOnCreate',
  'syncFeedAuthorIconOnCreate',
  'syncPublicStats',
  'syncPublicStatsNow',
  'updateCommunityPost',
  'updateNickname',
  'updateUserTitle',
  'uploadFeedImage',
  'voteResult'
]);

function classifyObsoleteFunctions(records) {
  const { unexpected } = validateDeployedFunctions(records);
  return {
    removable: unexpected.filter(name => RETIRED_FUNCTIONS.has(name)),
    unknown: unexpected.filter(name => !RETIRED_FUNCTIONS.has(name))
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

export { RETIRED_FUNCTIONS, classifyObsoleteFunctions };
