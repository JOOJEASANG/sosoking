'use strict';

const { onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');

const REGION = 'asia-northeast3';

// 미션 기능은 서비스에서 제거되었습니다.
// 기존 함수 이름은 배포 호환성을 위해 유지하되, 더 이상 missions 컬렉션을 생성/수정하지 않습니다.
const generateAiMissionNow = onCall({ region: REGION, timeoutSeconds: 10 }, async () => {
  return {
    ok: false,
    disabled: true,
    reason: 'mission-feature-removed',
    message: 'AI 미션 자동생성 기능은 제거되었습니다.',
  };
});

const dailyAiMission = onSchedule({ schedule: '5 8 * * *', timeZone: 'Asia/Seoul', region: REGION, timeoutSeconds: 10, memory: '128MiB' }, async () => {
  console.log('[ai-mission] skipped: mission feature removed');
  return null;
});

module.exports = { generateAiMissionNow, dailyAiMission };
