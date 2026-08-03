'use strict';

const { getApps, initializeApp } = require('firebase-admin/app');

if (!getApps().length) initializeApp();

const { ensureOfficialBattle } = require('./dripso-official');

ensureOfficialBattle()
  .then(result => {
    console.log(JSON.stringify({ success: true, ...result }));
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed to ensure official Dripso battle:', error);
    process.exit(1);
  });
