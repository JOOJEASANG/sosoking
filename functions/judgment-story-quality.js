const {
  SERIOUS_HUMOR_MARKERS,
  sectionContainsAnchor,
  markerCount,
} = require('./judgment-story-config');

function words(value) {
  return String(value || '').toLowerCase().match(/[가-힣a-z0-9]+/g) || [];
}

function phraseWindows(value, size = 4) {
  const tokens = words(value);
  const phrases = new Set();
  for (let index = 0; index <= tokens.length - size; index += 1) {
    const phrase = tokens.slice(index, index + size).join(' ');
    if (phrase.length >= 10) phrases.add(phrase);
  }
  return [...phrases];
}

function normalizedForEcho(value) {
  return words(value).join(' ');
}

function countOccurrences(text, needle) {
  const source = String(text || '').toLowerCase();
  const target = String(needle || '').toLowerCase();
  if (!target) return 0;
  let count = 0;
  let cursor = 0;
  while ((cursor = source.indexOf(target, cursor)) >= 0) {
    count += 1;
    cursor += target.length;
  }
  return count;
}

function claimOverlap(left, right) {
  const a = new Set(words(left).filter(token => token.length >= 2));
  const b = new Set(words(right).filter(token => token.length >= 2));
  if (!a.size || !b.size) return 1;
  const shared = [...a].filter(token => b.has(token)).length;
  return shared / Math.max(1, Math.min(a.size, b.size));
}

function evaluateSourceEcho(sections, profile) {
  const sourcePhrases = phraseWindows(profile.description, 4);
  const matched = new Set();
  let echoSectionHits = 0;
  let heavyEchoSectionHits = 0;

  for (const section of sections) {
    const normalized = normalizedForEcho(section);
    const hits = sourcePhrases.filter(phrase => normalized.includes(phrase));
    hits.forEach(phrase => matched.add(phrase));
    if (hits.length) echoSectionHits += 1;
    if (hits.length >= 2) heavyEchoSectionHits += 1;
  }

  return {
    copiedPhraseHits: matched.size,
    echoSectionHits,
    heavyEchoSectionHits,
  };
}

function evaluateStorySpecificity(judgment, profile) {
  const anchors = profile.anchors.filter(anchor => anchor.length >= 2);
  const coreSections = [
    judgment.summary,
    judgment.facts,
    judgment.investigation,
    judgment.prosecution,
    judgment.defense,
    judgment.opinion,
    judgment.closingComment,
  ];
  const emergencySections = [
    judgment.breakingNews,
    judgment.emergencyBriefing,
    judgment.impactAssessment,
  ];
  const claimSections = [judgment.plaintiffClaim, judgment.defendantClaim];
  const orderSections = judgment.orders.map(order => order.text);
  const allTexts = emergencySections.concat(claimSections, coreSections, orderSections);
  const sectionHits = coreSections.filter(section => sectionContainsAnchor(section, anchors)).length;
  const primarySectionHits = coreSections.filter(section => sectionContainsAnchor(section, [profile.mainAnchor])).length;
  const emergencyAnchorHits = emergencySections.filter(section => sectionContainsAnchor(section, [profile.mainAnchor])).length;
  const claimAnchorHits = claimSections.filter(section => sectionContainsAnchor(section, [profile.mainAnchor])).length;
  const mentionedAnchors = anchors.filter(anchor => allTexts.some(section => sectionContainsAnchor(section, [anchor])));
  const tailoredOrders = orderSections.filter(order => sectionContainsAnchor(order, anchors)).length;
  const primaryOrderHits = orderSections.filter(order => sectionContainsAnchor(order, [profile.mainAnchor])).length;
  const humorText = `${judgment.breakingNews} ${judgment.emergencyBriefing} ${judgment.impactAssessment} ${judgment.investigation} ${judgment.opinion} ${judgment.closingComment}`;
  const seriousHumorHits = markerCount(humorText, SERIOUS_HUMOR_MARKERS);
  const expectedLevelCode = profile.incidentLevel.split('·')[0].trim();
  const incidentLevelMatches = String(judgment.incidentLevel || '').includes(expectedLevelCode);
  const plaintiffClaimLength = String(judgment.plaintiffClaim || '').length;
  const defendantClaimLength = String(judgment.defendantClaim || '').length;
  const mainAnchorMentions = allTexts.reduce((sum, section) => sum + countOccurrences(section, profile.mainAnchor), 0);
  const distinctSectionCount = new Set(allTexts.map(normalizedForEcho).filter(Boolean)).size;
  const opposingClaimOverlap = claimOverlap(judgment.plaintiffClaim, judgment.defendantClaim);
  const echo = evaluateSourceEcho(allTexts, profile);
  const requiredAnchorCount = anchors.length >= 3 ? 2 : Math.max(1, anchors.length);

  return {
    sectionHits,
    primarySectionHits,
    emergencyAnchorHits,
    claimAnchorHits,
    plaintiffClaimLength,
    defendantClaimLength,
    mentionedAnchorCount: mentionedAnchors.length,
    tailoredOrders,
    primaryOrderHits,
    seriousHumorHits,
    emergencyDetailLength: String(judgment.emergencyBriefing || '').length,
    impactLength: String(judgment.impactAssessment || '').length,
    incidentLevelMatches,
    mainAnchorMentions,
    distinctSectionCount,
    opposingClaimOverlap,
    ...echo,
    passed: incidentLevelMatches
      && String(judgment.breakingNews || '').length >= 55
      && String(judgment.emergencyBriefing || '').length >= 170
      && String(judgment.impactAssessment || '').length >= 110
      && emergencyAnchorHits >= 1
      && emergencyAnchorHits <= 2
      && claimAnchorHits >= 1
      && plaintiffClaimLength >= 45
      && plaintiffClaimLength <= 300
      && defendantClaimLength >= 45
      && defendantClaimLength <= 300
      && opposingClaimOverlap <= 0.72
      && sectionHits >= 3
      && primarySectionHits >= 2
      && mentionedAnchors.length >= requiredAnchorCount
      && tailoredOrders >= 2
      && primaryOrderHits >= 1
      && mainAnchorMentions >= 3
      && mainAnchorMentions <= 10
      && distinctSectionCount >= 10
      && echo.echoSectionHits <= 2
      && echo.heavyEchoSectionHits <= 1
      && echo.copiedPhraseHits <= 7
      && seriousHumorHits >= 4,
  };
}

function buildRewriteInstruction(profile, evaluation) {
  return `\n\n[재작성 명령]
이전 응답은 사건 재해석·문장 다양성·원문 반복 검사에서 탈락했다.
접수 원문을 다시 읽어주지 말고, 결정적 행동·실제 불편·웃기는 대비만 남겨 완전히 새로운 문장과 비유로 재구성하라.
“${profile.mainAnchor}”를 모든 문단에 반복하지 말고 전체에서 3~8회만 자연스럽게 사용하라.
facts는 핵심 사실을 한 번만 압축하고, 나머지 영역은 원인 분석·양측 해석·가정적 파급효과·판단처럼 서로 다른 역할을 맡겨라.
plaintiffClaim과 defendantClaim은 각각 1~2문장으로 쓰되 같은 요약을 말투만 바꿔 반복하지 마라.
원문에서 4개 단어 이상 연속된 표현을 복사하지 말고, orders 3개도 서로 다른 집행 장면으로 작성하라.
${profile.incidentLevel}의 과몰입 태도와 최소 세 번의 웃음 지점은 유지하라.
현재 검사값: echoSections=${evaluation.echoSectionHits || 0}, heavyEcho=${evaluation.heavyEchoSectionHits || 0}, copiedPhrases=${evaluation.copiedPhraseHits || 0}, mainAnchorMentions=${evaluation.mainAnchorMentions || 0}, distinctSections=${evaluation.distinctSectionCount || 0}, claimOverlap=${Number(evaluation.opposingClaimOverlap || 0).toFixed(2)}, sections=${evaluation.sectionHits || 0}, orders=${evaluation.tailoredOrders || 0}, humor=${evaluation.seriousHumorHits || 0}.
JSON 객체만 다시 출력하라.`;
}

module.exports = { evaluateStorySpecificity, buildRewriteInstruction };
