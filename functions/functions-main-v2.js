const existingFunctions = require('./functions-main.js');
const predictionFunctions = require('./prediction-functions.js');

module.exports = {
  ...existingFunctions,
  ...predictionFunctions,
};
