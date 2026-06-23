'use strict';

const coreAi = { ...require('./index.js') };

// 구형 연결 항목은 운영 배포 표면에서 제외한다.
for (const retiredExport of [
  'playAiLadderBonus',
  'aiJudge',
  'saveAiKingConfig',
]) {
  delete coreAi[retiredExport];
}

module.exports = coreAi;
