import fs from 'node:fs';

function patch(file, replacements) {
  let source = fs.readFileSync(file, 'utf8');
  for (const [before, after] of replacements) {
    if (!source.includes(before)) throw new Error(`${file}: patch target missing: ${before}`);
    source = source.replace(before, after);
  }
  fs.writeFileSync(file, source);
}

patch('public/js/pages/result-court.js', [
  [
    "import { showToast } from '../components/toast.js?v=20260630-3';",
    "import { showToast } from '../components/toast.js?v=20260630-3';\nimport { attachReportButton } from '../components/report-dialog.js?v=20260729-report-moderation-1';"
  ],
  [
    "  patchShareButton(container, caseId);\n}",
    "  patchShareButton(container, caseId);\n  attachReportButton(container, caseId);\n}"
  ]
]);

patch('public/js/app.js', [
  [
    "./pages/result-court.js?v=20260729-legacy-id-1",
    "./pages/result-court.js?v=20260729-report-moderation-1"
  ]
]);

patch('public/index.html', [
  [
    '/js/app.js?v=20260729-script-csp-1',
    '/js/app.js?v=20260729-report-moderation-1'
  ]
]);

patch('public/sw.js', [
  [
    "const CACHE_NAME = 'sosoking-app-v20260729-script-csp-1';",
    "const CACHE_NAME = 'sosoking-app-v20260729-report-moderation-1';"
  ],
  [
    "'/js/app.js?v=20260729-script-csp-1'",
    "'/js/app.js?v=20260729-report-moderation-1'"
  ]
]);
