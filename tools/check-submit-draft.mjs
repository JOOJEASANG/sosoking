import fs from 'node:fs';

const errors = [];
const guard = fs.readFileSync('public/js/submit-draft-guard.js', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');

for (const required of [
  "const DRAFT_PREFIX = 'sosoking:case-submit-draft:v1:'",
  'auth.currentUser?.uid',
  'localStorage.getItem(key)',
  'localStorage.setItem(key',
  'localStorage.removeItem(key)',
  'AUTO_SAVE_DELAY_MS',
  "form.querySelector('#case-desc')",
  '지금 임시저장',
  '임시본 삭제',
  '임시저장 내용을 불러왔습니다',
  "window.addEventListener('hashchange'",
  "nextHash.startsWith('#/trial/')",
  "window.addEventListener('pagehide'",
  "document.addEventListener('visibilitychange'",
  "description.dispatchEvent(new Event('input'",
  "form.dataset.submitDraftAttached = 'true'"
]) {
  if (!guard.includes(required)) {
    errors.push(`public/js/submit-draft-guard.js: draft behavior missing: ${required}`);
  }
}

for (const forbidden of [
  'setDoc(',
  'addDoc(',
  'updateDoc(',
  'httpsCallable(',
  'sessionStorage.setItem('
]) {
  if (guard.includes(forbidden)) {
    errors.push(`public/js/submit-draft-guard.js: draft must stay local-only: ${forbidden}`);
  }
}

if (!index.includes('/js/submit-draft-guard.js?v=20260807-submit-draft-1')) {
  errors.push('public/index.html: versioned submit draft guard is not loaded');
}

if (errors.length) {
  console.error(`Submit draft validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Submit draft validation passed: account-scoped browser autosave, manual save, restore/edit, clear, and successful-submission cleanup are present.');
