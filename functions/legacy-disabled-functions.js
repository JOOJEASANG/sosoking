'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');

const REGION = 'asia-northeast3';

function disabled(name) {
  return onCall({ region: REGION, timeoutSeconds: 10 }, async () => {
    throw new HttpsError('failed-precondition', `${name} 기능은 새공화국 정치 시뮬레이션으로 전환되며 비활성화되었습니다.`);
  });
}

exports.playAiLadderBonus = disabled('AI 사다리');
exports.createHotPotato = disabled('핫포테이토');
exports.throwHotPotato = disabled('핫포테이토');
exports.reactToAcrostic = disabled('삼행시 반응');

exports.scheduledHotPotatoExploder = onSchedule({
  schedule: '0 0 1 1 *',
  timeZone: 'Asia/Seoul',
  region: REGION,
  timeoutSeconds: 10,
}, async () => {
  // Legacy scheduler kept only to avoid forced function deletion during deployment.
});
