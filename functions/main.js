const { initializeApp, getApps } = require('firebase-admin/app');

if (!getApps().length) {
  initializeApp();
}

Object.assign(exports, require('./daily'));
Object.assign(exports, require('./profile'));
Object.assign(exports, require('./social'));
Object.assign(exports, require('./submit-secure'));
Object.assign(exports, require('./generate-trial-lite'));
Object.assign(exports, require('./admin-actions'));
Object.assign(exports, require('./repair'));
