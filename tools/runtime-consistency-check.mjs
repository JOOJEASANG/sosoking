import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const appSafe = read('public/js/app-safe.js');
assert(appSafe.includes('appState.loading = false'), '인증 완료 시 appState.loading을 false로 바꿔야 합니다.');
assert(appSafe.includes('Promise.all([registerRoutes(), authReady])'), '첫 인증 확인 후 라우터를 시작해야 합니다.');

const multiWrite = read('public/js/multi-write.js');
assert(!multiWrite.includes('getBodyHtml'), '게시글 본문은 HTML 문자열이 아니라 일반 텍스트로 저장해야 합니다.');
assert(multiWrite.includes('const body = getBodyText();'), '게시글 제출은 getBodyText()를 사용해야 합니다.');
assert(multiWrite.includes("getElementById('mw-rich-editor')?.addEventListener('input', saveDraftSoon)"), '리치 에디터 입력도 임시저장을 실행해야 합니다.');

const registry = read('public/js/app-module-registry.js');
const removedModules = [
  './pwa-install-click-fix.js',
  './account-ui.js',
  './account-notifications-uid-fix.js',
  './account-request-cleanup.js',
  './google-profile-photo-sync.js',
  './multi-write.js',
];
removedModules.forEach(modulePath => assert(!registry.includes(modulePath), `중복 확장 모듈이 다시 등록됐습니다: ${modulePath}`));
assert(registry.includes('./account-runtime-controller.js'), '통합 내정보 컨트롤러가 등록되어야 합니다.');

const notifications = read('public/js/notifications-ui.js');
assert(notifications.includes("where('uid', '==', uid)"), '알림 조회는 uid 필드를 사용해야 합니다.');
assert(!/readAtMs\s*:/.test(notifications), '클라이언트 알림 읽음 처리에 readAtMs를 쓰면 Firestore 규칙에 거부됩니다.');
assert(notifications.includes('onAuthStateChanged(auth,'), '알림 인증 감시는 Firebase 모듈형 API를 사용해야 합니다.');
assert(!notifications.includes('auth.onAuthStateChanged('), '알림 인증 감시 호출 방식을 중복 사용하면 안 됩니다.');

const accountController = read('public/js/account-runtime-controller.js');
assert(accountController.includes("where('uid', '==', user.uid)"), '내 정보 알림함도 uid 필드를 사용해야 합니다.');
assert(!/readAtMs\s*:/.test(accountController), '내 정보 알림 읽음 처리에 readAtMs를 쓰면 안 됩니다.');

const pwa = read('public/js/pwa-install.js');
const requestStart = pwa.indexOf('export async function requestPwaInstall');
const requestBody = requestStart >= 0 ? pwa.slice(requestStart) : '';
assert(requestBody.indexOf('const prompt = getInstallPrompt()') >= 0, '설치 클릭 시 기존 프롬프트를 먼저 확인해야 합니다.');
assert(requestBody.indexOf('const prompt = getInstallPrompt()') < requestBody.indexOf('void ensureServiceWorker()'), 'PWA prompt 확인 전에 비동기 대기를 하면 사용자 클릭 권한이 끊깁니다.');
assert(pwa.includes('hasInstallRecord()'), '설치 완료 기록을 확인해 버튼 재노출을 막아야 합니다.');
assert(pwa.includes('removeInstallUi()'), '설치 완료 시 모든 설치 버튼과 안내창을 제거해야 합니다.');

const detail = read('public/js/pages/detail.js');
assert(detail.includes('onSnapshot(commentsQuery'), '상세 페이지는 새 AI 댓글을 실시간으로 반영해야 합니다.');
assert(detail.includes('renderDripAiSection'), '드립 상세에도 AI 캐릭터 반응 영역이 있어야 합니다.');
assert(detail.includes('댓글이 생성되면 자동으로 표시됩니다.'), 'AI 댓글 생성 대기 상태 안내가 필요합니다.');
assert(detail.includes('function stopCommentWatch()'), '상세 페이지 이탈 시 댓글 감시를 해제해야 합니다.');
assert(detail.includes("window.addEventListener('hashchange'"), '상세 경로 변경 시 댓글 감시 정리가 필요합니다.');

const communityPosts = read('functions/community-post-functions.js');
assert(!communityPosts.includes('await reserveDailyQuota('), '검증 전에 별도 트랜잭션으로 이용 횟수를 차감하면 안 됩니다.');
assert(communityPosts.includes('reserveQuotaInTransaction(tx, quota, quotaSnap)'), '이용 횟수 차감은 실제 저장 트랜잭션에 포함해야 합니다.');
assert(communityPosts.indexOf("if (!title) throw new HttpsError") < communityPosts.indexOf("dailyQuota(uid, 'community_post'"), '게시글 내용 검증 후 작성 제한을 준비해야 합니다.');

const imageUploader = read('public/js/components/image-uploader.js');
assert(imageUploader.includes('const MAX_UPLOAD_BYTES = 8 * 1024 * 1024'), '클라이언트 이미지 제한은 서버와 동일한 8MB여야 합니다.');
assert(imageUploader.includes('blob.size > MAX_UPLOAD_BYTES'), '압축 후 이미지 크기도 다시 검사해야 합니다.');
assert(imageUploader.includes('파일당 최대 8MB'), '업로드 화면에 파일당 8MB 제한을 표시해야 합니다.');

const uploadFunctions = read('functions/upload-image-functions.js');
assert(uploadFunctions.indexOf('parseDataUrl(request.data?.dataUrl)') < uploadFunctions.indexOf('await reserveQuota(uid)'), '서버는 정상 이미지 검증 후 업로드 횟수를 차감해야 합니다.');

const functionsMain = read('functions/functions-main-v2.js');
assert(!functionsMain.includes('...aiCharacterComments,'), '구형 AI 자동댓글 트리거 전체를 다시 export하면 중복 실행됩니다.');
assert(functionsMain.includes('...aiCharacterCommentsUnified'), '통합 AI 자동댓글 트리거가 export되어야 합니다.');
assert(functionsMain.includes('generateAiCharacterCommentsTest: aiCharacterComments.generateAiCharacterCommentsTest'), '관리자 AI 수동 테스트 callable은 유지해야 합니다.');

const html = read('public/index.html');
const stylesheetHrefs = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/g)].map(match => match[1]);
const duplicates = stylesheetHrefs.filter((href, index) => stylesheetHrefs.indexOf(href) !== index);
assert(duplicates.length === 0, `중복 CSS 링크가 있습니다: ${[...new Set(duplicates)].join(', ')}`);

if (failures.length) {
  console.error('\n런타임 일관성 검사 실패:');
  failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
  process.exit(1);
}

console.log('런타임 일관성 검사 통과');
