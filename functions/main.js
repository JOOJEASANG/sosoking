'use strict';

const { getApps, initializeApp } = require('firebase-admin/app');

if (!getApps().length) initializeApp();

Object.assign(exports, require('./game-profile'));
