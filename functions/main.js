const { initializeApp, getApps } = require('firebase-admin/app');

if (!getApps().length) {
  initializeApp();
}

Object.assign(exports, require('./fresh-submit'));
Object.assign(exports, require('./fresh-title'));
Object.assign(exports, require('./fresh-generate'));
Object.assign(exports, require('./fresh-social'));
