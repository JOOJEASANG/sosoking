import fs from 'node:fs';

function patch(file, replacements) {
  let source = fs.readFileSync(file, 'utf8');
  for (const [before, after] of replacements) {
    if (!source.includes(before)) throw new Error(`${file}: version target missing: ${before}`);
    source = source.replace(before, after);
  }
  fs.writeFileSync(file, source);
}

patch('public/js/app.js', [
  ["./pages/home-court.js?v=20260729-public-stats-1", "./pages/home-court.js?v=20260729-script-csp-1"],
  ["./pages/board-court.js?v=20260729-logo-feed-1", "./pages/board-court.js?v=20260729-script-csp-1"]
]);
patch('public/js/pages/home-court.js', [
  ["./home.js?v=20260729-logo-feed-1", "./home.js?v=20260729-script-csp-1"]
]);
patch('public/js/pages/board-court.js', [
  ["./board.js?v=20260729-logo-feed-1", "./board.js?v=20260729-script-csp-1"]
]);
patch('public/admin/admin-bootstrap.js', [
  ["./admin.js?v=20260729-admin-authz-1", "./admin.js?v=20260729-script-csp-1"],
  ["./admin-enhancements.js?v=20260729-admin-authz-1", "./admin-enhancements.js?v=20260729-script-csp-1"],
  ["./admin-security-overrides.js?v=20260729-admin-authz-1", "./admin-security-overrides.js?v=20260729-script-csp-1"]
]);
