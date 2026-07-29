'use strict';

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { FieldValue } = require('firebase-admin/firestore');

const REGION = 'asia-northeast3';
const SENSITIVE_FIELDS = ['userId', 'caseDescription', 'nickname'];

function hasOwn(data, key) {
  return Object.prototype.hasOwnProperty.call(data || {}, key);
}

function publicSanitizationPatch(data = {}) {
  if (data.isPublic !== true) return null;

  const patch = {};
  let changed = false;

  for (const field of SENSITIVE_FIELDS) {
    if (hasOwn(data, field)) {
      patch[field] = FieldValue.delete();
      changed = true;
    }
  }

  if (!hasOwn(data, 'publicCaseDescription')) {
    patch.publicCaseDescription = '';
    changed = true;
  }
  if (!hasOwn(data, 'publicNickname')) {
    patch.publicNickname = '익명 원고';
    changed = true;
  }
  if (Number(data.publicDataVersion || 0) !== 1) {
    patch.publicDataVersion = 1;
    changed = true;
  }

  return changed ? patch : null;
}

exports.sanitizePublicResult = onDocumentWritten({
  document: 'results/{caseId}',
  region: REGION,
  timeoutSeconds: 60,
  memory: '256MiB',
  maxInstances: 20
}, async event => {
  const after = event.data?.after;
  if (!after?.exists) return;

  const patch = publicSanitizationPatch(after.data() || {});
  if (!patch) return;

  await after.ref.set(patch, { merge: true });
  console.log('sanitized public result document:', event.params.caseId);
});

Object.defineProperty(module.exports, 'publicSanitizationPatch', {
  value: publicSanitizationPatch,
  enumerable: false
});
