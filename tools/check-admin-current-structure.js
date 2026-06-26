'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
const admin = read('public', 'js', 'pages', 'admin.js');
const functionsMain = read('functions', 'functions-main-v2.js');
const adminContent = read('functions', 'admin-content-functions.js');
const adminCreate = read('functions', 'admin-create-functions.js');

for (const marker of [
  "{ key: 'dashboard'",
  "{ key: 'materials'",
  "{ key: 'debates'",
  "{ key: 'generate'",
  "{ key: 'ai-settings'",
  "{ key: 'members'",
  "{ key: 'inbox'",
  'getAdminOverview',
  'getAdminContentList',
  'setAdminContentStatus',
  'deleteAdminContent',
  'getAdminGenerationRuns',
  'getAdminMemberList',
  'getAdminInbox',
  'saveAiKingConfig',
]) {
  if (!admin.includes(marker)) errors.push(`admin page missing: ${marker}`);
}

for (const retired of [
  '자료에는 찬반투표나 댓글이 붙지 않습니다',
  '자료·토론 독립 관리자',
]) {
  if (admin.includes(retired)) errors.push(`retired admin wording remains: ${retired}`);
}

for (const marker of [
  "const adminContent = require('./admin-content-functions.js')",
  "const adminCreate = require('./admin-create-functions.js')",
  '...adminContent',
  '...adminCreate',
]) {
  if (!functionsMain.includes(marker)) errors.push(`deployed admin export missing: ${marker}`);
}

for (const marker of [
  'getAdminOverview',
  'getAdminContentList',
  'setAdminContentStatus',
  'deleteAdminContent',
  'getAdminGenerationRuns',
  'getAdminInbox',
  'updateAdminInboxStatus',
  'db.recursiveDelete(ref)',
  "getStorage().bucket().file(imagePath).delete",
]) {
  if (!adminContent.includes(marker)) errors.push(`admin content backend missing: ${marker}`);
}

for (const marker of [
  'adminCreateDebate',
  "status: request.data?.status === 'draft' ? 'draft' : 'published'",
  "sourceType: 'manual'",
]) {
  if (!adminCreate.includes(marker)) errors.push(`admin create backend missing: ${marker}`);
}

if (errors.length) {
  console.error('Current admin structure check failed:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Current admin structure check passed.');
