const writer = require('./judgment-story-writer');
const {
  evaluateStorySpecificity,
  buildRewriteInstruction,
} = require('./judgment-story-quality');

function buildCaseProfile(input) {
  const profile = writer.buildCaseProfile(input);
  const wordplay = String(profile.comedyKit?.wordplay || '');
  if (profile.mainAnchor && !wordplay.includes(profile.mainAnchor)) {
    profile.comedyKit = {
      ...profile.comedyKit,
      wordplay: `${profile.mainAnchor}은(는) 사라졌다. 원고의 평정심도 함께 실종됐다.`,
    };
  }
  return profile;
}

module.exports = {
  buildCaseProfile,
  buildStoryPrompt: writer.buildStoryPrompt,
  buildStoryFallback: writer.buildStoryFallback,
  evaluateStorySpecificity,
  buildRewriteInstruction,
};
