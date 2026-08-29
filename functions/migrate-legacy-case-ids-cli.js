'use strict';

const { getApps, initializeApp } = require('firebase-admin/app');
if (!getApps().length) initializeApp();

const { migrateLegacyCase, scanLegacyCases } = require('./legacy-case-migration');

const modeArg = process.argv.find(value => value.startsWith('--mode='));
const mode = modeArg ? modeArg.split('=')[1] : 'dry-run';
const dryRun = mode !== 'apply';
if (!dryRun && process.env.CONFIRM_LEGACY_CASE_MIGRATION !== 'MIGRATE_LEGACY_CASE_IDS') {
  throw new Error('Apply mode requires CONFIRM_LEGACY_CASE_MIGRATION=MIGRATE_LEGACY_CASE_IDS');
}

(async () => {
  let cursor = '';
  let scanned = 0;
  let matched = 0;
  let migrated = 0;

  while (true) {
    const page = await scanLegacyCases({ limit: 100, cursor });
    scanned += page.scanned;
    matched += page.candidates.length;
    for (const candidate of page.candidates) {
      const result = await migrateLegacyCase(candidate.caseId, { dryRun });
      if (result.migrated) migrated += 1;
      console.log(JSON.stringify(result));
    }
    if (page.done || !page.nextCursor) break;
    cursor = page.nextCursor;
  }

  console.log(JSON.stringify({ mode, scanned, matched, migrated }));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
