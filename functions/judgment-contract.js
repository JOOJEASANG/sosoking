const { cleanText, cleanParagraph, words } = require('./case-analysis');

const CANNED_PHRASES = [
  '기대질서', '생활대응체계', '생활질서 이탈', '상호배려질서', '정식 분쟁으로 성장',
  '사회적 신뢰 붕괴', '관계기관 긴급 소집', '국가적 재난', '사건의 크기보다',
  '한 번의 확인이면', '확인 먼저, 행동 나중', '원상회복과 재발방지',
  '시간·기분·편의 중 하나 이상', '사소한 행동 하나가', '정식 심리 개시',
];

const CONTRAST_MARKERS = [
  '했지만', '였지만', '성공', '실패', '문제는', '다만', '결국', '없었다',
  '남았다', '중이었다', '도착', '사라졌다', '살아 있었다', '끝났다', '불탔다',
  '대신', '오히려', '정작', '반면',
];

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeStringList(value, fallback = [], limit = 3, maxLength = 180) {
  const source = Array.isArray(value) && value.length ? value : fallback;
  const seen = new Set();
  return source
    .map(item => cleanText(item, maxLength))
    .filter(item => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function normalizeOrders(value, fallback = []) {
  const source = Array.isArray(value) && value.length ? value : fallback;
  return source
    .map((item, index) => ({
      number: Number(item?.number || index + 1),
      text: cleanParagraph(typeof item === 'string' ? item : item?.text, 500),
    }))
    .filter(item => Number.isInteger(item.number) && item.number > 0 && item.text)
    .slice(0, 3)
    .map((item, index) => ({ number: index + 1, text: item.text }));
}

function normalizeJudgment(raw = {}, fallback = {}) {
  return {
    headline: cleanText(raw.headline, 160) || cleanText(fallback.headline, 160),
    incidentLevel: cleanText(raw.incidentLevel, 100) || cleanText(fallback.incidentLevel, 100),
    opening: cleanParagraph(raw.opening, 800) || cleanParagraph(fallback.opening, 800),
    comedyLines: normalizeStringList(raw.comedyLines, fallback.comedyLines, 3, 180),
    summary: cleanParagraph(raw.summary, 700) || cleanParagraph(fallback.summary, 700),
    facts: cleanParagraph(raw.facts, 1800) || cleanParagraph(fallback.facts, 1800),
    investigation: cleanParagraph(raw.investigation, 1600) || cleanParagraph(fallback.investigation, 1600),
    plaintiffClaim: cleanParagraph(raw.plaintiffClaim, 700) || cleanParagraph(fallback.plaintiffClaim, 700),
    defendantClaim: cleanParagraph(raw.defendantClaim, 700) || cleanParagraph(fallback.defendantClaim, 700),
    opinion: cleanParagraph(raw.opinion, 1800) || cleanParagraph(fallback.opinion, 1800),
    orders: normalizeOrders(raw.orders, fallback.orders),
    closingComment: cleanText(raw.closingComment, 300) || cleanText(fallback.closingComment, 300),
    legalNotice: cleanText(raw.legalNotice, 400) || cleanText(fallback.legalNotice, 400),
  };
}

function parseJudgmentJson(value) {
  const source = String(value || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Judgment JSON object not found');
  const parsed = JSON.parse(source.slice(start, end + 1));
  return parsed.judgment && typeof parsed.judgment === 'object' ? parsed.judgment : parsed;
}

function containsAnchor(text, anchors) {
  const source = String(text || '').toLowerCase();
  return anchors.some(anchor => source.includes(String(anchor || '').toLowerCase()));
}

function countMarkers(text, markers) {
  const source = String(text || '');
  return markers.filter(marker => source.includes(marker)).length;
}

function overlapRatio(left, right) {
  const a = new Set(words(left).filter(token => token.length >= 2));
  const b = new Set(words(right).filter(token => token.length >= 2));
  if (!a.size || !b.size) return 0;
  const shared = [...a].filter(token => b.has(token)).length;
  return shared / Math.max(1, Math.min(a.size, b.size));
}

function maxPairOverlap(values) {
  let max = 0;
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      max = Math.max(max, overlapRatio(values[left], values[right]));
    }
  }
  return max;
}

function sentenceCount(value) {
  return String(value || '')
    .split(/[.!?]+(?:\s|$)/)
    .map(item => item.trim())
    .filter(Boolean).length;
}

function semanticCueVisible(text, phrase) {
  const stop = new Set(['원고가', '피고가', '상대가', '그리고', '관련해', '허락', '없이']);
  const cues = words(phrase).filter(token => token.length >= 2 && !stop.has(token));
  return cues.some(cue => String(text || '').includes(cue));
}

function evaluateJudgment(judgment, analysis) {
  const openingText = `${judgment.headline} ${judgment.opening} ${judgment.summary}`;
  const allText = [
    judgment.headline, judgment.opening, ...judgment.comedyLines, judgment.summary,
    judgment.facts, judgment.investigation, judgment.plaintiffClaim, judgment.defendantClaim,
    judgment.opinion, ...judgment.orders.map(order => order.text), judgment.closingComment,
  ].join(' ');
  const anchors = unique([analysis.actor, analysis.target, ...(analysis.evidenceAnchors || [])])
    .filter(item => item === analysis.actor || item === analysis.target || String(item).length >= 2);
  const evidenceAnchors = unique(analysis.evidenceAnchors || []).filter(item => String(item).length >= 2);
  const openingAnchorHits = anchors.filter(anchor => containsAnchor(openingText, [anchor])).length;
  const sourceAnchorHits = evidenceAnchors.filter(anchor => containsAnchor(allText, [anchor])).length;
  const requiredSourceHits = Math.min(2, evidenceAnchors.length);
  const actorVisible = analysis.actor === '피고 측' || containsAnchor(openingText, [analysis.actor]);
  const targetVisible = containsAnchor(openingText, [analysis.target]);
  const actionVisible = semanticCueVisible(openingText, analysis.action);
  const consequenceVisible = semanticCueVisible(openingText, analysis.consequence);
  const comedyAnchorHits = judgment.comedyLines.filter(line => containsAnchor(line, anchors)).length;
  const contrastComedyHits = judgment.comedyLines.filter(line => countMarkers(line, CONTRAST_MARKERS) >= 1).length;
  const shortPunchlineHits = [...judgment.comedyLines, judgment.closingComment]
    .filter(line => line.length >= 8 && line.length <= 70).length;
  const cannedPhraseHits = countMarkers(allText, CANNED_PHRASES);
  const opposingClaimOverlap = overlapRatio(judgment.plaintiffClaim, judgment.defendantClaim);
  const comedyMaxOverlap = maxPairOverlap(judgment.comedyLines);
  const sectionMaxOverlap = maxPairOverlap([
    judgment.summary,
    judgment.facts,
    judgment.investigation,
    judgment.opinion,
  ]);
  const tailoredOrders = judgment.orders.filter(order =>
    containsAnchor(order.text, anchors) || semanticCueVisible(order.text, analysis.remedy)
  ).length;
  const openingSentences = sentenceCount(judgment.opening);

  return {
    openingAnchorHits,
    sourceAnchorHits,
    requiredSourceHits,
    actorVisible,
    targetVisible,
    actionVisible,
    consequenceVisible,
    openingSentences,
    comedyLineCount: judgment.comedyLines.length,
    comedyAnchorHits,
    contrastComedyHits,
    shortPunchlineHits,
    cannedPhraseHits,
    opposingClaimOverlap,
    comedyMaxOverlap,
    sectionMaxOverlap,
    tailoredOrders,
    passed: judgment.headline.length >= 8
      && judgment.headline.length <= 60
      && judgment.opening.length >= 55
      && judgment.opening.length <= 220
      && openingSentences === 2
      && openingAnchorHits >= 2
      && actorVisible
      && targetVisible
      && actionVisible
      && consequenceVisible
      && sourceAnchorHits >= requiredSourceHits
      && judgment.comedyLines.length === 3
      && comedyAnchorHits >= 2
      && contrastComedyHits >= 1
      && shortPunchlineHits >= 3
      && comedyMaxOverlap <= 0.6
      && cannedPhraseHits === 0
      && judgment.facts.length >= 50
      && judgment.facts.length <= 360
      && judgment.investigation.length >= 40
      && judgment.investigation.length <= 300
      && judgment.plaintiffClaim.length >= 35
      && judgment.plaintiffClaim.length <= 260
      && judgment.defendantClaim.length >= 35
      && judgment.defendantClaim.length <= 260
      && opposingClaimOverlap <= 0.68
      && judgment.opinion.length >= 70
      && judgment.opinion.length <= 460
      && sectionMaxOverlap <= 0.68
      && judgment.orders.length === 3
      && tailoredOrders >= 2
      && judgment.closingComment.length >= 8
      && judgment.closingComment.length <= 70,
  };
}

function isCompleteJudgment(judgment) {
  return Boolean(
    judgment?.headline && judgment?.opening && judgment?.summary && judgment?.facts
    && judgment?.investigation && judgment?.plaintiffClaim && judgment?.defendantClaim
    && judgment?.opinion && Array.isArray(judgment?.orders) && judgment.orders.length === 3
    && judgment?.closingComment && judgment?.legalNotice
  );
}

module.exports = {
  normalizeJudgment,
  parseJudgmentJson,
  evaluateJudgment,
  isCompleteJudgment,
};
