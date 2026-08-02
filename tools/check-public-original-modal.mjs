import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const backend = read('functions/public-original.js');
const functionsMain = read('functions/main.js');
const workflow = read('.github/workflows/firebase-deploy.yml');
const resultPage = read('public/js/pages/result-comments.js');
const cacheGuard = read('public/js/original-inline-accordion-guard.js');
const index = read('public/index.html');

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
  "addOriginalAccordion(container, caseId)",
  "judgeSummary.insertAdjacentElement('beforebegin', accordion)",
  "data-original-accordion-trigger=\"true\"",
  "aria-expanded=\"false\"",
  "📄 접수 원문 펼쳐보기",
  "📄 접수 원문 접기",
  "httpsCallable(functions, 'getPublicCaseOriginal')",
  "panel.hidden = !willOpen",
  "AI가 정리한 사건접수보고서가 아니라"
]) {
  assert.ok(resultPage.includes(required), `공개 판결 원문 펼침 기능이 누락되었습니다: ${required}`);
}

for (const retired of [
  "layer.setAttribute('role', 'dialog')",
  "layer.setAttribute('aria-modal', 'true')",
  "header.appendChild(trigger)",
  "body.result-original-open"
]) {
  assert.ok(!resultPage.includes(retired), `상단 버튼 또는 모달 방식이 남아 있습니다: ${retired}`);
}

for (const required of [
  "page.querySelectorAll('.result-original-layer').forEach(layer => layer.remove())",
  "legacyTrigger?.remove()",
  "createAccordion(page, caseId)",
  "new MutationObserver(schedule)",
  "data.originalSource = 'cache-guard'"
]) {
  assert.ok(cacheGuard.includes(required), `기존 캐시 원문 버튼 정리 보호가 누락되었습니다: ${required}`);
}

const guardVersion = '20260802-original-inline-accordion-1';
assert.ok(index.includes(`/js/original-inline-accordion-guard.js?v=${guardVersion}`), 'index.html이 새 원문 펼침 보호 스크립트를 불러와야 합니다.');

console.log('Public original submission validation passed: public-only server lookup, safety recheck, inline accordion controls, and stale-cache cleanup are connected.');
