const feedGameFunctions = require('./feed-functions.js');

module.exports = {
  ...require('./functions-main.js'),
  ...require('./ai-hunt-functions.js'),
  ...require('./prediction-functions.js'),
  ...require('./hot-issue-functions.js'),
  ...require('./settlement-functions.js'),
  ...require('./link-summary-functions.js'),
  ...require('./daily-seed-functions.js'),
  ...require('./soso-feed-functions.js'),
  secureRegisterFeedView: feedGameFunctions.registerFeedView,
  secureReactFeedPost: feedGameFunctions.reactFeedPost,
  secureVoteFeedOption: feedGameFunctions.voteFeedOption,
  secureAddFeedComment: feedGameFunctions.addFeedComment,
  secureCheckQuizAnswer: feedGameFunctions.checkQuizAnswer,
  ...require('./account-functions.js'),
};