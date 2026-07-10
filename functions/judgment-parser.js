const REQUIRED_HEADINGS = [
  '## ⚖️ 사건번호 및 사건명',
  '## 1. 사건의 경위',
  '## 2. 치열한 수사 과정',
  '## 3. 검사의 공소사실',
  '## 4. 변호인의 최후변론',
  '## 👨‍⚖️ 판사의 최종 판결',
];

function cleanLong(value, maxLength = 18000) {
  return String(value || '')
    .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\r/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, maxLength);
}

function cleanText(value, maxLength = 200) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[-*#\s]+/, '')
    .trim()
    .slice(0, maxLength);
}

function headingIndex(lines, prefix) {
  return lines.findIndex(line => line.trim().startsWith(prefix));
}

function sectionText(lines, start, end) {
  if (start < 0) return '';
  const last = end >= 0 ? end : lines.length;
  return cleanLong(lines.slice(start + 1, last).join('\n'));
}

function parseOrders(orderText) {
  const lines = cleanLong(orderText).split('\n');
  const orders = [];
  const trailingLines = [];
  let current = null;

  function commitCurrent() {
    if (!current) return;
    current.text = cleanLong(current.text, 700);
    if (current.text) orders.push(current);
    current = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const numbered = line.match(/^([1-3])\.\s*(.*)$/);
    if (numbered) {
      commitCurrent();
      current = { number: Number(numbered[1]), text: numbered[2] };
      continue;
    }

    if (!line) {
      commitCurrent();
      if (orders.length >= 3 && trailingLines.length) trailingLines.push('');
      continue;
    }

    if (current) {
      current.text += `\n${line}`;
    } else if (orders.length) {
      trailingLines.push(line);
    }
  }
  commitCurrent();

  const uniqueOrders = [];
  for (const order of orders.sort((a, b) => a.number - b.number)) {
    if (!uniqueOrders.some(existing => existing.number === order.number)) uniqueOrders.push(order);
  }

  return {
    orders: uniqueOrders,
    sentence: cleanLong(uniqueOrders.map(order => `${order.number}. ${order.text}`).join('\n'), 2400),
    trailing: cleanLong(trailingLines.join('\n'), 1200),
  };
}

function verdictLabel(opinion, sentence) {
  const text = `${opinion} ${sentence}`;
  if (text.includes('전부 기각')) return '원고 청구 전부 기각';
  if (text.includes('기각')) return '원고 청구 일부 기각';
  if (text.includes('쌍방')) return '쌍방 생활과실 인정';
  if (text.includes('인용') || text.includes('인정')) return '원고 마음속 일부 승소';
  return '생활평온 회복명령';
}

function parseJudgmentScript(value) {
  const script = cleanLong(value);
  if (!script || !REQUIRED_HEADINGS.every(heading => script.includes(heading))) {
    return null;
  }

  const lines = script.split('\n');
  const indexes = {
    cover: headingIndex(lines, '## ⚖️ 사건번호 및 사건명'),
    facts: headingIndex(lines, '## 1. 사건의 경위'),
    investigation: headingIndex(lines, '## 2. 치열한 수사 과정'),
    plaintiff: headingIndex(lines, '## 3. 검사의 공소사실'),
    defendant: headingIndex(lines, '## 4. 변호인의 최후변론'),
    judgment: headingIndex(lines, '## 👨‍⚖️ 판사의 최종 판결'),
  };

  if (Object.values(indexes).some(index => index < 0)) return null;

  const cover = sectionText(lines, indexes.cover, indexes.facts);
  const facts = sectionText(lines, indexes.facts, indexes.investigation);
  const investigation = sectionText(lines, indexes.investigation, indexes.plaintiff);
  const plaintiff = sectionText(lines, indexes.plaintiff, indexes.defendant);
  const defendant = sectionText(lines, indexes.defendant, indexes.judgment);
  const judgment = sectionText(lines, indexes.judgment, -1);
  const orderMarker = judgment.indexOf('[주문]');
  const opinion = cleanLong(orderMarker >= 0 ? judgment.slice(0, orderMarker) : judgment, 5000);
  const orderBlock = orderMarker >= 0 ? judgment.slice(orderMarker + '[주문]'.length) : '';
  const parsedOrders = parseOrders(orderBlock);
  const closingComment = cleanText(
    parsedOrders.trailing.split(/\n\s*\n/).filter(Boolean).at(-1) || '',
    180
  );

  if (!facts || !investigation || !plaintiff || !defendant || !opinion || parsedOrders.orders.length < 3) {
    return null;
  }

  return {
    cover,
    facts,
    investigation,
    plaintiff,
    defendant,
    opinion,
    sentence: parsedOrders.sentence,
    orders: parsedOrders.orders,
    closingComment,
    quickVerdict: verdictLabel(opinion, parsedOrders.sentence),
    primarySentence: cleanText(parsedOrders.orders[0]?.text || '', 220),
  };
}

function scriptFingerprint(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

module.exports = { parseJudgmentScript, scriptFingerprint };
