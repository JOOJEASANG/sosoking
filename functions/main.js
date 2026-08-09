'use strict';

const { getApps, initializeApp } = require('firebase-admin/app');

if (!getApps().length) initializeApp();

// Gemini 요청에 소소킹 전용 코미디 강도 규칙을 먼저 주입한다.
require('./humor-prompt');
// 사건별 코미디 DNA와 게임·주제별 고신뢰 용어 컨텍스트를 추가한다.
require('./comedy-topic-context');
// 목록 밖 게임과 일반 생활주제까지 해석하고 다섯 결과 모두에 서로 다른 코미디 역할을 부여한다.
require('./five-stage-topic-comedy');
// 번호 항목 분리와 문장 완결성을 보장하는 출력 규칙을 이어서 주입한다.
require('./document-output-quality');

Object.assign(exports, require('./daily'));
Object.assign(exports, require('./profile'));
Object.assign(exports, require('./social'));
Object.assign(exports, require('./discussion'));
// 기존 자유형, 블라인드 배틀, 파이널4 공개 함수를 하나의 배포 표면으로 묶는다.
Object.assign(exports, require('./dripso-bundle'));
const dripsoOfficial = require('./dripso-official');
exports.publishDailyOfficialDripsoBattle = dripsoOfficial.publishDailyOfficialDripsoBattle;
Object.assign(exports, require('./dripso-moderation'));
Object.assign(exports, require('./reports'));
Object.assign(exports, require('./public-stats'));
Object.assign(exports, require('./public-seo-safe'));
Object.assign(exports, require('./public-original'));
Object.assign(exports, require('./case-aliases'));
Object.assign(exports, require('./submit-secure'));
Object.assign(exports, require('./generate-trial-lite'));
Object.assign(exports, require('./admin-actions'));
Object.assign(exports, require('./admin-visibility'));