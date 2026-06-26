'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
const requireText = (source, text, label) => {
  if (!source.includes(text)) errors.push(`${label}: ${text}`);
};

const mainFunctions = require(path.join(ROOT, 'functions', 'functions-main-v2.js'));
const accountCleanup = require(path.join(ROOT, 'functions', 'account-cleanup-functions.js'));
const debateComments = require(path.join(ROOT, 'functions', 'debate-comment-functions.js'));

const accountCleanupSource = read('functions', 'account-cleanup-functions.js');
const communityCleanupSource = read('functions', 'community-cleanup-functions.js');
const debateCommentSource = read('functions', 'debate-comment-functions.js');
const runtimeSource = read('functions', 'ai-runtime-provider.js');
const secureConfigSource = read('functions', 'secure-ai-config-functions.js');
const imageUploadSource = read('public', 'js', 'utils', 'image-upload.js');
const commentSyncSource = read('public', 'js', 'debate-comment-choice-sync.js');

if (mainFunctions.deleteMyAccount !== accountCleanup.deleteMyAccount) {
  errors.push('deployed deleteMyAccount is not the full Firebase cleanup implementation');
}
if (mainFunctions.addDebateComment !== debateComments.addDebateComment) {
  errors.push('deployed addDebateComment does not enforce the stored A/B vote');
}

for (const marker of [
  'removeOwnedFeeds',
  'removeAuthoredContent',
  'removePrivateRecords',
  'removeNicknameReservations',
  'removeUserFiles',
  '`community/materials/${userId}/`',
  '`community/debates/${userId}/`',
  'db.recursiveDelete(userRef)',
  'auth.deleteUser(userId)',
]) {
  requireText(accountCleanupSource, marker, 'account cleanup missing');
}

for (const marker of [
  "document: 'users/{userId}'",
  "removeOwnedCollection('materials'",
  "removeOwnedCollection('debates'",
]) {
  requireText(communityCleanupSource, marker, 'community cleanup trigger missing');
}

for (const marker of [
  'transaction.get(voteRef)',
  "throw new HttpsError('failed-precondition'",
  'side: commentSide',
]) {
  requireText(debateCommentSource, marker, 'debate comment vote enforcement missing');
}

for (const marker of [
  "const activeModel = 'gemini'",
  "data.activeModel === 'anthropic'",
  'Anthropic Secret과 배포 설정',
]) {
  requireText(secureConfigSource, marker, 'AI provider configuration guard missing');
}
for (const marker of [
  'anthropicAvailable',
  "provider: data.activeModel === 'anthropic' && anthropicAvailable ? 'anthropic' : 'gemini'",
]) {
  requireText(runtimeSource, marker, 'AI runtime provider availability guard missing');
}

for (const marker of [
  'function shrinkSize',
  'Math.min(width, Math.round(width * scale))',
  'blob.size > MAX_OUTPUT_BYTES',
]) {
  requireText(imageUploadSource, marker, 'image optimization safety missing');
}
if (imageUploadSource.includes('Math.max(640, Math.round(width * 0.82))')
  || imageUploadSource.includes('Math.max(480, Math.round(height * 0.82))')) {
  errors.push('image optimization can upscale the source image');
}
if (imageUploadSource.includes('blob.size > 3 * 1024 * 1024')) {
  errors.push('image output limit is inconsistent with the 1.8MB UI promise');
}

for (const marker of [
  'function setIfChanged',
  'function scheduleSync',
  'if (syncScheduled) return',
]) {
  requireText(commentSyncSource, marker, 'debate comment DOM synchronization guard missing');
}
if (commentSyncSource.includes('new MutationObserver(() => syncCommentChoice())')) {
  errors.push('debate comment observer can continuously retrigger itself');
}

if (errors.length) {
  console.error('Full audit contract check failed:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Full audit contract check passed.');
