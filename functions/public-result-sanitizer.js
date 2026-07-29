'use strict';

const { FieldValue } = require('firebase-admin/firestore');

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

module.exports = {
  publicSanitizationPatch
};
