'use strict';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MATERIAL_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

function cleanText(value, maxLength = 500) {
  return String(value || '').replace(/[<>\u0000]/g, '').trim().slice(0, maxLength);
}

function isValidDateKey(value) {
  const date = String(value || '');
  if (!DATE_PATTERN.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function parseDateKey(value, fallback) {
  const cleaned = cleanText(value, 10);
  if (!cleaned) return fallback;
  if (!isValidDateKey(cleaned)) throw new Error('invalid-date');
  return cleaned;
}

function isDateWithinDays(value, centerValue, days) {
  if (!isValidDateKey(value) || !isValidDateKey(centerValue)) return false;
  const valueMs = Date.parse(`${value}T00:00:00Z`);
  const centerMs = Date.parse(`${centerValue}T00:00:00Z`);
  return Math.abs(valueMs - centerMs) <= Math.max(0, days) * 86400000;
}

function isValidMaterialId(value) {
  return MATERIAL_ID_PATTERN.test(String(value || ''));
}

function clampLimit(value, fallback, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(maximum, Math.floor(parsed)));
}

function normalizeVoteSide(value) {
  const side = cleanText(value, 20);
  return side === 'agree' || side === 'disagree' ? side : null;
}

function normalizeCommentSide(value) {
  const side = cleanText(value || 'neutral', 20);
  return ['agree', 'disagree', 'neutral'].includes(side) ? side : 'neutral';
}

function nextVoteCounts(current, before, after) {
  let agreeCount = Math.max(0, Number(current?.agreeCount || 0));
  let disagreeCount = Math.max(0, Number(current?.disagreeCount || 0));
  if (before === 'agree') agreeCount = Math.max(0, agreeCount - 1);
  if (before === 'disagree') disagreeCount = Math.max(0, disagreeCount - 1);
  if (after === 'agree') agreeCount += 1;
  if (after === 'disagree') disagreeCount += 1;
  return { agreeCount, disagreeCount };
}

module.exports = {
  cleanText,
  isValidDateKey,
  parseDateKey,
  isDateWithinDays,
  isValidMaterialId,
  clampLimit,
  normalizeVoteSide,
  normalizeCommentSide,
  nextVoteCounts,
};
