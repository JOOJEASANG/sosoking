'use strict';

const SECTION_END = /(?:^|\n)\s*(판단이유|판결 이유|재판부 의견|결론)\s*[:：]?/m;

function looksLikeDatePrefix(text, markerIndex) {
  const prefix = text.slice(Math.max(0, markerIndex - 18), markerIndex);
  return /\d{1,4}[./-]\s*$/.test(prefix);
}

function normalizeSequentialList(value) {
  const text = String(value || '');
  const marker = /(^|[^\S\r\n]+)(\d{1,2})[.)][ \t]+/gm;
  let output = '';
  let cursor = 0;
  let active = false;
  let expectedNumber = 1;
  let match;

  while ((match = marker.exec(text))) {
    const delimiter = match[1] || '';
    const number = Number(match[2]);
    const markerIndex = match.index + delimiter.length;
    const dateLike = looksLikeDatePrefix(text, markerIndex);

    output += text.slice(cursor, match.index);

    let nextDelimiter = delimiter;
    if (!dateLike && number === 1) {
      active = true;
      expectedNumber = 2;
      const lineStart = text.lastIndexOf('\n', match.index - 1) + 1;
      const linePrefix = text.slice(lineStart, match.index).trim();
      if (/^(?:재판부\s*)?주문\s*[:：]?$/.test(linePrefix)) nextDelimiter = '\n';
    } else if (!dateLike && active && number === expectedNumber) {
      nextDelimiter = delimiter.includes('\n') ? delimiter : '\n';
      expectedNumber += 1;
    }

    output += `${nextDelimiter}${match[2]}. `;
    cursor = marker.lastIndex;
  }

  output += text.slice(cursor);
  return output;
}

function normalizeVerdictNumberLines(value) {
  const text = String(value || '')
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '');
  if (!text.trim()) return text;

  const orderHeading = /(?:^|\n|\s)주문\s*[:：]?\s*/m.exec(text);
  if (!orderHeading) return normalizeSequentialList(text);

  const sectionStart = orderHeading.index + orderHeading[0].length;
  const tail = text.slice(sectionStart);
  const sectionEndMatch = SECTION_END.exec(tail);
  const sectionEnd = sectionEndMatch ? sectionStart + sectionEndMatch.index : text.length;
  const before = text.slice(0, sectionStart);
  const orderSection = text.slice(sectionStart, sectionEnd);
  const after = text.slice(sectionEnd);

  return `${before}${normalizeSequentialList(orderSection)}${after}`;
}

module.exports = {
  looksLikeDatePrefix,
  normalizeSequentialList,
  normalizeVerdictNumberLines
};
