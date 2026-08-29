'use strict';

const { FieldValue } = require('firebase-admin/firestore');
const { inspectContent } = require('./content-safety');

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

  const publicCaseDescription = String(data.publicCaseDescription || '').trim();
  if (!hasOwn(data, 'publicCaseDescription') || (publicCaseDescription && !inspectContent(publicCaseDescription).safe)) {
    patch.publicCaseDescription = '';
    changed = true;
  }

  const publicNickname = String(data.publicNickname || '').trim();
  if (!hasOwn(data, 'publicNickname') || (publicNickname && !inspectContent(publicNickname).safe)) {
    patch.publicNickname = '익명 원고';
    changed = true;
  }

  if (Number(data.publicDataVersion || 0) !== 1) {
    patch.publicDataVersion = 1;
    changed = true;
  }

  return changed ? patch : null;
}

module.exports = {
  publicSanitizationPatch
};
