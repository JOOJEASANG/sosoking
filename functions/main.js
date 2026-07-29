'use strict';

const { getApps, initializeApp } = require('firebase-admin/app');

if (!getApps().length) initializeApp();

// Gemini 요청에 소소킹 전용 코미디 강도 규칙을 먼저 주입한다.
require('./humor-prompt');

Object.assign(exports, require('./daily'));
Object.assign(exports, require('./daily-real-court'));
Object.assign(exports, require('./profile'));
Object.assign(exports, require('./social'));
Object.assign(exports, require('./reports'));
Object.assign(exports, require('./public-stats'));
Object.assign(exports, require('./public-seo-safe'));
Object.assign(exports, require('./case-aliases'));
Object.assign(exports, require('./submit-secure'));
Object.assign(exports, require('./generate-trial-lite'));
Object.assign(exports, require('./admin-actions'));
Object.assign(exports, require('./admin-visibility'));
