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

const accountController = read('public/js/account-runtime-controller.js');
assert(accountController.includes("where('uid', '==', user.uid)"), '내 정보 알림함도 uid 필드를 사용해야 합니다.');
assert(!/readAtMs\s*:/.test(accountController), '내 정보 알림 읽음 처리에 readAtMs를 쓰면 안 됩니다.');

const pwa = read('public/js/pwa-install.js');
const requestStart = pwa.indexOf('export async function requestPwaInstall');
const requestBody = requestStart >= 0 ? pwa.slice(requestStart) : '';
assert(requestBody.indexOf('const prompt = getInstallPrompt()') >= 0, '설치 클릭 시 기존 프롬프트를 먼저 확인해야 합니다.');
assert(requestBody.indexOf('const prompt = getInstallPrompt()') < requestBody.indexOf('void ensureServiceWorker()'), 'PWA prompt 확인 전에 비동기 대기를 하면 사용자 클릭 권한이 끊깁니다.');

const detail = read('public/js/pages/detail.js');
assert(detail.includes('onSnapshot(commentsQuery'), '상세 페이지는 새 AI 댓글을 실시간으로 반영해야 합니다.');
assert(detail.includes('renderDripAiSection'), '드립 상세에도 AI 캐릭터 반응 영역이 있어야 합니다.');
assert(detail.includes('댓글이 생성되면 자동으로 표시됩니다.'), 'AI 댓글 생성 대기 상태 안내가 필요합니다.');

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
