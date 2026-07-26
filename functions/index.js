"use strict";

const investigation = require("./gemini-court-investigation");
const automaticStory = require("./gemini-auto-case-story");

exports.generateCourtCase = investigation.generateCourtCase;
exports.generateCourtCaseV3 = investigation.generateCourtCase;
exports.generateCourtCaseV6 = automaticStory.generateCourtCaseV6;
