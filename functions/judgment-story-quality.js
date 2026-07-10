const {
  SERIOUS_HUMOR_MARKERS,
  sectionContainsAnchor,
  markerCount,
} = require('./judgment-story-config');

const CONTRAST_MARKERS = ['했지만', '였지만', '성공', '실패', '문제는', '다만', '결국', '없었다', '남았다', '중이었다', '도착', '사라졌다', '살아 있었다', '끝났다', '불렀다', '불탔다'];
const ACTION_MARKERS = ['먹', '삼키', '안내', '도착', '숨기', '가져가', '선점', '지각', '기다리', '답장', '응답', '켜 두', '바뀌', '없앴', '틀어졌', '어긋'];
const CONSEQUENCE_MARKERS = ['사라졌', '무산', '펑크', '취소', '잃', '틀어졌', '기다리', '낭비', '못', '상했다', '바뀌', '망가졌'];

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
  return { copiedPhraseHits: matched.size, echoSectionHits, heavyEchoSectionHits };
}

function sentenceList(value) {
  return String(value || '')
    .split(/(?<=[.!?다요죠])\s+|\n+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function countMarkers(text, markers) {
  const source = String(text || '');
  return markers.filter(marker => source.includes(marker)).length;
}

function evaluateStorySpecificity(judgment, profile) {
  const anchors = [...new Set((profile.concreteAnchors || profile.anchors || []).filter(anchor => String(anchor).length >= 2))];
  const coreSections = [judgment.summary, judgment.facts, judgment.investigation, judgment.prosecution, judgment.defense, judgment.opinion, judgment.closingComment];
  const emergencySections = [judgment.breakingNews, judgment.emergencyBriefing, judgment.impactAssessment];
  const claimSections = [judgment.plaintiffClaim, judgment.defendantClaim];
  const orderSections = judgment.orders.map(order => order.text);
  const comedyLines = Array.isArray(judgment.comedyLines) ? judgment.comedyLines.filter(Boolean) : [];
  const allTexts = emergencySections.concat(comedyLines, claimSections, coreSections, orderSections);
  const opening = `${judgment.headline} ${judgment.breakingNews} ${judgment.summary}`;
  const openingConcreteHits = anchors.filter(anchor => sectionContainsAnchor(opening, [anchor])).length;
  const subjectVisible = !profile.subjectCue || profile.subjectCue === '피고 측' || sectionContainsAnchor(opening, [profile.subjectCue]);
  const mainVisible = sectionContainsAnchor(opening, [profile.mainAnchor]);
  const actionMarkerHits = countMarkers(opening, ACTION_MARKERS);
  const consequenceVisible = words(profile.consequenceCue).filter(token => token.length >= 2).some(token => opening.includes(token))
    || countMarkers(opening, CONSEQUENCE_MARKERS) >= 1;
  const sectionHits = coreSections.filter(section => sectionContainsAnchor(section, anchors)).length;
  const primarySectionHits = coreSections.filter(section => sectionContainsAnchor(section, [profile.mainAnchor])).length;
  const mentionedAnchors = anchors.filter(anchor => allTexts.some(section => sectionContainsAnchor(section, [anchor])));
  const tailoredOrders = orderSections.filter(order => sectionContainsAnchor(order, anchors)).length;
  const primaryOrderHits = orderSections.filter(order => sectionContainsAnchor(order, [profile.mainAnchor])).length;
  const seriousHumorHits = markerCount(allTexts.join(' '), SERIOUS_HUMOR_MARKERS);
  const expectedLevelCode = profile.incidentLevel.split('·')[0].trim();
  const incidentLevelMatches = String(judgment.incidentLevel || '').includes(expectedLevelCode);
  const opposingClaimOverlap = claimOverlap(judgment.plaintiffClaim, judgment.defendantClaim);
  const mainAnchorMentions = allTexts.reduce((sum, section) => sum + countOccurrences(section, profile.mainAnchor), 0);
  const distinctSectionCount = new Set(allTexts.map(normalizedForEcho).filter(Boolean)).size;
  const echo = evaluateSourceEcho(allTexts, profile);
  const comedyAnchorHits = comedyLines.filter(line => sectionContainsAnchor(line, anchors)).length;
  const contrastComedyHits = comedyLines.filter(line => countMarkers(line, CONTRAST_MARKERS) >= 1).length;
  const shortPunchlineHits = sentenceList(`${comedyLines.join(' ')} ${judgment.breakingNews} ${judgment.closingComment}`)
    .filter(sentence => sentence.length >= 8 && sentence.length <= 55).length;
  const genericPhraseHits = countMarkers(allTexts.join(' '), ['기대질서', '생활대응체계', '상호배려질서', '일시 정지', '정식 분쟁으로 성장']);

  return {
    openingConcreteHits,
    subjectVisible,
    mainVisible,
    actionMarkerHits,
    consequenceVisible,
    comedyLineCount: comedyLines.length,
    comedyAnchorHits,
    contrastComedyHits,
    shortPunchlineHits,
    genericPhraseHits,
    sectionHits,
    primarySectionHits,
    mentionedAnchorCount: mentionedAnchors.length,
    tailoredOrders,
    primaryOrderHits,
    seriousHumorHits,
    plaintiffClaimLength: String(judgment.plaintiffClaim || '').length,
    defendantClaimLength: String(judgment.defendantClaim || '').length,
    emergencyDetailLength: String(judgment.emergencyBriefing || '').length,
    impactLength: String(judgment.impactAssessment || '').length,
    incidentLevelMatches,
    mainAnchorMentions,
    distinctSectionCount,
    opposingClaimOverlap,
    ...echo,
    passed: incidentLevelMatches
      && String(judgment.breakingNews || '').length >= 65
      && String(judgment.emergencyBriefing || '').length >= 110
      && String(judgment.impactAssessment || '').length >= 70
      && openingConcreteHits >= 2
      && subjectVisible
      && mainVisible
      && actionMarkerHits >= 1
      && consequenceVisible
      && comedyLines.length >= 2
      && comedyAnchorHits >= 1
      && contrastComedyHits >= 1
      && shortPunchlineHits >= 2
      && genericPhraseHits <= 4
      && String(judgment.plaintiffClaim || '').length >= 45
      && String(judgment.defendantClaim || '').length >= 45
      && opposingClaimOverlap <= 0.7
      && sectionHits >= 4
      && primarySectionHits >= 2
      && mentionedAnchors.length >= 3
      && tailoredOrders >= 2
      && primaryOrderHits >= 1
      && mainAnchorMentions >= 3
      && mainAnchorMentions <= 24
      && distinctSectionCount >= 10
      && echo.echoSectionHits <= 2
      && echo.heavyEchoSectionHits <= 1
      && echo.copiedPhraseHits <= 6
      && seriousHumorHits >= 2,
  };
}

function buildRewriteInstruction(profile, evaluation) {
  return `\n\n[재작성 명령]
이전 응답은 사건이 바로 보이지 않거나 실제 웃음 장치가 부족해 탈락했다.
첫 두 문장에 “${profile.subjectCue}”, “${profile.mainAnchor}”, “${profile.actionCue}”, “${profile.consequenceCue}”가 구체적으로 드러나게 다시 써라.
추상적인 기대질서·생활체계 설명부터 시작하지 마라. 누가 무엇을 해서 어떤 결과가 났는지 먼저 말한다.
comedyLines는 최소 2개 작성한다. 하나는 사건 명사를 이용한 말장난·아재개그, 하나는 55자 이하의 건조한 반전이어야 한다.
피고 변명은 원고 주장과 다른 논리로 만들고, 주문에는 실제 사건 물건이나 행동을 넣어라.
원문 4단어 이상 연속 복사와 같은 사실의 반복은 금지한다.
현재 검사값: openingAnchors=${evaluation.openingConcreteHits || 0}, subject=${evaluation.subjectVisible || false}, main=${evaluation.mainVisible || false}, action=${evaluation.actionMarkerHits || 0}, consequence=${evaluation.consequenceVisible || false}, comedyLines=${evaluation.comedyLineCount || 0}, comedyAnchors=${evaluation.comedyAnchorHits || 0}, contrast=${evaluation.contrastComedyHits || 0}, punchlines=${evaluation.shortPunchlineHits || 0}, generic=${evaluation.genericPhraseHits || 0}, copied=${evaluation.copiedPhraseHits || 0}.
JSON 객체만 다시 출력하라.`;
}

module.exports = { evaluateStorySpecificity, buildRewriteInstruction };
