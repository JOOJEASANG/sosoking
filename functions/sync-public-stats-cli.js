'use strict';

const { getApps, initializeApp } = require('firebase-admin/app');

if (!getApps().length) initializeApp();

const { refreshPublicStats } = require('./public-stats');

refreshPublicStats()
  .then(result => {
    console.log('Public statistics synchronized:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Public statistics synchronization failed:', error);
    process.exit(1);
  });
