const { initializeApp, getApps } = require('firebase-admin/app');

if (!getApps().length) {
  initializeApp();
}

Object.assign(exports, require('./daily'));
Object.assign(exports, require('./profile'));
Object.assign(exports, require('./social'));
Object.assign(exports, require('./reporting'));
Object.assign(exports, require('./submit-secure'));
Object.assign(exports, require('./title-suggestion'));
Object.assign(exports, require('./generate-trial-v2'));
Object.assign(exports, require('./visibility'));
Object.assign(exports, require('./admin-actions'));
Object.assign(exports, require('./repair'));
// 동일한 export 이름을 월간·수동 최적화 구현으로 덮어쓴다.
Object.assign(exports, require('./privacy-maintenance'));
