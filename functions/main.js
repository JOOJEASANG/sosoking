'use strict';

const { getApps, initializeApp } = require('firebase-admin/app');

if (!getApps().length) initializeApp();

// Gemini 요청에 소소킹 전용 코미디 강도 규칙을 먼저 주입한다.
require('./humor-prompt');
// 번호 항목 분리와 문장 완결성을 보장하는 출력 규칙을 이어서 주입한다.
require('./document-output-quality');

Object.assign(exports, require('./daily'));
Object.assign(exports, require('./profile'));
Object.assign(exports, require('./social'));
Object.assign(exports, require('./discussion'));
Object.assign(exports, require('./dripso'));
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
