'use strict';

const coreAi = { ...require('./index.js') };

// index.js에 남아 있는 구버전 연결 항목은 배포 표면에서 제외한다.
delete coreAi.playAiLadderBonus;

module.exports = coreAi;
