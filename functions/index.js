"use strict";

const investigation = require("./gemini-court-investigation");
const automaticStory = require("./gemini-auto-case-story");
const comedyStory = require("./gemini-comedy-case-v7b");

exports.generateCourtCase = investigation.generateCourtCase;
exports.generateCourtCaseV3 = investigation.generateCourtCase;
exports.generateCourtCaseV6 = automaticStory.generateCourtCaseV6;
exports.generateCourtCaseV7 = comedyStory.generateCourtCaseV7;
