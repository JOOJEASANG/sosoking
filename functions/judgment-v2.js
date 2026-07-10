const JUDGMENT_SCHEMA_VERSION = 2;

function cleanText(value, maxLength = 240) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanParagraph(value, maxLength = 6000) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, maxLength);
}

function extractJson(value) {
  const raw = String(value || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Judgment JSON object not found');
  return JSON.parse(raw.slice(start, end + 1));
}

function normalizeOrders(value, fallback = []) {
  const source = Array.isArray(value) && value.length ? value : fallback;
  const orders = source
    .map((item, index) => {
      if (typeof item === 'string') {
        const match = item.trim().match(/^(\d+)\.\s*(.+)$/s);
        return {
          number: Number(match?.[1] || index + 1),
          text: cleanParagraph(match?.[2] || item, 600),
        };
      }
      return {
        number: Number(item?.number || index + 1),
        text: cleanParagraph(item?.text, 600),
      };
    })
    .filter(item => item.text)
    .slice(0, 5);

  const seen = new Set();
  return orders.filter(item => {
    if (!Number.isFinite(item.number) || item.number < 1 || seen.has(item.number)) return false;
    seen.add(item.number);
    return true;
  }).sort((a, b) => a.number - b.number);
}

function normalizeJudgment(value = {}, fallback = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const base = fallback && typeof fallback === 'object' && !Array.isArray(fallback) ? fallback : {};
  return {
    headline: cleanText(source.headline, 180) || cleanText(base.headline, 180),
    incidentLevel: cleanText(source.incidentLevel, 100) || cleanText(base.incidentLevel, 100),
    breakingNews: cleanParagraph(source.breakingNews, 700) || cleanParagraph(base.breakingNews, 700),
    emergencyBriefing: cleanParagraph(source.emergencyBriefing, 5000) || cleanParagraph(base.emergencyBriefing, 5000),
    impactAssessment: cleanParagraph(source.impactAssessment, 4000) || cleanParagraph(base.impactAssessment, 4000),
    summary: cleanParagraph(source.summary, 700) || cleanParagraph(base.summary, 700),
    facts: cleanParagraph(source.facts, 5000) || cleanParagraph(base.facts, 5000),
    investigation: cleanParagraph(source.investigation, 5000) || cleanParagraph(base.investigation, 5000),
    plaintiffClaim: cleanParagraph(source.plaintiffClaim, 700) || cleanParagraph(base.plaintiffClaim, 700),
    defendantClaim: cleanParagraph(source.defendantClaim, 700) || cleanParagraph(base.defendantClaim, 700),
    prosecution: cleanParagraph(source.prosecution, 4000) || cleanParagraph(base.prosecution, 4000),
    defense: cleanParagraph(source.defense, 4000) || cleanParagraph(base.defense, 4000),
    opinion: cleanParagraph(source.opinion, 5000) || cleanParagraph(base.opinion, 5000),
    orders: normalizeOrders(source.orders, base.orders),
    closingComment: cleanText(source.closingComment, 400) || cleanText(base.closingComment, 400),
    legalNotice: cleanText(source.legalNotice, 500) || cleanText(base.legalNotice, 500),
  };
}

function isCompleteJudgment(value = {}) {
  const judgment = normalizeJudgment(value);
  return !!(
    judgment.headline.length >= 5 &&
    judgment.summary.length >= 20 &&
    judgment.facts.length >= 80 &&
    judgment.investigation.length >= 80 &&
    judgment.prosecution.length >= 40 &&
    judgment.defense.length >= 40 &&
    judgment.opinion.length >= 80 &&
    judgment.orders.length >= 3 &&
    judgment.orders.every(order => order.text.length >= 10) &&
    judgment.closingComment.length >= 5 &&
    judgment.legalNotice.length >= 10
  );
}

function ordersAsText(orders = []) {
  return normalizeOrders(orders).map(order => `${order.number}. ${order.text}`).join('\n');
}

module.exports = {
  JUDGMENT_SCHEMA_VERSION,
  cleanText,
  cleanParagraph,
  extractJson,
  normalizeOrders,
  normalizeJudgment,
  isCompleteJudgment,
  ordersAsText,
};
