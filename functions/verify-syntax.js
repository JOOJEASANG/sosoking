const path = require('node:path');
const { spawnSync } = require('node:child_process');

const mode = process.argv[2];
const backend = [
  'main.js', 'admin-utils.js', 'security-utils.js', 'visibility.js', 'reporting.js',
  'privacy-maintenance.js', 'daily.js', 'profile.js', 'repair.js', 'social.js',
  'submit-secure.js', 'title-suggestion.js', 'judgment-v2.js', 'judgment-story-config.js',
  'judgment-story-writer.js', 'judgment-story-quality.js', 'judgment-story-v2.js',
  'gemini-runtime.js', 'ai-judgment-engine.js', 'generate-trial-v2.js',
  'generate-trial-ai-first.js', 'admin-actions.js', 'verify-gemini-runtime.js',
  'verify-judgment-v2.js', 'verify-judgment-story-v2.js',
  'verify-short-input-overdrive.js', 'verify-judgment-v2-integration.js',
  'verify-site-audit.js', 'verify-security-contract.js', 'verify-deployment-contract.js',
];
const frontend = [
  '../public/js/app.js', '../public/js/pages/home.js', '../public/js/pages/trial.js',
  '../public/js/pages/trial-game.js', '../public/js/pages/result.js',
  '../public/js/pages/result-case-story.js', '../public/js/pages/result-ai-first.js',
  '../public/js/pages/board.js', '../public/js/pages/board-court.js',
  '../public/js/pages/submit-court.js', '../public/js/pages/submit-guard.js',
  '../public/js/pages/auth.js', '../public/js/pages/guide.js', '../public/js/pages/policy.js',
  '../public/js/data/default-policy-docs.js', '../public/js/components/footer.js',
  '../public/js/components/theme.js', '../public/js/components/court-design.js',
  '../public/js/components/result-storage-image.js', '../public/admin/admin-delete.js',
  '../public/admin/admin-public-sync.js', '../public/admin/admin-ai-tools.js',
];

const files = mode === 'backend' ? backend : mode === 'frontend' ? frontend : [];
if (!files.length) {
  console.error('Usage: node verify-syntax.js backend|frontend');
  process.exit(2);
}

for (const file of files) {
  const args = mode === 'frontend'
    ? ['--experimental-default-type=module', '--check', path.resolve(__dirname, file)]
    : ['--check', path.resolve(__dirname, file)];
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Verified ${mode} syntax for ${files.length} files.`);