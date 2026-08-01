'use strict';

function looksLikeDatePrefix(text, markerIndex) {
  const prefix = text.slice(Math.max(0, markerIndex - 12), markerIndex);
  return /\d{2,4}[./-]\s*$/.test(prefix);
}

function splitSequentialOrderText(startNumber, value) {
  const firstNumber = Number(startNumber);
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!Number.isInteger(firstNumber) || firstNumber < 1 || !text) {
    return [{ number: firstNumber || 1, text }];
  }

  const items = [];
  const marker = /\s+(\d{1,2})[.)]\s+/g;
  let currentNumber = firstNumber;
  let expectedNumber = firstNumber + 1;
  let cursor = 0;
  let match;

  while ((match = marker.exec(text))) {
    const number = Number(match[1]);
    if (number !== expectedNumber || looksLikeDatePrefix(text, match.index)) continue;

    const currentText = text.slice(cursor, match.index).trim();
    if (!currentText) continue;

    items.push({ number: currentNumber, text: currentText });
    currentNumber = number;
    expectedNumber = number + 1;
    cursor = marker.lastIndex;
  }

  if (!items.length) return [{ number: firstNumber, text }];
  items.push({ number: currentNumber, text: text.slice(cursor).trim() });
  return items.filter(item => item.text);
}

function createOrderItem(number, text) {
  const item = document.createElement('div');
  item.className = 'doc-order-item';
  item.dataset.verdictNumberLine = 'true';

  const marker = document.createElement('span');
  marker.className = 'doc-order-number';
  marker.textContent = `${number}.`;

  const body = document.createElement('p');
  body.className = 'doc-order-text';
  body.textContent = text;

  item.append(marker, body);
  return item;
}

function reflowOrderItem(item) {
  if (!(item instanceof HTMLElement) || item.dataset.verdictNumberLine === 'true') return false;

  const markerText = item.querySelector('.doc-order-number')?.textContent || '';
  const startNumber = Number(markerText.match(/\d{1,2}/)?.[0] || 0);
  const body = item.querySelector('.doc-order-text');
  if (!startNumber || !body) return false;

  const parts = splitSequentialOrderText(startNumber, body.textContent || '');
  if (parts.length < 2) {
    item.dataset.verdictNumberLine = 'true';
    return false;
  }

  const fragment = document.createDocumentFragment();
  parts.forEach(part => fragment.appendChild(createOrderItem(part.number, part.text)));
  item.replaceWith(fragment);
  return true;
}

function reflowAll(root = document) {
  root.querySelectorAll?.('.court-formatted-body .doc-order-item').forEach(reflowOrderItem);
}

function start() {
  const host = document.getElementById('page-content') || document.body;
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      reflowAll(host);
    });
  };

  reflowAll(host);
  new MutationObserver(schedule).observe(host, { childList: true, subtree: true });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

export { reflowAll, splitSequentialOrderText };
