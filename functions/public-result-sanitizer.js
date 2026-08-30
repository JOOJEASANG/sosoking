'use strict';

const { FieldValue } = require('firebase-admin/firestore');
const { inspectContent } = require('./content-safety');

const SENSITIVE_FIELDS = ['userId', 'caseDescription', 'nickname'];

function hasOwn(data, key) {
  return Object.prototype.hasOwnProperty.call(data || {}, key);
}

function safePublicCaseDescription(value) {
  const text = String(value || '').trim().slice(0, 600);
  if (!text) return '';
  return inspectContent(text).safe ? text : '';
}

function safePublicNickname(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 20);
  if (!text) return '익명 원고';
  return inspectContent(text, { allowHighRisk: true }).safe ? text : '익명 원고';
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

  const nextDescription = safePublicCaseDescription(data.publicCaseDescription);
  if (!hasOwn(data, 'publicCaseDescription') || data.publicCaseDescription !== nextDescription) {
    patch.publicCaseDescription = nextDescription;
    changed = true;
  }

  const nextNickname = safePublicNickname(data.publicNickname);
  if (!hasOwn(data, 'publicNickname') || data.publicNickname !== nextNickname) {
    patch.publicNickname = nextNickname;
    changed = true;
  }

  if (Number(data.publicDataVersion || 0) !== 1) {
    patch.publicDataVersion = 1;
    changed = true;
  }

  return changed ? patch : null;
}

module.exports = {
  publicSanitizationPatch,
  safePublicCaseDescription,
  safePublicNickname
};
