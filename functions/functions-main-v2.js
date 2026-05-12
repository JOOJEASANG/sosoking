const existingFunctions = require('./functions-main.js');
const predictionFunctions = require('./prediction-functions.js');
const aiHuntFunctions = require('./ai-hunt-functions.js');

module.exports = {
  ...existingFunctions,
  ...aiHuntFunctions,
  ...predictionFunctions,
};
