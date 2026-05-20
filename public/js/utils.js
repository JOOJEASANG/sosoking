import { escHtml, formatTime, computeTitle } from './utils/helpers.js';

export { escHtml, formatTime, computeTitle };

export function escapeHtml(value) {
  return escHtml(value);
}

export function escAttr(value) {
  return escHtml(value);
}

export function safeText(value, max = 1000) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

const utils = {
  escHtml,
  escapeHtml,
  escAttr,
  safeText,
  formatTime,
  computeTitle,
  formatNumber,
};

if (typeof window !== 'undefined') {
  window.SosokingUtils = Object.assign(window.SosokingUtils || {}, utils);
}

export default utils;
