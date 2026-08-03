'use strict';

const legacy = require('./dripso');
const game = require('./dripso-game');

// Firebase에 노출되는 드립소 공개 함수는 이 모듈 한 곳에서만 선언한다.
exports.createDripsoTopic = legacy.createDripsoTopic;
exports.createDripsoBattle = game.createDripsoBattle;
exports.submitDripsoBattleEntry = game.submitDripsoBattleEntry;
exports.getDripsoBattleView = game.getDripsoBattleView;
exports.getDripsoBattleMatchup = game.getDripsoBattleMatchup;
exports.voteDripsoBattleMatchup = game.voteDripsoBattleMatchup;
exports.addDripsoComment = game.addDripsoComment;
exports.toggleDripsoCommentLike = game.toggleDripsoCommentLike;
