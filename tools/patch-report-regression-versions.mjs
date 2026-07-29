import fs from 'node:fs';

// One-shot update for report moderation module and cache-version regression checks.
function patch(file, replacements) {
  let source = fs.readFileSync(file, 'utf8');
  for (const [before, after] of replacements) {
    if (!source.includes(before)) throw new Error(`${file}: patch target missing: ${before}`);
    source = source.replace(before, after);
  }
  fs.writeFileSync(file, source);
}

patch('tools/check-project.mjs', [
  [
    '/admin/admin-bootstrap.js?v=20260729-admin-consolidated-1',
    '/admin/admin-bootstrap.js?v=20260729-report-moderation-1'
  ],
  [
    "['setAdminResultVisibility', 'deleteCourtPost', 'deleteUserProfile', 'generateDailyAiNow', 'syncPublicStatsNow']",
    "['setAdminResultVisibility', 'deleteCourtPost', 'deleteUserProfile', 'generateDailyAiNow', 'syncPublicStatsNow', 'moderateReport']"
  ]
]);

patch('tools/check-script-csp.mjs', [
  [
    '/admin/admin-bootstrap.js?v=20260729-admin-consolidated-1',
    '/admin/admin-bootstrap.js?v=20260729-report-moderation-1'
  ],
  [
    './admin.js?v=20260729-admin-consolidated-1',
    './admin.js?v=20260729-report-moderation-1'
  ]
]);

patch('tools/check-security-regressions.mjs', [
  [
    "['setAdminResultVisibility', 'deleteCourtPost', 'deleteUserProfile']",
    "['setAdminResultVisibility', 'deleteCourtPost', 'deleteUserProfile', 'moderateReport']"
  ],
  [
    "  'submitReport',\n  'syncPublicStats',",
    "  'submitReport',\n  'moderateReport',\n  'syncPublicStats',"
  ]
]);
