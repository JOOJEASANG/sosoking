const {
  SERIOUS_HUMOR_MARKERS,
  sectionContainsAnchor,
  markerCount,
} = require('./judgment-story-config');

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
  const allTexts = emergencySections.concat(coreSections, judgment.orders.map(order => order.text));
  const sectionHits = coreSections.filter(section => sectionContainsAnchor(section, anchors)).length;
  const primarySectionHits = coreSections.filter(section => sectionContainsAnchor(section, [profile.mainAnchor])).length;
  const emergencyAnchorHits = emergencySections.filter(section => sectionContainsAnchor(section, [profile.mainAnchor])).length;
  const mentionedAnchors = anchors.filter(anchor => allTexts.some(section => sectionContainsAnchor(section, [anchor])));
  const tailoredOrders = judgment.orders.filter(order => sectionContainsAnchor(order.text, anchors)).length;
  const primaryOrderHits = judgment.orders.filter(order => sectionContainsAnchor(order.text, [profile.mainAnchor])).length;
  const humorText = `${judgment.breakingNews} ${judgment.emergencyBriefing} ${judgment.impactAssessment} ${judgment.investigation} ${judgment.opinion} ${judgment.closingComment}`;
  const seriousHumorHits = markerCount(humorText, SERIOUS_HUMOR_MARKERS);
  const requiredAnchorCount = anchors.length >= 3 ? 3 : Math.max(1, anchors.length);
  const expectedLevelCode = profile.incidentLevel.split('·')[0].trim();
  const incidentLevelMatches = String(judgment.incidentLevel || '').includes(expectedLevelCode);

  return {
    sectionHits,
    primarySectionHits,
    emergencyAnchorHits,
    mentionedAnchorCount: mentionedAnchors.length,
    tailoredOrders,
    primaryOrderHits,
    seriousHumorHits,
    emergencyDetailLength: String(judgment.emergencyBriefing || '').length,
    impactLength: String(judgment.impactAssessment || '').length,
    incidentLevelMatches,
    passed: incidentLevelMatches
      && String(judgment.breakingNews || '').length >= 60
      && String(judgment.emergencyBriefing || '').length >= 180
      && String(judgment.impactAssessment || '').length >= 120
      && emergencyAnchorHits === 3
      && sectionHits >= 5
      && primarySectionHits >= 4
      && mentionedAnchors.length >= requiredAnchorCount
      && tailoredOrders >= 3
      && primaryOrderHits >= 2
      && seriousHumorHits >= 4,
  };
}

function buildRewriteInstruction(profile, evaluation) {
  return `\n\n[재작성 명령]
이전 응답은 재미·디테일·사건 고유성 검사에서 탈락했다.
“${profile.mainAnchor}”를 breakingNews, emergencyBriefing, impactAssessment 모두와 기존 본문 최소 4곳, 주문 최소 2곳에 적어라.
사건을 작다고 해명하지 말고 ${profile.incidentLevel} 상태를 끝까지 유지하라.
발생 전→결정적 순간→사후 대응 브리핑, 연쇄 피해, 상황실·통제선·증거물·0.1초 감식 중 최소 4개를 넣어라.
긴 공식 문장 뒤에 짧은 반전 문장을 배치해 최소 세 번 웃음 지점을 만들어라.
현재 검사값: emergencyAnchors=${evaluation.emergencyAnchorHits || 0}, sections=${evaluation.sectionHits}, primarySections=${evaluation.primarySectionHits || 0}, anchors=${evaluation.mentionedAnchorCount}, orders=${evaluation.tailoredOrders}, primaryOrders=${evaluation.primaryOrderHits || 0}, humor=${evaluation.seriousHumorHits}, briefingLength=${evaluation.emergencyDetailLength || 0}, impactLength=${evaluation.impactLength || 0}.
JSON 객체만 다시 출력하라.`;
}

module.exports = { evaluateStorySpecificity, buildRewriteInstruction };
