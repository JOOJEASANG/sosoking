import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const backend = read('functions/public-original.js');
const functionsMain = read('functions/main.js');
const workflow = read('.github/workflows/firebase-deploy.yml');
const resultPage = read('public/js/pages/result-comments.js');
const app = read('public/js/app.js');
const worker = read('public/sw.js');

for (const required of [
  "exports.getPublicCaseOriginal = onCall",
  "resultSnap.data().isPublic !== true",
  "const safety = inspectContent(caseDescription);",
  "개인정보 보호를 위해 이 접수 원문은 공개할 수 없습니다.",
  "caseDescription"
]) {
  assert.ok(backend.includes(required), `공개 접수 원문 함수 안전장치가 누락되었습니다: ${required}`);
}

assert.ok(functionsMain.includes("require('./public-original')"), '공개 접수 원문 함수가 Functions 엔트리에서 export되어야 합니다.');
assert.ok(workflow.includes('functions:getPublicCaseOriginal'), 'Firebase 배포 대상에 공개 접수 원문 함수가 포함되어야 합니다.');

for (const required of [
  "if (!container.querySelector('#court-comment-input')) return;",
  "trigger.textContent = '📄 원문보기';",
  "layer.setAttribute('role', 'dialog');",
  "layer.setAttribute('aria-modal', 'true');",
  "httpsCallable(functions, 'getPublicCaseOriginal')",
  "event.key === 'Escape'",
  "data-original-close=\"true\"",
  "AI가 정리한 사건접수보고서가 아니라"
]) {
  assert.ok(resultPage.includes(required), `공개 판결 원문 레이어 기능이 누락되었습니다: ${required}`);
}

const version = '20260801-public-original-modal-1';
assert.ok(app.includes(`./pages/result-comments.js?v=${version}`), 'app.js가 원문 레이어 버전의 공개 판결 화면을 불러와야 합니다.');
assert.ok(worker.includes(`sosoking-app-v${version}`), '서비스워커 캐시 이름이 원문 레이어 버전으로 갱신되어야 합니다.');
assert.ok(worker.includes(`/js/pages/result-comments.js?v=${version}`), '서비스워커가 원문 레이어 모듈을 선행 캐시해야 합니다.');

console.log('Public original submission modal validation passed: public-only server lookup, safety recheck, accessible layer controls, and cache graph are connected.');
