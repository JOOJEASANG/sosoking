const existingFunctions = require('./functions-main.js');
const aiHuntFunctions = require('./ai-hunt-functions.js');

module.exports = {
  ...existingFunctions,
  ...aiHuntFunctions,
};
